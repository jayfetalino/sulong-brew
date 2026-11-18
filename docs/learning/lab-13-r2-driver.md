# LAB-13: the R2 refractometer driver (written, not yet tested on a real R2)

## What was built

- The **R2 driver**: sends the documented "single test" message, follows the messages the R2 sends back, and hands the TDS to the brew form.
- The Bluetooth transport can now **filter by device name**, because the R2 and the Ti advertise the same service.
- In "Read TDS from a refractometer" the R2 appears as **"DiFluid R2 Extract (experimental)"** with a warning, and it is switched off with an explanation in browsers without Web Bluetooth.
- The collector that follows a test now says **why** it failed, so the screen can tell "no sample on the prism" from "the number cannot be real".

## Key ideas

- **Same radio, different meaning.** Two devices can share a service. The name prefix is the extra filter that picks the right one.
- **A request with no cancel button.** DiFluid documents no way to stop a test on the device, so after a cancel the app waits a few seconds before starting another. Otherwise the old test's late answer could be mistaken for the new one.
- **Know which numbers are guesses.** The 60 second timeout and the 5 second wait are guesses. They are named options, easy to tighten once a real R2 shows how long a test takes.
- **A test can fail in the test.** My first click-through "passed" an error check too early, because the always-visible warning already contained the words it was waiting for. Wait for text that only appears when the thing happens.

## Remember

On device day, check first that Chrome's chooser finds the R2 with the "DiFluid R2" name filter, then that one tap on Read TDS gives the same number as the R2's screen. The checklist is in `docs/protocols/difluid-r2.md` (items 1 to 13).
