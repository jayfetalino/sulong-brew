# LAB-7: the public guide

## What was built

- `apps/guide`: a cream-themed page for The Sulong Pour with Filter and Espresso tabs, C/F and g/oz toggles, step cards and a timer.
- The timer highlights the current step, dims finished ones, and counts down to the next step ("Next in 0:22: Pour to 220 g"). It keeps the phone screen awake while running, where the phone allows it.
- The page is built from a frozen snapshot (`snapshot.json`) of one recipe version. `createGuideSnapshot` in `packages/core` makes it from an explicit list of public fields.

## Other brew methods

The Filter tab has a recipe picker with all five recipes: The Sulong Pour, The Downshift, The Step-Down, The Still Pour and Sulong Switch Standard. Each one is its own snapshot file, so adding or removing a recipe means adding or deleting a file. A link like `/#the-still-pour` opens that recipe, which is how a QR code can point at one recipe. Switching recipes resets the timer, because the steps are different.

## Key ideas

- **A snapshot is a photocopy.** Editing the recipe in the lab later does not change a published guide. A test proves it.
- **Allow-list, not block-list.** The snapshot copies named fields only. If someone adds a private field to a recipe next year, it cannot leak, because nothing copies it.
- **Independent on purpose.** The guide imports nothing from the lab, so it can move to its own public repo (ADR-009).
- **The timer uses the clock, not a counter.** It stores when you pressed Start and works out elapsed time from `Date.now()`, so it stays right even if the browser delays a tick.
- **No framework.** A tiny helper builds elements, and text is always set as text, never as HTML, so snapshot content cannot inject markup.

## Empty on purpose

The Espresso tab says "coming soon" (no espresso recipe exists yet). The coffee name, roast level and roast date are left off until you decide which coffee goes on the bag.

## Remember

Whatever is public is public forever once printed on a QR code. That is why the guide only ever reads one reviewed snapshot file.
