import { describe, expect, it } from 'vitest';
import seedVersions from '../../../data/seeds/recipe-versions.json';
import seedRecipes from '../../../data/seeds/recipes.json';
import sulongPour from '../../../apps/guide/src/snapshots/01-the-sulong-pour.json';
import downshift from '../../../apps/guide/src/snapshots/02-the-downshift.json';
import stepDown from '../../../apps/guide/src/snapshots/03-the-step-down.json';
import stillPour from '../../../apps/guide/src/snapshots/04-the-still-pour.json';
import switchStandard from '../../../apps/guide/src/snapshots/05-sulong-switch-standard.json';
import { createGuideSnapshot } from './guideSnapshot';
import type { RecipeVersion } from './types';

const sulongPourV1 = (seedVersions as RecipeVersion[]).find((v) => v.id === 'rv-sulong-pour-1');

describe('createGuideSnapshot', () => {
  it('copies only the public fields', () => {
    const version = {
      ...(sulongPourV1 as RecipeVersion),
      grindClicks: 24,
      notes: 'private lab note',
    };
    const snapshot = createGuideSnapshot({
      recipeName: 'The Sulong Pour',
      version,
      coffee: null,
      publishedAt: new Date('2026-11-10T00:00:00Z'),
    });

    expect(Object.keys(snapshot).sort()).toEqual(
      [
        'coffee',
        'doseG',
        'espresso',
        'finishSecondsMax',
        'finishSecondsMin',
        'grindDescription',
        'publishedAt',
        'recipeName',
        'schemaVersion',
        'steps',
        'versionNumber',
        'waterG',
        'waterTempC',
      ].sort(),
    );

    const text = JSON.stringify(snapshot);
    expect(text).not.toContain('grindClicks');
    expect(text).not.toContain('private lab note');
    expect(text).not.toContain(version.id);
    expect(text).not.toContain(version.recipeId);
  });

  it('is frozen: later edits to the version do not change a snapshot already made', () => {
    const version = structuredClone(sulongPourV1 as RecipeVersion);
    const snapshot = createGuideSnapshot({
      recipeName: 'The Sulong Pour',
      version,
      coffee: null,
      publishedAt: new Date('2026-11-10T00:00:00Z'),
    });
    version.doseG = 99;
    (version.steps[0] as { targetWeightG: number | null }).targetWeightG = 999;
    expect(snapshot.doseG).toBe(20);
    expect(snapshot.steps[0]?.targetWeightG).toBe(40);
  });

  it('keeps unknown values empty, never guessed', () => {
    const snapshot = createGuideSnapshot({
      recipeName: 'Sulong Switch Standard',
      version: (seedVersions as RecipeVersion[]).find(
        (v) => v.id === 'rv-switch-standard-1',
      ) as RecipeVersion,
      coffee: null,
      publishedAt: new Date('2026-11-10T00:00:00Z'),
    });
    expect(snapshot.waterTempC).toBeNull();
    expect(snapshot.coffee).toBeNull();
    expect(snapshot.espresso).toBeNull();
  });

  // Every snapshot committed in apps/guide must equal what the lab would publish from the seed.
  // When a new snapshot file is added to apps/guide/src/snapshots, add it to this list.
  it.each([
    ['rv-sulong-pour-1', sulongPour],
    ['rv-downshift-1', downshift],
    ['rv-step-down-1', stepDown],
    ['rv-still-pour-1', stillPour],
    ['rv-switch-standard-1', switchStandard],
  ])('committed guide snapshot for %s matches the seed', (versionId, committed) => {
    const version = (seedVersions as RecipeVersion[]).find((v) => v.id === versionId);
    const recipe = (seedRecipes as { id: string; name: string }[]).find(
      (r) => r.id === version?.recipeId,
    );
    const rebuilt = createGuideSnapshot({
      recipeName: recipe?.name as string,
      version: version as RecipeVersion,
      coffee: null,
      publishedAt: new Date(committed.publishedAt),
    });
    expect(committed).toEqual(rebuilt);
  });
});
