# LAB-17: speaking DiFluid's language (no hardware needed)

## What was built

- Code that builds and reads DiFluid's messages ("frames"), written only from DiFluid's open-source documents.
- For the **Microbalance Ti**: commands (tare, turn on weight sending, set grams, timer, battery) and a parser that turns a weight message into grams.
- For the **R2**: commands (single test, average test) and a parser that follows a test through to the TDS number.
- A **frame assembler**: Bluetooth sends bytes in chunks that do not line up with messages. The assembler puts them back together, and ignores noise.
- 128 tests, using every example message that DiFluid wrote in its documents.

## Key ideas

- **A frame is a labelled envelope.** `DF DF`, what kind of message, which command, how many data bytes, the data, and a check sum at the end. The check sum is the sum of all the other bytes (keeping the low byte). If it does not match, the message was damaged.
- **Test against the source of truth.** A script copied all 51 frames out of DiFluid's documents, so our tests cannot contain our own typos. Our code rebuilds each of the 48 good ones byte for byte. The 3 that DiFluid mistyped are rejected on purpose.
- **Chunks are not messages.** The tests cut the byte stream at 25 different random places and still get every frame back, in order.
- **Refuse what is not stated.** DiFluid does not say how a negative weight is sent. The code throws such readings away instead of picking a meaning. A dropped reading is harmless; a wrong guess could show 429 million grams.
- **Where tables and examples disagree, follow the examples**, and write the disagreement down (`docs/protocols/difluid-frame-format.md`).
- **No Bluetooth in here.** This code only turns bytes into messages, so it can be tested completely now. The real connection (LAB-16, LAB-13) will be a thin layer on top.

## Remember

On device day, the first things to check are the ones DiFluid does not state: how a negative weight looks in bytes, and which operations the Bluetooth characteristic allows.
