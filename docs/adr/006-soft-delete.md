# ADR-006: Soft delete with deletedAt

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Jay's data lives in several browsers (Mac, Safari, home-screen app, Bluefy) and is combined by merge-import, where the newest `updatedAt` wins. If a delete simply removed the record, the next import from a device that still had it would bring it back. The app needs a delete that survives merging.

## Decision

Every record may carry `deletedAt`. Deleting sets `deletedAt` and moves `updatedAt` to the same time, and the record stays in the database. Lists hide records where `deletedAt` is set. Merge needs no special rules: the deletion is the newest change, so it wins.

## Alternatives

- **Hard delete:** simplest, but deleted records return on merge.
- **A separate list of deleted ids:** works, but adds a second thing to export, import and keep in sync.
- **No delete, archive only:** safe, but clutters lists and was not what Jay asked for.

## Consequences

- Deleted records still take a little space and appear in JSON exports. They are small, so this is fine.
- An edit made on another device after the deletion will bring the record back, because it is newer. That is the intended "newest wins" rule.
- Every list and every query must hide deleted records. New screens must remember to filter with `isDeleted`.
- Records that point at a deleted record (for example a brew that points at a deleted roast batch) keep their link. Screens must handle a deleted target without breaking.
