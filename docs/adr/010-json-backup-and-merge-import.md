# ADR-010: JSON backup and merge-import

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

The lab has no backend, and each browser (Mac Chrome, Safari, the home-screen app, Bluefy) keeps its own separate database. Jay needs to move data between them and keep a backup. Combining must never lose a newer edit and must handle deletions.

## Decision

- **One JSON file** holds every table (coffees, roast batches, recipes, recipe versions, brews), including deleted records, plus `app`, `formatVersion` and `exportedAt`. The bookkeeping table is not exported.
- **Strict reading.** The file is treated as untrusted. Every record is checked (id, timestamps, key fields). One bad record rejects the whole file with a message naming the table and record, so nothing is half imported. A file from a newer format version is refused.
- **Preview before applying.** Importing first shows, per table, how many records are new, newer, or unchanged. Nothing is written until Jay confirms. If there is nothing to change, there is no import button.
- **Merge rule:** by `id`, newest `updatedAt` wins, ties keep the local copy (ADR-006 deletions are ordinary newer changes). An import can add or update records, but never replaces a newer local record with an older one.
- **One transaction.** All writes happen together; if anything fails, nothing changes.
- **Moving the file** is manual: download it, or use the phone's share sheet (AirDrop, Files). There is no automatic sync.
- Backup files are ignored by git (`sulong-lab-backup-*.json`), because they contain all private lab data.

## Alternatives

- **Replace everything on import:** simple, but would silently throw away newer work.
- **Automatic sync through a server or cloud drive:** convenient, but needs a backend and is out of scope (free tier, local-first).
- **Per-field merging:** finer, but far more complex, and "newest record wins" is enough for one person on a few devices.

## Consequences

- "Newest wins" trusts each device's clock. If a phone clock is badly wrong, its edits can look newer or older than they are.
- If the same record is edited on two devices before syncing, one of the two edits is lost (the older one). Sync often.
- Two devices that each add a version 2 of the same recipe will both keep their copy (ADR-007).
- Backups include everything, so treat the file as private.
- The seeds use fixed ids and timestamps, so seeded records on two devices merge as unchanged ties.
