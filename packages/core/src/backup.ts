import { isValidDay } from './math';
import { mergeRecords } from './merge';
import {
  TDS_SOURCES,
  type Brew,
  type Coffee,
  type Recipe,
  type RecipeVersion,
  type RoastBatch,
  type TdsSource,
} from './types';

export const BACKUP_APP = 'sulong-brew-lab';
export const BACKUP_FORMAT_VERSION = 1;

export const BACKUP_TABLES = [
  'coffees',
  'roastBatches',
  'recipes',
  'recipeVersions',
  'brews',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

/** Every kind of record the lab stores. Deleted records are included, so deletions travel too. */
export interface BackupTables {
  coffees: Coffee[];
  roastBatches: RoastBatch[];
  recipes: Recipe[];
  recipeVersions: RecipeVersion[];
  brews: Brew[];
}

export interface BackupFile {
  app: typeof BACKUP_APP;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  exportedAt: string;
  tables: BackupTables;
}

export function emptyTables(): BackupTables {
  return { coffees: [], roastBatches: [], recipes: [], recipeVersions: [], brews: [] };
}

export function createBackup(tables: BackupTables, now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    tables,
  };
}

// ---------------------------------------------------------------------------
// Reading a file. A file from outside is untrusted, so every record is checked
// and a single bad record rejects the whole file (nothing is half imported).
// ---------------------------------------------------------------------------

export type ParseBackupResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

type Obj = Record<string, unknown>;

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isTime = (v: unknown): boolean => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** Returns a problem description, or null if the record is fine. */
function checkRecord(table: BackupTableName, r: Obj): string | null {
  if (!isText(r.id)) return 'missing id';
  if (!isTime(r.createdAt)) return 'missing or unreadable createdAt';
  if (!isTime(r.updatedAt)) return 'missing or unreadable updatedAt';
  if (r.deletedAt !== undefined && r.deletedAt !== null && !isTime(r.deletedAt)) {
    return 'unreadable deletedAt';
  }
  switch (table) {
    case 'coffees':
      return isText(r.name) ? null : 'missing name';
    case 'roastBatches':
      if (!isText(r.coffeeId)) return 'missing coffeeId';
      return typeof r.roastDate === 'string' && isValidDay(r.roastDate)
        ? null
        : 'missing or unreadable roastDate';
    case 'recipes':
      return isText(r.name) ? null : 'missing name';
    case 'recipeVersions':
      if (!isText(r.recipeId)) return 'missing recipeId';
      if (typeof r.versionNumber !== 'number') return 'missing versionNumber';
      return Array.isArray(r.steps) ? null : 'missing steps';
    case 'brews':
      if (!isText(r.recipeVersionId)) return 'missing recipeVersionId';
      if (!isText(r.roastBatchId)) return 'missing roastBatchId';
      // Brews saved before the field existed have no tdsSource, which is fine.
      if (
        r.tdsSource !== undefined &&
        r.tdsSource !== null &&
        !TDS_SOURCES.includes(r.tdsSource as TdsSource)
      ) {
        return 'unreadable tdsSource';
      }
      return typeof r.brewDate === 'string' && isValidDay(r.brewDate)
        ? null
        : 'missing or unreadable brewDate';
  }
}

export function parseBackup(text: string): ParseBackupResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObject(data) || data.app !== BACKUP_APP) {
    return { ok: false, error: 'This is not a Sulong Brew Lab backup file.' };
  }
  if (typeof data.formatVersion !== 'number' || data.formatVersion < 1) {
    return { ok: false, error: 'This backup has no readable format version.' };
  }
  if (data.formatVersion > BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error: 'This backup was made by a newer version of the app. Update the app and try again.',
    };
  }
  if (!isObject(data.tables)) return { ok: false, error: 'This backup has no data tables.' };

  const tables = emptyTables();
  for (const name of BACKUP_TABLES) {
    const raw = data.tables[name];
    if (raw === undefined) continue; // A missing table just means nothing to import for it.
    if (!Array.isArray(raw)) return { ok: false, error: `"${name}" must be a list.` };
    const seenIds = new Set<string>();
    for (let i = 0; i < raw.length; i++) {
      const record: unknown = raw[i];
      const problem = isObject(record) ? checkRecord(name, record) : 'not an object';
      if (problem) return { ok: false, error: `${name} record ${i + 1}: ${problem}.` };
      const id = (record as Obj).id as string;
      if (seenIds.has(id)) return { ok: false, error: `${name} record ${i + 1}: repeated id.` };
      seenIds.add(id);
    }
    (tables[name] as unknown[]) = raw;
  }

  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: isTime(data.exportedAt) ? (data.exportedAt as string) : '',
      tables,
    },
  };
}

// ---------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------

export interface TableMergeSummary {
  added: number;
  updated: number;
  kept: number;
}

export interface BackupMerge {
  /** Only the records that need writing: new ones, and ones where the incoming copy is newer. */
  toWrite: BackupTables;
  summary: Record<BackupTableName, TableMergeSummary>;
  totals: TableMergeSummary;
}

/**
 * Compares the incoming backup with what is stored now, table by table.
 * The newest updatedAt wins; on a tie the stored copy stays (see mergeRecords).
 * Nothing is changed here: this only works out what would change.
 */
export function mergeBackup(local: BackupTables, incoming: BackupTables): BackupMerge {
  const toWrite = emptyTables();
  const summary = {} as Record<BackupTableName, TableMergeSummary>;
  const totals: TableMergeSummary = { added: 0, updated: 0, kept: 0 };

  for (const name of BACKUP_TABLES) {
    const result = mergeRecords(
      local[name] as { id: string; createdAt: string; updatedAt: string }[],
      incoming[name] as { id: string; createdAt: string; updatedAt: string }[],
    );
    const changed = new Set([...result.added, ...result.updated]);
    (toWrite[name] as unknown[]) = result.records.filter((r) => changed.has(r.id));
    summary[name] = {
      added: result.added.length,
      updated: result.updated.length,
      kept: result.kept.length,
    };
    totals.added += result.added.length;
    totals.updated += result.updated.length;
    totals.kept += result.kept.length;
  }

  return { toWrite, summary, totals };
}
