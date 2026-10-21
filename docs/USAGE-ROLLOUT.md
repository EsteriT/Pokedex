# Step 2E: controlled hosted request protection

Status on 21 October 2026: the owner confirmed all staged interface checks pass. Origin enforcement is now **on** for the controlled beta trial, and post-activation hosted checks pass. This record supersedes earlier local-only rollout restrictions for this specific release.

## Decision and scope

The owner explicitly deferred the unresolved 2C large-document timeouts and local worker-retirement investigation and approved a bounded hosted trial instead. The latest complete local run passed. Laptop resource pressure is a suspected contributor, not a demonstrated cause. This rollout does not mark 2C complete or certify maximum-size or high-concurrency production reliability.

No saved-data format, account ownership rule, request budget, paid plan or image host changes. Auth and Google callbacks remain direct. The new Pages build routes data and private artwork through the checkpoint. Enforcement is a separate private database switch, initially off: old clients continue working until enforcement is enabled. Requests already routed through the checkpoint are counted even while direct access remains available.

## Pre-change backup and staging

- [Verified encrypted backup run 39618685676](https://github.com/EsteriT/Pokedex/actions/runs/39618685676), 21 October 2026 at 21:39 Vietnam time. The workflow uploaded, downloaded, decrypted and validated the archive before reporting success.
- Archive: 163,290 bytes; SHA-256 `cba3787fcac44bb43b65cabf5f672c0a31419e6c7f3ba7b0f3b89ae480dac5b6`. Private R2 storage and its existing seven-day lifecycle remain in place. No backup contents or private credentials are published here.
- Applied the three reviewed migrations with original versions: `20261020150304_usage_gateway.sql`, `20261020153412_usage_bucket_owner_index.sql`, `20261020162450_collection_validation_batch.sql`. No existing Data API pre-request hook was replaced.
- Configured a fresh private random gateway secret and matching database digest. Approved origins: the existing GitHub Pages origin and local development on port 5500. The secret is never a public build value.
- Deployed `usage-gateway` version 1. Platform JWT prechecking is disabled because anonymous catalogue callers use a modern publishable key. The function's admission request and forwarded operation verify the original user JWT through PostgREST; private operations do not use the operator key.
- Readback confirmed enforcement off and a configured digest.

## Hosted checks before publication

Passed 21 October at 21:43 Vietnam time, using two disposable accounts and 23 checkpoint requests. Catalogue count 1,291; approved browser preflight accepted, other origins and unsupported routes denied; binder and collection Save/reopen; account isolation; private artwork upload/download and other-account denial; actual portable account export/restore. Direct GET/HEAD remained available as intended with enforcement off. Maximum observed request time was 3,667 ms, including cold startup; this small test is not a load certification.

Disposable accounts, sessions and artwork were cleaned up. The real account remained at one account, two binders and one collection before testing. Detailed aggregate receipts are ignored under `.scratch/qa/usage-hosted-*.json`; temporary operator/test scripts and private configuration stay ignored under `.scratch/`.

Post-publication readback confirmed zero disposable trial accounts, zero incompatible existing collections and enforcement still off. Aggregate function logs for the staging window contained normal log-level entries; this is a short observation, not ongoing monitoring or a guarantee of future reliability.

Security advisors flag intentional public SECURITY DEFINER entry points (bounded catalogue functions, the pre-request hook and secret-checked admission) and deliberately policy-free private tables with privileges revoked. These are reviewed architectural choices, not claims of a zero-warning scan. Password leak checking is also flagged; this beta uses Google login rather than password sign-in. See [Supabase function-exposure guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Remaining acceptance

- [x] Commit `4139e57` fast-forwarded into main and pushed. [Pages deployment 39619713318](https://github.com/EsteriT/Pokedex/actions/runs/39619713318) passed build, reference, model, database, repository and gateway checks. Live landing and all four app pages return HTTP 200; each app page contains the enabled checkpoint build flag and route adapter. Generated standalone previews remain unconfigured demos.
- [x] The owner confirmed Google sign-in, binder and collection Save/refresh, artwork upload and portable backup download/restore all pass on the staged live interface.
- [x] Enabled enforcement after that acceptance and read back `enabled = true`.
- [x] Verified direct GET/HEAD denial (403), GraphQL and private Storage denial; checkpoint traffic and account isolation still succeed.
- [x] A bounded invalid-write burst received 429 with Retry-After; saved documents survived, another account stayed independent, and an explicit valid Save succeeded after waiting.
- [x] Reviewed aggregate error levels and request timing; current state and evidence recorded below.

## Enforced trial acceptance - 21 October 2026

The enforced run passed at 21:54:37 Vietnam time, using two disposable accounts and 63 checkpoint requests. It repeated catalogue, CORS, Save/reopen, account isolation, artwork upload/download and actual portable account export/restore checks with enforcement on. Direct binder GET/HEAD returned 403. Direct private artwork and GraphQL requests were denied. A 36-request invalid-write burst returned only expected validation/throttle responses; Retry-After was positive, independent account/read operations still worked, and a valid collection Save succeeded after the indicated wait. Maximum measured response-header time was 760 ms; this is a small warm-runtime sample, not a production capacity promise.

Cleanup removed all disposable accounts/artwork. Aggregate real-account counts matched immediately before and after the enforced test (the owner had changed their test data since staging). No existing documents were rewritten by the trial harness. Existing collection compatibility checks returned zero failures; enforcement readback remained on. Function logs in the bounded trial window contained normal log-level entries; the test observed no unexpected server response or timeout. Detailed receipt remains ignored at `.scratch/qa/usage-hosted-enforced.json`.

The subsequent [operator backup run 39621097702](https://github.com/EsteriT/Pokedex/actions/runs/39621097702) passed with enforcement on, including encryption, private upload, download and recovery validation. Continue reviewing the first tester sessions for errors, response times and usage; no continuous watch or future scheduled-backup success is implied by this acceptance. The earlier local 2C investigation remains deferred.

## Rollback

First disable enforcement in a private operator session:

```sql
update binder_private.usage_gateway set enabled = false where id;
```

This restores the existing ownership-protected direct route. Then remove or set `POKEDEX_USAGE_GATEWAY` to `"false"` in the Pages build and redeploy if needed. Keep the function available for already-open updated tabs. Do not delete accounts/data, reset the database or remove ownership policies. An encrypted backup is recovery insurance, not the ordinary way to undo this toggle.

The controlled trial is not a spending cap or DDoS shield. Check errors, response time, Edge requests and provider usage during the first tester sessions. Investigate repeated failures promptly rather than assuming the earlier local hardware explanation is proven.
