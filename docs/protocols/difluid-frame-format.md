# DiFluid frame format (shared by the R2 Extract and the Microbalance Ti)

Everything on this page is taken from DiFluid's own open-source documentation. Items DiFluid does not state are marked **Not stated**. Items worked out by hand from the documented examples are marked **Checked against examples**. Nothing is guessed.

## Source

| Item                    | Value                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Repository              | https://github.com/DiFluid/difluid-sdk-demo (official)                                                   |
| Files read              | `README.md`, `LICENSE`, `docs/difluid-protocol.md`, `docs/protocolR2.md`, `docs/protocolMicrobalance.md` |
| Latest commit when read | `df4e0731dc64`, 2024-12-24                                                                               |
| Read on                 | 2026-11-16                                                                                               |
| Frame document version  | 1.0.0, last update Mar 18th 2023                                                                         |
| License                 | MIT, Copyright (c) 2023 Shenzhen Digitizing Fluid Technology Co., Ltd.                                   |
| Credit                  | DiFluid wrote the protocol. We wrote our own code from its documentation.                                |

The MIT license requires its copyright and permission notice to be kept in copies or substantial portions of DiFluid's software. We do not copy their code. If code or substantial text is ever copied, include DiFluid's notice. DiFluid has also confirmed to the project owner that the SDK documentation is open source with no specific restrictions on use.

## Frame layout

Every message, in both directions, is one frame of at most **20 bytes**. All numbers are shown in hexadecimal.

| Byte   | Meaning                                           |
| ------ | ------------------------------------------------- |
| 0      | Header 1, always `DF`                             |
| 1      | Header 2, always `DF`                             |
| 2      | Func (function group)                             |
| 3      | Cmd (command within the group)                    |
| 4      | Data length: the number of data bytes that follow |
| 5 to N | Data0 to DataN                                    |
| last   | Check sum                                         |

## Check sum

Documented rule: the sum of every byte from Header 1 to the last data byte, "all the part in data pack except the check sum".

```
Check sum = Header 1 + Header 2 + Func + Cmd + Data Len + Data0 + ... + DataN
```

- **Keep only the low byte (Checked against examples):** the documents do not say what happens when the sum is more than one byte. Checked by script on 2026-11-16: of the 83 frames written out in the R2 and Microbalance documents, 80 match the layout, the data length and the check sum exactly when only the low 8 bits are kept. The other 3 are typos in the Microbalance document (see below). For example `DF DF 03 00 00` sums to `0x1C1`, and the documented frame ends in `C1`. `DF DF 03 00 07 02 00 4F 00 02 09 3D` sums to `0x261`, and the documented frame ends in `61`.

## Multi-byte numbers

- **Byte order: Not stated in words.** Every documented example reads as big-endian (the most significant byte first). For example `00 00 02 F8` is decoded by DiFluid as `0x000002F8 = 760`.
- **Signed or unsigned: Not stated.** See the per-device pages for which fields this affects.

## The two Bluetooth channels (from the README)

A connected DiFluid device offers two characteristics:

- `0000ff01-0000-1000-8000-00805f9b34fb`: the **encrypted** channel.
- `0000aa01-0000-1000-8000-00805f9b34fb`: the **cleartext** channel, which carries the frames on this page.

The README says devices "now have the encrypted channel and cleartext channel both on by default", and that the optional DiFluid server step is "only used to making connection to DiFluid Server and enabling OTA function (WIP for third-party usage)". An earlier paragraph saying the cleartext channel was off by default is struck through in the README, so it no longer applies.

- **Not stated:** the read, write and notify properties of these characteristics. A driver must check which operations the device reports at runtime and must not assume.
- **Still to verify on a real device:** that the cleartext channel really is on, and works from a web page, on the actual firmware.

## Answers from DiFluid support (email received 2026-11-18)

The project owner asked DiFluid about gaps in the public documents. Their reply is not published, so it is recorded here as reported. These are statements from DiFluid, not observations of a device, and none has been checked on real hardware.

| Question                               | DiFluid's answer, as received                                                                                               | What it means for us                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The R2's Bluetooth service ID and name | "The UUID and service are the same as those of the Microbalance Ti. The device name is 'DiFluid R2 xxxxx'."                 | The R2 uses service `000000DD-...` and the same data channel as the Ti, and its name starts with "DiFluid R2 ". Because the Ti uses the same service, a chooser needs the name prefix to tell the R2 apart. |
| The channel                            | "The connection uses a cleartext communication channel. The data is transmitted exactly as described in the documentation." | Frames travel on the cleartext channel (AA01) in the documented format. This supports the README's "both channels on by default", but it is still to be seen on a real device.                              |
| Negative weights                       | "Negative weight values are transmitted in the same way as normal weight values."                                           | No special marker. The encoding is not named. A signed 32-bit number is the likely reading, but it is an inference, so top-bit weights stay refused until a device confirms it.                             |

They also pointed to the public documents folder (https://github.com/DiFluid/difluid-sdk-demo/tree/master/docs), which this project already uses.

## Known inconsistencies in DiFluid's documents

Recorded so nobody is surprised later. We follow the examples where they disagree with the tables, and confirm on real hardware.

- Microbalance sensor data: the table says data length `12`, the example frame says `0x0D` (13 data bytes).
- R2 refractive index: the table says Data3-4 (two bytes), the example uses four bytes (`00 02 09 3D`).
- Microbalance auto-send example: the data byte is `01`, but the text says `0x00 = On`.
- Some example text has typos (for example the R2 serial number line).
- Three frames in the Microbalance document fail the layout check: the "Get Device Model" reply (`DF DF 01 08 44 ...`, wrong Func and length), the "Get Firmware Version" reply (`DF DF 00 02 17 ...`, wrong length), and the "Get Auto Detect Timing Status" command (`DF DF 01 01 01 C0`, wrong check sum and length). None are needed for weight, tare or the auto-send flag, whose frames all check out.
