# ADR-015: DiFluid message codec built only from DiFluid's documents

- **Status:** Accepted
- **Date:** 2026-11-17

## Context

DiFluid publishes open-source SDK documentation (MIT license, https://github.com/DiFluid/difluid-sdk-demo) for the R2 Extract and the Microbalance Ti. The project rule is to never guess Bluetooth details. The devices have not arrived, so nothing can be tried on hardware yet. What can be done now is to turn DiFluid's documents into code that is tested against every example the documents contain.

## Decision

Add `packages/drivers/src/difluid`, with no Bluetooth in it (it only turns bytes into messages and messages into bytes):

- **Frame layer** (`frame.ts`): build and read DiFluid's frame (two `DF` header bytes, function, command, data length, data, check sum), at most 20 bytes. The check sum keeps only the low byte of the sum. A frame assembler puts frames back together when Bluetooth splits one across chunks, delivers two in one chunk, or sends noise first, and counts what it throws away.
- **Ti layer** (`ti.ts`): the Microbalance Ti service and characteristic IDs, command builders (auto-send, tare, unit, timer, status) and a parser for weight and status frames.
- **R2 layer** (`r2.ts`): command builders (single and average test) and a parser for status, temperature and result frames, plus a small collector that follows one test and ends with the TDS. There is deliberately **no R2 service UUID**, because DiFluid does not state one.
- **Test data generated from the documents** (`fixtures.ts`): a script copies every frame written in DiFluid's two protocol documents, so test data cannot contain our typos. 48 distinct frames follow DiFluid's own rules and 3 are typos in the documents. The fixture file carries DiFluid's MIT notice. Every valid frame must decode and rebuild to identical bytes, and all of them must come out unchanged from the assembler under 25 different random ways of cutting the byte stream. The 3 typo frames must be rejected for the right reasons.
- **Refuse what DiFluid does not state.** DiFluid does not say how a negative number is sent. Any weight, concentration or temperature whose top bit is set is refused (`sign-unknown`) instead of read one way or the other. Their own average-test example contains such frames. The "gering" weight unit is refused (`unsupported-unit`). Flow rate and the timer are passed on exactly as sent, without inventing units.
- **Follow the examples where the tables disagree.** The weight frame has 13 data bytes in DiFluid's example, though the table says 12. The R2 refractive index uses four bytes in the examples, though the table says two.

## Alternatives

- **Use a community driver or forum posts to fill the gaps:** quicker, but it breaks the rule, and a wrong guess could silently produce wrong weights or TDS values. Gaps are asked of DiFluid or checked on the real device instead.
- **Read negative numbers as two's complement:** probably right, but not documented. A wrong guess would turn a small dip below zero into a huge number. Refusing such a reading only drops that reading.
- **Write the Bluetooth driver straight away:** it would mix transport problems with message-format problems, with no hardware to tell them apart. A pure codec is testable now.

## Consequences

- The Ti and R2 drivers (LAB-16, LAB-13) become thin: connect, subscribe, feed bytes to the assembler, turn messages into weights and TDS values.
- Until a real device shows how negatives are sent, a reading that dips slightly below zero after a tare is dropped, not shown. This is checked first on device day.
- The R2 cannot be found by a web page until its service UUID is known (asked of DiFluid, or read from the device once owned).
- Re-run the fixture script if DiFluid updates its documents, and read the differences.
- DiFluid's MIT notice stays with the fixture file.
