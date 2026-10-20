const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { normalize, samples, setIds } = require("./catalogue-import.cjs");
const raw = {
  id: "base1-1",
  localId: "1",
  name: "Alakazam",
  category: "Pokemon",
  types: ["Psychic"],
  rarity: "Rare",
  set: { id: "base1" },
  image: "https://assets.tcgdex.net/en/base/base1/1",
  variants: { holo: true, firstEdition: true },
  hp: 80,
};
const set = { id: "base1", name: "Base Set" };
const card = normalize(raw, set);
assert.equal(setIds.length, 10);
assert.equal(new Set(setIds).size, 10);
assert.equal(card.id, "base1-1");
assert.equal(normalize({ ...raw, image: undefined }, set).imageUrl, "");
for (const image of [
  "http://assets.tcgdex.net/en/base/base1/1",
  "https://evil.test/image",
  "https://assets.tcgdex.net@evil.test/en/image",
  "https://assets.tcgdex.net/en/image?secret=x",
])
  assert.throws(() => normalize({ ...raw, image }, set));
assert.throws(() => normalize({ ...raw, set: { id: "base2" } }, set));
assert.throws(() => normalize({ ...raw, variants: { normal: "true" } }, set));
const legacy = samples().find((c) => c.id === "001");
const preserved = normalize(
  {
    ...raw,
    id: legacy.providerId,
    localId: legacy.collectorNumber,
    set: { id: legacy.setId },
  },
  { id: legacy.setId, name: legacy.setName },
  legacy,
);
assert.equal(preserved.id, "001");
assert.equal(preserved.variants.reverse, true);
async function main() {
  let calls = 0,
    fail = false;
  const window = {
    CARDS: samples(),
    POKEDEX_BACKEND: {
      url: "http://127.0.0.1:54321",
      publishableKey: "public-test",
    },
  };
  const scope = {
    window,
    URL,
    AbortSignal,
    console,
    fetch: async (url, options) => {
      calls++;
      assert(!JSON.stringify(options).includes("private-note"));
      assert.equal(options.credentials, "omit");
      assert(!options.headers.Authorization);
      if (fail) return new Response("{}", { status: 503 });
      if (url.endsWith("catalogue_info"))
        return Response.json({
          sets: [{ id: set.id, name: set.name, count: 1, preview: [] }],
          types: ["Psychic"],
          rarities: ["Rare"],
          count: 1,
        });
      if (url.endsWith("catalogue_cards")) return Response.json([card]);
      return Response.json({ total: 1, cards: [card] });
    },
  };
  vm.runInNewContext(
    fs.readFileSync("src/scripts/card-catalogue.js", "utf8"),
    scope,
  );
  const catalogue = window.CardCatalogue;
  assert.equal(
    catalogue.thumbnail(card),
    card.imageUrl.replace("/high.webp", "/low.webp"),
  );
  assert.equal(
    catalogue.thumbnail({ imageUrl: "https://other.test/high.webp" }),
    "https://other.test/high.webp",
  );
  assert.equal(
    catalogue.thumbnail({ imageUrl: "data:image/png;base64,abc" }),
    "data:image/png;base64,abc",
  );
  assert.equal(catalogue.thumbnail(null), "");
  assert.equal(
    card.imageUrl.endsWith("/high.webp"),
    true,
    "Canonical artwork stays full size",
  );
  await catalogue.ready;
  assert(catalogue.enabled);
  assert.equal(
    window.CARDS.length,
    55,
    "Startup does not fetch every printing",
  );
  await catalogue.ensure({
    records: [{ cardId: "base1-1", notes: "private-note" }],
  });
  assert.equal(catalogue.byId.get("base1-1").name, "Alakazam");
  const count = calls;
  await catalogue.ensure({ cardId: "base1-1" });
  assert.equal(calls, count, "Known metadata is reused");
  await catalogue.search({ q: "Alakazam" });
  const after = calls;
  await catalogue.search({ q: "Alakazam" });
  assert.equal(calls, after, "Identical searches use bounded public cache");
  const poisoned = JSON.parse(
    JSON.stringify(card).replace(
      '"name":"Alakazam"',
      '"name":"Alakazam","__proto__":{"polluted":true}',
    ),
  );
  catalogue.register([poisoned]);
  assert.equal(
    catalogue.byId.get(card.id).polluted,
    undefined,
    "Recovery metadata cannot inject object properties",
  );
  assert.throws(() =>
    catalogue.register([
      { ...card, id: "bad", imageUrl: "javascript:alert(1)" },
    ]),
  );
  assert(!catalogue.byId.has("bad"));
  fail = true;
  await assert.rejects(catalogue.search({ q: "uncached" }), /could not load/);
  assert(
    catalogue.byId.has("base1-1"),
    "Request failures preserve known saved cards",
  );
  const doc = {
    name: "Catalogue backup",
    pages: [
      {
        id: "page",
        rows: 1,
        columns: 1,
        regions: [
          {
            id: "region",
            cells: [[0, 0]],
            content: { id: "content", cardId: card.id, variant: "holo" },
          },
        ],
      },
    ],
    overflow: [],
  };
  const { portable } = require("./backend-ops.cjs");
  const accounts = portable({
    format: "pokedex-service",
    version: 1,
    createdAt: new Date().toISOString(),
    catalogue: [card],
    accounts: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        binders: [{ document: doc }],
        collection: null,
      },
    ],
    files: [],
  });
  assert.equal(
    accounts[0].backup.binders[0].pages[0].regions[0].content.cardId,
    card.id,
  );
  console.log(
    "PASS: catalogue import validation, legacy IDs/finishes, bounded loading/cache, failure safety and independent recovery metadata.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
