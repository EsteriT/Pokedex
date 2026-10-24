/* Operator-only downloads and loopback Docker imports. No hosted write mode. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const folder = path.join(root, ".scratch/catalogue");
const setIds = [
  "base1",
  "base2",
  "base3",
  "base5",
  "hgss1",
  "bw1",
  "xy1",
  "sm1",
  "swsh1",
  "sv03.5",
];
const printingAliases = {
  // Keep safe internal IDs while retaining the provider's punctuation identifiers.
  "exu-!": { id: "exu-unown-exclamation", number: "!" },
  "exu-%3F": { id: "exu-unown-question", number: "?" },
};
const finishes = ["normal", "holo", "reverse", "firstEdition", "wPromo"];
function samples() {
  const scope = { window: {} };
  for (const file of ["sample-cards", "sample-card-details"])
    vm.runInNewContext(
      fs.readFileSync(path.join(root, "src/data", file + ".js"), "utf8"),
      scope,
    );
  return scope.window.CARDS;
}
function text(value, max, optional = false) {
  if (optional && (value == null || value === "")) return "";
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f]/.test(value)
  )
    throw Error("Invalid TCGdex text field. Nothing imported.");
  return value;
}
function normalize(card, set, legacy) {
  const providerId = text(card.id, 80);
  if (
    (!/^[A-Za-z0-9.-]+$/.test(providerId) && !printingAliases[providerId]) ||
    card.set?.id !== set.id ||
    !providerId.startsWith(set.id + "-")
  )
    throw Error("Card does not belong to the requested set.");
  const number = text(card.localId, 30);
  if (providerId !== set.id + "-" + number)
    throw Error("Inconsistent printing identifier.");
  let imageUrl = "";
  if (card.image) {
    const image = new URL(card.image);
    if (
      image.protocol !== "https:" ||
      image.hostname !== "assets.tcgdex.net" ||
      image.port ||
      image.username ||
      image.password ||
      image.search ||
      image.hash ||
      !/^\/en\/[A-Za-z0-9./_-]+$/.test(image.pathname)
    )
      throw Error("Untrusted card image address.");
    imageUrl = image.href + "/high.webp";
  }
  if (
    !card.variants ||
    typeof card.variants !== "object" ||
    Array.isArray(card.variants)
  )
    throw Error("Missing printing finish information.");
  const variants = {};
  for (const key of finishes) {
    if (card.variants[key] != null && typeof card.variants[key] !== "boolean")
      throw Error("Invalid printing finish.");
    // An updated provider record must not invalidate a previously saved finish.
    variants[key] =
      card.variants[key] === true || legacy?.variants?.[key] === true;
  }
  const types = card.types || [];
  if (!Array.isArray(types) || types.length > 4)
    throw Error("Invalid card types.");
  const record = {
    id: legacy?.id || printingAliases[providerId]?.id || providerId,
    providerId,
    collectorNumber: printingAliases[providerId]?.number || number,
    name: text(card.name, 160),
    imageUrl,
    pokemonTypes: types.map((t) => text(t, 30)),
    setId: set.id,
    setName: text(set.name, 160),
    rarity: text(card.rarity, 100, true) || "Not specified",
    category: text(card.category, 40),
    variants,
    illustrator: text(card.illustrator, 160, true),
    hp:
      Number.isInteger(card.hp) && card.hp >= 0 && card.hp <= 10000
        ? card.hp
        : null,
    palette: legacy?.palette || [],
  };
  return record;
}
async function request(endpoint, cacheFile, query) {
  if (
    cacheFile &&
    fs.existsSync(cacheFile) &&
    Date.now() - fs.statSync(cacheFile).mtimeMs < 86400000
  ) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (!query || (!cached.errors?.length && Array.isArray(cached.data?.cards)))
      return cached;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(
      "https://api.tcgdex.net/v2/" + (query ? "graphql" : "en/" + endpoint),
      {
        ...(query ? { method: "POST", body: JSON.stringify({ query }) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
        headers: {
          "User-Agent": "Pokedex-catalogue/1.0",
          ...(query ? { "Content-Type": "application/json" } : {}),
        },
      },
    );
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (!response.ok)
      throw Error(
        "TCGdex request failed (" +
          response.status +
          "). Existing catalogue unchanged.",
      );
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 4 * 1024 * 1024) throw Error("TCGdex response too large.");
      chunks.push(chunk);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (query && (data.errors?.length || !Array.isArray(data.data?.cards)))
      throw Error("TCGdex returned incomplete card metadata.");
    if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(data));
    return data;
  }
}
function selectSets(list, pocket) {
  if (
    !Array.isArray(list) ||
    !list.length ||
    list.length > 500 ||
    !Array.isArray(pocket?.sets) ||
    pocket.id !== "tcgp" ||
    !pocket.sets.length
  )
    throw Error("Invalid English set directory or Pocket exclusions.");
  const excluded = new Set(pocket.sets.map((s) => s.id));
  const ids = new Set();
  const physical = list.filter((set) => {
    if (
      !/^[A-Za-z0-9.-]{1,40}$/.test(set.id) ||
      ids.has(set.id) ||
      !Number.isInteger(set.cardCount?.total) ||
      set.cardCount.total < 1 ||
      set.cardCount.total > 1000
    )
      throw Error("Invalid or duplicate English set.");
    ids.add(set.id);
    return !excluded.has(set.id);
  });
  if (
    [...excluded].some((id) => !ids.has(id)) ||
    setIds.some((id) => !ids.has(id))
  )
    throw Error("Incomplete English set directory.");
  return physical;
}
async function download(allEnglish = false) {
  fs.mkdirSync(path.join(folder, "full-sets"), { recursive: true });
  const directory = allEnglish
    ? selectSets(
        await request("sets", path.join(folder, "english-sets.json")),
        await request("series/tcgp", path.join(folder, "pocket-series.json")),
      )
    : setIds.map((id) => ({ id }));
  const legacy = new Map(samples().map((c) => [c.providerId, c]));
  const results = new Array(directory.length);
  let cursor = 0;
  const unavailableSets = [];
  const failures = [];
  const coverageGaps = [];
  const workers = await Promise.allSettled(
    Array.from({ length: 4 }, async () => {
      while (cursor < directory.length) {
        const index = cursor++,
          expected = directory[index],
          id = expected.id;
        try {
          const set = await request(
            "sets/" + id,
            path.join(folder, id + ".json"),
          );
          if (
            allEnglish &&
            set.id === id &&
            Array.isArray(set.cards) &&
            set.cards.length === 0 &&
            set.cardCount?.total > 0
          ) {
            unavailableSets.push({
              id,
              name: set.name,
              expectedCount: set.cardCount.total,
              reason: "Provider lists this set but supplies no card records.",
            });
            console.log(
              id + ": no provider card records; recorded as unavailable.",
            );
            continue;
          }
          if (
            set.id !== id ||
            !Array.isArray(set.cards) ||
            !set.cards.length ||
            set.cards.length > 1000 ||
            (allEnglish
              ? set.cards.length > set.cardCount?.total
              : set.cards.length !== set.cardCount?.total) ||
            (expected.cardCount &&
              expected.cardCount.total !== set.cardCount?.total)
          )
            throw Error("Incomplete or inconsistent set listing: " + id);
          if (set.cards.length < set.cardCount.total)
            coverageGaps.push({
              id,
              name: set.name,
              expectedCount: set.cardCount.total,
              availableCount: set.cards.length,
            });
          if (allEnglish && set.serie?.id === "tcgp")
            throw Error("Pocket set excluded: " + id);
          const query =
            "{cards(filters:{id:" +
            JSON.stringify(id + "-*") +
            "}){id localId name category types rarity illustrator hp image set{id} variants{normal reverse holo firstEdition wPromo}}}";
          const full = await request(
            "",
            path.join(folder, "full-sets", id + ".json"),
            query,
          );
          if (full.errors?.length || !Array.isArray(full.data?.cards))
            throw Error("Incomplete card metadata: " + id);
          // Prefix queries also match siblings such as 30th-c; require exact membership.
          const rows = full.data.cards.filter((c) => c?.set?.id === id);
          const requested = new Set(set.cards.map((c) => c.id));
          const englishNames = new Map(set.cards.map((c) => [c.id, c.name]));
          if (
            requested.size !== set.cards.length ||
            rows.length !== requested.size
          )
            throw Error("Incomplete card batch: " + id);
          const cards = rows
            .map((card) => {
              if (!requested.delete(card.id))
                throw Error("Duplicate or unexpected card: " + id);
              if (card.name !== englishNames.get(card.id))
                throw Error("Inconsistent English card name: " + card.id);
              return normalize(card, set, legacy.get(card.id));
            })
            .sort((a, b) =>
              a.collectorNumber.localeCompare(b.collectorNumber, "en", {
                numeric: true,
              }),
            );
          if (requested.size) throw Error("Missing card: " + id);
          const logo = set.logo == null ? null : text(set.logo, 240);
          if (
            logo &&
            !new RegExp(
              "^https://assets\\.tcgdex\\.net/en/[A-Za-z0-9_.-]+/" +
                id.replaceAll(".", "\\.") +
                "/logo$",
            ).test(logo)
          )
            throw Error("Untrusted set logo: " + id);
          results[index] = {
            cards,
            set: {
              id,
              name: text(set.name, 160),
              logo,
              releaseDate: set.releaseDate || null,
              count: cards.length,
              expectedCount: set.cardCount.total,
              missingImages: cards.filter((c) => !c.imageUrl).length,
            },
          };
          console.log(id + ": " + cards.length + " card records checked.");
        } catch (error) {
          failures.push({ id, reason: error.message });
        }
      }
    }),
  );
  const failed = workers.find((w) => w.status === "rejected");
  if (failed) throw failed.reason;
  if (failures.length) {
    fs.writeFileSync(
      path.join(folder, "download-failures.json"),
      JSON.stringify(failures, null, 2),
    );
    throw Error(
      "Catalogue download failed for " +
        failures.map((f) => f.id).join(", ") +
        ". See local download-failures.json; no database changed.",
    );
  }
  const complete = results.filter(Boolean);
  const data = {
    provider: "tcgdex",
    language: "en",
    scope: allEnglish ? "english-physical" : "trial",
    fetchedAt: new Date().toISOString(),
    listedSets: directory.length,
    unavailableSets,
    coverageGaps,
    sets: complete.map((r) => r.set),
    cards: complete.flatMap((r) => r.cards),
  };
  validateSnapshot(data);
  const seen = new Set(data.cards.map((c) => c.providerId));
  if ([...legacy.keys()].some((id) => !seen.has(id)))
    throw Error("A legacy printing is missing.");
  fs.writeFileSync(
    path.join(folder, allEnglish ? "tcgdex-en-full.json" : "tcgdex-en.json"),
    JSON.stringify(data),
  );
  console.log(
    "Downloaded " +
      data.cards.length +
      " printings across " +
      data.sets.length +
      " sets. No database changed.",
  );
  if (unavailableSets.length || coverageGaps.length)
    console.log(
      unavailableSets.length +
        " set groups have no card records; " +
        coverageGaps.length +
        " have incomplete metadata. Coverage gaps are recorded in the snapshot.",
    );
  return data;
}
function validateSnapshot(data) {
  if (
    data?.provider !== "tcgdex" ||
    data.language !== "en" ||
    (data.scope != null &&
      !["trial", "english-physical"].includes(data.scope)) ||
    !Array.isArray(data.sets) ||
    !data.sets.length ||
    data.sets.length > 500 ||
    !Array.isArray(data.cards) ||
    !data.cards.length ||
    data.cards.length > 50000 ||
    (data.scope !== "english-physical" &&
      (data.sets.length !== 10 ||
        data.sets.some((s) => !setIds.includes(s.id))))
  )
    throw Error("Invalid English catalogue snapshot.");
  const counts = new Map(),
    ids = new Set(),
    providers = new Set();
  for (const set of data.sets) {
    if (
      !/^[A-Za-z0-9.-]{1,40}$/.test(set.id) ||
      counts.has(set.id) ||
      !Number.isInteger(set.count) ||
      set.count < 1 ||
      set.count > 1000
    )
      throw Error("Invalid set counts or identity.");
    text(set.name, 160);
    counts.set(set.id, 0);
  }
  for (const card of data.cards) {
    if (
      !counts.has(card.setId) ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(card.id) ||
      (card.providerId !== card.setId + "-" + card.collectorNumber &&
        !(
          printingAliases[card.providerId]?.id === card.id &&
          card.setId === "exu" &&
          printingAliases[card.providerId].number === card.collectorNumber
        )) ||
      ids.has(card.id) ||
      providers.has(card.providerId)
    )
      throw Error("Invalid or duplicate printing.");
    ids.add(card.id);
    providers.add(card.providerId);
    counts.set(card.setId, counts.get(card.setId) + 1);
  }
  if (data.sets.some((s) => s.count !== counts.get(s.id)))
    throw Error("Incomplete English catalogue snapshot.");
  return data;
}
function sql(data) {
  validateSnapshot(data);
  const literal = (value) =>
    "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  return `begin;
set local statement_timeout = '30s';
select pg_advisory_xact_lock(102019, 10);
insert into binder_private.catalogue_sets(set_id,record)
select x->>'id',x from jsonb_array_elements(${literal(data.sets)}) x
on conflict(set_id) do update set record=excluded.record;
insert into binder_private.catalogue(card_id,variants,record)
select x->>'id',x->'variants',x from jsonb_array_elements(${literal(data.cards)}) x
on conflict(card_id) do update set
variants=(select jsonb_object_agg(key,coalesce((binder_private.catalogue.variants->>key)::boolean,false) or (excluded.variants->>key)::boolean)
  from unnest(array['normal','holo','reverse','firstEdition','wPromo']) key),
record=excluded.record;
analyze binder_private.catalogue;
commit;`;
}
async function main() {
  const mode = process.argv[2];
  const allEnglish = process.argv[3] === "--all-english";
  if (process.argv.length > 4 || (process.argv[3] && !allEnglish))
    throw Error("Unknown import option.");
  if (!["download", "--local"].includes(mode))
    throw Error(
      "Use download or --local. Hosted import is intentionally unavailable.",
    );
  const data = await download(allEnglish);
  if (mode === "download") return;
  const filename = path.join(folder, "import.sql");
  fs.writeFileSync(filename, sql(data));
  const project = fs
    .readFileSync(path.join(root, "supabase/config.toml"), "utf8")
    .match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
  if (!project) throw Error("Missing local project identifier.");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_" + project,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { cwd: root, input: sql(data), encoding: "utf8" },
  );
  if (result.status !== 0)
    throw Error(
      "Local catalogue import failed. Check the local migrations/stack. No hosted database contacted.",
    );
  console.log("Local catalogue imported. Existing account data preserved.");
}
module.exports = {
  setIds,
  normalize,
  samples,
  sql,
  selectSets,
  validateSnapshot,
};
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
