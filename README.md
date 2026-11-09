# Sulong Brew

Sulong Brew is a TypeScript monorepo for two apps, the Lab and the Guide, plus the packages they share. Each app deploys on its own. Everything runs on free tools, with no backend, and user data stays on the device (see [ADR-002](docs/adr/002-free-tier-first.md)).

## The five parts

| Path                     | What it is                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `apps/lab`               | The Lab app. Deployed separately from the Guide.                                              |
| `apps/guide`             | The Guide app. Deployed separately, and may later move to its own public repository.          |
| `packages/core`          | Shared logic and types used by both apps (`@sulong/core`).                                    |
| `packages/drivers`       | Adapters that connect the core to the outside world, such as device storage and data sources. |
| `packages/design-tokens` | Shared design values (colors, type, spacing) so both apps look consistent.                    |

The repo is an npm workspaces monorepo. See [ADR-001](docs/adr/001-monorepo.md) for why.

## Commands

Run all commands from the repo root. CI runs on Node 24.

| Command          | What it does                                                         |
| ---------------- | -------------------------------------------------------------------- |
| `npm install`    | Installs dependencies for every workspace.                           |
| `npm run check`  | Runs the format check, TypeScript typecheck and Vitest tests (= CI). |
| `npm run format` | Rewrites all files with Prettier.                                    |

## Working rules

- **Never work on `main`.** Do each piece of work on a feature branch (for example `feat/lab-0-foundations`) and merge it through a pull request.
- **Keep `npm run check` green.** Run `npm run format` and then `npm run check` before every commit. CI runs the same checks on every push and pull request.
- **Use Conventional Commits.** Prefix each commit with `feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `style:` or `test:`, and keep each commit to one change.
- **Keep TypeScript strict.** All packages extend `tsconfig.base.json`, and typechecks never write output files.
- **Use free tools first.** Do not add a paid service or a backend without a new ADR ([ADR-002](docs/adr/002-free-tier-first.md)).
- **Record decisions as ADRs.** Add significant or hard-to-reverse decisions to `docs/adr/` using the sections Context, Decision, Alternatives and Consequences.

## Architecture decisions

- [ADR-001: npm workspaces monorepo](docs/adr/001-monorepo.md)
- [ADR-002: Free tier first](docs/adr/002-free-tier-first.md)
- [ADR-003: Skip ESLint for now](docs/adr/003-skip-eslint-for-now.md)
