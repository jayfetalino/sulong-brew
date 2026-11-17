import { describe, expect, it } from 'vitest';
import {
  DIFLUID_MAX_DATA_BYTES,
  DifluidFrameAssembler,
  decodeDifluidFrame,
  difluidChecksum,
  encodeDifluidFrame,
} from './frame';
import { DOCUMENTED_VALID_FRAMES } from './fixtures';
import { fromHex, toHex } from './hex';

describe('hex helpers', () => {
  it('converts both ways, spaced or not, upper or lower case', () => {
    expect(Array.from(fromHex('DF DF 03'))).toEqual([0xdf, 0xdf, 3]);
    expect(Array.from(fromHex('dfdf03'))).toEqual([0xdf, 0xdf, 3]);
    expect(toHex([0xdf, 0xdf, 3, 0xa])).toBe('DF DF 03 0A');
    expect(toHex(fromHex('de ad be ef'))).toBe('DE AD BE EF');
  });

  it('refuses text that is not hexadecimal pairs', () => {
    expect(() => fromHex('DF D')).toThrow(RangeError);
    expect(() => fromHex('GG')).toThrow(RangeError);
  });
});

describe('difluidChecksum', () => {
  it('keeps only the low byte of the sum', () => {
    // DF DF 03 00 00 sums to 0x1C1, and DiFluid writes C1.
    expect(difluidChecksum([0xdf, 0xdf, 0x03, 0x00, 0x00])).toBe(0xc1);
    // DF DF 03 00 07 02 00 4F 00 02 09 3D sums to 0x261, and DiFluid writes 61.
    expect(difluidChecksum(fromHex('DF DF 03 00 07 02 00 4F 00 02 09 3D'))).toBe(0x61);
  });

  it('is 0 for no bytes', () => {
    expect(difluidChecksum([])).toBe(0);
  });
});

describe('encodeDifluidFrame', () => {
  it('builds frames that equal the ones DiFluid writes out', () => {
    expect(toHex(encodeDifluidFrame(3, 0))).toBe('DF DF 03 00 00 C1');
    expect(toHex(encodeDifluidFrame(3, 5))).toBe('DF DF 03 05 00 C6');
    expect(toHex(encodeDifluidFrame(3, 2, [1]))).toBe('DF DF 03 02 01 01 C5');
    expect(toHex(encodeDifluidFrame(1, 3, [3]))).toBe('DF DF 01 03 01 03 C6');
  });

  it('accepts exactly the most data a frame can carry, and no more', () => {
    expect(DIFLUID_MAX_DATA_BYTES).toBe(14);
    expect(encodeDifluidFrame(3, 0, new Array(14).fill(0)).length).toBe(20);
    expect(() => encodeDifluidFrame(3, 0, new Array(15).fill(0))).toThrow(/at most 14/);
  });

  it('refuses values that are not bytes', () => {
    expect(() => encodeDifluidFrame(256, 0)).toThrow(RangeError);
    expect(() => encodeDifluidFrame(3, -1)).toThrow(RangeError);
    expect(() => encodeDifluidFrame(3, 0, [1.5])).toThrow(RangeError);
    expect(() => encodeDifluidFrame(3, 0, [300])).toThrow(RangeError);
  });
});

describe('decodeDifluidFrame', () => {
  it('reads a frame and reports how many bytes it used', () => {
    const result = decodeDifluidFrame(fromHex('DF DF 03 02 01 01 C5'));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.length).toBe(7);
      expect([result.frame.func, result.frame.cmd, Array.from(result.frame.data)]).toEqual([
        3,
        2,
        [1],
      ]);
    }
  });

  it('ignores bytes after the frame', () => {
    const result = decodeDifluidFrame(fromHex('DF DF 03 00 00 C1 AA BB'));
    expect(result.ok && result.length).toBe(6);
  });

  it('says too-short when the frame is cut off', () => {
    expect(decodeDifluidFrame(fromHex('DF DF 03'))).toMatchObject({
      ok: false,
      error: 'too-short',
    });
    expect(decodeDifluidFrame(fromHex('DF DF 03 02 01 01'))).toMatchObject({
      ok: false,
      error: 'too-short',
    });
  });

  it('says bad-header when it does not start with DF DF', () => {
    expect(decodeDifluidFrame(fromHex('DF DE 03 00 00 C1'))).toMatchObject({
      ok: false,
      error: 'bad-header',
    });
  });

  it('says bad-length when the data length would make the frame too long', () => {
    expect(
      decodeDifluidFrame(
        fromHex('DF DF 03 00 0F 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00'),
      ),
    ).toMatchObject({ ok: false, error: 'bad-length' });
  });

  it('says bad-checksum when the check sum is wrong', () => {
    expect(decodeDifluidFrame(fromHex('DF DF 03 00 00 C2'))).toMatchObject({
      ok: false,
      error: 'bad-checksum',
    });
  });

  it('does not change what it is given', () => {
    const bytes = fromHex('DF DF 03 02 01 01 C5');
    decodeDifluidFrame(bytes);
    expect(toHex(bytes)).toBe('DF DF 03 02 01 01 C5');
  });
});

describe('encode and decode agree', () => {
  it('every frame survives a round trip', () => {
    for (let func = 0; func < 4; func++) {
      for (const data of [[], [0], [255], [1, 2, 3], new Array(14).fill(171)]) {
        const result = decodeDifluidFrame(encodeDifluidFrame(func, 7, data));
        expect(
          result.ok && [result.frame.func, result.frame.cmd, Array.from(result.frame.data)],
        ).toEqual([func, 7, data]);
      }
    }
  });
});

describe('DifluidFrameAssembler', () => {
  const weight = fromHex('DF DF 03 00 0D 00 00 02 F8 00 00 00 00 00 0A 27 B0 00 A9');
  const tare = fromHex('DF DF 03 02 01 01 C5');

  it('returns a frame that arrives whole', () => {
    const frames = new DifluidFrameAssembler().push(weight);
    expect(frames).toHaveLength(1);
    expect(frames[0]?.data.length).toBe(13);
  });

  it('puts together a frame that arrives one byte at a time', () => {
    const assembler = new DifluidFrameAssembler();
    const frames = [];
    for (const byte of weight) frames.push(...assembler.push([byte]));
    expect(frames).toHaveLength(1);
    expect(assembler.discardedBytes).toBe(0);
  });

  it('splits two frames that arrive in one chunk', () => {
    const both = new Uint8Array([...weight, ...tare]);
    const frames = new DifluidFrameAssembler().push(both);
    expect(frames.map((f) => [f.func, f.cmd])).toEqual([
      [3, 0],
      [3, 2],
    ]);
  });

  it('joins a frame cut in the middle across two chunks', () => {
    const assembler = new DifluidFrameAssembler();
    expect(assembler.push(weight.subarray(0, 9))).toHaveLength(0);
    expect(assembler.push(weight.subarray(9))).toHaveLength(1);
  });

  it('skips noise before a frame, and counts it', () => {
    const assembler = new DifluidFrameAssembler();
    const frames = assembler.push(new Uint8Array([0x00, 0x11, 0x22, ...tare]));
    expect(frames).toHaveLength(1);
    expect(assembler.discardedBytes).toBe(3);
  });

  it('keeps a lone DF at the end of a chunk, in case it starts a header', () => {
    const assembler = new DifluidFrameAssembler();
    expect(assembler.push(new Uint8Array([0x00, 0xdf]))).toHaveLength(0);
    expect(assembler.push(tare.subarray(1))).toHaveLength(1);
  });

  it('recovers after a frame with a bad check sum and still finds the next good one', () => {
    const broken = Uint8Array.from(tare);
    broken[broken.length - 1] = 0x00;
    const assembler = new DifluidFrameAssembler();
    const frames = assembler.push(new Uint8Array([...broken, ...weight]));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.cmd).toBe(0);
    expect(assembler.discardedBytes).toBeGreaterThan(0);
  });

  it('is not stuck by a false header that claims too much data', () => {
    const assembler = new DifluidFrameAssembler();
    const frames = assembler.push(new Uint8Array([0xdf, 0xdf, 0x03, 0x00, 0xff, ...tare]));
    expect(frames).toHaveLength(1);
  });

  it('forgets half a frame when reset', () => {
    const assembler = new DifluidFrameAssembler();
    assembler.push(weight.subarray(0, 8));
    assembler.reset();
    expect(assembler.push(tare)).toHaveLength(1);
  });

  it('gives back every documented frame, however the bytes are cut into chunks', () => {
    // A small fixed pseudo-random generator, so the test is the same every run.
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    const frames = DOCUMENTED_VALID_FRAMES.map((f) => fromHex(f.hex));
    const all = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
    let offset = 0;
    for (const f of frames) {
      all.set(f, offset);
      offset += f.length;
    }

    for (let round = 0; round < 25; round++) {
      const assembler = new DifluidFrameAssembler();
      const out: string[] = [];
      let i = 0;
      while (i < all.length) {
        const size = 1 + Math.floor(random() * 30);
        for (const frame of assembler.push(all.subarray(i, i + size))) {
          out.push(toHex(encodeDifluidFrame(frame.func, frame.cmd, frame.data)));
        }
        i += size;
      }
      expect(out).toEqual(DOCUMENTED_VALID_FRAMES.map((f) => f.hex));
      expect(assembler.discardedBytes).toBe(0);
    }
  });
});
