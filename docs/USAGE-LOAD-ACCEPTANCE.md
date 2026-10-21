# Step 2C: local load and limit calibration

Update, 21 October: the owner deferred further local investigation and authorized a [bounded hosted trial in step 2E](USAGE-ROLLOUT.md). This changes rollout authorization, not the unresolved findings or the scope of the historical local evidence below. It does not establish laptop pressure as the cause or mark 2C complete.

Work stays on `feat/usage-protection`. No hosted migration, traffic test, activation, merge, push or deployment is included. This extends [step 2B](USAGE-PROTECTION.md).

## What is being measured

`npm.cmd run test:usage:load` reuses the loopback-only integration harness and its disposable accounts. It refuses a hosted URL and requires the actual local Edge runtime. It compares direct requests with the gateway, using 1, 5 and 10 accounts. Requests and their response bodies are timed; p50, p95, maximum, status counts, response bytes and aggregate database-admission time are recorded. p95 means 95 percent of sampled requests completed within that time.

The mixed session opens catalogue metadata, reads binders/collection together, searches and hydrates 100 card metadata records, performs four paired binder/collection saves, then snapshots/restores the account and reads it back. Each collection contains 100 real catalogue records; its snapshot is checked against the saved document. Binder Save includes its post-save refresh. Five-second pauses separate edit cycles; users start 150 ms apart. Authentication is prepared before timing. These are controlled HTTP application flows, not human usability tests or rendered-image measurements.

Separate checks cover three tabs sharing an account; all three supported binders with 30 pages, 36 pockets per page and 2,000 Overflow entries each; 5,000 collection groups with about 15.3 MB of multibyte notes; a 48-request excess-read sequence with at most 12 requests in flight; and a deliberately held admission lock. The existing 2B real-runtime test separately checks export/restore with 60 maximum-size artwork files.

Acceptance requires no unexpected quota rejection, server error or timeout in ordinary or supported-maximum flows, correct saved-data readback, excess traffic receiving a bounded wait, isolation between accounts, and bounded failure/recovery when a database lock is held. The runner now fails ordinary scenarios above 1,000 ms p95 or 5,000 ms maximum, supported-maximum scenarios above 15,000 ms maximum, and the deliberate lock scenario above 5,000 ms. These are local engineering thresholds, not a hosted service promise. HTTP 200 alone is no longer enough to pass a slow scenario. Unit checks cover the threshold boundaries. The test does not automatically retry writes to hide a failure. `--large-only` uses two disposable accounts and narrows diagnosis to the large-document/burst/lock scenarios; it does not substitute for a complete acceptance run.

Counters are reset only between independent scenarios. No limit is reset during an individual user flow. The outer harness restores the prior local gate, secret digest and public counters, removes only its disposable accounts/files, and removes its temporary secret file. All parallel requests settle before the next scenario or cleanup. A source/config hash detects edits that would invalidate the measurements.

## Findings and changes

1. **Small saves spent maximum-upload allowances.** In the initial accelerated run, a short session ending in backup/restore received HTTP 429 despite tiny documents. The browser now supplies its UTF-8 body size where known; the gateway treats that or HTTP Content-Length as an upper bound, and verifies the actual stream cannot exceed it. Unknown lengths retain the original maximum. Admission still happens before buffering private uploads or performing the operation. Lying about size cannot forward a larger request. Request-count limits and maximum response reservations remain unchanged; no budget was simply raised.
2. **Large collections intermittently exceeded the existing database timeout.** The original validator made up to 5,000 individual catalogue lookups. Migration `20261020162450_collection_validation_batch.sql` validates rows together with a catalogue join and checks duplicate IDs/groups in the same aggregate. Field rules, UTF-16 limits, ownership and the 8-second account-role statement limit are retained. Embedded tests compare the rewritten function with the original across valid, invalid, missing-field, malformed, Unicode and maximum-count cases. A focused synthetic measurement reduced validation from approximately 3.0 seconds to 1.1 seconds. Subsequent unchanged-code HTTP tests both passed and failed, so this optimization alone is not a demonstrated cure for the timeout.
3. **Local runtime reuse needs an explicit qualification.** Early `per_worker` runs reported soft CPU retirement and `WorkerAlreadyRetired` errors. A diagnostic `oneshot` run completed ordinary user flows but was slow and still failed the largest request. The original local `per_worker` policy was restored; switching policies is not a retained performance fix or a change to hosted configuration. An additional run invalidated by a watched-file formatting reload is excluded. Keep the earlier failures as evidence rather than claiming the reused-worker path was proven healthy.
4. **An alternate request entry point did not prove a fix.** Two local-only unnamed-JSONB wrappers were tried to avoid API parameter mapping. The targeted run still failed (including an Edge `WORKER_LIMIT` response). Those functions, migration file and browser aliases were removed. No experimental API entry point is retained, and no database timeout was increased.

The current [Supabase runtime limits](https://supabase.com/docs/guides/functions/limits) and [worker CPU explanation](https://supabase.com/docs/guides/troubleshooting/edge-function-cpu-limits) distinguish active CPU work from time waiting on network/database operations. They do not make this laptop a substitute for the hosted platform.

## Isolated investigation, 21 October 2026 (Vietnam time)

No additional application code, migration, accepted document format, quota or timeout was changed during this continuation. The retained implementation changes above predate it. Only the test harness and these records were strengthened.

**Large-save blocker:** a one-account reproduction separated a tiny save, 5,000 groups with short notes, and the same groups with approximately 15.3 MB of notes. Direct HTTP saves passed; one instrumented run measured 209 / 339 / 2,651 ms respectively. Temporary timing-only database instrumentation showed time spent before validator entry, in the document-size check and in row validation; it was removed in `finally`. A later original-gateway probe reproduced SQLSTATE `57014`, with its database context in the document-size check, before the batched row validation. Another protected request hit the existing upstream deadline. These locate distinct failure points, but do not establish why the same input sometimes stalls.

**Worker-retirement blocker:** a minimal local Edge control, with no app gateway or database work, completed 240 of 240 bounded POST requests successfully. A fresh original gateway also saved the same large document three times successfully (6,088 / 3,667 / 1,921 ms), with exact document readback. Neither result reproduces or explains away the earlier `WorkerAlreadyRetired`/`WORKER_LIMIT` reports. Runtime policy remains `per_worker`; no retry or alternate endpoint was added to disguise failure.

**Resource evidence:** this laptop exposes about 7.3 GiB of usable RAM, with about 3.5 GiB assigned to Docker. Guest memory-pressure stall counters increased around an intermittent failure. Temporarily stopping the unused local Studio, metadata, analytics and realtime services increased available memory; recent memory-pressure stall averages then fell to zero. The complete run below passed in that leaner configuration. This supports local resource pressure as a contributor; it is not proof of a sole cause, an out-of-memory kill, or hosted behavior. All four services were subsequently restored. No volume or saved account data was removed.

A final full-stack isolated direct test at approximately `2026-10-21T08:31Z` passed tiny / 5,000-short-note / 15.3 MB saves in 264 / 939 / 7,213 ms. Concurrent 250 ms database samples captured `IO:BuffileWrite` waits before validator entry and during row validation; guest memory-stall totals increased by about 286 ms over the diagnostic. Large-request SQL phase markers were 1,341 ms at validator entry, 1,669 ms after shape checks, 2,620 ms after the size check and 4,038 ms after row validation. This confirms temporary-file I/O and resource pressure during a slow successful request; it does not quantify all missing HTTP time or reproduce the timeout. The wait sampler expired after 45 seconds, timing instrumentation was restored, and no database privileges or memory settings were changed. Evidence: `.scratch/qa/save-waits.json` and `.scratch/qa/large-save-repro.json`.

## Latest complete result

**The strengthened local run passed. Overall 2C remains open because the earlier intermittent failures do not yet have a demonstrated cause and fix. Keep production protection off.**

The unchanged-source run started at `2026-10-20T19:49:58.442Z` (21 October, 02:49 Vietnam), using the original `per_worker` policy and the leaner local stack described above. All 1,110 requests returned their expected statuses, and all timing/data assertions passed. The source/config hash was `dcc25a517a7d4e215830b27642cb2e0ae6b6a50113ae06d10f76e46a47e63d3a` and stayed unchanged during the run.

| Active accounts | Requests per mode | Direct API p95 | Protected API p95 | Result |
| ---: | ---: | ---: | ---: | --- |
| 1 | 32 | 105 ms | 84 ms | Pass |
| 5 | 160 | 63 ms | 79 ms | Pass |
| 10 | 320 | 58 ms | 92 ms | Pass |

| Additional scenario | Result |
| --- | --- |
| Three tabs on one account | 21 requests; p95 77 ms, maximum 78 ms; no unexpected rejection |
| Supported-maximum direct Save/read/restore | 7 requests; maximum 4,402 ms |
| Supported-maximum protected Save/read/restore | 7 requests; maximum 3,744 ms; collection Save 2,675 ms |
| Deliberate same-account burst | 32 reads allowed, 16 rejected with bounded HTTP 429; another account's read succeeded |
| Held admission lock | Failed closed with HTTP 503 in 1,016 ms; read succeeded after release |

At ten accounts the admission query averaged 1.2 ms, excluding the remaining HTTP/runtime path. These local samples are not predictions of hosted speed or capacity.

An earlier unchanged-source `per_worker` run also passed (`2026-10-20T19:39:53.669Z`), but its ordinary collections were empty. The newer 100-record scenario is stronger. For comparison, the historical `oneshot` run at `2026-10-20T16:42:27.668Z` had protected p95 values of 9,523 / 2,126 / 5,000 ms at 1 / 5 / 10 accounts and failed large requests. Those failures remain part of the record; passing reruns do not retroactively invalidate them.

Detailed aggregates go to ignored `.scratch/qa/usage-load-results.json` **and a timestamped archive**, so a targeted run cannot erase the previous full-run evidence. Reports exclude tokens, account IDs, documents and private notes. Focused experimental scripts and raw timing evidence stay in ignored `.scratch/`; they are not application files. The latest complete archive is `.scratch/qa/usage-load-2026-10-20T19-49-58-442Z.json`.

After restoring the four local services, the real-Edge security regression passed again on 21 October: origin/GET/HEAD/GraphQL/artwork bypass denial, ownership, concurrent attempt counting, refill, deletion after throttling and portable account export/restore with 60 maximum-size artwork files. This is a security/compatibility result, not a replacement for the unresolved performance diagnosis. Browser layouts were unchanged and were not newly manually accepted.

Gateway unit checks, embedded PostgreSQL security/validation/compatibility tests (including original-validator equivalence), JavaScript syntax checks, regenerated previews and the project reference check passed again in this continuation. The build checked 196 source references and 48 JavaScript modules; the private-credential scan passed across 215 Git candidates/generated files. No dependency was added or updated.

Cleanup readback confirmed protection disabled, its private digest unset, zero private counter rows, no disposable usage-test accounts or temporary usage-secret files, and no timing instrumentation left in database functions. The branch remains uncommitted. No merge, push, deployment or production change occurred.

The pre-existing local Vector log collector remains unhealthy: its redacted diagnostic reports an unreachable Docker-host IPv6 address on port 2375. Studio, metadata, analytics, realtime and the core database/auth/storage services were running after restoration. This local logging limitation is separate from the successful application checks; Docker daemon/network settings were not changed.

## Limits and the next release gate

These measurements use one Windows computer with local Docker services and the ten-set catalogue. They exclude Vietnam-to-Singapore network time, Google consent, TCGdex image response time, actual provider billing, production worker reuse and long-running public traffic. No maximum supported audience or cost ceiling follows from the result.

The next diagnostic must capture a failing maximum request with database phase/wait timing and worker/resource measurements from the same attempt, in a controlled local environment. Repeating a passing load suite without new instrumentation does not establish a fix. Do not reduce supported saved data, raise timeouts, bypass security or add automatic write retries to make acceptance green.

Before activation, separately obtain authorization for a hosted configuration review and a small staged smoke check of worker behavior, origin denial, isolated accounts, Save and account backups. None is authorized by this task. Step 2D remains the separate capacity/cost/backup-growth review. The first genuine scheduled-backup acceptance remains separate too.
