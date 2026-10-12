#!/usr/bin/env python3
import json
import logging
import math
import mimetypes
import re
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from market_store import Manifold, MarketStore
from history import History
from review import ReviewBoard

ROOT = Path(__file__).resolve().parent


def load_settings() -> dict:
    path = ROOT / 'settings.json'
    if not path.exists():
        raise SystemExit('Create settings.json from settings.example.json before starting.')
    settings = json.loads(path.read_text())
    if not 1024 <= settings['port'] <= 65535 or settings['refresh_seconds'] < 30 or settings['request_interval_seconds'] < 0.15:
        raise SystemExit('Invalid settings: port must be 1024–65535, refresh >= 30s, request interval >= 0.15s.')
    return settings


def evaluate_draft(draft: dict) -> list:
    text = draft.get('description', '').lower()
    checks = [
        ('Explicit YES condition', 'yes' in text),
        ('Explicit NO condition', 'no' in text),
        ('Deadline and timezone in criteria', bool(re.search(r'202[6-9]', text)) and any(z in text for z in ['utc', 'pacific', 'eastern'])),
        ('Named source of evidence', any(z in text for z in ['https://', 'http://'])),
        ('Partial results / edge cases addressed', any(z in text for z in ['partial', 'does not count', 'do not count'])),
        ('Disputes / retractions addressed', any(z in text for z in ['dispute', 'retract', 'withdraw'])),
    ]
    return [{'label': label, 'present': present} for label, present in checks]


class Application:
    def __init__(self, settings: dict):
        self.settings = settings
        self.api = Manifold(settings)
        self.store = MarketStore(ROOT / 'data', self.api)
        self.history = History(self.api)
        self.review = ReviewBoard(ROOT / 'resolutions', self.store, self.api, settings['username'])
        self.previews = {}
        self.action_lock = threading.Lock()
        self.draft_lock = threading.Lock()

    def identity(self) -> dict:
        user = self.api.request('me', authenticated=True)
        if user['username'].casefold() != self.settings['username'].casefold():
            raise ValueError(f"Connected account is {user['username']}; expected {self.settings['username']}.")
        return {key: user.get(key) for key in ['id', 'username', 'name', 'balance']}

    def detail(self, market_id: str) -> dict:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', market_id):
            raise ValueError('Invalid market ID')
        market = self.api.request('market/' + market_id)
        self.store.save([market])
        self.review.remember(market)
        return market

    def prepare(self, data: dict) -> dict:
        account = self.identity()
        kind = data['kind']
        if kind == 'bet':
            market = self.detail(data['marketId'])
            if market.get('token', 'MANA') != 'MANA' or market['outcomeType'] != 'BINARY':
                raise ValueError('Local betting supports binary mana markets. Open Manifold for other market types.')
            if market.get('isResolved') or (market.get('closeTime') or float('inf')) <= time.time() * 1000:
                raise ValueError('This market is closed or resolved.')
            amount = float(data['amount'])
            if not math.isfinite(amount) or amount <= 0 or data['outcome'] not in ['YES', 'NO']:
                raise ValueError('Enter a positive finite mana amount and YES or NO.')
            payload = {'contractId': market['id'], 'amount': amount, 'outcome': data['outcome']}
            simulation = self.api.request('bet', body={**payload, 'dryRun': True}, authenticated=True)
            path = 'bet'
            summary = {'question': market['question'], 'amount': amount, 'outcome': data['outcome'], 'simulation': simulation}
        elif kind == 'create':
            question = str(data['question']).strip()
            description = str(data['description']).strip()
            close_time = int(data['closeTime'])
            probability = int(data['initialProb'])
            if not question or not description or not 1 <= probability <= 99 or close_time <= time.time() * 1000:
                raise ValueError('A question, criteria, future close time, and initial probability of 1–99 are required.')
            payload = {'outcomeType': 'BINARY', 'question': question, 'descriptionMarkdown': description,
                       'closeTime': close_time, 'initialProb': probability, 'visibility': 'public'}
            path = 'market'
            summary = {**payload, 'creationCostMana': 50}
        elif kind == 'resolve':
            market = self.detail(data['marketId'])
            if market['creatorId'] != account['id'] or market['outcomeType'] != 'BINARY' or market.get('isResolved'):
                raise ValueError('Only your own unresolved binary markets can be resolved here.')
            if data['outcome'] not in ['YES', 'NO', 'CANCEL'] or not data.get('evidence', '').strip():
                raise ValueError('Choose YES, NO, or CANCEL and record your evidence first.')
            payload = {'outcome': data['outcome']}
            path = 'market/' + market['id'] + '/resolve'
            summary = {'question': market['question'], 'outcome': data['outcome'], 'evidence': data['evidence']}
        else:
            raise ValueError('Unknown action')
        token = uuid.uuid4().hex
        self.previews = {key: value for key, value in self.previews.items() if value['expires'] > time.time()}
        self.previews[token] = {'kind': kind, 'path': path, 'payload': payload, 'summary': summary,
                                'expires': time.time() + 300, 'account': account['id']}
        return {'token': token, 'kind': kind, 'account': account['username'], 'summary': summary, 'expiresInSeconds': 300}

    def execute(self, token: str) -> dict:
        preview = self.previews.pop(token, None)
        if not preview or preview['expires'] < time.time():
            raise ValueError('Preview expired or already submitted. Prepare a new preview.')
        if self.identity()['id'] != preview['account']:
            raise ValueError('Account changed after preview')
        # Journal the intent before the one-shot remote request: a timeout can mean success.
        log = ROOT / 'data' / 'actions.jsonl'
        with log.open('a') as stream:
            stream.write(json.dumps({'time': time.time(), 'token': token, 'state': 'submitting', **preview}) + '\n')
        result = self.api.request(preview['path'], body=preview['payload'], authenticated=True)
        with log.open('a') as stream:
            stream.write(json.dumps({'time': time.time(), 'token': token, 'state': 'completed', 'result': result}) + '\n')
        self.store.wake.set()
        return result


def make_handler(app: Application):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args) -> None:
            logging.info('%s %s', self.address_string(), format % args)

        def trusted_host(self) -> bool:
            return self.headers.get('Host', '') in {app.settings['hostname'], f"127.0.0.1:{app.settings['port']}", f"localhost:{app.settings['port']}"}

        def respond(self, value, status: int = 200, content_type: str = 'application/json') -> None:
            body = value if isinstance(value, bytes) else json.dumps(value).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            try:
                if not self.trusted_host():
                    return self.respond({'error': 'Unrecognized host'}, 403)
                parsed = urlsplit(self.path)
                query = {key: values[0] for key, values in parse_qs(parsed.query, keep_blank_values=True).items()}
                path = parsed.path
                if path == '/api/status':
                    return self.respond({**app.store.status(), 'username': app.settings['username'], 'connected': bool(app.settings.get('api_key'))})
                if path == '/api/search':
                    return self.respond(app.store.search(query.get('q', '')[:500], query.get('state', 'all'), query.get('creator', ''), query.get('sort', 'volume'), max(0, min(1000000, int(query.get('offset', 0)))), market_type=query.get('type', 'all'), resolution=query.get('resolution', 'all'), sorts=query.get('sorts')))
                if path.startswith('/api/history/'):
                    return self.respond(app.history.get(path.split('/')[-1]))
                if path.startswith('/api/market/'):
                    return self.respond(app.detail(path.split('/')[-1]))
                if path == '/api/review':
                    return self.respond(app.review.board())
                if path == '/api/account':
                    return self.respond(app.identity())
                if path == '/api/draft':
                    name = query.get('name', 'navier-stokes-2026')
                    if not re.fullmatch(r'[a-zA-Z0-9_-]+', name):
                        raise ValueError('Invalid draft name')
                    draft_path = ROOT / 'drafts' / (name + '.md')
                    return self.respond({'name': name, 'markdown': draft_path.read_text() if draft_path.exists() else ''})
                static = {'/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/favicon.svg': 'favicon.svg',
                          '/review': 'review.html', '/review.js': 'review.js', '/review.css': 'review.css'}
                if path in static:
                    file = ROOT / 'static' / static[path]
                    return self.respond(file.read_bytes(), content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
                self.respond({'error': 'Not found'}, 404)
            except (ValueError, KeyError) as error:
                self.respond({'error': str(error)}, 400)
            except Exception:
                logging.exception('GET failed: %s', self.path)
                self.respond({'error': 'Local server error; see the service log.'}, 500)

        def do_POST(self) -> None:
            try:
                if not self.trusted_host() or self.headers.get('X-Requested-With') != 'mm-local':
                    return self.respond({'error': 'Same-origin application request required'}, 403)
                origin = self.headers.get('Origin')
                if origin and origin != 'http://' + self.headers.get('Host', ''):
                    return self.respond({'error': 'Origin mismatch'}, 403)
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 100000:
                    raise ValueError('Invalid request size')
                data = json.loads(self.rfile.read(length))
                path = urlsplit(self.path).path
                if path == '/api/sync':
                    app.store.wake.set()
                    return self.respond({'queued': True})
                if path == '/api/draft':
                    name = data.get('name', 'navier-stokes-2026')
                    if not re.fullmatch(r'[a-zA-Z0-9_-]+', name):
                        raise ValueError('Draft names use letters, digits, underscores and hyphens')
                    with app.draft_lock:
                        file = ROOT / 'drafts' / (name + '.md')
                        file.write_text(data['markdown'])
                        index = ROOT / 'drafts' / 'README.md'
                        link = f'- [{name}]({name}.md)'
                        text = index.read_text()
                        if link not in text:
                            index.write_text(text + '\n' + link + '\n')
                    return self.respond({'saved': True})
                if path == '/api/evaluate':
                    return self.respond({'checks': evaluate_draft(data), 'note': 'Text checks only. They do not establish that a market is unambiguous or that a proof is correct.'})
                with app.action_lock:
                    if path == '/api/connect':
                        previous = app.settings['api_key']
                        app.settings['api_key'] = str(data['apiKey']).strip()
                        try:
                            account = app.identity()
                        except Exception:
                            app.settings['api_key'] = previous
                            raise
                        target = ROOT / 'settings.json'
                        temporary = target.with_suffix('.tmp')
                        temporary.touch(mode=0o600, exist_ok=True)
                        temporary.chmod(0o600)
                        temporary.write_text(json.dumps(app.settings, indent=2) + '\n')
                        temporary.replace(target)
                        return self.respond(account)
                    if path == '/api/prepare':
                        return self.respond(app.prepare(data))
                    if path == '/api/execute':
                        return self.respond(app.execute(data['token']))
                self.respond({'error': 'Not found'}, 404)
            except (ValueError, KeyError) as error:
                self.respond({'error': str(error)}, 400)
            except Exception:
                logging.exception('POST failed: %s', self.path)
                self.respond({'error': 'Local server error; check Manifold before retrying a submitted action.'}, 500)
    return Handler


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    application = Application(load_settings())
    threading.Thread(target=application.store.run, daemon=True).start()
    server = ThreadingHTTPServer(('127.0.0.1', application.settings['port']), make_handler(application))
    server.daemon_threads = True
    logging.info('Serving http://%s on port %s', application.settings['hostname'], application.settings['port'])
    server.serve_forever()
