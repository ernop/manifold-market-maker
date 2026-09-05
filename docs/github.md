# GitHub account and repository audit

Checked 2026-09-05. GitHub CLI `gh` is installed and authenticates as **ernop / Ernest French** using the existing OS keyring. HTTPS Git transport. Run read-only authenticated GitHub commands outside the restricted network sandbox when needed; the sandbox reported an invalid token while the approved external check succeeded. Do not reauthenticate or replace credentials based on the sandbox error.

Commands used: `gh api user`, `gh repo list ernop --limit 200 --json name,description,url,isPrivate,isArchived,pushedAt`, repository metadata, recursive Git tree and README APIs. Read 79 owned repositories. Name/description search found [predictions-betting](https://github.com/ernop/predictions-betting), a public C# project, default branch `master`, last pushed 2025-02-12. Its tree contains scoring/payout classes, sample data, graph scripts and images. README describes estimates among friends and comparing scoring/payout methods. No Manifold integration is present in the inspected tree. This is a repository-metadata/tree audit, not a code search across all 79 repositories.

## Repository decision

On 2026-09-05 the user chose a new **public** repository, [ernop/manifold-market-maker](https://github.com/ernop/manifold-market-maker), and requested the initial commit and push. Default branch: `master`. The existing predictions-betting project remains separate because it serves a different purpose.

Publish the application source, tests, portable service installer/template, user-focused README, user-provided screenshot, product/research/technical documentation, provisional market draft, and uncredentialed settings example. Keep `settings.json`, `settings.tmp`, the complete `data/` directory (market downloads, action journals and one-time setup helpers), and Python bytecode out of Git. The screenshot was supplied by the user and inspected before inclusion.

The README explains the product using the user's stated priorities. Technical guidance lives in linked docs. Repository publication does not publish a Manifold market or perform any account action.

Use the existing GitHub CLI login as ernop; do not store tokens in this project. Normal pushes use the tracked origin and branch. Do not force-push or skip hooks. Further commits/pushes require user instruction. Local service installation and operation are documented in [operations](operations.md).
