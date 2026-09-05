# Navier–Stokes: existing markets and the date of a solution

Researched 2026-09-05 using the public Manifold API. Initial searches for `navier` and `stokes`, complete question-catalog title search, and detailed criteria/comments for the main timing market. Percentages below are observations at fetch time, not advice or fixed values.

## User's event

The user selected **end of 2026**, then clarified: if a solution is announced/published September 10, 2026 and validated February 2027, the solved date is September 10. Validation controls payout, not the event's year. User prefers an existing multimarket to creating a duplicate.

## Existing markets

| Market | Observed state | Fit / ambiguity |
|---|---|---|
| [When will the Navier–Stokes problem be solved? — strutheo](https://manifold.markets/strutheo/when-will-the-navierstokes-problem) | Independent date answers, including **Before 2027**, about **20.1%** | Closest existing market. It requires agreement by Clay or an equivalent organization, but does not explicitly say whether the date is proof publication or recognition. |
| [Considered solved on June 3, 2027 — Bayesian](https://manifold.markets/Bayesian/will-navierstokes-be-considered-sol) | About 38.6% | Creator update asks whether mathematicians widely regard it as probably valid by that deadline; this measures acceptance by the date. |
| [Anthropic claimed solution before end of 2026 — JimMcMillan](https://manifold.markets/JimMcMillan/will-anthropic-announce-a-claimed-s) | About 12.0% | Explicitly announcement-only: later invalidation still counts YES. Restricted to Anthropic/Claude. Does not measure the user's event. |
| [Solved before 2028 — waitblock](https://manifold.markets/waitblock/will-the-navierstokes-problem-be-so) | About 55.8% | Requires consensus of reputable sources, but does not define backdating or the source set. |

For strutheo's market: ID `nZ209OLZg5`, Before 2027 answer ID `pnpA8UlyPz`. The API says `shouldAnswersSumToOne=false`: these are cumulative independent binary answers. Before 2027 overlaps with Before 2029; do not read them as mutually exclusive buckets.

The seven returned comments include a proposed proof link and trading discussion, but no clarification of the date/validation issue. No comment was posted. Do not infer backdating from the title alone. We cannot conclude the existing market meets the user's requirement until the creator confirms it.

## Clarification to ask the existing creator

> For “Before 2027,” would a complete correct proof first published September 10, 2026 count YES if Clay (or the relevant equivalent body) only validates it in February 2027? In other words, is the cutoff the proof's first public date, with later validation permitted, or the date of recognition? And would a substantive repair first published in 2027 disqualify the 2026 version?

This is a **local proposed comment**, not sent and not authorized for sending.

## What makes a separate market judgeable

Use [Clay's official statement](https://www.claymath.org/wp-content/uploads/2022/06/navierstokes.pdf) to define the mathematical target: any one of its four alternatives, in the stated three-dimensional setting. Exclude partial/modified-equation results and unsupported claims. Count all solvers; the question is not specifically about AI.

Separate four dates: proof publication, betting close, validation, and market resolution. Record the public manuscript version. Mere announcements without the full argument create unverifiable backdating. A substantive post-deadline repair should move the qualifying date; cosmetic edits should not.

[Clay's prize rules](https://www.claymath.org/millennium-problems/rules/) require a qualifying publication, at least two years after publication, and general acceptance before considering a proposed solution for the prize. Therefore waiting for the prize award would be a substantially slower event than proof publication. Clay's [problem page](https://www.claymath.org/millennium/navier-stokes-equation/) still labels it unsolved at the research date.

There is a necessary product tradeoff: an unlimited wait preserves the user's event definition but can keep NO holders waiting indefinitely. A fixed validation cutoff permits timely resolution but changes the question to “published in 2026 AND validated by date X.” Do not introduce that cutoff silently. A named expert panel is faster than Clay but needs explicit eligibility, count, disagreements and retraction rules.

## Draft status

[Local draft](../drafts/navier-stokes-2026.md) is provisional, not approved for publication. It uses UTC, proof publication rather than a press release, Clay recognition as the validation source, and no automatic NO date. Those are explicit proposals, not settled preferences. The initial probability is intentionally unset in the UI. Priority is to clarify/reuse the existing Before 2027 answer. No market was created, no money/mana was spent, and no account key was obtained.
