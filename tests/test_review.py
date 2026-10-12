import os
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import Mock

from review import ReviewBoard, blocks, parse_note

BINARY_NOTE = """---
market: bin1
recommendation: NO
confidence: high
checked: 2026-09-29
summary: NO: nothing was announced.
---
# Will it happen?

## Finding

Nothing happened
before the deadline.

## Evidence

- [Source](https://example.com/a_(b)) (2026-06-01): shows it.
- Second item
  continues here.

## Before resolving

Check the page.
"""

CHOICE_NOTE = """---
market: mc1
recommendation: ANSWERS
confidence: medium
checked: 2026-09-29
summary: One YES, one wait.
---
# Which?

## Finding

Mixed.

## Answers

| Answer ID | Verdict | Confidence | Answer | Reason |
|---|---|---|---|---|
| `a1` | YES | high | First \\| option | It happened. |
| a2 | 30% | low | Second | Partly. |
"""


def market(id, **fields):
    return {'id': id, 'question': id, 'creatorUsername': 'Ernie', 'outcomeType': 'BINARY', 'isResolved': False,
            'closeTime': 1, 'lastUpdatedTime': 100, 'url': 'https://manifold.markets/Ernie/' + id, **fields}


class ParseTests(unittest.TestCase):
    def test_binary_note_fields_and_sections(self):
        note = parse_note(BINARY_NOTE)
        self.assertEqual((note['market'], note['recommendation'], note['confidence']), ('bin1', 'NO', 'high'))
        self.assertEqual(note['title'], 'Will it happen?')
        self.assertEqual([section['title'] for section in note['sections']], ['Finding', 'Evidence', 'Before resolving'])
        self.assertEqual(note['sections'][0]['blocks'], [{'kind': 'paragraph', 'text': 'Nothing happened before the deadline.'}])
        self.assertEqual(note['sections'][1]['blocks'][1], {'kind': 'bullet', 'text': 'Second item continues here.'})
        self.assertEqual(note['answers'], {})

    def test_answers_table_with_escaped_pipe_and_percent(self):
        note = parse_note(CHOICE_NOTE)
        self.assertEqual(note['answers']['a1'], {'verdict': 'YES', 'confidence': 'high', 'answer': 'First | option', 'reason': 'It happened.'})
        self.assertEqual(note['answers']['a2']['verdict'], '30%')
        self.assertNotIn('Answers', [section['title'] for section in note['sections']])

    def test_invalid_notes_raise_with_reason(self):
        cases = {
            'must start': BINARY_NOTE.replace('---\n', '', 1),
            'Missing front matter: summary': BINARY_NOTE.replace('summary: NO: nothing was announced.\n', ''),
            'Unknown verdict "MAYBE"': BINARY_NOTE.replace('recommendation: NO', 'recommendation: MAYBE'),
            'confidence must be': BINARY_NOTE.replace('confidence: high', 'confidence: sure'),
            'YYYY-MM-DD': BINARY_NOTE.replace('checked: 2026-09-29', 'checked: yesterday'),
            'requires an ## Answers table': BINARY_NOTE.replace('recommendation: NO', 'recommendation: ANSWERS'),
            'need 5 cells': CHOICE_NOTE.replace('| a2 | 30% | low | Second | Partly. |', '| a2 | NO | low |'),
            'Unknown verdict "100%"': CHOICE_NOTE.replace('| a2 | 30% |', '| a2 | 100% |'),
            'appears twice': CHOICE_NOTE.replace('| a2 | 30%', '| a1 | 30%'),
        }
        for message, text in cases.items():
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                parse_note(text)

    def test_blocks_keep_tables_separate(self):
        result = blocks(['| Year | Days |', '|---|---|', '| 2024 | 301 |', '', 'After.'])
        self.assertEqual(result, [{'kind': 'table', 'rows': [['Year', 'Days'], ['2024', '301']]},
                                  {'kind': 'paragraph', 'text': 'After.'}])

    def test_numbered_steps_are_separate_items(self):
        result = blocks(['Do this:', '', '1. First step', '   continued.', '2. Second step'])
        self.assertEqual(result, [{'kind': 'paragraph', 'text': 'Do this:'},
                                  {'kind': 'step', 'text': 'First step continued.'},
                                  {'kind': 'step', 'text': 'Second step'}])


class BoardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.directory = Path(self.tmp.name)
        self.store = Mock()
        self.store.lock = threading.RLock()
        future = int(time.time() * 1000) + 86400000
        self.store.markets = {
            'bin1': market('bin1'),
            'open': market('open', closeTime=future),
            'done': market('done', isResolved=True, resolution='YES'),
            'mc1': market('mc1', outcomeType='MULTIPLE_CHOICE'),
            'other': market('other', creatorUsername='Someone'),
        }
        self.api = Mock()
        self.api.request.return_value = {**market('mc1', outcomeType='MULTIPLE_CHOICE'), 'shouldAnswersSumToOne': False,
                                         'answers': [{'id': 'a2', 'text': 'Second', 'index': 1, 'probability': .3},
                                                     {'id': 'a1', 'text': 'First', 'index': 0, 'probability': .9, 'resolution': 'YES'}]}
        self.board = ReviewBoard(self.directory, self.store, self.api, 'ernie')

    def tearDown(self):
        self.tmp.cleanup()

    def rows(self):
        data = self.board.board()
        return {row['id']: row for row in data['markets']}, data['errors']

    def test_closed_unresolved_markets_and_noted_markets_are_listed(self):
        (self.directory / 'done.md').write_text(BINARY_NOTE.replace('market: bin1', 'market: done'))
        rows, errors = self.rows()
        self.assertEqual(set(rows), {'bin1', 'mc1', 'done'})
        self.assertEqual(rows['done']['note']['recommendation'], 'NO')
        self.assertIsNone(rows['bin1']['note'])
        self.assertEqual(errors, [])

    def test_answers_come_from_live_detail_in_market_order(self):
        (self.directory / 'mc1.md').write_text(CHOICE_NOTE)
        rows, _ = self.rows()
        self.assertEqual([answer['id'] for answer in rows['mc1']['answers']], ['a1', 'a2'])
        self.assertEqual(rows['mc1']['errors'], [])
        self.assertEqual(self.api.request.call_args.args[0], 'market/mc1')

    def test_detail_is_cached_until_catalog_record_changes(self):
        self.rows()
        self.rows()
        self.assertEqual(self.api.request.call_count, 1)
        self.store.markets['mc1'] = market('mc1', outcomeType='MULTIPLE_CHOICE', lastUpdatedTime=200)
        self.rows()
        self.assertEqual(self.api.request.call_count, 2)

    def test_unknown_answer_ids_and_malformed_files_are_reported(self):
        (self.directory / 'mc1.md').write_text(CHOICE_NOTE.replace('| a2 |', '| zz |'))
        (self.directory / 'bin1.md').write_text(BINARY_NOTE.replace('confidence: high', 'confidence: sure'))
        (self.directory / 'loose.md').write_text('no front matter')
        (self.directory / 'README.md').write_text('index, not a note')
        rows, errors = self.rows()
        self.assertIn('answer IDs not in this market: zz', rows['mc1']['errors'][0])
        self.assertIn('resolutions/bin1.md: confidence must be', rows['bin1']['errors'][0])
        self.assertEqual(errors, [{'file': 'resolutions/loose.md', 'error': 'The file must start with a --- front matter line'}])

    def test_note_for_unknown_market_and_fetch_failure_are_visible(self):
        (self.directory / 'x.md').write_text(BINARY_NOTE.replace('market: bin1', 'market: nowhere'))
        self.api.request.side_effect = ValueError('HTTP 503')
        rows, errors = self.rows()
        self.assertEqual(errors[0]['error'], 'Market nowhere is not one of your markets in the local catalog')
        self.assertIsNone(rows['mc1']['answers'])
        self.assertIn('HTTP 503', rows['mc1']['errors'][0])

    def test_edited_file_is_reparsed(self):
        path = self.directory / 'bin1.md'
        path.write_text(BINARY_NOTE)
        self.assertEqual(self.rows()[0]['bin1']['note']['recommendation'], 'NO')
        path.write_text(BINARY_NOTE.replace('recommendation: NO', 'recommendation: YES'))
        stat = path.stat()
        os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000))
        self.assertEqual(self.rows()[0]['bin1']['note']['recommendation'], 'YES')


if __name__ == '__main__':
    unittest.main()
