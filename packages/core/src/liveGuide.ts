import { roundTo } from './math';
import type { RecipeStep, RecipeVersion, YieldSource } from './types';

// Pure helpers for the live pour guide: which step is happening, how far the scale is from the
// step's target weight, and what to hand to the brew form when the brew ends. No screens, no devices.

/** Index of the step that is happening at this moment, or -1 before the first step starts. */
export function stepIndexAt(steps: RecipeStep[], elapsedSeconds: number): number {
  let index = -1;
  steps.forEach((s, i) => {
    if (s.startSeconds <= elapsedSeconds) index = i;
  });
  return index;
}

/** The next step that has not started yet, with the whole seconds until it starts. */
export function nextStepAfter(
  steps: RecipeStep[],
  elapsedSeconds: number,
): { index: number; inSeconds: number } | null {
  const index = steps.findIndex((s) => s.startSeconds > elapsedSeconds);
  const step = steps[index];
  if (index === -1 || !step) return null;
  return { index, inSeconds: Math.ceil(step.startSeconds - elapsedSeconds) };
}

/**
 * The target weight of the step happening now, or null if that step has no target
 * (for example the drawdown) or no step has started.
 */
export function currentTarget(steps: RecipeStep[], elapsedSeconds: number): number | null {
  const index = stepIndexAt(steps, elapsedSeconds);
  return steps[index]?.targetWeightG ?? null;
}

/** Target minus weight. Positive means grams still to pour, negative means grams over. */
export function distanceToTarget(weightG: number, targetG: number): number {
  return targetG - weightG;
}

export interface DistanceText {
  text: string;
  kind: 'to-go' | 'over' | 'at';
}

/**
 * Words for the distance, rounded to 0.1 g. It only states the number. It never says
 * "good" or "bad", because tolerances around a target are not defined anywhere.
 */
export function formatDistance(distanceG: number): DistanceText {
  const rounded = roundTo(Math.abs(distanceG), 1);
  if (rounded === 0) return { text: 'At target', kind: 'at' };
  const grams = rounded.toFixed(1);
  return distanceG > 0
    ? { text: `${grams} g to go`, kind: 'to-go' }
    : { text: `Over by ${grams} g`, kind: 'over' };
}

/**
 * How far through the current pour the scale is, from 0 to 1. A pour runs from the previous
 * target (or 0) up to this step's target. Null when the step has no target or no range
 * (a pause at the same weight).
 */
export function stepProgress(
  steps: RecipeStep[],
  stepIndex: number,
  weightG: number,
): number | null {
  const target = steps[stepIndex]?.targetWeightG ?? null;
  if (target === null) return null;
  let from = 0;
  for (let i = stepIndex - 1; i >= 0; i--) {
    const t = steps[i]?.targetWeightG ?? null;
    if (t !== null) {
      from = t;
      break;
    }
  }
  const range = target - from;
  if (range <= 0) return null;
  return Math.min(1, Math.max(0, (weightG - from) / range));
}

export interface DemoPourStep {
  /** When the pour begins, in seconds from the start of the brew. */
  atSeconds: number;
  /** The weight the simulated scale should show at the end of the pour. */
  targetG: number;
  durationSeconds: number;
}

/** The longest a demo pour takes, so a long step does not drag. */
const MAX_DEMO_POUR_SECONDS = 20;

/**
 * A script for the demo scale: for each step that raises the weight, when to start pouring,
 * what to pour up to, and over how long. Pauses and steps without a target add nothing.
 * The timings are made up for demos only.
 */
export function planDemoPour(steps: RecipeStep[]): DemoPourStep[] {
  const plan: DemoPourStep[] = [];
  let reached = 0;
  steps.forEach((step, i) => {
    const target = step.targetWeightG;
    if (target === null || target <= reached) return;
    const next = steps[i + 1];
    const interval = next ? next.startSeconds - step.startSeconds : MAX_DEMO_POUR_SECONDS;
    const durationSeconds = Math.min(MAX_DEMO_POUR_SECONDS, Math.max(1, interval * 0.8));
    plan.push({ atSeconds: step.startSeconds, targetG: target, durationSeconds });
    reached = target;
  });
  return plan;
}

/** The starting values handed to the brew form when a live brew ends. */
export interface BrewDraft {
  recipeVersionId: string;
  doseG: number;
  /** Final weight on the scale, rounded to 0.1 g. Null if there was no usable weight. */
  yieldG: number | null;
  /** Null if no time passed. */
  brewSeconds: number | null;
  waterTempC: number | null;
  grindClicks: number | null;
  /** Where the yield came from. Null when there is no yield. */
  yieldSource: YieldSource | null;
}

export function buildBrewDraft(
  version: Pick<RecipeVersion, 'id' | 'doseG' | 'waterTempC' | 'grindClicks'>,
  finalWeightG: number | null,
  elapsedSeconds: number | null,
  weightSource: Extract<YieldSource, 'scale' | 'demo'>,
): BrewDraft {
  const yieldG =
    finalWeightG !== null && Number.isFinite(finalWeightG) && finalWeightG > 0
      ? roundTo(finalWeightG, 1)
      : null;
  const brewSeconds =
    elapsedSeconds !== null && Number.isFinite(elapsedSeconds) && elapsedSeconds >= 1
      ? Math.round(elapsedSeconds)
      : null;
  return {
    recipeVersionId: version.id,
    doseG: version.doseG,
    yieldG,
    brewSeconds,
    waterTempC: version.waterTempC,
    grindClicks: version.grindClicks,
    yieldSource: yieldG === null ? null : weightSource,
  };
}
