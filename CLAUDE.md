# Sulong Brew Lab

Lead engineer notes for Claude. Jay (founder of Sulong Coffee, Elmhurst, NYC) is the product owner, is learning to code, and wants Claude to write the code. The full original brief is in `docs/product/brief.md`.

## Product

Goal: repeatable brew recipes. Every brew links to the roast batch it came from, so Jay can see how roast changes show up in the cup. He uses only his own app, not vendor apps.

**Part 1, private lab (his devices only):** roast batches (date, Kaffelogic profile, roast level, green and roasted weight, with weight loss % and days off roast computed), versioned recipes (dose, water, temp, grind, timed pour steps with cumulative target weight), brew log (dose, yield, time, TDS, EY, rating, tags, free-text notes), later a live guide and a compare view.

**Part 2, public Sulong guide:** one simple page per coffee, opened by QR on the bag. Filter and Espresso tabs, roast level and date, C/F and g/oz toggles, pour-to-weight step cards with a timer. No Bluetooth, no account. One-tap publish of a frozen snapshot of one recipe version. Nothing else is public. Lab data never goes in the public part.

EY = (beverage weight g x TDS %) / dose g. Example: 310 g, 1.41 %, 20 g gives 21.9 %.

## Stack and rules

- Vite, TypeScript strict (TypeScript 7), Preact, Dexie (IndexedDB), installable PWA, local-first, no backend.
- JSON export with merge-import by record id, newest `updatedAt` wins (Safari home-screen apps and Bluefy have separate storage).
- Scale and refractometer sit behind swappable driver interfaces plus a simulated scale.
- Web Bluetooth works in Chrome on Mac (HTTPS or localhost), not Safari; Bluefy on iPhone; Capacitor later.
- Prettier, Vitest, GitHub Actions CI. ESLint is skipped for now (ADR 003).

## Repo layout

- `apps/lab`: private PWA
- `apps/guide`: public static page, no heavy framework, deployable on its own. Must stay independent so it can move to its own public repo later.
- `packages/core`: types, pure functions, tests
- `packages/drivers`: scale and refractometer driver interfaces
- `packages/design-tokens`: brand CSS variables and logo asset
- `data/seeds`, `data/samples`
- `docs/adr`, `docs/product`, `docs/protocols`, `docs/learning`

## Data model

Coffee, RoastBatch, Recipe with immutable RecipeVersions (steps: pour/pause/steep/drawdown, cumulative target weight, optional temp, optional Switch valve state, note), Brew (references recipe version and roast batch). Grind: private grinder clicks versus a public plain-English description. Every record has `id`, `createdAt`, `updatedAt`.

## Brand

Obsidian #2B2D1F, Harvest Gold #C9A84C, Pale Cream #F2EAD3. Fonts: Fraunces (display), Inter (body), IBM Plex Mono (data), self-hosted via @fontsource npm packages. The lab is dark, the public guide is cream. The logo SVG is not in the repo yet: use a placeholder box, never redraw it, and never edit the logo file when it arrives.

## Seed data

Coffees: Peru Gesha dry process (light), Peru Gesha washed (light), Ethiopia Buku Abel dry process (light), Rwanda Rulindo Tumba Lot 2 (medium), Colombia Inza Cresta El Hato (medium-dark, espresso-primary), Ethiopia Duromina Aba Bulgu dry process (medium-dark, espresso-primary).

Recipes:

- The Sulong Pour (1:15.5): 20 g / 310 g, 91 C, medium-fine. 0:00 bloom to 40 g, one gentle swirl; 0:40 spiral to 220 g; 1:20 the breath, pause at 220 g; 1:27 pour to 310 g; 1:55 drawdown; finish 3:00-3:20.
- The Downshift (1:16): 20 g / 320 g, 92 C. Cumulative weights: 0:00 bloom 40; 0:45 140; 1:15 220; 1:45 280; 2:10 320; finish 2:35-3:00.
- The Step-Down (1:16): 20 g / 320 g. 0:00 bloom 40 g at 94 C; 0:45 to 180 g at 91 C; 1:30 to 320 g at 88 C; finish 2:00-2:45. Needs staged kettle temps.
- The Still Pour (1:16, immersion): 20 g / 320 g. 0:00 bloom 40 g; 0:45 fill to 320 g, no spiral; 1:00 one firm stir (3-4 rotations); static 1:00-2:30; 2:30 open valve; finish 3:15-3:45.
- Sulong Switch Standard (1:16): 15 g / 240 g, medium-fine. 0:00 lever closed, bloom 30 g; 0:45 to 120 g; 1:30 to 210 g; 2:00 to 240 g; 2:15 open lever; finish 3:15-3:45. **Water temp is unknown: leave it null and ask Jay.**

## Gear (context only)

iPhone 17 Pro, MacBook. Hario V60 and Switch. Eureka Oro Mignon (espresso), Timemore Chestnut S5 Pro (pour-over). Scale undecided (Bookoo Themis Ultra or DiFluid Microbalance Ti). Refractometer DiFluid R2 Extract (TDS typed by hand). Roaster Kaffelogic Nano 7.

## Hard rules

- Free tools only. Every new dependency gets a one-line cost note in the commit message.
- If something is unknown, leave it empty or TBD and ask Jay. Never invent data. Never guess Bluetooth details.
- No em-dashes in any text the app shows.
- Lab data never goes in the public guide.
- Never force push. Never touch main. Never delete branches. Never open a pull request.
- Never commit a red check.

## Workflow

- One ticket at a time, in order. One branch per ticket (for example `feat/lab-1-app-shell`), small Conventional Commits (feat:, fix:, docs:, test:, chore:).
- Before every commit run `npm run format` then `npm run check`.
- Push the ticket branch, then STOP and report: what was built in under 10 lines, the commit hashes, how Jay can see it working (exact command and expected result), and a ready-to-paste PR title and description (what changed, why, how tested). Jay opens the PR and merges when CI is green. Do not start the next ticket until Jay says "next".
- After each ticket write a short learning note in `docs/learning/` (what was built, key ideas, one thing to remember). Record important choices as short ADRs in `docs/adr/` (Context, Decision, Alternatives, Consequences).

## Tickets (MVP path, in order)

- LAB-0 foundations (monorepo, tooling, CI, docs)
- LAB-1 design-tokens and lab app shell: brand CSS variables, self-hosted fonts, dark shell with bottom tab bar (Roasts, Recipes, Brews), logo placeholder, runs on Mac via Vite dev server and on iPhone over the local network
- LAB-2 core types and math with tests: weight loss %, days off roast, extraction yield (310 g / 1.41 % / 20 g = 21.9 %), JSON merge logic (by id, newest updatedAt wins)
- LAB-3 Dexie database and seeds from `data/seeds` on first run
- LAB-4 Roast batches: list, create, edit, computed weight loss and days off roast
- LAB-5 Recipes: list, step editor, immutable versions
- LAB-6 Brew log: pick recipe version and roast batch, enter dose/yield/time/TDS, auto EY, rating, tags, notes
- LAB-7 Public guide first page: `apps/guide` static page for The Sulong Pour, Filter and Espresso tabs, C/F and g/oz toggles, step cards and timer, cream theme, no framework, no Bluetooth, no account, built from a frozen snapshot of one recipe version
- LAB-8 JSON export and merge-import
- LAB-9 PWA install and free HTTPS deploy (verify free-tier limits first, record the choice in an ADR)

Refractometer integration (DiFluid R2), in order. Jay does not own an R2 yet, and DiFluid publishes no public Bluetooth protocol (see `docs/protocols/difluid-r2.md`, all TBD):

- LAB-10 `packages/drivers`: `Refractometer` interface, labelled simulated device, `bluetoothSupport()`, shared contract test (done)
- LAB-11 lab brew form "Read from refractometer" using the demo device, `tdsSource` on Brew, visible "Demo reading" badge (done)
- LAB-12 public guide section "Measure your brew" (formula and the 310 g / 1.41 % / 20 g = 21.9 % example, no Bluetooth, neutral wording) (done)
- Outreach pack: `docs/partners/difluid-outreach.md`, a draft for Jay to send (Claude never sends it). Send only the public guide, disclose any discount, ask DiFluid for their protocol or SDK
- LAB-13 real DiFluid R2 driver: BLOCKED until DiFluid supplies the protocol and Jay has a device. Build only from documented values

Later, not now: Bluetooth scale driver, live guide, compare view, Kaffelogic .klog import, QR codes, public ratings (need a backend).

## Open decisions (ask Jay, never decide alone)

- Switch hybrid water temp
- Logo SVG file
- Rating attribute list (decided in ADR-008: overall 1 to 5 plus six cupping-style scores; Jay can still change the list)
- Whether first crack is logged anywhere
- Scale choice
- Domain, before printing QR codes
- One repo or two
- Kaffelogic facts: `.klog` `boost_load_size` is the batch-size setting, not measured green weight. There is no first-crack marker, bean name, roasted weight or notes in the file. The date 04/10/2026 is ambiguous (Oct 4 or Apr 10): ask Jay.
