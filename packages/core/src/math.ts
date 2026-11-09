const MS_PER_DAY = 86_400_000;

/** Rounds to a fixed number of decimals, avoiding float surprises like 21.855 -> 21.8. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Percent of weight lost in the roast: (green - roasted) / green x 100. */
export function weightLossPercent(greenG: number, roastedG: number): number {
  if (!(greenG > 0)) throw new RangeError('greenG must be greater than 0');
  if (roastedG < 0) throw new RangeError('roastedG must not be negative');
  return ((greenG - roastedG) / greenG) * 100;
}

/** Parses YYYY-MM-DD as a UTC calendar day so time zones never shift the count. */
function parseDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${day}"`);
  }
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Not a real date: "${day}"`);
  return ms;
}

/** Whole calendar days from the roast date to today. Both are YYYY-MM-DD. */
export function daysOffRoast(roastDate: string, today: string): number {
  return Math.round((parseDay(today) - parseDay(roastDate)) / MS_PER_DAY);
}

/** Extraction yield in percent: (beverage weight g x TDS %) / dose g. */
export function extractionYield(beverageG: number, tdsPercent: number, doseG: number): number {
  if (!(doseG > 0)) throw new RangeError('doseG must be greater than 0');
  if (beverageG < 0 || tdsPercent < 0) {
    throw new RangeError('beverageG and tdsPercent must not be negative');
  }
  return (beverageG * tdsPercent) / doseG;
}
