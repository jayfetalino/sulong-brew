import { describe, expect, it } from 'vitest';
import { decodeDifluidFrame, encodeDifluidFrame, type DifluidFrame } from './frame';
import { fromHex, toHex } from './hex';
import {
  TI_CHARACTERISTIC_UUID,
  TI_SERVICE_UUID,
  TI_STATUS_NAMES,
  parseTiFrame,
  tiCommands,
} from './ti';

const frameOf = (hex: string): DifluidFrame => {
  const result = decodeDifluidFrame(fromHex(hex));
  if (!result.ok) throw new Error(`Test frame is not valid: ${hex} (${result.message})`);
  return result.frame;
};

/** A weight frame built by us (not one of DiFluid's examples), for cases DiFluid does not show. */
const weightFrame = (raw: number, unit: number) =>
  encodeDifluidFrame(3, 0, [
    (raw >>> 24) & 0xff,
    (raw >>> 16) & 0xff,
    (raw >>> 8) & 0xff,
    raw & 0xff,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    unit,
  ]);

describe('Microbalance Ti identifiers, as written by DiFluid', () => {
  it('uses the Ti service 00DD and the AA01 characteristic', () => {
    expect(TI_SERVICE_UUID).toBe('000000dd-0000-1000-8000-00805f9b34fb');
    expect(TI_CHARACTERISTIC_UUID).toBe('0000aa01-0000-1000-8000-00805f9b34fb');
  });

  it('is not the plain Microbalance service (00EE)', () => {
    expect(TI_SERVICE_UUID).not.toContain('00ee');
  });
});

describe('tiCommands equal the frames in DiFluid document', () => {
  it.each([
    ['autoSend on', tiCommands.autoSend(true), 'DF DF 01 00 01 01 C1'],
    ['getSensorData', tiCommands.getSensorData(), 'DF DF 03 00 00 C1'],
    ['tare', tiCommands.tare(), 'DF DF 03 02 01 01 C5'],
    ['timerStop', tiCommands.timerStop(), 'DF DF 03 01 01 00 C3'],
    ['setWeightUnit gram', tiCommands.setWeightUnit('gram'), 'DF DF 01 04 01 00 C4'],
    ['setWeightUnit ounce', tiCommands.setWeightUnit('ounce'), 'DF DF 01 04 01 01 C5'],
    ['getDeviceStatus', tiCommands.getDeviceStatus(), 'DF DF 03 05 00 C6'],
  ])('%s', (_name, frame, documented) => {
    expect(toHex(frame)).toBe(documented);
  });

  it('autoSend off differs from on only in its data and check sum', () => {
    expect(toHex(tiCommands.autoSend(false))).toBe('DF DF 01 00 01 00 C0');
  });

  it('timerStartOrResume is built from the check sum rule, since DiFluid gives no example', () => {
    expect(toHex(tiCommands.timerStartOrResume())).toBe('DF DF 03 02 01 00 C4');
  });
});

describe('parseTiFrame: weight', () => {
  it("decodes DiFluid's own example: 76 g, flow 0, time 0, tick 665520", () => {
    const result = parseTiFrame(
      frameOf('DF DF 03 00 0D 00 00 02 F8 00 00 00 00 00 0A 27 B0 00 A9'),
    );
    expect(result).toEqual({
      ok: true,
      message: {
        type: 'weight',
        weightG: 76,
        unit: 'gram',
        flowRateRaw: 0,
        timerRaw: 0,
        deviceTick: 665520,
      },
    });
  });

  it('divides grams by 10, so 0.1 g is the smallest step', () => {
    const r = parseTiFrame(decodeOk(weightFrame(1, 0)));
    expect(r.ok && r.message.type === 'weight' && r.message.weightG).toBe(0.1);
    const r2 = parseTiFrame(decodeOk(weightFrame(3101, 0)));
    expect(r2.ok && r2.message.type === 'weight' && r2.message.weightG).toBe(310.1);
  });

  it('converts an ounce reading to grams (ounces x 1000 in the frame)', () => {
    const r = parseTiFrame(decodeOk(weightFrame(1000, 1)));
    expect(r.ok && r.message.type === 'weight' && r.message.weightG).toBeCloseTo(28.349523125, 9);
    expect(r.ok && r.message.type === 'weight' && r.message.unit).toBe('ounce');
  });

  it('reads zero as a zero weight', () => {
    const r = parseTiFrame(decodeOk(weightFrame(0, 0)));
    expect(r.ok && r.message.type === 'weight' && r.message.weightG).toBe(0);
  });

  it('refuses a weight with its top bit set, because DiFluid does not say how negatives are sent', () => {
    // 0xFFFFFFF6 would be -10 if signed (-1.0 g), or about 429 million grams if not.
    for (const raw of [0xfffffff6, 0x80000000]) {
      const r = parseTiFrame(decodeOk(weightFrame(raw, 0)));
      expect(r).toMatchObject({ ok: false, error: 'sign-unknown' });
    }
  });

  it('accepts the largest weight that has no top bit', () => {
    const r = parseTiFrame(decodeOk(weightFrame(0x7fffffff, 0)));
    expect(r.ok).toBe(true);
  });

  it('refuses the "gering" unit and an unknown unit instead of guessing', () => {
    expect(parseTiFrame(decodeOk(weightFrame(100, 2)))).toMatchObject({
      ok: false,
      error: 'unsupported-unit',
    });
    expect(parseTiFrame(decodeOk(weightFrame(100, 9)))).toMatchObject({
      ok: false,
      error: 'invalid-value',
    });
  });

  it('refuses a weight frame that is too short to hold the unit', () => {
    const short = encodeDifluidFrame(3, 0, [0, 0, 2, 0xf8, 0, 0, 0, 0, 0, 0xa, 0x27, 0xb0]); // 12 data bytes
    expect(parseTiFrame(decodeOk(short))).toMatchObject({ ok: false, error: 'unexpected-length' });
  });

  it('keeps the flow rate and timer fields exactly as sent, without inventing units', () => {
    const frame = encodeDifluidFrame(3, 0, [0, 0, 0, 10, 0x01, 0x2c, 0x00, 0x07, 0, 0, 0, 5, 0]);
    const r = parseTiFrame(decodeOk(frame));
    expect(
      r.ok && r.message.type === 'weight' && [r.message.flowRateRaw, r.message.timerRaw],
    ).toEqual([300, 7]);
  });
});

describe('parseTiFrame: status and battery', () => {
  it("decodes DiFluid's example: Idle, battery 100 %, charging", () => {
    expect(parseTiFrame(frameOf('DF DF 03 05 08 05 64 01 00 00 00 00 00 38'))).toEqual({
      ok: true,
      message: {
        type: 'status',
        statusCode: 5,
        statusName: 'Idle',
        batteryPercent: 100,
        charging: true,
      },
    });
  });

  it('names every status code from DiFluid table, 0 to 14', () => {
    expect(Object.keys(TI_STATUS_NAMES)).toHaveLength(15);
    expect(TI_STATUS_NAMES[7]).toBe('Tare in progress');
    expect(TI_STATUS_NAMES[10]).toBe('Timing in progress');
  });

  it('says so for a status code it does not know', () => {
    const r = parseTiFrame(decodeOk(encodeDifluidFrame(3, 5, [99, 50, 0])));
    expect(r.ok && r.message.type === 'status' && r.message.statusName).toBe('Unknown status 99');
  });

  it('refuses a battery level above 100 and a status frame with too little data', () => {
    expect(parseTiFrame(decodeOk(encodeDifluidFrame(3, 5, [5, 101, 0])))).toMatchObject({
      ok: false,
      error: 'invalid-value',
    });
    expect(parseTiFrame(decodeOk(encodeDifluidFrame(3, 5, [5])))).toMatchObject({
      ok: false,
      error: 'unexpected-length',
    });
  });

  it('shows not charging when the charge byte is 0', () => {
    const r = parseTiFrame(decodeOk(encodeDifluidFrame(3, 5, [5, 80, 0])));
    expect(r.ok && r.message.type === 'status' && r.message.charging).toBe(false);
  });
});

describe('parseTiFrame: replies to commands and unknown frames', () => {
  it('recognises the echo of a tare as an acknowledgement', () => {
    expect(parseTiFrame(frameOf('DF DF 03 02 01 01 C5'))).toEqual({
      ok: true,
      message: { type: 'ack', func: 3, cmd: 2, data: [1] },
    });
  });

  it('recognises the reply to the auto-send setting as an acknowledgement', () => {
    expect(parseTiFrame(frameOf('DF DF 01 00 01 01 C1'))).toMatchObject({
      ok: true,
      message: { type: 'ack', func: 1, cmd: 0, data: [1] },
    });
  });

  it('passes anything else on as unknown, with its bytes', () => {
    expect(parseTiFrame(decodeOk(encodeDifluidFrame(9, 9, [1, 2])))).toEqual({
      ok: true,
      message: { type: 'unknown', func: 9, cmd: 9, data: [1, 2] },
    });
  });
});

function decodeOk(bytes: Uint8Array): DifluidFrame {
  return frameOf(toHex(bytes));
}
