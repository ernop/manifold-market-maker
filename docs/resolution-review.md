# Resolution review

Recorded 2026-09-29 from the user's request: review Ernie's closed Manifold markets, research each one, and show on a local page which ones can be resolved and why, so the user can check each recommendation and resolve the market on Manifold himself. The request applies to binary markets and to multiple-choice markets whose answers are sub-steps, progress milestones, or feature claims.

## Page

**http://mm.localhost/review**, linked as "Your markets on Manifold" / "Search markets" from its header. It makes no Manifold writes.

- **Rows.** Every market created by the configured `username` (settings.json) that is closed and unresolved, plus any market that has a research note. A noted market therefore stays visible after the user resolves it or extends its close date. Views: Needs resolution (closed, unresolved; default), Resolved, All. Rows with errors show in every view.
- **Order.** Errors first, then ready to resolve (YES, NO, N/A, or a percentage; for multiple choice, at least one open answer with such a verdict), your call, wait, pending research, open again, resolved. Within a group: high confidence first, then more bettors.
- **One line per row:** recommendation badge, confidence, question, one-line summary, chance at close (binary) or open answers such as `2/9 open` (multiple choice), bettors, time since close, and an Open link to the market on Manifold. Multiple-choice recommendations appear as per-verdict counts such as `1 YES` `1 Wait`, counting only answers still open on Manifold.
- **Detail panel:** Open on Manifold to resolve (primary action), Refresh from Manifold, Copy resolution note (plain text for a Manifold comment explaining the resolution); status, close date, bettors, chance at close, research date; the recommendation and summary; Before resolving; per-answer recommendations for answers still open, and already-resolved answers with any disagreement from the research; Finding, Evidence, Other side; the market's current resolution criteria, fetched live; the note's file path.
- **Updates.** The page re-reads `/api/review` every 15 seconds, so notes written or edited on disk appear without a restart. Market status comes from the catalog, which syncs every 120 seconds. Multiple-choice answers are fetched live and cached for five minutes, or until the catalog shows a newer `lastUpdatedTime`. Refresh from Manifold fetches one market immediately.
- **Errors are shown, not hidden.** Malformed notes, unknown answer IDs, notes for markets not in the catalog, and failed answer fetches appear on the row and in the detail panel, or in a "Research files with problems" box when the file does not name a market.
- **Keyboard:** Up/Down move the selection; Enter selects a focused row. Rows and buttons act on mouse press.

Resolution stays on Manifold because the user said he will check each recommendation and click the resolve buttons on the market himself. The local binary resolve action on the search page still requires a connected API key, and the API key is not connected as of 2026-09-29. Multiple-choice answers resolve only on Manifold.

## Research notes

One checked-in Markdown file per market in [`resolutions/`](../resolutions/README.md), named after the lowercased Manifold slug. The server finds a market's note by the `market:` field, not the file name. Format:

```markdown
---
market: <market ID>
recommendation: <YES | NO | CANCEL | WAIT | YOUR_CALL | ANSWERS | NN%>
confidence: <high | medium | low>
checked: 2026-09-29
summary: <one line, at most 160 characters>
---
# <market question>

## Finding
## Answers        (multiple choice only: | Answer ID | Verdict | Confidence | Answer | Reason |)
## Evidence       (bullets: [title](url) (date): what it shows)
## Other side
## Before resolving   (optional: what the user must verify or decide)
```

- **Verdicts.** YES / NO: the evidence supports that resolution. CANCEL: resolve N/A. `NN%` (1–99): resolve to that probability. WAIT: the outcome cannot be known yet. YOUR_CALL: needs the user's own observation or a judgment only he can make. ANSWERS: multiple choice with one verdict per answer in the Answers table; rows are needed only for answers still unresolved, keyed by the exact answer ID. `|` inside a cell is written `\|`.
- **Confidence.** High: clear evidence a bettor is unlikely to dispute. Medium: supported, but a reasonable bettor could argue. Low: weak evidence or a close call.
- The parser (`review.py`) rejects unknown verdicts, missing front matter fields, malformed Answers rows, and ANSWERS without a table.

## Research run of 2026-09-29

The live API and the local catalog agreed on 1,922 markets by Ernie, 20 of them closed and unresolved: 16 binary and 4 multiple choice. Seven parallel research agents each took two to four markets. Each read the market's criteria, clarifications, and comments, did brief web research, weighed both sides, and wrote only its own note. None had Manifold write access. The agent running this session wrote the two notes that depend on personal observation (San Mateo broken things, cacti). It also spot-checked primary sources behind three recommendations: the high-confidence plate N/A, the go-cheating YES, and the low-flow shower YES (the OSF record lists no journal article, and The Guardian's author quote matches). All 20 notes were written that morning.

Research is a starting point for the user's own check, not a resolution. Sources were accessed on 2026-09-29.

## Limits

- Only closed markets are listed. Open markets with outcomes already known are out of scope; on 2026-09-29 the account had 686 open binary and 60 open multiple-choice markets.
- Markets that depend on the user's own observation (San Mateo broken things, seeing a Big 3 car at a Supercharger, the cacti) can only be framed by research; the user decides.
- The cacti market asks about mid-December 2026 and is marked WAIT until then.
