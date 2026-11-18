# ADR-016: The Microbalance Ti driver, built on a transport, and labelled experimental

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

The Microbalance Ti has been ordered but has not arrived. DiFluid documents its protocol (ADR-015) and the codec is tested against every documented frame, but nothing has been tried over real Bluetooth. A driver is still worth writing now: it is where the remaining bugs will be, and the whole path (browser Bluetooth, driver, screen) can be exercised against fakes. The risk is a driver that looks finished and quietly shows wrong weights.

## Decision

- **A transport layer.** `BluetoothTransport` is a tiny interface (connect, disconnect, write, receive bytes, hear about the link closing). `WebBluetoothTransport` implements it for Chrome and Bluefy. The Ti driver talks only to the interface, so the same driver is tested with a fake device and runs on the real browser API. The browser's Bluetooth types are written out in the file, so no extra package is needed.
- **Check, never assume, what the device allows.** DiFluid does not state the properties of the AA01 channel. After connecting, the transport checks that it can send notifications and can be written to, and fails with a plain message otherwise. It writes without waiting for a response only when the channel says that is allowed.
- **Browser errors become plain English.** A closed device chooser reads as "Cancelled", not an error. Missing service, blocked Bluetooth, missing permission and a failed connection each get a message a person can act on.
- **`DifluidTiScale`** switches weight sending on and waits for the scale to answer (a repeat of the command, or a weight). Tare is sent and confirmed the same way. Every weight frame becomes a reading in grams. It never changes the scale's unit or other settings. On a clean disconnect it switches weight sending off again, as DiFluid's own example shows it. A lost connection is reported.
- **Problems that do not stop the stream** (a weight DiFluid's document does not explain, or the unsupported "gering" unit) are reported through an optional `onProblem` on the `Scale` interface and shown on the live brew screen. The same message is not repeated at every reading, and it clears when readings are good again.
- **Experimental until proven.** The Ti appears in the scale list as "DiFluid Microbalance Ti (experimental)", and whenever it is chosen the screen says it was written from DiFluid's documents, has not been tried with a real scale, and that weights should be checked against the scale's own screen. The label is one constant (`TI_EXPERIMENTAL_NOTE`) removed only after testing on a real Ti.
- **Switched off where it cannot work.** If the browser has no Web Bluetooth (Safari, Firefox) or the page is not secure, the Ti option is disabled and the reason is shown, including "use Chrome on a Mac, or the Bluefy app on iPhone".

## Alternatives

- **Hide the Ti until a real scale has tested it:** safer, but nothing could be exercised, and the real bugs would all surface on device day.
- **Show it as a normal option:** would look finished while unproven. A wrong weight in a brew log is worse than a missing one.
- **Mark experimental brews in the data (a fourth yield source):** more precise, but the label on screen plus a quick check against the scale's display is enough for the few brews before verification. Revisit if the Ti is used for real brewing before it is verified.

## Consequences

- If the real scale does not repeat the tare or auto-send commands, the driver will report a timeout even though the command worked. That is the first assumption to check (checklist item 10 and 11 in `docs/protocols/difluid-microbalance-ti.md`).
- Readings with the top bit set are dropped and shown as a problem. A tare followed by a lift of the vessel could show this. Device day confirms how negatives really look.
- The browser's device chooser needs a tap, so Connect must be pressed directly. The live brew screen does this.
- The R2 driver (LAB-13) will reuse the same transport once DiFluid's service ID is known.
- A yield saved from the Ti is recorded as `yieldSource: scale`, the same as any real scale.
