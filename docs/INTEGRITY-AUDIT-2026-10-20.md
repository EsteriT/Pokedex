# Integrity audit and bug-fix pass - 20 October 2026

What this repo does: a browser-based Pokemon binder and collection app, with private Supabase saving, a ten-set public catalogue, and encrypted operator backups. This review assumes the current small beta and its existing limits, rather than a complete English catalogue or large-scale traffic.

Work is isolated on `fix/integrity-vacuum`, based on `52cc76f` (the saved backup-acceptance notes). No production deployment, schema change, data cleanup or monitoring/schedule change was performed for this audit.

Publication follow-up: the owner subsequently authorized commit, merge, push and website deployment on 20 October. Release-time model, embedded database, repository, local-server security, hosted packaging, reference and private-secret checks passed again. This authorization supersedes the audit's local-only status; the existing Pages workflow and live-route verification determine deployment success. Database and backup settings remain outside this release.

## Findings fixed

### 1. Private development files could be served to the local network

**What this is:** the setup guide instructed developers to run Python's unrestricted HTTP server from the repository root. Python's own help confirms its default binding is all network interfaces; the root also contains ignored private configuration and development artifacts.

**Problem:** that command can expose files outside the public app directories to reachable computers. This is a development setup issue, not evidence that GitHub Pages published private files; Pages still publishes only `dist/`.

**Fix:** added `scripts/serve-local.py` and `npm run dev`. It binds only `127.0.0.1`, verifies the Host header, resolves paths inside the repository, serves only `src/`, `assets/` and `preview/`, denies hidden paths and directory listings, and applies the same guard to GET and HEAD. JavaScript MIME types and no-store responses support the existing development workflow. The public `dist/` preview command also now binds to loopback.

**Verification:** `npm run test:server` checks normal app routes, root redirect, JavaScript MIME, no-store headers, private/dot paths, encoded traversal, GET/HEAD denial, unexpected Host names and unsupported POST. No private file contents are read by the test. Existing cloud sign-in continues using its allowlisted port 5500; alternate ports need matching local redirect configuration.

### 2. A catalogue outage could make a valid account backup look corrupt

**What this is:** account restore parses a backup, obtains missing public card metadata, validates the document, asks for confirmation and then restores it.

**Problem:** parsing, metadata loading and validation shared one catch block. A metadata network failure was replaced with the message that the backup file was invalid, hiding the retryable cause.

**Fix:** malformed JSON and invalid backup documents retain the invalid-file message. Public metadata failures keep their actual retry/error message. Restore does not begin when that step fails.

**Verification:** real local source/preview browser acceptance injects a catalogue outage with a valid exported backup, checks the retry message and zero restore calls, then checks malformed JSON and completes the normal account backup/artwork restore round trip. Existing typed deletion, failure retry and account-isolation acceptance also passes.

### 3. Current status documentation contradicted the deployed features

README/architecture still presented the connected catalogue as future work and backup scheduling as disabled. Setup documentation also repeated the unsafe root server command. Corrected current catalogue/release wording, local server commands and the active scheduling guard guidance. Historical milestone records remain historical; the first actual scheduled-run acceptance is still pending.

### 4. The editor created a label only to remove it immediately

Removed 13 lines constructing and deleting an unused finish label in each picker tile. The resulting DOM and visible behavior are unchanged. No dependencies or shared abstractions were added for this cleanup.

## Verification

- Model/catalogue/editor/customization/collection tests, including explicit Save, Undo/Redo, malformed imports, quotas and rollback: passed.
- Embedded PostgreSQL ownership, validation, atomic writes, conflicts and catalogue access rules: passed.
- Repository fixtures covering account changes, offline failure, drafts and local/cloud isolation: passed.
- Full isolated source/preview frontend browser suite: passed, including desktop/phone layouts, touch movement, merge/swap/insertion, menus, focus, navigation, Discover, collection and viewer behavior. The final dead-label deletion preserves the tested DOM; real backend browser checks subsequently passed on the final source/preview build.
- Real local HTTP/Auth/Storage and source/preview backend browser suite: passed, including new-card saves/reloads, conflicts, portable artwork recovery, account restore/deletion and cross-account denial.
- New loopback server security checks: passed.
- All five previews rebuilt and source/reference checks passed. A hosted-configured six-page package built and validated locally; ignored source settings and review previews were restored afterward. No deployment was performed.
- npm dependency audit: zero reported vulnerabilities in all 77 dependency entries at check time. No package version or lockfile change.
- Static undefined-variable/unused-variable diagnostics: no findings across application and operator JavaScript. Private-secret scan of Git candidates and generated output: passed.

## Limits and remaining work

This is a risk-focused whole-project pass, not a guarantee that every possible input or browser is bug-free. Manual review concentrated on authentication/account boundaries, validation, saving/restoring, private artwork, catalogue loading, backup encryption/retention and build/development entry points. Every source JavaScript module was parsed; UI/demo behavior was covered by the browser suite rather than a line-by-line review of every animation or stylesheet.

Physical devices, Safari/Firefox, real Google consent and destructive production account operations were not retested. Real R2 deletion and alert delivery were not repeated; their separate acceptance record remains authoritative. The future first daily scheduled run cannot be declared passed in advance. Upstream TCGdex first-visit image latency remains outside these fixes. No full-catalogue/load-scale performance claim is made.

Verdict: the confirmed development-file exposure and misleading restore message are fixed locally, the reviewed data-integrity paths pass, and the patch is ready for review before any merge or deployment.
