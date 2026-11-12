import { markDeleted, type Brew, type BrewFields } from '@sulong/core';
import type { LabDb } from './db';

/**
 * Creates a new brew, or updates an existing one.
 * Editing keeps the id and createdAt and moves updatedAt forward.
 */
export async function saveBrew(
  db: LabDb,
  fields: BrewFields,
  existing?: Brew,
  now: Date = new Date(),
): Promise<Brew> {
  const stamp = now.toISOString();
  const brew: Brew = existing
    ? { ...existing, ...fields, updatedAt: stamp }
    : { ...fields, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp };
  await db.brews.put(brew);
  return brew;
}

/** Hides a brew by marking it deleted (ADR-006). */
export async function deleteBrew(db: LabDb, brew: Brew, now: Date = new Date()): Promise<void> {
  await db.brews.put(markDeleted(brew, now));
}
