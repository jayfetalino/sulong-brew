# ADR-014: Live brew flow and demo-data policy for the scale

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The lab should guide a brew step by step, following a scale, and hand the result to the brew log. Jay's DiFluid Microbalance Ti has been ordered but has not arrived, and its real Bluetooth driver is not built or verified (ADR-013, `docs/protocols/difluid-microbalance-ti.md`). Jay wants to use and judge the whole flow before the device arrives. Demo numbers must never be mistaken for real measurements (ADR-012).

## Decision

- **Where it starts:** a "Brew with live guide" button on the recipe page, for the version being viewed. It starts that exact recipe version, so the brew stays linked to it (ADR-007). No fourth tab.
- **How it runs:** connect a scale, press "Tare and start" (zero the scale, start the timer), then follow the step cards. Each step shows its target weight and how far the scale is from it ("38.4 g to go" or "Over by 5.0 g"). The screen states only the number. It never says good or bad, because tolerances around a target are not defined by anyone.
- **How it ends:** "Done" opens the brew form on the Brews tab, prefilled with the recipe version, dose, the final weight as the yield, the brew time and the recipe's water temperature. The roast batch is still chosen by Jay, and TDS is still read or typed. **Nothing is saved until Jay saves the form.** Cancelling a running brew asks first and keeps nothing.
- **Demo data is labelled everywhere.** A new `yieldSource` field (`manual`, `scale` or `demo`) is saved with each brew, as `tdsSource` already is. A demo scale shows a DEMO banner all through the live brew, the form shows a "Demo reading" badge, the Brews list marks "(demo)", and the extraction yield says it comes from demo readings. Typing over a number turns it back into a typed value. The backup format carries the field and still accepts older brews that have none.
- **Playing without a scale:** a demo scale can pour by itself following the recipe, can run at 1x, 2x or 4x speed (one shared clock drives both the timer and the demo scale, so they stay in step), and has buttons to add 10 g, add 50 g or empty. The demo pour timings are made up and only for demos.
- **Hand-off:** the measurements travel from the live screen to the brew form through a small in-memory store that can be read once, so a draft cannot reappear later.
- **The real scale:** the DiFluid Microbalance Ti is listed in the scale list as "not available yet" until its driver exists and has been tested with a real scale.

## Alternatives

- **Save the brew automatically when Done is pressed:** faster, but easy to save a half-finished or demo brew by accident.
- **A new Brew tab:** easy to find, but changes the three-tab layout from the brief.
- **Fake the weights inside the screen:** couples the screen to made-up data and leaves no place for the real driver to plug in.
- **Judge each pour (green, amber, red):** would need tolerances that Jay has not defined, so it would invent rules.

## Consequences

- The whole flow can be played and tested now, and the real scale changes only which device is created.
- A real scale's reading is saved as `yieldSource: scale`. Until a real driver is verified, no brew can get that label by accident.
- The live screen keeps the phone awake while running, where the browser allows it.
- Streaming readings are events, so the screen unsubscribes and disconnects when it is closed.
- The recorded final weight is the last reading when Done is pressed, so Done should be pressed after the drawdown. A zero or negative weight is not saved as a yield.
