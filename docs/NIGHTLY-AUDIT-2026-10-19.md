# Nightly codebase checkup — 2026-10-19

## Health summary and scope

Baseline: `be6f103` on a clean `main`. Work is isolated on `chore/nightly-codebase-checkup` for local review. This checkup does not publish a website, apply migrations, change hosted settings, delete user data or enable daily backups.

Subsequent release authorization: the owner requested deployment of the verified cleanup (`010e58d`) on 2026-10-19 and explicitly deferred recovery/monitoring work to the morning. This supersedes the local-only publication status of the audit below. The release uses the existing main-branch Pages workflow; it includes no new schema, hosted account data, monitor or schedule changes.

Reviewed the repository structure and dependency/configuration boundaries, five page entry points, source/data modules and stylesheet references, local/cloud persistence and account flows, six database migrations and their security tests, private artwork, operator encryption/recovery/R2 integration, build scripts, deployment workflows and current documentation. Inventory: 177 tracked files at baseline, 44 source/data JavaScript modules and 34 stylesheets. Generated previews/vendor bundles are outputs, not duplicate implementations to delete. Ignored private configuration was used only by existing local tools and a private-value comparison scan; no values are recorded here.

The stack remains plain HTML/CSS/JavaScript, Node CommonJS operator/build/test scripts, Python Chromium acceptance tests, PostgreSQL/Supabase Auth/Storage, GitHub Pages/Actions and private Cloudflare R2. Shared model validators and repositories separate editing, saving, authorization and portable recovery. There was no reason for a framework migration or large refactor.

No critical flaw was confirmed in the inspected paths. Two operator failure-path issues were fixed, one unused binding removed and outdated operational descriptions corrected. This is a bounded code review and regression pass, not a guarantee of a bug-free system or a production penetration test.

## Findings and changes

| Severity | Area | Confirmed issue and root cause | Result |
| --- | --- | --- | --- |
| Medium | `scripts/backend-ops.cjs`, CLI response parsing | A successful CLI exit with malformed JSON could expose part of its database output through the native JSON parsing exception, which the command prints. Reproduced using fake private-looking data. | Fixed: parsing errors now produce a fixed message without the response. A regression first failed against the old code and passes with the fix; wrapped/unwrapped valid CLI results and other failure messages remain covered. |
| Medium | `scripts/backend-ops.cjs`, artwork downloads | The tool buffered the entire response before checking the existing 500,000-byte image limit. It also accepted fetch's default redirect behavior despite sending a privileged custom API-key header. | Fixed: reject redirects and stop reading/cancel the response stream as soon as it exceeds the existing limit. An oversized unfinished stream test proves early cancellation and that no incomplete archive is written. Snapshot-size matching remains enforced; missing content type follows normal image validation instead of a null-property crash. Real local artwork backup/decrypt/recovery also passes. |
| Low | `src/scripts/editor-layout.js` | `pagesSidebar` was assigned but never referenced. Static analysis and repository-wide name lookup confirmed it was unused. | Removed that binding and rebuilt the editor preview. No sidebar element, listener or behavior was removed. |
| Low | Architecture/package descriptions | A current module-map paragraph still said no backend was connected, and package metadata described only local saving. | Updated the runtime map and package description to match deployed private cloud saving and account controls. Historical design proposals remain labeled as historical. |
| Low | Backup/monitoring guides | The guide called email integration verified even though delivered-alert acceptance remains outstanding. It also omitted that a manual ping can resume a paused monitor. | Corrected both guides and recorded the check needed after manual testing. Hosted monitor state was not inspected or changed in this audit. |

[Healthchecks documents](https://healthchecks.io/docs/configuring_checks/#pinging-a-paused-check) that a paused check normally resumes on a ping. Its optional sticky pause ignores pings until manual resume. Therefore an accepted HTTP ping alone does not prove active monitoring or email delivery. With daily jobs intentionally disabled, inspect and re-pause the monitor after a manual test if necessary; verify its intended active state before enabling daily protection.

## Diagnostics and regression evidence

Baseline before implementation: model/operator/automation tests, repository adapters, embedded PostgreSQL authorization/validation tests and all-dependency npm audit passed. The initial static scan later identified the unused binding; three undefined-name diagnostics in test scripts were configuration false positives for actual Node globals (`Event`, `setImmediate`), not application errors. The temporary diagnostic configuration was corrected to describe the real runtime.

| Check | Outcome and limits |
| --- | --- |
| `npm.cmd test` | Passed after the fixes, including malformed-JSON privacy and oversized-artwork cancellation regressions. |
| `npm.cmd run test:repository` | Passed before and after cleanup: local/cloud isolation, manual snapshots, conflicts, media deduplication, account switching and collection import behavior. |
| `npm.cmd run test:backend` | Passed: all six migrations tested in disposable embedded PostgreSQL; owner isolation, direct-write denial, validation, quotas, atomic conflicts, account operations and Storage policies. No SQL changed. |
| `npm.cmd run test:backend:browser` | Passed the full source/preview local Auth/Storage browser acceptance, account export/restore/deletion retry and collection flows. After the operator fix, `test:backend:live` passed again with real local encrypted artwork backup, extraction and application recovery. Only disposable local test users/files were modified. |
| `npm.cmd run test:browser` | Passed in full before and after cleanup against source and rebuilt previews. Tests exercise desktop/phone viewport layouts, keyboard/focus, editor insert/swap/merge/history, customizer navigation, collection, Workspace, Discover, viewer and simulated cloud conflicts. Images are disabled in this harness; it does not measure image-load performance. |
| Static analysis | Temporary pinned ESLint 10.13.0 check of 82 source/operator/test JavaScript files: zero errors/warnings after cleanup, using `no-undef` and `no-unused-vars` with browser/Node globals. This is a focused diagnostic, not an installed project-wide recommended lint configuration. |
| Syntax/reference checks | Every source and operator/test JavaScript file parses; normal project check passes 185 source references, 44 source/data modules, static IDs, CSS assets and preview links. Python syntax checked separately. |
| Builds | Unconfigured previews and deployment package passed; a separate hosted-configured six-route package passed with only intended public configuration and no operator modules. Tracked previews returned to unconfigured mode; ignored source configuration returned to the existing local settings. Nothing deployed. |
| Dependencies | `npm.cmd audit --json`: zero known vulnerabilities across all dependency classes. Versions/lockfile preserved; no application dependencies added or removed. |
| Private-file scan | Passed configured private-value and privileged-browser-key comparisons across Git candidates and generated code. `.env.local`, vendor configuration, local service state and `.scratch` remain ignored. Final file count is recorded below. This does not inspect unavailable GitHub secret values or prove complete historical secret absence. |
| Formatting | Prettier 3.9.6 applied only to changed operator/tests; final format and Git whitespace checks recorded below. No broad reformat. |
| Dead files/assets | Every source/data/style file has a static reference; no exact duplicate asset bytes found. This does not infer that every dynamic branch is reachable. No files, dependencies, images, migrations or active CSS rules were deleted. |
| Type checking | Not configured: this is plain JavaScript without a TypeScript/checkJs project. Parsing, focused lint, model tests and browser execution were used; no type-check pass is claimed. |

## Security and maintainability assessment

Reviewed user-controlled display paths and HTML insertion sites: user names/notes/status text use text nodes; the inspected `innerHTML` sites assemble fixed icon/demo markup. Public publishable backend settings are intentional; operator secrets remain outside browser bundles. Database changes were unnecessary: explicit table grants/RLS and narrowly granted private functions remain protected by the existing ownership, revision, live-session/deletion and cross-account tests. No new schema or authorization policy was introduced.

Keep the existing module boundaries and layered responsive/theme styles. The editor and form controllers are sizeable, but splitting them during a final check would create broad regression risk without a demonstrated defect. Existing small DOM helpers serve distinct modules; consolidating them would add coupling without removing a meaningful maintenance problem. No speculative caching or API rewrite was made.

## Morning handoff and remaining work

1. The owner authorized publishing this branch's reviewed cleanup after the audit. Confirm the corresponding main-branch Pages deployment and affected live routes; remaining backup acceptance is a separate task.
2. Resume backup acceptance: independent private R2 download/passphrase/local recovery drill; delivered failure and missed-heartbeat emails; disposable expiry acceptance; budget-alert verification. Check the production monitor state after the manual tests. Daily scheduling remains intentionally off and was not enabled here.
3. Image-loading optimization remains deferred as requested. No bandwidth, real-user performance or full-catalogue benchmark was performed.
4. Physical mobile devices, Firefox and Safari remain unverified. Chromium viewport tests do not replace those checks or guarantee mobile polish.
5. Hosted OAuth consent, provider configuration, alert delivery, billing and actual lifecycle expiry were not retested tonight. Earlier user-confirmed hosted acceptance and the successful manual R2 run remain recorded in their rollout documents.

No destructive/high-risk change was needed or attempted. Routine fixes preserve Save semantics, account boundaries, archive format, limits, UI appearance and database contracts. Full authentication/abuse-policy redesign, dependency upgrades and architectural rewrites remain outside this cleanup.

## Final verification record

- Final full source/preview frontend browser run passed after the unused-binding removal and preview rebuild. No runtime or unhandled-rejection failure was reported by that suite.
- The final model/operator/automation suite, repository adapters and real local encrypted artwork backup/recovery passed. Embedded PostgreSQL and full real local cloud browser acceptance also passed during this checkup, as scoped above.
- Local and hosted package builds, reference checks, the focused 82-file static check, all four Python parser checks, touched-file formatting and Git whitespace checks passed.
- Final scan: 186 candidate/generated files; no configured private credentials or privileged browser keys found. Ignored private paths remain ignored. The new report adds one candidate compared with the earlier 185-file scan.
- No app dependency changes, schema changes, production operations, remote pushes or deployments. The small cleanup is preserved on the local audit branch for morning review; daily backups stay disabled.
