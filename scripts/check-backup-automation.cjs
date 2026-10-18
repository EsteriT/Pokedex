const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { randomUUID } = require("node:crypto");
const { encrypt, decrypt } = require("./backup-crypto.cjs");
const {
  config,
  heartbeat,
  target,
  prefix,
  verify,
  prune,
  run,
} = require("./backup-automation.cjs");
const now = Date.parse("2026-10-19T12:00:00.000Z"),
  day = 86400000;
const passphrase = "test-only-backup-passphrase";
const archive = {
  format: "pokedex-service",
  version: 1,
  target,
  createdAt: new Date(now).toISOString(),
  accounts: [],
  files: [],
};
const bytes = encrypt(archive, passphrase);
const baseEnv = {
  R2_ACCESS_KEY_ID: "a".repeat(32),
  R2_SECRET_ACCESS_KEY: "b".repeat(64),
  HEALTHCHECKS_PING_URL: "https://hc-ping.com/" + randomUUID(),
  POKEDEX_BACKUP_PASSPHRASE: passphrase,
  POKEDEX_BACKUP_SECRET_KEY: "sb_secret_test",
  SUPABASE_ACCESS_TOKEN: "sbp_fctest",
};
const keyAt = (time) =>
  prefix + new Date(time).toISOString() + "-" + randomUUID() + ".pdxbackup";
function fixture(fail) {
  const objects = new Map(),
    signals = [],
    removed = [],
    uploads = [];
  let listed = 0;
  const expired = keyAt(now - 8 * day),
    recent = keyAt(now - day);
  objects.set(expired, { bytes, modified: new Date(now - 8 * day) });
  objects.set(recent, { bytes, modified: new Date(now - day) });
  const outside = "unrelated/do-not-delete.pdxbackup";
  const unknown = prefix + "do-not-delete.txt";
  objects.set(outside, { bytes, modified: new Date(now - 8 * day) });
  objects.set(unknown, { bytes, modified: new Date(now - 8 * day) });
  const store = {
    async list(p, cursor) {
      assert.equal(p, prefix);
      listed++;
      if (fail === "listing") throw Error("private R2 diagnostic");
      return cursor
        ? {
            objects: [...objects]
              .filter(([k]) => k !== expired)
              .map(([key, v]) => ({ key, modified: v.modified })),
          }
        : {
            objects: [
              { key: expired, modified: objects.get(expired).modified },
            ],
            cursor: "next-page",
          };
    },
    async put(key, value) {
      if (fail === "upload") throw Error("private credential diagnostic");
      uploads.push(key);
      objects.set(key, { bytes: Buffer.from(value), modified: new Date(now) });
    },
    async get(key, limit) {
      if (fail === "download") throw Error("private signed URL");
      const value = Buffer.from(objects.get(key).bytes);
      assert.equal(value.length, limit);
      if (fail === "tamper") value[value.length - 1] ^= 1;
      if (fail === "different")
        return encrypt(
          { ...archive, files: [], extra: "different valid archive" },
          passphrase,
        );
      return value;
    },
    async remove(key) {
      removed.push(key);
      if (fail !== "delete") objects.delete(key);
    },
    async exists(key) {
      return objects.has(key);
    },
  };
  const options = {
    store,
    passphrase,
    clock: () => now,
    snapshot: async () => {
      if (fail === "snapshot") throw Error("private SQL response");
      return bytes;
    },
    ping: async (signal) => {
      if (
        (fail === "monitor-start" && signal === "start") ||
        (fail === "monitor-success" && signal === "success")
      )
        throw Error("private Ping URL");
      signals.push(signal);
    },
  };
  return {
    options,
    objects,
    signals,
    removed,
    uploads,
    expired,
    recent,
    outside,
    unknown,
    listed: () => listed,
  };
}
async function main() {
  assert.equal(config(baseEnv).passphrase, passphrase);
  for (const name of Object.keys(baseEnv))
    assert.throws(() => config({ ...baseEnv, [name]: "" }), /Missing/);
  for (const ping of [
    "http://hc-ping.com/" + randomUUID(),
    "https://hc-ping.com.evil/" + randomUUID(),
    baseEnv.HEALTHCHECKS_PING_URL + "?token=secret",
    baseEnv.HEALTHCHECKS_PING_URL + "/start",
  ])
    assert.throws(
      () => config({ ...baseEnv, HEALTHCHECKS_PING_URL: ping }),
      /base Ping URL/,
    );
  assert.throws(
    () => config({ ...baseEnv, SUPABASE_ACCESS_TOKEN: "sbp_legacy" }),
    /project-scoped/,
  );
  assert.throws(
    () =>
      config({ ...baseEnv, POKEDEX_BACKUP_SECRET_KEY: "sb_publishable_wrong" }),
    /private modern/,
  );
  assert.throws(
    () =>
      config({
        ...baseEnv,
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/feature",
        GITHUB_REPOSITORY: "EsteriT/Pokedex",
      }),
    /main branch/,
  );
  assert.throws(
    () =>
      config({
        ...baseEnv,
        GITHUB_ACTIONS: "true",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REPOSITORY: "someone/fork",
      }),
    /original repository/,
  );
  assert.equal(typeof verify(bytes, passphrase, now), "string");
  assert.throws(() => verify(bytes, passphrase, now + day), /stale/);
  assert.throws(
    () =>
      verify(
        encrypt({ ...archive, target: "other" }, passphrase),
        passphrase,
        now,
      ),
    /different project/,
  );
  const good = fixture();
  const result = await run(good.options);
  assert.deepEqual(good.signals, ["start", "success"]);
  assert.equal(result.expiredRemoved, 1);
  assert.equal(good.listed(), 2);
  assert(!good.objects.has(good.expired));
  for (const key of [good.recent, good.outside, good.unknown, result.key])
    assert(good.objects.has(key));
  // Exercise the existing recovery validator with an encrypted artwork fixture.
  const src =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";
  const owner = randomUUID();
  const data = {
    ...archive,
    accounts: [
      {
        id: owner,
        email: "disposable@example.test",
        deleting: false,
        binders: [],
        collection: { document: { records: [] } },
      },
    ],
    files: [{ path: owner + "/" + "a".repeat(64) + ".png", src }],
  };
  const recovery = fixture();
  recovery.options.snapshot = async () => encrypt(data, passphrase);
  const restored = await run(recovery.options);
  const downloaded = await recovery.options.store.get(
    restored.key,
    restored.bytes,
  );
  assert.deepEqual(decrypt(downloaded, passphrase), data);
  assert.equal(
    require("./backend-ops.cjs").portable(decrypt(downloaded, passphrase))[0]
      .backup.artwork[0],
    src,
  );
  for (const fail of [
    "listing",
    "upload",
    "download",
    "tamper",
    "different",
    "delete",
    "snapshot",
    "monitor-start",
    "monitor-success",
  ]) {
    const test = fixture(fail);
    await assert.rejects(
      run(test.options),
      (error) =>
        !/private R2|credential diagnostic|signed URL|SQL response|Ping URL/.test(
          error.message,
        ) && /Backup failed during/.test(error.message),
    );
    assert(
      !test.signals.includes("success"),
      fail + " must not report success",
    );
    assert(test.signals.includes("fail"), fail + " must report failure");
    if (fail === "snapshot")
      assert(
        !test.objects.has(test.expired),
        "Expiry still runs when snapshot fails",
      );
  }
  const repeat = { list: async () => ({ objects: [], cursor: "repeat" }) };
  await assert.rejects(prune(repeat, now), /pagination/);
  let attempts = 0;
  await heartbeat(
    baseEnv.HEALTHCHECKS_PING_URL,
    "success",
    async (url, options) => {
      assert.equal(url, baseEnv.HEALTHCHECKS_PING_URL);
      assert.equal(options.method, "POST");
      assert.equal(options.body, "");
      assert.equal(options.redirect, "error");
      attempts++;
      return { ok: attempts === 3 };
    },
  );
  assert.equal(attempts, 3);
  await assert.rejects(
    heartbeat(baseEnv.HEALTHCHECKS_PING_URL, "start", async () => {
      throw Error("private URL");
    }),
    /could not be reached/,
  );
  const workflow = fs.readFileSync(
    path.join(__dirname, "../.github/workflows/backup.yml"),
    "utf8",
  );
  assert(!/pull_request|push:|upload-artifact|printenv|set -x/.test(workflow));
  assert(workflow.includes("environment: backup-production"));
  assert(workflow.includes("vars.BACKUPS_ENABLED == 'true'"));
  assert(workflow.includes("github.ref == 'refs/heads/main'"));
  assert(workflow.includes("persist-credentials: false"));
  assert.equal(
    [...workflow.matchAll(/uses: [^\s]+@([0-9a-f]{40})/g)].length,
    2,
  );
  console.log(
    "PASS: backup upload/download/decrypt/recovery, expiry pagination and scope, failure privacy, monitoring retries, credential guards and workflow isolation.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
