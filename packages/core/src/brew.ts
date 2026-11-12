import { daysOffRoast, extractionYield, isValidDay } from './math';
import { parseDuration } from './recipeVersion';
import type { Brew } from './types';

/** The editable part of a Brew (everything except id and timestamps). */
export type BrewFields = Omit<Brew, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

/** The cupping-style scores offered next to the overall rating. */
export const RATING_ATTRIBUTES = [
  { id: 'sweetness', label: 'Sweetness' },
  { id: 'acidity', label: 'Acidity' },
  { id: 'body', label: 'Body' },
  { id: 'balance', label: 'Balance' },
  { id: 'aftertaste', label: 'Aftertaste' },
  { id: 'clarity', label: 'Clarity' },
] as const;

/** 1 to 5 in half steps. */
export const RATING_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export interface BrewForm {
  recipeVersionId: string;
  roastBatchId: string;
  brewDate: string;
  doseG: string;
  yieldG: string;
  brewTime: string;
  waterTempC: string;
  grindClicks: string;
  tdsPercent: string;
  /** '' means not rated. */
  rating: string;
  /** Attribute id to score text. A missing or empty entry means not rated. */
  attributeRatings: Record<string, string>;
  /** Comma separated, as typed. */
  tags: string;
  notes: string;
}

export type BrewErrors = Partial<Record<Exclude<keyof BrewForm, 'attributeRatings'>, string>> & {
  attributeRatings?: string;
};

export type BrewParseResult = { ok: true; value: BrewFields } | { ok: false; errors: BrewErrors };

/** "Jasmine, bright ,jasmine" -> ["jasmine", "bright"]. Lowercase, trimmed, no repeats. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(',')) {
    const tag = part.trim().toLowerCase();
    if (tag !== '') seen.add(tag);
  }
  return [...seen];
}

/** Empty text is null (unknown). Text that is not a number is NaN. */
function optionalNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function isRatingValue(n: number): boolean {
  return (RATING_VALUES as readonly number[]).includes(n);
}

export function parseBrewForm(form: BrewForm): BrewParseResult {
  const errors: BrewErrors = {};

  if (form.recipeVersionId === '') errors.recipeVersionId = 'Pick a recipe version';
  if (form.roastBatchId === '') errors.roastBatchId = 'Pick a roast batch';
  if (!isValidDay(form.brewDate)) errors.brewDate = 'Pick the brew date';

  const dose = optionalNumber(form.doseG);
  if (dose === null || Number.isNaN(dose) || dose <= 0) errors.doseG = 'Enter a dose above 0';

  const yieldG = optionalNumber(form.yieldG);
  if (yieldG !== null && (Number.isNaN(yieldG) || yieldG <= 0)) {
    errors.yieldG = 'Enter a weight above 0, or leave empty';
  }

  let brewSeconds: number | null = null;
  if (form.brewTime.trim() !== '') {
    brewSeconds = parseDuration(form.brewTime);
    if (brewSeconds === null) errors.brewTime = 'Use m:ss, like 3:10';
  }

  const temp = optionalNumber(form.waterTempC);
  if (temp !== null && (Number.isNaN(temp) || temp <= 0 || temp > 100)) {
    errors.waterTempC = 'Enter 1 to 100 C, or leave empty';
  }

  const clicks = optionalNumber(form.grindClicks);
  if (clicks !== null && (Number.isNaN(clicks) || clicks < 0)) {
    errors.grindClicks = 'Enter clicks of 0 or more, or leave empty';
  }

  const tds = optionalNumber(form.tdsPercent);
  if (tds !== null && (Number.isNaN(tds) || tds <= 0 || tds > 30)) {
    errors.tdsPercent = 'Enter a TDS between 0 and 30, or leave empty';
  }

  const rating = optionalNumber(form.rating);
  if (rating !== null && (Number.isNaN(rating) || !isRatingValue(rating))) {
    errors.rating = 'Pick a score from 1 to 5';
  }

  const attributeRatings: Record<string, number> = {};
  for (const { id } of RATING_ATTRIBUTES) {
    const n = optionalNumber(form.attributeRatings[id] ?? '');
    if (n === null) continue;
    if (Number.isNaN(n) || !isRatingValue(n)) errors.attributeRatings = 'Pick scores from 1 to 5';
    else attributeRatings[id] = n;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      recipeVersionId: form.recipeVersionId,
      roastBatchId: form.roastBatchId,
      brewDate: form.brewDate,
      doseG: dose as number,
      yieldG,
      brewSeconds,
      waterTempC: temp,
      grindClicks: clicks,
      tdsPercent: tds,
      rating,
      attributeRatings,
      tags: parseTags(form.tags),
      notes: form.notes.trim(),
    },
  };
}

export interface BrewSummary {
  /** Percent. Null until both the yield and the TDS are known. */
  extractionYield: number | null;
  /** How old the coffee was on brew day. Null if the roast batch is unknown. */
  daysOffRoast: number | null;
}

/** The computed numbers shown next to a brew. `roastDate` is the batch's YYYY-MM-DD, if known. */
export function summarizeBrew(
  brew: Pick<Brew, 'doseG' | 'yieldG' | 'tdsPercent' | 'brewDate'>,
  roastDate: string | null,
): BrewSummary {
  const ey =
    brew.yieldG !== null && brew.tdsPercent !== null && brew.doseG > 0
      ? extractionYield(brew.yieldG, brew.tdsPercent, brew.doseG)
      : null;
  return {
    extractionYield: ey,
    daysOffRoast: roastDate === null ? null : daysOffRoast(roastDate, brew.brewDate),
  };
}
