import type { GuideSnapshot } from './types';

export interface GuideRecipe {
  /** Used in the page link, for example #the-still-pour. */
  slug: string;
  snapshot: GuideSnapshot;
}

// Every file in ./snapshots is one frozen recipe. The numeric prefix sets the order.
const files = import.meta.glob<GuideSnapshot>('./snapshots/*.json', {
  eager: true,
  import: 'default',
});

/** "./snapshots/04-the-still-pour.json" -> "the-still-pour". */
export function slugFromPath(path: string): string {
  return path
    .replace(/^.*\//, '')
    .replace(/^\d+-/, '')
    .replace(/\.json$/, '');
}

export const RECIPES: GuideRecipe[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, snapshot]) => ({ slug: slugFromPath(path), snapshot }));

/** The position of the recipe with this slug, or 0 (the first recipe) if there is none. */
export function findRecipeIndex(recipes: { slug: string }[], slug: string): number {
  const index = recipes.findIndex((r) => r.slug === slug);
  return index === -1 ? 0 : index;
}
