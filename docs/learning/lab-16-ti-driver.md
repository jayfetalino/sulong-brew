# LAB-16: the Microbalance Ti driver (written, not yet tested on a real scale)

## What was built

- A **Bluetooth transport** for the browser (Web Bluetooth): ask the person to pick the scale, open the channel, send bytes, receive bytes, notice when the link drops.
- The **Ti driver**: connects, switches weight sending on, tares on request, and turns every weight message into a reading in grams.
- In the live brew, the Ti shows up as **"DiFluid Microbalance Ti (experimental)"**, with a clear warning, and it switches itself off with an explanation in browsers that cannot use Bluetooth.
- A screen message for problems that do not stop the weights, such as a weight DiFluid's document does not explain.

## Key ideas

- **Separate the radio from the meaning.** The transport only moves bytes. The driver only understands DiFluid's messages. Because they meet at a small interface, the driver can be tested with a pretend device.
- **Two kinds of pretend.** One pretend device is written in the tests, using our own codec. The other is written separately inside the browser test, building DiFluid frames by hand from the document. If both agree with the real code, the wiring is probably right. Only the real scale can prove it.
- **Check what the device allows, do not assume.** DiFluid does not say which operations the channel supports, so the transport asks the browser and fails with a clear message if it cannot read or write.
- **Cancelling is not an error.** Closing the device picker is a normal thing to do, so it reads as "Cancelled".
- **Leave things as you found them.** The driver never changes the scale's unit or settings. It switches weight sending on when it starts and off when it stops.
- **Say what is unproven.** The warning on screen is the honest label for code that has only been tried against fakes.

## Remember

On device day, the first two things to look at are whether the scale repeats the commands back (the driver waits for that), and how a weight below zero looks in bytes. The checklist is in `docs/protocols/difluid-microbalance-ti.md`.
