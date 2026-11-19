import { describe, expect, it } from 'vitest';
import type { Brew, Coffee, RecipeVersion, RoastBatch } from '@sulong/core';
import {
  MAX_COMPARE,
  buildComparison,
  onlyDifferences,
  toggleSelection,
  type CompareItem,
} from './compareFlow';

const EM_DASH = String.fromCharCode(0x2014);
const stamp = '2026-11-18T10:00:00.000Z';

const coffee = (over: Partial<Coffee> = {}): Coffee => ({
  id: 'c1',
  name: 'Peru Gesha washed',
  roastLevel: 'light',
  espressoPrimary: false,
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});

const batch = (over: Partial<RoastBatch> = {}): RoastBatch => ({
  id: 'b1',
  coffeeId: 'c1',
  roastDate: '2026-11-01',
  profileName: 'Light 1',
  roastLevel: 'light',
  greenWeightG: 200,
  roastedWeightG: 170,
  notes: '',
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});

const version = (over: Partial<RecipeVersion> = {}): RecipeVersion => ({
  id: 'v1',
  recipeId: 'r1',
  versionNumber: 1,
  doseG: 20,
  waterG: 310,
  waterTempC: 91,
  grindClicks: 20,
  grindDescription: 'medium-fine',
  finishSecondsMin: null,
  finishSecondsMax: null,
  notes: '',
  steps: [],
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});

const brew = (over: Partial<Brew> = {}): Brew => ({
  id: 'x1',
  recipeVersionId: 'v1',
  roastBatchId: 'b1',
  brewDate: '2026-11-09',
  doseG: 20,
  yieldG: 310,
  brewSeconds: 195,
  waterTempC: 91,
  grindClicks: 20,
  tdsPercent: 1.41,
  rating: 4,
  attributeRatings: {},
  tags: [],
  notes: '',
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
});

const item = (b: Partial<Brew> = {}, extra: Partial<CompareItem> = {}): CompareItem => ({
  brew: brew(b),
  version: version(),
  recipeName: 'The Sulong Pour',
  batch: batch(),
  coffee: coffee(),
  ...extra,
});

const find = (items: CompareItem[], rowId: string) => {
  const rows = buildComparison(items).groups.flatMap((g) => g.rows);
  const found = rows.find((r) => r.id === rowId);
  if (!found) throw new Error(`no row ${rowId}`);
  return found;
};

describe('buildComparison: columns and groups', () => {
  it('has one column per brew with the coffee name and brew date', () => {
    const c = buildComparison([
      item({ id: 'a', brewDate: '2026-11-09' }),
      item({ id: 'b', brewDate: '2026-11-12' }, { coffee: coffee({ name: 'Rwanda Rulindo' }) }),
    ]);
    expect(c.columns).toEqual([
      { brewId: 'a', coffeeName: 'Peru Gesha washed', brewDate: '2026-11-09' },
      { brewId: 'b', coffeeName: 'Rwanda Rulindo', brewDate: '2026-11-12' },
    ]);
  });

  it('every row has one cell per brew, for two and for three brews', () => {
    for (const n of [2, 3]) {
      const c = buildComparison(Array.from({ length: n }, (_, i) => item({ id: `b${i}` })));
      for (const g of c.groups) for (const r of g.rows) expect(r.cells).toHaveLength(n);
    }
  });

  it('groups the rows as Brew, How it was made, In the cup and Notes', () => {
    const c = buildComparison([item(), item()]);
    expect(c.groups.map((g) => g.title)).toEqual([
      'Brew',
      'How it was made',
      'In the cup',
      'Notes',
    ]);
  });
});

describe('buildComparison: values', () => {
  it('shows the roast and recipe facts, with days off roast counted to each brew date', () => {
    const items = [
      item({ brewDate: '2026-11-09' }),
      item(
        { id: 'b', brewDate: '2026-11-20', recipeVersionId: 'v2' },
        {
          version: version({ id: 'v2', versionNumber: 2 }),
          batch: batch({
            id: 'b2',
            roastDate: '2026-11-10',
            roastLevel: 'medium',
            profileName: null,
          }),
        },
      ),
    ];
    expect(find(items, 'recipe').cells).toEqual(['The Sulong Pour v1', 'The Sulong Pour v2']);
    expect(find(items, 'roastDate').cells).toEqual(['2026-11-01', '2026-11-10']);
    expect(find(items, 'daysOff').cells).toEqual(['8', '10']);
    expect(find(items, 'profile').cells).toEqual(['Light 1', 'Not set']);
    expect(find(items, 'roastLevel').cells).toEqual(['Light', 'Medium']);
    expect(find(items, 'weightLoss').cells).toEqual(['15.0 %', '15.0 %']);
  });

  it('shows how it was made, including the actual brew ratio', () => {
    const items = [
      item(),
      item({ yieldG: 300, brewSeconds: 200, waterTempC: 92, grindClicks: 18 }),
    ];
    expect(find(items, 'dose').cells).toEqual(['20 g', '20 g']);
    expect(find(items, 'yield').cells).toEqual(['310 g', '300 g']);
    expect(find(items, 'ratio').cells).toEqual(['1:15.5', '1:15']);
    expect(find(items, 'time').cells).toEqual(['3:15', '3:20']);
    expect(find(items, 'temp').cells).toEqual(['91 C', '92 C']);
    expect(find(items, 'grind').cells).toEqual(['20 clicks', '18 clicks']);
  });

  it('shows TDS, extraction yield (310 g, 1.41 %, 20 g is 21.9 %) and rating', () => {
    const items = [item(), item({ tdsPercent: 1.3, rating: 3.5 })];
    expect(find(items, 'tds').cells).toEqual(['1.41 %', '1.3 %']);
    expect(find(items, 'ey').cells[0]).toBe('21.9 %');
    expect(find(items, 'rating').cells).toEqual(['4 / 5', '3.5 / 5']);
  });

  it('says "Not set" and "Not rated" instead of guessing, and does no sums on missing values', () => {
    const items = [
      item({
        yieldG: null,
        brewSeconds: null,
        waterTempC: null,
        grindClicks: null,
        tdsPercent: null,
        rating: null,
      }),
      item(),
    ];
    expect(find(items, 'yield').cells[0]).toBe('Not set');
    expect(find(items, 'ratio').cells[0]).toBe('Not set');
    expect(find(items, 'time').cells[0]).toBe('Not set');
    expect(find(items, 'temp').cells[0]).toBe('Not set');
    expect(find(items, 'grind').cells[0]).toBe('Not set');
    expect(find(items, 'tds').cells[0]).toBe('Not set');
    expect(find(items, 'ey').cells[0]).toBe('Not set');
    expect(find(items, 'rating').cells[0]).toBe('Not rated');
  });

  it('copes with records that no longer exist', () => {
    const items = [
      item({}, { version: undefined, recipeName: undefined, batch: undefined, coffee: undefined }),
      item(),
    ];
    const c = buildComparison(items);
    expect(c.columns[0]?.coffeeName).toBe('Unknown coffee');
    expect(find(items, 'recipe').cells[0]).toBe('Unknown recipe');
    expect(find(items, 'roastDate').cells[0]).toBe('Not set');
    expect(find(items, 'daysOff').cells[0]).toBe('Not set');
    expect(find(items, 'roastLevel').cells[0]).toBe('Not set');
    expect(find(items, 'weightLoss').cells[0]).toBe('Not set');
  });

  it('names a deleted recipe', () => {
    const items = [item({}, { recipeName: undefined }), item()];
    expect(find(items, 'recipe').cells[0]).toBe('Deleted recipe v1');
  });

  it('shows tags in the order saved, and notes in full', () => {
    const items = [item({ tags: ['floral', 'tea-like'], notes: 'Bright and clean.' }), item()];
    expect(find(items, 'tags').cells).toEqual(['floral · tea-like', 'None']);
    expect(find(items, 'notes').cells).toEqual(['Bright and clean.', 'None']);
  });

  it('shows cupping scores only when at least one brew has them', () => {
    const none = buildComparison([item(), item()]).groups.flatMap((g) => g.rows.map((r) => r.id));
    expect(none).not.toContain('sweetness');

    const items = [item({ attributeRatings: { sweetness: 4, body: 3 } }), item()];
    const ids = buildComparison(items).groups.flatMap((g) => g.rows.map((r) => r.id));
    expect(ids).toContain('sweetness');
    expect(ids).toContain('body');
    expect(ids).not.toContain('acidity');
    expect(find(items, 'sweetness').cells).toEqual(['4 / 5', 'Not rated']);
  });
});

describe('buildComparison: demo readings stay marked', () => {
  it('marks a demo yield on the yield and the ratio, but not on a manual one', () => {
    const items = [item({ yieldSource: 'demo' }), item({ yieldSource: 'manual' })];
    expect(find(items, 'yield').cells).toEqual(['310 g (demo)', '310 g']);
    expect(find(items, 'ratio').cells).toEqual(['1:15.5 (demo)', '1:15.5']);
  });

  it('marks a demo TDS', () => {
    const items = [item({ tdsSource: 'demo' }), item({ tdsSource: 'refractometer' }), item()];
    expect(find(items, 'tds').cells).toEqual(['1.41 % (demo)', '1.41 %', '1.41 %']);
  });

  it('marks extraction yield when either number was a demo reading', () => {
    const items = [
      item({ tdsSource: 'demo' }),
      item({ yieldSource: 'demo' }),
      item({ tdsSource: 'manual', yieldSource: 'scale' }),
    ];
    expect(find(items, 'ey').cells).toEqual(['21.9 % (demo)', '21.9 % (demo)', '21.9 %']);
  });

  it('does not mark a missing value as demo', () => {
    const items = [
      item({ tdsSource: 'demo', tdsPercent: null, yieldSource: 'demo', yieldG: null }),
      item(),
    ];
    expect(find(items, 'tds').cells[0]).toBe('Not set');
    expect(find(items, 'yield').cells[0]).toBe('Not set');
    expect(find(items, 'ey').cells[0]).toBe('Not set');
  });
});

describe('buildComparison: what differs', () => {
  it('is false when all values match, and true when any differ', () => {
    expect(find([item(), item()], 'dose').differs).toBe(false);
    expect(find([item(), item({ doseG: 18 })], 'dose').differs).toBe(true);
    expect(find([item(), item(), item({ grindClicks: 22 })], 'grind').differs).toBe(true);
  });

  it('compares the real values, not the rounded text', () => {
    const items = [item({ tdsPercent: 1.41 }), item({ tdsPercent: 1.41 })];
    expect(find(items, 'tds').differs).toBe(false);
    // 15.04 % and 14.96 % both show as 15.0 % but are not the same.
    const a = item({}, { batch: batch({ roastedWeightG: 169.92 }) });
    const b = item({}, { batch: batch({ id: 'b2', roastedWeightG: 170.08 }) });
    const row = find([a, b], 'weightLoss');
    expect(row.cells[0]).toBe(row.cells[1]);
    expect(row.differs).toBe(true);
  });

  it('treats tags as a set, so order alone is no difference', () => {
    expect(find([item({ tags: ['a', 'b'] }), item({ tags: ['b', 'a'] })], 'tags').differs).toBe(
      false,
    );
    expect(find([item({ tags: ['a'] }), item({ tags: ['a', 'b'] })], 'tags').differs).toBe(true);
  });

  it('treats a missing value and a value as different, and two missing values as the same', () => {
    expect(find([item({ rating: null }), item({ rating: 4 })], 'rating').differs).toBe(true);
    expect(find([item({ rating: null }), item({ rating: null })], 'rating').differs).toBe(false);
  });

  it('ignores whitespace around notes', () => {
    expect(find([item({ notes: ' same ' }), item({ notes: 'same' })], 'notes').differs).toBe(false);
  });

  it('differs when only the roast batch differs, which is what this view is for', () => {
    const items = [
      item(),
      item({ id: 'b' }, { batch: batch({ id: 'b2', roastDate: '2026-10-20' }) }),
    ];
    expect(find(items, 'roastDate').differs).toBe(true);
    expect(find(items, 'daysOff').differs).toBe(true);
    expect(find(items, 'dose').differs).toBe(false);
  });
});

describe('onlyDifferences', () => {
  it('keeps differing rows and drops groups that end up empty', () => {
    const c = buildComparison([item(), item({ grindClicks: 22, rating: 3 })]);
    const filtered = onlyDifferences(c.groups);
    const rows = filtered.flatMap((g) => g.rows.map((r) => r.id));
    expect(rows.sort()).toEqual(['grind', 'rating']);
    expect(filtered.map((g) => g.id)).toEqual(['made', 'cup']);
  });

  it('returns nothing when the brews are identical', () => {
    expect(onlyDifferences(buildComparison([item(), item()]).groups)).toEqual([]);
  });
});

describe('toggleSelection', () => {
  it('adds a brew, in the order ticked', () => {
    let s = toggleSelection([], 'a');
    s = toggleSelection(s.ids, 'b');
    expect(s).toEqual({ ids: ['a', 'b'], refused: false });
  });

  it('unticks a brew that is already ticked', () => {
    expect(toggleSelection(['a', 'b'], 'a')).toEqual({ ids: ['b'], refused: false });
  });

  it('refuses a fourth brew and leaves the selection as it was', () => {
    expect(MAX_COMPARE).toBe(3);
    const r = toggleSelection(['a', 'b', 'c'], 'd');
    expect(r).toEqual({ ids: ['a', 'b', 'c'], refused: true });
  });

  it('still lets a brew be unticked when the limit is reached', () => {
    expect(toggleSelection(['a', 'b', 'c'], 'b')).toEqual({ ids: ['a', 'c'], refused: false });
  });

  it('does not change the list it was given', () => {
    const ids = ['a'];
    toggleSelection(ids, 'b');
    expect(ids).toEqual(['a']);
  });
});

describe('text', () => {
  it('uses no em-dashes anywhere a person reads', () => {
    const c = buildComparison([
      item({ tags: ['x'], notes: 'n', attributeRatings: { sweetness: 4 } }),
      item({ yieldG: null, tdsPercent: null, rating: null }, { batch: undefined }),
    ]);
    expect(JSON.stringify(c)).not.toContain(EM_DASH);
  });
});
