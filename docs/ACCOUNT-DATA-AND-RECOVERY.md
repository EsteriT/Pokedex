# Account data and recovery

Status: deployed and accepted on 2026-10-19. Both reviewed database migrations and the website update are verified; the user confirmed hosted account backup/restore and fresh Google sign-in followed by deletion/sign-out pass. See the [rollout record](ACCOUNT-DATA-ROLLOUT.md). This extends the accepted binder and collection milestones.

## For users

In Workspace, open **Account → Account data**.

- **Download all my data** exports saved binders, the saved collection and every uploaded artwork file, including unused uploads. It produces one versioned JSON file. Save edits first: open drafts and browser-only originals are not included. Credentials and sign-in tokens are excluded. This portable file is **not encrypted**; keep it private.
- **Restore account backup** validates the file and asks before replacing saved binders and collection records together. Restored binders receive new IDs, so old editor/viewer bookmarks may need replacing. Existing artwork is retained for recovery; remove unused artwork afterward if necessary. A revision conflict rolls back both record sets. Uploads completed before a failed restore can remain unused until cleanup; existing beta artwork quotas still apply.
- **Delete my account permanently** requires typing `DELETE` and a live sign-in created within ten minutes. An older session must sign in again with Google. This removes cloud binders, collection, artwork, operation counters and the Auth account/identities/sessions. Browser originals and downloaded files remain on their devices.

Account data controls are in Workspace so an editor draft cannot be silently discarded. A dirty or saving collection blocks these controls until saved or backed up and reloaded. Existing per-binder and collection backups remain available.

## How deletion works

1. Check the signed JWT's session against `auth.sessions` and its owner; never trust editable user metadata.
2. Lock the owner's `auth.users` row, shared with saves and artwork reservations. Mark deletion as pending. There is no cancellation after this step.
3. Block further record writes/reservations and Storage uploads. Remove the owner's files through the authenticated **Storage API**, never by deleting Storage metadata with SQL.
4. Confirm no application artwork remains, then delete the Auth user. Foreign keys cascade application records. An unexpired JWT cannot recreate the removed account.

If file removal fails or the connection drops, the account remains pending. Open Account data and retry, signing in again if necessary. The identity-only account path still works when a partially deleted image prevents normal binder loading. Completed deletions cannot be undone through this UI. Provider and infrastructure logs have their own retention rules; the app does not erase downloaded copies or older offline backups remotely.

## Free manual operator backups

The user selected manual encrypted backups on their computer, with a second copy off the computer. There is no paid backup service or automatic schedule. A backup is only as recent as the last successful manual run.

From the project terminal, with Docker/Supabase running:

```powershell
npm run backend:health -- --local
npm run backend:backup -- --local
```

The backup command prompts for a hidden passphrase twice. Use at least 16 characters and keep it in a password manager. Lost passphrases cannot be recovered. It exports application snapshots and actual private artwork bytes, compresses them, and encrypts them with AES-256-GCM. A fresh random salt and nonce are used each time; scrypt derives the encryption key. The command verifies decryption before writing the encrypted `.pdxbackup` file into ignored `.scratch/backups/`.

**Copy the encrypted file to a separate device or private drive after each successful backup.** `.scratch/` is disposable and Git does not preserve it. Keep the passphrase separately. The beta tool stops above 256 MB of uncompressed application data; move to a streaming backup before exceeding that limit. It never exports Google secrets, password hashes, refresh tokens or Auth configuration.

### Hosted backup preparation — operator only

Do this after hosted rollout is authorized. These commands read the hosted project; they do not change it. Backup also supports the previous binder/collection schema so a verified pre-migration copy can be made first; health identifies whether account controls are installed.

1. Log the Supabase CLI into the operator account (`npx.cmd supabase login` in Windows PowerShell). Dashboard/browser login and the backup administrator key do not sign the CLI in. Complete the interactive login privately in your terminal.
2. Privately add `POKEDEX_BACKUP_URL` and `POKEDEX_BACKUP_SECRET_KEY` to ignored `.env.local`. The URL must exactly match the explicitly selected project. The secret is a **server-only administrator key**, obtained privately from the project dashboard. Do not put it in `src/`, Git, chat, a browser or a public environment variable.
3. Run:

```powershell
npm run backend:health -- --hosted pnuovoogfjzzlgmenhnq
npm run backend:backup -- --hosted pnuovoogfjzzlgmenhnq
```

The browser still uses only its publishable key. The operator key is read only by the Node backup tool, and neither SQL results nor keys are printed. If artwork is removed during the snapshot/download interval, the backup fails instead of writing an incomplete archive; retry after activity settles.

### Recovery drill

```powershell
npm run backend:recover -- ".scratch/backups/<your-file>.pdxbackup"
```

Enter the passphrase. The tool checks authentication/tampering and model validation, then extracts per-account portable JSON files and a private `owner-map.json` into a new `.scratch/recovery/` directory. These extracted files are **decrypted private data**. No database is changed by extraction.

For a service outage:

1. Restore the application schema using the migration files in Git and recreate the Auth/provider settings from the setup guides. The archive is application-data recovery, not a full PostgreSQL/Auth point-in-time restore.
2. Reconcile the latest deletion requests before selecting accounts to recover. Never bulk-resurrect accounts from an old archive. Pending deletions recorded in an archive are excluded by the recovery tool, but an older archive cannot know about a later deletion.
3. Have the owner sign in again. Verify ownership against the private owner map and their current verified sign-in. Do not hand an account file to someone based on an unverified email message.
4. Test the recovered account file on the local stack first. Then, with the owner's authorization, use Account data → Restore account backup in that owner's signed-in account. Artwork paths are regenerated for the destination owner; original Auth IDs are not recreated.
5. Check both binders and collection, artwork rendering, Save/refresh and a second browser. Remove temporary decrypted recovery files once verified.

The user selected **7 days** of retention on 2026-10-18. After every backup, manually delete encrypted archives older than seven days from `.scratch/backups/` **and every off-computer location**. Also check expiry even during periods without new backups; there is no scheduled cleanup. The timestamp is in each archive filename. Keep the newest verified, unexpired copy. If none remains, make a new backup instead of retaining expired copies. Never commit encrypted or decrypted user archives. This operator procedure must be followed to keep the user-facing seven-day deletion statement accurate.

## Operational checks

`backend:health` prints aggregate account/binder/collection counts, artwork bytes/object counts, pending deletion count and reported failure categories from the last seven days. It also runs a read-only preflight for binder text/images that exceed portable limits and missing artwork. It prints no emails, record contents or tokens. Unexpected compatibility findings require owner-approved repair before rollout; missing files in a known pending deletion can be resolved by retrying deletion.

Failed binder/collection Save requests report only an allowlisted category, best effort. Counters are capped per owner/day/category, pruned for that owner on subsequent reports, and removed on account deletion. Inactive old counters can remain until another report or deletion; the health query excludes them. Offline reports may never arrive. This is a small beta diagnostic, not complete telemetry, alerts, uptime monitoring or a record of every failed operation.

## Verification and rollout gate

The local checks below pass on 2026-10-18. The complete frontend regression suite also passes for source and previews. Local advisors report no issues, production dependencies have no reported npm vulnerabilities, and disposable local test accounts were removed. The hosted-configured artifact was built and scanned without deploying it. No production account or hosted database was changed for this milestone.

- Embedded PostgreSQL: live/recent session requirements, cross-account denial, permissions, atomic restore conflict rollback, write/upload lock, partial deletion, cascades, stale JWT behavior.
- Real local Auth/Storage: file removal before Auth deletion, independent accounts and an old access token after deletion.
- Real encrypted backup/decrypt/extract and restored application data including artwork; wrong-passphrase and tamper rejection.
- Isolated Chromium: account backup/restore, typed confirmation, Storage failure/retry, sign-out and browser-original preservation, for source and generated previews.

Hosted rollout requires separate authorization under `AGENTS.md` line 15, the compatibility preflight, both pending migrations (`20261018105316_account_data_controls.sql` then `20261018131252_portable_binder_validation.sql`), security advisor review, a fresh encrypted hosted backup/off-device copy, confirmation that the seven-day expiry procedure is in place, and manual Google reauthentication/hosted acceptance using a disposable account. No production account is a deletion test target. See the [pre-merge audit](ACCOUNT-DATA-AUDIT.md) for confirmed fixes and evidence.

References: [Supabase user deletion](https://supabase.com/docs/guides/auth/managing-user-data), [backup limits and Storage exclusions](https://supabase.com/docs/guides/platform/backups).
