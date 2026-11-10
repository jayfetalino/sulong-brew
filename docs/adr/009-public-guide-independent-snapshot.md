# ADR-009: Public guide is independent and built from a frozen snapshot

- **Status:** Accepted
- **Date:** 2026-11-10

## Context

The guide is public and opened by QR code on a bag, often on a phone with a weak connection. Lab data (brews, ratings, roast weights, grinder clicks) must never reach it. The guide may later move to its own public repo. The one-repo-or-two question is still open (Jay decides).

## Decision

- `apps/guide` is a plain TypeScript and CSS page built with Vite. No UI framework. Its only runtime dependencies are the three `@fontsource` font packages.
- It imports nothing from other folders in this repo. Its tsconfig does not extend the root one. Brand colors and the logo are local copies.
- Its content comes from one JSON file, `src/snapshot.json`: a frozen copy of one recipe version, made by `createGuideSnapshot` in `packages/core`, which copies an explicit allow-list of fields.
- A test rebuilds the snapshot from the lab seed and checks the committed file matches. Another test checks that private fields cannot appear.
- Unit choices (C/F, g/oz) are remembered in localStorage on the visitor's device. They are not sent anywhere.

## Alternatives

- **Preact for the guide:** shared code with the lab, but a larger download and a tie to the lab's build.
- **Import the design-tokens package:** no duplication, but the guide could not move out on its own.
- **Fetch the snapshot from the lab at runtime:** needs a backend and risks exposing more than intended.

## Consequences

- Brand colors exist in two places and must be changed in both.
- Updating the guide means regenerating the snapshot and redeploying. This is intended: a published guide never changes by accident.
- The `coffee` field is empty until Jay decides which coffee and roast date go on the bag, and the Espresso tab says "coming soon" until an espresso recipe exists.
