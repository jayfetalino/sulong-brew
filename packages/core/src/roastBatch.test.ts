import { describe, expect, it } from 'vitest';
import { parseRoastBatchForm, summarizeRoastBatch, type RoastBatchForm } from './roastBatch';

const valid: RoastBatchForm = {
  coffeeId: 'coffee-peru-gesha-dry',
  roastDate: '2026-11-01',
  profileName: ' Gesha light ',
  roastLevel: 'light',
  greenWeightG: '200',
  roastedWeightG: '170',
  notes: '  smooth  ',
};

describe('parseRoastBatchForm', () => {
  it('accepts a complete form and tidies the text', () => {
    const result = parseRoastBatchForm(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        coffeeId: 'coffee-peru-gesha-dry',
        roastDate: '2026-11-01',
        profileName: 'Gesha light',
        roastLevel: 'light',
        greenWeightG: 200,
        roastedWeightG: 170,
        notes: 'smooth',
      },
    });
  });

  it('keeps empty weights and profile as null (unknown)', () => {
    const result = parseRoastBatchForm({
      ...valid,
      profileName: '',
      greenWeightG: '',
      roastedWeightG: '',
    });
    expect(result.ok && result.value.profileName).toBeNull();
    expect(result.ok && result.value.greenWeightG).toBeNull();
    expect(result.ok && result.value.roastedWeightG).toBeNull();
  });

  it('requires coffee, date and roast level', () => {
    const result = parseRoastBatchForm({ ...valid, coffeeId: '', roastDate: '', roastLevel: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(['coffeeId', 'roastDate', 'roastLevel']);
    }
  });

  it('rejects an impossible date', () => {
    const result = parseRoastBatchForm({ ...valid, roastDate: '2026-13-40' });
    expect(result.ok).toBe(false);
  });

  it('rejects zero, negative or non-numeric weights', () => {
    for (const bad of ['0', '-5', 'abc']) {
      const result = parseRoastBatchForm({ ...valid, greenWeightG: bad });
      expect(result.ok).toBe(false);
    }
  });

  it('rejects a roasted weight above the green weight', () => {
    const result = parseRoastBatchForm({ ...valid, roastedWeightG: '250' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.roastedWeightG).toMatch(/more than green/);
  });

  it('accepts a roasted weight with no green weight', () => {
    const result = parseRoastBatchForm({ ...valid, greenWeightG: '' });
    expect(result.ok).toBe(true);
  });
});

describe('summarizeRoastBatch', () => {
  it('computes weight loss and days off roast', () => {
    const s = summarizeRoastBatch(
      { roastDate: '2026-11-01', greenWeightG: 200, roastedWeightG: 170 },
      '2026-11-09',
    );
    expect(s.weightLossPercent).toBeCloseTo(15, 10);
    expect(s.daysOffRoast).toBe(8);
  });

  it('leaves weight loss empty until both weights are known', () => {
    expect(
      summarizeRoastBatch(
        { roastDate: '2026-11-01', greenWeightG: 200, roastedWeightG: null },
        '2026-11-09',
      ).weightLossPercent,
    ).toBeNull();
    expect(
      summarizeRoastBatch(
        { roastDate: '2026-11-01', greenWeightG: null, roastedWeightG: 170 },
        '2026-11-09',
      ).weightLossPercent,
    ).toBeNull();
  });
});
