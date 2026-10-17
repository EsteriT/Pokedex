# Binder foundation final audit — 2026-10-17

Scope: the uncommitted `feat/binder-cloud-foundation` changes, their frontend callers, database migrations, Auth/Storage rules, build/publishing scripts, dependency tree and candidate Git files. Generated previews were rebuilt rather than edited. This audit did not commit, push, merge or modify hosted Supabase.

## Confirmed fixes

| Finding | Resolution and evidence |
| --- | --- |
| Cleaning unused artwork left a stale memory-cache entry. Undo or restoring the same image could skip upload and fail its next save. | Cleanup evicts candidate paths from the media cache. A regression failed before the fix and now proves reuse uploads the bytes again. |
| Retrying an old upload reservation did not renew its 24-hour cleanup grace period. | The third migration refreshes the reservation time under the existing owner lock. SQL checks verify renewal; quotas and immutable paths remain enforced. |
| SQL accepted numeric catalogue IDs and whitespace-only/overlong names that the browser rejects. Direct API calls could save an unreadable document. | The third migration requires string printing IDs for cards/placeholders and rejects blank/overlong names. Embedded PostgreSQL and real HTTP checks reject these requests without changing the saved version. |
| Conflict choices could be dismissed while Save as copy was pending, allowing editing/navigation to race the response. | Pending resolution disables all choices, keeps focus in the dialog and blocks Escape dismissal. A delayed real RPC test verifies the dialog stays open, then completes the copy. |
| Pages packaging checked a separate source config rather than the embedded previews; unrelated leftovers in `dist/` were not rejected. | Packaging checks each actual preview, rejects local/inconsistent backend settings and refuses unexpected output files. Regression tests reproduce the old bypass. |
| Card clipboard ownership was permissive in prototype mode and old clipboard data survived account changes. | Owner matching now applies in both local/cloud modes; account changes clear the clipboard. Real browser checks verify foreign clipboard rejection and sign-out cleanup. |
| Duplicate Save tooltip assignment and obsolete architecture/migration descriptions. | Removed the duplicate and updated the current implementation/deployment records. Historical decisions remain identified as historical. |

The earlier HTTP-cache privacy fix remains in place: private SDK fetches use `cache: "no-store"`. The same-browser test verifies that another account cannot retrieve artwork previously viewed by its owner.

## Verification

- `npm audit --json`: **0 known vulnerabilities** in the installed pinned dependency tree at the time of this audit. This is an advisory-database check, not a guarantee about every dependency.
- `npm test`: frontend document, collection, catalogue, customization, movement, merging and backup model regressions.
- `npm run test:backend`: all three migrations execute in embedded PostgreSQL; ownership, privileges, typed validation, revision conflicts, atomic rollback, quotas, artwork policies and cleanup/reservation renewal pass.
- `npm run test:repository`: cloud/local isolation, explicit import, manual Save snapshots, offline/stale safety, private media, artwork reuse after cleanup, environment precedence and packaging guards pass.
- `npm run test:backend:browser`: real local Auth/HTTP/Storage plus source/preview Save/reopen, portable artwork restore/upload/download, conflict recovery/pending-copy controls, sign-out, clipboard isolation and cross-account denial pass. Disposable accounts/files are cleaned up afterward.
- `npm run test:browser`: existing source/preview desktop and emulated phone regressions, keyboard/focus, navigation, backups and simulated cloud contracts.
- Local Supabase security/performance advisors: **no findings** after migration `20261017084034`.
- Final build/reference checks, portable Pages artifact, Git whitespace checks and candidate-file secret scan are recorded with the handoff. Private `.env.local`, generated source vendor files, Docker state and `.scratch/` remain ignored.

## Release boundary

The hosted database still needs the **three reviewed migrations**, hosted Google provider/redirect setup and real deployed acceptance before cloud publication. Local Google sign-in was verified by the user earlier; the automated fixtures do not replace that provider check. Account deletion and recovery/operating policies remain later release work in the roadmap.

Physical phones, Safari and Firefox were not certified by these Chromium checks. Image-delivery optimization remains pinned. No claim is made that an audit can prove the absence of every possible defect.
