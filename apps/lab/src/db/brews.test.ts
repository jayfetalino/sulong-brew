import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewFields } from '@sulong/core';
import { LabDb } from './db';
import { deleteBrew, saveBrew } from './brews';

let db: LabDb;

beforeEach(() => {
  db = new LabDb(`test-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

const fields: BrewFields = {
  recipeVersionId: 'rv-sulong-pour-1',
  roastBatchId: 'batch-1',
  brewDate: '2026-11-09',
  doseG: 20,
  yieldG: 310,
  brewSeconds: 190,
  waterTempC: 91,
  grindClicks: null,
  tdsPercent: 1.41,
  rating: 4,
  attributeRatings: { sweetness: 4 },
  tags: ['jasmine'],
  notes: '',
};

describe('saveBrew', () => {
  it('creates a brew that points at a recipe version and a roast batch', async () => {
    const saved = await saveBrew(db, fields, undefined, new Date('2026-11-09T12:00:00Z'));
    const stored = await db.brews.get(saved.id);
    expect(stored?.recipeVersionId).toBe('rv-sulong-pour-1');
    expect(stored?.roastBatchId).toBe('batch-1');
    expect(stored?.attributeRatings).toEqual({ sweetness: 4 });
    expect(stored?.createdAt).toBe('2026-11-09T12:00:00.000Z');
  });

  it('edits in place: same id and createdAt, newer updatedAt', async () => {
    const first = await saveBrew(db, fields, undefined, new Date('2026-11-09T12:00:00Z'));
    const edited = await saveBrew(
      db,
      { ...fields, rating: 4.5 },
      first,
      new Date('2026-11-10T08:00:00Z'),
    );
    expect(edited.id).toBe(first.id);
    expect(edited.createdAt).toBe(first.createdAt);
    expect(edited.updatedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(await db.brews.count()).toBe(1);
  });
});

describe('deleteBrew', () => {
  it('marks the brew deleted but keeps the record', async () => {
    const saved = await saveBrew(db, fields, undefined, new Date('2026-11-09T12:00:00Z'));
    await deleteBrew(db, saved, new Date('2026-11-10T08:00:00Z'));
    const stored = await db.brews.get(saved.id);
    expect(stored?.deletedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(await db.brews.count()).toBe(1);
  });
});
