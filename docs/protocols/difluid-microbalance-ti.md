# DiFluid Microbalance Ti: Bluetooth protocol

**Status: unknown. Nothing here is confirmed.** No public Bluetooth protocol for the Microbalance Ti has been checked or received. No real driver is written until this page is filled in from DiFluid's own documentation. Never fill a TBD from memory, a forum guess or a similar scale (for example another brand's scale).

Date this page was created: 2026-11-16.

## Source of this information

| Item                                  | Value |
| ------------------------------------- | ----- |
| Document or SDK received from DiFluid | TBD   |
| Document version and date             | TBD   |
| Who at DiFluid supplied it            | TBD   |
| Permission to use it in a web app     | TBD   |

## What we need from DiFluid

Everything below is TBD until DiFluid answers.

1. **Finding the device:** the name it advertises over Bluetooth (or a name pattern), and any service ID to filter on.
2. **Services and characteristics:** the IDs, and which can be read, written, or send notifications.
3. **Weight stream:** does the scale send weight continuously, how often, and how is it switched on?
4. **Weight packet format:** the byte layout, including the weight value (units, scale factor, resolution, byte order, signed or not), and whether there is a "stable" flag.
5. **Commands:** the exact bytes to tare (zero) the scale, and any others we would use, such as a timer start and stop, if the scale has one.
6. **Other values:** whether the scale reports flow rate, battery level or a timer, and in what format.
7. **Errors and status:** codes for overload, low battery, and so on.
8. **Pairing:** whether pairing or bonding is required, and whether the DiFluid app and our web page can be connected at the same time.
9. **Firmware:** which firmware versions the protocol covers.
10. **Sample packets:** a few real packets with the weight they should decode to, so the parser can be tested.
11. **Terms:** whether we may publish an integration built on it, and whether to credit DiFluid.

## Browser facts (known, from the project brief)

- Web Bluetooth works in Chrome on a Mac (HTTPS or localhost).
- It does not work in Safari. On iPhone, use the Bluefy browser (check that it is free before installing). A Capacitor app is a later option.

## Test plan once the protocol is known

- The driver must pass a shared scale contract test (written in LAB-14), as the R2 driver does for refractometers.
- The parser gets unit tests from DiFluid's sample packets.
- Final proof is a real Microbalance Ti on a Mac in Chrome, then on an iPhone in Bluefy.
