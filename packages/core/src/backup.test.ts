import { describe, expect, it } from 'vitest';
import seedCoffees from '../../../data/seeds/coffees.json';
import seedRecipes from '../../../data/seeds/recipes.json';
import seedVersions from '../../../data/seeds/recipe-versions.json';
import {
  BACKUP_TABLES,
  createBackup,
  emptyTables,
  mergeBackup,
  parseBackup,
  type BackupTables,
} from './backup';
import { markDeleted } from './softDelete';
import type { Brew, Coffee, Recipe, RecipeVersion, RoastBatch } from './types';

const T1 = '2026-11-01T00:00:00.000Z';
const T2 = '2026-11-05T00:00:00.000Z';
const T3 = '2026-11-09T00:00:00.000Z';

const batch = (id: string, updatedAt: string, notes = ''): RoastBatch => ({
  id,
  createdAt: T1,
  updatedAt,
  coffeeId: 'coffee-peru-gesha-dry',
  roastDate: '2026-11-01',
  profileName: null,
  roastLevel: 'light',
  greenWeightG: 200,
  roastedWeightG: 170,
  notes,
});

const brew = (id: string, updatedAt: string): Brew => ({
  id,
  createdAt: T1,
  updatedAt,
  recipeVersionId: 'rv-sulong-pour-1',
  roastBatchId: 'b1',
  brewDate: '2026-11-09',
  doseG: 20,
  yieldG: 310,
  brewSeconds: 190,
  waterTempC: 91,
  grindClicks: null,
  tdsPercent: 1.41,
  rating: 4,
  attributeRatings: { sweetness: 4 },
  tags: ['jasmine'],
  notes: '',
});

const tables = (over: Partial<BackupTables> = {}): BackupTables => ({ ...emptyTables(), ...over });

const seeds = (): BackupTables =>
  tables({
    coffees: seedCoffees as Coffee[],
    recipes: seedRecipes as Recipe[],
    recipeVersions: seedVersions as RecipeVersion[],
  });

describe('createBackup / parseBackup', () => {
  it('round trips every table without changing any record', () => {
    const original = tables({
      ...seeds(),
      roastBatches: [batch('b1', T2, 'nutty')],
      brews: [brew('br1', T2)],
    });
    const text = JSON.stringify(createBackup(original, new Date('2026-11-10T12:00:00Z')));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.backup.tables).toEqual(original);
      expect(parsed.backup.exportedAt).toBe('2026-11-10T12:00:00.000Z');
    }
  });

  it('keeps deleted records, so deletions travel', () => {
    const gone = markDeleted(batch('b1', T1), new Date(T3));
    const parsed = parseBackup(JSON.stringify(createBackup(tables({ roastBatches: [gone] }))));
    expect(parsed.ok && parsed.backup.tables.roastBatches[0]?.deletedAt).toBe(T3);
  });

  it('treats a missing table as empty', () => {
    const text = JSON.stringify({
      app: 'sulong-brew-lab',
      formatVersion: 1,
      tables: { roastBatches: [batch('b1', T1)] },
    });
    const parsed = parseBackup(text);
    expect(parsed.ok && parsed.backup.tables.brews).toEqual([]);
    expect(parsed.ok && parsed.backup.tables.roastBatches).toHaveLength(1);
  });
});

describe('parseBackup rejects bad files', () => {
  const wrap = (t: unknown, extra: object = {}) =>
    JSON.stringify({ app: 'sulong-brew-lab', formatVersion: 1, tables: t, ...extra });

  it.each([
    ['not JSON', 'hello {', /not valid JSON/],
    ['a JSON list', '[]', /not a Sulong/],
    ['another app', JSON.stringify({ app: 'other', formatVersion: 1, tables: {} }), /not a Sulong/],
    ['no tables', JSON.stringify({ app: 'sulong-brew-lab', formatVersion: 1 }), /no data tables/],
    ['no version', JSON.stringify({ app: 'sulong-brew-lab', tables: {} }), /format version/],
    [
      'a newer format',
      JSON.stringify({ app: 'sulong-brew-lab', formatVersion: 2, tables: {} }),
      /newer version/,
    ],
    ['a table that is not a list', wrap({ brews: {} }), /"brews" must be a list/],
    ['a record that is not an object', wrap({ brews: [5] }), /brews record 1: not an object/],
    ['a record with no id', wrap({ coffees: [{ name: 'x' }] }), /coffees record 1: missing id/],
    [
      'a bad updatedAt',
      wrap({ coffees: [{ id: 'a', name: 'x', createdAt: T1, updatedAt: 'nope' }] }),
      /updatedAt/,
    ],
    [
      'a bad roast date',
      wrap({ roastBatches: [{ ...batch('b1', T1), roastDate: '2026-99-99' }] }),
      /roastDate/,
    ],
    [
      'a brew with no roast batch',
      wrap({ brews: [{ ...brew('x', T1), roastBatchId: '' }] }),
      /roastBatchId/,
    ],
    ['a repeated id', wrap({ roastBatches: [batch('b1', T1), batch('b1', T2)] }), /repeated id/],
  ])('rejects %s', (_name, text, message) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('rejects the whole file when only one record is bad', () => {
    const text = wrap({ roastBatches: [batch('b1', T1), { id: 'b2' }] });
    expect(parseBackup(text).ok).toBe(false);
  });
});

describe('mergeBackup', () => {
  it('adds records the device does not have', () => {
    const merge = mergeBackup(tables(), tables({ roastBatches: [batch('b1', T1)] }));
    expect(merge.summary.roastBatches).toEqual({ added: 1, updated: 0, kept: 0 });
    expect(merge.toWrite.roastBatches).toHaveLength(1);
  });

  it('newest wins: takes a newer incoming record, keeps a newer local one', () => {
    const local = tables({
      roastBatches: [batch('b1', T2, 'local'), batch('b2', T1, 'old local')],
    });
    const incoming = tables({
      roastBatches: [batch('b1', T1, 'older incoming'), batch('b2', T3, 'newer incoming')],
    });
    const merge = mergeBackup(local, incoming);
    expect(merge.summary.roastBatches).toEqual({ added: 0, updated: 1, kept: 1 });
    expect(merge.toWrite.roastBatches.map((r) => [r.id, r.notes])).toEqual([
      ['b2', 'newer incoming'],
    ]);
  });

  it('importing the same backup twice changes nothing the second time', () => {
    const data = tables({ roastBatches: [batch('b1', T2)], brews: [brew('br1', T2)] });
    const merge = mergeBackup(data, data);
    expect(merge.totals).toEqual({ added: 0, updated: 0, kept: 2 });
    expect(BACKUP_TABLES.every((t) => merge.toWrite[t].length === 0)).toBe(true);
  });

  it('two devices seeded separately agree: the seeds merge as ties', () => {
    const merge = mergeBackup(seeds(), seeds());
    expect(merge.totals.added).toBe(0);
    expect(merge.totals.updated).toBe(0);
    expect(merge.totals.kept).toBe(16);
  });

  it('carries a deletion made on another device', () => {
    const local = tables({ roastBatches: [batch('b1', T1)] });
    const incoming = tables({ roastBatches: [markDeleted(batch('b1', T1), new Date(T3))] });
    const merge = mergeBackup(local, incoming);
    expect(merge.summary.roastBatches.updated).toBe(1);
    expect(merge.toWrite.roastBatches[0]?.deletedAt).toBe(T3);
  });

  it('does not let an older backup undo a newer deletion made here', () => {
    const local = tables({ roastBatches: [markDeleted(batch('b1', T1), new Date(T3))] });
    const incoming = tables({ roastBatches: [batch('b1', T2)] });
    const merge = mergeBackup(local, incoming);
    expect(merge.totals.updated).toBe(0);
    expect(merge.toWrite.roastBatches).toHaveLength(0);
  });

  it('merges every table and totals the counts', () => {
    const merge = mergeBackup(
      tables({ roastBatches: [batch('b1', T1)] }),
      tables({ roastBatches: [batch('b2', T1)], brews: [brew('br1', T1)] }),
    );
    expect(merge.totals).toEqual({ added: 2, updated: 0, kept: 0 });
    expect(merge.summary.brews.added).toBe(1);
  });

  it('does not change its inputs', () => {
    const local = tables({ roastBatches: [batch('b1', T1)] });
    const incoming = tables({ roastBatches: [batch('b1', T3, 'new')] });
    mergeBackup(local, incoming);
    expect(local.roastBatches[0]?.notes).toBe('');
  });
});
