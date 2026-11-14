# DiFluid R2 Extract: Bluetooth protocol

**Status: unknown. Nothing here is confirmed.** DiFluid does not publish a public Bluetooth protocol for the R2 (checked 2026-11-11: searches found only vendor-app pairing, no service IDs, packet layouts or SDK). No real driver is written until this page is filled in from DiFluid's own documentation. Never fill a TBD from memory, a forum guess or a similar device.

## Source of this information

| Item                                  | Value |
| ------------------------------------- | ----- |
| Document or SDK received from DiFluid | TBD   |
| Document version and date             | TBD   |
| Who at DiFluid supplied it            | TBD   |
| Permission to use it in a web app     | TBD   |

## What we need from DiFluid

Everything below is TBD until DiFluid answers.

1. **Finding the device:** the name the device advertises over Bluetooth (or a name pattern), and any service ID to filter on.
2. **Services and characteristics:** the IDs, and which can be read, written or send notifications.
3. **Starting a measurement:** is a command needed (the exact bytes), or does the device send a reading when the user places a sample and presses its own button?
4. **Reading format:** the byte layout of a reading packet, including the TDS value (scale, units, byte order, signed or not) and whether temperature, refractive index or a status flag is included.
5. **Errors and status:** codes for "no sample", "measuring", "too hot", "needs calibration", and so on.
6. **Pairing:** whether pairing or bonding is required, and whether the DiFluid app and our web page can be connected at the same time.
7. **Firmware:** which firmware versions the protocol covers.
8. **Sample packets:** a few real example packets with the TDS they should decode to, so the parser can be tested.
9. **Terms:** whether we may publish an integration built on it, and whether to credit DiFluid.

## Browser facts (known, from the project brief)

- Web Bluetooth works in Chrome on a Mac (HTTPS or localhost).
- It does not work in Safari. On iPhone, use the Bluefy browser. A Capacitor app is a later option.

## Test plan once the protocol is known

- The driver must pass the shared contract test in `packages/drivers/src/testing/contract.ts`.
- The parser gets unit tests from DiFluid's sample packets.
- Final proof is a real R2 on a Mac in Chrome, then on an iPhone in Bluefy.
