/* Disposable accounts and configuration on loopback only; always restore the
   gateway switch/digest and public counters in finally. No hosted mode. */
const assert = require("node:assert/strict"),
  cp = require("node:child_process");
const {
  randomBytes,
  randomUUID,
  createHash,
  webcrypto,
} = require("node:crypto");
const fs = require("node:fs"),
  vm = require("node:vm");
const { createClient } = require("@supabase/supabase-js");
require("./backend-env.cjs")([
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET",
]);
function sql(query) {
  const r = cp.spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_pokedex-local",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: query, encoding: "utf8" },
  );
  if (r.status !== 0)
    throw Error("Local usage-test SQL failed; database diagnostics withheld.");
  return r.stdout.trim();
}
(async () => {
  const r = cp.spawnSync(
    process.execPath,
    ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"],
    { encoding: "utf8" },
  );
  if (r.status !== 0)
    throw Error(
      "Start the local Docker stack first. No hosted project contacted.",
    );
  const status = JSON.parse(r.stdout),
    url = status.API_URL;
  assert(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
  const publicKey = status.ANON_KEY,
    adminKey = status.SERVICE_ROLE_KEY;
  assert(publicKey && adminKey);
  const saved = JSON.parse(
    sql(
      "select row_to_json(x) from (select enabled,encode(secret_digest,'hex') digest from binder_private.usage_gateway) x",
    ),
  );
  const savedPublic = JSON.parse(
    sql(
      "select coalesce(json_agg(b),'[]') from binder_private.usage_buckets b where actor='public'",
    ),
  );
  const secret = randomBytes(32).toString("hex"),
    users = [],
    clients = [];
  let edgeProcess;
  fs.mkdirSync(".scratch/runtime", { recursive: true });
  const envFile = ".scratch/runtime/usage-" + randomUUID() + ".env";
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, adminKey, options);
  const { createGateway } = await import(
    "../supabase/functions/usage-gateway/gateway.mjs"
  );
  const gateway = createGateway({
    url,
    publicKey,
    secret,
    origins: ["http://localhost:5500"],
  });
  const network = (input, init = {}) => {
    const target = new URL(typeof input === "string" ? input : input.url);
    if (target.pathname.startsWith("/functions/v1/usage-gateway/"))
      return process.argv.includes("--edge")
        ? fetch(input, init)
        : gateway(new Request(input, init));
    return fetch(input, init);
  };
  const transport = {
    window: { POKEDEX_BACKEND: { url, usageGateway: true } },
    URL,
    Request,
    Headers,
    Blob,
    ArrayBuffer,
    TextEncoder,
    fetch: network,
  };
  vm.runInNewContext(
    fs.readFileSync("src/scripts/backend-fetch.js", "utf8"),
    transport,
  );
  const protectedFetch = transport.window.PokedexFetch;
  async function account() {
    const email = "usage-" + randomUUID() + "@example.com";
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created.error)
      throw Error("Could not create disposable local account.");
    const id = created.data.user.id;
    users.push(id);
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (link.error) throw Error("Could not prepare local session.");
    const client = createClient(url, publicKey, {
      ...options,
      global: { fetch: protectedFetch },
    });
    const login = await client.auth.verifyOtp({
      token_hash: link.data.properties.hashed_token,
      type: "email",
    });
    if (login.error) throw Error("Could not start local session.");
    clients.push(client);
    return {
      id,
      client,
      token: login.data.session.access_token,
      session: login.data.session,
    };
  }
  try {
    sql(
      "update binder_private.usage_gateway set secret_digest=sha256(convert_to('" +
        secret +
        "','UTF8')),enabled=true",
    );
    if (process.argv.includes("--edge")) {
      fs.writeFileSync(
        envFile,
        "POKEDEX_GATEWAY_SECRET=" +
          secret +
          "\nPOKEDEX_GATEWAY_ORIGINS=http://localhost:5500\n",
        { mode: 0o600 },
      );
      // Windows terminates the Node launcher without forwarding SIGTERM. Own
      // the native test process directly so cleanup cannot orphan its watcher.
      const native =
        process.platform === "win32"
          ? require("node:path").join(
              require("node:path").dirname(
                require.resolve(
                  "@supabase/cli-windows-" + process.arch + "/package.json",
                ),
              ),
              "bin",
              "supabase.exe",
            )
          : process.execPath;
      edgeProcess = cp.spawn(
        native,
        [
          ...(process.platform === "win32"
            ? []
            : ["node_modules/supabase/dist/supabase.js"]),
          "functions",
          "serve",
          "--agent",
          "no",
          "--env-file",
          envFile,
        ],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      let startupLog = "";
      for (const stream of [edgeProcess.stdout, edgeProcess.stderr])
        stream.on("data", (bytes) => {
          startupLog = (startupLog + bytes.toString()).slice(-4000);
        });
      const deadline = Date.now() + 45000;
      for (;;) {
        // A preflight can be served by the previous local worker during reload.
        // Wait for an admitted read with this run's new private key instead.
        try {
          if (
            (
              await fetch(
                url + "/functions/v1/usage-gateway/rest/v1/rpc/catalogue_info",
                {
                  method: "POST",
                  headers: {
                    apikey: publicKey,
                    "Content-Type": "application/json",
                  },
                  body: "{}",
                  signal: AbortSignal.timeout(2000),
                },
              )
            ).status === 200
          )
            break;
        } catch {}
        if (
          (edgeProcess.exitCode !== null && edgeProcess.exitCode !== 0) ||
          Date.now() > deadline
        )
          throw Error(
            "Local Edge Function could not start (CLI exit " +
              edgeProcess.exitCode +
              "). " +
              startupLog
                .replaceAll(secret, "[secret]")
                .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[JWT]"),
          );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (process.argv.includes("--load")) {
      assert(
        process.argv.includes("--edge"),
        "Load checks require the real Edge runtime.",
      );
      await require("./check-usage-load.cjs")({
        account,
        sql,
        url,
        publicKey,
        protectedFetch,
      });
      return;
    }
    const a = await account(),
      b = await account();
    const headers = {
      apikey: publicKey,
      Authorization: "Bearer " + a.token,
      "Content-Type": "application/json",
    };
    const direct = async (path, method = "GET", body) =>
      fetch(url + path, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      });
    for (const method of ["GET", "HEAD"])
      assert.equal(
        (await direct("/rest/v1/binders?select=*", method)).status,
        403,
      );
    assert.equal(
      (await direct("/rest/v1/rpc/catalogue_info", "POST", "{}")).status,
      403,
    );
    assert.equal(
      (
        await direct(
          "/graphql/v1",
          "POST",
          JSON.stringify({ query: "{__typename}" }),
        )
      ).status,
      403,
    );
    const publicResult = await protectedFetch(
      url + "/rest/v1/rpc/catalogue_info",
      {
        method: "POST",
        headers: { apikey: publicKey, "Content-Type": "application/json" },
        body: "{}",
      },
    );
    assert.equal(
      publicResult.status,
      200,
      "Gateway catalogue HTTP " +
        publicResult.status +
        " code " +
        (await publicResult.clone().json()).code,
    );
    assert((await publicResult.json()).count > 0);
    const scope = { window: {}, crypto: webcrypto };
    for (const file of [
      "data/sample-cards.js",
      "data/sample-card-details.js",
      "scripts/binder-schema.js",
      "scripts/editor-state.js",
    ])
      vm.runInNewContext(fs.readFileSync("src/" + file, "utf8"), scope);
    const document = JSON.parse(
      JSON.stringify(
        scope.window.BinderState.create({
          name: "Usage check",
          rows: 2,
          columns: 2,
          cards: ["001"],
        }).document,
      ),
    );
    const id = randomUUID();
    assert(
      !(
        await a.client.rpc("commit_binders", {
          expected: [],
          documents: [{ id, document }],
        })
      ).error,
    );
    assert.equal((await a.client.from("binders").select("*")).data.length, 1);
    assert.equal((await b.client.from("binders").select("*")).data.length, 0);
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=",
      "base64",
    );
    const file =
      a.id + "/" + createHash("sha256").update(bytes).digest("hex") + ".png";
    assert(
      !(await a.client.rpc("reserve_binder_artwork", { object_path: file }))
        .error,
    );
    assert(
      !(
        await a.client.storage
          .from("binder-artwork")
          .upload(file, new Blob([bytes], { type: "image/png" }))
      ).error,
    );
    const download = await a.client.storage
      .from("binder-artwork")
      .download(file);
    assert(
      !download.error,
      "Gateway must preserve Storage RLS request context",
    );
    assert.deepEqual(Buffer.from(await download.data.arrayBuffer()), bytes);
    const head = await protectedFetch(
      url + "/storage/v1/object/binder-artwork/" + file,
      { method: "HEAD", headers },
    );
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert(
      (await b.client.storage.from("binder-artwork").download(file)).error,
    );
    assert(
      (await direct("/storage/v1/object/binder-artwork/" + file)).status >= 400,
    );
    assert(
      (
        await direct(
          "/storage/v1/object/sign/binder-artwork/" + file,
          "POST",
          '{"expiresIn":60}',
        )
      ).status >= 400,
    );
    const snapshot = await a.client.rpc("account_snapshot");
    assert(!snapshot.error);
    assert.equal(snapshot.data.binders.length, 1);
    assert(
      !(
        await a.client.rpc("restore_account", {
          expected: [{ id, revision: 1 }],
          documents: [{ id, document }],
          expected_collection: null,
          collection_document: { records: [] },
        })
      ).error,
    );
    // Supported worst-case artwork COUNT and SIZE fits one export/restore flow.
    const c = await account();
    for (let i = 0; i < 60; i++) {
      const art = Buffer.alloc(500000, i);
      bytes.copy(art);
      const name =
        c.id + "/" + createHash("sha256").update(art).digest("hex") + ".png";
      assert(
        !(await c.client.rpc("reserve_binder_artwork", { object_path: name }))
          .error,
      );
      const upload =
        i === 0
          ? await c.client.storage
              .from("binder-artwork")
              .upload(name, new Blob([art], { type: "image/png" }))
          : await admin.storage
              .from("binder-artwork")
              .upload(name, art, { contentType: "image/png" });
      assert(
        !upload.error,
        "Maximum-size multipart upload must fit the gateway envelope",
      );
    }
    const accountScope = {
      window: {
        BinderRepository: {
          enabled: true,
          ready: Promise.resolve(),
          client: c.client,
          user: { id: c.id },
          identityToken: async () => c.token,
          assertIdentity() {},
        },
        POKEDEX_BACKEND: { url },
        PokedexFetch: protectedFetch,
      },
      fetch,
      AbortSignal,
      Blob,
      Uint8Array,
      atob,
      btoa,
      crypto: webcrypto,
      structuredClone,
    };
    for (const module of [
      "data/sample-cards.js",
      "data/sample-card-details.js",
      "scripts/binder-schema.js",
      "scripts/binder-store.js",
      "scripts/collection-state.js",
      "scripts/account-backup.js",
      "scripts/account-data.js",
    ])
      vm.runInNewContext(
        fs.readFileSync("src/" + module, "utf8"),
        accountScope,
      );
    const backup = await accountScope.window.AccountData.exportData();
    assert.equal(backup.artwork.length, 60);
    await accountScope.window.AccountData.restoreData(backup);
    console.log(
      "PASS: portable account export/restore with 60 maximum-size artwork files remains within the budgets.",
    );
    // One remaining token shared by simultaneous tabs. Invalid writes count.
    sql(
      "insert into binder_private.usage_buckets(actor,owner_id,bucket,tokens,updated_at) values('" +
        a.id +
        "','" +
        a.id +
        "','write',1,now()+interval '1 minute') on conflict(actor,bucket) do update set tokens=1,updated_at=excluded.updated_at",
    );
    const attempt = () =>
      protectedFetch(url + "/rest/v1/rpc/commit_collection", {
        method: "POST",
        headers,
        body: '{"expected_revision":null,"document":{"records":[null]}}',
      });
    const burst = await Promise.all(Array.from({ length: 4 }, attempt));
    assert.equal(burst.filter((x) => x.status === 400).length, 1);
    assert.equal(burst.filter((x) => x.status === 429).length, 3);
    assert.equal(
      (await attempt()).status,
      429,
      "Rollback must not replenish admission",
    );
    assert(
      !(
        await b.client.rpc("commit_collection", {
          expected_revision: null,
          document: { records: [] },
        })
      ).error,
      "Accounts stay independent",
    );
    // Account deletion must remain possible after Save is throttled.
    const begin = await a.client.rpc("begin_account_deletion", {
      confirmation: "DELETE",
    });
    assert(!begin.error);
    assert(
      !(await a.client.storage.from("binder-artwork").remove([file])).error,
    );
    assert(
      !(
        await a.client.rpc("finish_account_deletion", {
          confirmation: "DELETE",
        })
      ).error,
    );
    users.splice(users.indexOf(a.id), 1);
    sql(
      "update binder_private.usage_buckets set tokens=0,updated_at=now()-interval '2 minutes' where actor='" +
        b.id +
        "'",
    );
    assert(
      !(await b.client.from("collections").select("*").maybeSingle()).error,
      "Budget refills and singular reads still work",
    );
    console.log(
      "PASS: real local origin/GET/HEAD/GraphQL/artwork bypass denial, gateway ownership/Save/restore, independent concurrent-attempt counting, refill and deletion after throttling.",
    );
  } finally {
    let cleanupFailed = false;
    try {
      for (const client of clients)
        await client.auth.signOut({ scope: "local" }).catch(() => {});
      for (const id of users) {
        const list = await admin.storage
          .from("binder-artwork")
          .list(id, { limit: 100 });
        if (list.error) {
          cleanupFailed = true;
          continue;
        }
        const paths = (list.data || [])
          .filter((x) => x.id)
          .map((x) => id + "/" + x.name);
        if (
          paths.length &&
          (await admin.storage.from("binder-artwork").remove(paths)).error
        ) {
          cleanupFailed = true;
          continue;
        }
        if ((await admin.auth.admin.deleteUser(id)).error) cleanupFailed = true;
      }
    } finally {
      try {
        sql(
          "update binder_private.usage_gateway set enabled=" +
            saved.enabled +
            ",secret_digest=" +
            (saved.digest ? "decode('" + saved.digest + "','hex')" : "null") +
            "; delete from binder_private.usage_buckets where actor='public';",
        );
        for (const row of savedPublic)
          sql(
            "insert into binder_private.usage_buckets(actor,bucket,tokens,updated_at) values('public','" +
              row.bucket +
              "'," +
              row.tokens +
              ",'" +
              row.updated_at +
              "')",
          );
      } finally {
        edgeProcess?.kill();
        fs.rmSync(envFile, { force: true });
      }
    }
    if (cleanupFailed)
      throw Error(
        "Disposable local account cleanup failed; inspect locally before repeating.",
      );
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
