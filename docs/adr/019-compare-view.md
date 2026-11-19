# ADR-019: Comparing brews side by side

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

The point of the lab is to see how a roast change shows up in the cup. Every brew already links to its roast batch, recipe version and coffee, but each brew can only be read on its own card, so differences had to be spotted by flipping between screens. The brief lists a compare view as a later feature. Jay chose it as the next ticket.

## Decision

- **Compare mode on the Brews list.** A Compare button (shown when there are two or more brews) turns each card into a tick box. A bar above the tab bar shows "Compare (n of 3)" and Cancel. Up to **three** brews, because three columns still fit a phone (390 px) without sideways scrolling. A fourth tick is refused with a message, and a ticked brew can always be unticked. No new tab or route: the state lives in the page, like the edit form.
- **Layout.** One column per brew (coffee name, brew date, an Open link), then rows under four headings: Brew (recipe, roast date, days off roast, roast profile, roast level, roast weight loss), How it was made (dose, yield, brew ratio, time, water temperature, grind), In the cup (TDS, extraction yield, overall rating, cupping scores, tags) and Notes. Each row is a label line above equal columns.
- **What differs is marked, never judged.** A row whose values are not all the same gets an accent bar and the word "differs". The view never says which brew is better, because Jay has not set targets or tolerances. Differences compare the real values, not the rounded text (two roasts that both show 15.0 % weight loss but are not equal still count as different). Tags are compared as a set, notes ignoring surrounding spaces. A "Show only differences" switch hides matching rows.
- **Nothing is invented.** Missing values read "Not set" (or "Not rated"). The brew ratio is the actual dose to yield, and is "Not set" when either is missing. A cupping score row appears only when at least one of the compared brews has that score.
- **Demo readings stay marked.** The three "(demo)" rules from the brew list are repeated here: a demo yield (and so the ratio), a demo TDS, and extraction yield when either number was a demo reading.
- **Logic is plain functions** in `apps/lab/src/compareFlow.ts` (`buildComparison`, `onlyDifferences`, `toggleSelection`) with unit tests, as with the other flow modules. The screens only draw what these return.
- **No data model change, no new dependency.**

## Alternatives

- **A fourth Compare tab:** more room, but an extra place to learn, and the choice of brews still has to happen on the Brews list.
- **A table with sideways scrolling:** works on a Mac, but is awkward on an iPhone, where Jay will use it.
- **Highlight the "best" value in each row:** tempting, but it needs targets Jay has not defined, and "higher is better" is wrong for many rows (days off roast, grind, time).
- **Exactly two brews:** roomier, but less useful for comparing three roast batches of one recipe.

## Consequences

- With three columns, long values wrap inside their column (tags and notes especially). That is the cost of staying on one screen width.
- The comparison reads the same records as the list, so editing a brew (Open) and coming back shows the new values.
- If more brews are wanted later (for example four on a Mac), `MAX_COMPARE` and the column CSS are the two places to change.
