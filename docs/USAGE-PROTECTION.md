# Step 2B: request protection

Current release: the owner authorized [step 2E's controlled hosted rollout](USAGE-ROLLOUT.md) on 21 October 2026, with 2C explicitly deferred. The descriptions of local-only authorization below record the earlier implementation stage; consult the rollout record for the current switch and deployment status.

Local implementation on `feat/usage-protection`, based on integrity release `d6e8d5d` and the uncommitted [step 2A inventory](USAGE-PROTECTION-REVIEW.md). The new migration is applied to the local Docker stack only. Production has not changed. This is not a claim that the live website already has these request limits.

## What changes for a user

Ordinary searching, editing and manual Save retain their current behavior. Excessive repeated requests receive a short wait/retry message. A failed or throttled Save does not overwrite the saved version, discard the draft or automatically retry a write. The user can still download the draft backup. Account deletion has a separate request budget from saving.

The website uses an opt-in transport flag, `POKEDEX_USAGE_GATEWAY=true`. Unconfigured demos and existing builds without that flag keep their existing transport. Auth/session refresh and Google callbacks stay on the original Supabase URL. Card artwork from TCGdex is unchanged and is not hosted or proxied by this feature.

## Why there is a gateway

The browser sends Data API and private artwork requests through one Supabase Edge Function. Before doing the main operation, the function makes a separate, committed admission request to PostgreSQL. PostgREST verifies the original caller's JWT and derives their account ID; no caller-supplied user ID or editable user metadata decides ownership or the usage bucket.

The main request then uses that same user token and the existing database/Storage ownership policies. It never uses a service-role key. Invalid documents, conflicts and later database rollbacks cannot undo the earlier admission record.

After origin lockdown is enabled, a private server-only header is required by the Data API pre-request check and restrictive Storage policies. Direct GET/HEAD, RPC and GraphQL requests cannot skip the gateway to read private data or run catalogue functions. Private read policies also require the gate as defense in depth. Service-role operator access remains available for backups and cleanup.

The gateway secret is a random 32-byte value encoded as 64 lowercase hex characters. The database stores its SHA-256 digest; the Edge Function stores the original in private configuration. Neither belongs in browser settings, generated pages, Git, screenshots or chat. This is a new secret, separate from backup/R2/Google credentials.

[Supabase documents](https://supabase.com/docs/guides/api/securing-your-api) why a Data API hook alone does not protect Storage. Recording counters inside a save transaction would also let a failed transaction roll back those counters. The separate admission transaction covers both issues without introducing another provider or a third-party package.

## Initial beta budgets

These are explicit starting choices for the small beta, not measurements of production capacity. Each category has a bucket that starts full, is shared across tabs/processes, and refills continuously at the listed rate. A full bucket allows a burst; it is not a strict rolling-minute maximum.

| Category | Burst capacity | Refill per minute | Applies to |
| --- | ---: | ---: | --- |
| Public catalogue | 600 | 600 | Startup catalogue information, searches and card metadata; shared by all visitors |
| Private reads | 120 | 120 | Binder and collection reads |
| Saves | 30 | 30 | Binder and collection commits, together |
| Artwork | 240 | 240 | Reservations, file uploads and downloads/HEAD |
| Account maintenance | 10 | 10 | Account snapshots, restore commits and unused-artwork cleanup |
| Deletion | 10 | 10 | Begin/finish deletion and file removal |
| Failure reports | 20 | 20 | Small existing error-category reports |

Every signed-in category is per account, not per IP. Two accounts sharing Wi-Fi do not spend one another's private budget. Public catalogue traffic deliberately has a single shared safety budget: it avoids storing or trusting client IP headers, but a determined caller can temporarily consume public browsing capacity for everyone. This is a documented small-beta tradeoff, not per-visitor fairness or DDoS protection.

There is also a continuously refilling transfer allowance: 256 MiB burst/refill per minute per signed-in account and 64 MiB for the public catalogue. Following [step 2C calibration](USAGE-LOAD-ACCEPTANCE.md), the gateway reserves a checked input-size upper bound plus the supported maximum response size **before** forwarding. Known browser string/binary bodies supply their UTF-8 byte size; the actual stream must fit that bound. HTTP Content-Length is the fallback hint; unknown lengths keep the maximum input reservation. Admission occurs before reading private uploads. Small responses can still consume a conservative reservation. These allowances are not provider billing measurements. Both the category and transfer allowance must be available.

Examples of output reservations: binder reads 8 MiB; collection reads 18 MiB; account snapshots 26 MiB; artwork download 500,000 bytes. Uploads remain bounded to a 512,000-byte envelope plus a small reply. HEAD has no response-body reservation. Ordinary saves can involve multiple reads and uploads, so the headline save count alone is not the effective allowance. Request counts and refill capacities were not increased during calibration.

The supported maximum count of 60 artwork objects, at 500,000 bytes each, was exported and restored through the actual local Edge runtime without hitting a budget. A maximum-size multipart upload was also checked. That is a bounded acceptance flow, not a guarantee every arbitrary rapid sequence of exports/restores will be accepted.

Counters use at most seven rows per account and two public rows, rather than one record per request. Account rows cascade away on account deletion. No raw IP addresses, tokens, query text, card lists, private notes or per-request history are stored in them. Quota rejections return a computed `Retry-After` with HTTP 429; a failure to check admission fails closed with a retryable error.

## Route and payload boundary

- Only the existing app's public catalogue RPCs, private binder/collection reads and commits, artwork operations, account controls and failure reports are forwarded. The caller cannot choose another upstream host or schema.
- RPCs use POST; table reads use GET/HEAD. Gateway requests for arbitrary functions, GraphQL, signed URL creation, alternate buckets, object overwrite/copy/move/list and unsupported verbs are rejected. Existing origin ownership checks remain in force too.
- Caller gateway/profile headers are replaced, user Authorization is retained, and redirects are refused. Batch-execution/transaction override preferences are not forwarded.
- Request bodies have route-specific limits and a read deadline. Output streams are bounded. Content-Length is not copied onto a potentially decompressed response stream. Replies use `no-store` and expose no private configuration.
- Approved browser origins receive explicit CORS headers. CORS is a browser convenience, not authentication: a script without Origin must still pass admission and ownership checks.
- Catalogue startup throttling is surfaced as a wait/retry message rather than silently substituting sample search results. A later explicit search/metadata request after the wait can reinitialize the live catalogue. Ordinary older-backend fallback behavior remains separate.

## Local verification

Commands use the existing installed CLI, Python and Docker tooling; no new package dependency is added.

| Command | What it proves |
| --- | --- |
| `npm.cmd run test:usage` | Allowed routes, original user token, header/schema replacement, denied-work short circuit, 429/retry, bounded bodies, private error handling, browser routing, Auth isolation and startup retry |
| `npm.cmd run test:backend` | All migration rules plus private counters/config, per-account separation, transfer rejection, refill, separate deletion budget and bounded rows |
| `npm.cmd run test:usage:live` | Gateway core against real local PostgREST/Auth/Storage; direct-origin denial, concurrent requests, committed failures, export/restore and cleanup |
| `npm.cmd run test:usage:edge` | The same checks through the actual local Edge Function, including 60 maximum-size artwork files and HEAD/multipart behavior |
| `npm.cmd run test:backend:browser` | Real local source/preview application flows; HTTP 429 Save preserves/downloads a dirty draft and explicit retry succeeds, alongside existing conflict/account/artwork checks |

The live usage tests generate disposable local accounts and a temporary private gateway key. They temporarily enable the local gate, then restore the previous local gate/digest and public counters in `finally`; they do not enable it for ordinary local development afterward. Loopback-only assertions prevent hosted targeting. Do not run gateway acceptance and another local integration suite concurrently: the gate is intentionally shared by the local stack.

The local migration `20261020150304_usage_gateway.sql` installs the gate disabled; follow-up `20261020153412_usage_bucket_owner_index.sql` indexes the account-counter relationship for deletion. Both are applied locally only. The gateway migration also refuses to replace a different existing Data API pre-request hook. Existing tests/direct local clients remain usable while the new path is reviewed. **Applying these migrations alone does not activate protection.** Activation additionally needs the matching private configuration, function, browser flag and enabled gate.

Recorded local acceptance on 20 October 2026: model/repository/catalogue checks, gateway unit/database tests, actual Edge acceptance, the full source/preview frontend suite and real local source/preview backend browsers all passed. The latter includes HTTP 429 draft download and successful explicit retry. The maximum-size 60-artwork account round trip, concurrent admission, origin/GraphQL/Storage denial, HEAD and multipart handling passed in the actual Edge runtime. Local security advisors reported no issues; static diagnostics had no findings across 88 JavaScript files. Both opt-in and default hosted configurations packaged successfully; the 212-file private-credential scan passed. No deployment was performed.

Cleanup readback confirmed the local gate disabled, its private digest unset, zero remaining disposable usage-test accounts and no private counter rows. The default ignored `dist/` package was restored to the existing non-gateway transport. Detailed non-secret verification metadata is in ignored `.scratch/qa/usage-protection-receipt.json`. On Windows the Edge test owns the native CLI process directly; readiness requires a working admitted read, not a preflight from a previous worker.

## Hosted rollout: not performed or authorized by this local task

Before publishing, inspect actual hosted Auth/admission settings, exposed API methods, any existing pre-request hook, service quotas and function/key availability read-only. Local defaults are not evidence of hosted settings. Verify that the local-tested header context and origin denial also work in the hosted environment before declaring protection active.

The reviewed rollout will need:

1. A fresh verified encrypted backup and review of the migration/configuration changes.
2. A separately stored gateway secret, its matching database digest and exact approved website origin. The function uses Supabase's server-side anon key plus original user tokens, never the private backup/service key for browser forwarding.
3. The staged migration with the gate off; deployment and smoke checks of the function. Do not enable the gate before the function and browser path are ready.
4. An explicitly approved Pages build setting `POKEDEX_USAGE_GATEWAY=true`, followed by live route/Auth/Save/backup checks. The current workflow does not set this flag; its only new step runs gateway unit checks.
5. Explicitly enable origin lockdown after deployment; verify direct-origin denial, isolated accounts and wait/retry behavior. Older open tabs use the old direct transport: preserve/download unsaved work before asking users to refresh.
6. Monitor quota errors, latency, Edge invocations, database load and storage transfer. A green test or a transfer reservation is not a spending cap.

Rollback order: first disable the origin gate privately, restoring the existing ownership-protected direct path; then revert the browser transport flag if necessary. Retain the gateway until old open tabs using it have been handled. Do not delete account data, reset the database or revoke ordinary ownership protection as a rollback.

## Remaining limits

This local milestone protects expensive operations behind a counted checkpoint. It does not stop unlimited traffic from reaching the Edge entry point or its cheap admission function, guarantee provider costs, prevent multiple Google accounts, or replace provider Auth controls. Auth/Realtime are not proxied. The app does not use realtime subscriptions, public image hosting, signed artwork links or arbitrary Storage APIs; verify hosted exposure before rollout rather than assuming those routes are harmless forever.

The extra admission request has latency and database/Edge overhead. [Step 2C](USAGE-LOAD-ACCEPTANCE.md) has measured mixed 1/5/10-account flows, large documents and lock waiting. The latest strengthened local run passes, but **2C remains open**: earlier intermittent large-payload timeouts and worker-retirement failures do not yet have a demonstrated cause and fix. The collection validator is faster and small uploads no longer spend the maximum upload allowance; passing reruns under improved local resource conditions do not certify activation readiness. [Step 2D](CAPACITY-AND-COST.md) records capacity/cost assumptions, observed sizes, backup growth and manual action thresholds; it does not certify a fixed audience or spending ceiling. No new paid plan, hosted migration, production secret, production load test, merge, push or deployment is part of this local implementation.
