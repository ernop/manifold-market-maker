# Architecture and API contract

## Data path

`market_store.py` uses the official [Manifold API](https://docs.manifold.markets/api) at `https://api.manifold.markets/v0/`. The checked source [API documentation](https://github.com/manifoldmarkets/manifold/blob/main/docs/docs/api.md) was inspected 2026-09-05. GETs retry rate limits, server errors, and connection errors with backoff. Writes are single-attempt. Requests share a 0.3-second minimum interval, below the documented 500/minute/IP rate limit.

Initial import requests `/markets?limit=1000&sort=created-time&order=desc`, following the last returned market ID in `before` until an empty page. Each page and cursor commit together in SQLite (`data/markets.sqlite`, WAL). On interruption the cursor resumes; it does not start the catalog again. ID upserts remove duplicates. The endpoint gives an eventually consistent public catalog, not an atomic snapshot or private/unlisted data unavailable to the caller.

RAM owns the market dictionary and normalized title/creator strings. Disk is only restart persistence. Search performs substring filtering in RAM and bounded selection for pagination. An eight-entry cache reuses filtered matches across sort changes; market upserts invalidate it, and 30-second time buckets reconsider open/closed status. Multi-column sorting builds numeric comparison keys, keeps missing values last in either direction, and adds creation time/ID tie-breakers before pagination. No frontend sorting dependency is needed. Full details on selection refresh a market from `/market/{id}`. Listing updates can replace full descriptions; descriptions are not part of the declared search corpus.

Updates run every 120 seconds using `sort=updated-time` plus the ID cursor, going back to the previous refresh's starting timestamp with a five-minute overlap. The first refresh covers everything changed during initial download. Verify descending timestamps on every update page; if upstream stops honoring that order, retain the previous watermark and expose the failure. Do not silently claim fresh data. Deleted markets cannot be discovered by this incremental feed; a stale title may remain until a future reconciliation feature. This limitation is visible here and should be considered if deletion accuracy becomes important.

## Local HTTP application

`server.py` uses `ThreadingHTTPServer`, bound to `127.0.0.1:8790`, with Caddy routing `mm.localhost`. No external dependencies. Settings come only from `settings.json`, with `settings.example.json` as the template. Missing/invalid config fails startup.

Static routes are an explicit allowlist. Host headers are restricted; POSTs require the same-origin application header and an exact origin when supplied. CORS is not granted. CSP disallows external scripts, frames, and form submission; all remote market content uses DOM text, never HTML execution. API keys are never included in API responses or logs. Settings are mode 0600.

## Account actions

The user provides an API key through Account. `/me` verifies the account matches Ernie before storing it. Account APIs require that identity on every prepared action. The key is sent only as Manifold's Authorization header. Firefox cookies are not accessed.

`/api/prepare` validates the action, fetches current market state, and returns an exact preview. Bet previews invoke `dryRun:true`; create/resolve previews do not write upstream. `/api/execute` consumes the preview once, verifies account identity, writes an intent record in `data/actions.jsonl`, and makes one remote request. No automatic POST retries. An uncertain response requires inspecting Manifold before preparing a new action; the local token is not a remote idempotency guarantee. Concurrent local account/action requests are serialized.

Binary mana bets only. Multiple-choice answers are displayed with links for trading on Manifold. Resolving requires an owned unresolved binary market and a nonempty evidence note; the note is recorded locally, not posted as a comment. Creation is public binary with user-selected initial probability and current documented cost of 50 mana, which must be rechecked if the API changes.

Local draft saves write actual `.md` files and add them to [the draft index](../drafts/README.md). Draft evaluation uses labeled lexical checks, not an LLM or proof verifier.

## Recent trade history

`history.py` serves `/api/history/{id}` independently of search. It requests newest public bets until the 24h boundary or end, with a five-page/5,000-record cap and duplicate-ID suppression. Capped responses are labeled Partial. A 300-market RAM cache expires after 120 seconds; history fetches are serialized, sharing the upstream rate limiter. The client fetches one market at a time for the current page, reuses a bounded cache across sorts, and stops requesting old-page markets after a search change. Price geometry preserves pixel-bucket minima/maxima on a common 0–100% scale. Volume uses 48 half-hour bins and a shared logarithmic scale (0–1 million mana per bin, saturating). Data is creation-time bet history, not a complete fill-event or liquidity-event feed; the UI states that limitation. Errors and missing history are explicit. No chart library or all-site trade import was added.
