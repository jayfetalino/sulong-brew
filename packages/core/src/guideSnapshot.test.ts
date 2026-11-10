import { describe, expect, it } from 'vitest';
import seedVersions from '../../../data/seeds/recipe-versions.json';
import guideSnapshot from '../../../apps/guide/src/snapshot.json';
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

  it('matches the snapshot committed in apps/guide (rebuilt from the seed)', () => {
    const rebuilt = createGuideSnapshot({
      recipeName: 'The Sulong Pour',
      version: sulongPourV1 as RecipeVersion,
      coffee: null,
      publishedAt: new Date(guideSnapshot.publishedAt),
    });
    expect(guideSnapshot).toEqual(rebuilt);
  });
});
