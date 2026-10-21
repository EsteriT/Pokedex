<div align="center">

<img src="docs/media/banner.svg" alt="Pokedex — Your collection. Your way." width="100%">

**A Pokémon binder workshop built around your cards.**

Arrange your collection, customize every detail, and make a binder that feels like yours.

[![Frontend MVP](https://img.shields.io/badge/status-frontend_MVP-c74758?style=flat-square)](docs/FRONTEND-MVP.md)
![Vanilla JavaScript](https://img.shields.io/badge/built_with-HTML_·_CSS_·_JavaScript-2e313b?style=flat-square)
![Local storage](https://img.shields.io/badge/storage-your_browser-2e313b?style=flat-square)

[**Open the website ↗**](https://esterit.github.io/Pokedex/) &nbsp; · &nbsp; [Documentation](docs/README.md) &nbsp; · &nbsp; [MVP milestone](https://github.com/EsteriT/Pokedex/tree/frontend-mvp-2026-10-16)

</div>

---

<img src="docs/media/workshop.png" alt="Pokedex workshop showing a two-page binder, sleeve customization and page navigation" width="100%">

### A place for every card

| | What you can do |
| :--- | :--- |
| **Build your binder** | Arrange cards in one or two page views. Add, reorder and resize pages; merge connected pockets. |
| **Move things naturally** | Drag cards to swap pockets, push a row toward an empty space, or keep displaced cards in Overflow. Select batches and copy cards between binders. |
| **Make it yours** | Choose covers, including transparent; add titles and artwork; style cards with sleeves and toploaders. |
| **Find what fits** | Explore the catalogue through search and filters, with curated sample color matching. Track your collection in Workspace. |
| **Keep your work** | Save, download a backup, and restore it later. Open a read-only view of your saved binder. |

### Before you begin

The **frontend MVP** was accepted on October 16, 2026. Unconfigured demos contain **55 sample printings**; the hosted beta now includes **1,291 English printings across 10 trial sets**. Prices remain fictional interface examples.

The hosted cloud beta adds **Google sign-in, private binders and account collections**. Use **Save** to keep edits and **Download backup** for a portable copy. Existing browser binders and collection records are imported explicitly, preserving their browser originals. Unconfigured builds keep the original local prototype. Actual hosted login/Save acceptance is tracked in the [rollout record](docs/HOSTED-ROLLOUT.md).

### Run locally

Requires Node.js 22+. The included local server and browser checks also use Python 3. Install the pinned dependencies before building.

```sh
git clone https://github.com/EsteriT/Pokedex.git
cd Pokedex
npm ci
npm run build
npm run dev
```

Open **[localhost:5500/src/](http://localhost:5500/src/)**. The included server listens only on this computer and serves `src/`, `assets/` and `preview/`; private configuration, Git files and `.scratch/` stay inaccessible. Use `npm run dev -- --port 5501` for a browser-only preview if the default port is occupied. Google sign-in needs matching local Supabase redirect settings, so keep port 5500 for the existing cloud-login setup. Avoid serving the whole repository with an unrestricted server. Card images require an internet connection.

The audited binder backend foundation and hosted database are deployed. Google provider settings are configured, and the Pages workflow supplies the public backend configuration. Unconfigured builds keep browser-local saving. See the [backend foundation guide](docs/BACKEND-FOUNDATION.md) and [hosted rollout](docs/HOSTED-ROLLOUT.md) for setup, verified acceptance and beta limits.

Account collection storage is implemented and tested on `feat/collection-cloud`; its approved hosted migration and website update are now live. See [the collection guide](docs/COLLECTION-CLOUD.md) for private saving, browser import, conflict recovery and test coverage. The user confirmed hosted collection saving, cross-browser access, backups and available browser imports pass.

The ten-set English catalogue (1,291 printings) and faster Discover image scheduling are deployed as `793169a`. The hosted catalogue data is applied; see [the catalogue guide](docs/CARD-CATALOGUE.md) for scope, verification and rollout details.

### Develop & verify

The request checkpoint is deployed and direct-origin enforcement is **on** for the controlled beta trial after owner acceptance and hosted checks. See [step 2E](docs/USAGE-ROLLOUT.md) for verified checks, current switch state and rollback; earlier intermittent local load failures remain deferred.

Automated encrypted R2 backups are enabled, with the Healthchecks monitor active. Recovery, alert delivery, automatic expiry and the first actual scheduled-run acceptance have passed. The scheduled run on 21 October succeeded, its fresh verified archive is present, and the owner confirmed the monitor Up afterward. See the [backup acceptance record](docs/BACKUP-SAFETY-ACCEPTANCE.md), [backup setup](docs/AUTOMATED-BACKUPS.md) and [owner operations cheatsheet](docs/OPERATIONS-CHEATSHEET.md).

The [account data and recovery](docs/ACCOUNT-DATA-AND-RECOVERY.md) milestone adds complete account backups, confirmed deletion, encrypted manual operator backups and aggregate health checks. Both database migrations and the website update are deployed and verified. Hosted account backup/restore and fresh Google sign-in followed by deletion/sign-out passed user acceptance on October 19, 2026; see the [rollout record](docs/ACCOUNT-DATA-ROLLOUT.md).

Edit the files in `src/`; generated previews are rebuilt from those sources.

| Command | Purpose |
| :--- | :--- |
| `npm run capacity:plan` | Print offline capacity/cost scenarios; edit the [assumptions](docs/CAPACITY-ASSUMPTIONS.json), then review the [2D plan](docs/CAPACITY-AND-COST.md). No Docker or credentials needed. |
| `npm run test:capacity` | Check planning arithmetic, backup limits and pricing-unit boundaries. |
| `npm run dev` | Start the loopback-only public-file development server (Python 3). |
| `npm run test:server` | Check private-file denial, Host protection and public development routes. |
| `npm run test:usage` | Check the local-review gateway routing, admission and retry contracts. |
| `npm run test:usage:edge` | Test the gateway against real local Docker services and Edge runtime using disposable accounts. |
| `npm run test:usage:load` | Check local mixed-user load, data and timing limits; see the [2C record](docs/USAGE-LOAD-ACCEPTANCE.md) for passing runs and unresolved intermittent failures. |
| `npm run build` | Rebuild the five standalone previews. |
| `npm run check` | Validate references, JavaScript, assets and preview links. |
| `npm test` | Check binder, collection, catalogue and customization behavior. |
| `npm run build:pages` | Build the deployment into `dist/` and check its page links. |
| `npm run test:browser` | Run Chromium regressions with Python 3 and Brave, Chrome or Edge. Set `BROWSER_PATH` if needed. |
| `npm run test:backend` | Execute database rules in embedded PostgreSQL. |
| `npm run test:repository` | Check the cloud adapter with controlled SDK fixtures. |
| `npm run test:backend:live` | Test real services against a running local Supabase stack only. |
| `npm run test:backend:browser` | Check real local cloud Save, backups, conflicts, sign-out and account isolation in Chromium. |
| `npm run test:account-backup` | Check account backup validation, encryption and damaged-file rejection. |
| `npm run backend:health -- --local` | Read aggregate local backend health counts. |
| `npm run backend:backup -- --local` | Create a verified encrypted local application/artwork backup. |
| `npm run backend:recover -- "<file>"` | Decrypt and validate a backup into private recovery files; does not change a database. |

```text
src/        Editable pages, styles, scripts and sample data
assets/     Fonts, artwork and their attribution
preview/    Generated standalone versions of the five pages
scripts/    Build scripts and regression checks
docs/       Design decisions, architecture and project records
```

### Project notes

- [Frontend MVP](docs/FRONTEND-MVP.md) — accepted scope and compatibility limits.
- [Deployment](docs/DEPLOYMENT.md) — GitHub Pages setup and publishing.
- [Design](docs/DESIGN.md) · [Architecture](docs/ARCHITECTURE.md) · [Current handoff](docs/HANDOFF.md).

Desktop and phone-size layouts have been checked in Chromium browsers. Physical mobile devices, Safari and Firefox still need manual verification. Remaining English catalogue coverage, live pricing, automatic realtime synchronization, public sharing and print/image export remain future work.

---

<sub>Independent fan project. Pokémon and related artwork belong to their respective owners; this project is not affiliated with or endorsed by them. See [artwork credits](assets/credits/pokemon-cover-art.txt) and the [Manrope font license](assets/manrope-OFL.txt). No project-wide software license has been selected.</sub>
