# Hosted binder rollout — 2026-10-17

The user authorized the hosted rollout after the local foundation was audited, committed, merged and pushed. Target: **Pokedex**, Singapore (`pnuovoogfjzzlgmenhnq`). This record distinguishes the live database from the separately deployed static website.

## Completed

- Confirmed the project was healthy and had no application tables or migration history before rollout.
- Applied the exact three reviewed SQL files through the Supabase connector, in dependency order.
- Verified RLS, explicit grants, owner-only reads, private-schema isolation and invoker-only public RPC wrappers. Browser roles have no general binder INSERT/UPDATE/DELETE permissions.
- Verified the `binder-artwork` bucket is private, accepts PNG/JPEG/WebP only, and limits each object to 500,000 bytes. Ownership policies require an account reservation; there is no UPDATE policy for immutable objects.
- Ran hosted assertions using two generated identities inside one rolled-back transaction: owner Save/read, direct-write denial, numeric printing rejection, stale-save denial, three-binder quota, foreign binder denial, foreign artwork reservation denial and anonymous write denial. No test users, binders or reservations remain from those checks.
- Verified the public HTTP API denies anonymous binder SELECT and commit RPC requests with HTTP 401 / PostgreSQL `42501`.
- Verified 55 catalogue records, zero exposed security-definer application RPCs and no anonymous usage of the private schema.
- Prepared and built the GitHub Pages configuration using only the hosted API URL and modern publishable key. Google and administrator secrets are excluded from the website and workflow.
- Published commit `83b0ede` to `main`. [Deploy website run 39025727131](https://github.com/EsteriT/Pokedex/actions/runs/39025727131) succeeded, including build, reference checks, model tests, embedded database tests and repository tests.
- Fetched the live root/landing pages and verified Workspace navigation. All four live application pages embed the exact hosted public configuration, with no localhost backend URL. Rechecked Google-only provider flags and anonymous HTTP read/commit denial after publication.

## Migration history

The connector assigned application-time versions. Each recorded SQL statement was compared byte-for-byte by its digest against the reviewed Git file before reconciling **only the history version** to the original file timestamp. The changes were not replayed. All three hosted history versions now match Git/local history, preventing a future CLI push from trying to create the same objects again.

| Version | Migration | SQL SHA-256 |
| --- | --- | --- |
| `20261016221119` | `binder_foundation` | `ca2736cc95daf81faf489645decb4beb9cc640c7de61a4d4f1c115fb5ab7b866` |
| `20261016221736` | `private_binder_artwork` | `f9205bcdd86ab463f32b12b140f49c3223eec5802fd46a738e21fa96003ff4d4` |
| `20261017084034` | `binder_validation_hardening` | `ac396aea938512dccd9a57a0e34b2d387a7e36b2ec902c774370d790de10a861` |

## Advisor results

No warning/error findings were returned. Informational findings were:

- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) on `binder_private.catalogue` and `binder_private.artwork`: intentional default-deny tables, with browser grants revoked. Checked private functions perform the permitted operations. Do not add permissive policies simply to remove this notice.
- [Unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index): the deployment is new. Owner/position and owner/artwork indexes support the intended bounded queries; an empty usage history is not evidence they should be deleted.

These checks do not measure production load. Beta limits remain three binders, 30 pages per binder, 2,000 overflow items and 60 reserved artwork objects per account. Collection records remain browser-local.

## Provider configuration and remaining acceptance

The user confirmed the following dashboard settings are saved. Public Auth settings verify Google enabled, Email disabled and anonymous sign-ins disabled. The authorize endpoint returns a Google redirect with the correct hosted callback and expected client ID. No private credentials were printed or included in the website.

1. Google Cloud → Google Auth Platform → Clients → the existing Web client: add JavaScript origin `https://esterit.github.io` and redirect URI `https://pnuovoogfjzzlgmenhnq.supabase.co/auth/v1/callback`. Preserve the local development entries. If the OAuth audience is in Testing, explicitly add intended beta testers as test users.
2. Supabase → Authentication → Sign In / Providers → Google: enable it and enter the existing client ID/secret privately. Disable the Email provider; anonymous sign-ins stay disabled. The beta login method is Google.
3. Supabase → Authentication → URL Configuration: Site URL and allowed return URL must be exactly `https://esterit.github.io/Pokedex/Pokedex-workspace.html`. Do not use wildcard redirects.
4. Public Auth settings, the generated Google authorize redirect, Actions deployment and live embedded configuration are verified.
5. **Still required:** verify actual hosted Google login/return, create a binder, place a card, Save, reload, restore/download a portable artwork backup, sign out and reopen from another browser profile. The production provider flow is separate from the earlier successful local Google test.

The existing browser-local binders are not automatically migrated. After hosted sign-in, Account → Import a browser binder explicitly copies one selected binder and preserves its original.

## Recovery

If frontend activation fails, remove the public hosted build settings and redeploy the unconfigured prototype. Keep the hosted data/migrations intact while diagnosing the failure; frontend rollback is not permission to reset a database or delete user uploads. Never publish the local development URL or a service-role/administrator key.
