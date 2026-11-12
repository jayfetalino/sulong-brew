# ADR-005: Dexie for storage, with a seed marker

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

The lab is local-first with no backend, so data must live in the browser and survive restarts. The starter coffees and recipes must appear on first run, with the same ids on every device so a later merge-import does not create duplicates. If Jay deletes a seeded coffee, it must not come back.

## Decision

- Use Dexie (a small, free wrapper over IndexedDB) with one table per record type, plus a `meta` table.
- Seeds are plain JSON files in `data/seeds` with fixed ids and fixed timestamps.
- On first run, load all seeds in one transaction and store a `seeded-v1` marker in `meta`. If the marker exists, never seed again.

## Alternatives

- **Seed whenever a table is empty:** a deleted coffee would return if it was the last one, and an empty table could be a real user choice.
- **Raw IndexedDB:** no extra dependency, but much more code to write and test.
- **localStorage:** too small and too slow for brew logs, and has no indexes.

## Consequences

- Changing a seed later does not update existing installs. A new seed set would need a new marker (for example `seeded-v2`) and a merge step.
- Because ids and timestamps are fixed, two devices seeded separately agree, and merge-import treats them as the same records.
- Tests use `fake-indexeddb` (dev only) so the database logic runs in plain Node.
