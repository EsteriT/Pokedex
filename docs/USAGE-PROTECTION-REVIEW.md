# Step 2A: existing usage protections

Reviewed: 20 October 2026. Baseline: `d6e8d5d`. Local branch: `review/usage-protections`.

This is the step 2A baseline inventory. The subsequent local implementation and its rollout boundary are recorded in [step 2B](USAGE-PROTECTION.md); statements below about absent application limits describe the reviewed baseline.

## What this means in plain English

The app already limits how much an account can keep and checks who owns saved data. The missing layer is controlling how often someone can ask the services to do work.

For example, the artwork allowance is at most 30 MB per account. Downloading the same files repeatedly can still use much more than 30 MB of transfer. Limiting stored files does not limit downloads.

Step 2A is complete as a source-and-test review. This report changes no application behavior. No production settings, database records, credentials, deployments, backup schedules or monitors were inspected or changed in this step. Docker was not started. No new usage thresholds are selected here.

## Existing enforced protections

These are application/database rules in the reviewed migrations, not newly inspected hosted configuration. Earlier hosted acceptance is recorded separately in [the foundation guide](BACKEND-FOUNDATION.md) and [catalogue guide](CARD-CATALOGUE.md).

| Area | Existing rule | Where enforced / evidence | What it does not protect against |
| --- | --- | --- | --- |
| Private saved records | Users can read only their own binders and collection. Direct client table writes are denied; checked functions perform writes. | [Binder foundation](../supabase/migrations/20261016221119_binder_foundation.sql), [collection migration](../supabase/migrations/20261018085909_collection_cloud.sql) | An owner repeatedly reading or saving their own data. |
| Binder allowance | At most 3 binders per account; 1-30 pages per binder; 1-6 rows/columns; at most 2,000 Overflow items. The database rejects binder documents larger than 2,300,000 bytes in its JSON representation. | `commit_binders` in the foundation migration; latest `valid_document` in [portable validation](../supabase/migrations/20261018131252_portable_binder_validation.sql) | Request frequency, account creation across multiple identities, or oversized traffic before the database parses/validates it. |
| Save correctness | Per-account database locks, expected revisions and atomic writes prevent quota races and stale overwrites. Restore combines binder and collection writes in one transaction. | Foundation, collection and [account controls](../supabase/migrations/20261018105316_account_data_controls.sql) | A queue of repeated requests. Locking serializes work; it is not an admission limit. Collection validation also runs before its account lock. |
| Collection allowance | One collection per owner; at most 5,000 record groups and 16,777,216 bytes of database JSON; quantities 1-999 per group; notes at most 2,000 UTF-16 units. Printing/finish, grading, duplicate groups and field types are checked. | `valid_collection` / `commit_collection` in the collection migration | Repeated validation of large valid or invalid documents; repeated complete-document downloads. A group is a printing/details combination, not one physical card. |
| Artwork storage | Private bucket; JPG/PNG/WebP; at most 500,000 bytes per stored object; at most 60 reserved paths per account, including unfinished reservations. Immutable uploads and content-derived paths prevent overwriting and deduplicate identical artwork within an account. | [Private artwork migration](../supabase/migrations/20261016221736_private_binder_artwork.sql), reservation hardening in [validation migration](../supabase/migrations/20261017084034_binder_validation_hardening.sql), account controls upload policy | Repeated downloads, duplicate upload attempts, reservation calls or accounts created with other identities. File size/type rules do not limit bytes already sent before rejection. |
| Artwork used in binders | Stored object must exist and belong to the account; portable encoding, image dimensions/crop and per-document artwork budget are validated. | Latest `valid_image` / `valid_document` in portable validation | Total transfer or per-minute processing. The effective usable image size can be smaller than the bucket maximum because portable encoding has its own limit. |
| Artwork cleanup | Ordinary cleanup protects referenced files and files reserved within the last 24 hours. It uses the same account lock as saving. | Private artwork migration and reservation hardening | Repeated cleanup requests. Cleanup remains an explicit account action, not an automatic per-user scheduled job. |
| Public catalogue search | At most 24 results per search; page 1-1,000; query at most 120 characters; filter document at most 2,000 bytes; validated filter/sort choices. Metadata lookup accepts at most 100 bounded card IDs. | [Catalogue migration](../supabase/migrations/20261020095147_card_catalogue.sql) | Many distinct searches, repeated startup metadata requests or repeated metadata batches. Public reads intentionally require no sign-in. |
| Query timeout declarations | All three catalogue functions declare a 3-second statement timeout. | Catalogue migration; [Supabase timeout guidance](https://supabase.com/docs/guides/database/postgres/timeouts) | Cumulative work across requests. Effective hosted role/request and lock timeouts were not measured in this step. Browser cancellation is a separate mechanism. |
| Account operations | Account export/restore/deletion require an authenticated live session; deletion additionally requires a session created within 10 minutes and typed confirmation. Pending deletion locks further writes/uploads. | Account controls migration | An authenticated owner repeatedly requesting snapshots, restoring or retrying account operations. These checks protect identity/data correctness, not throughput. |
| Failure reports | Six fixed categories; counter capped at 100 per owner/day/category; old records for that owner are removed on a subsequent report. No raw errors or user content are accepted. | `report_failure` / `operation_counts` in account controls | The number of report calls. Calls still lock the account and run database work after the stored counter reaches 100. |

The 60 x 500,000-byte storage bound is 30,000,000 bytes of object content per account, not a bound on database size, file overhead, all accounts combined or bandwidth.

## Browser conveniences: useful, but bypassable

| Convenience | Current implementation | Boundary |
| --- | --- | --- |
| Search delay | Discover and editor wait 250 ms after typing before searching. | Per page only; direct requests and other tabs bypass it. |
| Public metadata reuse | Up to 40 completed search results per page session; identical in-flight searches share a request; missing cards load in sequential batches of 100. | No shared server cache or global distinct-request concurrency budget. Card metadata loaded into the page remains available for that page. |
| Artwork reuse | Same-account media cache and content hashes reduce repeated work. Account backup loops download/upload files sequentially and deduplicate within the operation. | New pages/exports/direct requests can download the same files again. Private HTTP responses deliberately use `no-store` to protect account switching. |
| Pending-operation buttons | Account dialog prevents overlapping operations in that dialog; editing screens have pending-save controls. | Not a cross-tab or service-enforced limiter. |
| Request timeouts | Catalogue fetches use 15 seconds; shared SDK requests normally use 20 seconds; account artwork requests use 30 seconds. | Limits browser waiting; not proof the database work was canceled immediately. |
| Import/image preparation | Browser image input at most 5 MiB and 24 million pixels; artwork is resized/encoded before cloud upload. Account backup file input is capped at 80 MiB. | Local browser input/memory guards. Direct callers bypass them; the independent database/Storage checks remain essential. |

Sources: [card-catalogue.js](../src/scripts/card-catalogue.js), [discover.js](../src/scripts/discover.js), [editor.js](../src/scripts/editor.js), [binder-cloud-media.js](../src/scripts/binder-cloud-media.js), [binder-repository.js](../src/scripts/binder-repository.js), [account-data.js](../src/scripts/account-data.js), [account-controls.js](../src/scripts/account-controls.js), [binder-schema.js](../src/scripts/binder-schema.js), [binder-media.js](../src/scripts/binder-media.js), [account-backup.js](../src/scripts/account-backup.js).

## Request paths the next step must cover

The reviewed source contains no application-specific per-user/per-IP request counter or admission rule, `Retry-After` handling, or database pre-request limiter. This does not claim Supabase has no provider-level protections; it means the app does not define its own usage budget.

| Service / actions | Who can request it | Remaining gap |
| --- | --- | --- |
| `catalogue_info`, `search_catalogue`, `catalogue_cards` | Anyone with the public application configuration | No app-defined request frequency or distinct-request concurrency limit. Public scraping/search bursts can create database load. |
| Data API reads of `binders`, `collections` | Signed-in owner | Reads are private but repeatable. A limiter only inside save functions would miss these routes and complete-document transfer. |
| `commit_binders`, `commit_collection` | Signed-in owner | Bounded documents and checked revisions, but no shared request-frequency budget before expensive validation/locking. |
| `reserve_binder_artwork` plus Storage upload | Signed-in owner | Object quota exists; reservation/upload attempts are not frequency-limited by application code. Storage needs its own coverage. |
| Storage download/list and ordinary remove | Signed-in owner subject to its policies | File quota and ownership are not bandwidth controls. UI uses download/remove; direct permitted Storage operations must be considered too. |
| `cleanup_binder_artwork` | Signed-in owner | Repeated scans and account locking. |
| `account_snapshot`, `restore_account` | Signed-in owner with a live session | Large snapshot reads and restore validation/writes; whole-account export additionally downloads artwork through Storage. |
| `begin_account_deletion`, `finish_account_deletion` | Signed-in owner with recent live session and confirmation | Legitimate retries must stay possible while excessive repeated work is controlled. |
| `report_account_failure` | Signed-in account | Bounded stored telemetry but unbounded invocation count; failed saves can also produce this additional request. |
| Google sign-in / session refresh | Supabase Auth and Google | Provider Auth throttles are separate from application data/storage usage. Local config cannot establish the current hosted settings. |

The local config exposes `graphql_public` as well as `public`; the app does not use GraphQL. Actual hosted exposure and permissions were not rechecked here. Step 2B must enumerate alternate API methods/routes so a restriction on one path does not leave an equivalent permitted path unrestricted.

## Provider settings: known versus not verified

[Supabase documents Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits). The local [config.toml](../supabase/config.toml) declares 30 sign-in/sign-up requests and 150 refresh requests per five minutes per IP, disables anonymous sign-ins, and does not enable CAPTCHA. Those are local settings, not a fresh read of production. No invite-only account allowlist or total-user cap was found in application source; a small intended beta audience is not itself an enforced admission rule.

[Supabase API guidance](https://supabase.com/docs/guides/api/securing-your-api) distinguishes ownership policies from request limiting. Its Data API pre-request hooks do not cover Storage or Auth. Its example database-writing limiter also excludes read-only GET/HEAD requests. Therefore adding one generic hook is not evidence that every request path is covered; trusted caller identity, public traffic and direct reads need an explicit design and bypass tests.

Hosted Auth limits, CAPTCHA/admission settings, effective API/lock timeouts, service quotas, spending controls and any external gateway rules remain **unverified in this step**. A Cloudflare R2 backup bucket does not establish that Supabase requests pass through Cloudflare. A gateway added later must account for direct origin access and must not trust caller-forged forwarding headers.

The Supabase changelog was read on the review date. The relevant notices concerned [old TLS clients](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) and [conditional PostgreSQL extension changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). No schema/dependency change is required for this documentation-only task; this review does not certify the hosted engine version or extension inventory.

## Operator capacity: separate from user request limits

- Encrypted operator snapshots are capped at 256 MiB of uncompressed serialized data. This is the encryption/recovery safety limit, not a promised number of supported users. The full export is buffered; transfer and memory overhead still matter. [backup-crypto.cjs](../scripts/backup-crypto.cjs), [backend-ops.cjs](../scripts/backend-ops.cjs).
- Recovery catalogue validation accepts at most 10,000 records. Before full-English expansion, review that ceiling, the import ceiling and the browser's ten-set startup check together. Raising only the catalogue import size would be incomplete. [catalogue-import.cjs](../scripts/catalogue-import.cjs), `model` in backend-ops.cjs, card-catalogue.js.
- GitHub backup jobs share one concurrency group and a 30-minute timeout. R2 verification uses bounded downloads and limited retries. These protect the operator job, not browser traffic. [backup.yml](../.github/workflows/backup.yml), [backup-r2.cjs](../scripts/backup-r2.cjs).
- Each complete backup retrieves private artwork again. At the artwork quota, ten accounts could hold 300,000,000 bytes of artwork alone before JSON/base64 and other overhead. This is capacity arithmetic, not a measurement of current users or a guarantee the 256 MiB snapshot limit is reached at exactly ten accounts.
- Seven-day expiry and alerts have separate acceptance records. The first actual scheduled-run verification remains pending; it was not substituted with a manual backup during this review.

## Proposed order for step 2B

These are review recommendations, not implementation or production authorization.

1. Choose a small set of shared usage budgets: public catalogue reads, private reads/writes, artwork transfer/attempts, account maintenance and failure reports. Set values from normal beta interactions and restore/export request counts, not guesses. A single Save already includes reads, possible uploads, a commit and refresh; account backups can touch 60 files.
2. Design enforcement for every route above, including direct API calls, anonymous traffic, permitted GET/HEAD and Storage. Inspect hosted settings read-only before relying on provider defaults. Avoid a new service unless the existing platform cannot provide the required boundary.
3. Apply limits before expensive work where possible; keep ownership, quotas, atomic writes and current manual Save. Repeated invalid/conflicting requests must not evade counting simply because their database transaction rolls back. Keep counters bounded and avoid unnecessary collection of raw IP addresses or private content.
4. Add a clear wait/retry message and preserve drafts. Avoid blind automatic retries of writes. Legitimate account deletion/cleanup recovery must not become impossible after a limit is reached.
5. Verify locally: bypass UI controls, use multiple tabs and simultaneous requests, exercise full supported account export/restore, check account isolation, measure lock waiting/timeouts, and confirm limits recover after their window. Reject excess work without charging another user sharing a connection/network incorrectly.
6. Review results before any hosted migration/configuration change. Keep load/capacity measurements and broader cost monitoring as steps 2C/2D rather than claiming this source review proves them.

## Verification and limits of this review

Passed again on this branch:

- `npm.cmd run test:backend`: all migrations executed in isolated embedded PostgreSQL; ownership/grants, quota/validation rejection, conflicts, rollback, account controls and public catalogue rules pass.
- `npm.cmd run test:repository`: controlled SDK fixtures verify private/local separation, account switching, manual saves and failure/draft behavior.
- `npm.cmd run test:catalogue`: importer validation, bounded browser loading/cache, failure safety and recovery metadata pass.

No new tests or application code were added for a documentation-only inventory. Embedded tests do not exercise real Auth/Storage infrastructure or multi-connection database contention. There was no Docker restart, traffic flood, live user-data inspection, billing/configuration audit or production security assertion. The earlier full browser/security acceptance remains separate evidence, not newly repeated here.

**Conclusion:** storage and data-integrity safeguards already exist and pass their isolated checks. Application-specific request-frequency/transfer protection is the next gap to address. This review does not establish an exploitable ownership leak or certify readiness for unrestricted public traffic.
