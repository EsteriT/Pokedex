# Account data and recovery rollout

The user authorized both hosted migrations, security verification, merge, push and deployment on **2026-10-19 (Asia/Saigon)**. This supersedes the earlier local-review restriction for this milestone.

## Recovery preparation

The operator created a verified encrypted hosted application/artwork backup and confirmed uploading a separate copy. The local archive has the expected encrypted header, is 127,112 bytes, and has SHA-256 `6b584888fdf8708c274ae648167beea487fa529ba4ed86248d9e33b7a0f22c47`. Its filename identifies the snapshot as `2026-10-18T14-19-21-885Z`. The operator retains the passphrase privately; it was not read or put into Git. Keep the password separately from the archive and manually expire all archive copies after seven days.

This is application-data recovery, not a full PostgreSQL/Auth point-in-time backup. Real local recovery tests verify decryption, extraction and restoration including artwork. The hosted backup command verified decryption before retaining the archive; the operator's particular archive was not decrypted again during deployment.

## Hosted database

Target: Pokedex in Singapore, `pnuovoogfjzzlgmenhnq`.

Both reviewed migrations were applied through the connected Supabase migration tool in dependency order. A CLI dry-run failed to authenticate its temporary database-login role; no migration was applied by that attempt. The connector succeeded. Its application-time history versions were reconciled to the reviewed filenames only after matching each recorded SQL SHA-256; the SQL was not replayed. The four earlier migrations remain unchanged (the collection file's Windows line endings normalize to its existing hosted digest).

| Version | Migration | SQL SHA-256 |
| --- | --- | --- |
| `20261018105316` | `account_data_controls` | `a89f89fca31ca8fdde9818c15c9ae61dd1ed0e9f7cdcf1ee63dbe1925e6cebff` |
| `20261018131252` | `portable_binder_validation` | `22d6398a7447d9deaadfc8414bbbd8a9ea86dc3d446ba8dc899e5d3ce12a136e` |

## Security and bug checks

- Model/encryption/client tests, fresh embedded PostgreSQL, repository adapters and dependency audit pass; zero reported dependency vulnerabilities.
- Real local Auth/Storage, concurrent HTTP saves and source/preview cloud browser acceptance pass. These include artwork backup/restore, partial deletion followed by reload/retry, pending write/upload denial, stale-token protection and browser-original preservation.
- The complete source and generated-preview frontend Chromium regression suite passes, including desktop/phone-size bounds, navigation, keyboard controls, selection/merge, swapping/insertion, manual saving, artwork, backups and collection flows. Local database advisors report no issues.
- Hosted compatibility preflight reports zero missing-image, oversized-image or oversized-text binders.
- Hosted assertions create random disposable identities/sessions inside a rolled-back subtransaction. They pass account isolation, owner RLS, atomic restore-conflict rollback, invalid UTF-16 title rejection, session-owner matching, recent-login/typed deletion checks, pending write/upload denial, private counter denial, cascades and stale-token denial. Original account/binder/collection counts remain unchanged; zero disposable accounts remain. No real artwork objects or production accounts were deleted for these assertions.
- All five new public RPCs are invoker wrappers with empty search paths, authenticated execution and no anonymous execution. New internal tables have RLS enabled and no browser grants. Every new RPC rejects anonymous HTTP requests with 401/`42501`.
- Hosted performance advisors have no findings. [Private-table default-deny INFO notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) are intentional: catalogue, artwork, pending deletion and diagnostic counters are accessed through checked functions. Do not add permissive policies to hide these notices.
- The existing [leaked-password protection WARN](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; public settings verify Google enabled and Email, Phone and anonymous login disabled. Revisit password protections before enabling password login.
- Hosted packaging/reference checks and private-credential scans pass. The scan includes the newly configured operator key, Google secret, local admin credentials, Git candidates and generated browser artifacts. Private configuration, backups and disposable test files stay ignored.

## Website and acceptance

Feature commit `5dbdfd6e27691d7c9048437482d89f0657ac56f9` was fast-forwarded into `main` and pushed. [Deploy website run 39149630122](https://github.com/EsteriT/Pokedex/actions/runs/39149630122) succeeded, including dependency installation, hosted packaging, references, model tests, embedded PostgreSQL, repository checks and Pages publication.

All six public routes were fetched after deployment. Their contents match the reviewed local hosted artifacts after normalizing Windows/Linux line endings. All four application pages have the exact hosted public configuration, the Workspace contains the new account controls, and no configured Google/operator secret appears in the published files. The primary account's saved-data counts remain unchanged. The working branch is now `main`; the feature branch is preserved.

Hosted Google reauthentication and the account-controls UI still require user acceptance with a **disposable Google account**. Do not delete the primary account as a test. Confirm account JSON export/restore with artwork, recent Google reauthentication and typed deletion, then confirm the deleted account's data is gone. Physical mobile devices, Safari and Firefox remain outside this automated Chromium verification.
