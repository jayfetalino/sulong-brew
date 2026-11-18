import type { BrewDraft } from '@sulong/core';

// A live brew ends on one screen and the brew form opens on another. This holds the
// measurements in between. It lives only in memory and can be taken once, so a draft
// can never reappear later by accident.

let pending: BrewDraft | null = null;

export function setBrewDraft(draft: BrewDraft): void {
  pending = draft;
}

/** Returns the waiting draft and forgets it. Null if there is none. */
export function takeBrewDraft(): BrewDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
