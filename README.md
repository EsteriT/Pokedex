# Pokedex frontend prototypes

Plain HTML, CSS and JavaScript prototypes for Pokémon collectors. The current pages are Landing, Workspace, Binder editor, Discover and Binder viewer.

## Frontend MVP milestone

**Accepted on 2026-10-16.** The current frontend is the approved MVP baseline. Scope, verification and remaining integration work are recorded in [Frontend MVP milestone](docs/FRONTEND-MVP.md).

## Open the website

Open [preview/Pokedex-landing-page.html](preview/Pokedex-landing-page.html), or use VS Code Live Server on src/index.html. Source pages load local assets; generated previews embed scripts, styles, fonts and cover-demo artwork. Card images still require internet access.

## Edit and verify

- Edit src/\*.html, src/scripts/ and src/styles/. Do not edit preview files directly.
- `npm run build` rebuilds all five linked standalone previews.
- `npm run check` checks file references, JavaScript syntax, CSS assets and preview links.
- `npm test` runs binder, collection, catalogue and customization regressions.
- `npm run test:browser` runs isolated Chromium browser regressions against source and previews (Python 3 plus Brave, Chrome or Edge; optionally set BROWSER_PATH). Covers icon toolbar and Help, click selection/merge, touch movement and placed-card swaps, styling page turns, pane centering, notification timing, transparent covers/backups, directional insertion, cross-binder copies, responsive fitting, keyboard access and the other page flows. No Python packages are required.
- VS Code workspace settings enable Prettier Format on Save. Use the included .prettierrc.json.

Node.js 18+ is required for build/check/test. The build has no npm dependencies.

## Project structure

| Directory    | Responsibility                                               |
| ------------ | ------------------------------------------------------------ |
| src/\*.html  | Five editable page entry points                              |
| src/styles/  | Shared design system, component styles and page layouts      |
| src/scripts/ | State, validation, persistence, rendering and UI modules     |
| src/data/    | Sample catalogue, inventory and landing demo data            |
| assets/      | Original artwork, font binaries, licenses and attribution    |
| scripts/     | Dependency-free build and regression checks                  |
| preview/     | Generated standalone pages                                   |
| docs/        | Product decisions, architecture, current handoff and history |

Read [docs/HANDOFF.md](docs/HANDOFF.md) before implementation. Product requirements are in [docs/DESIGN.md](docs/DESIGN.md); backend plans are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). [AGENTS.md](AGENTS.md) contains project working rules.

## Current scope

The editor supports custom covers, per-page layouts, connected pocket merging, cards/artwork/placeholders, overflow, sleeve/toploader styling, Undo/Redo, inspection, binder preview and page duplication. Workspace tracks binders and physical inventory; Discover searches a local catalogue and hands selections to the editor or collection.

Save is explicit and browser-local. Binder and collection records are separate; unsaved edits have no recovery draft. JSON import/download provides a portable backup. The catalogue is a 55-card sample; price displays are fictional interface examples.

Authentication, cloud storage, live catalogue/prices, public sharing and print/image export are future integration work. Nothing is deployed.
