import { markDeleted, type RoastBatch, type RoastBatchFields } from '@sulong/core';
import type { LabDb } from './db';

/**
 * Creates a new roast batch, or updates an existing one.
 * Editing keeps the id and createdAt and moves updatedAt forward,
 * which is what lets merge-import pick the newest copy later.
 */
export async function saveRoastBatch(
  db: LabDb,
  fields: RoastBatchFields,
  existing?: RoastBatch,
  now: Date = new Date(),
): Promise<RoastBatch> {
  const stamp = now.toISOString();
  const batch: RoastBatch = existing
    ? { ...existing, ...fields, updatedAt: stamp }
    : { ...fields, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp };
  await db.roastBatches.put(batch);
  return batch;
}

/**
 * Hides a batch everywhere by marking it deleted. The record itself stays,
 * so the deletion can merge to other devices.
 */
export async function deleteRoastBatch(
  db: LabDb,
  batch: RoastBatch,
  now: Date = new Date(),
): Promise<void> {
  await db.roastBatches.put(markDeleted(batch, now));
}
