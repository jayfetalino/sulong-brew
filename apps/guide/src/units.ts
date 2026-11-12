import type { GuideStep, TempUnit, WeightUnit } from './types';

const GRAMS_PER_OUNCE = 28.349523125;

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function gToOz(g: number): number {
  return g / GRAMS_PER_OUNCE;
}

/** 91 -> "91 °C" or "196 °F". */
export function formatTemp(c: number, unit: TempUnit): string {
  return unit === 'C' ? `${c} °C` : `${Math.round(cToF(c))} °F`;
}

/** 220 -> "220 g" or "7.8 oz". */
export function formatWeight(g: number, unit: WeightUnit): string {
  if (unit === 'oz') return `${gToOz(g).toFixed(1)} oz`;
  return `${Number.isInteger(g) ? g : g.toFixed(1)} g`;
}

/** 87 -> "1:27". */
export function formatClock(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** 20 g of coffee and 310 g of water -> "1:15.5". */
export function ratioLabel(doseG: number, waterG: number): string {
  if (!(doseG > 0)) return '';
  const ratio = Math.round((waterG / doseG) * 10) / 10;
  return `1:${Number.isInteger(ratio) ? ratio : ratio.toFixed(1)}`;
}

/** The headline for a step card, in the chosen weight unit. */
export function stepTitle(step: GuideStep, unit: WeightUnit): string {
  const weight = step.targetWeightG === null ? '' : ` ${formatWeight(step.targetWeightG, unit)}`;
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
