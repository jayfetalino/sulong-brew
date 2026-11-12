import type { GuideStep } from './types';

/** Index of the step that is happening at this moment, or -1 before the first step. */
export function stepIndexAt(steps: GuideStep[], elapsedSeconds: number): number {
  let index = -1;
  steps.forEach((s, i) => {
    if (s.startSeconds <= elapsedSeconds) index = i;
  });
  return index;
}

/** The next step that has not started yet, with the seconds until it starts. */
export function nextStepAfter(
  steps: GuideStep[],
  elapsedSeconds: number,
): { index: number; inSeconds: number } | null {
  const index = steps.findIndex((s) => s.startSeconds > elapsedSeconds);
  const step = steps[index];
  if (index === -1 || !step) return null;
  return { index, inSeconds: Math.ceil(step.startSeconds - elapsedSeconds) };
}
