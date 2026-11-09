import type { BaseRecord } from './types';

export interface MergeResult<T extends BaseRecord> {
  /** The merged list: every id from both sides, newest version of each. */
  records: T[];
  /** ids that exist only in the incoming data. */
  added: string[];
  /** ids where the incoming copy was newer and replaced the local one. */
  updated: string[];
  /** ids where the local copy was kept (newer or equal). */
  kept: string[];
}

function time(record: BaseRecord): number {
  const ms = Date.parse(record.updatedAt);
  if (Number.isNaN(ms)) throw new RangeError(`Record ${record.id} has a bad updatedAt`);
  return ms;
}

/**
 * Merges two lists of records by id. The newest updatedAt wins.
 * On a tie the local copy stays. Neither input is changed.
 * Note: there are no delete markers yet, so a record removed on one device
 * will come back if the other device still has it.
 */
export function mergeRecords<T extends BaseRecord>(local: T[], incoming: T[]): MergeResult<T> {
  const byId = new Map<string, T>();
  for (const record of local) byId.set(record.id, record);

  const added: string[] = [];
  const updated: string[] = [];
  const kept: string[] = [];

  for (const record of incoming) {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
      added.push(record.id);
    } else if (time(record) > time(existing)) {
      byId.set(record.id, record);
      updated.push(record.id);
    } else {
      kept.push(record.id);
    }
  }

  return { records: [...byId.values()], added, updated, kept };
}
