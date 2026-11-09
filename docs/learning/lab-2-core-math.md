# LAB-2: core types and math

## What was built

- `packages/core/src/types.ts`: the data model as TypeScript types (Coffee, RoastBatch, Recipe, RecipeVersion, Brew). Unknown values are `null`, never guessed.
- `math.ts`: `weightLossPercent`, `daysOffRoast`, `extractionYield`, plus `roundTo`.
- `merge.ts`: `mergeRecords` combines two lists by `id`. The newest `updatedAt` wins; a tie keeps the local copy.
- 24 tests, including the brief's example: 310 g, 1.41 %, 20 g gives 21.9 %.

## Key ideas

- **Pure functions** take inputs and return a result. They touch no database and no screen, so they are easy to test and reuse in both apps.
- **Dates are calendar days.** `daysOffRoast` reads `YYYY-MM-DD` as UTC days so daylight saving and time zones cannot make a day count off by one.
- **Float rounding.** `1.41 x 310 / 20` is 21.855 in decimals but computers store it slightly off. `roundTo` nudges it so it rounds to 21.9, and a test locks that in.
- **Merge compares real times**, not text, so `+05:00` timestamps compare correctly.

## Known gap

There are no delete markers yet. If you delete a record on your Mac but your phone still has it, a merge will bring it back. Worth a decision before LAB-8.

## Remember

Turn every example in the brief into a test. The 21.9 % example is now a test, so if anyone changes the formula or the rounding, the test fails.
