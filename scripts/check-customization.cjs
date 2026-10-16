const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  assert = require("assert"),
  crypto = require("crypto").webcrypto;
const root = path.resolve(__dirname, "..");
let raw = null;
const scope = {
  window: {},
  crypto,
  localStorage: {
    getItem() {
      return raw;
    },
    setItem(k, v) {
      raw = v;
    },
  },
};
for (const file of [
  "data/sample-cards.js",
  "data/sample-binders.js",
  "scripts/binder-schema.js",
  "scripts/editor-state.js",
  "scripts/binder-media.js",
  "scripts/binder-store.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", file), "utf8"),
    scope,
  );
const { create } = scope.window.BinderState,
  store = scope.window.BinderStore;
const src =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/i8cAAAAASUVORK5CYII=";
const artwork = {
  kind: "artwork",
  src,
  name: "Artwork",
  width: 1,
  height: 1,
  fit: "cover",
  zoom: 1,
  x: 50,
  y: 50,
};
const state = create({ rows: 2, columns: 2, cards: ["166", "167"] });
let p = state.document.pages[0],
  pid = p.id,
  ids = p.regions.map((r) => r.id);
state.setFrames({ sleeve: "great", toploader: "clear" }, "selection", pid, [
  ids[0],
]);
assert.equal(state.document.pages[0].regions[0].content.frames.sleeve, "great");
state.putContent(pid, ids[2], artwork);
const artid = state.document.pages[0].regions[2].content.id;
state.putContent(pid, ids[2], { ...artwork, zoom: 1.5, x: 30 });
assert.equal(state.document.pages[0].regions[2].content.id, artid);
assert.equal(state.document.overflow.length, 0);
state.putContent(pid, ids[0], {
  kind: "placeholder",
  style: "ball",
  cardId: "001",
});
assert.equal(state.document.overflow[0].cardId, "166");
assert.equal(state.document.overflow[0].frames.toploader, "clear");
state.undo();
assert.equal(state.document.pages[0].regions[0].content.cardId, "166");
state.redo();
assert.equal(state.document.pages[0].regions[0].content.kind, "placeholder");
state.setFrames({ sleeve: "master", toploader: "none" }, "binder");
assert.equal(state.document.frames.sleeve, "master");
assert.equal(state.document.overflow[0].frames, undefined);
state.setFrames({ sleeve: "poke", toploader: "premier" }, "page", pid);
assert.equal(
  state.document.pages[0].regions[1].content.frames.toploader,
  "premier",
);
assert.equal(state.document.pages[0].regions[2].content.frames, undefined);
const before = JSON.stringify(state.document);
for (const bad of [
  { ...artwork, src: "data:image/svg+xml;base64,AAAA" },
  { ...artwork, zoom: 9 },
  { kind: "placeholder", style: "bad" },
  { kind: "placeholder", style: "soft", cardId: "missing" },
])
  assert.throws(() => state.putContent(pid, ids[3], bad));
assert.equal(JSON.stringify(state.document), before);
const entry = store.save("sample-151", state.document, 0);
state.save();
assert(!state.dirty);
assert.equal(entry.cards.length, 1);
assert.equal(entry.cards[0], "167");
const saved = store.read()[0].document;
assert.equal(saved.frames.sleeve, "master");
assert.equal(saved.pages[0].regions[2].content.zoom, 1.5);
assert.equal(saved.pages[0].regions[0].content.kind, "placeholder");
const imported = store.validate({
  format: "pokedex-binder",
  document: JSON.parse(JSON.stringify(saved)),
});
assert.equal(imported.pages[0].regions[2].content.src, src);
for (const mutate of [
  (d) => (d.frames.sleeve = "invalid"),
  (d) => (d.pages[0].regions[2].content.src = "https://example.com/image.jpg"),
  (d) => (d.pages[0].regions[0].content.cardId = "missing"),
]) {
  const d = JSON.parse(JSON.stringify(saved));
  mutate(d);
  assert.throws(() => store.validate(d));
}
const p2 = state.addPage(1, 1);
state.place(
  { kind: "pocket", pageId: pid, regionId: ids[2] },
  p2,
  state.document.pages[1].regions[0].id,
);
assert.equal(state.document.pages[1].regions[0].content.id, artid);
state.deletePage(p2);
assert(state.document.overflow.some((c) => c.id === artid));
const legacy = create({ cards: ["166"] });
assert.equal(store.validate(legacy.document).frames, undefined);
console.log(
  "PASS: artwork/crop identity, placeholder replacement/Overflow/Undo, styling scopes, style preservation, explicit Save/import and legacy compatibility.",
);
