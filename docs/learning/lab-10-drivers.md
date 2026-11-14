# LAB-10: refractometer drivers (interface and a demo device)

## What was built

- `packages/drivers`: a small description of what any refractometer must do (an "interface"), a pretend refractometer for demos and tests, and a helper that explains why Bluetooth is not available in a given browser.
- A shared **contract test**: a checklist every driver must pass. The pretend device passes it today, and the real DiFluid driver must pass the same one later.
- `docs/protocols/difluid-r2.md`: a list of exactly what we still need from DiFluid. Every item is TBD.

## Key ideas

- **An interface is a promise.** The brew form will only talk to "a refractometer". Which one (pretend, DiFluid, another brand) can change without touching the screens.
- **A simulated device is for building, not for data.** It makes up numbers, so it always says it is a demo, and the app must label its readings. Fake numbers in a real brew log would be worse than no numbers.
- **Never guess hardware details.** A wrong Bluetooth guess can silently give wrong TDS values. The honest route is to get DiFluid's own protocol, which is also something to ask for when you contact them.
- **Cancelling must be possible.** Every connect and read accepts a cancel signal, because a Bluetooth device may never answer.
- **Plain-English errors.** Safari cannot use Bluetooth from a web page, so the app says to use Chrome on a Mac or the Bluefy app on iPhone.

## Remember

Build against the promise (the interface), test every driver with the same checklist (the contract), and keep unknowns written down as TBD until a trusted source fills them in.
