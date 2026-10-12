#!/usr/bin/env python3
"""Rewrite resolutions/README.md so every research note is linked from the documentation tree."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from review import parse_note  # noqa: E402

HEADER = """# Resolution research notes

One note per market, read by the local review page at [mm.localhost/review](http://mm.localhost/review). Format, verdict meanings and the research process: [resolution review](../docs/resolution-review.md). Regenerate this index with `python3 scripts/index_resolutions.py` after adding or editing notes; it fails on a malformed note.

| Recommendation | Confidence | Checked | Market | Note |
|---|---|---|---|---|
"""


def main() -> None:
    directory = ROOT / 'resolutions'
    rows = []
    for path in sorted(directory.glob('*.md')):
        if path.name == 'README.md':
            continue
        try:
            note = parse_note(path.read_text(encoding='utf-8'))
        except ValueError as error:
            raise SystemExit(f'{path.relative_to(ROOT)}: {error}') from error
        title = note['title'].replace('|', '\\|')
        rows.append(f"| {note['recommendation']} | {note['confidence']} | {note['checked']} | {title} | [{path.name}]({path.name}) |")
    (directory / 'README.md').write_text(HEADER + '\n'.join(rows) + '\n', encoding='utf-8')
    print(f'Indexed {len(rows)} notes in resolutions/README.md')


if __name__ == '__main__':
    main()
