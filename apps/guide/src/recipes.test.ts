import { describe, expect, it } from 'vitest';
import { RECIPES, findRecipeIndex, slugFromPath } from './recipes';

describe('slugFromPath', () => {
  it('drops the folder, the number prefix and the extension', () => {
    expect(slugFromPath('./snapshots/04-the-still-pour.json')).toBe('the-still-pour');
    expect(slugFromPath('./snapshots/01-the-sulong-pour.json')).toBe('the-sulong-pour');
  });
});

describe('findRecipeIndex', () => {
  const list = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }];

  it('finds a recipe by slug', () => {
    expect(findRecipeIndex(list, 'c')).toBe(2);
  });

  it('falls back to the first recipe for an empty or unknown slug', () => {
    expect(findRecipeIndex(list, '')).toBe(0);
    expect(findRecipeIndex(list, 'nope')).toBe(0);
  });
});

describe('published recipes', () => {
  it('lists the five recipes in order, The Sulong Pour first', () => {
    expect(RECIPES.map((r) => r.slug)).toEqual([
      'the-sulong-pour',
      'the-downshift',
      'the-step-down',
      'the-still-pour',
      'sulong-switch-standard',
    ]);
  });

  it('has unique slugs', () => {
    expect(new Set(RECIPES.map((r) => r.slug)).size).toBe(RECIPES.length);
  });

  it.each(RECIPES.map((r) => [r.slug, r.snapshot] as const))(
    '%s is well formed and public-safe',
    (_slug, s) => {
      const starts = s.steps.map((x) => x.startSeconds);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));

      const targets = s.steps.map((x) => x.targetWeightG).filter((w): w is number => w !== null);
      expect(targets).toEqual([...targets].sort((a, b) => a - b));

      const lastPour = [...s.steps].reverse().find((x) => x.kind === 'pour');
      expect(lastPour?.targetWeightG).toBe(s.waterG);

      const text = JSON.stringify(s);
      expect(text).not.toContain('grindClicks');
      expect(text).not.toContain('recipeId');
      expect(text).not.toContain('—');
      expect(s.schemaVersion).toBe(1);
    },
  );

  it('leaves unknown values empty: Switch and Still Pour have no water temperature', () => {
    const bySlug = (slug: string) => RECIPES.find((r) => r.slug === slug)?.snapshot;
    expect(bySlug('sulong-switch-standard')?.waterTempC).toBeNull();
    expect(bySlug('the-still-pour')?.waterTempC).toBeNull();
    expect(bySlug('the-sulong-pour')?.waterTempC).toBe(91);
    expect(bySlug('the-downshift')?.waterTempC).toBe(92);
  });
});
