"""Bounded, cached public bet history; independent of catalog search."""
import math
import re
import threading
import time
from collections import OrderedDict

DAY = 86400000


def summarize(bets, now, complete):
    start = now - DAY
    points, activity = [], [0.0] * 48
    recent = []
    for bet in sorted(bets, key=lambda b: (b['createdTime'], b['id'])):
        if bet.get('isRedemption') or bet.get('amount', 0) == 0:
            continue
        before, after = bet.get('probBefore'), bet.get('probAfter')
        if not all(isinstance(p, (int, float)) and math.isfinite(p) and 0 <= p <= 1 for p in (before, after)):
            continue
        timestamp = bet['createdTime']
        if timestamp < start:
            points = [[start, after]]
        elif timestamp <= now:
            if not points:
                points = [[start if complete else timestamp, before]]
            points.extend([[timestamp, before], [timestamp, after]])
            recent.append(bet)
            # Count executed cash amounts, including sales; never unfilled order amounts.
            amount = abs(bet['amount'])
            activity[min(47, int((timestamp-start)/DAY*48))] += amount
    if points:
        points.append([now, points[-1][1]])
    values = [p[1] for p in points]
    return dict(start=start, end=now, points=points, activity=activity,
                complete=complete, trades=len(recent), volume=sum(activity),
                change=(values[-1]-values[0])*100 if values else None,
                low=min(values)*100 if values else None,
                high=max(values)*100 if values else None)


class History:
    def __init__(self, api):
        self.api = api
        self.lock = threading.Lock()
        self.cache = OrderedDict()

    def get(self, market_id):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', market_id):
            raise ValueError('Invalid market ID')
        with self.lock:
            now = int(time.time()*1000)
            cached = self.cache.get(market_id)
            if cached and now-cached['end'] < 120000:
                self.cache.move_to_end(market_id)
                return cached
            bets, seen, cursor, complete = [], set(), None, False
            for _ in range(5):
                params = dict(contractId=market_id, limit=1000)
                if cursor:
                    params['before'] = cursor
                page = self.api.request('bets', params)
                if not page:
                    complete = True
                    break
                for bet in page:
                    if bet['id'] not in seen:
                        seen.add(bet['id'])
                        bets.append(bet)
                if min(b['createdTime'] for b in page) < now-DAY or len(page) < 1000:
                    complete = True
                    break
                next_cursor = page[-1]['id']
                if next_cursor == cursor:
                    break
                cursor = next_cursor
            data = summarize(bets, now, complete)
            self.cache[market_id] = data
            while len(self.cache) > 300:
                self.cache.popitem(last=False)
            return data
