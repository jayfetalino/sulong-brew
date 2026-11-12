# LAB-1: design tokens and the lab app shell

## What was built

- `packages/design-tokens`: one CSS file of brand colors, fonts and spacing.
- `apps/lab`: a Preact app built with Vite, with a dark shell, a logo placeholder and a bottom tab bar (Roasts, Recipes, Brews).
- Fonts (Fraunces, Inter, IBM Plex Mono) come from `@fontsource` npm packages, so they are served from our own app, not Google.

## Key ideas

- **Design tokens are CSS variables.** Raw brand values (`--sulong-gold`) sit under role names (`--color-accent`). Components only use role names. The public guide will switch to the cream look by setting `data-theme="cream"`, with no component changes.
- **Workspaces share code.** The lab imports `@sulong/design-tokens/tokens.css` like any package, but npm links it to the folder in this repo.
- **`host: true` in Vite** makes the dev server listen on your Wi-Fi address, so the iPhone can open it.
- **Safe areas.** `env(safe-area-inset-bottom)` keeps the tab bar clear of the iPhone home indicator.

## Remember

Change a color in one place (`tokens.css`) and the whole app follows. Never hard-code a hex value in a component.
