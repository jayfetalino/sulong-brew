# DiFluid R2 Extract: Bluetooth protocol

Taken from DiFluid's official open-source documentation (MIT license). See [difluid-frame-format.md](difluid-frame-format.md) for the source, the frame layout, the check sum rule, the two Bluetooth channels and known document errors. Items DiFluid does not state are marked **Not stated**. Nothing is guessed.

**Status:** documented on paper, and DiFluid's support team has since answered the open questions by email (2026-11-18, see below and [difluid-frame-format.md](difluid-frame-format.md)). The R2's service ID, which was missing from the public documents, is now known **from that email only**. **Nothing here has been tested on a real device yet**, because the R2 has not arrived.

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

### 1. Finding the device

- **In the public documents: Not stated.** The README says to search "according to serviceID" without giving one, and the R2 document does not list one. DiFluid publishes service UUIDs for the Microbalance and Microbalance Ti only.
- **From DiFluid support (email, 2026-11-18, not published):** "The UUID and service are the same as those of the Microbalance Ti. The device name is 'DiFluid R2 xxxxx'." So the R2 uses the service `000000DD-0000-1000-8000-00805F9B34FB` and the same data channel as the Ti (`0000aa01-0000-1000-8000-00805f9b34fb`), and advertises a name that starts with **"DiFluid R2 "** followed by a code.
- **Consequence:** the R2 and the Microbalance Ti advertise the same service, so a device chooser filtered by service alone would list both. The R2 chooser must also filter by the name prefix "DiFluid R2". The Ti's own advertised name is not known, so the Ti chooser cannot filter by name yet, and the screen should tell the person to pick the scale, not the refractometer.
- **Still to verify on the real R2:** the service ID and the name prefix, as reported. Do not copy a UUID from a third-party project.

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

- The R2's service UUID and advertised name, in the public documents (DiFluid support has now supplied both, see section 1).
- Pairing or bonding requirements, and whether the DiFluid app and a web page can be connected at the same time.
- The exact read, write and notify properties of the characteristic.
- How a device-started (auto) test is reported.

## Verify on a real device (when the R2 arrives)

1. The R2 really advertises the service `000000DD-...` and a name starting "DiFluid R2 " (as DiFluid support reported), and Chrome's chooser finds it with both filters.
2. The cleartext characteristic exists and which operations it offers.
3. Send the single-test frame. The status, temperature and result frames arrive in order, and the TDS matches the device screen.
4. What the device sends after a no-liquid or out-of-range test.
5. What a concentration at or below zero looks like in bytes (for example a water test).
6. Whether a DiFluid app connection blocks ours, and whether pairing is needed.
7. The firmware version, and that it is 2.1.2 or later.

Assumptions the LAB-13 driver makes, each to be confirmed or fixed on a real R2:

8. After the single-test command the R2 sends the documented frames (status, temperatures, result) by itself, and the driver does not need to send anything else. The driver treats the first result frame as the answer.
9. The sample must already be on the prism. If not, the R2 is assumed to send an error frame (Func 3, Cmd 254 or 255). The driver shows "The R2 reported an error (bytes). Check that there is sample on the prism". What the real bytes mean is not in DiFluid's table.
10. How long a test takes. The driver waits 60 seconds (a guess, not a measurement), then reports a timeout. Measure it and tighten it.
11. DiFluid documents no way to cancel a test on the device. After a cancel or a timeout the driver refuses a new test for 5 seconds (also a guess) so late frames of the old test are not read as the new result. Measure how late frames really arrive.
12. The driver sends only the single-test command. It never sends the Ti's commands (auto-send, tare). The R2 and the Ti share a service, so the device chooser filters by the name prefix "DiFluid R2". If the real name differs (for example no space, or another case), the chooser will list nothing. That is the first thing to check.
13. A concentration at or below 0 or above 30 percent is refused as not a coffee TDS. A water test may legitimately read 0, and is refused on purpose.

## Browser facts (known, from the project brief)

- Web Bluetooth works in Chrome on a Mac (HTTPS or localhost).
- It does not work in Safari. On iPhone, use the Bluefy browser (check that it is free before installing). A Capacitor app is a later option.

## Test plan

- The frame and result parsers are written and tested against every documented frame (`packages/drivers/src/difluid`, ADR-015). Numbers with the top bit set are refused until the real sign is seen on a device. The R2 service, channel and name prefix are constants in `r2.ts` (`R2_SERVICE_UUID`, `R2_CHARACTERISTIC_UUID`, `R2_NAME_PREFIX`), taken from DiFluid support's email, not from a public document, and unverified on a device.
- `DifluidR2Refractometer` (LAB-13, ADR-017) is written from the documents and the email and tested only against fakes (a fake in the unit tests, and an independent fake `navigator.bluetooth` in real Chrome). It is listed in the lab as "DiFluid R2 Extract (experimental)".
- The driver must pass the shared contract test in `packages/drivers/src/testing/contract.ts`.
- Final proof is a real R2 on a Mac in Chrome, then on an iPhone in Bluefy.
