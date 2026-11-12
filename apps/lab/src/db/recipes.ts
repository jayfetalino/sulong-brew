import {
  markDeleted,
  versionContentEqual,
  type Recipe,
  type RecipeVersion,
  type RecipeVersionFields,
} from '@sulong/core';
import type { LabDb } from './db';

export interface SaveRecipeResult {
  recipe: Recipe;
  version: RecipeVersion;
  /** False when only the name changed, or nothing did. */
  createdNewVersion: boolean;
}

/** Creates a recipe together with its version 1. */
export async function createRecipe(
  db: LabDb,
  name: string,
  fields: RecipeVersionFields,
  now: Date = new Date(),
): Promise<SaveRecipeResult> {
  const stamp = now.toISOString();
  const recipeId = crypto.randomUUID();
  const version: RecipeVersion = {
    ...fields,
    id: crypto.randomUUID(),
    recipeId,
    versionNumber: 1,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const recipe: Recipe = {
    id: recipeId,
    name: name.trim(),
    currentVersionId: version.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.transaction('rw', [db.recipes, db.recipeVersions], async () => {
    await db.recipeVersions.add(version);
    await db.recipes.add(recipe);
  });
  return { recipe, version, createdNewVersion: true };
}

/**
 * Saves an edit to a recipe.
 * Versions are immutable: if the content changed, a NEW version is added and the
 * recipe points at it. Old versions are never touched. If only the name changed,
 * just the recipe is updated. If nothing changed, nothing is written.
 */
export async function saveRecipeEdit(
  db: LabDb,
  recipe: Recipe,
  name: string,
  fields: RecipeVersionFields,
  now: Date = new Date(),
): Promise<SaveRecipeResult> {
  const stamp = now.toISOString();
  return db.transaction('rw', [db.recipes, db.recipeVersions], async () => {
    const current = recipe.currentVersionId
      ? await db.recipeVersions.get(recipe.currentVersionId)
      : undefined;
    const trimmedName = name.trim();

    if (current && versionContentEqual(current, fields)) {
      if (trimmedName === recipe.name) {
        return { recipe, version: current, createdNewVersion: false };
      }
      const renamed: Recipe = { ...recipe, name: trimmedName, updatedAt: stamp };
      await db.recipes.put(renamed);
      return { recipe: renamed, version: current, createdNewVersion: false };
    }

    const existing = await db.recipeVersions.where('recipeId').equals(recipe.id).toArray();
    const nextNumber = existing.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
    const version: RecipeVersion = {
      ...fields,
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      versionNumber: nextNumber,
      createdAt: stamp,
      updatedAt: stamp,
    };
    // add() (not put) so an existing version can never be overwritten.
    await db.recipeVersions.add(version);
    const updated: Recipe = {
      ...recipe,
      name: trimmedName,
      currentVersionId: version.id,
      updatedAt: stamp,
    };
    await db.recipes.put(updated);
    return { recipe: updated, version, createdNewVersion: true };
  });
}

/**
 * Hides a recipe. Its versions are kept, because past brews point at them.
 */
export async function deleteRecipe(
  db: LabDb,
  recipe: Recipe,
  now: Date = new Date(),
): Promise<void> {
  await db.recipes.put(markDeleted(recipe, now));
}
