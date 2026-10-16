const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  assert = require("assert"),
  crypto = require("crypto").webcrypto;
const root = path.resolve(__dirname, "..");
let raw = null,
  fail = false,
  writes = [];
const scope = {
  window: {},
  crypto,
  localStorage: {
    getItem() {
      return raw;
    },
    setItem(key, value) {
      if (fail) throw Error("Quota");
      writes.push(key);
      raw = value;
    },
  },
};
for (const file of [
  "data/sample-cards.js",
  "data/sample-card-details.js",
  "data/sample-collection.js",
  "scripts/collection-state.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", file), "utf8"),
    scope,
  );
const { create, validate } = scope.window.CollectionState,
  store = scope.window.CollectionStore;
const s = create(scope.window.SAMPLE_COLLECTION),
  before = JSON.stringify(s.document);
assert.equal(s.document.records.length, 6);
assert.equal(s.dirty, false);
const owned = {
  kind: "owned",
  cardId: "001",
  finish: "normal",
  quantity: 1,
  condition: "nm",
  grading: null,
  notes: "Extra copy.",
  chase: false,
  tradeStatus: "keep",
};
assert(s.upsert(owned));
assert.equal(
  s.document.records.find((r) => r.id === "sample-owned-001").quantity,
  3,
);
assert.equal(raw, null, "Editing must not automatically save");
s.undo();
assert.equal(JSON.stringify(s.document), before);
s.redo();
assert(s.dirty);
const stable = JSON.stringify(s.document);
assert.throws(() => s.upsert({ ...owned, quantity: 0 }));
assert.throws(
  () => s.upsert({ ...owned, tradeStatus: "trade" }),
  /different trade status/,
);
assert.equal(JSON.stringify(s.document), stable);
s.upsert({ ...owned, condition: "lp" });
assert.equal(
  s.document.records.filter((r) => r.cardId === "001" && r.kind === "owned")
    .length,
  2,
);
s.upsert({ ...owned, kind: "wanted", condition: "unknown", chase: true });
assert(s.document.records.find((r) => r.id === "sample-wanted-001").chase);
assert(
  s.document.records.some((r) => r.cardId === "001" && r.kind === "owned"),
);
s.upsert({
  ...owned,
  grading: { company: "CGC", grade: "9.5" },
  condition: "unknown",
});
assert(s.document.records.some((r) => r.grading?.company === "CGC"));
const wanted = s.document.records.find((r) => r.id === "sample-wanted-205");
s.remove(wanted.id);
assert(!s.document.records.some((r) => r.id === wanted.id));
s.undo();
assert(s.document.records.some((r) => r.id === wanted.id));
let revision = store.save(s.document, null);
s.save();
assert.equal(s.dirty, false);
assert.equal(store.read().revision, revision);
assert.deepEqual(
  JSON.stringify(store.read().document),
  JSON.stringify(s.document),
);
assert.throws(() => store.save(s.document, null), /another tab/);
fail = true;
const stored = raw;
assert.throws(() => store.save(s.document, revision), /failed/);
assert.equal(raw, stored);
fail = false;
assert(
  writes.every((k) => k === "pokedex.collection.v1"),
  "Inventory must never write binder storage",
);
const imported = validate({
  format: "pokedex-collection",
  version: 1,
  document: { records: [] },
});
s.replace(imported);
assert.equal(s.document.records.length, 0);
s.undo();
assert(s.document.records.length > 0);
const invalid = JSON.parse(before);
invalid.records[0].cardId = "unknown";
assert.throws(() => validate(invalid));
const duplicate = JSON.parse(before);
duplicate.records.push({ ...duplicate.records[0], id: "new-duplicate" });
assert.throws(() => validate(duplicate), /Duplicate/);
raw = "bad JSON";
assert.throws(() => store.read(), /not been overwritten/);
assert.equal(raw, "bad JSON");
console.log(
  "PASS: collection grouping, quantities, grades, Wanted/chase independence, rollback/Undo, explicit Save/reload, conflicts/quota, validated import and binder-storage isolation.",
);

for (const invalidRevision of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  raw = JSON.stringify({
    version: 1,
    revision: invalidRevision,
    document: { records: [] },
  });
  assert.throws(() => store.read(), /could not be read/);
}
console.log(
  "PASS: invalid collection revision values are rejected without overwriting storage.",
);

const backupRecords = Array.from({ length: 1100 }, (_, i) => ({
  ...owned,
  id: "backup-" + i,
  grading: { company: "Other", grade: "Group " + i },
  notes: "x".repeat(1900),
  chase: false,
  tradeStatus: "keep",
}));
const backupText = JSON.stringify(
  {
    format: "pokedex-collection",
    version: 1,
    document: { records: backupRecords },
  },
  null,
  2,
);
const backupBytes = require("buffer").Buffer.byteLength(backupText);
assert(backupBytes > 2 * 1024 * 1024);
assert(backupBytes <= scope.window.CollectionState.limits.importBytes);
const restoredBackup = validate(JSON.parse(backupText));
assert.equal(restoredBackup.records.length, 1100);
assert(restoredBackup.records.every((r) => r.notes.length === 1900));
assert.throws(() =>
  validate({ records: [{ ...backupRecords[0], notes: "x".repeat(2001) }] }),
);
assert.throws(() => validate({ records: Array(5001).fill(backupRecords[0]) }));
console.log(
  "PASS: large collection backups round-trip within bounded import limits; note and record limits remain enforced.",
);
