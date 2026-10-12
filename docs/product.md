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

## Resolving closed markets — 2026-09-29

The user wants his closed markets reviewed, researched, and listed on a local page showing which can be resolved and why, covering binary markets and multiple-choice markets whose answers are sub-steps or progress items. He checks each recommendation and resolves on Manifold himself; the page and the research agents make no Manifold writes. Implemented at `mm.localhost/review`, backed by one checked-in research note per market in `resolutions/`. Details, note format and limits: [resolution review](resolution-review.md).

## Requested Astra conversation workflow - 2026-09-07

The user wants to ask, in ordinary language, for the market probability of a claim or a reasoned best estimate, and have a local draft prepared for review when no suitable existing market is found. They want to edit its wording and tags in the UI, then explicitly submit it to publish on Manifold.

Current implementation: `mm.localhost` has title/creator search and a manual Market workshop, but no Astra connection, conversation panel, semantic claim matching, forecast generation, or tag editor. The workshop loads a named Markdown draft and edits its question, criteria, closing date, and initial probability. Its criteria checker is lexical. Publication preparation and explicit submission exist; authenticated publication has not been verified. This Codex project chat can research claims and prepare Markdown drafts for the workshop to load, but it is not an embedded assistant with enforced market-only tools.

Proposed interface, not implemented: an Ask Astra panel beside search and the workshop. Search several formulations, inspect current criteria and individual answers, and prefer reuse when the event matches. Show matching markets and their fetch times; distinguish a displayed market probability from an executable bet quote and from Astra's own estimate. Estimates should include evidence, assumptions, and uncertainty. Report search coverage and near matches rather than asserting that a failed keyword search proves no market exists.

When no suitable market is found, populate a local editable draft with question, resolution criteria, tags, closing time, and proposed initial probability. Preserve user edits. The user reviews the final publication payload and submits it; successful publication should show the Manifold link and add the new market to local results.

Proposed control boundary: give the assistant market search/detail, research, and local draft tools. Enforce publication through the application review/submit path, with no assistant access to the Manifold key or publication execution. Instructions alone do not enforce this boundary. An embedded client could use [Codex App Server](https://learn.chatgpt.com/docs/app-server), whose official documentation was checked on 2026-09-07; the installed CLI exposes `codex app-server`. This is a proposed integration, not a tested connection or a confirmed authentication setup.

## Current research choice

End-of-2026 Navier–Stokes date, as selected by the user. The event is a **public complete solution in 2026 that is subsequently validated**, not validation itself happening in 2026. September 10, 2026 publication with February 2027 validation counts YES. A 2026 announcement without the proof is insufficient under the proposed draft; this is a proposed interpretation to discuss.

Prefer an existing multimarket if it measures that event. Do not publish a duplicate merely because a standalone binary market is convenient. The local draft is provisional and unapproved. See [research](navier-stokes-research.md).

## Comparing markets — current design, 2026-09-05

Bettor count matters at least as much as volume. Show distinct bettors as an exact integer column, default sorted descending; missing values are an em dash, not zero.

Every comparison field occupies its own aligned column: Creator, Status, Type, Chance, Bettors, Volume, Closes. Do not stack metadata, a second volume value/bar, or a second date within the row. Only the question may wrap. Numeric columns use tabular digits and right alignment; full usernames are available on hover when truncated.

Manifold labels the displayed percentage [chance](https://manifold.markets/Ansel/resolves-yes-on-jan-1-2029). Use **Chance**, not cost: this value is not an executable purchase quote. Show `90.3%Y` with green numerals, a slightly smaller green percent sign, and a smaller green Y. Accessible text explains that it means 90.3% chance of YES. Resolved YES/NO have distinct gentle green/red badges. Nonbinary rows display their type/result, not a fabricated scalar chance.

## Magnitude and deadline scanning

Volume uses fixed-decimal abbreviations (`1.1k`, `2.0k`), so increasing a value does not shorten it by dropping its decimal. A **plum**, continuous logarithmic bar grows behind the number on the same line. The fixed scale runs from 0 to 1 billion and does not rescale after filtering; larger values fill more pixels, including within an abbreviation tier. Exact volume and the scale meaning remain on hover. This supersedes the original blue, separate-line segmented bar.

The **Closes** column shows only remaining time, without “in” or a second calendar date. Units have consistent colors: years (`y`) lavender, months (`mo`) ochre, days (`d`) sage, hours (`h`) orange, minutes (`min`) coral. Months and minutes cannot be confused. Values have one decimal place; below one minute shows `<1min`. These are approximate durations (average months/years); hover shows the exact local closing timestamp. Closed, resolved and absent deadlines have explicit neutral displays. Color identifies time scale rather than market outcome.

## Direct filters and combined sorting

Core distinctions remain one-click All/Open/Closed and All/Binary/Other controls. Closed includes resolved and closed-unresolved. Resolution has its own Any/Unresolved/Resolved/YES/NO filter. Defaults: open markets and most bettors.

Click **Chance, Bettors, Volume, or Closes** to make that column the primary sort. A newly selected column starts ascending; selecting an existing secondary column promotes it without changing direction. Repeated clicks on the primary column reverse it, then remove it. Earlier columns remain as tie breakers, with visible priority numbers. This avoids a date click appearing ineffective because Bettors was still primary. Clear sorting restores natural newest-first order. No Shift key or library is required. Sort actual numbers across all filtered matches before pagination. Missing/inapplicable values stay last in both directions, with deterministic ties. Close-time sorting compares timestamps, not displayed unit strings.

## Freshness

The service attempts a refresh every 120 seconds after the previous attempt finishes. This is not a strict guarantee that any shown value is younger than two minutes. Network latency, errors, 30-second page refresh timing and a separately fetched detail panel can make a visible value older. Status shows the last successful sync and errors; details show their own fetch time and a Refresh market button. A live check at 2026-09-05 23:01:46 UTC found a 99-second-old completed catalog sync and exact agreement with the official API for selected market yAA259LCdu's probability, volume and distinct bettor count. That observation is not a permanent freshness guarantee.

## Product README

The root [readme.md](../readme.md) describes benefits using the user's priorities, not unsupported claims about accuracy, betting results or universally guaranteed speed. Technical details belong in architecture/operations. Account actions must not be described as verified with credentials before they have been.

The user-supplied screenshot `~/screenshots/20260905155443_d741581ca44f605def9d43e30373468bd1781efe31d258c11c9a0f61ca04860b.png` is copied unchanged to `docs/images/manifold-local.png`. It records an earlier interface revision and a single 63.2 ms query, not a speed guarantee.

## Recent activity sparkline

Implemented 2026-09-05 for binary rows. Use one aligned horizontal 24-hour history column, with a shared time window and fixed 0–100% probability scale so rows are comparable. A price line alone cannot distinguish low activity from heavy trading that leaves the price stable. Pair the line with plum trade-volume ticks in the same compact graphic, and visible one-line values for net percentage-point change, low–high probability range, and recent volume. Label the window and scales visibly; no hover should be needed to interpret them. Keep all values on one line per market. Tiny charts summarize history, not every individual trade; use time buckets preserving minima and maxima rather than smoothing away spikes. Unknown or incomplete coverage must look different from a flat price or zero activity.

The current question catalog contains snapshots, not sufficient history to reconstruct recent swings. The official [bets endpoint](https://docs.manifold.markets/api#get-v0bets) supports per-market and timestamp filters with pagination. The implementation fetches and caches recent history for visible markets asynchronously, without blocking RAM search or downloading all-site trade history. Reported gross volume counts both sides when returned separately and differs from the market Volume column. It sums absolute executed amounts on returned, non-redemption bet records, including sales, excluding unfilled orders. It is not guaranteed exchange-wide volume: later fills on older orders and non-trade changes can be absent. This limitation is visible above the table. Multiple-answer rows say “Select an answer”; individual answer history is not yet supported.

## Search terms and creator chips

Click a creator to retain existing text terms, remove previous `name:` or `from:` terms, and add `name:Username`. This also clears the separate Creator field to avoid a hidden conflicting restriction. The last typed creator term wins, case-insensitively and by exact username. `from:` remains an alias. My markets applies `name:Ernie` while retaining text. Every text term or double-quoted phrase is mirrored as a small remove button below the search bar; clicking removes only that term and reruns search. Quoted phrases match contiguous normalized text. Other terms are ANDed. All filtering still occurs across the full catalog before sorting/pagination.
