import { describe, expect, it } from 'vitest';
import { mergeRecords } from './merge';
import { isDeleted, markDeleted } from './softDelete';
import type { BaseRecord } from './types';

const record: BaseRecord = {
  id: 'a',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
};

describe('markDeleted', () => {
  it('sets deletedAt and moves updatedAt to the same moment', () => {
    const gone = markDeleted(record, new Date('2026-11-09T12:00:00Z'));
    expect(gone.deletedAt).toBe('2026-11-09T12:00:00.000Z');
    expect(gone.updatedAt).toBe('2026-11-09T12:00:00.000Z');
    expect(gone.createdAt).toBe(record.createdAt);
    expect(gone.id).toBe('a');
  });

  it('does not change the original', () => {
    markDeleted(record);
    expect(record.deletedAt).toBeUndefined();
  });
});

describe('isDeleted', () => {
  it('is false for a normal record and for deletedAt null', () => {
    expect(isDeleted(record)).toBe(false);
    expect(isDeleted({ ...record, deletedAt: null })).toBe(false);
  });

  it('is true once deleted', () => {
    expect(isDeleted(markDeleted(record))).toBe(true);
  });
});

describe('deletion and merge', () => {
  it('a deletion on one device wins over an older copy on another', () => {
    const phone = [record];
    const mac = [markDeleted(record, new Date('2026-11-09T12:00:00Z'))];
    const merged = mergeRecords(phone, mac).records;
    expect(merged).toHaveLength(1);
    expect(isDeleted(merged[0] as BaseRecord)).toBe(true);
  });

  it('an edit made after the deletion brings the record back', () => {
    const deleted = markDeleted(record, new Date('2026-11-09T12:00:00Z'));
    const editedLater = { ...record, updatedAt: '2026-11-10T08:00:00.000Z' };
    const merged = mergeRecords([deleted], [editedLater]).records;
    expect(isDeleted(merged[0] as BaseRecord)).toBe(false);
  });
});
