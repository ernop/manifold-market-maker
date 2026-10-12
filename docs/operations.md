# Local operation

## Target and ownership

Local target: **http://mm.localhost**, reverse proxied by mybrowser's Caddy to **127.0.0.1:8790**. Project path `/home/ef/proj/manifold-market-maker`. Systemd user unit `manifold-market-maker.service` owns the process. Caddy registry project name `manifold-market-maker`; the PC overlay delegates dashboard Start/Stop/Restart to that unit.

Installer: `python3 scripts/install_local.py`. It preserves unrelated registry entries, adds the project, runs mybrowser's generator, validates Caddy, renders the user unit from the source template, enables/starts it, and reloads Caddy. Run with access to the sibling mybrowser directory, user service directory and local service bus. New machines need mybrowser's Caddy/launcher setup and an existing linger-enabled user account; the installer refuses to claim boot startup without linger.

The port has one fleet-wide owner in `mybrowser/utilities/caddy/projects.json`. Local `settings.json` is a checked-at-install mirror. The unit template derives the project path at install time. No per-machine paths in the template and no environment-based application config.

The generated `mybrowser/utilities/caddy/site/projects.json` feeds both the localhost dashboard and Firefox meh-tabs Local Services; no separate bookmark or duplicate newtab-config entry is necessary. Refresh the Firefox root/new-tab page to pick up the service. No Firefox profile modifications are required.

## Commands

```sh
systemctl --user status manifold-market-maker
systemctl --user restart manifold-market-maker
systemctl --user stop manifold-market-maker
journalctl --user -u manifold-market-maker -n 60
curl -H 'Host: mm.localhost' http://127.0.0.1/api/status
curl -H 'Host: mm.localhost' 'http://127.0.0.1/api/search?q=navier'
python3 -m unittest discover -s tests -v
```

Use Host headers with curl if the OS resolver does not resolve `*.localhost`; Firefox resolves it. Stop through systemd rather than killing the port, so Stop stays stopped. `Restart=always` handles unexpected clean exits too; explicit `systemctl stop` remains stopped.

## Data and account setup

`settings.json` is gitignored and mode 0600. `settings.example.json` is the schema/example. `data/markets.sqlite` holds public market snapshots and resumable import metadata. `data/actions.jsonl` records local action attempts/results; keep it private and out of Git. Drafts are ordinary Markdown and intentionally reviewable.

The initial catalog download ran to an empty page: **190,809 markets** on 2026-09-05, followed by an incremental refresh. Later counts can grow. Selected markets refresh live; search displays the cached state and sync timestamp. API failures keep the prior searchable corpus and show the error. A server restart loads disk rather than redownloading everything.

Account access is optional for searching. To connect local actions, the user enters their existing Manifold API key in the Account panel. Public username is `Ernie`; key verification uses `/me`. This agent's browser tool exposes only the in-app browser, not the user's signed-in Firefox. Do not read Firefox cookies or credential databases to bridge that limitation.

## Validation and limitations

Tests cover interrupted import resume, duplicate ID handling, stale update rejection, updated-time ordering failure, punctuation search, resolved/closed filtering, disk reload, dry-run previews, invalid bet values, owned-market resolution, mismatched account, and HTTP host/origin/private-file protection. No live bet, market creation, or resolution is performed by tests. Account actions remain unverified against a real credential until the user connects one.

Full detail retrieval and API sync require internet. RAM search works while upstream is unavailable. The incremental listing does not report deletions. Title/creator search does not promise body/comment search. Related search is editable keyword matching.

## Verified installation — 2026-09-05

The unit is active/running and enabled; `Linger=yes` is present. Caddy validated and reloaded. The localhost launcher API reports the project running with its systemd unit, and the exact generated list fetched by Firefox contains Manifold at mm.localhost. Browser rendering and the existing date-market detail/answers were inspected. Search returned 21 Navier title matches in 63–70 ms, with about 780 MiB service memory observed. All 12 tests passed with loopback access. No authenticated remote action was tested or submitted.

The bettor/alignment/filter update passed 13 tests and browser inspection, including closed binary YES/NO examples. Visible search rows and cache status refresh from the local server every 30 seconds; upstream synchronization remains every 120 seconds. Detail text carries its own fetch time and can be explicitly refreshed. Updates do not overwrite draft inputs or an open action review.

## Single-line columns and combined sorting — 2026-09-05

Eighteen tests pass, including numeric multi-sort priority, pre-pagination sorting, missing/zero probability handling, clear-sort semantics, filter-cache invalidation and HTTP preservation of an empty sort specification. The running service was restarted and browser header interaction verified. Measured changing sort over 15 cached Navier matches: 0–0.1 ms server time, approximately 1–1.5 ms local HTTP time. Combined sorting across 38,914 cached open-market matches took about 48 ms server / 50 ms HTTP; first uncached search took about 173 ms server time. Measurements describe these requests, not universal latency bounds. Frontend uses native DOM controls with no additional library.

## Date header priority correction — 2026-09-05

Selecting a header now makes it primary, retaining earlier columns as tie breakers. Browser verification on the Navier results confirms chronological ordering across months and years. Nineteen Python tests pass, including closing timestamps across hours, days, months and years, equal-date bettor ties, missing dates last, and pagination. JavaScript syntax validation passes. Static assets are served directly; no service restart or build is needed for this correction.

## Resolution review page — 2026-09-29

Service restarted with `review.py` and the `/review` page. `/api/review` returned all 20 closed, unresolved markets by Ernie. The first request took 1.2 s because it fetched the four multiple-choice markets live; later requests reuse the answer cache. All 34 tests pass, including note parsing (bullets, numbered steps, tables), format errors, answer-ID validation, cache refetch on a newer catalog record, and visible fetch failures. After adding or editing notes, run `python3 scripts/index_resolutions.py` to relink them from `resolutions/README.md`. The page was inspected in the in-app browser at a 2074 px wide viewport: no horizontal overflow, single-line rows, and working deep links (`/review#market=<id>`) and multiple-choice details. Check with `curl -H 'Host: mm.localhost' http://127.0.0.1/api/review`.

## History charts and removable creator terms — 2026-09-05

The local service was restarted with the history endpoint and creator-token parser. All 23 tests pass. Browser inspection confirmed real history rendering, creator click producing `navier name:Bayesian`, two matching results, and independent term chips. Search and sorting do not await history requests. Static rendering uses native SVG and JavaScript, with no build step. Recent gross trade amounts can count both sides and differ from Manifold market Volume; the visible legend and product documentation describe coverage limitations.
