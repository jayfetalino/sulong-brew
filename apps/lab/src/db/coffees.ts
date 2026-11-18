import { isDeleted, markDeleted, type Coffee, type CoffeeFields } from '@sulong/core';
import type { LabDb } from './db';

/**
 * Creates a new coffee, or updates an existing one.
 * Editing keeps the id and createdAt and moves updatedAt forward,
 * so merge-import can pick the newest copy later.
 */
export async function saveCoffee(
  db: LabDb,
  fields: CoffeeFields,
  existing?: Coffee,
  now: Date = new Date(),
): Promise<Coffee> {
  const stamp = now.toISOString();
  const coffee: Coffee = existing
    ? { ...existing, ...fields, updatedAt: stamp }
    : { ...fields, id: crypto.randomUUID(), createdAt: stamp, updatedAt: stamp };
  await db.coffees.put(coffee);
  return coffee;
}

/** How many roast batches (not deleted) use this coffee. */
export async function countBatchesUsing(db: LabDb, coffeeId: string): Promise<number> {
  return db.roastBatches
    .where('coffeeId')
    .equals(coffeeId)
    .filter((b) => !isDeleted(b))
    .count();
}

export type DeleteCoffeeResult = { ok: true } | { ok: false; batchCount: number };

/**
 * Hides a coffee by marking it deleted. A coffee that roast batches still use is kept, because
 * deleting it would leave those batches and their brews without a name. Delete or move the
 * batches first.
 */
export async function deleteCoffee(
  db: LabDb,
  coffee: Coffee,
  now: Date = new Date(),
): Promise<DeleteCoffeeResult> {
  const batchCount = await countBatchesUsing(db, coffee.id);
  if (batchCount > 0) return { ok: false, batchCount };
  await db.coffees.put(markDeleted(coffee, now));
  return { ok: true };
}
