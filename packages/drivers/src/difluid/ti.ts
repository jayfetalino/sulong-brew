// DiFluid Microbalance Ti messages, from DiFluid's own document
// (docs/protocolMicrobalance.md, version 1.0.0, last update December 24th, 2024, in
// https://github.com/DiFluid/difluid-sdk-demo, MIT license).
// docs/protocols/difluid-microbalance-ti.md in this repository records what is documented, what
// is only inferred, and what is not stated. Nothing here has been tried on a real scale yet.

import { encodeDifluidFrame, type DifluidFrame } from './frame';

/** Bluetooth service of the Microbalance Ti (the plain Microbalance uses a different one). */
export const TI_SERVICE_UUID = '000000dd-0000-1000-8000-00805f9b34fb';
/** The cleartext channel the frames travel on ("AA01"). */
export const TI_CHARACTERISTIC_UUID = '0000aa01-0000-1000-8000-00805f9b34fb';
/** DiFluid's stated minimum firmware for the Microbalance Ti. */
export const TI_MIN_FIRMWARE = 'V010';

const GRAMS_PER_OUNCE = 28.349523125;

const FUNC_SETTINGS = 1;
const FUNC_DATA = 3;

/**
 * Frames to send. Each equals a frame written in DiFluid's document, except where noted.
 */
export const tiCommands = {
  /** Switch automatic weight sending on or off. On: `DF DF 01 00 01 01 C1` (documented). */
  autoSend: (on: boolean) => encodeDifluidFrame(FUNC_SETTINGS, 0, [on ? 1 : 0]),
  /** Ask for one weight frame: `DF DF 03 00 00 C1` (documented). */
  getSensorData: () => encodeDifluidFrame(FUNC_DATA, 0),
  /**
   * Tare. DiFluid: "How to Tare: use Power Button Single Click (Func 3, Cmd 2)".
   * `DF DF 03 02 01 01 C5` (documented example, data 01 = the power button).
   */
  tare: () => encodeDifluidFrame(FUNC_DATA, 2, [1]),
  /**
   * Start the timer, or leave the stopped state: "DLink Button Single Click" (Func 3, Cmd 2,
   * data 00). DiFluid gives no example frame, so this one is built from the check sum rule only.
   */
  timerStartOrResume: () => encodeDifluidFrame(FUNC_DATA, 2, [0]),
  /** Stop (pause) the timer: "DLink Button Press": `DF DF 03 01 01 00 C3` (documented). */
  timerStop: () => encodeDifluidFrame(FUNC_DATA, 1, [0]),
  /** Set the weight unit. Gram `DF DF 01 04 01 00 C4`, ounce `DF DF 01 04 01 01 C5` (documented). */
  setWeightUnit: (unit: 'gram' | 'ounce') =>
    encodeDifluidFrame(FUNC_SETTINGS, 4, [unit === 'gram' ? 0 : 1]),
  /** Ask for the device status and battery: `DF DF 03 05 00 C6` (documented). */
  getDeviceStatus: () => encodeDifluidFrame(FUNC_DATA, 5),
} as const;

/** Device status codes, from DiFluid's table. */
export const TI_STATUS_NAMES: Record<number, string> = {
  0: 'Power down',
  1: 'Charging',
  2: 'Low power mode 1',
  3: 'Low-battery shutdown',
  4: 'Startup',
  5: 'Idle',
  6: 'Show device information',
  7: 'Tare in progress',
  8: 'OTA in progress',
  9: 'OTA failed',
  10: 'Timing in progress',
  11: 'Timer pause',
  12: 'Reserved',
  13: 'Low power mode 2',
  14: 'Auto stop timing trigger',
};

export type TiMessage =
  | {
      type: 'weight';
      /** Weight in grams. An ounce reading is converted. */
      weightG: number;
      /** The unit the scale was set to when it sent this. */
      unit: 'gram' | 'ounce';
      /**
       * DiFluid's "flow rate (x10)", exactly as sent. Its unit and its sign are not stated,
       * so it is not interpreted.
       */
      flowRateRaw: number;
      /** DiFluid's "time" field, exactly as sent. Its unit is not stated. */
      timerRaw: number;
      /** DiFluid's device tick ("system tick"). */
      deviceTick: number;
    }
  | {
      type: 'status';
      statusCode: number;
      statusName: string;
      /** 0 to 100. */
      batteryPercent: number;
      charging: boolean;
    }
  /** The device repeats a command it has carried out. */
  | { type: 'ack'; func: number; cmd: number; data: number[] }
  | { type: 'unknown'; func: number; cmd: number; data: number[] };

export type TiParseError =
  | 'unexpected-length'
  /** A number whose top bit is set. DiFluid does not say whether numbers can be negative. */
  | 'sign-unknown'
  /** The scale is set to a unit this app does not support. */
  | 'unsupported-unit'
  | 'invalid-value';

export type TiParseResult =
  { ok: true; message: TiMessage } | { ok: false; error: TiParseError; message: string };

const fail = (error: TiParseError, message: string): TiParseResult => ({
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

/**
 * Reads a frame from the Microbalance Ti.
 *
 * A weight whose top bit is set is refused (`sign-unknown`): DiFluid's document does not say how
 * a weight below zero is sent, so it is not guessed. Until that is checked on a real scale, a
 * reading that slightly dips below zero after a tare is dropped instead of misread.
 */
export function parseTiFrame(frame: DifluidFrame): TiParseResult {
  const { func, cmd, data } = frame;

  if (func === FUNC_DATA && cmd === 0) {
    // DiFluid's table says 12 data bytes but its example has 13 (0x0D), including the unit byte.
    if (data.length < 13) {
      return fail(
        'unexpected-length',
        `A weight frame has 13 data bytes, this one has ${data.length}.`,
      );
    }
    const raw = u32(data, 0);
    if (raw >= 0x80000000) {
      return fail(
        'sign-unknown',
        'The weight has its top bit set. DiFluid does not say whether that means a negative weight, so it was not used.',
      );
    }
    const unitCode = data[12] as number;
    let weightG: number;
    let unit: 'gram' | 'ounce';
    if (unitCode === 0) {
      weightG = raw / 10;
      unit = 'gram';
    } else if (unitCode === 1) {
      weightG = (raw / 1000) * GRAMS_PER_OUNCE;
      unit = 'ounce';
    } else if (unitCode === 2) {
      return fail(
        'unsupported-unit',
        'The scale is set to "gering", which this app does not support. Set the scale to grams.',
      );
    } else {
      return fail('invalid-value', `The weight unit code ${unitCode} is not one DiFluid lists.`);
    }
    return {
      ok: true,
      message: {
        type: 'weight',
        weightG,
        unit,
        flowRateRaw: u16(data, 4),
        timerRaw: u16(data, 6),
        deviceTick: u32(data, 8),
      },
    };
  }

  if (func === FUNC_DATA && cmd === 5) {
    if (data.length < 3) {
      return fail(
        'unexpected-length',
        `A status frame has at least 3 data bytes, this one has ${data.length}.`,
      );
    }
    const statusCode = data[0] as number;
    const batteryPercent = data[1] as number;
    if (batteryPercent > 100) {
      return fail('invalid-value', `A battery level of ${batteryPercent} is above 100.`);
    }
    return {
      ok: true,
      message: {
        type: 'status',
        statusCode,
        statusName: TI_STATUS_NAMES[statusCode] ?? `Unknown status ${statusCode}`,
        batteryPercent,
        charging: data[2] === 1,
      },
    };
  }

  const plain = Array.from(data);
  // A settings reply, or the echo of a button command (DiFluid: "the reply repeats the command").
  if (func === FUNC_SETTINGS || (func === FUNC_DATA && cmd >= 1 && cmd <= 4)) {
    return { ok: true, message: { type: 'ack', func, cmd, data: plain } };
  }
  return { ok: true, message: { type: 'unknown', func, cmd, data: plain } };
}
