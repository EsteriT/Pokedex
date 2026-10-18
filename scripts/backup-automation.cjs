/* Operator only: this module never enters a website bundle. */
const { createHash, randomUUID } = require("node:crypto");
const { decrypt, maxBytes } = require("./backup-crypto.cjs");
const { portable } = require("./backend-ops.cjs");
const target = "pnuovoogfjzzlgmenhnq";
const account = "4782e9bfecc8e3987505121751b9d1ef";
const bucket = "pokedex-backups";
const prefix = "daily/" + target + "/";
const day = 86400000;
const keyPattern =
  /^daily\/[a-z]{20}\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)-[0-9a-f-]{36}\.pdxbackup$/;

function config(env) {
  for (const name of [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "HEALTHCHECKS_PING_URL",
    "POKEDEX_BACKUP_PASSPHRASE",
    "POKEDEX_BACKUP_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
  ])
    if (!env[name]) throw Error("Missing private setting: " + name);
  if (
    !/^[0-9a-f]{32}$/i.test(env.R2_ACCESS_KEY_ID) ||
    !/^[0-9a-f]{64}$/i.test(env.R2_SECRET_ACCESS_KEY)
  )
    throw Error("Use the R2 S3 Access Key ID and Secret Access Key.");
  if (
    !env.SUPABASE_ACCESS_TOKEN.startsWith("sbp_fc") ||
    /\s/.test(env.SUPABASE_ACCESS_TOKEN)
  )
    throw Error(
      "Use a project-scoped Supabase Database Read token, not a legacy account token.",
    );
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(env.POKEDEX_BACKUP_SECRET_KEY))
    throw Error("Use the private modern Supabase backup secret key.");
  if (
    env.POKEDEX_BACKUP_PASSPHRASE.length < 16 ||
    env.POKEDEX_BACKUP_PASSPHRASE.length > 1024
  )
    throw Error("Use a backup passphrase of 16 to 1024 characters.");
  pingUrl(env.HEALTHCHECKS_PING_URL);
  if (
    env.GITHUB_ACTIONS === "true" &&
    (env.GITHUB_REPOSITORY !== "EsteriT/Pokedex" ||
      env.GITHUB_REF !== "refs/heads/main")
  )
    throw Error(
      "Hosted backup automation runs only on the original repository's main branch.",
    );
  return {
    passphrase: env.POKEDEX_BACKUP_PASSPHRASE,
    ping: env.HEALTHCHECKS_PING_URL,
  };
}
function pingUrl(value) {
  if (
    !/^https:\/\/hc-ping\.com\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      value || "",
    )
  )
    throw Error(
      "Use the private Healthchecks base Ping URL without query parameters.",
    );
  return value;
}
async function heartbeat(url, signal, request = fetch) {
  pingUrl(url);
  if (!["start", "success", "fail"].includes(signal))
    throw Error("Invalid heartbeat signal.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(
        url + (signal === "success" ? "" : "/" + signal),
        {
          method: "POST",
          body: "",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      await response.body?.cancel();
      if (response.ok) return;
    } catch {}
  }
  throw Error(
    "Healthchecks could not be reached. Check the monitor and Actions run.",
  );
}
function verify(bytes, passphrase, now = Date.now()) {
  if (!Buffer.isBuffer(bytes) || bytes.length > maxBytes + 1048576)
    throw Error("Encrypted backup exceeds the beta limit.");
  const archive = decrypt(bytes, passphrase);
  if (
    archive.target !== target ||
    !Number.isFinite(Date.parse(archive.createdAt)) ||
    Math.abs(now - Date.parse(archive.createdAt)) > 15 * 60000
  )
    throw Error("Backup is stale or belongs to a different project.");
  portable(archive);
  return createHash("sha256").update(bytes).digest("hex");
}
async function prune(store, now) {
  let cursor,
    removed = 0,
    seen = new Set();
  do {
    const page = await store.list(prefix, cursor);
    if (!Array.isArray(page.objects)) throw Error("Invalid R2 listing.");
    for (const object of page.objects) {
      const match = keyPattern.exec(object.key || "");
      if (!match || !object.key.startsWith(prefix)) continue;
      const created = Date.parse(match[1]),
        modified = new Date(object.modified).getTime();
      if (!Number.isFinite(created) || !Number.isFinite(modified))
        throw Error("Invalid R2 backup timestamp.");
      if (created <= now - 7 * day && modified <= now - 7 * day) {
        await store.remove(object.key);
        if (await store.exists(object.key))
          throw Error("R2 expiry verification failed.");
        removed++;
      }
    }
    cursor = page.cursor;
    if (cursor && (seen.has(cursor) || seen.size >= 10000))
      throw Error("R2 pagination did not complete safely.");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return removed;
}
async function run({ snapshot, store, ping, passphrase, clock = Date.now }) {
  let stage = "monitor start";
  try {
    await ping("start");
    // Expiry remains independent of whether today's snapshot succeeds.
    stage = "expired backup cleanup";
    const removed = await prune(store, clock());
    stage = "Supabase snapshot";
    const bytes = await snapshot();
    stage = "local decryption and recovery validation";
    const sha256 = verify(bytes, passphrase, clock());
    const key =
      prefix +
      new Date(clock()).toISOString() +
      "-" +
      randomUUID() +
      ".pdxbackup";
    stage = "R2 upload";
    await store.put(key, bytes);
    stage = "R2 download and recovery validation";
    const downloaded = await store.get(key, bytes.length);
    if (
      downloaded.length !== bytes.length ||
      verify(downloaded, passphrase, clock()) !== sha256
    )
      throw Error("Uploaded bytes did not match.");
    stage = "monitor success";
    await ping("success");
    return { key, sha256, bytes: bytes.length, expiredRemoved: removed };
  } catch {
    try {
      await ping("fail");
    } catch {}
    // SDK/database diagnostics can contain private URLs and records.
    throw Error(
      "Backup failed during " +
        stage +
        ". No success was reported. Check private settings and retry.",
    );
  }
}
module.exports = {
  target,
  account,
  bucket,
  prefix,
  config,
  pingUrl,
  heartbeat,
  verify,
  prune,
  run,
};
