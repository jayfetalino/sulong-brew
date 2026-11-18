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

iPhone 17 Pro, MacBook. Hario V60 and Switch. Eureka Oro Mignon (espresso), Timemore Chestnut S5 Pro (pour-over). Scale: DiFluid Microbalance Ti (decided 2026-11-16, not yet owned). Refractometer: DiFluid R2 Extract (not yet owned; TDS is typed by hand until then). Roaster Kaffelogic Nano 7.

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

Refractometer integration (DiFluid R2), in order. Jay does not own an R2 yet. DiFluid's official open-source SDK documentation (MIT, https://github.com/DiFluid/difluid-sdk-demo) describes the protocol; what it says, what it does not state, and what must be verified on a real device are in `docs/protocols/` (`difluid-frame-format.md`, `difluid-r2.md`, `difluid-microbalance-ti.md`). The R2's Bluetooth service ID is not in the public documents; DiFluid support answered by email on 2026-11-18 that it is the same service and channel as the Microbalance Ti, with a device name starting "DiFluid R2 " (recorded in `docs/protocols/difluid-frame-format.md`, unverified on a device). Build only from DiFluid's documents and replies, never from third-party projects:

- LAB-10 `packages/drivers`: `Refractometer` interface, labelled simulated device, `bluetoothSupport()`, shared contract test (done)
- LAB-11 lab brew form "Read from refractometer" using the demo device, `tdsSource` on Brew, visible "Demo reading" badge (done)
- LAB-12 public guide section "Measure your brew" (formula and the 310 g / 1.41 % / 20 g = 21.9 % example, no Bluetooth, neutral wording) (done)
- Outreach: DiFluid approved a developer discount for Jay. Program terms and emails are NOT kept in this repo (unknown whether the repo is private). Anything public that names DiFluid devices must disclose the discount. Claude never sends messages for Jay. DiFluid's rebate process (per DiFluid, 2026-11-16): after the project is officially launched, Jay shares development results (a project link or a demo video); after review and approval DiFluid sends a link to submit the rebate application. DiFluid support answered the open protocol questions on 2026-11-18 (R2 service and name, cleartext channel, negative weights "sent in the same way as normal weights"). The encoding of negative weights is still not named, so top-bit weights stay refused until a real scale confirms the signed reading
- LAB-13 real DiFluid R2 driver: unblocked by DiFluid's answer. Reuse `WebBluetoothTransport` with service `000000DD-...`, channel AA01 and the name prefix "DiFluid R2" (the Ti shares the service, so the name prefix is what tells them apart). Written from the documents and the email, so it cannot be trusted until tested on a real R2. Flag it as not verified until then

Scale integration (DiFluid Microbalance Ti), same pattern as the refractometer. Protocol documented by DiFluid (service `000000DD-...`, characteristic AA01), see `docs/protocols/difluid-microbalance-ti.md`; sign of the weight and several other details are not stated and must be verified on a real device:

- LAB-14 `packages/drivers`: `Scale` interface, labelled simulated scale, shared contract test. No hardware needed (done)
- LAB-15 live pour guide in the lab (private app only): step cards follow the scale and show live weight against each step's target weight, with the simulated scale until a real one is connected. The public guide stays Bluetooth-free
- LAB-17 DiFluid frame codec and message parsers for the Ti and R2 in `packages/drivers/src/difluid`, tested against every frame written in DiFluid's documents. Numbers with the top bit set are refused because DiFluid does not state the sign (done, see ADR-015)
- LAB-16 real DiFluid Microbalance Ti driver (`packages/drivers/src/difluid/tiScale.ts`, Web Bluetooth transport, listed in the lab as "experimental"): written from the official documents and tested with fakes only. NOT verified on a real Ti. The experimental label (`TI_EXPERIMENTAL_NOTE`) stays until Jay and Claude test it together; see ADR-016 and the checklist in `docs/protocols/difluid-microbalance-ti.md` (done, unverified)

Later, not now: compare view, Kaffelogic .klog import, QR codes, public ratings (need a backend).

## Open decisions (ask Jay, never decide alone)

- Switch hybrid water temp
- Logo SVG file
- Rating attribute list (decided in ADR-008: overall 1 to 5 plus six cupping-style scores; Jay can still change the list)
- Whether first crack is logged anywhere
- Scale choice (decided 2026-11-16: DiFluid Microbalance Ti)
- Domain, before printing QR codes
- One repo or two
- Kaffelogic facts: `.klog` `boost_load_size` is the batch-size setting, not measured green weight. There is no first-crack marker, bean name, roasted weight or notes in the file. The date 04/10/2026 is ambiguous (Oct 4 or Apr 10): ask Jay.
