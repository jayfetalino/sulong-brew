import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabDb } from './db';
import { SEED_COFFEES, SEED_RECIPES, SEED_RECIPE_VERSIONS, seedIfFirstRun } from './seed';

let db: LabDb;

beforeEach(() => {
  db = new LabDb(`test-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

describe('seedIfFirstRun', () => {
  it('loads 6 coffees, 5 recipes and 5 recipe versions on first run', async () => {
    expect(await seedIfFirstRun(db)).toBe(true);
    expect(await db.coffees.count()).toBe(6);
    expect(await db.recipes.count()).toBe(5);
    expect(await db.recipeVersions.count()).toBe(5);
  });

  it('does nothing on the second run', async () => {
    await seedIfFirstRun(db);
    expect(await seedIfFirstRun(db)).toBe(false);
    expect(await db.coffees.count()).toBe(6);
  });

  it('does not bring back a coffee that was deleted', async () => {
    await seedIfFirstRun(db);
    await db.coffees.delete('coffee-peru-gesha-washed');
    await seedIfFirstRun(db);
    expect(await db.coffees.count()).toBe(5);
  });
});

describe('seed data', () => {
  const allText = JSON.stringify([SEED_COFFEES, SEED_RECIPES, SEED_RECIPE_VERSIONS]);

  it('has unique ids', () => {
    const ids = [...SEED_COFFEES, ...SEED_RECIPES, ...SEED_RECIPE_VERSIONS].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no em-dashes', () => {
    expect(allText).not.toContain('—');
  });

  it('links every recipe to an existing version and back', () => {
    for (const recipe of SEED_RECIPES) {
      const version = SEED_RECIPE_VERSIONS.find((v) => v.id === recipe.currentVersionId);
      expect(version?.recipeId).toBe(recipe.id);
    }
  });

  it('has espresso-primary on exactly the two medium-dark coffees', () => {
    const espresso = SEED_COFFEES.filter((c) => c.espressoPrimary);
    expect(espresso.map((c) => c.roastLevel)).toEqual(['medium-dark', 'medium-dark']);
  });

  it.each(SEED_RECIPE_VERSIONS.map((v) => [v.id, v] as const))(
    '%s has steps in time order, rising weights, and ends at the water weight',
    (_id, v) => {
      const starts = v.steps.map((s) => s.startSeconds);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));

      const targets = v.steps.map((s) => s.targetWeightG).filter((w): w is number => w !== null);
      expect(targets).toEqual([...targets].sort((a, b) => a - b));

      const lastPour = [...v.steps].reverse().find((s) => s.kind === 'pour');
      expect(lastPour?.targetWeightG).toBe(v.waterG);

      expect(v.finishSecondsMin).not.toBeNull();
      expect(v.finishSecondsMin ?? 0).toBeLessThanOrEqual(v.finishSecondsMax ?? 0);
    },
  );

  it('keeps the Switch water temperature unknown (null)', () => {
    const v = SEED_RECIPE_VERSIONS.find((r) => r.id === 'rv-switch-standard-1');
    expect(v?.waterTempC).toBeNull();
    expect(v?.steps.every((s) => s.tempC === null)).toBe(true);
  });

  it('matches the brief for the Sulong Pour and Step-Down', () => {
    const pour = SEED_RECIPE_VERSIONS.find((r) => r.id === 'rv-sulong-pour-1');
    expect([pour?.doseG, pour?.waterG, pour?.waterTempC]).toEqual([20, 310, 91]);
    expect(pour?.steps.map((s) => [s.startSeconds, s.targetWeightG])).toEqual([
      [0, 40],
      [40, 220],
      [80, 220],
      [87, 310],
      [115, null],
    ]);
    const stepDown = SEED_RECIPE_VERSIONS.find((r) => r.id === 'rv-step-down-1');
    expect(stepDown?.steps.map((s) => s.tempC)).toEqual([94, 91, 88]);
  });
});
