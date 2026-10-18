# Account data: pre-merge audit

This records the local review and release gates before publication. The approved hosted rollout is now deployed and accepted; see [ACCOUNT-DATA-ROLLOUT.md](ACCOUNT-DATA-ROLLOUT.md) for current verification and user-confirmed hosted acceptance.

Reviewed locally on 2026-10-18 on `feat/account-data-controls`. The review covers the uncommitted account controls, their existing binder/collection callers, SQL permissions and races, artwork storage, encrypted operator backups, recovery, packaging and documentation. Expected load is the documented small beta: three binders, 30 pages per binder, 5,000 collection groups and 60 artwork objects per account; the manual operator archive is capped at 256 MB.

## Confirmed findings and fixes

### 1. Database-valid records could block portable backups — fixed

PostgreSQL counts Unicode characters; JavaScript string limits count UTF-16 units. A direct API save accepted a 31-emoji binder name while the browser rejected it as longer than 60 units. A complete operator backup validates all binders, so this account could prevent the archive from being produced. Cover titles and image names had the same mismatch. The Storage file limit also admitted individual images whose base64 representation was too large for the browser's binder format.

Migration `20261018131252_portable_binder_validation.sql` preserves the existing ownership, crop and document checks, while aligning binder names, cover titles, artwork names and individual image sizes with the portable format. It changes no saved records and leaves already applied migration files untouched.

The failing case was reproduced before the fix: database accepted, portable validator rejected. After the fix both reject it. Regression tests cover valid Unicode/image boundaries, oversized values, direct HTTP restore rejection and unchanged snapshots after rejection.

Older records are not rewritten automatically. The read-only [compatibility preflight](../supabase/diagnostics/portable-binder-preflight.sql), also included in `backend:health`, counts oversized text/images and missing artwork without displaying private contents. Unexpected hosted findings must be repaired with the owner's approval before rollout; missing artwork during a known pending deletion is an expected retry state. The current local diagnostic reports zero incompatible or missing-image binders.

### 2. Clipboard cleanup could strand a deleted account page — fixed

After successful server-side deletion, clearing `sessionStorage` could throw if browser storage access was disabled. That prevented the following sign-out/reload, leaving the old account screen visible even though deletion had finished.

Temporary clipboard cleanup and sign-out are now best effort after the server confirms deletion. Reload still occurs if either throws. Storage removal or account-switch errors earlier in the flow still stop deletion; they are not swallowed. An isolated client regression failed with the original clipboard error and passes after the fix, including logout failure and the earlier safe-stop cases. The pinned Auth SDK also clears its local session on ordinary sign-out network errors.

## Checks

- Model and account backup validation, encryption round trip, wrong passphrase, tamper detection and bounded decompression.
- Fresh embedded PostgreSQL execution of all migrations: ownership, invoker wrappers, anonymous/direct-write denial, recent/live sessions, validation, atomic restore rollback, pending deletion, cascades and stale tokens.
- Real local Auth/Storage and simultaneous save tests with disposable accounts.
- Source and generated-preview browser acceptance: manual Save/conflicts, artwork round trips, account export/restore, dirty-draft protection, keyboard focus, partial deletion followed by reload/retry, sign-out and original browser data preservation.
- Full existing source/preview frontend regression suite.
- Local security/performance advisors, all-dependency npm audit, credential/output scan, build/reference checks, hosted artifact packaging and Git whitespace review.

The review also checked that requests remain pinned to their originating account token, private responses avoid HTTP cache, files are removed through Storage before Auth deletion, failed restores preserve existing records, no administrator key enters the browser, and logs/counters exclude private record/error text. No unrelated refactor or dependency upgrade was introduced.

Final results: build/reference/model/database/adapter checks, real local API and source/preview cloud browser acceptance, and the full frontend suite pass. Local advisors have no findings. The npm audit reports zero vulnerabilities across all dependencies. The credential scan checked 172 candidate/generated files without finding configured private credentials or privileged browser keys. All six migrations are applied locally; the four previously committed migration files are unchanged. Disposable local test-account count is zero. Git whitespace checks pass; nothing is staged or committed. No confirmed blocking finding remains in the tested local scope.

## Release gates

No merge, push or deployment is part of this audit. The hosted database has not been changed. Before a push to `main` (which automatically deploys), authorize the hosted rollout, run the compatibility preflight, create/verify an encrypted hosted backup and its off-computer copy, and apply both pending migrations in order:

1. `20261018105316_account_data_controls.sql`
2. `20261018131252_portable_binder_validation.sql`

Then verify hosted advisors and complete Google reauthentication/account controls acceptance with a disposable account. Keep the agreed manual seven-day backup expiry procedure. Actual hosted Google reauthentication, real-device mobile testing, Safari and Firefox are outside this local audit. This is application-data recovery, not a full Auth/PostgreSQL point-in-time backup.

## Hosted operator CLI follow-up

The first hosted health attempt exposed a targeting bug: the pinned CLI requires `--linked` alongside `--project-ref`. The shared health/backup target now supplies both. A regression check covers local and hosted flags, private error output, and missing CLI login. The corrected read-only connection attempt then reported that no CLI access token was configured; an actionable login message now explains this separately from the artwork administrator key. Hosted health/backup verification remains pending operator login; no hosted migration or deployment was performed.

After operator login, terminal execution exposed a second CLI boundary mismatch: human output is a direct JSON array, while agent output wraps the array in `rows`. Both formats were reproduced with read-only `SELECT 1` using `--agent no/yes`. The shared health/backup query adapter now accepts both and rejects unexpected shapes without printing database contents. Regression coverage reproduces the original TypeError and covers both formats for local/hosted targets. The hosted read-only health check passed on 2026-10-18: zero binders with missing images, oversized images or oversized text. Account controls remain uninstalled, as expected; encrypted hosted backup and migrations remain pending.
