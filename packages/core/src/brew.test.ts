import { describe, expect, it } from 'vitest';
import { parseBrewForm, parseTags, summarizeBrew, type BrewForm } from './brew';
import { roundTo } from './math';

const valid: BrewForm = {
  recipeVersionId: 'rv-sulong-pour-1',
  roastBatchId: 'batch-1',
  brewDate: '2026-11-09',
  doseG: '20',
  yieldG: '310',
  brewTime: '3:10',
  waterTempC: '91',
  grindClicks: '24',
  tdsPercent: '1.41',
  tdsSource: '',
  rating: '4.5',
  attributeRatings: { sweetness: '4', acidity: '3.5', body: '' },
  tags: 'Jasmine, bright',
  notes: '  clean finish ',
};

describe('parseTags', () => {
  it('trims, lowercases and removes repeats', () => {
    expect(parseTags(' Jasmine, bright ,jasmine,, ')).toEqual(['jasmine', 'bright']);
  });

  it('is empty for empty text', () => {
    expect(parseTags('')).toEqual([]);
  });
});

describe('parseBrewForm', () => {
  it('accepts a complete form and tidies it', () => {
    const result = parseBrewForm(valid);
    expect(result).toEqual({
      ok: true,
      value: {
        recipeVersionId: 'rv-sulong-pour-1',
        roastBatchId: 'batch-1',
        brewDate: '2026-11-09',
        doseG: 20,
        yieldG: 310,
        brewSeconds: 190,
        waterTempC: 91,
        grindClicks: 24,
        tdsPercent: 1.41,
        tdsSource: 'manual',
        rating: 4.5,
        attributeRatings: { sweetness: 4, acidity: 3.5 },
        tags: ['jasmine', 'bright'],
        notes: 'clean finish',
      },
    });
  });

  it('needs only recipe version, roast batch, date and dose', () => {
    const result = parseBrewForm({
      ...valid,
      yieldG: '',
      brewTime: '',
      waterTempC: '',
      grindClicks: '',
      tdsPercent: '',
      rating: '',
      attributeRatings: {},
      tags: '',
      notes: '',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.yieldG).toBeNull();
      expect(result.value.brewSeconds).toBeNull();
      expect(result.value.waterTempC).toBeNull();
      expect(result.value.tdsPercent).toBeNull();
      expect(result.value.rating).toBeNull();
      expect(result.value.attributeRatings).toEqual({});
    }
  });

  it('requires the links, a real date and a dose', () => {
    const result = parseBrewForm({
      ...valid,
      recipeVersionId: '',
      roastBatchId: '',
      brewDate: '2026-02-31x',
      doseG: '0',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        'brewDate',
        'doseG',
        'recipeVersionId',
        'roastBatchId',
      ]);
    }
  });

  it('rejects a bad time, TDS, weight or rating', () => {
    for (const patch of [
      { brewTime: '3:75' },
      { tdsPercent: '0' },
      { tdsPercent: '45' },
      { tdsPercent: 'abc' },
      { yieldG: '-5' },
      { rating: '6' },
      { rating: '3.3' },
    ]) {
      expect(parseBrewForm({ ...valid, ...patch }).ok).toBe(false);
    }
  });

  it('rejects an attribute score outside 1 to 5 in half steps', () => {
    const result = parseBrewForm({ ...valid, attributeRatings: { sweetness: '7' } });
    expect(result.ok).toBe(false);
  });
});

describe('parseBrewForm: where the TDS came from', () => {
  it('records a typed TDS with no source as manual', () => {
    const result = parseBrewForm({ ...valid, tdsPercent: '1.41', tdsSource: '' });
    expect(result.ok && result.value.tdsSource).toBe('manual');
  });

  it.each(['demo', 'refractometer', 'manual'] as const)('keeps the source %s', (source) => {
    const result = parseBrewForm({ ...valid, tdsSource: source });
    expect(result.ok && result.value.tdsSource).toBe(source);
  });

  it('has no source when there is no TDS, even if one was set', () => {
    const result = parseBrewForm({ ...valid, tdsPercent: '', tdsSource: 'demo' });
    expect(result.ok && result.value.tdsPercent).toBeNull();
    expect(result.ok && result.value.tdsSource).toBeNull();
  });

  it('rejects a source it does not know', () => {
    const result = parseBrewForm({
      ...valid,
      tdsSource: 'bluetooth-magic' as unknown as BrewForm['tdsSource'],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.tdsSource).toBeDefined();
  });
});

describe('summarizeBrew', () => {
  const brew = { doseG: 20, yieldG: 310, tdsPercent: 1.41, brewDate: '2026-11-09' };

  it('matches the brief: 310 g, 1.41 %, 20 g gives 21.9 %', () => {
    const s = summarizeBrew(brew, '2026-11-01');
    expect(roundTo(s.extractionYield as number, 1)).toBe(21.9);
  });

  it('counts days off roast on brew day', () => {
    expect(summarizeBrew(brew, '2026-11-01').daysOffRoast).toBe(8);
  });

  it('leaves extraction yield empty until yield and TDS are both known', () => {
    expect(summarizeBrew({ ...brew, tdsPercent: null }, '2026-11-01').extractionYield).toBeNull();
    expect(summarizeBrew({ ...brew, yieldG: null }, '2026-11-01').extractionYield).toBeNull();
  });

  it('leaves days off roast empty when the roast batch is unknown', () => {
    expect(summarizeBrew(brew, null).daysOffRoast).toBeNull();
  });
});
