import { describe, expect, it } from 'vitest';
import { daysOffRoast, extractionYield, roundTo, weightLossPercent } from './math';

describe('weightLossPercent', () => {
  it('computes percent lost', () => {
    expect(weightLossPercent(200, 170)).toBeCloseTo(15, 10);
  });

  it('is 0 when nothing was lost', () => {
    expect(weightLossPercent(200, 200)).toBe(0);
  });

  it('rejects a green weight of 0 or less', () => {
    expect(() => weightLossPercent(0, 10)).toThrow(RangeError);
    expect(() => weightLossPercent(-5, 10)).toThrow(RangeError);
  });

  it('rejects a negative roasted weight', () => {
    expect(() => weightLossPercent(200, -1)).toThrow(RangeError);
  });
});

describe('daysOffRoast', () => {
  it('counts whole calendar days', () => {
    expect(daysOffRoast('2026-11-01', '2026-11-09')).toBe(8);
  });

  it('is 0 on roast day', () => {
    expect(daysOffRoast('2026-11-09', '2026-11-09')).toBe(0);
  });

  it('crosses month and year ends', () => {
    expect(daysOffRoast('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('is not shifted by daylight saving changes', () => {
    expect(daysOffRoast('2026-11-01', '2026-11-02')).toBe(1);
    expect(daysOffRoast('2026-03-07', '2026-03-09')).toBe(2);
  });

  it('is negative if the roast date is in the future', () => {
    expect(daysOffRoast('2026-11-10', '2026-11-09')).toBe(-1);
  });

  it('rejects badly formatted or impossible dates', () => {
    expect(() => daysOffRoast('11/09/2026', '2026-11-09')).toThrow(RangeError);
    expect(() => daysOffRoast('2026-13-40', '2026-11-09')).toThrow(RangeError);
  });
});

describe('extractionYield', () => {
  it('matches the brief example: 310 g, 1.41 %, 20 g gives 21.9 %', () => {
    expect(roundTo(extractionYield(310, 1.41, 20), 1)).toBe(21.9);
  });

  it('is 0 when TDS is 0', () => {
    expect(extractionYield(310, 0, 20)).toBe(0);
  });

  it('rejects a dose of 0 or less', () => {
    expect(() => extractionYield(310, 1.41, 0)).toThrow(RangeError);
  });

  it('rejects negative inputs', () => {
    expect(() => extractionYield(-1, 1.41, 20)).toThrow(RangeError);
    expect(() => extractionYield(310, -1, 20)).toThrow(RangeError);
  });
});

describe('roundTo', () => {
  it('rounds half up even when floats are awkward', () => {
    expect(roundTo(21.855, 1)).toBe(21.9);
    expect(roundTo(1.005, 2)).toBe(1.01);
  });
});
