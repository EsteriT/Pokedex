const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const { randomUUID, webcrypto } = require("node:crypto");
const scope = { window: {}, crypto: webcrypto, atob, Blob, structuredClone };
for (const name of [
  "data/sample-cards.js",
  "data/sample-card-details.js",
  "data/sample-collection.js",
  "scripts/binder-schema.js",
  "scripts/editor-state.js",
  "scripts/binder-store.js",
  "scripts/collection-state.js",
  "scripts/account-backup.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../src", name), "utf8"),
    scope,
  );
const model = scope.window.AccountBackup,
  owner = randomUUID(),
  pending = randomUUID();
const src =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";
const doc = scope.window.BinderState.create({
  name: "Portable artwork",
  rows: 2,
  columns: 2,
  cards: ["001"],
}).document;
doc.pages[0].regions[1].content = {
  id: randomUUID(),
  kind: "artwork",
  src,
  name: "Image",
  width: 1,
  height: 1,
  fit: "contain",
  zoom: 1,
  x: 50,
  y: 50,
};
const backup = {
  format: "pokedex-account",
  version: 1,
  binders: [doc],
  collection: scope.window.SAMPLE_COLLECTION,
  artwork: [src],
  access_token: "must not survive validation",
};
const validated = model.validate(backup);
assert(!JSON.stringify(validated).includes("must not survive"));
assert.throws(
  () => model.validate({ ...backup, version: 2 }),
  /not a supported/,
);
assert.throws(
  () => model.validate({ ...backup, artwork: Array(61).fill(src) }),
  /not a supported/,
);
assert.throws(
  () => model.image("data:image/svg+xml;base64,AAAA"),
  /Invalid backup artwork/,
);
const collection = {
  records: Array.from({ length: 5000 }, (_, i) => ({
    ...scope.window.SAMPLE_COLLECTION.records[0],
    id: "large_" + i,
    notes: "\ud83d\ude00".repeat(1000),
    grading: { company: "Other", grade: String(i) },
  })),
};
assert.throws(() => model.validate({ ...backup, collection }), /16 MB/);
const objectPath = owner + "/" + "a".repeat(64) + ".png",
  canonical = structuredClone(doc);
canonical.pages[0].regions[1].content.src = "storage:" + objectPath;
const archive = {
  format: "pokedex-service",
  version: 1,
  accounts: [
    {
      id: owner,
      email: "disposable@example.com",
      deleting: false,
      binders: [{ document: canonical }],
      collection: { document: backup.collection },
    },
    { id: pending, email: "pending@example.com", deleting: true, binders: [] },
  ],
  files: [{ path: objectPath, src }],
};
const { portable } = require("./backend-ops.cjs"),
  recovered = portable(archive);
assert.equal(
  recovered.length,
  1,
  "Pending deletion is never automatically restored",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(recovered[0].backup.binders[0])),
  JSON.parse(JSON.stringify(doc)),
);
assert.throws(() => portable({ ...archive, files: [] }), /missing artwork/);
assert.throws(
  () => portable({ ...archive, files: [{ path: "../outside", src }] }),
  /Invalid or duplicate/,
);
console.log(
  "PASS: portable account validation, collection byte budget, private-field exclusion, artwork recovery, missing-file rejection and pending-deletion exclusion.",
);
