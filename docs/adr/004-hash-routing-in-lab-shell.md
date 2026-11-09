# ADR-004: Hash routing for the lab shell

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

The lab has three tabs (Roasts, Recipes, Brews) and will be a static PWA with no backend. It must work from any static host and from the Vite dev server on a phone, with the browser back button behaving sensibly.

## Decision

Use the URL hash (`#/roasts`, `#/recipes`, `#/brews`) for tab state, with about 20 lines of code and no router library.

## Alternatives

- **A router library (preact-iso, wouter):** more features than three tabs need, and one more dependency to keep up to date.
- **History API paths (`/roasts`):** needs host rewrite rules so a reload on `/roasts` does not return 404. Hash routes need none.
- **Plain component state:** simplest, but the back button and reload would lose the current tab.

## Consequences

- Works on any static host with no server config.
- Links to a tab are shareable on the same device.
- If routes get nested (editing a recipe step, for example), revisit and consider a small router then.
