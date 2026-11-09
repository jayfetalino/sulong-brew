import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RecipeVersionFields } from '@sulong/core';
import { LabDb } from './db';
import { createRecipe, deleteRecipe, saveRecipeEdit } from './recipes';

let db: LabDb;

beforeEach(() => {
  db = new LabDb(`test-${Math.random().toString(36).slice(2)}`);
});

afterEach(async () => {
  await db.delete();
});

const fields: RecipeVersionFields = {
  doseG: 20,
  waterG: 320,
  waterTempC: 92,
  grindClicks: null,
  grindDescription: '',
  finishSecondsMin: null,
  finishSecondsMax: null,
  notes: '',
  steps: [
    { kind: 'pour', startSeconds: 0, targetWeightG: 40, tempC: null, valve: null, note: 'Bloom' },
    { kind: 'pour', startSeconds: 45, targetWeightG: 320, tempC: null, valve: null, note: '' },
  ],
};

const t1 = new Date('2026-11-09T12:00:00Z');
const t2 = new Date('2026-11-10T12:00:00Z');
const t3 = new Date('2026-11-11T12:00:00Z');

describe('createRecipe', () => {
  it('stores the recipe and its version 1, linked together', async () => {
    const { recipe, version } = await createRecipe(db, '  My Pour ', fields, t1);
    expect(recipe.name).toBe('My Pour');
    expect(recipe.currentVersionId).toBe(version.id);
    expect(version.versionNumber).toBe(1);
    expect(version.recipeId).toBe(recipe.id);
    expect(await db.recipeVersions.count()).toBe(1);
  });
});

describe('saveRecipeEdit', () => {
  it('adds version 2 and leaves version 1 exactly as it was', async () => {
    const { recipe, version: v1 } = await createRecipe(db, 'My Pour', fields, t1);
    const v1Before = JSON.stringify(await db.recipeVersions.get(v1.id));

    const result = await saveRecipeEdit(db, recipe, 'My Pour', { ...fields, doseG: 21 }, t2);

    expect(result.createdNewVersion).toBe(true);
    expect(result.version.versionNumber).toBe(2);
    expect(result.recipe.currentVersionId).toBe(result.version.id);
    expect(result.recipe.updatedAt).toBe(t2.toISOString());
    expect(await db.recipeVersions.count()).toBe(2);
    expect(JSON.stringify(await db.recipeVersions.get(v1.id))).toBe(v1Before);
  });

  it('numbers versions 1, 2, 3', async () => {
    const created = await createRecipe(db, 'My Pour', fields, t1);
    const second = await saveRecipeEdit(
      db,
      created.recipe,
      'My Pour',
      { ...fields, doseG: 21 },
      t2,
    );
    const third = await saveRecipeEdit(db, second.recipe, 'My Pour', { ...fields, doseG: 22 }, t3);
    expect(third.version.versionNumber).toBe(3);
  });

  it('does not make a new version when nothing changed', async () => {
    const { recipe } = await createRecipe(db, 'My Pour', fields, t1);
    const result = await saveRecipeEdit(db, recipe, 'My Pour', fields, t2);
    expect(result.createdNewVersion).toBe(false);
    expect(await db.recipeVersions.count()).toBe(1);
    expect((await db.recipes.get(recipe.id))?.updatedAt).toBe(t1.toISOString());
  });

  it('renames without making a new version', async () => {
    const { recipe } = await createRecipe(db, 'My Pour', fields, t1);
    const result = await saveRecipeEdit(db, recipe, 'Renamed', fields, t2);
    expect(result.createdNewVersion).toBe(false);
    expect(result.recipe.name).toBe('Renamed');
    expect(result.recipe.updatedAt).toBe(t2.toISOString());
    expect(await db.recipeVersions.count()).toBe(1);
  });
});

describe('deleteRecipe', () => {
  it('marks the recipe deleted but keeps its versions', async () => {
    const { recipe } = await createRecipe(db, 'My Pour', fields, t1);
    await deleteRecipe(db, recipe, t2);
    expect((await db.recipes.get(recipe.id))?.deletedAt).toBe(t2.toISOString());
    expect(await db.recipeVersions.count()).toBe(1);
  });
});
