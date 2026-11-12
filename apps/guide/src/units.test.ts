import { describe, expect, it } from 'vitest';
import { cToF, formatClock, formatTemp, formatWeight, gToOz, ratioLabel, stepTitle } from './units';

describe('temperature', () => {
  it('converts C to F', () => {
    expect(cToF(100)).toBe(212);
    expect(cToF(0)).toBe(32);
    expect(cToF(91)).toBeCloseTo(195.8, 5);
  });

  it('formats in the chosen unit, F as whole degrees', () => {
    expect(formatTemp(91, 'C')).toBe('91 °C');
    expect(formatTemp(91, 'F')).toBe('196 °F');
    expect(formatTemp(94, 'F')).toBe('201 °F');
  });
});

describe('weight', () => {
  it('converts g to oz', () => {
    expect(gToOz(28.349523125)).toBeCloseTo(1, 10);
  });

  it('formats grams and ounces for the recipe weights', () => {
    expect(formatWeight(20, 'g')).toBe('20 g');
    expect(formatWeight(310, 'g')).toBe('310 g');
    expect(formatWeight(20, 'oz')).toBe('0.7 oz');
    expect(formatWeight(40, 'oz')).toBe('1.4 oz');
    expect(formatWeight(220, 'oz')).toBe('7.8 oz');
    expect(formatWeight(310, 'oz')).toBe('10.9 oz');
  });

  it('keeps one decimal for fractional grams', () => {
    expect(formatWeight(12.5, 'g')).toBe('12.5 g');
  });
});

describe('clock and ratio', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(87)).toBe('1:27');
    expect(formatClock(87.9)).toBe('1:27');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('shows the ratio from the brief', () => {
    expect(ratioLabel(20, 310)).toBe('1:15.5');
    expect(ratioLabel(20, 320)).toBe('1:16');
  });
});

describe('stepTitle', () => {
  const base = { startSeconds: 0, tempC: null, valve: null, note: '' } as const;

  it('describes each kind, with the weight in the chosen unit', () => {
    expect(stepTitle({ ...base, kind: 'pour', targetWeightG: 220 }, 'g')).toBe('Pour to 220 g');
    expect(stepTitle({ ...base, kind: 'pour', targetWeightG: 220 }, 'oz')).toBe('Pour to 7.8 oz');
    expect(stepTitle({ ...base, kind: 'pause', targetWeightG: 220 }, 'g')).toBe('Pause at 220 g');
    expect(stepTitle({ ...base, kind: 'pause', targetWeightG: null }, 'g')).toBe('Pause');
    expect(stepTitle({ ...base, kind: 'steep', targetWeightG: null }, 'g')).toBe('Steep');
    expect(stepTitle({ ...base, kind: 'drawdown', targetWeightG: null }, 'g')).toBe('Drawdown');
  });
});
