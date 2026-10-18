const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const { webcrypto, randomUUID } = require("node:crypto");
function setup(enabled = true, signedIn = true) {
  const user = { id: randomUUID() },
    storage = new Map(),
    events = new Map();
  let row = null,
    offline = false,
    callback,
    currentUser = user,
    writing = false,
    gate = Promise.resolve();
  const client = {
    auth: {
      getUser: async () => ({ data: { user: signedIn ? user : null } }),
      getSession: async () => ({
        data: {
          session: signedIn
            ? {
                user: currentUser,
                access_token: "test-owner-" + currentUser.id,
              }
            : null,
        },
      }),
      onAuthStateChange(fn) {
        callback = fn;
      },
    },
    from(table) {
      return {
        select() {
          return {
            order: async () => ({ data: [] }),
            maybeSingle: async () =>
              offline
                ? { error: { message: "Offline" } }
                : { data: structuredClone(row) },
          };
        },
      };
    },
    rpc(name, args) {
      writing = true;
      let authorization;
      const request = (async () => {
        assert.equal(name, "commit_collection");
        await gate;
        assert.equal(
          authorization,
          "Bearer test-owner-" + user.id,
          "A submitted write must stay bound to its original account",
        );
        if (offline) return { error: { message: "Offline" } };
        if ((row?.revision ?? null) !== args.expected_revision)
          return { error: { code: "40001" } };
        row = {
          revision: (row?.revision || 0) + 1,
          document: structuredClone(args.document),
        };
        return { data: row.revision };
      })();
      request.setHeader = (name, value) => {
        assert.equal(name, "Authorization");
        authorization = value;
        return request;
      };
      return request;
    },
  };
  const window = {
    POKEDEX_BACKEND: enabled
      ? { url: "http://127.0.0.1:54321", publishableKey: "test" }
      : {},
    createSupabaseClient: () => client,
    BinderCloudMedia: { create: () => ({ hydrate: async (d) => d }) },
    dispatchEvent: (e) => events.get(e.type)?.(),
  };
  const scope = {
    window,
    crypto: webcrypto,
    Blob,
    Event,
    AbortSignal,
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
    },
  };
  for (const file of [
    "data/sample-cards.js",
    "data/sample-card-details.js",
    "data/sample-collection.js",
    "scripts/binder-schema.js",
    "scripts/editor-state.js",
    "scripts/binder-store.js",
    "scripts/binder-repository.js",
    "scripts/collection-state.js",
    "scripts/collection-repository.js",
  ])
    vm.runInNewContext(
      fs.readFileSync(path.resolve(__dirname, "../src", file), "utf8"),
      scope,
    );
  return {
    window,
    repo: window.CollectionRepository,
    storage,
    row: () => row,
    offline: (v) => (offline = v),
    gate: (p) => (gate = p),
    writing: () => writing,
    switchAccount() {
      currentUser = { id: randomUUID() };
      callback("SIGNED_IN", { user: currentUser });
    },
  };
}
async function main() {
  const t = setup();
  await t.repo.ready;
  assert.equal(await t.repo.read(), null);
  assert.equal(t.repo.empty().records.length, 0);
  const sample = t.window.SAMPLE_COLLECTION;
  t.window.CollectionStore.save(sample, null);
  const original = t.storage.get("pokedex.collection.v1");
  const doc = structuredClone(sample);
  const saved = await t.repo.save(doc, null);
  assert.equal(saved, 1);
  assert.equal(t.storage.get("pokedex.collection.v1"), original);
  assert.equal((await t.repo.read()).document.records.length, 6);
  await assert.rejects(t.repo.save(doc, null), (e) => e.code === "40001");
  t.offline(true);
  await assert.rejects(t.repo.save(doc, 1), /Offline/);
  t.offline(false);
  assert.equal(t.row().revision, 1);
  let release;
  t.gate(new Promise((r) => (release = r)));
  const state = t.window.CollectionState.create(doc);
  state.remove(doc.records[0].id);
  const snapshot = structuredClone(state.document);
  const pending = t.repo.save(snapshot, 1);
  snapshot.records[0].quantity = 400; // Repository must detach its submitted snapshot immediately.
  state.remove(doc.records[1].id);
  release();
  assert.equal(await pending, 2);
  state.save({ ...doc, records: doc.records.slice(1) });
  assert.equal(t.row().document.records[0].quantity, doc.records[1].quantity);
  assert.equal(state.dirty, true, "Edits during Save remain unsaved");
  const keep = t.repo.importDocument(doc, sample, "keep");
  assert.equal(
    JSON.stringify(keep),
    JSON.stringify(t.repo.importDocument(keep, sample, "keep")),
    "Repeating imports must not add quantities",
  );
  const changed = structuredClone(sample);
  changed.records[0].quantity = 7;
  assert.equal(
    t.repo.importDocument(doc, changed, "keep").records[0].quantity,
    2,
  );
  assert.equal(
    t.repo.importDocument(doc, changed, "replace").records[0].quantity,
    7,
  );
  assert.equal(t.repo.previewImport(doc, sample).overlaps, 6);
  assert.throws(() => t.repo.importDocument(doc, sample, "sum"), /Choose/);
  const collision = structuredClone(sample);
  collision.records[0].id = doc.records[1].id;
  collision.records[0].condition = "damaged";
  collision.records = collision.records.slice(0, 1);
  const merged = t.repo.importDocument(doc, collision, "keep");
  assert.equal(merged.records.length, 7);
  assert.notEqual(merged.records.at(-1).id, collision.records[0].id);
  t.switchAccount();
  await assert.rejects(t.repo.read(), /Account changed/);
  await assert.rejects(t.repo.save(doc, 2), /Account changed/);
  const switched = setup();
  await switched.repo.ready;
  let unlock;
  switched.gate(
    new Promise((resolve) => {
      unlock = resolve;
    }),
  );
  const duringSwitch = switched.repo.save(doc, null);
  while (!switched.writing())
    await new Promise((resolve) => setImmediate(resolve));
  switched.switchAccount();
  unlock();
  await assert.rejects(duringSwitch, /Account changed/);
  assert.equal(
    switched.row().revision,
    1,
    "An already submitted write uses its original account token; the new session must not receive it",
  );
  const signedOut = setup(true, false);
  await signedOut.repo.ready;
  await assert.rejects(signedOut.repo.read(), /Sign in/);
  const local = setup(false);
  assert.equal(await local.repo.read(), null);
  assert.equal(local.repo.empty().records.length, 6);
  assert.equal(await local.repo.save(sample, null), 1);
  assert.ok(local.storage.get("pokedex.collection.v1"));
  console.log(
    "PASS: collection adapter isolation, manual snapshots, conflicts/offline retention, repeated imports, overlap choices, ID collisions, account switches and local fallback.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
