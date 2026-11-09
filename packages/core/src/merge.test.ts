import { describe, expect, it } from 'vitest';
import { mergeRecords } from './merge';
import type { BaseRecord } from './types';

interface Thing extends BaseRecord {
  label: string;
}

const make = (id: string, label: string, updatedAt: string): Thing => ({
  id,
  label,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt,
});

describe('mergeRecords', () => {
  it('adds records that only exist in the incoming data', () => {
    const result = mergeRecords(
      [make('a', 'A', '2026-11-02T00:00:00Z')],
      [make('b', 'B', '2026-11-03T00:00:00Z')],
    );
    expect(result.records.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(result.added).toEqual(['b']);
  });

  it('keeps local-only records', () => {
    const result = mergeRecords([make('a', 'A', '2026-11-02T00:00:00Z')], []);
    expect(result.records).toHaveLength(1);
    expect(result.added).toEqual([]);
  });

  it('takes the incoming copy when it is newer', () => {
    const result = mergeRecords(
      [make('a', 'old', '2026-11-02T00:00:00Z')],
      [make('a', 'new', '2026-11-05T00:00:00Z')],
    );
    expect(result.records[0]?.label).toBe('new');
    expect(result.updated).toEqual(['a']);
  });

  it('keeps the local copy when it is newer', () => {
    const result = mergeRecords(
      [make('a', 'local', '2026-11-05T00:00:00Z')],
      [make('a', 'incoming', '2026-11-02T00:00:00Z')],
    );
    expect(result.records[0]?.label).toBe('local');
    expect(result.kept).toEqual(['a']);
  });

  it('keeps the local copy on a tie', () => {
    const result = mergeRecords(
      [make('a', 'local', '2026-11-05T00:00:00Z')],
      [make('a', 'incoming', '2026-11-05T00:00:00Z')],
    );
    expect(result.records[0]?.label).toBe('local');
  });

  it('compares real times, not strings, across time zone formats', () => {
    // 12:00 at +05:00 is 07:00Z, which is earlier than 09:00Z.
    const result = mergeRecords(
      [make('a', 'local', '2026-11-05T09:00:00Z')],
      [make('a', 'incoming', '2026-11-05T12:00:00+05:00')],
    );
    expect(result.records[0]?.label).toBe('local');
  });

  it('does not change its inputs', () => {
    const local = [make('a', 'old', '2026-11-02T00:00:00Z')];
    const incoming = [make('a', 'new', '2026-11-05T00:00:00Z')];
    mergeRecords(local, incoming);
    expect(local[0]?.label).toBe('old');
    expect(local).toHaveLength(1);
  });

  it('is order independent when timestamps differ', () => {
    const x = [make('a', 'one', '2026-11-02T00:00:00Z'), make('b', 'two', '2026-11-04T00:00:00Z')];
    const y = [make('a', 'uno', '2026-11-03T00:00:00Z'), make('c', 'tres', '2026-11-01T00:00:00Z')];
    const ab = mergeRecords(x, y).records.sort((p, q) => p.id.localeCompare(q.id));
    const ba = mergeRecords(y, x).records.sort((p, q) => p.id.localeCompare(q.id));
    expect(ab).toEqual(ba);
  });

  it('throws on a record with an unreadable updatedAt', () => {
    expect(() =>
      mergeRecords([make('a', 'x', 'nope')], [make('a', 'y', '2026-11-05T00:00:00Z')]),
    ).toThrow(RangeError);
  });
});
