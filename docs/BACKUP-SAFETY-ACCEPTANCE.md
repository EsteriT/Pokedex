# Backup safety acceptance

## Daily rollout started - 20 October 2026

The owner authorized resuming monitoring, enabling daily backups, verifying the first actual scheduled run and saving the acceptance record in Git. Healthchecks already showed **Up**, an available Pause button, email notifications **ON**, a one-day expected period and a three-hour grace. It did not require a resume action. This confirms the current monitor state, not its state after a future scheduled run.

GitHub repository variable `BACKUPS_ENABLED=true` was saved at **11:00:16 UTC / 18:00:16 Vietnam time** and read back successfully. The backup workflow is active. Its existing daily schedule remains `23 19 * * *` UTC, nominally **02:23 Vietnam time on 21 October 2026** for the next run. GitHub may start scheduled jobs later; no exact start time is guaranteed. No manual run was started for this acceptance.

| Rollout check | Status |
| --- | --- |
| Production monitor active | Verified Up, email ON |
| Daily schedule guard enabled | Verified true in GitHub |
| First successful scheduled run | Pending next actual `schedule` event |
| Fresh verified archive from that run | Pending the scheduled run |
| Monitor healthy after that run | Pending the scheduled run |
| Acceptance record in Git | Recorded on `test/backup-expiry-acceptance` |

The earlier scheduled run [39338352870](https://github.com/EsteriT/Pokedex/actions/runs/39338352870) was skipped before enablement and does not count. The successful manual backup runs below also do not count as scheduled acceptance.

After the scheduled run, inspect its event type, successful verification step and new private R2 archive; confirm the production Healthchecks monitor is Up with a corresponding new ping. Record the run URL, archive metadata and observation time without credentials or backup contents. Scheduling is now enabled, but the first scheduled-run acceptance must remain pending until this evidence exists. Local rollout receipt: `.scratch/qa/backup-daily-rollout.json` (ignored).


## Expiry check passed - 20 October 2026

At **10:23:39 UTC / 17:23:39 Vietnam time**, a fresh Cloudflare R2 object listing and direct retrieval confirmed that the disposable expiring marker was absent (HTTP 404). Its control marker, outside the expiry prefix, was still present (HTTP 200), with the original disposable-marker text and 61-byte listing size. The expiring marker was not manually deleted.

| Check | Observed result |
| --- | --- |
| Bucket | `pokedex-backups` |
| Expired marker | `acceptance-tests/2026-10-19/expiry/marker.txt` absent |
| Control before cleanup | `acceptance-tests/2026-10-19/control/marker.txt` present and content verified |
| Test rule before cleanup | `acceptance-expiry-2026-10-19`, enabled, age 86,400 seconds, exact expiry-test prefix |
| Earliest eligible time | 20 October at 06:20:57 UTC / 13:20:57 Vietnam time |
| Observation | Missing by 10:23:39 UTC; the exact automatic deletion time was not observed |
| Real recovery archives | Three present; keys, sizes, ETags and LastModified values unchanged across cleanup |
| Production retention | `expire-pokedex-backups-7-days` remains enabled, age 604,800 seconds, only `daily/pnuovoogfjzzlgmenhnq/` |
| Other existing rule | Default incomplete-multipart abort rule preserved |

After recording the pass, cleanup removed only the verified disposable control marker and the isolated test lifecycle rule. A fresh listing confirmed the dated test prefix was empty. Lifecycle readback matched both retained production rules exactly. Cleanup verification finished at **10:24:26 UTC / 17:24:26 Vietnam time**. No real backup object, database record, application code, authentication setting, schedule or monitor setting was changed.

Detailed object metadata and the completion receipt are in ignored local `.scratch/qa/backup-expiry-completion.json`. This receipt contains no backup contents or credentials.

## Earlier checks and remaining rollout

The acceptance record on Git branch `test/backup-safety-acceptance` documents the 19 October independent download/passphrase recovery, actual disposable local account restore, and owner-confirmed failure and missed-heartbeat emails. Those checks were not repeated for this expiry-only pass. The $5 spending warning was configured; actual threshold email delivery was not tested by incurring charges.

Manual hosted backups also passed before and after the catalogue release: [pre-release backup](https://github.com/EsteriT/Pokedex/actions/runs/39403631647), [catalogue-aware backup](https://github.com/EsteriT/Pokedex/actions/runs/39405167626).

**The expiry acceptance is complete.** The expiry-only pass did not change scheduling or monitoring. The subsequent owner-authorized enablement is recorded above; actual scheduled-run verification is still pending. Manual workflow successes do not prove the scheduler has run.

This isolated test confirms automatic expiry and prefix separation. It does not promise an exact deletion deadline for every future object, full database/Auth recovery, or automatic deletion of manually downloaded copies. Manual copies still need removal under the agreed seven-day policy.

Reference: [Cloudflare R2 object lifecycle documentation](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
