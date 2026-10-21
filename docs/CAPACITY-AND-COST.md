# Step 2D: capacity, costs and growth decisions

Reviewed **21 October 2026** on `feat/usage-protection`. This is an operating plan and an offline calculator. No paid service, deployment, migration, quota change, new monitor or backup run was created. Docker is not required. The deferred intermittent failures in [2C](USAGE-LOAD-ACCEPTANCE.md) remain open; this plan does not resolve or waive them.

## Owner's short version

- Keep the beta small while collecting actual usage. Begin with 5–10 invited testers; review the numbers before each expansion. This is a suggested operating practice, **not an implemented sign-up restriction**.
- A small, lightly used beta can fit the free allowances. Do not promise that every set of ten accounts fits: artwork use and repeated full backups matter more than the count alone.
- The first engineering growth limit is the **256 MiB uncompressed operator backup**, which covers all accounts together. A small encrypted file does not prove enough room remains before compression.
- Keep the existing $5/month Cloudflare warning as an investigation trigger. It neither caps charges nor covers a future Supabase subscription.
- If paid Supabase becomes necessary, the one-project Micro example starts around **$25/month**, before tax, optional extras and overages. Buying it does not repair the application's backup-size limit. [Supabase pricing](https://supabase.com/pricing).
- Before selling the app as a paid service, plan a frontend hosting move: GitHub Pages restricts commercial SaaS hosting. No hosting move is part of 2D. [GitHub Pages policy and limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

## What was actually observed

Read-only provider metadata confirmed the Pokedex organization is on **Supabase Free**, its project is healthy and in Singapore. One aggregate-only database query on 21 October at 10:24 UTC returned these sizes; it retrieved no email addresses, tokens, card lists, notes or artwork bodies:

| Measurement | Observed bytes | Meaning |
| --- | ---: | --- |
| PostgreSQL database size | 13,268,659 | Physical database reading; not a monthly invoice or disk-allocation reading |
| Saved binder JSON total | 2,268 | Serialized documents, excluding image bodies stored separately |
| Saved collection JSON total | 1,096 | Serialized collection documents |
| Public catalogue JSON | 554,454 | 1,291 printings; ten-set release |
| Uploaded artwork bodies | 124,968 | Current `binder-artwork` object sizes from metadata |

The managed R2 daily prefix contained **four Standard encrypted archives, 580,808 bytes in total**, at 10:18 UTC. The newest archive was 163,290 bytes. This is prefix metadata, not account-wide billed storage, proof of a successful scheduled workflow, or a new decryption/recovery acceptance. First scheduled-run/monitor acceptance remains separate.

Aggregate evidence is stored in ignored `.scratch/qa/capacity-baseline.json`. Do not put decrypted backups, passphrases or user-level measurements into Git. Current-cycle Supabase egress/cached egress, MAU, Edge usage, other-project consumption, account-wide Cloudflare charges and invoice controls were **not** read or verified. Check their billing dashboards before a spending decision.

## Which service pays for which work?

| Service | Role and allowance relevant to this project |
| --- | --- |
| Supabase Free | 500 MB database, 1 GB file storage, 5 GB uncached plus a separate 5 GB cached monthly transfer allowance, 50,000 monthly active users. These are different limits, not a promised audience size. [Plan reference](https://supabase.com/pricing) |
| Supabase Edge Functions | When enabled, the request gateway spends invocations even for rejected/failed requests. Free includes 500,000/month; Pro includes 2 million, then $2 per additional million, rounded to packages. OPTIONS is not billed. Protection is currently off. [Invocation billing](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations) |
| Supabase transfer | Database, Auth, Storage and Functions contribute. Downloading all records/artwork for a daily backup spends **source** transfer even though the destination is R2. Cached and uncached allowances are separate. Paid uncached overage is $0.09/GB; cached is $0.03/GB. [Transfer rules](https://supabase.com/docs/guides/platform/manage-your-usage/egress) |
| Cloudflare R2 Standard | Stores encrypted archives. Includes 10 GB-month, 1 million Class A and 10 million Class B operations/month; excess is $0.015/GB-month, $4.50/million A, $0.36/million B, rounded up by billing unit. Internet egress is free. Allowances are shared, not reserved for this bucket. [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| GitHub Actions | Existing backup jobs use standard `ubuntu-latest`. Standard hosted runners in public repositories are free; changing runner type or repository visibility requires a billing review. [Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage) |
| GitHub Pages | Current static frontend. Published site limit 1 GB; soft transfer limit 100 GB/month. The six existing packaged HTML files total about 6.88 MB uncompressed; that is not the amount fetched per visit. Commercial SaaS restrictions are a separate migration trigger. [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) |
| Healthchecks | Watches the backup heartbeat. The provider advertises 20 checks free; the current backup needs one. This task did not inspect its plan or check state. [Healthchecks](https://healthchecks.io/) |
| TCGdex | The catalogue provider describes its API as freely available/open source. Card images still load directly from TCGdex; we do not store them in Supabase/R2. Upstream availability, responsible use and rights remain separate from our hosting budget. [TCGdex](https://tcgdex.dev/) |

R2 currently needs roughly one PUT, one verification GET, one prefix listing and an expiry HEAD per daily cycle, plus any expired-object deletion. Extra list pages, retries, manual runs and other applications add operations. A once-daily small backup is far below the operation allowances; source transfer and backup processing deserve attention earlier.

Free allowances do not mean unlimited service. For example, Supabase documents Free database read-only restrictions above 500 MB, with separate organization-level fair-use restrictions possible. Physical usage, averaged usage and billing-cycle totals are not interchangeable. [Database size behavior](https://supabase.com/docs/guides/platform/database-size). File storage is billed as an average over time; deleting files late in a cycle does not immediately undo earlier usage. [Storage billing](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size).

## Repeatable scenarios

Run from the repository:

```powershell
npm.cmd run capacity:plan
npm.cmd run test:capacity
```

Editable assumptions are in [CAPACITY-ASSUMPTIONS.json](CAPACITY-ASSUMPTIONS.json); arithmetic is in [capacity-plan.cjs](../scripts/capacity-plan.cjs). For a private aggregate-only alternative, copy the JSON into ignored `.scratch/`, edit its counts/sizes and run:

```powershell
node scripts/capacity-plan.cjs .scratch/my-capacity-assumptions.json
node scripts/capacity-plan.cjs --json
```

The tool only reads local JSON and prints results. It has no network, environment-file, database or Docker access. No credentials or individual account records belong in its input.

All example accounts are assumed monthly active, with a constant stored population over 30 days and one full backup daily. Inactive saved accounts still contribute to every backup. The light profile assumes 0.35 MB saved JSON, 1 MB artwork and 8 MB other monthly transfer per account. The artwork-heavy profile assumes 1 MB JSON, 10 MB artwork and 40 MB other transfer. Other transfer includes ordinary browsing, account/artwork downloads and user backups; external TCGdex images are excluded. These are **hypotheses, not measured averages**.

Both use a 1 MB shared catalogue/archive allowance, a deliberately conservative 100 MB database baseline, 2x document bytes as a rough database sizing factor, 100 MB public monthly transfer and 25% transfer headroom. The database factor is not a prediction of PostgreSQL compression/index growth. The model reserves eight archive copies for seven-day retention plus operational headroom, assumes no compression saving and includes base64's approximate 4/3 expansion plus JSON overhead. Real archive size, lifecycle delays, extra manual copies and daily peaks need monitoring.

| Hypothetical profile | Accounts | Monthly source transfer incl. headroom | Uncompressed backup | Planning result |
| --- | ---: | ---: | ---: | --- |
| Light | 10 | 0.77 GB | 17.0 MiB | Within modeled free quotas and backup cap |
| Light | 50 | 3.19 GB | 81.4 MiB | Review actual transfer before growth |
| Light | 100 | 6.23 GB | 161.9 MiB | Exceeds modeled free uncached transfer; start backup redesign |
| Light | 500 | 30.48 GB | 805.6 MiB | Current backup cannot produce this snapshot |
| Artwork heavy | 10 | 4.79 GB | 137.7 MiB | Near free transfer allowance; investigate backup growth |
| Artwork heavy | 50 | 23.29 GB | 684.6 MiB | Current backup cannot produce this snapshot |

These are illustrative outcomes, **not supported concurrent-user counts**. The tool returns no Free price when modeled usage exceeds a Free allowance; it must not suggest an over-quota Free project continues working for $0. Pro estimates are separate hypothetical metered quotes and may describe a workload the current backup cannot support.

Formula checks:

```text
Daily source backup bytes ≈ all saved JSON + public catalogue + raw artwork
Monthly backup source bytes ≈ daily source bytes × successful/attempted full runs
Uncompressed snapshot ≈ JSON + catalogue + artwork × 4/3 + metadata
Retained R2 bytes ≈ encrypted archive size × copies retained
```

The calculator uses decimal GB for conservative planning and exact MiB for the application cap. Billing dashboards control actual units/rounding and organization-wide consumption. It treats transfer as uncached, uses a single outward-transfer estimate plus headroom, and does not claim to establish same-project gateway billing attribution or wire compression. Reconcile the model with observed service usage after any gateway rollout. Extra rejected requests still spend Edge invocations; the per-minute checkpoint is not a monthly billing cap.

## Growth limits that payment does not automatically solve

The 256 MiB limit in [backup-crypto.cjs](../scripts/backup-crypto.cjs) applies to the serialized archive **before gzip**. The exporter, encryption and verification hold multiple copies in memory. Do not increase the limit as a shortcut. Begin a separately reviewed streaming/chunked encrypted backup and independent recovery design before reaching the action points below.

The storage envelope allows 60 objects × 500,000 bytes = 30 MB/account. Portable image rules can impose a smaller usable file size. Base64 alone can turn 30 MB into about 40 MB per full export. Adding three documents at their 2.3 MB ceilings and a 16 MiB collection approaches 63.7 MB per account before shared metadata. Five such storage envelopes exceed the aggregate backup limit. This is an upper-bound warning, not a typical valid user fixture or a claim that each account can attach all those images simultaneously.

Full-English catalogue expansion also needs its own compatibility review: the importer/recovery validator currently cap the catalogue at 10,000 records and the trial importer requires exactly ten sets. Do not import a larger catalogue by raising only one ceiling. Metadata also grows daily backup size and source transfer.

## What to check and when to act

These are **manual operating thresholds**, not new configured alerts or automatic restrictions. Use organization-wide totals and forecast the billing cycle, not only this project's visible count. At 70%, investigate and update the model; at 85%, stop expanding invitations and make a specific optimization/upgrade decision before quota exhaustion. Do not delete saved user data or disable backups to force the numbers down.

| Check | Review point | Action point | Where / response |
| --- | --- | --- | --- |
| Free database | 350 MB | 425 MB | Supabase organization Usage + project Database; inspect size drivers, approve upgrade before a write restriction |
| Free file storage | 700 MB | 850 MB | Supabase Usage/Storage; review normal artwork cleanup and expected growth |
| Monthly uncached transfer | 3.5 GB forecast | 4.25 GB forecast | Supabase Usage → Egress; separate backup reads from browsing; review paid allowance if normal usage requires it |
| Cached transfer | 3.5 GB forecast | 4.25 GB forecast | Separate cached meter; do not combine its allowance with uncached |
| Edge invocations if protection is activated | 350,000 forecast | 425,000 forecast | Supabase Usage/Functions; inspect loops, excess attempts and gateway overhead |
| Monthly active users | 35,000 forecast | 42,500 forecast | Supabase Auth usage; not expected to be the first small-beta constraint |
| Serialized full backup | 128 MiB | Design by 160 MiB; pause expansion by 192 MiB | Record exact pre-compression bytes in a future reviewed backup instrumentation change; current encrypted-byte log is insufficient |
| Backup duration | Over 10 minutes or sharply rising | Over 20 minutes / any failure | Actions has a 30-minute job timeout; investigate before it becomes routine |
| R2 retained storage | 7 GB-month forecast | 8.5 GB-month forecast | Cloudflare account Billable Usage + bucket metrics; inspect extra/manual copies and expiry |
| Cloudflare spend | Any unexpected positive cost | Existing $5 email warning | Review account-wide usage/invoice; notification does not stop charges |
| Saved-data reliability | Any repeatable normal Save/restore error | Immediate investigation | Preserve drafts and evidence; revisit 2C and provider health |

Check backup success/freshness and Healthchecks every day, billing/storage weekly during a quiet beta, and daily after an invitation batch or unexpected increase. Forecast recurring monthly transfer as `used / elapsed cycle days × total cycle days`; early-cycle spikes need judgment. Example: 1 GB in five days projects to 6 GB in a 30-day cycle.

A backup failure is a same-day incident. Existing archives continue to expire after seven days even if new snapshots fail. The first genuine scheduled-run/monitor acceptance in [BACKUP-SAFETY-ACCEPTANCE.md](BACKUP-SAFETY-ACCEPTANCE.md) subsequently passed on 21 October using the actual scheduled run, verification log, matching R2 metadata and owner-confirmed monitor status; the earlier size-only object listing was not used alone to close it.

## Budget and upgrade choices

1. **Current small beta:** stay Free while actual meters remain below review points, maintain tested backups and accept the Free plan's documented limitations. Do not automatically buy services based on a modeled account count.
2. **Outgrowing normal Free usage:** compare a single-project Pro/Micro base near $25/month. The calculator adds published storage/transfer/function overages as a what-if; database disk estimates are approximate and cannot set actual provisioned disk. Compute upgrades, additional projects, taxes, domains, PITR and other add-ons are excluded. Larger compute is a separate performance decision, not proof that 2C is solved.
3. **Cost controls:** keep the paid-plan Spend Cap enabled if Pro is later approved, but review its exclusions: compute and certain opted-in add-ons are outside it. It is not an arbitrary $5 total-bill cutoff. [Supabase cost controls](https://supabase.com/docs/guides/platform/cost-control).
4. **Cloudflare warning:** the accepted $5 is an account-wide usage-spend warning, not a subscription fee or guaranteed maximum. Alerts do not pause service; a charge can accrue without asking for permission again. Delivery at the threshold was not tested here. [Cloudflare budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/).
5. **Before paid SaaS:** plan static frontend hosting on a suitable service. Cloudflare Workers Static Assets is one existing-account option: direct static-asset requests/storage are free; Worker script execution has separate limits/pricing. Migration would require approved origin/Google redirect changes and login/Save checks. Keep private R2 backups private. [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

## Acceptance and remaining work

2D provides a repeatable, tested planning model, a dated aggregate baseline, cited pricing, manual thresholds and explicit next decisions. It is not an automatic spending-control implementation or a hosted capacity certification.

Verification on 21 October: `npm.cmd run test:capacity`, JSON output/CLI error checks, JavaScript syntax checks, cached Prettier formatting, the existing `npm.cmd test` regression suite, the preview build and project reference check passed. Local Markdown links and whitespace checks passed. An offline scan of 211 Git candidates found no configured private values/private-key patterns. The build preserved the ignored local backend configuration, and landing content remained unchanged. Docker was not started or used.

- [x] Inspect current quotas, backup/export behavior and earlier 2C evidence.
- [x] Verify current primary-source prices and read-only plan/size metadata.
- [x] Model light/heavy growth with separate source transfer, pre-compression size and R2 storage.
- [x] Test arithmetic, invalid inputs, billing-unit boundaries and oversized backups.
- [x] Document monitoring ownership, thresholds, paid-plan choices and commercial-hosting prerequisite.
- [ ] Record current-cycle billing/traffic totals and reconcile real growth after the next tester batch.
- [ ] Add approved pre-compression backup-size telemetry before the review point is approached; do not infer it from compressed bytes.
- [ ] Design streaming backups before the aggregate action threshold is approached.
- [x] Complete the separate scheduled-backup/monitor acceptance (subsequent 21 October check; see its evidence record).
- [ ] Complete the deferred 2C investigation.
- [ ] Obtain separate authorization for any merge, publishing, paid service or protection activation.

No frontend flow, backend runtime, saved-data format, quota, credential or production configuration was changed for 2D.
