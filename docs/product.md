# Product decisions

Recorded 2026-09-05 from the user's instructions and the mybrowser review.

## Shared preferences

`myb` means `mybrowser`: the cross-project hub for preferences, machine operations, and related documentation. The mandatory documentation tree starts at each project's root `agents.md`, describes the project itself, and links all technical and product knowledge. Record new decisions in Markdown rather than leaving them in chat. Shared service and taste guidance belongs in mybrowser as well.

Use named loopback hosts and the existing localhost/Firefox directory. Keep services running through systemd, with dashboard controls delegated to the same unit. Keep dependencies small, data local, controls explicit, and searches fast. Use the existing dark controls convention with white button text. No external frontend assets or analytics.

## Local Manifold service

- Download the complete publicly API-visible question catalog once. Include closed and resolved markets, not only active markets. Do not download trade history.
- Retain market data and normalized search text in RAM. Keep a resumable disk snapshot for restarts; the snapshot is not queried during search.
- Search titles and creator usernames with case-insensitive, punctuation-normalized AND substrings. Filter open/closed/resolved, creator, and sort; paginate 100 results. Details and answer probabilities are fetched on selection. This is not a full-site description index.
- Display cache completion, freshness, errors, state, chance or result, volume, close date, full criteria, and multiple-choice answers. Local snapshots are eventually consistent; selection refreshes a market from the API.
- Related search uses two nontrivial title words, editable by the user. It is keyword matching, not semantic inference.
- Account is Ernie. Existing Firefox sign-in does not give this server an API key. The user can use Manifold links in Firefox or connect a key locally. Never extract browser cookies.
- Local API actions: preview and submit binary mana bets; draft and create binary markets; record evidence and resolve own binary markets. Other market types link to Manifold. No automated betting or autonomous resolution.
- Draft checker highlights presence of common criteria sections. It cannot validate a theorem, judge evidence, or certify clarity.
- Action review binds an exact payload to a one-use, five-minute token. No writes are made during browsing, synchronization, draft saving, or text checks. Bet preview uses Manifold `dryRun`.

## Current research choice

End-of-2026 Navier–Stokes date, as selected by the user. The event is a **public complete solution in 2026 that is subsequently validated**, not validation itself happening in 2026. September 10, 2026 publication with February 2027 validation counts YES. A 2026 announcement without the proof is insufficient under the proposed draft; this is a proposed interpretation to discuss.

Prefer an existing multimarket if it measures that event. Do not publish a duplicate merely because a standalone binary market is convenient. The local draft is provisional and unapproved. See [research](navier-stokes-research.md).

## Comparing markets — user preferences, 2026-09-05

Bettor count matters at least as much as volume. Show Manifold's `uniqueBettorCount` (distinct accounts, not number of trades) as an exact integer column; missing is an em dash, not zero. Default to sorting by most bettors, with volume sorting one selection away.

Use fixed-width, right-aligned numeric/date columns with tabular figures so every row is directly comparable. Volume abbreviates to k/m/b as needed (e.g. 23k, 23.4k); hover exposes the exact value. Close dates use fixed-width local YYYY-MM-DD; hover includes local time.

Core distinctions are always-visible single-click Betting All/Open/Closed and Market type All/Binary/Other controls. Open excludes resolved and past-close markets. Closed includes both resolved and closed-unresolved. An independent resolution dropdown selects Any/Unresolved/Resolved/YES/NO. Default to open markets. Calm green indicates resolved YES and calm red indicates resolved NO, accompanied by the explicit text; unresolved YES probabilities use a gentle green tint and an explicit green Y suffix (e.g. 90.3%Y), while resolved YES/NO retain their distinct filled badges. Apply this scheme in result rows, detail headers and individual answer results.

## Deadline and magnitude scanning — 2026-09-05

Time remaining is essential: every closing-date cell leads with a relative countdown and keeps the exact local YYYY-MM-DD beneath it. Under a day show hours/minutes; under a week days/hours; under a year days; beyond that years. Amber marks <=24 hours, muted amber <=7 days, pale blue <=30 days, and neutral text later deadlines. Closed/resolved/no-deadline states are explicit and never shown as a future countdown. Hover supplies the exact local timestamp. Visible lists update every 30 seconds.

Abbreviated volume must remain visually comparable by magnitude. An eight-segment fixed decade scale accompanies each number: 1, 10, 100, 1k, 10k, 100k, 1m, 10m. Thus 92 lights two segments while 9k lights four; the scale never changes with filtering. Values of at least 1k also have stronger weight. This is logarithmic magnitude, not a linear proportion. Exact values remain on hover. Missing volume has no lit segments.

Unresolved binary and individual-answer probabilities show the YES side explicitly, e.g. 90.3%Y, with Y green and accessible text naming the probability of YES. Probability color identifies the side, not a resolved result. Preserve calm YES-green/NO-red meaning throughout.

## Product README — 2026-09-05

The root [readme.md](../readme.md) represents the product to users, using the user's priorities as the basis for its benefits: quick discovery, unique bettor counts, magnitude scanning, explicit probability direction, comparable columns, visible deadlines, clear criteria and local draft review. Describe concrete existing behavior in direct language; do not promise better bets, superior accuracy, universal speed, or tested account actions that have not been tested. Technical information belongs in architecture/operations, linked briefly from the README.

Screenshot: user-supplied `~/screenshots/20260905155443_d741581ca44f605def9d43e30373468bd1781efe31d258c11c9a0f61ca04860b.png`, copied unchanged to `docs/images/manifold-local.png`. It shows the selected Navier–Stokes market, filters and comparison columns. The screenshot's 63.2 ms is one observed query, not a performance guarantee.
