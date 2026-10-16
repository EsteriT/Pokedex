const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  assert = require("assert"),
  crypto = require("crypto").webcrypto;
const root = path.resolve(__dirname, ".."),
  scope = { window: {}, crypto };
for (const file of [
  "data/sample-cards.js",
  "data/sample-card-details.js",
  "scripts/discover-core.js",
  "scripts/binder-schema.js",
  "scripts/editor-state.js",
  "scripts/binder-media.js",
  "scripts/binder-store.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", file), "utf8"),
    scope,
  );
const cards = scope.window.CARDS,
  core = scope.window.DiscoverCatalogue;
assert.equal(cards.length, 55);
assert.equal(new Set(cards.map((c) => c.id)).size, 55);
assert.equal(new Set(cards.map((c) => c.setId)).size, 6);
const before = JSON.stringify(cards);
assert(
  core
    .search(cards, { q: "Bulbasaur" })
    .every((c) => c.name.toLowerCase().includes("bulbasaur")),
);
assert(core.search(cards, { set: "bw1" }).every((c) => c.setId === "bw1"));
assert(core.search(cards, { q: "#1" }).some((c) => c.setId === "bw1"));
assert.equal(core.search(cards, { q: "not a real pokemon" }).length, 0);
assert(
  core
    .search(cards, { type: "Grass", rarity: "Common" })
    .every((c) => c.pokemonTypes.includes("Grass") && c.rarity === "Common"),
);
assert(
  core.search(cards, { finish: "reverse" }).every((c) => c.variants.reverse),
);
const ranked = core.search(cards, { colorEnabled: true, color: "#7eac91" });
for (let i = 1; i < ranked.length; i++)
  assert(
    core.distance("#7eac91", ranked[i - 1].palette) <=
      core.distance("#7eac91", ranked[i].palette),
  );
assert.equal(
  JSON.stringify(cards),
  before,
  "Search must not mutate catalogue order",
);
const s = scope.window.BinderState.create({ rows: 1, columns: 1 });
const p = s.document.pages[0];
s.place(
  { kind: "catalogue", cardId: "bw1-1", variant: "normal" },
  p.id,
  p.regions[0].id,
);
const restored = scope.window.BinderStore.validate(s.document);
assert.equal(restored.pages[0].regions[0].content.cardId, "bw1-1");
assert.equal(restored.pages[0].regions[0].content.variant, "normal");
s.undo();
assert.equal(s.document.pages[0].regions[0].content, null);
console.log(
  "PASS: sample identities across sets, combined search/filters, curated color ranking, immutable catalogue, and cross-set binder finish persistence.",
);

const related = core.related(
  cards,
  cards.find((c) => c.id === "001"),
);
assert(related.some((c) => c.id === "166"));
assert(!related.some((c) => c.id === "001"));
assert.equal(
  core.related(
    cards,
    cards.find((c) => c.id === "185"),
  ).length,
  0,
);
assert(
  core
    .related(
      cards,
      cards.find((c) => c.id === "bw1-1"),
    )
    .some((c) => c.id === "bw1-2"),
);
console.log(
  "PASS: related printings exclude the current card, include alternate sample printings, and handle empty lists.",
);
