# ADR-001: npm workspaces monorepo

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Sulong Brew has two apps, the Lab (`apps/lab`) and the Guide (`apps/guide`). They share code: core logic, drivers and design tokens. They must still deploy separately, because each has its own release cadence and hosting target. The Guide may also move into its own public repository later, so the boundary between the apps has to stay clean.

## Decision

Use a single repository organized as an **npm workspaces** monorepo:

- `apps/*` holds deployable apps (`lab`, `guide`).
- `packages/*` holds shared libraries (`core`, `drivers`, `design-tokens`), published inside the repo under the `@sulong/` scope.
- One root `package.json`, lockfile, Prettier config, strict `tsconfig.base.json` and CI workflow cover every workspace.
- Apps depend on packages only through their package names, never through relative paths into another workspace. This keeps the Guide easy to move out later.

## Alternatives

- **Separate repositories per app and package.** This gives the cleanest isolation, but shared code would have to be published and versioned before every change, and a cross-cutting change would need several pull requests.
- **A single app with two entry points.** This is simpler at first, but it makes separate deployment awkward and makes it hard to split the Guide out later.
- **pnpm workspaces, Turborepo or Nx.** These have stronger tooling, but they add a dependency and new concepts that the project does not need yet. npm ships with Node.

## Consequences

- A shared change lands in one commit and one pull request, and `npm run check` validates every workspace together.
- Each app needs its own build and deploy configuration.
- To split the Guide out, its imports must stay limited to `@sulong/*` packages. Those packages would then be published or vendored into the new repository.
- If build times grow, we can add a task runner (such as Turborepo) later without changing the workspace layout.
