# DiFluid Microbalance Ti: Bluetooth protocol

Taken from DiFluid's official open-source documentation (MIT license). See [difluid-frame-format.md](difluid-frame-format.md) for the source, the frame layout, the check sum rule, the two Bluetooth channels and known document errors. Items DiFluid does not state are marked **Not stated**. Nothing is guessed.

**Status:** documented on paper. **Nothing here has been tested on a real device yet**, because the project owner does not have one. Every item marked "verify on device" must be confirmed before the driver is trusted.

## Source

| Item              | Value                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------- |
| Document          | `docs/protocolMicrobalance.md` in https://github.com/DiFluid/difluid-sdk-demo           |
| Document version  | 1.0.0, last update December 24th, 2024                                                  |
| Commit when read  | `df4e0731dc64`                                                                          |
| Read on           | 2026-11-16                                                                              |
| Minimum firmware  | Microbalance Ti: V010 (the plain Microbalance needs V300 and uses other IDs, see below) |
| Permission to use | MIT license, plus DiFluid's confirmation that the documentation is open source          |

## What the documents say

### 1. Finding the device

- Broadcast UUID and Service UUID for the **Microbalance Ti**: `000000DD-0000-1000-8000-00805F9B34FB`.
- Advertised device name: **Not stated.** Filter by the service UUID.
- The plain Microbalance (not the Ti) uses `000000EE-0000-1000-8000-00805F9B34FB`. It is not supported by this project, and its document tells you to use characteristic FF01, which conflicts with the README (FF01 is the encrypted channel). Not our device, so not resolved.

### 2. Characteristic

- For the Ti: "Please use the characteristic value **AA01** channel for communication." The full ID, from the README's cleartext channel, is `0000aa01-0000-1000-8000-00805f9b34fb`.
- Properties (read, write without response, write, notify): **Not stated.** Check at runtime.

### 3. Starting the weight stream

- Command "Set Sensor Data Auto Send Flag": Func `1`, Cmd `0`, data length `1`, data `01` to turn on. Documented frame: `DF DF 01 00 01 01 C1`. The device repeats the same frame as its reply.
- In the document's "Get" example the flag reads `00` (off), so a driver must turn it on after connecting.
- "Get Sensor Data" (Func `3`, Cmd `0`, frame `DF DF 03 00 00 C1`) asks for one reading instead.
- How often weights are sent: **Not stated.** Verify on device.

### 4. The weight frame

Func `3`, Cmd `0`. The documented example has data length `0x0D` (13 bytes):

`DF DF 03 00 0D 00 00 02 F8 00 00 00 00 00 0A 27 B0 00 A9`

| Data        | Meaning (as documented)                                           |
| ----------- | ----------------------------------------------------------------- |
| Data0 to 3  | Weight. Gram: value / 10. Ounce: value / 1000. Gering: value / 10 |
| Data4 to 5  | Flow rate, value / 10 (unit not stated)                           |
| Data6 to 7  | Time                                                              |
| Data8 to 11 | Device tick ("system tick")                                       |
| Data12      | Weight unit: 0 gram, 1 ounce, 2 gering                            |

Worked example from DiFluid: Data0-3 `00 00 02 F8` = 760, weight 76 g. Data8-11 `00 0A 27 B0` = 665520.

- **Sign of the weight: not stated in the public document.** A weight below zero (for example after lifting a vessel off a tared scale) may or may not be sent as a two's-complement number.
- **From DiFluid support (email, 2026-11-18, not published):** "Negative weight values are transmitted in the same way as normal weight values." This says there is no special marker or separate field, but it does not name the encoding. The usual meaning is a signed 32-bit number (two's complement), which would make `FF FF FF F6` the weight -10, so -1.0 g. That reading is **an inference, not yet confirmed**. Until it is confirmed on a real scale, the driver (LAB-16) still refuses any weight whose top bit is set and shows a problem message. Adopting the signed reading is a pending change, to be made together with a check on the device (see the checklist).
- **A "stable" flag: Not stated.** There is none in the documented fields.
- **Unit:** the driver should read Data12 and should be able to set grams (see commands).

### 5. Commands

| Action                    | Documented frame             | Where it comes from                                                                                                                                                         |
| ------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tare                      | `DF DF 03 02 01 01 C5`       | "How to Tare: use Power Button Single Click (Func 3, Cmd 2)". Data `01` is the power button.                                                                                |
| Set weight unit to ounce  | `DF DF 01 04 01 01 C5`       | Documented example                                                                                                                                                          |
| Set weight unit to gram   | `DF DF 01 04 01 00 C4`       | The same frame DiFluid shows as the reply that reads "0x00 = gram"                                                                                                          |
| Timer: stop (pause)       | `DF DF 03 01 01 00 C3`       | "DLink Button Press" documented example                                                                                                                                     |
| Timer: start / leave stop | Data `00` with Func 3, Cmd 2 | "DLink Button Single Click". No example frame is given. Built from the check sum rule only: `DF DF 03 02 01 00 C4` (**Checked against the rule, not a documented example**) |
| Get battery and status    | `DF DF 03 05 00 C6`          | Documented example                                                                                                                                                          |

The reply to a control command repeats the command frame.

### 6. Battery and status

Reply to Get Device Status, example `DF DF 03 05 08 05 64 01 00 00 00 00 00 38`:

- Data0: device status (here `05` = Idle).
- Data1: battery, 0 to 100 (here `64` = 100).
- Data2: charge status, 1 = charging, 0 = idle (here `01`).
- Data3 to 7: reserved.

Device status codes: 0 Power down, 1 Charging, 2 Low power mode 1, 3 Low-battery shutdown, 4 Startup, 5 Idle, 6 Show device information, 7 Tare in progress, 8 OTA in progress, 9 OTA failed, 10 Timing in progress, 11 Timer pause, 12 Reserved, 13 Low power mode 2, 14 Auto stop timing trigger.

### 7. Not stated by DiFluid

- Pairing or bonding requirements.
- Whether the DiFluid app and a web page can be connected at the same time.
- Error codes specific to the scale (none are listed).
- The advertised device name.
- The exact read, write and notify properties of AA01.

## Verify on a real device (when the Ti arrives)

1. The scale advertises service `000000DD-...` and Chrome can find it with that filter.
2. Characteristic `AA01` exists and which of notify, write and write-without-response it offers.
3. After enabling auto send, weights arrive, and how often.
4. Weight and unit decode correctly against the screen (put a known weight on it).
5. Tare works with the documented frame, and the weight reads 0 afterwards.
6. What a negative weight looks like (tare, then lift the vessel). Record the bytes.
7. Whether a DiFluid app connection blocks ours, and whether pairing is needed.
8. The firmware version, and that it is V010 or later.
9. Whether the cleartext channel works without the DiFluid server step.

### What the driver assumes (LAB-16, `packages/drivers/src/difluid/tiScale.ts`)

Each of these is read from DiFluid's document but unproven. Check them on the real scale:

10. After the auto-send command (`DF DF 01 00 01 01 C1`) the scale repeats it back, or starts sending weights. The driver waits up to 3 seconds for either, and fails with "did not answer in time" otherwise.
11. After the tare command (`DF DF 03 02 01 01 C5`) the scale repeats it back. The driver waits up to 3 seconds. If the scale tares without repeating it, the driver will report a timeout even though the tare worked.
12. Chrome's device chooser finds the scale by the service filter `000000DD-...` alone (no name filter).
13. A weight frame (19 bytes) arrives whole, or in pieces that the assembler can join. Bluetooth's default packet size is 20 bytes, so it should fit.
14. Switching weight sending off when the driver disconnects leaves the scale and the DiFluid app working normally.
15. What the screen shows when a weight frame arrives with its top bit set (the driver ignores it and shows a problem message), and whether that happens just after a tare.
16. The scale's weight unit setting is read and converted but never changed. Check that grams and ounces both show correct grams in the app.
17. The battery request (`DF DF 03 05 00 C6`) is implemented in the driver but not shown anywhere in the app yet.

When these are confirmed, remove the "experimental" label (`TI_EXPERIMENTAL_NOTE` in `apps/lab/src/scaleFlow.ts`).

## Browser facts (known, from the project brief)

- Web Bluetooth works in Chrome on a Mac (HTTPS or localhost).
- It does not work in Safari. On iPhone, use the Bluefy browser (check that it is free before installing). A Capacitor app is a later option.

## Test plan

- The frame and weight parsers are written and tested against every documented frame (`packages/drivers/src/difluid`, ADR-015). Weights with the top bit set are refused until the real sign is seen on a device.
- The driver must pass the shared scale contract test in `packages/drivers/src/testing/scaleContract.ts`.
- Final proof is a real Microbalance Ti on a Mac in Chrome, then on an iPhone in Bluefy.
