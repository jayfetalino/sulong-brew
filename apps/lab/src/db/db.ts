import Dexie, { type EntityTable } from 'dexie';
import type { Brew, Coffee, Recipe, RecipeVersion, RoastBatch } from '@sulong/core';

/** Small key/value table for app bookkeeping, such as "seeds already loaded". */
export interface MetaEntry {
  key: string;
  value: string;
}

export class LabDb extends Dexie {
  coffees!: EntityTable<Coffee, 'id'>;
  roastBatches!: EntityTable<RoastBatch, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  recipeVersions!: EntityTable<RecipeVersion, 'id'>;
  brews!: EntityTable<Brew, 'id'>;
  meta!: EntityTable<MetaEntry, 'key'>;

  constructor(name = 'sulong-brew-lab') {
    super(name);
    // Only indexed fields are listed. Other fields are still stored.
    this.version(1).stores({
      coffees: 'id, name',
      roastBatches: 'id, coffeeId, roastDate',
      recipes: 'id, name',
      recipeVersions: 'id, recipeId',
      brews: 'id, recipeVersionId, roastBatchId, createdAt',
      meta: 'key',
    });
  }
}
