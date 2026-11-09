# ADR-002: Free tier first

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Sulong Brew is an independent project with no budget for running costs. Every paid service or server becomes a recurring bill, something to maintain and a way to lose user data. The apps can do their job without a server.

## Decision

- **Free tools first.** Use free tiers and open-source tools for hosting, CI and tooling. A paid service needs a new ADR.
- **No backend.** Both apps are static and run entirely in the browser.
- **Data on device.** User data is stored locally on the user's device and never sent to a server we run.
- **Self-hosted fonts.** Fonts ship with the apps instead of loading from a third-party font CDN. This avoids tracking and outside dependencies, and keeps the apps working offline.
- **Public visitor ratings are deferred.** Shared ratings would need a backend and moderation, so they are out of scope until a later ADR revisits them.
- **The domain name is the one expected cost.**

## Alternatives

- **A small hosted backend (serverless functions plus a managed database).** This would allow sync and public ratings, but it adds cost, privacy obligations and operational work.
- **A Backend-as-a-Service free tier (such as Firebase or Supabase).** It is free to start, but it brings vendor lock-in, quota limits and personal data stored off the device.
- **Fonts from Google Fonts or another CDN.** This is easier to set up, but it makes an outside request on every visit and does not work offline.

## Consequences

- Hosting is cheap and simple (static hosting), and there is no server to secure or keep running.
- Privacy is strong by default, because user data never leaves the device.
- There is no sync between devices, and data can be lost if the user clears browser storage. Export and import must be built into the apps.
- Public ratings and other social features wait for a future decision.
- Font files are committed to the repo and must be license-compatible with self-hosting.
