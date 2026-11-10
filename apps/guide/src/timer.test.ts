import { describe, expect, it } from 'vitest';
import snapshot from './snapshots/01-the-sulong-pour.json';
import { nextStepAfter, stepIndexAt } from './timer';
import type { GuideSnapshot } from './types';

const steps = (snapshot as GuideSnapshot).steps; // starts at 0, 40, 80, 87, 115 seconds

describe('stepIndexAt', () => {
  it('starts on the first step at 0:00', () => {
    expect(stepIndexAt(steps, 0)).toBe(0);
  });

  it('switches exactly when a step starts', () => {
    expect(stepIndexAt(steps, 39.9)).toBe(0);
    expect(stepIndexAt(steps, 40)).toBe(1);
    expect(stepIndexAt(steps, 86)).toBe(2);
    expect(stepIndexAt(steps, 87)).toBe(3);
  });

  it('stays on the last step after it starts', () => {
    expect(stepIndexAt(steps, 115)).toBe(4);
    expect(stepIndexAt(steps, 500)).toBe(4);
  });

  it('is -1 when there are no steps or the first step has not started', () => {
    expect(stepIndexAt([], 10)).toBe(-1);
    expect(stepIndexAt([{ ...steps[0]!, startSeconds: 5 }], 1)).toBe(-1);
  });
});

describe('nextStepAfter', () => {
  it('counts down to the next step, rounding up to whole seconds', () => {
    expect(nextStepAfter(steps, 0)).toEqual({ index: 1, inSeconds: 40 });
    expect(nextStepAfter(steps, 17.2)).toEqual({ index: 1, inSeconds: 23 });
    expect(nextStepAfter(steps, 80)).toEqual({ index: 3, inSeconds: 7 });
  });

  it('is null once the last step has started', () => {
    expect(nextStepAfter(steps, 115)).toBeNull();
    expect(nextStepAfter([], 0)).toBeNull();
  });
});
