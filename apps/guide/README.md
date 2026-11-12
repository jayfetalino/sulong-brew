# Sulong guide

The public brew guide: one static page per coffee, opened from a QR code on the bag.

- No framework, no Bluetooth, no account, no backend.
- Built from frozen snapshots, one per recipe version, in `src/snapshots/`. Nothing else is public.
- This folder is **self-contained**. It imports nothing from the rest of the monorepo, so it can move to its own public repo as-is.

## Run it

```
npm run dev -w sulong-guide      # http://localhost:5174, also on your Wi-Fi address
npm run build -w sulong-guide    # static files in apps/guide/dist
```

`dist` uses relative paths, so it works on any static host or sub-folder.

## Adding or removing a recipe

Every file in `src/snapshots/` is one recipe. The number at the start of the file name sets the order on the page, and the rest becomes the link (`04-the-still-pour.json` is `/#the-still-pour`). Add a file to publish a recipe, delete it to unpublish. In the lab repo, also add the file to the list in `packages/core/src/guideSnapshot.test.ts`, so it is checked against the seed.

## What is in the snapshot

Recipe name and version, dose, water, water temperature, grind in words, finish window, the steps, and (when known) the coffee name, roast level and roast date. It never contains grinder clicks, ids, brews, ratings or roast weights. The lab builds snapshots with `createGuideSnapshot` in `packages/core`, which copies an explicit list of fields.

Some fields are intentionally empty for now: `coffee` (which coffee and roast date go on the bag is not decided), `espresso` (no espresso recipe is defined yet), the water temperature of the Still Pour and the Switch recipe, and some grind descriptions. The page leaves out whatever is empty.

## Moving this folder to its own repo

1. Copy `apps/guide` to the new repo.
2. Add `vitest` as a dev dependency if you want to keep the tests (`src/*.test.ts`).
3. The brand colors in `src/styles.css` and the logo in `src/assets` are already local copies.
4. The test in `packages/core/src/guideSnapshot.test.ts` that compares `snapshot.json` to the lab seed stays behind in the lab repo.
