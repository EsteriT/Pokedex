# Step 2E: controlled hosted request protection

Status on 21 October 2026: authorized by the owner. The checkpoint is deployed with origin enforcement **off**. Website publication and owner acceptance are in progress. This record supersedes earlier local-only rollout restrictions for this specific release.

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

Security advisors flag intentional public SECURITY DEFINER entry points (bounded catalogue functions, the pre-request hook and secret-checked admission) and deliberately policy-free private tables with privileges revoked. These are reviewed architectural choices, not claims of a zero-warning scan. Password leak checking is also flagged; this beta uses Google login rather than password sign-in. See [Supabase function-exposure guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Remaining acceptance

- [ ] Publish the reviewed branch and confirm the Pages build uses the checkpoint.
- [ ] Owner checks actual Google sign-in, Save/refresh, artwork and portable backups on the deployed interface. Save or download any old open-tab drafts before refreshing.
- [ ] Enable enforcement for the controlled trial only after hosted checks and owner interface acceptance pass.
- [ ] Verify direct GET/HEAD, GraphQL and private Storage denial; checkpoint traffic and account isolation still succeed.
- [ ] Verify bounded excessive writes receive 429 with Retry-After, saved data survives and another account remains independent.
- [ ] Review error logs and latency; record final trial state and release commit.

## Rollback

First disable enforcement in a private operator session:

```sql
update binder_private.usage_gateway set enabled = false where id;
```

This restores the existing ownership-protected direct route. Then remove or set `POKEDEX_USAGE_GATEWAY` to `"false"` in the Pages build and redeploy if needed. Keep the function available for already-open updated tabs. Do not delete accounts/data, reset the database or remove ownership policies. An encrypted backup is recovery insurance, not the ordinary way to undo this toggle.

The controlled trial is not a spending cap or DDoS shield. Check errors, response time, Edge requests and provider usage during the first tester sessions. Investigate repeated failures promptly rather than assuming the earlier local hardware explanation is proven.
