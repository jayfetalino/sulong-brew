import {
  createBackup,
  mergeBackup,
  type BackupFile,
  type BackupMerge,
  type BackupTables,
} from '@sulong/core';
import type { LabDb } from './db';

/** Everything stored on this device, including deleted records. */
export async function readLocalTables(db: LabDb): Promise<BackupTables> {
  const [coffees, roastBatches, recipes, recipeVersions, brews] = await Promise.all([
    db.coffees.toArray(),
    db.roastBatches.toArray(),
    db.recipes.toArray(),
    db.recipeVersions.toArray(),
    db.brews.toArray(),
  ]);
  return { coffees, roastBatches, recipes, recipeVersions, brews };
}

export async function exportBackup(db: LabDb, now: Date = new Date()): Promise<BackupFile> {
  return createBackup(await readLocalTables(db), now);
}

/** Works out what importing this backup would change. Writes nothing. */
export async function previewImport(db: LabDb, incoming: BackupTables): Promise<BackupMerge> {
  return mergeBackup(await readLocalTables(db), incoming);
}

/**
 * Imports a backup: new records are added and newer copies replace older ones.
 * Everything is written in one transaction, so it either all happens or none of it does.
 * The merge is worked out inside the transaction, so it uses the data as it is at that moment.
 */
export async function applyImport(db: LabDb, incoming: BackupTables): Promise<BackupMerge> {
  return db.transaction(
    'rw',
    [db.coffees, db.roastBatches, db.recipes, db.recipeVersions, db.brews],
    async () => {
      const merge = mergeBackup(await readLocalTables(db), incoming);
      await db.coffees.bulkPut(merge.toWrite.coffees);
      await db.roastBatches.bulkPut(merge.toWrite.roastBatches);
      await db.recipes.bulkPut(merge.toWrite.recipes);
      await db.recipeVersions.bulkPut(merge.toWrite.recipeVersions);
      await db.brews.bulkPut(merge.toWrite.brews);
      return merge;
    },
  );
}
