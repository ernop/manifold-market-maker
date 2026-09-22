# Manifold local — project and agent index

Local Manifold question search, current market inspection, mana betting, and a Markdown market workshop for **Ernie** (public account ID `kbHiTAGBahXdX9Z4sW29JpNrB0l2`). User calls the account `ernie`; Manifold's public username endpoint is case-sensitive and returns `Ernie`.

## Mandatory documentation hierarchy

All product choices, guides, research, operational facts, and durable working knowledge must be materialized in actual `.md` files reachable through this root `agents.md`. Update the narrowest existing document and its parent links when decisions change. Chat and agent-private memory are not the source of truth. This applies to technical and product information equally.

## Start here

- [Product overview and screenshot](readme.md): what users can do and why the interface is organized this way.

- [Product decisions and scope](docs/product.md): what the service does, account actions, user taste, and current boundaries.
- [Architecture and API behavior](docs/architecture.md): RAM search, restart cache, initial download and updates, authentication and action review.
- [Operation and local deployment](docs/operations.md): service, hostname, Caddy, Firefox, checks and recovery.
- [Navier–Stokes market research](docs/navier-stokes-research.md): existing market, date-versus-validation distinction, draft status and sources.
- [Reddit illustration retirement market](docs/reddit-illustrations-research.md): image references with direct URLs, existing-market search, complete-retirement criteria, and open scope/date choices.
- [GitHub and repository](docs/github.md): account audit, public repository, and publishing conventions.
- [Draft index](drafts/README.md): all local market drafts.
- [Shared mybrowser orientation](../mybrowser/agents.md), [existing detailed index](../mybrowser/AGENTS.md), and [local services guide](../mybrowser/utilities/caddy/README.md).

## Working rules

Follow `../mybrowser/AGENTS.md` and relevant `.cursor/rules/`: plain direct language, no relationship framing, minimal dependencies, config in gitignored `settings.json` (never environment-variable configuration), lowercase ASCII-safe filenames. Preserve unrelated work. Do not commit or push without instruction. New repositories use `master`.

Repository: [ernop/manifold-market-maker](https://github.com/ernop/manifold-market-maker), public, default branch `master`. The user selected and authorized creation of this repository on 2026-09-05. Local service deployment is independent of GitHub publication.

Current local implementation uses Python standard library plus HTML/CSS/JavaScript. Run `python3 -m unittest discover -s tests -v`. Run `python3 server.py` for a foreground process only when the systemd service is stopped.
