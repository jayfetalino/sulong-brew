import type { Coffee, Recipe, RecipeVersion } from '@sulong/core';
import coffeeSeeds from '../../../../data/seeds/coffees.json';
import recipeSeeds from '../../../../data/seeds/recipes.json';
import recipeVersionSeeds from '../../../../data/seeds/recipe-versions.json';
import type { LabDb } from './db';

const SEEDED_KEY = 'seeded-v1';

// The JSON is checked by seed.test.ts, so a cast is safe here.
export const SEED_COFFEES = coffeeSeeds as Coffee[];
export const SEED_RECIPES = recipeSeeds as Recipe[];
export const SEED_RECIPE_VERSIONS = recipeVersionSeeds as RecipeVersion[];

/**
 * Loads the starter coffees and recipes the first time the app runs.
 * A marker is stored so that coffees or recipes you delete later do not come back.
 * Returns true if it loaded the seeds, false if they were already loaded.
 */
export async function seedIfFirstRun(db: LabDb): Promise<boolean> {
  return db.transaction('rw', [db.coffees, db.recipes, db.recipeVersions, db.meta], async () => {
    if (await db.meta.get(SEEDED_KEY)) return false;
    await db.coffees.bulkPut(SEED_COFFEES);
    await db.recipes.bulkPut(SEED_RECIPES);
    await db.recipeVersions.bulkPut(SEED_RECIPE_VERSIONS);
    await db.meta.put({ key: SEEDED_KEY, value: new Date().toISOString() });
    return true;
  });
}
