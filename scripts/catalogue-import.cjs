/* Operator-only, ten-set trial. No hosted write mode is provided. */
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
  if (optional && value == null) return "";
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
    !/^[A-Za-z0-9.-]+$/.test(providerId) ||
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
    id: legacy?.id || providerId,
    providerId,
    collectorNumber: number,
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
async function request(endpoint, cacheFile) {
  if (
    cacheFile &&
    fs.existsSync(cacheFile) &&
    Date.now() - fs.statSync(cacheFile).mtimeMs < 86400000
  )
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.tcgdex.net/v2/en/" + endpoint, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "Pokedex-catalogue-trial/1.0" },
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
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
    if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(data));
    return data;
  }
}
async function download() {
  fs.mkdirSync(path.join(folder, "cards"), { recursive: true });
  const legacy = new Map(samples().map((c) => [c.providerId, c]));
  const cards = [],
    sets = [],
    seen = new Set();
  for (const id of setIds) {
    const set = await request("sets/" + id, path.join(folder, id + ".json"));
    if (
      set.id !== id ||
      !Array.isArray(set.cards) ||
      set.cards.length < 1 ||
      set.cards.length > 1000 ||
      set.cards.length !== set.cardCount?.total
    )
      throw Error("Incomplete or inconsistent set listing: " + id);
    const result = [];
    let cursor = 0;
    // Four requests at a time; completed responses can be reused after interruption.
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (cursor < set.cards.length) {
          const brief = set.cards[cursor++];
          if (
            typeof brief.id !== "string" ||
            !/^[A-Za-z0-9.-]+$/.test(brief.id)
          )
            throw Error("Invalid card ID.");
          const card = await request(
            "cards/" + encodeURIComponent(brief.id),
            path.join(folder, "cards", brief.id + ".json"),
          );
          if (card.id !== brief.id || seen.has(card.id))
            throw Error("Duplicate or mismatched card.");
          seen.add(card.id);
          result.push(normalize(card, set, legacy.get(card.id)));
        }
      }),
    );
    result.sort((a, b) =>
      a.collectorNumber.localeCompare(b.collectorNumber, "en", {
        numeric: true,
      }),
    );
    cards.push(...result);
    sets.push({
      id,
      name: text(set.name, 160),
      releaseDate: set.releaseDate,
      count: result.length,
      preview: result.slice(0, 3),
      missingImages: result.filter((c) => !c.imageUrl).length,
    });
    console.log(id + ": " + result.length + " card records checked.");
  }
  for (const id of legacy.keys())
    if (!seen.has(id)) throw Error("A legacy printing is missing: " + id);
  const data = {
    provider: "tcgdex",
    language: "en",
    fetchedAt: new Date().toISOString(),
    sets,
    cards,
  };
  fs.writeFileSync(path.join(folder, "tcgdex-en.json"), JSON.stringify(data));
  console.log(
    "Downloaded " +
      cards.length +
      " printings across ten sets. No database changed.",
  );
  return data;
}
function sql(data) {
  if (
    data.provider !== "tcgdex" ||
    data.language !== "en" ||
    data.sets.length !== 10 ||
    data.sets.some((s) => !setIds.includes(s.id)) ||
    data.cards.length > 10000
  )
    throw Error("Not a ten-set English trial snapshot.");
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
  if (!["download", "--local"].includes(mode))
    throw Error(
      "Use download or --local. Hosted import is intentionally unavailable.",
    );
  const data = await download();
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
module.exports = { setIds, normalize, samples, sql };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
