import { daysOffRoast, isValidDay, weightLossPercent } from './math';
import type { RoastBatch, RoastLevel } from './types';

/** What the roast batch form holds: everything is text, as typed. */
export interface RoastBatchForm {
  coffeeId: string;
  roastDate: string;
  profileName: string;
  roastLevel: RoastLevel | '';
  greenWeightG: string;
  roastedWeightG: string;
  notes: string;
}

/** The editable part of a RoastBatch (everything except id and timestamps). */
export type RoastBatchFields = Omit<RoastBatch, 'id' | 'createdAt' | 'updatedAt'>;

export type RoastBatchErrors = Partial<Record<keyof RoastBatchForm, string>>;

export type ParseResult =
  { ok: true; value: RoastBatchFields } | { ok: false; errors: RoastBatchErrors };

const LEVELS: RoastLevel[] = ['light', 'medium', 'medium-dark'];

/** Reads an optional weight. Empty means unknown (null). */
function readWeight(text: string): { value: number | null; error?: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return { value: null, error: 'Enter a weight above 0' };
  return { value: n };
}

/** Checks the form and turns it into batch fields. Weights may stay empty (unknown). */
export function parseRoastBatchForm(form: RoastBatchForm): ParseResult {
  const errors: RoastBatchErrors = {};

  if (form.coffeeId === '') errors.coffeeId = 'Pick a coffee';
  if (!isValidDay(form.roastDate)) errors.roastDate = 'Pick a roast date';
  if (!LEVELS.includes(form.roastLevel as RoastLevel)) errors.roastLevel = 'Pick a roast level';

  const green = readWeight(form.greenWeightG);
  if (green.error) errors.greenWeightG = green.error;
  const roasted = readWeight(form.roastedWeightG);
  if (roasted.error) errors.roastedWeightG = roasted.error;

  if (
    green.value !== null &&
    roasted.value !== null &&
    roasted.value > green.value &&
    !errors.roastedWeightG
  ) {
    errors.roastedWeightG = 'Roasted weight cannot be more than green weight';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      coffeeId: form.coffeeId,
      roastDate: form.roastDate,
      profileName: form.profileName.trim() === '' ? null : form.profileName.trim(),
      roastLevel: form.roastLevel as RoastLevel,
      greenWeightG: green.value,
      roastedWeightG: roasted.value,
      notes: form.notes.trim(),
    },
  };
}

export interface RoastBatchSummary {
  /** Null until both green and roasted weights are known. */
  weightLossPercent: number | null;
  daysOffRoast: number;
}

/** The computed numbers shown next to a batch. `today` is YYYY-MM-DD. */
export function summarizeRoastBatch(
  batch: Pick<RoastBatch, 'roastDate' | 'greenWeightG' | 'roastedWeightG'>,
  today: string,
): RoastBatchSummary {
  const known = batch.greenWeightG !== null && batch.roastedWeightG !== null;
  return {
    weightLossPercent: known
      ? weightLossPercent(batch.greenWeightG as number, batch.roastedWeightG as number)
      : null,
    daysOffRoast: daysOffRoast(batch.roastDate, today),
  };
}
