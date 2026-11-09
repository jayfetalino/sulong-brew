import { roundTo, type RoastLevel } from '@sulong/core';

export const ROAST_LEVEL_LABELS: Record<RoastLevel, string> = {
  light: 'Light',
  medium: 'Medium',
  'medium-dark': 'Medium-dark',
};

/** Today as YYYY-MM-DD in the device's own time zone. */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "15.0 %", or "Not set" when unknown. */
export function formatPercent(value: number | null): string {
  return value === null ? 'Not set' : `${roundTo(value, 1).toFixed(1)} %`;
}

export function formatGrams(value: number | null): string {
  return value === null ? 'Not set' : `${value} g`;
}
