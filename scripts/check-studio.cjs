const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  assert = require("assert"),
  crypto = require("crypto").webcrypto;
const root = path.resolve(__dirname, ".."),
  scope = {
    window: {},
    crypto,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
  };
for (const f of [
  "data/sample-cards.js",
  "data/sample-binders.js",
  "scripts/binder-schema.js",
  "scripts/binder-media.js",
  "scripts/binder-store.js",
  "scripts/editor-state.js",
])
  vm.runInNewContext(fs.readFileSync(path.join(root, "src", f), "utf8"), scope);
const state = scope.window.BinderState.create({ cards: ["166", "001"] }),
  store = scope.window.BinderStore;
let p = state.document.pages[0];
state.setFrames({ sleeve: "poke", toploader: "clear" }, "selection", p.id, [
  p.regions[0].id,
]);
state.setFrames({ sleeve: "master", toploader: "ultra" }, "selection", p.id, [
  p.regions[1].id,
]);
state.applyFramePatch({ sleeve: "great" }, "page", p.id);
assert.equal(p.regions[0].content.frames.toploader, "clear");
assert.equal(p.regions[1].content.frames.toploader, "ultra");
state.undo();
p = state.document.pages[0];
assert.equal(p.regions[0].content.frames.sleeve, "poke");
state.applyFramePatch({ toploader: "premier" }, "binder");
p = state.document.pages[0];
assert.equal(p.regions[0].content.frames.sleeve, "poke");
assert.equal(p.regions[1].content.frames.sleeve, "master");
assert.equal(state.document.frames.toploader, "premier");
state.applyFramePatch(
  { sleeve: "ultra", toploader: "clear" },
  "selection",
  p.id,
  [p.regions[1].id],
);
assert.equal(p.regions[1].content.frames.sleeve, "ultra");
const image = {
  src: "data:image/webp;base64,AAAA",
  name: "Cover",
  width: 100,
  height: 150,
  fit: "cover",
  zoom: 1.4,
  x: 20,
  y: 50,
};
const title = {
  text: "My collection",
  visible: true,
  position: "center",
  align: "left",
  size: "large",
  color: "#ffffff",
};
state.setCoverDetails({ theme: "custom", artwork: image, title });
let validated = store.validate(state.document);
assert.equal(validated.cover.artwork.zoom, 1.4);
assert.equal(validated.cover.title.position, "center");
state.setCoverDetails({ theme: "master", title });
assert.equal(state.document.cover.artwork, undefined);
state.undo();
assert.equal(state.document.cover.theme, "custom");
for (const bad of [
  { theme: "custom", artwork: { ...image, src: "https://example.com" } },
  { theme: "custom", artwork: image, title: { ...title, color: "red" } },
  { theme: "custom", artwork: { ...image, zoom: 5 } },
]) {
  const before = JSON.stringify(state.document);
  assert.throws(() => state.setCoverDetails(bad));
  assert.equal(JSON.stringify(state.document), before);
}
p = state.document.pages[0];
state.merge(p.id, [p.regions[3].id, p.regions[4].id, p.regions[7].id]);
const beforePages = JSON.stringify(state.document.pages),
  original = state.document.pages[0],
  full = state.duplicatePage(original.id, true),
  fullPage = state.document.pages.find((p) => p.id === full);
assert.equal(fullPage.regions.length, original.regions.length);
assert.equal(
  fullPage.regions[0].content.cardId,
  original.regions[0].content.cardId,
);
assert.notEqual(fullPage.regions[0].content.id, original.regions[0].content.id);
store.validate(state.document);
state.undo();
assert.equal(JSON.stringify(state.document.pages), beforePages);
const empty = state.duplicatePage(state.document.pages[0].id, false);
assert(
  state.document.pages
    .find((p) => p.id === empty)
    .regions.every((r) => r.content === null),
);
store.validate(state.document);
const exported = {
  format: "pokedex-binder",
  document: JSON.parse(JSON.stringify(state.document)),
};
assert.equal(store.validate(exported).cover.title.text, "My collection");
while (state.document.pages.length < 30) state.addPage();
const beforeLimit = JSON.stringify(state.document);
assert.throws(
  () => state.duplicatePage(state.document.pages[0].id, true),
  /30/,
);
assert.equal(JSON.stringify(state.document), beforeLimit);
console.log(
  "PASS: independent style patches, custom cover/title validation and rollback, unique merged-page duplication, Undo and JSON round-trip.",
);

// Transparent is a saved cover choice and survives export/restore and history.
state.setCoverDetails({ theme: "transparent" });
assert.equal(state.document.cover.theme, "transparent");
const transparentRestored = store.validate(
  JSON.parse(JSON.stringify(state.document)),
);
assert.equal(transparentRestored.cover.theme, "transparent");
state.undo();
assert.notEqual(state.document.cover.theme, "transparent");
state.redo();
assert.equal(state.document.cover.theme, "transparent");
