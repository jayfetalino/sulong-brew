import { roundTo, type RecipeStep, type RoastLevel, type StepKind } from '@sulong/core';

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

/** One line describing a step, for example "Pour to 220 g". */
export function describeStep(step: RecipeStep): string {
  const weight = step.targetWeightG === null ? '' : ` ${step.targetWeightG} g`;
  switch (step.kind) {
    case 'pour':
      return `Pour to${weight}`;
    case 'pause':
      return step.targetWeightG === null ? 'Pause' : `Pause at${weight}`;
    case 'steep':
      return 'Steep';
    case 'drawdown':
      return 'Drawdown';
  }
}

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  pour: 'Pour',
  pause: 'Pause',
  steep: 'Steep',
  drawdown: 'Drawdown',
};

export function formatGrams(value: number | null): string {
  return value === null ? 'Not set' : `${value} g`;
}
