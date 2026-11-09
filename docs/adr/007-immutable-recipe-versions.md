# ADR-007: Immutable recipe versions

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Every brew must point at the exact recipe used, so Jay can compare brews fairly. If a recipe could be edited in place, an old brew would silently change meaning. Recipes are also published to the public guide as frozen snapshots of one version.

## Decision

- A `Recipe` is a named container. Its content lives in `RecipeVersion` records, numbered 1, 2, 3.
- A saved version is never changed. Editing a recipe creates a new version and moves `Recipe.currentVersionId` to it.
- The database layer writes versions with `add` (which fails if the id exists), never `put`.
- If an edit changes nothing, no version is created. If only the name changes, only the recipe is updated.
- Deleting a recipe is a soft delete (ADR-006) and keeps its versions, because brews point at them.

## Alternatives

- **Edit in place with a history log:** more code, and brews could still point at changed data.
- **Copy the recipe into each brew:** brews would be self-contained, but comparing "same recipe, different brew" would need text matching.

## Consequences

- Version numbers are chosen as "highest existing plus one" on the device. If two devices each add a version 2 before syncing, both records survive a merge with the same number but different ids. This is harmless but may look odd, and the recipe points at whichever edit was newest.
- Versions pile up over time. That is cheap, and it is the point.
- There is no way to edit a typo in an old version. Fix it by saving a new version.
