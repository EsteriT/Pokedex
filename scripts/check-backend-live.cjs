/* Integration tests may write ONLY to the loopback Supabase development stack.
   Test users/files are isolated and removed in finally. Never run against cloud. */
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { randomUUID, webcrypto } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
require("./backend-env.cjs")([
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET",
]);
const result = spawnSync(
  process.execPath,
  [
    path.resolve(__dirname, "../node_modules/supabase/dist/supabase.js"),
    "status",
    "-o",
    "json",
  ],
  { encoding: "utf8" },
);
if (result.status !== 0)
  throw Error(
    "Start Docker and the local Supabase stack first. No hosted project was contacted.",
  );
let config;
try {
  config = JSON.parse(result.stdout);
} catch {
  throw Error(
    "Could not read local Supabase status. Inspect backend:status privately; do not share its secret keys.",
  );
}
const url = config.API_URL || config.api_url;
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw Error("Live tests are restricted to the loopback development stack.");
const publicKey = config.PUBLISHABLE_KEY || config.ANON_KEY;
const adminKey = config.SECRET_KEY || config.SERVICE_ROLE_KEY;
assert(publicKey && adminKey, "Local status did not provide test keys.");
const options = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(20000) }),
  },
};
const admin = createClient(url, adminKey, options),
  clients = [],
  users = [];
const scope = { window: {}, crypto: webcrypto };
for (const file of [
  "data/sample-cards.js",
  "data/sample-card-details.js",
  "scripts/binder-schema.js",
  "scripts/editor-state.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../src", file), "utf8"),
    scope,
  );
const doc = () =>
  JSON.parse(
    JSON.stringify(
      scope.window.BinderState.create({
        name: "Backend acceptance",
        rows: 2,
        columns: 2,
        cards: ["001"],
      }).document,
    ),
  );
const expect = (rows) => rows.map((r) => ({ id: r.id, revision: r.revision }));
async function testAccount(prefix) {
  const email = "pokedex-" + prefix + "-" + randomUUID() + "@example.com";
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  users.push(created.data.user.id);
  // Admin link generation sends no email and keeps public email login disabled.
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error) throw link.error;
  const client = createClient(url, publicKey, options);
  clients.push(client);
  const login = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (login.error) throw login.error;
  return login.data.session;
}
async function browserAcceptance() {
  const sessions = [];
  for (let i = 0; i < 4; i++) {
    sessions.push(await testAccount("browser"));
  }
  const folder = path.resolve(__dirname, "../.scratch/runtime");
  fs.mkdirSync(folder, { recursive: true });
  const fixture = path.join(folder, "live-browser-" + randomUUID() + ".json");
  try {
    fs.writeFileSync(fixture, JSON.stringify({ url, publicKey, sessions }), {
      mode: 0o600,
    });
    const browser = spawnSync(
      "python",
      [
        "-X",
        "utf8",
        path.resolve(__dirname, "check-backend-browser.py"),
        fixture,
      ],
      { encoding: "utf8", timeout: 240000, cwd: path.resolve(__dirname, "..") },
    );
    const redact = (text) =>
      String(text || "").replace(
        /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        "[redacted JWT]",
      );
    if (browser.stdout) console.log(redact(browser.stdout).trim());
    if (browser.status !== 0) {
      if (browser.stderr) console.error(redact(browser.stderr));
      throw Error("Real backend browser acceptance failed.");
    }
  } finally {
    fs.rmSync(fixture, { force: true });
  }
}
async function main() {
  try {
    for (let i = 0; i < 2; i++) {
      await testAccount("test");
    }
    const [a, b] = clients;
    const commit = (c, expected, documents) =>
      c.rpc("commit_binders", { expected, documents });
    const read = async (c) => {
      const r = await c.from("binders").select("*").order("position");
      if (r.error) throw r.error;
      return r.data;
    };
    const id = randomUUID();
    const races = await Promise.all([
      commit(a, [], [{ id, document: doc() }]),
      commit(a, [], [{ id: randomUUID(), document: doc() }]),
    ]);
    assert.equal(
      races.filter((r) => !r.error).length,
      1,
      "Exactly one concurrent create wins the empty snapshot",
    );
    assert.equal(races.filter((r) => r.error?.code === "40001").length, 1);
    let rows = await read(a);
    assert.equal(rows.length, 1);
    assert.equal((await read(b)).length, 0);
    assert(
      (
        await b
          .from("binders")
          .update({ owner_id: users[1] })
          .eq("id", rows[0].id)
      ).error,
      "Direct writes must be denied",
    );
    const stale = expect(rows),
      first = rows[0];
    assert(
      !(
        await commit(a, stale, [
          { id: first.id, document: { ...doc(), name: "Updated" } },
        ])
      ).error,
    );
    assert.equal(
      (await commit(a, stale, [{ id: first.id, document: doc() }])).error?.code,
      "40001",
    );
    rows = await read(a);
    const numericCard = doc();
    numericCard.pages[0].regions[0].content.cardId = 166;
    const numericPlaceholder = doc();
    numericPlaceholder.pages[0].regions[0].content = {
      id: "bad-placeholder",
      kind: "placeholder",
      style: "outline",
      cardId: 166,
    };
    for (const invalid of [
      { ...doc(), pages: [] },
      numericCard,
      numericPlaceholder,
      { ...doc(), name: "\u00a0\t" },
    ])
      assert(
        (await commit(a, expect(rows), [{ id: first.id, document: invalid }]))
          .error,
        "Direct HTTP saves must reject documents the frontend cannot reopen",
      );
    const full = [
      { id: first.id, document: doc() },
      { id: randomUUID(), document: doc() },
      { id: randomUUID(), document: doc() },
    ];
    assert(!(await commit(a, expect(rows), full)).error);
    rows = await read(a);
    assert(
      (
        await commit(a, expect(rows), [
          ...full,
          { id: randomUUID(), document: doc() },
        ])
      ).error,
    );
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9YkAAAAASUVORK5CYII=",
      "base64",
    );
    const digest = Buffer.from(
      await webcrypto.subtle.digest("SHA-256", png),
    ).toString("hex");
    const objectPath = users[0] + "/" + digest + ".png";
    assert(
      !(await a.rpc("reserve_binder_artwork", { object_path: objectPath }))
        .error,
    );
    const upload = await a.storage
      .from("binder-artwork")
      .upload(objectPath, png, { contentType: "image/png" });
    if (upload.error) throw upload.error;
    assert(
      (await b.storage.from("binder-artwork").download(objectPath)).error,
      "Other account cannot download artwork",
    );
    const downloaded = await a.storage
      .from("binder-artwork")
      .download(objectPath);
    if (downloaded.error) throw downloaded.error;
    assert.equal(downloaded.data.size, png.length);
    const artDoc = doc();
    artDoc.pages[0].regions[0].content = {
      id: "private-art",
      kind: "artwork",
      src: "storage:" + objectPath,
      name: "test",
      width: 1,
      height: 1,
      fit: "contain",
      zoom: 1,
      x: 50,
      y: 50,
    };
    const withArt = full.map((r, i) => ({
      ...r,
      document: i === 0 ? artDoc : r.document,
    }));
    const savedArt = await commit(a, expect(rows), withArt);
    if (savedArt.error) throw savedArt.error;
    // A fresh client/session represents reopening the saved binder elsewhere.
    const session = (await a.auth.getSession()).data.session;
    const reopened = createClient(url, publicKey, options);
    await reopened.auth.setSession(session);
    assert.equal(
      (await read(reopened))[0].document.pages[0].regions[0].content.src,
      "storage:" + objectPath,
    );
    await reopened.auth.signOut({ scope: "local" });
    if (process.argv.includes("--browser")) await browserAcceptance();
    console.log(
      "PASS: local Supabase Auth, real concurrent HTTP saves, RLS, limits, rollback, private upload/download, cross-account denial, and reopened session.",
    );
    console.log(
      process.argv.includes("--browser")
        ? "Google consent/redirect must be verified separately for each deployed environment."
        : "Google consent/redirect and real browser acceptance must also pass before hosted deployment.",
    );
  } finally {
    for (const owner of users) {
      const listed = await admin.storage
        .from("binder-artwork")
        .list(owner, { limit: 100 });
      if (listed.error) {
        console.error("Test artwork listing failed; retry local cleanup.");
        process.exitCode = 1;
        continue;
      }
      const paths = (listed.data || [])
        .filter((f) => f.id)
        .map((f) => owner + "/" + f.name);
      if (paths.length) {
        const removed = await admin.storage
          .from("binder-artwork")
          .remove(paths);
        if (removed.error) {
          console.error("Test artwork cleanup failed; retry locally.");
          process.exitCode = 1;
        }
      }
    }
    for (const c of clients) await c.auth.signOut({ scope: "local" });
    for (const id of users) {
      const r = await admin.auth.admin.deleteUser(id);
      if (r.error) {
        console.error("Test user cleanup failed; retry locally.");
        process.exitCode = 1;
      }
    }
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
