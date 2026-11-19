import {
  RATING_ATTRIBUTES,
  formatDuration,
  ratioLabel,
  summarizeBrew,
  weightLossPercent,
  type Brew,
  type Coffee,
  type RecipeVersion,
  type RoastBatch,
} from '@sulong/core';
import { ROAST_LEVEL_LABELS, formatGrams, formatPercent } from './format';

/** The most brews that can be compared at once (three columns fit a phone). */
export const MAX_COMPARE = 3;

/** One brew with the records it points to. Any of the linked records may be missing. */
export interface CompareItem {
  brew: Brew;
  version?: RecipeVersion;
  recipeName?: string;
  batch?: RoastBatch;
  coffee?: Coffee;
}

export interface CompareColumn {
  brewId: string;
  coffeeName: string;
  brewDate: string;
}

export interface CompareRow {
  id: string;
  label: string;
  /** What to show, one text per brew, in the same order as the columns. */
  cells: string[];
  /** True when the brews do not all have the same value. This says nothing about better or worse. */
  differs: boolean;
}

export interface CompareGroup {
  id: string;
  title: string;
  rows: CompareRow[];
}

export interface Comparison {
  columns: CompareColumn[];
  groups: CompareGroup[];
}

const NOT_SET = 'Not set';
const NOT_RATED = 'Not rated';

/** Builds one row. `raw` is the real value per brew, so display rounding never hides a difference. */
function row(id: string, label: string, cells: string[], raw: unknown[]): CompareRow {
  const keys = raw.map((r) => JSON.stringify(r ?? null));
  return { id, label, cells, differs: new Set(keys).size > 1 };
}

const demoMark = (isDemo: boolean) => (isDemo ? ' (demo)' : '');

/** Builds the side-by-side view for two or more brews. Shows what differs and never judges it. */
export function buildComparison(items: CompareItem[]): Comparison {
  const columns: CompareColumn[] = items.map(({ brew, coffee }) => ({
    brewId: brew.id,
    coffeeName: coffee?.name ?? 'Unknown coffee',
    brewDate: brew.brewDate,
  }));

  const summaries = items.map(({ brew, batch }) => summarizeBrew(brew, batch?.roastDate ?? null));
  const each = <T>(fn: (item: CompareItem, index: number) => T): T[] => items.map(fn);

  const brewGroup: CompareGroup = {
    id: 'brew',
    title: 'Brew',
    rows: [
      row(
        'recipe',
        'Recipe',
        each(({ version, recipeName }) =>
          version
            ? `${recipeName ?? 'Deleted recipe'} v${version.versionNumber}`
            : 'Unknown recipe',
        ),
        each(({ brew }) => brew.recipeVersionId),
      ),
      row(
        'roastDate',
        'Roast date',
        each(({ batch }) => batch?.roastDate ?? NOT_SET),
        each(({ batch }) => batch?.roastDate),
      ),
      row(
        'daysOff',
        'Days off roast',
        each((_, i) => {
          const days = summaries[i]?.daysOffRoast ?? null;
          return days === null ? NOT_SET : String(days);
        }),
        each((_, i) => summaries[i]?.daysOffRoast),
      ),
      row(
        'profile',
        'Roast profile',
        each(({ batch }) => batch?.profileName || NOT_SET),
        each(({ batch }) => batch?.profileName || null),
      ),
      row(
        'roastLevel',
        'Roast level',
        each(({ batch }) => (batch ? ROAST_LEVEL_LABELS[batch.roastLevel] : NOT_SET)),
        each(({ batch }) => batch?.roastLevel),
      ),
      row(
        'weightLoss',
        'Roast weight loss',
        each(({ batch }) => formatPercent(batchWeightLoss(batch))),
        each(({ batch }) => batchWeightLoss(batch)),
      ),
    ],
  };

  const madeGroup: CompareGroup = {
    id: 'made',
    title: 'How it was made',
    rows: [
      row(
        'dose',
        'Dose',
        each(({ brew }) => formatGrams(brew.doseG)),
        each(({ brew }) => brew.doseG),
      ),
      row(
        'yield',
        'Yield in cup',
        each(
          ({ brew }) =>
            `${formatGrams(brew.yieldG)}${demoMark(brew.yieldSource === 'demo' && brew.yieldG !== null)}`,
        ),
        each(({ brew }) => brew.yieldG),
      ),
      row(
        'ratio',
        'Brew ratio',
        each(({ brew }) =>
          brew.yieldG !== null && brew.doseG > 0
            ? `${ratioLabel(brew.doseG, brew.yieldG)}${demoMark(brew.yieldSource === 'demo')}`
            : NOT_SET,
        ),
        each(({ brew }) =>
          brew.yieldG !== null && brew.doseG > 0 ? ratioLabel(brew.doseG, brew.yieldG) : null,
        ),
      ),
      row(
        'time',
        'Brew time',
        each(({ brew }) =>
          brew.brewSeconds === null ? NOT_SET : formatDuration(brew.brewSeconds),
        ),
        each(({ brew }) => brew.brewSeconds),
      ),
      row(
        'temp',
        'Water temperature',
        each(({ brew }) => (brew.waterTempC === null ? NOT_SET : `${brew.waterTempC} C`)),
        each(({ brew }) => brew.waterTempC),
      ),
      row(
        'grind',
        'Grind',
        each(({ brew }) => (brew.grindClicks === null ? NOT_SET : `${brew.grindClicks} clicks`)),
        each(({ brew }) => brew.grindClicks),
      ),
    ],
  };

  const cupRows: CompareRow[] = [
    row(
      'tds',
      'TDS',
      each(
        ({ brew }) =>
          `${brew.tdsPercent === null ? NOT_SET : `${brew.tdsPercent} %`}${demoMark(brew.tdsSource === 'demo' && brew.tdsPercent !== null)}`,
      ),
      each(({ brew }) => brew.tdsPercent),
    ),
    row(
      'ey',
      'Extraction yield',
      each(({ brew }, i) => {
        const ey = summaries[i]?.extractionYield ?? null;
        const isDemo = (brew.tdsSource === 'demo' || brew.yieldSource === 'demo') && ey !== null;
        return `${formatPercent(ey)}${demoMark(isDemo)}`;
      }),
      each((_, i) => summaries[i]?.extractionYield),
    ),
    row(
      'rating',
      'Overall rating',
      each(({ brew }) => (brew.rating === null ? NOT_RATED : `${brew.rating} / 5`)),
      each(({ brew }) => brew.rating),
    ),
  ];
  // The cupping scores only appear when at least one of the brews has one.
  for (const attribute of RATING_ATTRIBUTES) {
    const values = each(({ brew }) => brew.attributeRatings?.[attribute.id] ?? null);
    if (values.every((v) => v === null)) continue;
    cupRows.push(
      row(
        attribute.id,
        attribute.label,
        values.map((v) => (v === null ? NOT_RATED : `${v} / 5`)),
        values,
      ),
    );
  }
  cupRows.push(
    row(
      'tags',
      'Tags',
      each(({ brew }) => (brew.tags.length > 0 ? brew.tags.join(' · ') : 'None')),
      each(({ brew }) => [...brew.tags].sort()),
    ),
  );

  const notesGroup: CompareGroup = {
    id: 'notes',
    title: 'Notes',
    rows: [
      row(
        'notes',
        'Notes',
        each(({ brew }) => brew.notes.trim() || 'None'),
        each(({ brew }) => brew.notes.trim()),
      ),
    ],
  };

  return {
    columns,
    groups: [brewGroup, madeGroup, { id: 'cup', title: 'In the cup', rows: cupRows }, notesGroup],
  };
}

function batchWeightLoss(batch: RoastBatch | undefined): number | null {
  if (!batch || batch.greenWeightG === null || batch.roastedWeightG === null) return null;
  return weightLossPercent(batch.greenWeightG, batch.roastedWeightG);
}

/** Keeps only the rows where the brews differ, and drops groups left empty. */
export function onlyDifferences(groups: CompareGroup[]): CompareGroup[] {
  return groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.differs) }))
    .filter((g) => g.rows.length > 0);
}

export interface SelectionResult {
  ids: string[];
  /** True when the brew was not added because the limit is reached. */
  refused: boolean;
}

/** Ticks or unticks one brew. A brew can always be unticked; a new one is refused at the limit. */
export function toggleSelection(
  ids: readonly string[],
  id: string,
  max: number = MAX_COMPARE,
): SelectionResult {
  if (ids.includes(id)) return { ids: ids.filter((x) => x !== id), refused: false };
  if (ids.length >= max) return { ids: [...ids], refused: true };
  return { ids: [...ids, id], refused: false };
}
