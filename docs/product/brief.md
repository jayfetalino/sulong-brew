# Sulong Brew Lab: original brief

Saved verbatim from Jay's kickoff prompt.

---

You are the lead engineer on Sulong Brew Lab for Jay, founder of Sulong Coffee (Elmhurst, NYC). Jay is the product owner, is learning to code, and wants you to write the code. Repo: ~/sulong-brew (npm workspaces monorepo, strict TypeScript 7, Prettier, Vitest, GitHub Actions CI, branch feat/lab-0-foundations, remote origin on GitHub).

HOW TO WORK

- Work one ticket at a time, in the order below. One branch per ticket (for example feat/lab-1-app-shell), small Conventional Commits (feat:, fix:, docs:, test:, chore:).
- Before every commit run `npm run format` then `npm run check`. Never commit a red check. Never force push. Never touch main. Never delete branches. Never open a pull request.
- Push the ticket branch, then STOP and give me: what you built in under 10 lines, the commit hashes, how I can see it working (the exact command to run and what I should see), and a ready-to-paste PR title and description (what changed, why, how tested). I open the PR and merge when CI is green. Do not start the next ticket until I say "next".
- After each ticket write a short learning note in docs/learning/ (what was built, the key ideas, one thing to remember). Record important choices as short ADRs in docs/adr/ (Context, Decision, Alternatives, Consequences).
- Free tools only. Every new dependency gets a one-line cost note in the commit message. Fonts are self-hosted via npm packages (@fontsource).
- If something is unknown, leave it empty or TBD and ask me. Never invent data. Never guess Bluetooth details.
- No em-dashes in any text the app shows.

FIRST, BEFORE TICKET LAB-1 (finish LAB-0)

1. Run pwd, git status, git log --oneline, cat CLAUDE.md and summarize the state in 5 lines.
2. CI fails on `npm run format:check` because of .github/workflows/ci.yml. Run `npm run format`, then `npm run check`. Confirm packages/core/package.json has the typecheck script "tsc -p tsconfig.json --noEmit" and that packages/core/src contains only index.ts (delete any stray index.js).
3. Make sure CLAUDE.md at the repo root contains every rule in this prompt (product, stack, brand, hard rules, workflow, open decisions). Add what is missing. Save a copy of this whole brief as docs/product/brief.md.
4. Create README.md and docs/adr/001-monorepo.md, 002-free-tier-first.md, 003-skip-eslint-for-now.md (ESLint is skipped because typescript-eslint does not support TypeScript 7 yet).
5. Commit, push, then STOP and report. I will confirm CI is green, open the LAB-0 PR and merge it.

PRODUCT
Goal: repeatable brew recipes. Every brew links to the roast batch it came from, so Jay can see how roast changes show up in the cup. He uses only his own app, not vendor apps.
Part 1, private lab (his devices only): roast batches (date, Kaffelogic profile, roast level, green and roasted weight, with weight loss % and days off roast computed), versioned recipes (dose, water, temp, grind, timed pour steps with cumulative target weight), brew log (dose, yield, time, TDS, EY, rating, tags, free-text notes), later a live guide and a compare view.
Part 2, public Sulong guide: one simple page per coffee, opened by QR on the bag. Filter and Espresso tabs, roast level and date, C/F and g/oz toggles, pour-to-weight step cards with a timer. No Bluetooth, no account. One-tap publish of a frozen snapshot of one recipe version. Nothing else is public. Lab data never goes in the public part.
EY = (beverage weight g x TDS %) / dose g. Example: 310 g, 1.41 %, 20 g gives 21.9 %.

STACK AND RULES
Vite, TypeScript strict, Preact, Dexie (IndexedDB), installable PWA, local-first, no backend. JSON export with merge-import by record id, newest updatedAt wins (because Safari home-screen apps and Bluefy have separate storage). Scale and refractometer sit behind swappable driver interfaces plus a simulated scale. Web Bluetooth works in Chrome on Mac (HTTPS or localhost), not Safari; Bluefy on iPhone; Capacitor later.
Repo layout: apps/lab (private PWA), apps/guide (public static page, no heavy framework, deployable on its own), packages/core (types, pure functions, tests), packages/drivers, packages/design-tokens (brand CSS variables and logo asset), data/seeds, data/samples, docs/adr, docs/product, docs/protocols, docs/learning. The guide app must stay independent so it can move to its own public repo later.

DATA MODEL
Coffee, RoastBatch, Recipe with immutable RecipeVersions (steps: pour/pause/steep/drawdown, cumulative target weight, optional temp, optional Switch valve state, note), Brew (references recipe version and roast batch). Grind: private grinder clicks versus a public plain-English description. Every record has id, createdAt, updatedAt.

BRAND
Obsidian #2B2D1F, Harvest Gold #C9A84C, Pale Cream #F2EAD3. Fonts Fraunces (display), Inter (body), IBM Plex Mono (data). The lab is dark, the public guide is cream. The logo SVG is not in the repo yet: use a placeholder box and never redraw it. Do not edit the logo file when it arrives.

SEED DATA
Coffees: Peru Gesha dry process (light), Peru Gesha washed (light), Ethiopia Buku Abel dry process (light), Rwanda Rulindo Tumba Lot 2 (medium), Colombia Inza Cresta El Hato (medium-dark, espresso-primary), Ethiopia Duromina Aba Bulgu dry process (medium-dark, espresso-primary).
Recipes:

- The Sulong Pour (1:15.5): 20 g / 310 g, 91 C, medium-fine. 0:00 bloom to 40 g, one gentle swirl; 0:40 spiral to 220 g; 1:20 the breath, pause at 220 g; 1:27 pour to 310 g; 1:55 drawdown; finish 3:00-3:20.
- The Downshift (1:16): 20 g / 320 g, 92 C. Cumulative weights: 0:00 bloom 40; 0:45 140; 1:15 220; 1:45 280; 2:10 320; finish 2:35-3:00.
- The Step-Down (1:16): 20 g / 320 g. 0:00 bloom 40 g at 94 C; 0:45 to 180 g at 91 C; 1:30 to 320 g at 88 C; finish 2:00-2:45. Needs staged kettle temps.
- The Still Pour (1:16, immersion): 20 g / 320 g. 0:00 bloom 40 g; 0:45 fill to 320 g, no spiral; 1:00 one firm stir (3-4 rotations); static 1:00-2:30; 2:30 open valve; finish 3:15-3:45.
- Sulong Switch Standard (1:16): 15 g / 240 g, medium-fine. 0:00 lever closed, bloom 30 g; 0:45 to 120 g; 1:30 to 210 g; 2:00 to 240 g; 2:15 open lever; finish 3:15-3:45. WATER TEMP IS UNKNOWN: leave it empty (null) and ask Jay. Do not invent it.

GEAR (context only)
iPhone 17 Pro, MacBook. Hario V60 and Switch. Eureka Oro Mignon (espresso), Timemore Chestnut S5 Pro (pour-over). Scale undecided (Bookoo Themis Ultra or DiFluid Microbalance Ti). Refractometer DiFluid R2 Extract (TDS typed by hand). Roaster Kaffelogic Nano 7.

TICKETS (MVP path, in this order)
LAB-1 design-tokens and lab app shell: brand CSS variables, self-hosted fonts, dark lab shell with a bottom tab bar (Roasts, Recipes, Brews), logo placeholder, runs on Mac via the Vite dev server and on iPhone over the local network.
LAB-2 core types and math with tests: weight loss %, days off roast, extraction yield (check the 310 g / 1.41 % / 20 g = 21.9 % example), JSON merge logic (by id, newest updatedAt wins).
LAB-3 Dexie database and seeds: load the coffees and recipes above from data/seeds on first run.
LAB-4 Roast batches: list, create, edit, computed weight loss and days off roast.
LAB-5 Recipes: list, step editor, immutable versions.
LAB-6 Brew log: pick recipe version and roast batch, enter dose/yield/time/TDS, auto EY, rating, tags, notes.
LAB-7 Public guide, first page: apps/guide static page for The Sulong Pour with Filter and Espresso tabs, C/F and g/oz toggles, step cards and a timer, cream theme, no framework, no Bluetooth, no account. Built from a frozen snapshot of one recipe version.
LAB-8 JSON export and merge-import.
LAB-9 PWA install and free HTTPS deploy (verify free-tier limits before depending on them and record the choice in an ADR).
LATER, NOT NOW: Bluetooth scale and refractometer drivers, live guide, compare view, Kaffelogic .klog import, QR codes, public ratings (need a backend).

OPEN DECISIONS (ask Jay, never decide alone)
Switch hybrid water temp, logo SVG file, rating design, whether first crack is logged anywhere, scale choice, domain before printing QR codes, one repo or two.
Kaffelogic facts: .klog boost_load_size is the batch-size setting, not measured green weight. There is no first-crack marker, bean name, roasted weight or notes in the file. The date 04/10/2026 is ambiguous (Oct 4 or Apr 10): ask Jay.

START NOW with "FIRST, BEFORE TICKET LAB-1" above, then stop and report.
