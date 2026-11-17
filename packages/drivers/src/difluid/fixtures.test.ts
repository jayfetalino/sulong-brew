import { describe, expect, it } from 'vitest';
import { decodeDifluidFrame, encodeDifluidFrame } from './frame';
import { DOCUMENTED_INVALID_FRAMES, DOCUMENTED_VALID_FRAMES } from './fixtures';
import { fromHex, toHex } from './hex';

// These frames were copied from DiFluid's documents by a script, so they cannot contain typos
// of ours. These tests check that our code agrees with every one of DiFluid's own examples.

describe('frames written in DiFluid documents', () => {
  it('has the 48 distinct frames that follow DiFluid rules, and the 3 that do not', () => {
    expect(DOCUMENTED_VALID_FRAMES).toHaveLength(48);
    expect(DOCUMENTED_INVALID_FRAMES).toHaveLength(3);
  });

  it.each(DOCUMENTED_VALID_FRAMES.map((f) => [f.hex, f] as const))(
    'decodes %s and rebuilds exactly the same bytes',
    (_hex, fixture) => {
      const bytes = fromHex(fixture.hex);
      const result = decodeDifluidFrame(bytes);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.length).toBe(bytes.length);
        const rebuilt = encodeDifluidFrame(result.frame.func, result.frame.cmd, result.frame.data);
        expect(toHex(rebuilt)).toBe(fixture.hex);
      }
    },
  );

  it.each(DOCUMENTED_INVALID_FRAMES.map((f) => [f.hex, f] as const))(
    'rejects the document typo %s instead of guessing what was meant',
    (_hex, fixture) => {
      const result = decodeDifluidFrame(fromHex(fixture.hex));
      expect(result.ok).toBe(false);
    },
  );

  it('rejects the typo frames for the right reasons', () => {
    const reasons = DOCUMENTED_INVALID_FRAMES.map((f) => {
      const r = decodeDifluidFrame(fromHex(f.hex));
      return [f.source, r.ok ? 'ok' : r.error];
    });
    expect(reasons).toEqual([
      ['protocolMicrobalance.md line 54', 'bad-length'],
      ['protocolMicrobalance.md line 58', 'bad-length'],
      ['protocolMicrobalance.md line 96', 'too-short'],
    ]);
  });
});
