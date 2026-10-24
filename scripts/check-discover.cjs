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
const modeCards = [
  { ...cards[0], name:'Dragon Test',collectorNumber:'025',setName:'Water Grass',illustrator:'Test Artist',pokemonTypes:['Dragon','Fighting'],category:'Pokemon',variants:{normal:true} },
  { ...cards[1], name:'Water Test',collectorNumber:'026',setName:'Dragon Test',illustrator:'Second Artist',pokemonTypes:['Water','Grass'],category:'Trainer',variants:{holo:true} },
];
assert.equal(core.search(modeCards,{type:['Dragon','Fighting'],typeMatch:'all'}).length,1);
assert.equal(core.search(modeCards,{type:['Dragon','Water'],typeMatch:'all'}).length,0);
assert.equal(core.search(modeCards,{type:['Dragon','Water'],typeMatch:'any'}).length,2);
assert.equal(core.search(modeCards,{category:['Pokemon','Trainer'],finish:['normal','holo'],illustrator:['Test Artist','Second Artist']}).length,2);
assert.equal(core.search(modeCards,{q:'Dragon Test',qScope:'name'})[0].name,'Dragon Test');
assert.equal(core.search(modeCards,{q:'Dragon Test',qScope:'set'})[0].name,'Water Test');
assert.equal(core.search(modeCards,{q:'#25',qScope:'number'})[0].collectorNumber,'025');
assert.equal(core.search(modeCards,{q:'Test Artist',qScope:'name'}).length,0);
assert.equal(core.search(modeCards,{q:'Test Artist',qScope:'illustrator'}).length,1);
const advanced = core.search(cards,{type:['Fire','Water'],rarity:['Common','Ultra Rare']});
assert(advanced.length > 0);
assert(advanced.every(c=>c.pokemonTypes.some(t=>['Fire','Water'].includes(t))&&['Common','Ultra Rare'].includes(c.rarity)));
assert(core.search(cards,{set:['bw1','xy1']}).every(c=>['bw1','xy1'].includes(c.setId)));
assert(core.search(cards,{hpMin:100,hpMax:200}).every(c=>c.hp>=100&&c.hp<=200));
const artist = cards.find(c=>c.illustrator);
assert(core.search(cards,{q:artist.illustrator}).some(c=>c.id===artist.id));
for (const sort of ['hp','hp-desc']) {
  const ordered = core.search(cards,{sort}).filter(c=>c.hp!=null);
  for(let i=1;i<ordered.length;i++) assert(sort==='hp' ? ordered[i-1].hp<=ordered[i].hp : ordered[i-1].hp>=ordered[i].hp);
}
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
