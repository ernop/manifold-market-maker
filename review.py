"""Resolution review: the account's closed markets joined with checked-in Markdown research notes."""
import re
import threading
import time
from pathlib import Path

VERDICTS = ('YES', 'NO', 'CANCEL', 'WAIT', 'YOUR_CALL')
CONFIDENCES = ('high', 'medium', 'low')
FIELDS = ('market', 'recommendation', 'confidence', 'checked', 'summary')
# The catalog listing omits answers, so multiple-choice answers come from a live fetch.
DETAIL_SECONDS = 300
MARKET_KEYS = ('id', 'question', 'url', 'slug', 'outcomeType', 'closeTime', 'uniqueBettorCount', 'volume',
               'probability', 'isResolved', 'resolution', 'resolutionTime', 'resolutionProbability', 'lastUpdatedTime')


def parse_verdict(value: str, top_level: bool) -> str:
    if value in VERDICTS or (top_level and value == 'ANSWERS') or re.fullmatch(r'[1-9][0-9]?%', value):
        return value
    allowed = ', '.join(VERDICTS) + (', ANSWERS' if top_level else '') + ' or a percentage such as 30%'
    raise ValueError(f'Unknown verdict "{value}"; use {allowed}')


def split_row(line: str) -> list:
    line = line.strip()
    if not (line.startswith('|') and line.endswith('|')):
        raise ValueError(f'Table row must start and end with |: {line[:80]}')
    return [cell.strip().replace('\\|', '|') for cell in re.split(r'(?<!\\)\|', line[1:-1])]


def blocks(lines: list) -> list:
    """Paragraphs, bullets, numbered steps and tables; a wrapped line continues the block above it."""
    result, open_block = [], False
    for line in lines:
        text = line.strip()
        if not text:
            open_block = False
        elif text.startswith('|'):
            if re.fullmatch(r'\|[\s:|-]+\|', text):
                continue
            if not (result and result[-1]['kind'] == 'table' and open_block):
                result.append({'kind': 'table', 'rows': []})
            result[-1]['rows'].append(split_row(text))
            open_block = True
        elif item := re.match(r'([-*]|\d+\.) +(.*)', text):
            result.append({'kind': 'step' if item.group(1)[0].isdigit() else 'bullet', 'text': item.group(2)})
            open_block = True
        elif open_block and result[-1]['kind'] != 'table':
            result[-1]['text'] += ' ' + text
        else:
            result.append({'kind': 'paragraph', 'text': text})
            open_block = True
    return result


def parse_note(text: str) -> dict:
    lines = text.splitlines()
    if not lines or lines[0].strip() != '---':
        raise ValueError('The file must start with a --- front matter line')
    end = next((i for i in range(1, len(lines)) if lines[i].strip() == '---'), None)
    if end is None:
        raise ValueError('Front matter is not closed by a --- line')
    fields = {}
    for line in lines[1:end]:
        if line.strip():
            key, colon, value = line.partition(':')
            if not colon:
                raise ValueError(f'Front matter line has no colon: {line.strip()[:80]}')
            fields[key.strip()] = value.strip()
    missing = [key for key in FIELDS if not fields.get(key)]
    if missing:
        raise ValueError('Missing front matter: ' + ', '.join(missing))
    if fields['confidence'] not in CONFIDENCES:
        raise ValueError(f'confidence must be high, medium or low, not "{fields["confidence"]}"')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', fields['checked']):
        raise ValueError(f'checked must be a YYYY-MM-DD date, not "{fields["checked"]}"')
    recommendation = parse_verdict(fields['recommendation'], top_level=True)

    title, sections = '', []
    for line in lines[end + 1:]:
        if line.startswith('## '):
            sections.append({'title': line[3:].strip(), 'lines': []})
        elif line.startswith('# ') and not sections and not title:
            title = line[2:].strip()
        elif sections:
            sections[-1]['lines'].append(line)
        elif line.strip():
            raise ValueError(f'Text before the first ## section: {line.strip()[:80]}')

    answers = {}
    for section in sections:
        if section['title'] != 'Answers':
            continue
        rows = [line for line in section['lines'] if line.strip()]
        if len(rows) < 3 or not re.fullmatch(r'\|[\s:|-]+\|', rows[1].strip()):
            raise ValueError('The Answers table needs a header row, a |---| separator row and at least one answer row')
        for line in rows[2:]:
            cells = split_row(line)
            if len(cells) != 5:
                raise ValueError(f'Answers rows need 5 cells (ID, verdict, confidence, answer, reason); found {len(cells)}: {line.strip()[:80]}')
            answer_id, verdict, confidence, answer, reason = cells
            answer_id = answer_id.strip('`')
            if confidence not in CONFIDENCES:
                raise ValueError(f'Answer {answer_id}: confidence must be high, medium or low, not "{confidence}"')
            if answer_id in answers:
                raise ValueError(f'Answer {answer_id} appears twice in the Answers table')
            answers[answer_id] = {'verdict': parse_verdict(verdict, top_level=False), 'confidence': confidence,
                                  'answer': answer, 'reason': reason}
    if recommendation == 'ANSWERS' and not answers:
        raise ValueError('recommendation ANSWERS requires an ## Answers table')
    return {'market': fields['market'], 'recommendation': recommendation, 'confidence': fields['confidence'],
            'checked': fields['checked'], 'summary': fields['summary'], 'title': title, 'answers': answers,
            'sections': [{'title': section['title'], 'blocks': blocks(section['lines'])}
                         for section in sections if section['title'] != 'Answers']}


class ReviewBoard:
    def __init__(self, directory: Path, store, api, username: str):
        self.directory = directory
        self.store = store
        self.api = api
        self.username = username
        self.lock = threading.Lock()
        self.parsed = {}
        self.details = {}

    def remember(self, market: dict) -> None:
        with self.lock:
            self.details[market['id']] = (time.time(), market)

    def notes(self) -> tuple:
        """Research notes by market ID, plus errors keyed to a market when the file names one."""
        notes, errors, loose = {}, {}, []
        current = set()
        for path in sorted(self.directory.glob('*.md')):
            if path.name == 'README.md':
                continue
            current.add(path.name)
            modified = path.stat().st_mtime_ns
            cached = self.parsed.get(path.name)
            if cached is None or cached[0] != modified:
                text = path.read_text(encoding='utf-8')
                named = re.search(r'^market:\s*(\S+)', text, re.MULTILINE)
                try:
                    cached = (modified, parse_note(text), None, None)
                except ValueError as error:
                    cached = (modified, None, str(error), named.group(1) if named else None)
                self.parsed[path.name] = cached
            _, note, error, named_market = cached
            file = 'resolutions/' + path.name
            if error and named_market:
                errors.setdefault(named_market, []).append(f'{file}: {error}')
            elif error:
                loose.append({'file': file, 'error': error})
            elif note['market'] in notes:
                errors.setdefault(note['market'], []).append(f"{file}: duplicate note; {notes[note['market']]['file']} covers this market too")
            else:
                notes[note['market']] = {**note, 'file': file, 'modified': modified // 1000000}
        for name in set(self.parsed) - current:
            del self.parsed[name]
        return notes, errors, loose

    def detail(self, market: dict) -> dict:
        with self.lock:
            cached = self.details.get(market['id'])
        # A newer catalog record means something changed upstream, e.g. an answer was resolved.
        if cached and time.time() - cached[0] < DETAIL_SECONDS \
                and cached[1].get('lastUpdatedTime', 0) >= market.get('lastUpdatedTime', 0):
            return cached[1]
        fresh = self.api.request('market/' + market['id'])
        self.remember(fresh)
        return fresh

    def row(self, market: dict, note: dict | None, errors: list) -> dict:
        row = {key: market.get(key) for key in MARKET_KEYS}
        row.update(note=note, errors=list(errors), answers=None)
        if market.get('outcomeType') == 'MULTIPLE_CHOICE':
            try:
                live = self.detail(market)
            except ValueError as error:
                row['errors'].append(f'Could not fetch answers from Manifold: {error}')
            else:
                row['shouldAnswersSumToOne'] = live.get('shouldAnswersSumToOne')
                row['answers'] = [{key: answer.get(key) for key in ('id', 'text', 'probability', 'resolution', 'resolutionTime')}
                                  for answer in sorted(live.get('answers') or [], key=lambda answer: answer.get('index', 0))]
                if live.get('lastUpdatedTime', 0) > market.get('lastUpdatedTime', 0):
                    row.update({key: live.get(key) for key in MARKET_KEYS})
                if note:
                    known = {answer['id'] for answer in row['answers']}
                    unknown = sorted(set(note['answers']) - known)
                    if unknown:
                        row['errors'].append(f"{note['file']}: answer IDs not in this market: {', '.join(unknown)}")
        elif note and note['answers']:
            row['errors'].append(f"{note['file']}: an Answers table only applies to multiple-choice markets")
        return row

    def board(self) -> dict:
        now = time.time() * 1000
        with self.lock:
            notes, errors, loose = self.notes()
        with self.store.lock:
            mine = [market for market in self.store.markets.values()
                    if market.get('creatorUsername', '').casefold() == self.username.casefold()]
        rows = []
        for market in mine:
            closed = market.get('closeTime') is not None and market['closeTime'] <= now
            note = notes.pop(market['id'], None)
            market_errors = errors.pop(market['id'], [])
            if (closed and not market.get('isResolved')) or note or market_errors:
                rows.append(self.row(market, note, market_errors))
        for market_id, note in notes.items():
            loose.append({'file': note['file'], 'error': f'Market {market_id} is not one of your markets in the local catalog'})
        for market_id, messages in errors.items():
            loose.extend({'file': message.split(':', 1)[0], 'error': message.split(': ', 1)[-1]} for message in messages)
        return {'markets': rows, 'errors': loose, 'generated': int(now), 'username': self.username}
