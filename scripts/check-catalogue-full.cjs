/* Full-size acceptance against loopback Docker only; no hosted writes or user cleanup. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const { createClient } = require("@supabase/supabase-js");
const { sql, validateSnapshot, samples } = require("./catalogue-import.cjs");
const root = path.resolve(__dirname, "..");
const filename = path.join(root, ".scratch/catalogue/tcgdex-en-full.json");
function run(exe, args, input) {
  const r = spawnSync(exe, args, {
    cwd: root,
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error(
      "Local catalogue check failed: " +
        (r.stderr || r.error?.message || "command failed"),
    );
  return r.stdout.trim();
}
async function main() {
  if (!fs.existsSync(filename))
    throw Error("Run catalogue:download:english first.");
  const data = validateSnapshot(JSON.parse(fs.readFileSync(filename, "utf8")));
  assert(
    data.sets.length > 10 && data.cards.length > 10000,
    "Full-size snapshot required",
  );
  const project = fs
    .readFileSync(path.join(root, "supabase/config.toml"), "utf8")
    .match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
  assert(project, "Local Docker project required");
  const query = (text) =>
    run(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_" + project,
        "psql",
        "-X",
        "-qAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      text,
    );
  const fingerprint = () =>
    query(`select md5(coalesce((select string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text) from public.binders x),'')) ||
    md5(coalesce((select string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text) from public.collections x),'')) ||
    md5(coalesce((select string_agg(to_jsonb(x)::text,'' order by to_jsonb(x)::text) from storage.objects x),''));`);
  const prior = fingerprint(),
    importMs = [];
  for (let i = 0; i < 2; i++) {
    const start = performance.now();
    query(sql(data));
    importMs.push(Math.round(performance.now() - start));
    assert.equal(
      fingerprint(),
      prior,
      "Import must preserve private binders, collections and artwork metadata",
    );
    assert.equal(
      Number(
        query(
          "select count(*) from binder_private.catalogue where record is not null;",
        ),
      ),
      data.cards.length,
      "Repeat import is idempotent",
    );
  }
  require("./backend-env.cjs")([
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
    "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET",
  ]);
  const config = JSON.parse(
    run(process.execPath, [
      path.join(root, "node_modules/supabase/dist/supabase.js"),
      "status",
      "-o",
      "json",
    ]),
  );
  const url = config.API_URL || config.api_url;
  assert(
    ["127.0.0.1", "localhost"].includes(new URL(url).hostname),
    "Loopback API only",
  );
  const client = createClient(url, config.PUBLISHABLE_KEY || config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const call = async (name, body = {}) => {
    const result = await client.rpc(name, body);
    assert(!result.error, result.error?.message);
    return result.data;
  };
  const info = await call("catalogue_info");
  assert.equal(info.count, data.cards.length);
  assert.equal(info.sets.length, data.sets.length);
  assert.equal(info.searchVersion, 3);
  assert.equal(info.metadataVersion, 2);
  assert(
    info.sets.every((s) => !s.preview?.length),
    "Startup must not preload hundreds of card records",
  );
  const metadataBytes = Buffer.byteLength(JSON.stringify(info));
  assert(
    metadataBytes < 256 * 1024,
    "Metadata must fit the existing gateway limit",
  );
  for (const set of data.sets)
    assert.equal(info.sets.find((s) => s.id === set.id)?.count, set.count);
  const scope = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src/scripts/discover-core.js"), "utf8"),
    scope,
  );
  const fixtures = [
    {},
    { q: "Charizard", qScope: "name" },
    { q: "#001", qScope: "number" },
    { q: "151", qScope: "set" },
    { q: "Mitsuhiro Arita", qScope: "illustrator" },
    { set: ["base1", "sv03.5"], type: ["Water", "Fire"] },
    { type: ["Water", "Grass"], typeMatch: "all" },
    { type: ["Dragon", "Fighting"], typeMatch: "all" },
    { category: ["Pokemon", "Trainer"], finish: ["holo", "reverse"] },
    { illustrator: ["Ken Sugimori", "Mitsuhiro Arita"] },
    { hpMin: 200, hpMax: 300, sort: "hp-desc" },
    { set: "exu", q: "?", qScope: "number" },
    { q: "%' or true; --" },
  ];
  const timings = [],
    observations = [];
  let searchBytes = 0;
  for (const filters of fixtures) {
    const expected = scope.window.DiscoverCatalogue.search(
      data.cards,
      filters,
    ).length;
    for (let repeat = 0; repeat < 3; repeat++) {
      const start = performance.now(),
        result = await call("search_catalogue", { filters, page_number: 1 });
      timings.push(Math.round(performance.now() - start));
      observations.push({ filters, elapsedMs: timings.at(-1) });
      assert.equal(
        result.total,
        expected,
        "Search count: " + JSON.stringify(filters),
      );
      assert(result.cards.length <= 24);
      searchBytes = Math.max(
        searchBytes,
        Buffer.byteLength(JSON.stringify(result)),
      );
    }
  }
  for (const sort of [
    "name",
    "name-desc",
    "number",
    "number-desc",
    "set",
    "hp",
    "hp-desc",
  ]) {
    const first = await call("search_catalogue", {
      filters: { sort },
      page_number: 1,
    });
    const second = await call("search_catalogue", {
      filters: { sort },
      page_number: 2,
    });
    assert.equal(first.cards.length, 24);
    assert.equal(second.cards.length, 24);
    assert(
      !first.cards.some((c) => second.cards.some((d) => c.id === d.id)),
      "Pages must not overlap: " + sort,
    );
  }
  const lastPage = await call("search_catalogue", {
    page_number: Math.ceil(data.cards.length / 24),
  });
  assert.equal(lastPage.cards.length, data.cards.length % 24 || 24);
  for (const id of ["base1-4", "sv03.5-001", "exu-!", "exu-%3F"]) {
    const found = await call("search_catalogue", { filters: { q: id } });
    assert.equal(found.total, 1);
    assert.equal(found.cards[0].providerId, id);
  }
  for (const card of samples()) {
    const rows = await call("catalogue_cards", { ids: [card.id] });
    assert.equal(
      rows[0].providerId,
      card.providerId,
      "Legacy printing identity",
    );
    for (const key of Object.keys(card.variants))
      if (card.variants[key])
        assert(rows[0].variants[key], "Legacy finish preserved");
  }
  await require("./check-catalogue-live.cjs")(client);
  const adapterWindow = {
    CARDS: samples(),
    POKEDEX_BACKEND: {
      url,
      publishableKey: config.PUBLISHABLE_KEY || config.ANON_KEY,
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src/scripts/card-catalogue.js"), "utf8"),
    { window: adapterWindow, fetch, URL, AbortSignal },
  );
  await adapterWindow.CardCatalogue.ready;
  assert(
    adapterWindow.CardCatalogue.enabled,
    "Real full directory must activate remote mode",
  );
  assert.equal(
    adapterWindow.CARDS.length,
    55,
    "Startup loads only sample cards, not full catalogue",
  );
  await adapterWindow.CardCatalogue.search({ q: "Charizard", qScope: "name" });
  assert(adapterWindow.CARDS.length <= 79);
  const last = data.cards.at(-1);
  const doc = {
    name: "Full catalogue recovery",
    pages: [
      {
        id: "page",
        rows: 1,
        columns: 1,
        regions: [
          {
            id: "region",
            cells: [[0, 0]],
            content: {
              id: "content",
              cardId: last.id,
              variant: Object.keys(last.variants).find((k) => last.variants[k]),
            },
          },
        ],
      },
    ],
    overflow: [],
  };
  const archive = {
    format: "pokedex-service",
    version: 1,
    createdAt: new Date().toISOString(),
    catalogue: data.cards,
    accounts: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        binders: [{ document: doc }],
        collection: null,
      },
    ],
    files: [],
  };
  const { encrypt, decrypt } = require("./backup-crypto.cjs"),
    { portable } = require("./backend-ops.cjs");
  const encrypted = encrypt(archive, "local-full-catalogue-test-passphrase");
  const restored = portable(
    decrypt(encrypted, "local-full-catalogue-test-passphrase"),
  );
  assert.equal(
    restored[0].backup.binders[0].pages[0].regions[0].content.cardId,
    last.id,
  );
  timings.sort((a, b) => a - b);
  const report = {
    testedAt: new Date().toISOString(),
    sets: data.sets.length,
    cards: data.cards.length,
    metadataBytes,
    searchBytes,
    importMs,
    searchSamples: timings.length,
    searchMedianMs: timings[Math.floor(timings.length / 2)],
    searchP95Ms: timings[Math.ceil(timings.length * 0.95) - 1],
    searchMaxMs: timings.at(-1),
    slowestSearch: observations.sort((a, b) => b.elapsedMs - a.elapsedMs)[0],
    encryptedCatalogueBackupBytes: encrypted.length,
    missingImages: data.cards.filter((c) => !c.imageUrl).length,
    unavailableSets: data.unavailableSets,
    coverageGaps: data.coverageGaps,
  };
  fs.writeFileSync(
    path.join(root, ".scratch/catalogue/full-test-report.json"),
    JSON.stringify(report, null, 2),
  );
  assert(searchBytes < 64 * 1024);
  assert(
    report.searchMaxMs < 3000,
    "Sampled local HTTP search exceeded 3000 ms: " +
      report.searchMaxMs +
      " ms. See full-test-report.json.",
  );
  console.log(
    "PASS: full-size imports/reimports preserve account data; real anonymous search, filters, pagination, legacy IDs, response bounds, lazy metadata and encrypted recovery.",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
