# English card catalogue trial

Started locally on `feat/card-catalogue` on 20 October 2026. The owner subsequently approved merging, pushing and deploying the reviewed version. The hosted catalogue migration and 1,291 public printing records are now applied; website release checks are recorded below. Earlier local-only notes describe the original review boundary.

## Scope

Ten complete TCGdex English set listings, fetched through its public API: 1,291 printing records. This is not a claim to cover every physical variation, stamp, corrected print or promotional distribution. No market prices are imported. All 1,291 records supplied image links; image availability is still subject to the upstream image service.

| Set | TCGdex ID | Records |
| --- | --- | ---: |
| Base Set | base1 | 102 |
| Jungle | base2 | 64 |
| Fossil | base3 | 62 |
| Team Rocket | base5 | 83 |
| HeartGold & SoulSilver | hgss1 | 124 |
| Black & White | bw1 | 115 |
| XY | xy1 | 146 |
| Sun & Moon | sm1 | 172 |
| Sword & Shield | swsh1 | 216 |
| 151 | sv03.5 | 207 |

The existing six sample sets plus four older sets exercise legacy saves, set-local card numbers and older finishes. Pokemon TCG Pocket and other languages are excluded.

## Run and review locally

1. Start Docker Desktop and the existing local Supabase stack with `npm.cmd run backend:start`.
2. Apply pending migrations locally with `npx.cmd supabase db push --local`. Do not reset the database or use `--linked`.
3. Run `npm.cmd run catalogue:import:local`. The importer has no hosted mode. It fetches all ten sets, checks them, then upserts the catalogue in one local transaction. A failed download does not alter the database.
4. Keep the source public configuration pointed at `http://127.0.0.1:54321`, using the local publishable key. No private key belongs in a frontend file.
5. Serve the repository and open `http://localhost:5500/src/discover.html?view=sets`. Workspace, editor and viewer source pages use the same catalogue. Google sign-in is needed for account saving, not public catalogue search.

`src/` contains editable code. Tracked `preview/` files are generated, unconfigured browser-only demonstrations and continue showing the sample catalogue. A preview built with a local configuration can also use the local catalogue, but must never be published. `dist/` is not updated by this work.

## Security and efficiency

- Card metadata is separate from account records. Catalogue reads deliberately require no login; binders, collections and uploaded artwork retain their ownership rules.
- Catalogue tables are private, with row-level security and no direct client read/write grants. Three explicitly granted, read-only database functions return public metadata only. They have fixed search paths, bounded input, a three-second query timeout and no dynamic SQL.
- Search returns 24 cards per page. Saved documents fetch missing card metadata in batches of at most 100 IDs. Search input is debounced; duplicate in-flight queries are shared and 40 completed searches are cached per page session. No account records or access tokens enter that cache.
- Imports use four concurrent upstream requests, timeouts, bounded responses, limited retries and a one-day ignored raw-response cache. Only the fixed ten-set allowlist is fetched; upstream redirects and untrusted image hosts are rejected.
- The import updates metadata and never deletes cards or account data. Previously accepted finishes remain accepted so provider corrections cannot invalidate saved work.
- Existing 55 sample IDs remain canonical, including short 151 IDs such as `001`. New cards use provider IDs such as `base1-4`. Searching a full provider ID returns exactly that printing; numeric searches match card numbers across sets.
- Metadata is loaded before validating saved binders, collections and imported backups. Missing printings fail visibly rather than being silently dropped. Existing unknown-finish handling remains unchanged.
- Encrypted operator backups include public catalogue metadata for independent validation/recovery. Older archives without the optional catalogue field still work. Decrypted recovery output includes `catalogue.json` alongside account files; it contains public metadata, not credentials. Restoring into a replacement backend still requires rebuilding/importing the shared catalogue first.

## Deliberate limits

Search is benchmarked against this ten-set trial. Its substring matching must be measured and, if needed, indexed differently before full-English expansion. The catalogue is updated manually by the operator; there is no scheduled import or browser-to-TCGdex card-data fetching. Card images still come from TCGdex.

Color matching continues using only the original curated sample colors. New cards are not assigned invented artwork colors. Related-card suggestions currently show loaded printings, not a complete server-side list. Detailed physical variants such as shadowless printings are not separate inventory groups in this phase.

## Checks

`npm.cmd run test:catalogue`, `npm.cmd run test:backend`, `npm.cmd run test:repository`, `npm.cmd test`, `npm.cmd run test:backend:live`, `npm.cmd run test:backend:browser`, `npm.cmd run test:browser`, build/reference checks and local database advisors. Actual hosted rollout requires separate approval and acceptance; no production checks are implied by local results.

## Local acceptance recorded 20 October 2026

Passed: complete source/preview frontend browser suite; real local source/preview catalogue search, 24-card pagination, two-card selection across result pages, collection Save/reload and backup restore, binder placement/Save/reload, viewer metadata hydration, conflict/offline preservation, artwork/account backup/restore, deletion and cross-account isolation. Model, repository, embedded database, operator recovery, build/reference and whitespace checks pass. Local database advisors report no issues. Repeat import leaves exactly 1,291 canonical rows; legacy IDs and previously accepted finishes remain valid. The last sampled public API run's slowest local search was 36 ms; this is not a hosted/network performance promise.

Temporary public downloads, raw card responses, diagnostics and review screenshots are under ignored `.scratch/`. No live accounts or hosted services were changed, no remote branch was pushed, and no merge or deployment was performed. Source landing markup is unchanged; its generated preview includes the shared renderer's catalogue-aware lookup, with unchanged demo behavior.

## Image loading follow-up (20 October 2026)

Discover tiles, set previews, collection tiles and editor picker thumbnails now request TCGdex's 245?337 `low.webp`; large details and binder artwork keep canonical 600?825 `high.webp`. URLs are derived only for the approved TCGdex image host; other artwork URLs remain unchanged. No saved card metadata or hosted database changes are needed.

A six-request local network sample across three cards measured 201,274 bytes for full-size artwork versus 55,662 bytes for thumbnails (72% fewer bytes). Individual response times varied from 1,809?2,408 ms for full-size and 349?2,299 ms for thumbnails; these sequential samples are diagnostic, not a controlled speed benchmark. Upstream latency remains outside this frontend fix. Browser HTTP caching is already enabled by the provider with immutable long-lived responses. No service worker, private artwork cache or paid image service was introduced.

### Discover request scheduling

Discover prepares the TCGdex asset connection in the page head. Visible thumbnails start immediately; the first receives high fetch priority. An IntersectionObserver starts other thumbnails within 200 pixels of the viewport. Images in hidden tabs receive no source URL until their view becomes visible, including direct `?view=sets` visits. Related printings use the same scheduling; large details remain full quality. No new hosting, persistent cache, dependency or backend change.

Focused source/preview browser regressions cover desktop/phone scheduling, scrolling, direct Sets visits, keyboard switching, full-size details, and existing Discover search/filter/collection/navigation behavior. A real 1440?1000 browser sample started 12 thumbnails, deferred 12 and started zero hidden Sets images. At the two-second observation, 4/12 visible images were complete on the cold visit and 12/12 on the repeat visit. This is a single diagnostic sample, not a controlled before/after speed guarantee; upstream first-visit delays remain. Run `POKEDEX_BROWSER_SUITE=discover` with `python scripts/check-browser.py` for focused regression checks (set the variable using your shell's syntax). The regression suite disables actual image downloads; the separate real-network sample did not.

## Hosted release preparation - 20 October 2026

The owner approved merge/push/deployment after local review of the catalogue and image scheduling. A fresh encrypted R2 backup passed first: [protected backup run](https://github.com/EsteriT/Pokedex/actions/runs/39403631647). Migration `20261020095147_card_catalogue.sql` was applied to project `pnuovoogfjzzlgmenhnq`; its filename and local migration history match the hosted migration version. The reviewed public snapshot was validated and upserted in 13 bounded transactions, preserving existing IDs/finishes and touching no account documents. The frontend remains on the old release until the website deployment succeeds.

Hosted checks passed: ten sets / 1,291 cards; three previews per set; distinct 24-card pages; exact printing and legacy-ID lookup; oversized request rejection; no client grants on private catalogue tables; and denied anonymous reads of binders/collections. Catalogue functions use fixed empty search paths, three-second timeouts and bounded read-only SQL.

Hosted advisors flag the deliberately public SECURITY DEFINER read functions ([anonymous access guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [signed-in access guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). This is intentional: the functions return public card metadata from otherwise inaccessible tables and never read account documents. Private tables having RLS without client policies is also deliberate deny-by-default behavior. The existing leaked-password warning remains outside this Google-only release; no authentication settings were changed. A newly created unused-index notice is informational, not evidence to delete an index before collecting usage.

Release-time regression checking found and fixed a startup presentation race: My collection now begins with disabled controls and a Loading status while catalogue/account records are loading, rather than briefly claiming data is saved. Private configuration and ignored files were checked before staging. No card image hosting or backup scheduling changes are included.

Release verification completed before merge: model tests, PostgreSQL validation/ownership tests, repository tests, real local HTTP/Auth/Storage tests, encrypted recovery, and source/preview real backend browser acceptance all passed after the startup fix. Hosted catalogue permission/read smoke checks and the private-secret scan passed. Google consent was not repeated because OAuth settings and callbacks are unchanged; user sign-in/Save acceptance remains useful after deployment.
