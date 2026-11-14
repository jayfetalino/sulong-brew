# LAB-11: "Read TDS from a refractometer" in the brew form

## What was built

- In the brew form, a new panel "Read TDS from a refractometer". Choose a device, press **Read TDS**, and the TDS field fills in. The extraction yield updates straight away.
- Two devices are listed. The **Demo refractometer** works and always says DEMO. The **DiFluid R2 Extract** is listed but greyed out, with the reason: waiting for DiFluid's Bluetooth details.
- Every brew now remembers where its TDS came from: typed by hand (`manual`), a real device (`refractometer`) or the demo device (`demo`).
- Demo numbers are marked everywhere: a "Demo reading" badge in the form, "(from a demo reading)" next to the extraction yield, and "(demo)" on the Brews list.
- Typing over a reading makes it a typed number again, so the label never claims a measurement that was edited.

## Key ideas

- **Labels travel with the data.** The `tdsSource` field is saved with the brew and goes through export and import, so a made-up number cannot turn into a "real" one on another device.
- **The screen never throws at you.** `takeReading` returns either a number or a plain-English message. Cancelling is not an error.
- **Old data keeps working.** Brews saved before this field existed have no source and are treated as typed by hand. The backup reader accepts both.
- **Reuse the connection.** The first reading connects, and later readings reuse it. Leaving the screen disconnects.
- **A greyed-out option is honest.** Showing the DiFluid R2 as "not available yet" tells you where the project stands, without pretending.

## Remember

Test data must announce itself. If a screen can show a number that was not measured, the screen has to say so.
