const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const { webcrypto, randomUUID } = require("node:crypto");
function setup({ enabled = true, signedIn = true } = {}) {
  const user = { id: randomUUID() },
    db = [],
    writes = [],
    events = new Map();
  let callback,
    fail = false,
    raw = null;
  const bucket = {
    async upload(name, blob) {
      writes.push(["upload", name]);
      bucket.files.set(name, blob);
      return { error: null };
    },
    files: new Map(),
    async download(name) {
      return bucket.files.has(name)
        ? { data: bucket.files.get(name) }
        : { error: { message: "missing" } };
    },
    async remove(names) {
      names.forEach((n) => bucket.files.delete(n));
      return { data: names.map((name) => ({ name })), error: null };
    },
    unused: [],
  };
  const client = {
    auth: {
      async getUser() {
        return { data: { user: signedIn ? user : null } };
      },
      async getSession() {
        return {
          data: {
            session: signedIn
              ? { user, access_token: "test-owner-" + user.id }
              : null,
          },
        };
      },
      onAuthStateChange(fn) {
        callback = fn;
      },
      async signInWithOAuth(value) {
        writes.push(["sign-in", value]);
        return {};
      },
      async signOut() {
        return {};
      },
    },
    storage: {
      from() {
        return bucket;
      },
    },
    from() {
      return {
        select() {
          return {
            async order() {
              return fail
                ? { error: { message: "Offline" } }
                : { data: structuredClone(db) };
            },
          };
        },
      };
    },
    rpc(name, args) {
      const request = client.executeRpc(name, args);
      request.setHeader = (name, value) => {
        assert.equal(name, "Authorization");
        assert.equal(value, "Bearer test-owner-" + user.id);
        return request;
      };
      return request;
    },
    async executeRpc(name, args) {
      writes.push([name, structuredClone(args)]);
      if (name === "reserve_binder_artwork") return {};
      if (name === "cleanup_binder_artwork") return { data: bucket.unused };
      if (fail) return { error: { message: "Offline" } };
      if (
        JSON.stringify(args.expected) !==
        JSON.stringify(db.map((b) => ({ id: b.id, revision: b.revision })))
      )
        return { error: { code: "40001" } };
      const next = args.documents.map((value, i) => ({
        id: value.id,
        revision: (db.find((b) => b.id === value.id)?.revision || 0) + 1,
        position: i,
        document: value.document,
      }));
      db.splice(0, db.length, ...next);
      return {};
    },
  };
  const window = {
    POKEDEX_BACKEND: enabled
      ? { url: "http://127.0.0.1:54321", publishableKey: "local-test" }
      : {},
    createSupabaseClient() {
      return client;
    },
    dispatchEvent(e) {
      events.get(e.type)?.();
    },
  };
  const scope = {
    window,
    crypto: webcrypto,
    structuredClone,
    Blob,
    atob,
    btoa,
    Event,
    AbortSignal,
    localStorage: {
      getItem() {
        return raw;
      },
      setItem(_key, value) {
        raw = value;
      },
    },
    location: {
      reload() {
        writes.push(["reload"]);
      },
    },
  };
  for (const file of [
    "data/sample-cards.js",
    "data/sample-card-details.js",
    "data/sample-binders.js",
    "scripts/binder-schema.js",
    "scripts/editor-state.js",
    "scripts/binder-store.js",
    "scripts/binder-cloud-media.js",
    "scripts/binder-repository.js",
  ])
    vm.runInNewContext(
      fs.readFileSync(path.resolve(__dirname, "../src", file), "utf8"),
      scope,
    );
  return {
    window,
    repo: window.BinderRepository,
    user,
    db,
    writes,
    bucket,
    raw: () => raw,
    offline(value) {
      fail = value;
    },
    switchAccount() {
      callback("SIGNED_IN", { user: { id: randomUUID() } });
    },
  };
}
async function main() {
  const envScope = {
    process: { env: { EMPTY: "", SET: "shell" } },
    module: { exports: {} },
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "backend-env.cjs"), "utf8"),
    {
      ...envScope,
      __dirname,
      require(name) {
        if (name === "node:fs")
          return {
            existsSync: () => true,
            readFileSync: () => "EMPTY=file\nSET=file\nMISSING=file",
          };
        return require(name);
      },
    },
  );
  envScope.module.exports(["EMPTY", "SET", "MISSING"]);
  assert.deepEqual(
    envScope.process.env,
    { EMPTY: "", SET: "shell", MISSING: "file" },
    "Explicit environment values, including an empty prototype configuration, take precedence over .env.local",
  );
  // Run the real build boundary with file/bundler stand-ins; never write a
  // privileged key into either the source vendor folder or a preview.
  function publicBuild(env) {
    const writes = [];
    const files = {
      mkdirSync() {},
      writeFileSync(_file, value) {
        writes.push(value);
      },
      readdirSync() {
        return ["LICENSE"];
      },
      readFileSync() {
        return "Test license notice";
      },
      appendFileSync() {},
    };
    vm.runInNewContext(
      fs.readFileSync(path.resolve(__dirname, "build-backend.cjs"), "utf8"),
      {
        __dirname,
        URL,
        Buffer,
        process: { env },
        console: { log() {} },
        require(name) {
          if (name === "node:fs") return files;
          if (name === "node:path") return path;
          if (name === "esbuild") return { buildSync() {} };
          if (name === "./backend-env.cjs") return () => {};
          throw Error("Unexpected build dependency " + name);
        },
      },
    );
    return writes.join("");
  }
  const base = {
    POKEDEX_SUPABASE_URL: "https://example.supabase.co",
    POKEDEX_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET: "private-google-secret",
  };
  assert(!publicBuild(base).includes("private-google-secret"));
  assert.throws(
    () =>
      publicBuild({
        ...base,
        POKEDEX_SUPABASE_PUBLISHABLE_KEY: "sb_secret_private",
      }),
    /Only a publishable/,
  );
  const serviceJwt = [
    "e30",
    Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url"),
    "signature",
  ].join(".");
  assert.throws(
    () =>
      publicBuild({ ...base, POKEDEX_SUPABASE_PUBLISHABLE_KEY: serviceJwt }),
    /Only a publishable/,
  );
  assert.throws(
    () =>
      publicBuild({
        ...base,
        POKEDEX_SUPABASE_URL: "https://example.supabase.co/path",
      }),
    /origin/,
  );
  assert.throws(
    () =>
      publicBuild({
        ...base,
        POKEDEX_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_</script>",
      }),
    /Only a publishable/,
  );
  assert.throws(
    () => publicBuild({ ...base, POKEDEX_SUPABASE_PUBLISHABLE_KEY: "" }),
    /Set both/,
  );
  function packagePages(config, extraOutput = false) {
    const pages = require("./project-pages.cjs"),
      files = new Map();
    const folder = path.resolve(__dirname, "..");
    for (const [entry, name] of pages)
      files.set(
        path.join(folder, "preview", name),
        '<a id="viewer-route" href="Pokedex-viewer.html"></a>' +
          (entry === "index.html"
            ? ""
            : "<script>window.POKEDEX_BACKEND = " +
              JSON.stringify(config) +
              ";\n</script>"),
      );
    files.set(
      path.join(folder, "src/vendor/backend-config.js"),
      "window.POKEDEX_BACKEND = " +
        JSON.stringify({
          url: "https://example.supabase.co",
          publishableKey: "sb_publishable_test",
        }) +
        ";",
    );
    const fakeFs = {
      mkdirSync() {},
      readFileSync: (f) => files.get(f),
      existsSync: () => true,
      copyFileSync: (a, b) => files.set(b, files.get(a)),
      writeFileSync: (f, v) => files.set(f, v),
      readdirSync: () => (extraOutput ? ["accidental-private-file.txt"] : []),
    };
    vm.runInNewContext(
      fs.readFileSync(path.join(__dirname, "build-pages.cjs"), "utf8"),
      {
        __dirname,
        URL,
        console: { log() {} },
        require: (name) =>
          name === "node:fs"
            ? fakeFs
            : name === "./project-pages.cjs"
              ? pages
              : require(name),
      },
    );
  }
  assert.throws(
    () =>
      packagePages({ url: "http://127.0.0.1:54321", publishableKey: "local" }),
    /local Supabase/,
    "Validate the actual embedded artifact rather than a different source config",
  );
  assert.throws(
    () => packagePages({ url: "", publishableKey: "" }, true),
    /Unexpected file/,
    "Do not package unrelated leftovers from dist",
  );
  packagePages({ url: "", publishableKey: "" });
  const s = setup();
  await s.repo.ready;
  assert.equal(
    s.repo.read().length,
    0,
    "Signing in does not silently import sample/local binders",
  );
  assert.equal(
    s.raw(),
    null,
    "Cloud initialization never changes browser binders",
  );
  const state = s.window.BinderState.create({
    name: "My cloud binder",
    rows: 1,
    columns: 2,
    cards: ["001"],
  });
  const id = randomUUID();
  let saved = await s.repo.save(id, state.document, null);
  assert.equal(saved.name, "My cloud binder");
  assert.equal(saved.revision, 1);
  assert.equal(s.raw(), null, "Cloud Save never writes local workspace data");
  const stale = saved.revision;
  s.db[0].revision++;
  await assert.rejects(
    s.repo.save(id, state.document, stale),
    (e) => e.code === "40001",
  );
  s.offline(true);
  await assert.rejects(s.repo.save(id, state.document, 2), /Offline/);
  assert.equal(
    s.repo.read()[0].name,
    "My cloud binder",
    "Failed requests preserve last usable cache",
  );
  s.offline(false);
  const art = {
    id: "test-art",
    kind: "artwork",
    src: "data:image/png;base64,AAAA",
    name: "Test",
    width: 1,
    height: 1,
    fit: "contain",
    zoom: 1,
    x: 50,
    y: 50,
  };
  const withArt = structuredClone(state.document);
  withArt.pages[0].regions[1].content = art;
  saved = await s.repo.save(id, withArt, 2);
  assert.match(s.db[0].document.pages[0].regions[1].content.src, /^storage:/);
  assert.equal(
    saved.document.pages[0].regions[1].content.src,
    art.src,
    "Editor/backups retain portable artwork",
  );
  await s.repo.save(id, withArt, saved.revision);
  assert.equal(
    s.writes.filter((w) => w[0] === "upload").length,
    1,
    "Repeated saves deduplicate artwork",
  );
  const artworkPath = s.db[0].document.pages[0].regions[1].content.src.slice(8);
  saved = await s.repo.save(id, state.document, s.db[0].revision);
  s.bucket.unused = [artworkPath];
  assert.equal(await s.repo.cleanupArtwork(), 1);
  assert.equal(s.bucket.files.has(artworkPath), false);
  await s.repo.save(id, withArt, saved.revision);
  assert(
    s.bucket.files.has(artworkPath),
    "Reusing cleaned artwork must upload it again rather than trust stale memory cache",
  );
  const original = s.window.BinderStore.read()[0].id;
  const imported = await s.repo.importLocal(original);
  assert.notEqual(imported, original);
  assert.equal(s.repo.read().length, 2);
  assert.equal(s.raw(), null);
  const snapshot = structuredClone(state.document);
  state.rename("A new draft");
  state.save(snapshot);
  assert.equal(
    state.dirty,
    true,
    "Edits made during a pending Save stay dirty",
  );
  s.switchAccount();
  assert.throws(() => s.repo.read(), /Account changed/);
  await assert.rejects(
    s.repo.save(id, state.document, saved.revision),
    /Account changed/,
  );
  const signedOut = setup({ signedIn: false });
  await signedOut.repo.ready;
  assert.equal(signedOut.repo.read().length, 0);
  await assert.rejects(
    signedOut.repo.save(randomUUID(), state.document, null),
    /Sign in/,
  );
  await signedOut.repo.signIn("http://localhost:5500/src/workspace.html");
  assert.equal(signedOut.writes[0][1].provider, "google");
  const local = setup({ enabled: false });
  await local.repo.ready;
  assert.equal(local.repo.read().length, local.window.SAMPLE_BINDERS.length);
  await local.repo.save(local.window.SAMPLE_BINDERS[0].id, state.document, 0);
  assert(local.raw());
  console.log(
    "PASS: repository local/cloud isolation, explicit import, manual Save snapshots, stale/offline safety, private media/deduplication, account change, signed-out access and OAuth contract.",
  );
  console.log(
    "SDK calls in this suite use a test double; real HTTP/Auth/Storage coverage is test:backend:live.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
