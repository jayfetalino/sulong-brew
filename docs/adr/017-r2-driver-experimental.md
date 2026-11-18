# ADR-017: The R2 Extract driver, sharing the Ti's service and labelled experimental

- **Status:** Accepted
- **Date:** 2026-11-18

## Context

DiFluid's public documents do not give the R2's Bluetooth service or name. DiFluid support answered by email on 2026-11-18: the R2 uses the same service and UUID as the Microbalance Ti, and its name is "DiFluid R2 xxxxx". The frame format and the R2 messages are documented and already parsed (ADR-015). The R2 has been ordered but has not arrived, so nothing is verified on a device. The service and name come from an email, not from a document.

## Decision

- **Reuse the transport.** `WebBluetoothTransport` gains an optional `namePrefix` (added to the device chooser filter next to the service) and optional words for its messages ("refractometer", "R2 Extract"), so errors do not say "scale". Without them it behaves exactly as for the Ti.
- **The name prefix is what tells the R2 from the Ti.** Both advertise the same service, so a chooser filtered only by service lists both. The R2 filters by the name prefix "DiFluid R2". The Ti chooser is not filtered by name (its name format is not known to us), so its experimental note now says that the list may also show an R2.
- **`DifluidR2Refractometer`** sends the documented single-test command, follows the frames with `R2SingleTestCollector`, and returns the TDS from the result frame. The collector now says why a test failed (R2 error frame, unusable frame, impossible TDS) so the driver gives the right error code.
- **Cancel and timeout.** DiFluid documents no way to stop a test. After a cancel or a timeout the driver refuses a new test for a short settling time, so a late result is not taken as the next test's. Both numbers (60 s timeout, 5 s settling) are guesses and are options, to be tuned on a real R2.
- **Experimental until proven.** Listed as "DiFluid R2 Extract (experimental)". Whenever chosen, a note says it was written from documents and an email, has not been tried with a real R2, and that values should be checked against the R2's own screen. The note is one constant (`R2_EXPERIMENTAL_NOTE`), removed only after testing on a real R2. Readings from it are saved as real (`tdsSource: refractometer`), not demo, as the Ti's are.
- **Same sign rule as before.** Numbers with the top bit set are still refused (DiFluid says negatives are "sent in the same way", which does not name the encoding).

## Alternatives

- **Wait for the R2 before writing the driver:** the real bugs would all appear on device day. Writing it now means the whole path is exercised against fakes, and device day is only about what differs.
- **Mark R2 brews with a fourth TDS source:** more precise, but the on-screen note plus a check against the R2's screen is enough until verification. Revisit if the R2 is used for real brewing before then.
- **Filter the Ti chooser by name too:** would stop the R2 appearing in the Ti list, but we do not know the Ti's name format, and guessing would risk hiding the real scale.

## Consequences

- If the real R2's name is not "DiFluid R2 ..." the chooser will show nothing. Check this first (checklist item 12 in `docs/protocols/difluid-r2.md`).
- If the real R2 needs another command to start measuring, or reports a missing sample differently, the driver will show a timeout or a vague error. Items 8 to 11 of the checklist cover these.
- A water test (TDS 0) is refused as invalid. That is deliberate for coffee brewing.
