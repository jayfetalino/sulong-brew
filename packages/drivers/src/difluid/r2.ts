// DiFluid R2 Extract messages, from DiFluid's own document
// (docs/protocolR2.md, version 1.0.0, last update Mar 18th 2023, in
// https://github.com/DiFluid/difluid-sdk-demo, MIT license).
// docs/protocols/difluid-r2.md in this repository records what is documented, what is only
// inferred, and what is not stated. Notably the R2's Bluetooth service UUID is NOT stated by
// DiFluid, so there is no constant for it here. Nothing here has been tried on a real R2 yet.

import { encodeDifluidFrame, type DifluidFrame } from './frame';
import { TDS_MAX, TDS_MIN_EXCLUSIVE } from '../refractometer';

const FUNC_ACTION = 3;
const CMD_SINGLE_TEST = 0;
const CMD_AVERAGE_TEST = 1;
const CMD_ERROR = 254;
const CMD_UNKNOWN_ERROR = 255;

/** Frames to send. Each equals a frame written in DiFluid's document. */
export const r2Commands = {
  /** One test: `DF DF 03 00 00 C1` (documented). */
  singleTest: () => encodeDifluidFrame(FUNC_ACTION, CMD_SINGLE_TEST),
  /** An average of 1 to 10 tests. Three tests: `DF DF 03 01 01 03 C6` (documented). */
  averageTest: (count: number) => {
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      throw new RangeError(`The number of tests must be a whole number from 1 to 10, got ${count}`);
    }
    return encodeDifluidFrame(FUNC_ACTION, CMD_AVERAGE_TEST, [count]);
  },
} as const;

/** Test status codes, from DiFluid's table. 2 and 3 are reserved. */
export const R2_STATUS_NAMES: Record<number, string> = {
  0: 'Test finished',
  1: 'Calibration finished',
  4: 'Average test start',
  5: 'Average test ongoing',
  6: 'Average test finished',
  7: 'Loop test start',
  8: 'Loop test ongoing',
  9: 'Loop test finished',
  10: 'Average test ongoing (no valid result)',
  11: 'Test start',
  12: 'Calibration start',
};

export type R2Message =
  | { type: 'status'; statusCode: number; statusName: string }
  | {
      type: 'temperature';
      prismTemp: number;
      sampleTankTemp: number;
      unit: 'C' | 'F';
    }
  | {
      type: 'result';
      /** DiFluid's "concentration / TDS", in percent. */
      tdsPercent: number;
      refractiveIndex: number;
    }
  | {
      type: 'average-result';
      tdsPercent: number;
      refractiveIndex: number;
    }
  | {
      type: 'average-info';
      averagePrismTemp: number;
      averageSampleTankTemp: number;
      currentCount: number;
      totalCount: number;
    }
  /** An error frame. DiFluid's error table is hard to read, so the bytes are kept as sent. */
  | { type: 'error'; data: number[] }
  | { type: 'unknown-error'; data: number[] }
  | { type: 'unknown'; func: number; cmd: number; data: number[] };

export type R2ParseError = 'unexpected-length' | 'sign-unknown' | 'invalid-value';

export type R2ParseResult =
  { ok: true; message: R2Message } | { ok: false; error: R2ParseError; message: string };

const fail = (error: R2ParseError, message: string): R2ParseResult => ({
  ok: false,
  error,
  message,
});

const u16 = (d: Uint8Array, i: number) => ((d[i] as number) << 8) | (d[i + 1] as number);
const u32 = (d: Uint8Array, i: number) =>
  (((d[i] as number) << 24) |
    ((d[i + 1] as number) << 16) |
    ((d[i + 2] as number) << 8) |
    (d[i + 3] as number)) >>>
  0;

const SIGN_UNKNOWN =
  'A number has its top bit set. DiFluid does not say whether numbers can be negative, so the frame was not used.';

/**
 * Reads a frame from the R2.
 *
 * Every number whose top bit is set is refused (`sign-unknown`), because DiFluid does not say how
 * a negative number is sent. DiFluid's own average-test example contains such frames
 * (for example concentration `FF F9`), so this is expected and safe: no TDS is made from them.
 */
export function parseR2Frame(frame: DifluidFrame): R2ParseResult {
  const { func, cmd, data } = frame;
  const plain = Array.from(data);

  if (func === FUNC_ACTION && cmd === CMD_ERROR) {
    return { ok: true, message: { type: 'error', data: plain } };
  }
  if (func === FUNC_ACTION && cmd === CMD_UNKNOWN_ERROR) {
    return { ok: true, message: { type: 'unknown-error', data: plain } };
  }
  if (func !== FUNC_ACTION || (cmd !== CMD_SINGLE_TEST && cmd !== CMD_AVERAGE_TEST)) {
    return { ok: true, message: { type: 'unknown', func, cmd, data: plain } };
  }

  // Data0 is the package number.
  const pkg = data[0];
  if (pkg === undefined) return fail('unexpected-length', 'A test frame has no data.');

  if (pkg === 0) {
    if (data.length < 2) return fail('unexpected-length', 'A status package needs 2 data bytes.');
    const statusCode = data[1] as number;
    return {
      ok: true,
      message: {
        type: 'status',
        statusCode,
        statusName: R2_STATUS_NAMES[statusCode] ?? `Unknown status ${statusCode}`,
      },
    };
  }

  if (pkg === 1) {
    if (data.length < 6)
      return fail('unexpected-length', 'A temperature package needs 6 data bytes.');
    const prism = u16(data, 1);
    const tank = u16(data, 3);
    if (prism >= 0x8000 || tank >= 0x8000) return fail('sign-unknown', SIGN_UNKNOWN);
    const unit = data[5];
    if (unit !== 0 && unit !== 1) {
      return fail('invalid-value', `The temperature unit code ${unit} is not 0 (C) or 1 (F).`);
    }
    return {
      ok: true,
      message: {
        type: 'temperature',
        prismTemp: prism / 10,
        sampleTankTemp: tank / 10,
        unit: unit === 0 ? 'C' : 'F',
      },
    };
  }

  // Package 2 is the single test result. Package 3 is the average test result (Cmd 1).
  // DiFluid's table says the refractive index is Data3-4, but its examples use four bytes
  // (Data3-6), so four bytes are read.
  if (pkg === 2 || (pkg === 3 && cmd === CMD_AVERAGE_TEST)) {
    if (data.length < 7) return fail('unexpected-length', 'A result package needs 7 data bytes.');
    const concentration = u16(data, 1);
    const index = u32(data, 3);
    if (concentration >= 0x8000 || index >= 0x80000000) return fail('sign-unknown', SIGN_UNKNOWN);
    return {
      ok: true,
      message: {
        type: pkg === 2 ? 'result' : 'average-result',
        tdsPercent: concentration / 100,
        refractiveIndex: index / 100000,
      },
    };
  }

  if (pkg === 4 && cmd === CMD_AVERAGE_TEST) {
    if (data.length < 7)
      return fail('unexpected-length', 'An average info package needs 7 data bytes.');
    const prism = u16(data, 1);
    const tank = u16(data, 3);
    if (prism >= 0x8000 || tank >= 0x8000) return fail('sign-unknown', SIGN_UNKNOWN);
    return {
      ok: true,
      message: {
        type: 'average-info',
        averagePrismTemp: prism / 10,
        averageSampleTankTemp: tank / 10,
        currentCount: data[5] as number,
        totalCount: data[6] as number,
      },
    };
  }

  return { ok: true, message: { type: 'unknown', func, cmd, data: plain } };
}

export type R2TestProgress =
  | { state: 'waiting' }
  | { state: 'done'; tdsPercent: number }
  | { state: 'failed'; message: string };

/**
 * Follows one single test. Feed it each frame the R2 sends after `r2Commands.singleTest()`.
 * It finishes with the TDS when the result package arrives, or fails on an error frame, on a frame
 * it cannot use, or on a TDS that cannot be real (zero or below, or above 30 percent).
 */
export class R2SingleTestCollector {
  private finished = false;

  push(frame: DifluidFrame): R2TestProgress {
    if (this.finished) return { state: 'waiting' };
    const parsed = parseR2Frame(frame);
    if (!parsed.ok) return this.fail(parsed.message);

    const message = parsed.message;
    if (message.type === 'error' || message.type === 'unknown-error') {
      return this.fail(
        `The R2 reported an error (${message.data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ') || 'no details'}).`,
      );
    }
    if (message.type === 'result') {
      if (message.tdsPercent <= TDS_MIN_EXCLUSIVE || message.tdsPercent > TDS_MAX) {
        return this.fail(
          `The R2 gave a TDS of ${message.tdsPercent} %, which cannot be a coffee measurement. Nothing was used.`,
        );
      }
      this.finished = true;
      return { state: 'done', tdsPercent: message.tdsPercent };
    }
    return { state: 'waiting' };
  }

  private fail(message: string): R2TestProgress {
    this.finished = true;
    return { state: 'failed', message };
  }
}
