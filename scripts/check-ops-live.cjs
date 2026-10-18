const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { randomBytes, webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  scratch = path.join(root, ".scratch");
module.exports = async (client, url, publicKey) => {
  const password = randomBytes(32).toString("hex"),
    owner = (await client.auth.getUser()).data.user.id;
  let encrypted, recovered;
  const run = (...args) => {
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "backend-ops.cjs"), ...args],
      {
        cwd: root,
        env: { ...process.env, POKEDEX_BACKUP_PASSPHRASE: password },
        encoding: "utf8",
        timeout: 120000,
      },
    );
    assert.equal(r.status, 0, r.stderr || "Operator command failed");
    return r.stdout;
  };
  try {
    const output = run("backup", "--local");
    encrypted = output.match(
      /Encrypted, verified backup saved: (.+)\. Copy/,
    )[1];
    assert(path.resolve(encrypted).startsWith(scratch + path.sep));
    assert(fs.existsSync(encrypted));
    const opened = run("recover", encrypted);
    recovered = opened.match(/account backup files into (.+)\. These/)[1];
    assert(path.resolve(recovered).startsWith(scratch + path.sep));
    const data = JSON.parse(
      fs.readFileSync(path.join(recovered, owner + ".json"), "utf8"),
    );
    assert.equal(data.format, "pokedex-account");
    assert(data.binders.length && data.artwork.length);
    assert(!JSON.stringify(data).includes("access_token"));
    const scope = {
      window: {},
      crypto: webcrypto,
      atob,
      btoa,
      structuredClone,
      fetch,
      AbortSignal,
      Blob,
    };
    for (const name of [
      "data/sample-cards.js",
      "data/sample-card-details.js",
      "data/sample-collection.js",
      "scripts/binder-schema.js",
      "scripts/editor-state.js",
      "scripts/binder-store.js",
      "scripts/collection-state.js",
      "scripts/account-backup.js",
    ])
      vm.runInNewContext(
        fs.readFileSync(path.join(root, "src", name), "utf8"),
        scope,
      );
    const token = (await client.auth.getSession()).data.session.access_token;
    scope.window.POKEDEX_BACKEND = { url, publishableKey: publicKey };
    scope.window.BinderRepository = {
      enabled: true,
      ready: Promise.resolve(),
      user: { id: owner },
      client,
      identityToken: async () => token,
      assertIdentity() {},
    };
    vm.runInNewContext(
      fs.readFileSync(path.join(root, "src/scripts/account-data.js"), "utf8"),
      scope,
    );
    await scope.window.AccountData.restoreData(data);
    const actual = await scope.window.AccountData.exportData();
    assert.deepEqual(JSON.parse(JSON.stringify(actual.binders)), data.binders);
    assert.deepEqual(
      JSON.parse(JSON.stringify(actual.collection)),
      data.collection,
    );
    assert.equal(actual.artwork.length, data.artwork.length);
    const health = JSON.parse(run("health", "--local"));
    assert(health.accounts > 0 && health.artwork_objects > 0);
    assert(!JSON.stringify(health).includes(owner));
    console.log(
      "PASS: real encrypted operator backup, decrypt/extract, application restore including artwork, and aggregate health report.",
    );
  } finally {
    if (
      encrypted &&
      path
        .resolve(encrypted)
        .startsWith(path.join(scratch, "backups") + path.sep)
    )
      fs.rmSync(encrypted, { force: true });
    if (
      recovered &&
      path
        .resolve(recovered)
        .startsWith(path.join(scratch, "recovery") + path.sep)
    )
      fs.rmSync(recovered, { recursive: true, force: true });
  }
};
