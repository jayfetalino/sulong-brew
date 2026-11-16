# ADR-013: Scale drivers behind an interface, with a labelled simulated scale

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The lab will get a live pour guide: step cards that follow a scale and show the live weight against each step's target. Jay has chosen the DiFluid Microbalance Ti, but does not own one yet, and no Bluetooth protocol for it has been checked or received (see `docs/protocols/difluid-microbalance-ti.md`, all TBD). The project rule is to never guess Bluetooth details. The same situation was solved for the refractometer in ADR-012.

## Decision

Follow the same pattern as ADR-012 in `packages/drivers`:

- A small `Scale` interface: `connect`, `disconnect`, `tare`, a stream of weight readings (`onWeight`), a status with change events, `lastReading`, an `isDemo` flag, and typed `ScaleError` codes. It carries only what is certain: a weight in grams and the time it was read. Other values (a "stable" flag, flow rate, a timer, battery) are added only when a real protocol document says they exist.
- A `SimulatedScale` for building, testing and demoing without hardware. It always reports `isDemo = true`, and its label says "simulated". `setWeight()` puts a weight on it, and `pourTo()` makes the weight rise smoothly the way a pour does, so the live guide can be developed and shown with no device. Weights are shown after tare, which is what a recipe's cumulative target weights mean.
- A shared **scale contract test** (`@sulong/drivers/testing/scale`) that every scale driver, including the future real one, must pass: connecting, streaming readings, taring, cancelling, disconnecting, and survival of a broken listener.
- No real driver yet. It is built only from DiFluid's documented protocol, after Jay has a device (LAB-16).

## Alternatives

- **One shared "device" interface for scale and refractometer:** less code, but they behave differently. A scale streams continuously and has a tare, while the refractometer is asked for one reading at a time. Keeping them separate keeps each simple.
- **Guess the protocol:** violates the project rule and risks wrong weights silently ending up in brews.
- **Start with the live guide and fake the weights inside it:** couples the screen to made-up data and leaves nothing for the real driver to plug into.

## Consequences

- The live pour guide (LAB-15) can be built and fully tested end to end now, with the simulated scale, and demoed without hardware.
- Anything produced by the simulated scale must be shown as demo data in the lab. Demo weights must never be saved as real measurements.
- Streaming readings arrive as events, so screens must unsubscribe when they leave, or they will keep receiving readings.
- The interface may need small optional additions once the real protocol is known. Adding optional fields later does not break existing code.
- Web Bluetooth works in Chrome on a Mac and in Bluefy on iPhone, not in Safari (`bluetoothSupport()` explains this to the user).
