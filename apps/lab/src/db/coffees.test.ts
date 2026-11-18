import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isDeleted, type CoffeeFields } from '@sulong/core';
import { LabDb } from './db';
import { countBatchesUsing, deleteCoffee, saveCoffee } from './coffees';
import { deleteRoastBatch, saveRoastBatch } from './roastBatches';

let db: LabDb;

beforeEach(() => {
  db = new LabDb(`test-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

const fields: CoffeeFields = {
  name: 'Kenya Kiambu AA',
  roastLevel: 'light',
  espressoPrimary: false,
};

const batchFor = (coffeeId: string) => ({
  coffeeId,
  roastDate: '2026-11-01',
  profileName: null,
  roastLevel: 'light' as const,
  greenWeightG: 200,
  roastedWeightG: 170,
  notes: '',
});

describe('saveCoffee', () => {
  it('creates a coffee with an id and equal createdAt and updatedAt', async () => {
    const now = new Date('2026-11-18T10:00:00Z');
    const coffee = await saveCoffee(db, fields, undefined, now);
    expect(coffee).toMatchObject({
      ...fields,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    expect(coffee.id).toBeTruthy();
    expect(await db.coffees.get(coffee.id)).toEqual(coffee);
  });

  it('gives each new coffee its own id', async () => {
    const a = await saveCoffee(db, fields);
    const b = await saveCoffee(db, { ...fields, name: 'Other' });
    expect(a.id).not.toBe(b.id);
  });

  it('editing keeps id and createdAt, and moves updatedAt forward', async () => {
    const created = await saveCoffee(db, fields, undefined, new Date('2026-11-18T10:00:00Z'));
    const edited = await saveCoffee(
      db,
      { ...fields, name: 'Kenya Kiambu AA Washed', espressoPrimary: true },
      created,
      new Date('2026-11-19T10:00:00Z'),
    );
    expect(edited.id).toBe(created.id);
    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.updatedAt).toBe('2026-11-19T10:00:00.000Z');
    expect(edited).toMatchObject({ name: 'Kenya Kiambu AA Washed', espressoPrimary: true });
    expect(await db.coffees.count()).toBe(1);
  });
});

describe('deleteCoffee', () => {
  it('marks an unused coffee deleted and moves updatedAt forward, keeping the record', async () => {
    const coffee = await saveCoffee(db, fields, undefined, new Date('2026-11-18T10:00:00Z'));
    const result = await deleteCoffee(db, coffee, new Date('2026-11-19T10:00:00Z'));
    expect(result).toEqual({ ok: true });
    const stored = await db.coffees.get(coffee.id);
    expect(stored && isDeleted(stored)).toBe(true);
    expect(stored?.updatedAt).toBe('2026-11-19T10:00:00.000Z');
  });

  it('refuses to delete a coffee that roast batches use, and says how many', async () => {
    const coffee = await saveCoffee(db, fields);
    await saveRoastBatch(db, batchFor(coffee.id));
    await saveRoastBatch(db, batchFor(coffee.id));
    expect(await deleteCoffee(db, coffee)).toEqual({ ok: false, batchCount: 2 });
    const stored = await db.coffees.get(coffee.id);
    expect(stored && isDeleted(stored)).toBe(false);
  });

  it('does not count batches that are already deleted, so the coffee can then go', async () => {
    const coffee = await saveCoffee(db, fields);
    const batch = await saveRoastBatch(db, batchFor(coffee.id));
    expect(await countBatchesUsing(db, coffee.id)).toBe(1);
    await deleteRoastBatch(db, batch);
    expect(await countBatchesUsing(db, coffee.id)).toBe(0);
    expect(await deleteCoffee(db, coffee)).toEqual({ ok: true });
  });

  it('only counts batches of that coffee', async () => {
    const a = await saveCoffee(db, fields);
    const b = await saveCoffee(db, { ...fields, name: 'Other' });
    await saveRoastBatch(db, batchFor(a.id));
    expect(await countBatchesUsing(db, b.id)).toBe(0);
  });
});
