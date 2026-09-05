"""Persistent public-market snapshot with an in-RAM search view."""
import heapq
import math
from collections import OrderedDict
import json
import logging
import re
import sqlite3
import threading
import time
import unicodedata
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = 'https://api.manifold.markets/v0/'

def normalize(text: str) -> str:
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFKD', text).casefold()))

class Manifold:
    def __init__(self, settings: dict):
        self.settings = settings
        self.lock = threading.Lock()
        self.last_request = 0.0

    def request(self, path: str, params: dict | None = None, body: dict | None = None,
                authenticated: bool = False) -> dict | list:
        url = API + path + ('?' + urlencode(params) if params else '')
        headers = {'User-Agent': 'ernie-local-manifold/1.0', 'Content-Type': 'application/json'}
        if authenticated:
            key = self.settings.get('api_key', '')
            if not key:
                raise ValueError('Connect your Manifold API key in Account first.')
            headers['Authorization'] = 'Key ' + key
        for attempt in range(5 if body is None else 1):
            with self.lock:
                time.sleep(max(0, self.settings['request_interval_seconds'] - (time.monotonic() - self.last_request)))
                self.last_request = time.monotonic()
            try:
                with urlopen(Request(url, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None), timeout=40) as response:
                    return json.load(response)
            except HTTPError as error:
                message = error.read().decode()[:1500]
                if body is None and (error.code == 429 or error.code >= 500) and attempt < 4:
                    try:
                        delay = float(error.headers.get('Retry-After', 2 ** attempt))
                    except ValueError:
                        delay = 2 ** attempt
                    time.sleep(min(120, max(1, delay)))
                    continue
                raise ValueError(f'Manifold request failed: {url} — HTTP {error.code}: {message}') from error
            except (URLError, TimeoutError) as error:
                if body is None and attempt < 4:
                    time.sleep(2 ** attempt)
                    continue
                raise ValueError(f'Manifold request failed: {url} — {error}. Writes are never retried automatically; check Manifold before retrying.') from error

class MarketStore:
    def __init__(self, directory: Path, api: Manifold):
        directory.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(directory / 'markets.sqlite', check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS markets (id TEXT PRIMARY KEY, body TEXT NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        self.lock = threading.RLock()
        self.api = api
        self.filter_cache = OrderedDict()
        self.markets = {}
        self.texts = {}
        self.meta = {key: json.loads(value) for key, value in self.db.execute('SELECT key,value FROM meta')}
        self.state = {'phase': 'loading', 'error': None}
        self.wake = threading.Event()
        for market_id, body in self.db.execute('SELECT id,body FROM markets'):
            market = json.loads(body)
            self.markets[market_id] = market
            self.texts[market_id] = self.search_text(market)
        self.state['phase'] = 'ready' if self.meta.get('complete') else 'initial download'

    @staticmethod
    def search_text(market: dict) -> str:
        return normalize(market.get('question', '') + ' ' + market.get('creatorUsername', ''))

    def save(self, markets: list, **metadata) -> None:
        with self.lock:
            if markets:
                self.filter_cache.clear()
            with self.db:
                for market in markets:
                    old = self.markets.get(market['id'])
                    if old and old.get('lastUpdatedTime', 0) > market.get('lastUpdatedTime', 0):
                        continue
                    self.db.execute('INSERT OR REPLACE INTO markets VALUES (?,?)', (market['id'], json.dumps(market, separators=(',', ':'))))
                    self.markets[market['id']] = market
                    self.texts[market['id']] = self.search_text(market)
                for key, value in metadata.items():
                    self.db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', (key, json.dumps(value)))
                    self.meta[key] = value

    def status(self) -> dict:
        with self.lock:
            return {**self.state, **self.meta, 'count': len(self.markets)}

    def initial_download(self) -> None:
        if 'started' not in self.meta:
            self.save([], started=int(time.time() * 1000))
        cursor = self.meta.get('cursor')
        while not self.meta.get('complete'):
            params = {'limit': 1000, 'sort': 'created-time', 'order': 'desc'}
            if cursor:
                params['before'] = cursor
            page = self.api.request('markets', params)
            if not isinstance(page, list):
                raise ValueError('Market listing returned a non-list response')
            if not page:
                self.save([], complete=True, watermark=self.meta['started'])
                break
            next_cursor = page[-1]['id']
            if next_cursor == cursor:
                raise ValueError('Initial download cursor did not advance')
            self.save(page, cursor=next_cursor)
            cursor = next_cursor
            logging.info('Initial download: %s markets', len(self.markets))

    def refresh(self) -> None:
        # Overlap the prior watermark so timestamp boundary races are revisited.
        cutoff = self.meta.get('watermark', self.meta['started']) - 300000
        started = int(time.time() * 1000)
        cursor = None
        previous_time = float('inf')
        while True:
            params = {'limit': 1000, 'sort': 'updated-time', 'order': 'desc'}
            if cursor:
                params['before'] = cursor
            page = self.api.request('markets', params)
            if not page:
                break
            times = [market.get('lastUpdatedTime', market['createdTime']) for market in page]
            if any(a < b for a, b in zip(times, times[1:])) or times[0] > previous_time:
                raise ValueError('API updated-time pagination is not descending; refresh watermark was not advanced')
            self.save(page)
            if min(times) < cutoff:
                break
            if page[-1]['id'] == cursor:
                raise ValueError('Update cursor did not advance')
            cursor = page[-1]['id']
            previous_time = times[-1]
        self.save([], watermark=started, last_sync=int(time.time() * 1000))

    def run(self) -> None:
        while True:
            try:
                self.state.update(phase='refreshing' if self.meta.get('complete') else 'initial download', error=None)
                self.initial_download()
                self.refresh()
                self.state.update(phase='ready', error=None)
            except Exception as error:
                logging.exception('Market synchronization failed')
                self.state.update(phase='error', error=str(error))
            self.wake.wait(self.api.settings['refresh_seconds'])
            self.wake.clear()

    def search(self, query: str = '', state: str = 'all', creator: str = '', sort: str = 'volume',
               offset: int = 0, limit: int = 100, market_type: str = 'all', resolution: str = 'all',
               sorts: str | None = None) -> dict:
        started = time.perf_counter()
        tokens = re.findall(r'(?:[^\s"]+|"[^"]*")+|"[^"]*$', query)
        words = []
        for token in tokens:
            match = re.fullmatch(r'(?:name|from):(.+)', token, re.IGNORECASE)
            if match:
                creator = match.group(1).strip('"')
            else:
                term = normalize(token)
                if term:
                    words.append(term)
        now = time.time() * 1000
        fields = {'chance': 'probability', 'bettors': 'uniqueBettorCount', 'volume': 'volume',
                  'closing': 'closeTime', 'newest': 'createdTime', 'updated': 'lastUpdatedTime'}
        if sorts is None:
            specifications = [(sort, 'asc' if sort == 'closing' else 'desc')]
        else:
            specifications = []
            for part in sorts.split(',') if sorts else []:
                pieces = part.split(':')
                if len(pieces) != 2 or pieces[0] not in fields or pieces[1] not in ('asc', 'desc'):
                    raise ValueError('Invalid sort; use field:asc or field:desc')
                if pieces[0] in [key for key, _ in specifications]:
                    raise ValueError('Duplicate sort field')
                specifications.append(tuple(pieces))
            if len(specifications) > 4:
                raise ValueError('At most four sort columns are supported')
        if any(key not in fields for key, _ in specifications):
            raise ValueError('Unknown sort field')

        def order_key(market):
            values = []
            for field, direction in specifications:
                value = market.get(fields[field])
                if field == 'chance':
                    if market.get('outcomeType') != 'BINARY':
                        value = None
                    elif market.get('isResolved'):
                        value = {'YES': 1, 'NO': 0, 'MKT': market.get('resolutionProbability')}.get(market.get('resolution'))
                if not isinstance(value, (float, int)) or not math.isfinite(value):
                    values.extend((1, 0))
                else:
                    values.extend((0, value if direction == 'asc' else -value))
            # Stable natural order also prevents page overlap when explicit sorts tie.
            return (*values, -(market.get('createdTime') or 0), market['id'])

        with self.lock:
            cache_key = (tuple(words), state, creator.casefold(), market_type, resolution, int(now // 30000))
            cached = cache_key in self.filter_cache
            if cached:
                matches = self.filter_cache[cache_key]
                self.filter_cache.move_to_end(cache_key)
            else:
                matches = []
                for market_id, text in self.texts.items():
                    if words and not all(word in text for word in words):
                        continue
                    market = self.markets[market_id]
                    if creator and market.get('creatorUsername', '').casefold() != creator.casefold():
                        continue
                    resolved = market.get('isResolved', False)
                    closed = market.get('closeTime') is not None and market['closeTime'] <= now
                    if state == 'open' and (resolved or closed):
                        continue
                    if state == 'resolved' and not resolved:
                        continue
                    if state == 'closed' and not (resolved or closed):
                        continue
                    if market_type == 'binary' and market.get('outcomeType') != 'BINARY':
                        continue
                    if market_type == 'other' and market.get('outcomeType') == 'BINARY':
                        continue
                    if resolution == 'unresolved' and resolved:
                        continue
                    if resolution == 'resolved' and not resolved:
                        continue
                    if resolution in ('YES', 'NO') and (not resolved or market.get('resolution') != resolution):
                        continue
                    matches.append(market)
                self.filter_cache[cache_key] = matches
                while len(self.filter_cache) > 8:
                    self.filter_cache.popitem(last=False)
            rows = heapq.nsmallest(offset + limit, matches, key=order_key)
            result = rows[offset:offset + limit]
        return {'markets': result, 'total': len(matches), 'milliseconds': round((time.perf_counter() - started) * 1000, 1),
                'complete': bool(self.meta.get('complete')), 'filterCached': cached}
