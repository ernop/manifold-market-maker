import json
import tempfile
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import Mock

from market_store import MarketStore
from server import Application, evaluate_draft, make_handler


def market(id, title='Navier–Stokes proof', **kwargs):
    return {'id': id, 'question': title, 'creatorUsername': 'Ernie', 'creatorId': 'ernie-id', 'createdTime': 100,
            'lastUpdatedTime': 100, 'volume': 10, 'outcomeType': 'BINARY', 'isResolved': False, **kwargs}


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.api = Mock()
        self.store = MarketStore(Path(self.tmp.name), self.api)

    def tearDown(self):
        self.store.db.close()
        self.tmp.cleanup()

    def test_resume_and_deduplication(self):
        self.store.save([market('a')], started=1, cursor='a')
        self.api.request.side_effect = [[market('b')], []]
        self.store.initial_download()
        self.assertEqual(self.api.request.call_args_list[0].args[1]['before'], 'a')
        self.assertTrue(self.store.meta['complete'])
        self.store.save([market('b')])
        self.assertEqual(len(self.store.markets), 2)

    def test_older_record_does_not_replace_fresh(self):
        self.store.save([market('a', lastUpdatedTime=200, probability=.9)])
        self.store.save([market('a', lastUpdatedTime=100, probability=.1)])
        self.assertEqual(self.store.markets['a']['probability'], .9)

    def test_search_unicode_and_states(self):
        self.store.save([market('a'), market('b', isResolved=True), market('c', closeTime=1)])
        self.assertEqual(self.store.search('NAVIER-STOKES', state='open')['total'], 1)
        self.assertEqual(self.store.search('navier stokes', state='closed', resolution='unresolved')['markets'][0]['id'], 'c')
        self.assertEqual(self.store.search('proof', state='resolved', creator='ernie')['markets'][0]['id'], 'b')
        self.assertEqual(self.store.search('unrelated')['total'], 0)

    def test_bettor_sort_and_type_resolution_filters(self):
        self.store.save([market('a', uniqueBettorCount=5),
                         market('b', uniqueBettorCount=100, outcomeType='MULTIPLE_CHOICE'),
                         market('c', uniqueBettorCount=20, isResolved=True, resolution='YES')])
        self.assertEqual([x['id'] for x in self.store.search(sort='bettors')['markets']], ['b','c','a'])
        self.assertEqual(self.store.search(market_type='binary', state='open')['total'], 1)
        self.assertEqual(self.store.search(market_type='other')['markets'][0]['id'], 'b')
        self.assertEqual(self.store.search(state='closed', resolution='YES')['markets'][0]['id'], 'c')
        self.assertEqual(self.store.search(resolution='NO')['total'], 0)

    def test_bad_update_sort_keeps_watermark(self):
        self.store.save([], started=1, watermark=10)
        self.api.request.return_value = [market('a', lastUpdatedTime=200), market('b', lastUpdatedTime=300)]
        with self.assertRaisesRegex(ValueError, 'not descending'):
            self.store.refresh()
        self.assertEqual(self.store.meta['watermark'], 10)

    def test_repeated_cursor_does_not_claim_complete(self):
        self.store.save([market('a')], started=1, cursor='a')
        self.api.request.return_value = [market('a')]
        with self.assertRaisesRegex(ValueError, 'did not advance'):
            self.store.initial_download()
        self.assertFalse(self.store.meta.get('complete', False))

    def test_disk_reload(self):
        self.store.save([market('a')], cursor='a')
        restored = MarketStore(Path(self.tmp.name), self.api)
        self.assertEqual(restored.search('navier')['total'], 1)
        self.assertEqual(restored.meta['cursor'], 'a')
        restored.db.close()


class ActionTests(unittest.TestCase):
    def setUp(self):
        self.app = Application.__new__(Application)
        self.app.settings = {'username': 'ernie'}
        self.app.api = Mock()
        self.app.previews = {}
        self.app.identity = Mock(return_value={'id': 'ernie-id', 'username': 'Ernie'})
        self.app.detail = Mock(return_value=market('a'))

    def test_bet_preview_is_dry_run_and_payload_bound(self):
        self.app.api.request.return_value = {'shares': 20}
        preview = self.app.prepare({'kind': 'bet', 'marketId': 'a', 'amount': 10, 'outcome': 'YES'})
        self.assertTrue(self.app.api.request.call_args.kwargs['body']['dryRun'])
        self.assertNotIn('dryRun', self.app.previews[preview['token']]['payload'])
        self.assertEqual(self.app.previews[preview['token']]['payload']['amount'], 10)

    def test_invalid_bets_never_reach_api(self):
        for amount in [float('nan'), float('inf'), -1, 0]:
            with self.assertRaises(ValueError):
                self.app.prepare({'kind': 'bet', 'marketId': 'a', 'amount': amount, 'outcome': 'YES'})
        self.app.api.request.assert_not_called()

    def test_resolving_someone_elses_market_is_rejected(self):
        self.app.detail.return_value = market('a', creatorId='someone-else')
        with self.assertRaises(ValueError):
            self.app.prepare({'kind':'resolve', 'marketId':'a', 'outcome':'YES', 'evidence':'source'})
        self.app.api.request.assert_not_called()

    def test_account_mismatch(self):
        self.app.api.request.return_value = {'id':'other', 'username':'SomeoneElse'}
        with self.assertRaises(ValueError):
            Application.identity(self.app)

    def test_missing_token_cannot_execute(self):
        with self.assertRaises(ValueError):
            self.app.execute('missing')
        self.app.api.request.assert_not_called()


class HTTPTests(unittest.TestCase):
    def test_untrusted_origin_host_and_files(self):
        app = Mock()
        app.settings = {'hostname':'mm.localhost', 'port':8790}
        server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(app))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            def request(method, path, headers):
                connection = HTTPConnection('127.0.0.1', server.server_port)
                connection.request(method, path, body='{}' if method == 'POST' else None, headers=headers)
                response = connection.getresponse()
                status, body = response.status, response.read()
                connection.close()
                return status, body
            self.assertEqual(request('GET', '/', {'Host':'evil.example'})[0], 403)
            self.assertEqual(request('GET', '/settings.json', {'Host':'mm.localhost'})[0], 404)
            self.assertEqual(request('GET', '/../../settings.json', {'Host':'mm.localhost'})[0], 404)
            self.assertEqual(request('POST', '/api/execute', {'Host':'mm.localhost'})[0], 403)
            self.assertEqual(request('POST', '/api/execute', {'Host':'mm.localhost', 'Origin':'https://evil.example','X-Requested-With':'mm-local'})[0], 403)
            status, body = request('GET', '/', {'Host':'mm.localhost'})
            self.assertEqual(status, 200)
            self.assertIn(b'Manifold', body)
            app.execute.assert_not_called()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
