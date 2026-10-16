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
