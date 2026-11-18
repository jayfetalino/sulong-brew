# LAB-15: the live pour guide

## What was built

- On a recipe page, **Brew with live guide**. It connects a scale, tares it, starts a timer, and walks through the recipe step by step.
- The screen shows the live weight, the time, the current step with its target, "X g to go" or "Over by X g", a progress bar for the pour, and what comes next.
- **Done** opens the brew form prefilled: recipe version, dose, final weight as the yield, brew time, water temperature. You pick the roast batch, read TDS, rate it, and save.
- A **demo scale** lets you play with all of this today: it can pour by itself following the recipe, run at 1x, 2x or 4x speed, or take "Add 10 g", "Add 50 g" and "Empty" buttons.
- Demo numbers are marked everywhere (banner, badge, "(demo)" in the list), and each brew remembers where its yield came from.

## Key ideas

- **Pure logic, separate from the screen.** Which step is current, how far from the target, the progress through a pour and the starting values for the brew form are all plain functions in `packages/core` with tests. The screen only displays them.
- **One clock for everything.** The timer and the demo scale read the same adjustable clock. Change it to 4x and both speed up together, so the demo pour never drifts from the timer.
- **Say the number, not the verdict.** "38.4 g to go" is a fact. "Good" or "too slow" would need a tolerance you have not chosen, so the app does not say it.
- **Nothing is saved until you save.** The live screen only gathers measurements. The brew form is where you confirm.
- **Labels travel with the data.** The yield source is saved with the brew, exported and imported, so a made-up weight can never turn into a "real" one on another device.
- **A real scale plugs in later.** The screen talks to the `Scale` interface, so the DiFluid Microbalance Ti only changes which device is created.

## Remember

Press Done after the drawdown, so the final reading is the weight in the cup. If you want to play without waiting, use 4x.
