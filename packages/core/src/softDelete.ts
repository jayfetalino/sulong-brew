import type { BaseRecord } from './types';

/** True if the record has been deleted. Deleted records are hidden from every list. */
export function isDeleted(record: BaseRecord): boolean {
  return record.deletedAt != null;
}

/**
 * Returns a copy marked as deleted. updatedAt moves forward too, so a merge
 * sees the deletion as the newest change and carries it to other devices.
 */
export function markDeleted<T extends BaseRecord>(record: T, now: Date = new Date()): T {
  const stamp = now.toISOString();
  return { ...record, deletedAt: stamp, updatedAt: stamp };
}
