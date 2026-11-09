import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RoastBatchFields } from '@sulong/core';
import { LabDb } from './db';
import { deleteRoastBatch, saveRoastBatch } from './roastBatches';

let db: LabDb;

beforeEach(() => {
  db = new LabDb(`test-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

const fields: RoastBatchFields = {
  coffeeId: 'coffee-peru-gesha-dry',
  roastDate: '2026-11-01',
  profileName: null,
  roastLevel: 'light',
  greenWeightG: 200,
  roastedWeightG: 170,
  notes: '',
};

describe('saveRoastBatch', () => {
  it('creates a batch with an id and matching timestamps', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    const saved = await saveRoastBatch(db, fields, undefined, now);
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.createdAt).toBe('2026-11-09T12:00:00.000Z');
    expect(saved.updatedAt).toBe(saved.createdAt);
    expect(await db.roastBatches.get(saved.id)).toEqual(saved);
  });

  it('edits in place: same id and createdAt, newer updatedAt', async () => {
    const first = await saveRoastBatch(db, fields, undefined, new Date('2026-11-09T12:00:00Z'));
    const edited = await saveRoastBatch(
      db,
      { ...fields, roastedWeightG: 168 },
      first,
      new Date('2026-11-10T08:00:00Z'),
    );
    expect(edited.id).toBe(first.id);
    expect(edited.createdAt).toBe(first.createdAt);
    expect(edited.updatedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(await db.roastBatches.count()).toBe(1);
    expect((await db.roastBatches.get(first.id))?.roastedWeightG).toBe(168);
  });
});

describe('deleteRoastBatch', () => {
  it('keeps the record but marks it deleted with a newer updatedAt', async () => {
    const saved = await saveRoastBatch(db, fields, undefined, new Date('2026-11-09T12:00:00Z'));
    await deleteRoastBatch(db, saved, new Date('2026-11-10T08:00:00Z'));
    const stored = await db.roastBatches.get(saved.id);
    expect(stored?.deletedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(stored?.updatedAt).toBe('2026-11-10T08:00:00.000Z');
    expect(await db.roastBatches.count()).toBe(1);
  });
});
