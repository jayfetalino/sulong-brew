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

## Delete

The edit form has a Delete batch button with a second "Yes, delete" step. Delete is a **soft delete**: the batch is stamped with `deletedAt` and hidden, not erased. Otherwise the next merge-import from your phone would bring it back. See ADR-006.

Remember: every new list must filter out deleted records with `isDeleted`.

## Remember

Keep screens thin: put the rules in `packages/core` where they can be tested without a browser.
