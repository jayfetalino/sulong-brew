/** Every stored record has these three fields. Dates are ISO 8601 strings. */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type RoastLevel = 'light' | 'medium' | 'medium-dark';

export interface Coffee extends BaseRecord {
  name: string;
  roastLevel: RoastLevel;
  /** True for coffees whose main use is espresso. */
  espressoPrimary: boolean;
}

export interface RoastBatch extends BaseRecord {
  coffeeId: string;
  /** Calendar date of the roast, YYYY-MM-DD. */
  roastDate: string;
  /** Kaffelogic profile name. Empty until Jay enters it. */
  profileName: string | null;
  roastLevel: RoastLevel;
  greenWeightG: number | null;
  roastedWeightG: number | null;
  notes: string;
}

export type StepKind = 'pour' | 'pause' | 'steep' | 'drawdown';
export type ValveState = 'open' | 'closed';

export interface RecipeStep {
  kind: StepKind;
  /** Seconds from the start of the brew. */
  startSeconds: number;
  /** Cumulative scale weight to reach, in grams. Null when the step has no target. */
  targetWeightG: number | null;
  /** Water temperature in C for this step, when it differs from the recipe. */
  tempC: number | null;
  /** Only for Switch recipes. */
  valve: ValveState | null;
  note: string;
}

export interface Recipe extends BaseRecord {
  name: string;
  /** Points at the newest RecipeVersion. */
  currentVersionId: string | null;
}

/** Immutable once saved. To change a recipe, save a new version. */
export interface RecipeVersion extends BaseRecord {
  recipeId: string;
  versionNumber: number;
  doseG: number;
  waterG: number;
  /** Null means unknown. Never guess. */
  waterTempC: number | null;
  /** Private: grinder clicks. */
  grindClicks: number | null;
  /** Public: plain-English grind description. */
  grindDescription: string;
  steps: RecipeStep[];
}

export interface Brew extends BaseRecord {
  recipeVersionId: string;
  roastBatchId: string;
  doseG: number;
  yieldG: number | null;
  brewSeconds: number | null;
  /** TDS in percent, typed by hand. */
  tdsPercent: number | null;
  /** Rating scale is an open decision, so this stays unconstrained for now. */
  rating: number | null;
  tags: string[];
  notes: string;
}
