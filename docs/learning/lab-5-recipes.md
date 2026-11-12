# LAB-5: recipes, step editor and immutable versions

## What was built

- The Recipes tab lists your recipes with their current version, ratio and temperature.
- Tap a recipe to see its steps, plus chips (v1, v2 ...) to look at older versions.
- "Edit as new version" opens an editor with dose, water, temperature, grind (clicks for you, words for the public guide), finish window, notes, and a step editor. You can add, remove and reorder steps.
- Delete recipe (with a confirm step) hides the recipe but keeps its versions.

## Key ideas

- **Immutable means never edited.** Saving a recipe adds a new version. Version 1 stays exactly as it was, so a brew that used it still tells the truth. See ADR-007.
- **Cumulative target weight.** A step's target is the total on the scale (220 g), not the amount to add. The editor rejects targets that go down or pass the total water.
- **Unknown stays empty.** Blank temperature, clicks or finish times are saved as `null`, never a guess.
- **No empty versions.** Saving without changes creates nothing. Renaming changes only the recipe.
- **Time as m:ss.** `parseDuration` reads "1:27" (or plain seconds), and `formatDuration` shows it back.

## Remember

If you want to change a recipe, save a new version instead of fixing the old one. The history is the point.
