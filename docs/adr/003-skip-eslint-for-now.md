# ADR-003: Skip ESLint for now

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

The repo uses TypeScript 7 with a strict base config. Linting TypeScript with ESLint requires `typescript-eslint`, which does not support TypeScript 7 yet. Installing it now would mean pinning an older TypeScript, hitting peer-dependency conflicts, or running a linter that may misparse code or crash.

## Decision

Do not add ESLint for now. Code quality relies on:

- strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`) through `npm run typecheck`,
- Prettier for formatting (`npm run format:check`), and
- Vitest tests (`npm test`).

All three run in `npm run check` and in CI.

## Alternatives

- **Downgrade to a TypeScript version that `typescript-eslint` supports.** This would let ESLint run, but it gives up TypeScript 7 just to run a linter.
- **Use ESLint without type-aware TypeScript rules.** It would still need the TypeScript parser, so the same compatibility problem applies.
- **Use a different linter (such as Biome or oxlint).** These are possible, but adding a new tool deserves its own decision, and the strict compiler already catches the most important problems.

## Consequences

- Lint-only rules (unused imports beyond what `tsc` reports, import ordering, React hooks rules and similar) are not enforced. Reviewers need to watch for these.
- Tooling stays smaller and faster.
- Revisit this decision once `typescript-eslint` supports TypeScript 7. Adding ESLint should then become a new ADR that supersedes this one.
