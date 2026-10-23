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
const state = scope.window.BinderState.create({ cards: ["166"] }),
  store = scope.window.BinderStore;
const before = JSON.stringify(state.document.pages);
state.setCover("master");
assert.equal(state.document.cover.theme, "master");
assert(state.dirty);
assert.equal(JSON.stringify(state.document.pages), before);
state.undo();
assert.equal(state.document.cover, undefined);
state.redo();
assert.equal(state.document.cover.theme, "master");
assert.throws(() => state.setCover("invalid"), /theme/);
assert.equal(state.document.cover.theme, "master");
const entry = store.save("sample-151", state.document, 0);
state.save();
assert(!state.dirty);
assert.equal(store.read()[0].document.cover.theme, "master");
const valid = store.validate({
  format: "pokedex-binder",
  document: JSON.parse(JSON.stringify(entry.document)),
});
assert.equal(valid.cover.theme, "master");
const legacy = JSON.parse(JSON.stringify(valid));
delete legacy.cover;
assert.equal(store.validate(legacy).cover, undefined);
for (const cover of [null, {}, { theme: "invalid" }])
  assert.throws(() => store.validate({ ...legacy, cover }), /cover/);
const loaded = scope.window.BinderState.create();
loaded.load(valid);
assert.equal(loaded.document.cover.theme, "master");
loaded.rename("Renamed");
assert.equal(loaded.document.cover.theme, "master");
console.log(
  "PASS: undoable cover changes, page preservation, validated JSON/legacy compatibility and explicit cover Save/reload.",
);

const design = { theme: "poke", subtitle: "Personal collection",
  pageStyle: { background: "#243b32", pockets: "defined" },
  title: { text: "My design", visible: true, position: "top", align: "left",
    size: "small", color: "#ffffff" } };
const pageSnapshot = JSON.stringify(loaded.document.pages);
loaded.setCoverDetails(design);
assert.equal(loaded.document.cover.subtitle, design.subtitle);
assert.equal(loaded.document.cover.pageStyle.background, "#243b32");
assert.equal(JSON.stringify(loaded.document.pages), pageSnapshot);
const roundTrip = store.validate(JSON.parse(JSON.stringify(loaded.document)));
assert.equal(JSON.stringify(roundTrip.cover), JSON.stringify(design));
loaded.undo();
assert.equal(loaded.document.cover.theme, "master");
loaded.redo();
assert.equal(loaded.document.cover.pageStyle.pockets, "defined");
for (const bad of [
  { ...design, subtitle: "x".repeat(61) },
  { ...design, pageStyle: { background: "url(https://example.com)", pockets: "none" } },
  { ...design, pageStyle: { background: "#ffffff", pockets: "unknown" } },
]) {
  assert.throws(() => loaded.setCoverDetails(bad));
  assert.equal(JSON.stringify(loaded.document.cover), JSON.stringify(design));
}
assert.equal(store.validate({ ...roundTrip, cover: { theme: "classic" } }).cover.subtitle, undefined);
console.log("PASS: optional subtitle/page appearance survive backup round trips and Undo/Redo; invalid designs roll back without changing cards.");

const scoped = scope.window.BinderState.create();
const firstPage = scoped.document.pages[0].id;
const secondPage = scoped.addPage(3, 3);
const green = { background: "#224433", pockets: "subtle" };
const blue = { background: "#2233aa", pockets: "defined" };
scoped.setCoverDetails({ theme: "classic" }, { pages: [[firstPage, green]] });
assert.equal(scoped.document.pages[0].pageStyle.background, green.background);
assert.equal(scoped.document.pages[1].pageStyle, undefined);
assert.equal(store.validate(scoped.document).pages[0].pageStyle.background, green.background);
scoped.setCoverDetails({ theme: "classic" }, { all: blue, pages: [] });
assert.equal(scoped.document.cover.pageStyle.background, blue.background);
assert(scoped.document.pages.every(p => p.pageStyle === undefined));
scoped.undo();
assert.equal(scoped.document.pages[0].pageStyle.background, green.background);
scoped.redo();
scoped.addPage(3, 3);
assert.equal(scoped.document.pages[2].pageStyle, undefined);
assert.equal(scoped.document.cover.pageStyle.background, blue.background);
const safe = JSON.stringify(scoped.document);
assert.throws(() => scoped.setCoverDetails({ theme: "classic" }, { pages: [[firstPage, { background: "invalid", pockets: "none" }]] }));
assert.equal(JSON.stringify(scoped.document), safe);
console.log("PASS: individual/all-page styles, backup preservation, default inheritance, atomic rollback and Undo/Redo.");
