# ADR-008: Brew rating design

- **Status:** Accepted (attribute list open to change)
- **Date:** 2026-11-10

## Context

Jay wants an overall 1 to 5 rating, and also scores for things like sweetness, in the spirit of cupping. Ratings by other people (public ratings) need a backend, which is out of scope for now.

## Decision

- Overall rating: 1 to 5 in half steps, optional.
- Cupping-style scores: Sweetness, Acidity, Body, Balance, Aftertaste, Clarity. Each is 1 to 5 in half steps and optional. They sit in a collapsed "Cupping notes" section so a quick log stays quick.
- Descriptors such as "jasmine" or "bright" go in free tags and notes, not scores.
- Attribute scores are stored as a map from attribute id to score (`attributeRatings`). The list lives in one constant in `packages/core`, so adding or renaming an attribute needs no database migration.
- Everything is private to the lab. Nothing about ratings goes in the public guide.

## Alternatives

- **Full SCA 100-point cupping form:** ten calibrated attributes and a trained scale. Too slow for daily brews and not meaningful without calibration.
- **Overall score only:** fastest, but cannot show how a recipe change moved sweetness versus acidity.
- **1 to 10 or 1 to 100:** more resolution than a single person can reliably tell apart.

## Consequences

- Removing an attribute from the list hides it in the form, but old scores stay stored under their id.
- Half steps give nine values per score. Scores are chosen from a list, so typos are not possible.
- Public or multi-person ratings are a separate future feature that needs a backend.
