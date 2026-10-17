# Binder backend foundation

Started on 2026-10-17 on `feat/binder-cloud-foundation`. This is an implementation branch, **not a deployed backend release**. The accepted frontend MVP remains the baseline.

## What this milestone does

Google identifies the person signing in. Supabase Auth gives that browser a session. PostgreSQL stores that person's binder documents, and private Supabase Storage holds uploaded artwork. The existing HTML/CSS/JavaScript editor uses a small repository adapter to talk to those services.

A binder document is the structured description of its pages, pockets, cards, cover and styles. PostgreSQL keeps it in a JSONB column; that does not make the database a public JSON file. Ownership rules still control every read and save.

The website remains static and can still use GitHub Pages. A publishable key identifies the Supabase project; it is designed to be visible in the browser. The Google client secret and Supabase administrator/secret keys must never be included in that website.

## Eight-stage progress

| Stage | Implementation and verification |
| --- | --- |
| 1. Inspect binder storage and callers | Completed; Workspace, editor, viewer, Discover and cross-binder copying were checked. |
| 2. Isolated development setup | Completed locally: feature branch, pinned packages, lockfile, ignored environment file, running Docker/Supabase and configured Google development credentials. |
| 3. Database foundation | Three migrations applied and verified locally: private documents, explicit privileges, atomic writes, quotas, validation, private artwork and final validation/reservation hardening. Hosted migrations remain unapplied. |
| 4. Ownership/conflict/quota tests | Embedded PostgreSQL and real multi-connection HTTP/service tests pass, including concurrent first saves, stale requests, rollback and ownership denial. Local advisors reported no findings. |
| 5. Google sign-in | PKCE login implemented. User confirmed successful real Google sign-in/return to local Workspace on 2026-10-17; a local Google-provider account was verified. Hosted Google configuration remains pending. |
| 6. Frontend integration | Async manual Save, Workspace actions, private viewer, Discover handoff, conflict recovery and account-scoped copying implemented. Real source/preview browser create/place/Save/reopen, Reload/Save-as-copy and Sign out confirmations pass. |
| 7. Explicit import/private artwork | Explicit local import preserves browser originals/collection. Actual Storage upload/download and portable backup restore pass. Previously viewed private artwork is denied after switching accounts; private SDK requests bypass HTTP cache. SQL/adapter cleanup checks pass. |
| 8. End-to-end/deployment | Local service/browser acceptance and real Google sign-in pass. Hosted migrations, provider settings, final deployed acceptance and website publication still require explicit approval. |

Do not describe all eight stages as complete until the missing checks above pass.

**Verification recorded on 2026-10-17:** real local Auth/HTTP/Storage and source/preview browser checks pass. They cover manual Save/reopen, actual artwork upload, portable backup restore, stale-save Reload/Save-as-copy, canceled/confirmed sign-out, explicit local import, collection isolation and denial of another account's binders/artwork. The user verified actual Google login. Disposable test accounts/files are removed afterward; the real Google development account remains. Embedded SQL, model and adapter checks also pass. Hosted project inventory was inspected read-only: Pokedex in Singapore is healthy and has no application tables/migrations yet. No hosted changes, Git push or deployment were performed.

## Saving and ownership rules

- Cloud mode uses an empty account workspace after sign-in; it never silently imports the sample/browser binders. With cloud configuration absent, the original browser-local prototype remains active.
- Cloud data is cached in page memory, not written into the shared browser binder key. Supabase itself persists the login session. Collection records remain browser-local and independent of sign-in.
- Manual **Save** persists a document. There is no autosave or draft recovery. Edits made while a Save request is pending remain unsaved after that request finishes.
- A revision is the saved version number. A transaction checks the account's expected binder identities/revisions before changing anything. A stale request fails without overwriting the saved version. With a three-binder beta limit, checking the small workspace together also makes shelf changes atomic.
- A conflict offers Keep editing, Reload saved version (confirm discarding the draft), and Save as copy (subject to the binder quota). Network failures preserve the draft. If a response is lost after the server commits, the next attempt can report a conflict; there is no automatic blind retry.
- Renaming, duplicating, reordering and deleting use the same transaction. A private owner lock serializes concurrent requests, including the first create. Other accounts cannot read or reassign a binder.
- Deletion is permanent after confirmation. It does not delete physical collection records. Old unused artwork can be removed separately.
- Account changes clear the repository cache and block subsequent writes until reload, preserving an open editor draft for backup rather than substituting another account's records. All private SDK requests use `cache: "no-store"` so HTTP cache cannot replay another account's previously viewed artwork. Public catalogue image caching is unaffected.

## Limits and document validation

The beta supports **3 binders per account**, **1-30 pages per binder**, **1-6 rows/columns**, and up to **2,000 Overflow items**, matching the current frontend limits. Server validation checks the sample printing/finish identifiers, unique item IDs, complete non-overlapping pocket coverage, connected merges, content types, frame presets, cover/title fields and image crop bounds. Requests cannot bypass these checks by calling the API directly.

The sample catalogue IDs/finishes are recorded in the first migration. Adding printings requires a catalogue migration as well as frontend data changes; this is not a live full-catalogue backend.

Artwork retains the existing per-document image budget. Each optimized file is at most 500,000 bytes and belongs to a private `binder-artwork` bucket. Accounts may reserve up to 60 immutable objects, bounding storage to at most 30 MB per account. These are beta guardrails, not a paid storage plan. Repeated identical artwork is deduplicated within an account using its content hash.

Cloud documents store `storage:<owner>/<hash>.<extension>` references. The editor downloads private images into memory and still produces portable backups containing the artwork. Expiring signed URLs are never saved as permanent document content. Failed saves can leave uploaded files behind; Account > Remove unused artwork cleans unreferenced uploads older than 24 hours, preserving recent in-flight work. Referenced images cannot be removed through that operation.

## Local setup, step by step

1. Use Node.js **22 or newer**; Node 24 is used in CI. Run `npm ci` in this repository. This installs the pinned SDK, CLI, browser bundler and PostgreSQL test engine.
2. Install and open **Docker Desktop**. Wait for its engine to be running. Supabase runs its development services in local Docker containers; the existing hosted Pokedex project is not linked by these commands.
3. In Google Cloud Console, create **Pokedex Development**. In Google Auth Platform, configure branding/support email, an External testing audience, and your email under Test users. Use only the `openid`, email and profile scopes.
4. Create a Web application OAuth client. Add `http://localhost:5500` as a JavaScript origin. Add `http://127.0.0.1:54321/auth/v1/callback` as a redirect URI. The redirect goes to local Supabase first; Supabase then returns the browser to Workspace.
5. Copy `.env.example` to `.env.local` if that private file does not exist. Fill `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`. Do not paste the secret into chat or commit this file. Leave both `POKEDEX_` values blank initially.
6. Run `npm run backend:start`. The wrapper reads only the local provider configuration and starts the local stack. The first start downloads service images and applies migrations. `npm run backend:status` shows the local service URLs/keys. Treat its secret/admin key as private; do not paste the whole output into a public issue or commit it.
7. Set `POKEDEX_SUPABASE_URL=http://127.0.0.1:54321` in `.env.local`. Set `POKEDEX_SUPABASE_PUBLISHABLE_KEY` to the **local publishable key**, or local legacy anon key if that is what this stack reports. Do not use the secret/service-role key. The build rejects privileged keys.
8. Run `npm run build`, then `python -m http.server 5500`. Open `http://localhost:5500/src/workspace.html`, use Account > Continue with Google, and create a binder. Use the same hostname consistently; localhost and 127.0.0.1 have separate browser sessions/storage.
9. Run `npm run test:backend:live`, then `npm run test:backend:browser`. They exercise actual Auth, concurrent HTTP requests, database policies and private Storage. Browser checks use the real SDK/services against both source and previews. The runner creates disposable local accounts with administrator-issued test sessions; it sends no email and does not enable public email/password login. These are test fixtures; the product login flow is Google. Both commands refuse a non-loopback API URL and clean up test users/files/session fixtures.
10. Run `npx supabase db advisors --local --type all` and inspect the results. Actual Google consent/redirect still needs a normal browser; automated test sessions do not prove that provider flow. Hosted provider/redirect settings need their own acceptance after approval.

Stop local services with `npm run backend:stop`; it preserves local development data. Do not reset the development database if it contains work you want to keep. To return the frontend to its original local prototype, clear the two `POKEDEX_` entries in `.env.local` and rebuild.

## Verification commands

| Command | What it proves |
| --- | --- |
| `npm run build` / `npm run check` | All five pages build; references and JavaScript parse. |
| `npm test` | Existing frontend document/collection/customization regression checks. |
| `npm run test:backend` | Migrations execute in embedded PostgreSQL; ownership, grants, validation, rollback, limits and artwork policies behave as tested. Auth/Storage system tables are test stand-ins. PGlite is single-connection, so this does not prove lock contention across connections. |
| `npm run test:repository` | Local/cloud isolation, explicit import, Save snapshots, offline/conflict safety, media and account transitions with SDK test doubles. |
| `npm run test:browser` | Existing browser regressions plus simulated cloud UI startup/create/Save/reload/conflict/copy flows against source and previews. This fixture does not contact Google/Supabase. |
| `npm run test:backend:live` | Actual local Supabase HTTP/Auth/Storage and independent connections. Requires the running local stack; not a substitute for real Google/browser testing. |
| `npm run test:backend:browser` | Real local SDK/Auth/database/Storage in isolated Chromium, for source and previews. Covers artwork backup/upload/download, conflict Reload/copy, sign-out confirmations and same-browser cross-account denial. Google consent is verified separately. |
| `npm run build:pages` | Static Pages artifact and navigation links. Does not publish it. |

## Files and deployment boundary

`supabase/migrations/` contains the database changes. `supabase/config.toml` is a local-only service/provider configuration, with credentials read from environment variables. `binder-repository.js` owns the persistence adapter; `binder-cloud-media.js` handles private artwork; `backend-account.js` owns sign-in/import controls. Existing local validation and editor operations stay reusable.

`scripts/build-backend.cjs` bundles the pinned browser SDK, its license notices and only the two public `POKEDEX_` settings into ignored `src/vendor/` files. Standalone previews embed these outputs. Never publish a build containing localhost settings. The default unconfigured build remains the local prototype; the GitHub workflow currently supplies no hosted backend configuration.

The Pages packaging step checks each embedded preview, rejects local HTTP backend settings and inconsistent page configurations, and refuses unexpected files left in `dist/`. Explicit environment values, including empty strings, override `.env.local`; this allows a prototype release build without changing private development credentials. Tracked previews are prepared without backend configuration until hosted rollout is approved. Local source pages can keep using the ignored local configuration.

## Prepared hosted rollout (not approved or applied)

The read-only inventory identifies the existing **Pokedex** project (`pnuovoogfjzzlgmenhnq`, Singapore). Its `public`/`binder_private` application schemas have no tables and its migration list is empty. The reviewed changes are three SQL migration files: account-owned binder documents, private artwork policies/reservations, and final validation/reservation hardening. They do not import any browser binders or collection data. See [the final audit](BACKEND-AUDIT.md) for the additional fixes and checks.

After explicit approval, apply those migrations and run hosted advisors/acceptance before exposing the configured website. Configure the Google provider privately and allow the exact hosted Workspace return URL, `https://esterit.github.io/Pokedex/Pokedex-workspace.html`. Google's Web client must allow the origin `https://esterit.github.io` and callback `https://pnuovoogfjzzlgmenhnq.supabase.co/auth/v1/callback`. Keep the local development callback if using the same Google test client. Secrets remain in provider settings, never in GitHub Pages.

The website build needs only the hosted API URL and publishable key. GitHub Actions currently sets neither. Website publication and Git push are separate pending actions, followed by actual hosted Google login and private Save/reopen/backup checks. A local Google session is not copied to the hosted Auth database; a user signs in to each environment separately.

Only after local acceptance and explicit approval: review the hosted target, run security advisors, apply the reviewed migrations, configure its Google provider and exact redirect allowlist, build with the hosted publishable configuration, then publish the reviewed frontend. No hosted migration, provider change, project link, Git push or deployment was performed during this foundation implementation.

Official references: [local Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started), [Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [API security](https://supabase.com/docs/guides/api/securing-your-api), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [PGlite limitations](https://pglite.dev/docs/).
