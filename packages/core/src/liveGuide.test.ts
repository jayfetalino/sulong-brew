import { describe, expect, it } from 'vitest';
import seedVersions from '../../../data/seeds/recipe-versions.json';
import {
  buildBrewDraft,
  currentTarget,
  distanceToTarget,
  formatDistance,
  nextStepAfter,
  planDemoPour,
  stepIndexAt,
  stepProgress,
} from './liveGuide';
import type { RecipeVersion } from './types';

const versions = seedVersions as RecipeVersion[];
const byId = (id: string) => versions.find((v) => v.id === id) as RecipeVersion;
// The Sulong Pour: 0:00 pour to 40, 0:40 pour to 220, 1:20 pause at 220, 1:27 pour to 310, 1:55 drawdown.
const pour = byId('rv-sulong-pour-1').steps;

describe('stepIndexAt', () => {
  it('starts on the first step at 0:00 and switches exactly when a step starts', () => {
    expect(stepIndexAt(pour, 0)).toBe(0);
    expect(stepIndexAt(pour, 39.9)).toBe(0);
    expect(stepIndexAt(pour, 40)).toBe(1);
    expect(stepIndexAt(pour, 87)).toBe(3);
    expect(stepIndexAt(pour, 500)).toBe(4);
  });

  it('is -1 when there are no steps or the first has not started', () => {
    expect(stepIndexAt([], 5)).toBe(-1);
    expect(stepIndexAt([{ ...pour[0]!, startSeconds: 5 }], 1)).toBe(-1);
  });
});

describe('nextStepAfter', () => {
  it('counts down to the next step in whole seconds, rounding up', () => {
    expect(nextStepAfter(pour, 0)).toEqual({ index: 1, inSeconds: 40 });
    expect(nextStepAfter(pour, 17.2)).toEqual({ index: 1, inSeconds: 23 });
  });

  it('is null once the last step has started', () => {
    expect(nextStepAfter(pour, 115)).toBeNull();
  });
});

describe('currentTarget', () => {
  it('gives the target of the step happening now', () => {
    expect(currentTarget(pour, 10)).toBe(40);
    expect(currentTarget(pour, 50)).toBe(220);
    expect(currentTarget(pour, 85)).toBe(220); // the pause holds 220 g
    expect(currentTarget(pour, 100)).toBe(310);
  });

  it('is null for the drawdown, which has no target', () => {
    expect(currentTarget(pour, 120)).toBeNull();
  });
});

describe('distanceToTarget and formatDistance', () => {
  it('is positive when grams are still to pour and negative when over', () => {
    expect(distanceToTarget(180, 220)).toBe(40);
    expect(distanceToTarget(225, 220)).toBe(-5);
  });

  it('words the distance rounded to 0.1 g', () => {
    expect(formatDistance(38.44)).toEqual({ text: '38.4 g to go', kind: 'to-go' });
    expect(formatDistance(-5.04)).toEqual({ text: 'Over by 5.0 g', kind: 'over' });
    expect(formatDistance(0.1)).toEqual({ text: '0.1 g to go', kind: 'to-go' });
  });

  it('says "At target" when the distance rounds to 0.0, on either side', () => {
    expect(formatDistance(0)).toEqual({ text: 'At target', kind: 'at' });
    expect(formatDistance(0.04)).toEqual({ text: 'At target', kind: 'at' });
    expect(formatDistance(-0.04)).toEqual({ text: 'At target', kind: 'at' });
  });

  it('never judges: no good, bad, perfect or ok in the words, and no em-dash', () => {
    for (const d of [50, 1, 0, -1, -50]) {
      expect(formatDistance(d).text).not.toMatch(/good|bad|perfect|ok|great|—/i);
    }
  });
});

describe('stepProgress', () => {
  it('measures the first pour from 0 g up to its target', () => {
    expect(stepProgress(pour, 0, 20)).toBe(0.5);
  });

  it('measures a later pour from the previous target up to its own', () => {
    expect(stepProgress(pour, 1, 130)).toBe(0.5); // halfway from 40 to 220
    expect(stepProgress(pour, 1, 30)).toBe(0); // below the start of the pour
    expect(stepProgress(pour, 1, 250)).toBe(1); // past the target
  });

  it('is null for a pause at the same weight and for the drawdown', () => {
    expect(stepProgress(pour, 2, 220)).toBeNull();
    expect(stepProgress(pour, 4, 300)).toBeNull();
  });
});

describe('planDemoPour', () => {
  it('follows The Sulong Pour: pours to 40, 220 and 310, and skips the pause and drawdown', () => {
    expect(planDemoPour(pour).map((p) => [p.atSeconds, p.targetG])).toEqual([
      [0, 40],
      [40, 220],
      [87, 310],
    ]);
  });

  it('keeps each pour at 20 seconds or less, and at least 1 second', () => {
    for (const v of versions) {
      for (const p of planDemoPour(v.steps)) {
        expect(p.durationSeconds).toBeGreaterThanOrEqual(1);
        expect(p.durationSeconds).toBeLessThanOrEqual(20);
      }
    }
  });

  it.each(versions.map((v) => [v.id, v] as const))(
    '%s: targets rise, start times do not go backwards, and the last target is the water weight',
    (_id, v) => {
      const plan = planDemoPour(v.steps);
      expect(plan.length).toBeGreaterThan(0);
      const targets = plan.map((p) => p.targetG);
      expect(targets).toEqual([...targets].sort((a, b) => a - b));
      expect(new Set(targets).size).toBe(targets.length);
      const starts = plan.map((p) => p.atSeconds);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(plan[plan.length - 1]?.targetG).toBe(v.waterG);
    },
  );
});

describe('buildBrewDraft', () => {
  const sulong = byId('rv-sulong-pour-1');

  it('fills the brew form from the recipe version and what was measured', () => {
    expect(buildBrewDraft(sulong, 287.46, 195.4, 'scale')).toEqual({
      recipeVersionId: 'rv-sulong-pour-1',
      doseG: 20,
      yieldG: 287.5,
      brewSeconds: 195,
      waterTempC: 91,
      grindClicks: null,
      yieldSource: 'scale',
    });
  });

  it('marks the yield as demo when the weight came from the simulated scale', () => {
    expect(buildBrewDraft(sulong, 300, 190, 'demo').yieldSource).toBe('demo');
  });

  it('leaves the water temperature empty when the recipe has none (Switch), never inventing one', () => {
    const draft = buildBrewDraft(byId('rv-switch-standard-1'), 200, 190, 'demo');
    expect(draft.waterTempC).toBeNull();
    expect(draft.doseG).toBe(15);
  });

  it('has no yield and no source when there was no usable weight', () => {
    for (const w of [null, 0, -3, Number.NaN]) {
      const draft = buildBrewDraft(sulong, w, 120, 'scale');
      expect(draft.yieldG).toBeNull();
      expect(draft.yieldSource).toBeNull();
    }
  });

  it('has no brew time when almost no time passed', () => {
    expect(buildBrewDraft(sulong, 250, 0.4, 'scale').brewSeconds).toBeNull();
    expect(buildBrewDraft(sulong, 250, null, 'scale').brewSeconds).toBeNull();
  });
});
