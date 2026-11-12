# LAB-6: brew log

## What was built

- The Brews tab lists your brews, newest first. Each card shows coffee, recipe version, days off roast on brew day, dose and yield, time, TDS, extraction yield and rating.
- The brew form links a brew to a recipe version and a roast batch. Picking a recipe version fills in dose, water temperature and grinder clicks, which you can still change.
- Extraction yield is calculated live as you type the yield and TDS.
- Ratings: an overall 1 to 5 (half steps) plus optional cupping-style scores for sweetness, acidity, body, balance, aftertaste and clarity (ADR-008).
- Tags (with quick-tap chips for tags you used before) and notes. Brews can be edited and deleted (soft delete).

## Key ideas

- **A brew points at a version, not a recipe.** Because versions never change (ADR-007), an old brew always shows the exact recipe you used.
- **Computed, not stored.** Extraction yield and days off roast are worked out from the saved numbers each time. They can never disagree with the data.
- **"Used" values.** The brew records the water temperature and clicks you actually used. That matters for recipes where the plan is unknown, like the Switch water temperature.
- **Days off roast is measured on brew day**, not today, so an old brew always shows how fresh the coffee was when you made it.

## Remember

The point of the app is the link: brew, recipe version, roast batch. Always fill in all three and later you can see how roast changes show up in the cup.
