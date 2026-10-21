# Backup safety acceptance

## First scheduled backup accepted - 21 October 2026

The first successful actual `schedule` event is [run 39508117746](https://github.com/EsteriT/Pokedex/actions/runs/39508117746), attempt 1, on `main` at commit `d6e8d5d3b1d035ae511d8d54851cc5836336183e`. It started at **05:26:26 Vietnam time** (20 October 22:26:26 UTC) and completed successfully at **05:26:53**. This was 3 hours 3 minutes after the nominal 02:23 schedule. The delay's cause was not investigated in this acceptance; scheduled jobs are not exact-time guarantees. No manual backup or rerun was started for this check.

| Check | Evidence / result |
| --- | --- |
| Actual scheduled run | Event `schedule`, workflow `backup.yml`, completed `success`; the earlier skipped run does not count |
| Encryption and verification | `Create, encrypt, upload and verify backup` step passed; its log reports `Verified encrypted R2 backup` |
| Fresh archive | Timestamp `2026-10-20T22:26:47.944Z`; **163,290 bytes**, Standard storage, managed daily prefix |
| R2 readback | Fresh complete object listing at 21 October 12:11 UTC matched the exact logged archive key and byte size; LastModified `22:26:48.588Z` |
| Workflow-reported SHA-256 | `849082179b6f1113bd1d2c4415b70b1db123e31a89c588701064449cd3da5e1c` |
| Healthy monitor afterward | At about 19:20 Vietnam time the owner read back: **“This check is up. Last ping was 13 hours ago.”** This is consistent with the 05:26 scheduled success |
| Runtime/settings changed by this check | None; no monitor ping, pause/resume, schedule edit, database action, upload or deletion |

The deployed workflow downloads the uploaded bytes, compares the digest, decrypts and validates recovery content before sending its success signal. That code path and the successful job/log are the verification evidence here. This read-only follow-up matched provider metadata; it did **not** independently recompute today's archive digest or perform another operator restore. The earlier independent recovery/alert tests remain documented separately. Browser access was unavailable, so the monitor status is owner-confirmed rather than an automated dashboard observation. An initial broad reply suggested a monitor problem; the owner's precise status readback resolved that ambiguity without changing the monitor.

**Scheduled-run acceptance passes.** Daily backups and monitoring remain enabled. The next nominal run is **22 October at 02:23 Vietnam time**, subject to scheduling delay; no future run is claimed as tested. The observation receipt is in ignored `.scratch/qa/backup-scheduled-acceptance.json`. These notes are saved locally with the current uncommitted branch work; no merge, push or deployment was performed.

The older pending paragraphs below describe the historical enablement state, before this scheduled run was verified.

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
