import { describe, expect, it } from 'vitest';
import { decodeDifluidFrame, encodeDifluidFrame, type DifluidFrame } from './frame';
import { fromHex, toHex } from './hex';
import { R2SingleTestCollector, R2_STATUS_NAMES, parseR2Frame, r2Commands } from './r2';

const frameOf = (hex: string): DifluidFrame => {
  const result = decodeDifluidFrame(fromHex(hex));
  if (!result.ok) throw new Error(`Test frame is not valid: ${hex} (${result.message})`);
  return result.frame;
};

describe('r2Commands equal the frames in DiFluid document', () => {
  it('single test and a three-test average', () => {
    expect(toHex(r2Commands.singleTest())).toBe('DF DF 03 00 00 C1');
    expect(toHex(r2Commands.averageTest(3))).toBe('DF DF 03 01 01 03 C6');
  });

  it('accepts 1 to 10 tests and refuses anything else', () => {
    expect(toHex(r2Commands.averageTest(1))).toBe('DF DF 03 01 01 01 C4');
    expect(() => r2Commands.averageTest(10)).not.toThrow();
    for (const bad of [0, 11, 1.5, -1, Number.NaN]) {
      expect(() => r2Commands.averageTest(bad)).toThrow(RangeError);
    }
  });
});

describe("parseR2Frame: DiFluid's single test example", () => {
  it('reads the status frames: test started, then test finished', () => {
    expect(parseR2Frame(frameOf('DF DF 03 00 03 00 0B 00 CF'))).toEqual({
      ok: true,
      message: { type: 'status', statusCode: 11, statusName: 'Test start' },
    });
    expect(parseR2Frame(frameOf('DF DF 03 00 03 00 00 00 C4'))).toEqual({
      ok: true,
      message: { type: 'status', statusCode: 0, statusName: 'Test finished' },
    });
  });

  it('reads the temperatures: prism 79.1, sample tank 78.8, Fahrenheit', () => {
    expect(parseR2Frame(frameOf('DF DF 03 00 06 01 03 17 03 14 01 FA'))).toEqual({
      ok: true,
      message: { type: 'temperature', prismTemp: 79.1, sampleTankTemp: 78.8, unit: 'F' },
    });
  });

  it('reads the result: concentration 0.79 (TDS) and refractive index 1.33437', () => {
    expect(parseR2Frame(frameOf('DF DF 03 00 07 02 00 4F 00 02 09 3D 61'))).toEqual({
      ok: true,
      message: { type: 'result', tdsPercent: 0.79, refractiveIndex: 1.33437 },
    });
  });

  it('reads Celsius as well as Fahrenheit', () => {
    const celsius = encodeDifluidFrame(3, 0, [1, 0x00, 0xfa, 0x00, 0xfa, 0]);
    const r = parseR2Frame(frameOf(toHex(celsius)));
    expect(
      r.ok && r.message.type === 'temperature' && [r.message.prismTemp, r.message.unit],
    ).toEqual([25, 'C']);
  });
});

describe("parseR2Frame: DiFluid's average test example", () => {
  it('reads the average status and the average temperatures and counts', () => {
    expect(parseR2Frame(frameOf('DF DF 03 01 03 00 04 00 C9'))).toMatchObject({
      ok: true,
      message: { type: 'status', statusCode: 4, statusName: 'Average test start' },
    });
    expect(parseR2Frame(frameOf('DF DF 03 01 07 04 03 21 03 1B 01 03 13'))).toEqual({
      ok: true,
      message: {
        type: 'average-info',
        averagePrismTemp: 80.1,
        averageSampleTankTemp: 79.5,
        currentCount: 1,
        totalCount: 3,
      },
    });
  });

  it('refuses the example frames whose concentration reads FF F9, because DiFluid does not say how negatives are sent', () => {
    // Package 2 in an average test, and the average result package 3.
    expect(parseR2Frame(frameOf('DF DF 03 01 07 02 FF F9 00 02 08 A6 73'))).toMatchObject({
      ok: false,
      error: 'sign-unknown',
    });
    expect(parseR2Frame(frameOf('DF DF 03 01 07 03 FF F9 FF FF E4 44 EA'))).toMatchObject({
      ok: false,
      error: 'sign-unknown',
    });
  });

  it('refuses a temperature with its top bit set', () => {
    const f = encodeDifluidFrame(3, 0, [1, 0xff, 0xf6, 0x00, 0xfa, 0]);
    expect(parseR2Frame(frameOf(toHex(f)))).toMatchObject({ ok: false, error: 'sign-unknown' });
  });
});

describe('parseR2Frame: other frames', () => {
  it('names the status codes DiFluid lists, and says so for others', () => {
    expect(R2_STATUS_NAMES[0]).toBe('Test finished');
    expect(R2_STATUS_NAMES[12]).toBe('Calibration start');
    const r = parseR2Frame(frameOf(toHex(encodeDifluidFrame(3, 0, [0, 77, 0]))));
    expect(r.ok && r.message.type === 'status' && r.message.statusName).toBe('Unknown status 77');
  });

  it('keeps error frames as sent, without interpreting DiFluid unclear error table', () => {
    const error = parseR2Frame(frameOf(toHex(encodeDifluidFrame(3, 254, [2, 3]))));
    expect(error).toEqual({ ok: true, message: { type: 'error', data: [2, 3] } });
    // DiFluid: Cmd 255 is an "unknown error" with data FF FF FF FF.
    const unknown = parseR2Frame(
      frameOf(toHex(encodeDifluidFrame(3, 255, [0xff, 0xff, 0xff, 0xff]))),
    );
    expect(unknown).toEqual({
      ok: true,
      message: { type: 'unknown-error', data: [255, 255, 255, 255] },
    });
  });

  it('passes other functions on as unknown', () => {
    expect(parseR2Frame(frameOf('DF DF 01 03 01 03 C6'))).toEqual({
      ok: true,
      message: { type: 'unknown', func: 1, cmd: 3, data: [3] },
    });
  });

  it('refuses packages that are too short', () => {
    expect(parseR2Frame(frameOf(toHex(encodeDifluidFrame(3, 0, [2, 0, 79]))))).toMatchObject({
      ok: false,
      error: 'unexpected-length',
    });
    expect(parseR2Frame(frameOf(toHex(encodeDifluidFrame(3, 0, [0]))))).toMatchObject({
      ok: false,
      error: 'unexpected-length',
    });
  });

  it('refuses a temperature unit that is not 0 or 1', () => {
    const f = encodeDifluidFrame(3, 0, [1, 0, 10, 0, 10, 5]);
    expect(parseR2Frame(frameOf(toHex(f)))).toMatchObject({ ok: false, error: 'invalid-value' });
  });
});

describe('R2SingleTestCollector', () => {
  const official = [
    'DF DF 03 00 03 00 0B 00 CF',
    'DF DF 03 00 03 00 00 00 C4',
    'DF DF 03 00 06 01 03 17 03 14 01 FA',
    'DF DF 03 00 07 02 00 4F 00 02 09 3D 61',
  ];

  it("follows DiFluid's whole single test and ends with the TDS", () => {
    const collector = new R2SingleTestCollector();
    const states = official.map((hex) => collector.push(frameOf(hex)).state);
    expect(states).toEqual(['waiting', 'waiting', 'waiting', 'done']);
  });

  it('gives the TDS, 0.79 percent, from the documented result', () => {
    const collector = new R2SingleTestCollector();
    let last;
    for (const hex of official) last = collector.push(frameOf(hex));
    expect(last).toEqual({ state: 'done', tdsPercent: 0.79 });
  });

  it('fails on an error frame, and shows its bytes', () => {
    const collector = new R2SingleTestCollector();
    collector.push(frameOf(official[0] as string));
    const result = collector.push(frameOf(toHex(encodeDifluidFrame(3, 254, [2, 3]))));
    expect(result).toMatchObject({ state: 'failed' });
    expect(result.state === 'failed' && result.message).toContain('02 03');
  });

  it('fails on a TDS of zero or below, which cannot be a coffee measurement', () => {
    const collector = new R2SingleTestCollector();
    const zero = encodeDifluidFrame(3, 0, [2, 0, 0, 0, 2, 9, 0x3d]);
    expect(collector.push(frameOf(toHex(zero)))).toMatchObject({ state: 'failed' });
  });

  it('fails on a TDS above 30 percent', () => {
    const collector = new R2SingleTestCollector();
    const high = encodeDifluidFrame(3, 0, [2, 0x0b, 0xb9, 0, 2, 9, 0x3d]); // 0x0BB9 = 3001 -> 30.01
    expect(collector.push(frameOf(toHex(high)))).toMatchObject({ state: 'failed' });
  });

  it('fails on a frame it cannot use, rather than carrying on', () => {
    const collector = new R2SingleTestCollector();
    const result = collector.push(frameOf('DF DF 03 01 07 02 FF F9 00 02 08 A6 73'));
    expect(result.state).toBe('failed');
  });

  it('stays finished: nothing after the end changes the outcome', () => {
    const collector = new R2SingleTestCollector();
    for (const hex of official) collector.push(frameOf(hex));
    expect(collector.push(frameOf(official[0] as string))).toEqual({ state: 'waiting' });
  });

  it('never uses an em-dash in its messages', () => {
    const collector = new R2SingleTestCollector();
    const failed = collector.push(frameOf(toHex(encodeDifluidFrame(3, 254, [1]))));
    expect(failed.state === 'failed' && failed.message).not.toContain('—');
  });
});
