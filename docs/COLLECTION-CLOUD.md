# Account collection storage

**Milestone accepted — 2026-10-18.** Started on `feat/collection-cloud`; the user approved the hosted rollout and confirmed all requested collection acceptance checks pass. The reviewed migration is deployed to Pokedex in Singapore, and the website is published. The deployed binder milestone remains intact.

## Deployment record

- Feature commit `034d310` was fast-forwarded into `main` and pushed. [Deploy website run 39117541307](https://github.com/EsteriT/Pokedex/actions/runs/39117541307) passed every build/check/test/deploy step.
- Live root/landing navigation and all four application pages were fetched after deployment. They contain the intended hosted configuration and pinned account-write safeguard; Workspace/Discover contain the collection adapter, and Workspace includes explicit browser import.
- The user confirmed that a card saved through the hosted page survives refresh and appears after sign-in through another browser/profile. The user also confirmed hosted backup download/restore/Save and available browser-import checks pass. These are user-performed acceptance results, distinct from the automated SQL/HTTP/source checks.

## User behavior

An account collection records physical ownership and Wanted cards independently of digital binder placements. The existing fields are preserved: printing, finish, quantity, condition, grading company/grade, notes, chase flag and trade status.

- Configured builds use the existing Google session. Signed-in accounts start with an empty collection; sample/browser records are never silently imported. Signed-out collection editing is blocked with a sign-in prompt.
- Workspace and Discover share account storage. Save remains manual. Edits made while a Save request is pending remain unsaved afterward.
- Unconfigured builds retain the browser-local prototype and sample collection. Cloud Save never writes the browser key `pokedex.collection.v1`.
- Collection tools → Import browser collection previews new/matching groups. The user chooses **Keep account records** or **Use browser records** for overlaps. Quantities are not summed. Imports are undoable drafts until Save, preserve browser originals and do not double quantities on repetition. “Account records” means the current account draft, including unsaved edits.
- Backup restore replaces the current draft only after confirmation; manual Save persists it. Download includes the current draft and remains available after errors.
- A stale Save keeps the draft and shows a persistent recovery message. Download it before choosing Reload saved collection; reload explicitly confirms discarding dirty edits. There is no silent retry or autosave.
- Account changes block requests/edits, clear clean collection views, and preserve dirty drafts for backup until reload. Sign-out asks before discarding dirty edits and is blocked while Save is pending.
- Binder and collection writes capture a checked session token and pin that request's Authorization header, so an SDK session change cannot retarget a pending write into another account. Tokens are not added to documents or backups.

## Database contract and limits

`public.collections` stores one JSONB collection snapshot per owner, with a revision and update time. This matches document-based manual Save and makes the full update atomic. Its owner primary key indexes the RLS lookup. It is separate from binder documents and artwork storage.

`public.commit_collection(expected_revision, document)` is an invoker wrapper around a checked function in the unexposed `binder_private` schema. The function takes the owner from `auth.uid()`, validates before locking, serializes account writes (including two first saves), checks the expected revision and returns the exact committed revision. No browser-provided owner is accepted. Browser roles have SELECT permission only, with owner RLS; general INSERT/UPDATE/DELETE and anonymous access are revoked. Private function execution is restricted and its search path is empty.

Server validation enforces 5,000 groups, quantity 1–999, 2,000 UTF-16 units of notes and 20 UTF-16 units of grade, supported sample printings/finishes, enums, canonical ownership/grading fields and unique IDs/groups. Grade labels must already be trimmed so database groups cannot collapse into duplicates after client normalization. **Cloud snapshots are bounded to 16 MB**, independently of the existing 64 MB backup-file allowance. Oversized saves fail without discarding the draft. Full-snapshot reads/saves are intentional for this beta; production load has not been measured and there is no realtime/incremental synchronization.

Migration: `supabase/migrations/20261018085909_collection_cloud.sql`. This milestone added one collection migration; the three existing hosted binder migrations are unchanged. The local validator was refined with CREATE OR REPLACE without a database reset. Fresh migration execution is checked separately in embedded PostgreSQL.

## Verification

- `npm test`: existing collection/binder model regressions.
- `npm run test:backend`: fresh SQL execution, RLS/grants, invalid fields, duplicate groups/IDs, canonical grades, Unicode lengths, 5,000 groups, payload budget, stale revisions and independent accounts. Embedded PostgreSQL is single-connection.
- `npm run test:repository`: binder regressions plus collection adapter tests for explicit/repeated imports, overlap choices, ID collisions, offline errors, detached Save snapshots, dirty edits during Save, signed-out access, account changes and local fallback. SDK fixtures are test doubles.
- `npm run test:backend:live`: real **local** HTTP/Auth/RLS and simultaneous first saves using disposable users, cleaned afterward. It refuses hosted URLs.
- `npm run test:backend:browser`: real local source/preview UI Save/reopen, conflict/download/reload, pending Save edits, offline retention, imports, backups, Discover integration and cross-account denial. Existing binder/artwork/sign-out checks also run. Screenshots stay in `.scratch/screenshots/`; import dialogs were inspected in light/dark themes.
- Local Supabase advisors: no findings. The local validator body matches the migration; no disposable test accounts remain. Full source/preview frontend regressions and hosted packaging/reference checks pass. The final 155-file candidate/generated-output scan found no configured private credentials or privileged keys. Tracked previews are unconfigured, ignored source vendor settings remain local, and ignored `dist/` contains the verified hosted artifact.

Migration SHA-256: `cd7fbffd51674398afcf185fc23a61bec1c0402f4f9e7068764ded39ebb7591a`.

## Hosted rollout — approved and accepted 2026-10-18

The user approved applying the reviewed migration, hosted verification, commit/merge/push and website deployment. No new provider or secret is required. Backend settings stay public-only; localhost configuration must never be published.

Hosted verification passed: owner-only reads, direct INSERT/UPDATE/DELETE denial, Save revision advancement, stale/invalid atomic rejection, separate accounts and missing/anonymous identity denial. Generated acceptance identities and collections existed only inside one rolled-back transaction. Public HTTP SELECT/commit requests are denied with 401/42501. RLS is enabled; authenticated SELECT is granted, direct UPDATE is revoked, and the public RPC wrapper is not security-definer. The exact recorded SQL SHA-256 matches Git. The connector-assigned history version was aligned to `20261018085909` only after name/version/fingerprint checks, without replaying schema or changing user data.

Hosted advisors: no performance findings or collection-policy findings. Existing [default-deny private table notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) remain intentional. Auth also reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); public Auth settings confirm Google enabled and Email, Phone and anonymous sign-in disabled. Password protection does not protect Google credentials, and password login has not been enabled as part of this rollout.

The user confirmed hosted collection Save/refresh, another browser/profile, available browser import and backup restore all pass. This completes the requested collection-cloud milestone within the documented beta limits. It does not establish production load capacity or add realtime synchronization; those remain outside the verified scope.

For a frontend rollback, redeploy its prior version and retain collection rows/migrations. Do not reset account data to roll back a website.
