# DiFluid R2 Extract: Bluetooth protocol

Taken from DiFluid's official open-source documentation (MIT license). See [difluid-frame-format.md](difluid-frame-format.md) for the source, the frame layout, the check sum rule, the two Bluetooth channels and known document errors. Items DiFluid does not state are marked **Not stated**. Nothing is guessed.

**Status:** documented on paper, with **one important gap: the R2's Bluetooth service ID is not stated**. **Nothing here has been tested on a real device yet**, because the project owner does not have one.

## Source

| Item              | Value                                                                          |
| ----------------- | ------------------------------------------------------------------------------ |
| Document          | `docs/protocolR2.md` in https://github.com/DiFluid/difluid-sdk-demo            |
| Document version  | 1.0.0, last update Mar 18th 2023                                               |
| Commit when read  | `df4e0731dc64`                                                                 |
| Read on           | 2026-11-16                                                                     |
| Minimum firmware  | 2.1.2 in the document, "V212" in the README                                    |
| Permission to use | MIT license, plus DiFluid's confirmation that the documentation is open source |

## What the documents say

### 1. Finding the device (GAP)

- **Service UUID: Not stated for the R2.** The README says to search "according to serviceID" without giving one, and the R2 document does not list one. DiFluid publishes service UUIDs for the Microbalance and Microbalance Ti only.
- **Advertised device name: Not stated.**
- How to close the gap, in order: ask DiFluid for the R2's service UUID, or read it from the device itself once it is owned. Do not copy a UUID from a third-party project.

### 2. Characteristic

- The README names `0000aa01-0000-1000-8000-00805f9b34fb` as the cleartext channel that carries the frames (see the frame format page). The R2 document does not repeat it.
- Properties (read, write, notify): **Not stated.** Check at runtime.

### 3. Taking a measurement

- **Single test:** Func `3`, Cmd `0`, no data. Documented frame: `DF DF 03 00 00 C1`.
- **Average test:** Func `3`, Cmd `1`, one data byte = number of tests. Documented frame for 3 tests: `DF DF 03 01 01 03 C6`. The number of tests (setting, Func `1` Cmd `3`, range 1 to 10) is affected by this.
- **Calibrate:** Func `3`, Cmd `2`, no data. Not something this project should send.
- **Auto test:** a device setting (Func `1`, Cmd `1`, 0 off, 1 on). How results arrive when the device starts a test by itself: **Not stated.**

### 4. The result

A single test makes the device send several frames in turn (all Func `3`, Cmd `0`). Data0 is the package number.

| Package | Meaning                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| 0       | Test status. Data1 is a status code (below). `0B` = test started, `00` = test finished.                                  |
| 1       | Temperatures. Data1-2 prism temperature x 10, Data3-4 sample tank temperature x 10, Data5 unit (0 Celsius, 1 Fahrenheit) |
| 2       | Result. Data1-2 **concentration x 100** ("concentration / TDS"), then the refractive index x 100000                      |

Documented single-test frames from DiFluid:

```
DF DF 03 00 00 C1                         command: single test
DF DF 03 00 03 00 0B 00 CF                status: test started
DF DF 03 00 03 00 00 00 C4                status: test finished
DF DF 03 00 06 01 03 17 03 14 01 FA       temperatures: 791 (79.1) and 788 (78.8), unit 1 (Fahrenheit)
DF DF 03 00 07 02 00 4F 00 02 09 3D 61    result: 0x004F = 79, so concentration 0.79
```

- **TDS:** concentration is "concentration / TDS" in the document. TDS percent = Data1-2 divided by 100. In the example, `0x004F` = 79 gives 0.79.
- **Refractive index width:** the document's table says Data3-4 (two bytes) but the example frame carries four (`00 02 09 3D` = 133437, so 1.33437). Follow the example. Our project does not need the refractive index.
- **Sign: Not stated.** The average-test examples show a concentration field of `FF F9`, which would be a negative number if signed. Until verified on a device, a driver must refuse any concentration whose top bit is set, and must refuse a TDS of zero or less.
- **Average test:** packages 0 to 2 as above, package 3 = average concentration x 100 and average refractive index x 100000, package 4 = average temperatures and the current and total test counts. The documented example also repeats blocks of frames that the document does not explain.
- Device status codes: 0 Test finished, 1 Calibration finished, 4 Average test start, 5 Average test ongoing, 6 Average test finished, 7 Loop test start, 8 Loop test ongoing, 9 Loop test finished, 10 Average test ongoing (no valid result), 11 Test start, 12 Calibration start. (2 and 3 are reserved.)
- Errors: a Func `3`, Cmd `254` frame carries an error code, and Cmd `255` is an "unknown error" (`FF FF FF FF`). The error table is hard to read as written. Data0 = 2 means a general error with Data1 = 1 test error, 2 calibration failed, 3 no liquid, 4 beyond range. Data0 = 3 means a hardware error. Treat any error frame as a failed measurement and show the code.

### 5. Other documented frames

| Action               | Frame                                                 |
| -------------------- | ----------------------------------------------------- |
| Get serial number    | `DF DF 00 00 00 BE`                                   |
| Get device model     | `DF DF 00 01 00 BF` (reply decodes to `DFT-R102`)     |
| Get firmware version | `DF DF 00 02 00 C0` (example reply decodes to `T003`) |
| Get temperature unit | `DF DF 01 00 00 BF`                                   |
| Get auto test status | `DF DF 01 01 00 C0`                                   |

### 6. Not stated by DiFluid

- The R2's service UUID and advertised name (the gap above).
- Pairing or bonding requirements, and whether the DiFluid app and a web page can be connected at the same time.
- The exact read, write and notify properties of the characteristic.
- How a device-started (auto) test is reported.

## Verify on a real device (when the R2 arrives)

1. Find the R2's service UUID and advertised name (ask DiFluid, or read them from the device), and record them here.
2. The cleartext characteristic exists and which operations it offers.
3. Send the single-test frame. The status, temperature and result frames arrive in order, and the TDS matches the device screen.
4. What the device sends after a no-liquid or out-of-range test.
5. What a concentration at or below zero looks like in bytes (for example a water test).
6. Whether a DiFluid app connection blocks ours, and whether pairing is needed.
7. The firmware version, and that it is 2.1.2 or later.

## Browser facts (known, from the project brief)

- Web Bluetooth works in Chrome on a Mac (HTTPS or localhost).
- It does not work in Safari. On iPhone, use the Bluefy browser (check that it is free before installing). A Capacitor app is a later option.

## Test plan

- The frame and result parsers get unit tests built from the documented frames above.
- The driver must pass the shared contract test in `packages/drivers/src/testing/contract.ts`.
- Final proof is a real R2 on a Mac in Chrome, then on an iPhone in Bluefy.
