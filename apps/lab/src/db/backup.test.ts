import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBackup, type BrewFields, type RoastBatchFields } from '@sulong/core';
import { LabDb } from './db';
import { applyImport, exportBackup, previewImport, readLocalTables } from './backup';
import { deleteBrew, saveBrew } from './brews';
import { deleteRoastBatch, saveRoastBatch } from './roastBatches';
import { seedIfFirstRun } from './seed';

let mac: LabDb;
let phone: LabDb;

beforeEach(async () => {
  const suffix = Math.random().toString(36).slice(2);
  mac = new LabDb(`test-mac-${suffix}`);
  phone = new LabDb(`test-phone-${suffix}`);
  await seedIfFirstRun(mac);
  await seedIfFirstRun(phone);
});

afterEach(async () => {
  await mac.delete();
  await phone.delete();
});

const batchFields: RoastBatchFields = {
  coffeeId: 'coffee-peru-gesha-dry',
  roastDate: '2026-11-01',
  profileName: null,
  roastLevel: 'light',
  greenWeightG: 200,
  roastedWeightG: 170,
  notes: '',
};

const brewFields = (roastBatchId: string): BrewFields => ({
  recipeVersionId: 'rv-sulong-pour-1',
  roastBatchId,
  brewDate: '2026-11-09',
  doseG: 20,
  yieldG: 310,
  brewSeconds: 190,
  waterTempC: 91,
  grindClicks: null,
  tdsPercent: 1.41,
  rating: 4,
  attributeRatings: {},
  tags: [],
  notes: '',
});

/** Export from one database and read it back the way the import screen does. */
async function transfer(from: LabDb) {
  const text = JSON.stringify(await exportBackup(from));
  const parsed = parseBackup(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.backup.tables;
}

describe('export then import', () => {
  it('moves a roast batch and a brew from the Mac to the phone', async () => {
    const batch = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    const brew = await saveBrew(
      mac,
      brewFields(batch.id),
      undefined,
      new Date('2026-11-09T11:00:00Z'),
    );

    const merge = await applyImport(phone, await transfer(mac));

    expect(merge.totals.added).toBe(2);
    expect((await phone.roastBatches.get(batch.id))?.id).toBe(batch.id);
    expect(await phone.brews.get(brew.id)).toEqual(brew);
  });

  it('keeps the TDS source, so a demo reading stays marked as demo on the other device', async () => {
    const batch = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    const brew = await saveBrew(
      mac,
      { ...brewFields(batch.id), tdsSource: 'demo' },
      undefined,
      new Date('2026-11-09T11:00:00Z'),
    );

    await applyImport(phone, await transfer(mac));

    expect((await phone.brews.get(brew.id))?.tdsSource).toBe('demo');
  });

  it('the seeds on both devices do not duplicate', async () => {
    const merge = await applyImport(phone, await transfer(mac));
    expect(merge.totals.added).toBe(0);
    expect(await phone.coffees.count()).toBe(6);
    expect(await phone.recipes.count()).toBe(5);
  });

  it('importing the same file twice changes nothing the second time', async () => {
    const batch = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    const tables = await transfer(mac);
    await applyImport(phone, tables);
    const before = await readLocalTables(phone);
    const second = await applyImport(phone, tables);
    expect(second.totals.added + second.totals.updated).toBe(0);
    expect(await readLocalTables(phone)).toEqual(before);
    expect((await phone.roastBatches.get(batch.id))?.id).toBe(batch.id);
  });
});

describe('newest wins across devices', () => {
  it('an edit on the Mac replaces the older copy on the phone', async () => {
    const batch = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    await applyImport(phone, await transfer(mac));

    await saveRoastBatch(
      mac,
      { ...batchFields, roastedWeightG: 168 },
      batch,
      new Date('2026-11-10T10:00:00Z'),
    );
    const merge = await applyImport(phone, await transfer(mac));

    expect(merge.summary.roastBatches.updated).toBe(1);
    expect((await phone.roastBatches.get(batch.id))?.roastedWeightG).toBe(168);
  });

  it('an older backup never overwrites a newer edit on this device', async () => {
    const batch = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    await applyImport(phone, await transfer(mac));
    const oldBackup = await transfer(mac);

    // The phone edits it later.
    const onPhone = (await phone.roastBatches.get(batch.id))!;
    await saveRoastBatch(
      phone,
      { ...batchFields, notes: 'edited on phone' },
      onPhone,
      new Date('2026-11-11T10:00:00Z'),
    );

    const merge = await applyImport(phone, oldBackup);
    expect(merge.totals.updated).toBe(0);
    expect((await phone.roastBatches.get(batch.id))?.notes).toBe('edited on phone');
  });

  it('a deletion on the Mac reaches the phone and stays deleted', async () => {
    const batch = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    await applyImport(phone, await transfer(mac));

    await deleteRoastBatch(mac, batch, new Date('2026-11-10T10:00:00Z'));
    await applyImport(phone, await transfer(mac));
    expect((await phone.roastBatches.get(batch.id))?.deletedAt).toBe('2026-11-10T10:00:00.000Z');

    // Importing the old state back from the phone does not resurrect it on the Mac.
    const back = await applyImport(mac, await transfer(phone));
    expect(back.totals.updated).toBe(0);
    expect((await mac.roastBatches.get(batch.id))?.deletedAt).toBeTruthy();
  });

  it('merges records made independently on both devices', async () => {
    const onMac = await saveRoastBatch(
      mac,
      batchFields,
      undefined,
      new Date('2026-11-09T10:00:00Z'),
    );
    const onPhone = await saveRoastBatch(
      phone,
      { ...batchFields, roastDate: '2026-11-03' },
      undefined,
      new Date('2026-11-09T12:00:00Z'),
    );
    const brewOnPhone = await saveBrew(
      phone,
      brewFields(onPhone.id),
      undefined,
      new Date('2026-11-09T13:00:00Z'),
    );
    await deleteBrew(phone, brewOnPhone, new Date('2026-11-09T14:00:00Z'));

    await applyImport(phone, await transfer(mac));
    await applyImport(mac, await transfer(phone));

    for (const db of [mac, phone]) {
      expect(await db.roastBatches.count()).toBe(2);
      expect((await db.brews.get(brewOnPhone.id))?.deletedAt).toBeTruthy();
    }
    expect(await readLocalTables(mac)).toEqual(await readLocalTables(phone));
    expect((await mac.roastBatches.get(onMac.id))?.id).toBe(onMac.id);
  });
});

describe('previewImport', () => {
  it('reports what would change and writes nothing', async () => {
    await saveRoastBatch(mac, batchFields, undefined, new Date('2026-11-09T10:00:00Z'));
    const tables = await transfer(mac);

    const preview = await previewImport(phone, tables);
    expect(preview.summary.roastBatches.added).toBe(1);
    expect(await phone.roastBatches.count()).toBe(0);
  });
});
