# LAB-3: Dexie database and seeds

## What was built

- `apps/lab/src/db/db.ts`: the database. Tables: coffees, roastBatches, recipes, recipeVersions, brews, meta.
- `data/seeds/`: your 6 coffees, 5 recipes and 5 recipe versions as JSON.
- `seed.ts`: loads the seeds once, on the first run.
- Each tab now shows a line like "Database: 6 coffees, 5 recipes".
- 14 new tests, including checks that every recipe ends at its water weight and that the Switch water temp stays empty.

## Key ideas

- **IndexedDB** is the browser's built-in database. Dexie makes it pleasant to use.
- **Indexes** are the fields listed in `stores(...)`. They make searches fast, for example finding every brew for one roast batch.
- **A transaction** is all-or-nothing: either every seed saves, or none do.
- **A marker** (`seeded-v1`) remembers that seeding happened, so deleted records stay deleted.
- **Stable ids** (like `coffee-peru-gesha-washed`) mean your Mac and iPhone seed identical records.

## Unknowns left empty on purpose

Switch water temp, Still Pour water temp, and the grind description for Downshift, Step-Down and Still Pour. None were in the brief.

## Remember

Each browser has its own database. Safari, the home-screen app and Bluefy each seed their own copy. That is why LAB-8 (export and merge-import) exists.
