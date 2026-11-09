# LAB-4: roast batches

## What was built

- The Roasts tab lists your batches, newest roast first. Each card shows days off roast, weight loss %, green weight and roasted weight.
- A form creates and edits batches: coffee, roast date, roast level, Kaffelogic profile, green and roasted weight, notes.
- Weight loss and days off roast are computed, never typed in. If a weight is missing, weight loss says "Not set" instead of guessing.

## Key ideas

- **Validate in core, not in the screen.** `parseRoastBatchForm` turns typed text into a clean batch or a list of errors. It has its own tests, so the screen stays thin.
- **Empty means unknown.** A blank weight is saved as `null`, which is different from 0.
- **Edit keeps identity.** Editing keeps the same `id` and `createdAt` and only moves `updatedAt`. That is what lets merge-import (LAB-8) pick the newest copy.
- **Live queries.** `useLive` re-runs a database query whenever the data changes, so the list updates the moment you save.
- **16px inputs.** iPhone Safari zooms into any field with text smaller than 16px, so the form fields are 16px.

## Left out on purpose

There is no delete button yet. Merge has no delete markers, so a deleted batch could return after an import. This needs a decision before LAB-8.

## Remember

Keep screens thin: put the rules in `packages/core` where they can be tested without a browser.
