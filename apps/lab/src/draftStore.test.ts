import { describe, expect, it } from 'vitest';
import type { BrewDraft } from '@sulong/core';
import { setBrewDraft, takeBrewDraft } from './draftStore';

const draft: BrewDraft = {
  recipeVersionId: 'rv-sulong-pour-1',
  doseG: 20,
  yieldG: 287.5,
  brewSeconds: 195,
  waterTempC: 91,
  grindClicks: null,
  yieldSource: 'demo',
};

describe('draftStore', () => {
  it('hands over a draft once, then forgets it', () => {
    setBrewDraft(draft);
    expect(takeBrewDraft()).toEqual(draft);
    expect(takeBrewDraft()).toBeNull();
  });

  it('is empty when nothing was set', () => {
    expect(takeBrewDraft()).toBeNull();
  });

  it('keeps only the newest draft', () => {
    setBrewDraft(draft);
    setBrewDraft({ ...draft, yieldG: 300 });
    expect(takeBrewDraft()?.yieldG).toBe(300);
  });
});
