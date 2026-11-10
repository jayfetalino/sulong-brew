import type { RecipeStep, RecipeVersion, RoastLevel } from './types';

/**
 * The only data that ever goes to the public guide: a frozen copy of one recipe version.
 * It is built from an explicit list of fields below, so private lab data
 * (grinder clicks, ids, brews, ratings, roast weights) cannot leak by accident.
 */
export interface GuideSnapshot {
  schemaVersion: 1;
  publishedAt: string;
  recipeName: string;
  versionNumber: number;
  doseG: number;
  waterG: number;
  waterTempC: number | null;
  /** Plain-English grind description. Never grinder clicks. */
  grindDescription: string;
  finishSecondsMin: number | null;
  finishSecondsMax: number | null;
  steps: RecipeStep[];
  /** The coffee on the bag, when known. Null leaves it off the page. */
  coffee: GuideCoffee | null;
  /** Espresso recipes are not defined yet. Always null for now. */
  espresso: null;
}

export interface GuideCoffee {
  name: string;
  roastLevel: RoastLevel;
  /** YYYY-MM-DD, or null if unknown. */
  roastDate: string | null;
}

export interface GuideSnapshotInput {
  recipeName: string;
  version: RecipeVersion;
  coffee: GuideCoffee | null;
  publishedAt: Date;
}

export function createGuideSnapshot(input: GuideSnapshotInput): GuideSnapshot {
  const { version } = input;
  return {
    schemaVersion: 1,
    publishedAt: input.publishedAt.toISOString(),
    recipeName: input.recipeName,
    versionNumber: version.versionNumber,
    doseG: version.doseG,
    waterG: version.waterG,
    waterTempC: version.waterTempC,
    grindDescription: version.grindDescription,
    finishSecondsMin: version.finishSecondsMin,
    finishSecondsMax: version.finishSecondsMax,
    steps: version.steps.map((s) => ({
      kind: s.kind,
      startSeconds: s.startSeconds,
      targetWeightG: s.targetWeightG,
      tempC: s.tempC,
      valve: s.valve,
      note: s.note,
    })),
    coffee: input.coffee
      ? {
          name: input.coffee.name,
          roastLevel: input.coffee.roastLevel,
          roastDate: input.coffee.roastDate,
        }
      : null,
    espresso: null,
  };
}
