# Manifold local

Find Manifold markets, compare them at a glance, and read exactly what you would be betting on.

![Manifold local showing Navier–Stokes markets, aligned probabilities and bettor counts, volume indicators, time remaining, and the selected market's resolution criteria.](docs/images/manifold-local.png)

## Find the markets you care about

Search a local copy of more than 190,000 public market questions. Results appear as you type; the Navier–Stokes search shown above took about 63 milliseconds.

Switch directly between **open and closed** markets or **binary and other** question types. Use **My markets** to find your own questions, or enter a username in **Creator** to browse someone else's. Choose **All** to include their closed markets as well.

## Compare without reading every number twice

- **Bettors first.** See how many distinct people have bet on each market, with the markets attracting the most bettors first by default. You can sort by volume instead.
- **Volume with visible scale.** Compact values such as `23k` save space. The small bars distinguish hundreds from thousands and millions, using the same scale across searches. Hover for the exact amount.
- **Time remaining beside the date.** See `in 4h`, `in 12d`, or `in 1.3y` without calculating from a calendar. Near deadlines receive warmer highlighting.
- **Aligned columns.** Bettor counts, volume, probabilities, and dates line up from row to row.
- **A stated side.** `90.3%Y` means a 90.3% chance of YES, with a green Y. Resolved YES and NO have gentle green and red labels.

## Read the criteria before deciding

Select a question to fetch its current details, read the resolution criteria, and inspect individual answers. **Find related** starts an editable search for similar questions. **Open on Manifold** takes you to the original market.

This matters when similar titles describe different bets: a claimed solution, a correct proof made public, and a solution officially recognized by a deadline are different events.

The workshop keeps your own market drafts local while you work out the wording. Its criteria check highlights missing items to review; it does not decide whether the rules are sound. With an account connected, you can review a binary mana bet, a market publication, or a resolution of your own market before submitting it.

## Ready when you want it

On this computer, open [mm.localhost](http://mm.localhost), or choose **Manifold** from the Firefox new-tab page or local services list. It starts with the computer and refreshes its market catalog every two minutes. The page shows when it last updated.

Searching needs no account connection. Account actions need a Manifold API key entered through **Account**; your Firefox login remains separate. Those actions are implemented, but have not yet been verified with a connected account.

[Setup and operation](docs/operations.md) · [Technical details](docs/architecture.md)
