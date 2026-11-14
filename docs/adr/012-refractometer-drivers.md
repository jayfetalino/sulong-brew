# ADR-012: Refractometer drivers behind an interface, with a labelled demo device

- **Status:** Accepted
- **Date:** 2026-11-11

## Context

Jay wants the lab to read TDS from a DiFluid R2 Extract refractometer instead of typing it. Two facts constrain the work:

- DiFluid publishes no public Bluetooth protocol for the R2 (service and characteristic IDs, packet format, how to start a measurement are all unknown). The project rule is to never guess Bluetooth details.
- Jay does not own an R2 yet, so a real driver could not be tested even if the protocol were known.

Scales and refractometers must also stay swappable (the scale is still undecided), per the project brief.

## Decision

- Add `packages/drivers` with a small `Refractometer` interface: `connect`, `disconnect`, `readTds`, a status with change events, an `isDemo` flag, and typed `RefractometerError` codes (`not-connected`, `unavailable`, `aborted`, `timeout`, `invalid-reading`, `failed`). The interface carries only what is certain: a TDS percentage and a time. Fields such as temperature are added only once a real protocol document says they exist.
- Provide a `SimulatedRefractometer` for building, testing and demoing without hardware. It makes up numbers, so it always reports `isDemo = true`, its label says "simulated", and the lab must show anything it produces as a demo reading (LAB-11).
- Provide `bluetoothSupport()` to explain, in plain English, when Web Bluetooth is not available (Safari, an insecure address).
- Provide a reusable **contract test** (`@sulong/drivers/testing`). Every driver, including the future real one, must pass the same checks for connecting, reading, cancelling and disconnecting.
- Do **not** write a real DiFluid driver now. It is built only from DiFluid's documented protocol, after Jay has a device to test with (LAB-13). What is missing is listed in `docs/protocols/difluid-r2.md`.

## Alternatives

- **Guess the protocol or copy values from forum posts:** violates the project rule, and a wrong guess could silently produce wrong TDS numbers.
- **Capture the device's own traffic after purchase:** possible later, but it is reverse engineering. Jay decides, and asking DiFluid for the protocol comes first.
- **Skip drivers and keep typing TDS:** works today, but gives nothing to show DiFluid and blocks the scale integration later, which needs the same pattern.

## Consequences

- The brew form can be built and tested end to end now (LAB-11) with the demo device, and switching to the real R2 later changes only which driver is created.
- Demo readings must never be confused with real ones. That is enforced in the lab by labelling and by a `tdsSource` field on each brew, not by trusting memory.
- The interface may need small additions (for example a temperature reading) when the real protocol is known. Adding optional fields later does not break existing code.
- Web Bluetooth works in Chrome on a Mac (HTTPS or localhost) and in the Bluefy app on iPhone, not in Safari.
