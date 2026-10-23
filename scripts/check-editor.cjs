const fs = require("fs"),
  path = require("path"),
  vm = require("vm"),
  assert = require("assert"),
  crypto = require("crypto").webcrypto;
const root = path.resolve(__dirname, "..");
let raw = null,
  fail = false;
const scope = {
  window: {},
  crypto,
  localStorage: {
    getItem() {
      return raw;
    },
    setItem(k, v) {
      if (fail) throw Error("Quota");
      raw = v;
    },
  },
};
for (const file of [
  "data/sample-cards.js",
  "data/sample-binders.js",
  "scripts/binder-schema.js",
  "scripts/editor-state.js",
  "scripts/binder-store.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", file), "utf8"),
    scope,
  );
const { create } = scope.window.BinderState,
  store = scope.window.BinderStore;
let state = create({ rows: 1, columns: 1, cards: ["166", "167", "168"] });
assert.equal(
  state.document.overflow.length,
  2,
  "Starting cards must not disappear",
);
const initial = JSON.stringify(state.document);
let record = store.save("sample-151", state.document, 0);
assert.equal(record.revision, 1);
assert.equal(store.read()[0].document.overflow.length, 2);
assert.throws(
  () => store.save("sample-151", state.document, 0),
  /another tab/,
  "Stale saves must not overwrite",
);
state.rename("Saved name");
record = store.save("sample-151", state.document, 1);
assert.equal(store.read()[0].name, "Saved name");
assert.equal(store.read()[0].document.name, "Saved name");
fail = true;
const before = raw;
assert.throws(() => store.save("sample-151", state.document, 2), /failed/);
assert.equal(raw, before);
fail = false;
const loaded = create();
loaded.load(record.document);
assert.equal(loaded.dirty, false);
assert.equal(loaded.canUndo, false);
loaded.replace(JSON.parse(initial));
assert.equal(loaded.dirty, true);
loaded.undo();
assert.equal(loaded.document.name, "Saved name");
let p = loaded.document.pages[0];
const next = loaded.addPage(2, 2);
const source = p.regions[0];
loaded.place(
  { kind: "pocket", pageId: p.id, regionId: source.id },
  next,
  loaded.document.pages[1].regions[0].id,
);
assert.equal(source.content, null);
assert.equal(loaded.document.pages[1].regions[0].content.cardId, "166");
loaded.undo();
assert.equal(loaded.document.pages[0].regions[0].content.cardId, "166");
state = create({ rows: 3, columns: 3, cards: ["166", "167"] });
p = state.document.pages[0];
assert.equal(state.mergeReason(p.id, [p.regions[0].id, p.regions[1].id]), "");
assert.match(
  state.mergeReason(p.id, [p.regions[0].id, p.regions[8].id]),
  /connect/,
);
state.merge(p.id, [p.regions[0].id, p.regions[1].id]);
assert.equal(state.document.overflow.length, 2);
store.validate(state.document);
const valid = JSON.parse(JSON.stringify(state.document));
for (const breakFile of [
  (doc) => (doc.pages[0].rows = 7),
  (doc) => doc.pages[0].regions[0].cells.push([0, 0]),
  (doc) => doc.pages[0].regions.pop(),
  (doc) => (doc.overflow[0].cardId = "unknown"),
  (doc) => (doc.pages[0].regions[0].id = doc.pages[0].id),
]) {
  const doc = JSON.parse(JSON.stringify(valid));
  breakFile(doc);
  assert.throws(() => store.validate(doc));
}
assert.equal(
  JSON.stringify(store.validate({ format: "pokedex-binder", document: valid })),
  JSON.stringify(valid),
);
store.save("third", valid, null);
assert.throws(() => store.save("fourth", valid, null), /three/);
raw = "{invalid";
assert.throws(() => store.read(), /not been overwritten/);
assert.equal(raw, "{invalid");
console.log(
  "PASS: overflow preservation, explicit local saves/reload, Workspace metadata, conflict/quota protection, import validation/Undo, cross-page movement and merge connectivity.",
);

// Corrupt imports produce useful validation errors, never raw property errors.
for (const [mutate, message] of [
  [
    (doc) => {
      doc.pages = [null];
    },
    /Invalid page layout/,
  ],
  [
    (doc) => {
      doc.pages[0].regions = [null];
    },
    /Invalid pocket region/,
  ],
]) {
  const doc = JSON.parse(initial);
  mutate(doc);
  assert.throws(() => store.validate(doc), message);
}
const connected = scope.window.BinderSchema.connected;
assert.equal(connected([]), false);
assert.equal(
  connected([
    [0, 0],
    [0, 1],
    [1, 0],
  ]),
  true,
);
assert.equal(
  connected([
    [0, 0],
    [1, 1],
  ]),
  false,
);
const originalRaw = raw;
const metadataFixture = JSON.stringify({
  version: 1,
  binders: scope.window.SAMPLE_BINDERS.map((b) => ({ ...b, revision: 0 })),
});
for (const patch of [
  { pages: 1000000 },
  { rows: 0 },
  { revision: -1 },
  { cards: ["unknown-printing"] },
]) {
  raw = metadataFixture;
  const binders = store.read();
  Object.assign(binders[0], patch);
  raw = JSON.stringify({ version: 1, binders });
  assert.throws(() => store.read(), /could not be read/);
  raw = originalRaw;
}
console.log(
  "PASS: malformed page/region imports report validation errors; bounded metadata and shared pocket connectivity reject invalid records.",
);

const largeBinder = create({ rows: 6, columns: 6, pages: 30 }).document;
let backupId = 0;
for (const page of largeBinder.pages)
  for (const region of page.regions) {
    region.content = {
      id: ("content-" + backupId++).padEnd(80, "x"),
      cardId: "166",
    };
  }
largeBinder.overflow = Array.from({ length: 2000 }, (_, i) => ({
  id: ("overflow-" + i).padEnd(80, "x"),
  cardId: "167",
}));
const backupArtwork = {
  kind: "artwork",
  src: "data:image/png;base64," + "A".repeat(590000),
  name: "Backup fixture",
  width: 1,
  height: 1,
  fit: "cover",
  zoom: 1,
  x: 50,
  y: 50,
};
for (let i = 0; i < 3; i++)
  largeBinder.pages[0].regions[i].content = {
    ...backupArtwork,
    id: "large-art-" + i,
  };
const binderBackupText = JSON.stringify(store.validate(largeBinder), null, 2);
assert(require("buffer").Buffer.byteLength(binderBackupText) > 2 * 1024 * 1024);
assert(
  require("buffer").Buffer.byteLength(binderBackupText) <=
    scope.window.BinderSchema.limits.importBytes,
);
assert.equal(
  store.validate(JSON.parse(binderBackupText)).overflow.length,
  2000,
);
console.log(
  "PASS: large valid binder metadata/artwork backups fit the bounded import allowance.",
);

const beforeInvalidId = raw;
for (const badId of ["bad id", "", null, "x".repeat(81)]) {
  assert.throws(() => store.save(badId, state.document, null), /identifier/);
  assert.equal(
    raw,
    beforeInvalidId,
    "An invalid URL identifier must never poison saved binders",
  );
}
const fullOverflow = create({ rows: 1, columns: 1, cards: ["166"] });
const fullDocument = JSON.parse(JSON.stringify(fullOverflow.document));
fullDocument.overflow = Array.from(
  { length: scope.window.BinderSchema.limits.overflowItems },
  (_, i) => ({ id: "full-overflow-" + i, cardId: "167" }),
);
fullOverflow.load(store.validate(fullDocument));
const fullPage = fullOverflow.document.pages[0],
  fullRegion = fullPage.regions[0],
  fullBefore = JSON.stringify(fullOverflow.document);
assert.throws(
  () => fullOverflow.toOverflow(fullPage.id, [fullRegion.id]),
  /Overflow is full/,
);
assert.throws(
  () =>
    fullOverflow.place(
      { kind: "catalogue", cardId: "168" },
      fullPage.id,
      fullRegion.id,
    ),
  /Overflow is full/,
);
assert.equal(
  JSON.stringify(fullOverflow.document),
  fullBefore,
  "A full tray must roll back movement and replacement together",
);
assert.equal(
  fullOverflow.canUndo,
  false,
  "Rejected edits must not create history",
);
fullOverflow.place(
  { kind: "overflow", id: "full-overflow-0" },
  fullPage.id,
  fullRegion.id,
);
assert.equal(
  fullOverflow.document.overflow.length,
  2000,
  "Swapping from a full tray must remain possible",
);
assert.equal(fullOverflow.document.pages[0].regions[0].content.cardId, "167");
assert.doesNotThrow(() => store.validate(fullOverflow.document));
const disconnected = create({ rows: 3, columns: 3 });
const disconnectedPage = disconnected.document.pages[0];
assert.throws(
  () =>
    disconnected.merge(disconnectedPage.id, [
      disconnectedPage.regions[0].id,
      disconnectedPage.regions[8].id,
    ]),
  /connect/,
);
assert.equal(disconnected.canUndo, false);
console.log(
  "PASS: invalid save identifiers preserve storage; full Overflow rolls back rejected edits while allowing tray swaps; merge validation shares connectivity rules.",
);

// Directional insertion must stop at gaps and remain one atomic, undoable edit.
(() => {
  const source = { kind: "catalogue", cardId: "198", variant: "holo" };
  for (const direction of [1, -1]) {
    for (const gap of [false, true]) {
      const s = create({
        rows: 2,
        columns: 3,
        pages: 2,
        cards: ["166", "167", "168", "169"],
      });
      const p = s.document.pages[0];
      if (gap) p.regions[1].content = null;
      p.regions[direction === 1 ? 0 : 2].content.frames = {
        sleeve: "master",
        toploader: "clear",
      };
      s.load(s.document);
      const before = JSON.stringify(s.document),
        otherRow = JSON.stringify(s.document.pages[0].regions[3]);
      const rid = p.regions[direction === 1 ? 0 : 2].id;
      const preview = s.insertionPreview(p.id, rid, direction);
      assert.equal(preview.regions.length, gap ? 2 : 3);
      assert.equal(preview.overflow, !gap);
      assert.equal(
        JSON.stringify(s.document),
        before,
        "Preview must not mutate the document/history",
      );
      s.insert(source, p.id, rid, direction);
      const row = s.document.pages[0].regions
        .slice(0, 3)
        .map((r) => r.content?.cardId);
      assert.equal(
        JSON.stringify(row),
        JSON.stringify(
          direction === 1
            ? ["198", "166", gap ? "168" : "167"]
            : [gap ? "166" : "167", "168", "198"],
        ),
      );
      assert.equal(s.document.overflow.length, gap ? 0 : 1);
      if (!gap)
        assert.equal(
          s.document.overflow[0].cardId,
          direction === 1 ? "168" : "166",
        );
      assert.equal(
        s.document.pages[0].regions[1].content.frames.sleeve,
        "master",
      );
      assert.equal(
        s.document.pages[0].regions[direction === 1 ? 0 : 2].content.variant,
        "holo",
      );
      assert.equal(JSON.stringify(s.document.pages[0].regions[3]), otherRow);
      assert.doesNotThrow(() => store.validate(s.document));
      const result = JSON.stringify(s.document);
      s.undo();
      assert.equal(JSON.stringify(s.document), before);
      assert.equal(s.canUndo, false);
      s.redo();
      assert.equal(JSON.stringify(s.document), result);
      s.load(s.save());
      assert.equal(s.dirty, false);
      assert.equal(JSON.stringify(s.document), result);
    }
  }
  const s = create({ rows: 1, columns: 3, cards: ["166", "167", "168"] }),
    p = s.document.pages[0];
  const unchanged = JSON.stringify(s.document);
  assert.throws(() => s.insert(source, p.id, p.regions[0].id, 0), /direction/);
  assert.throws(
    () => s.insert({ ...source, cardId: "missing" }, p.id, p.regions[0].id, 1),
    /Add cards/,
  );
  assert.equal(JSON.stringify(s.document), unchanged);
  assert.equal(s.canUndo, false);
  for (const kind of ["placeholder", "artwork"]) {
    s.document.pages[0].regions[1].content = { kind };
    const before = JSON.stringify(s.document);
    assert.throws(
      () => s.insert(source, p.id, p.regions[0].id, 1),
      /Push stops/,
    );
    assert.equal(JSON.stringify(s.document), before);
  }
  s.load(
    create({ rows: 1, columns: 3, cards: ["166", "167", "168"] }).document,
  );
  const full = s.document.pages[0];
  s.document.overflow = Array.from(
    { length: scope.window.BinderSchema.limits.overflowItems },
    (_, i) => ({ id: "full-" + i, cardId: "166" }),
  );
  const beforeFull = JSON.stringify(s.document);
  assert.throws(
    () => s.insert(source, full.id, full.regions[0].id, 1),
    /Overflow is full/,
  );
  assert.equal(JSON.stringify(s.document), beforeFull);
  assert.equal(s.canUndo, false);
  s.document.pages[0].regions[1].content = null;
  assert.doesNotThrow(
    () => s.insert(source, full.id, full.regions[0].id, 1),
    "A gap must work even when Overflow is full",
  );
  const merged = create({ rows: 1, columns: 3, cards: ["166"] });
  const mp = merged.document.pages[0];
  merged.merge(mp.id, [mp.regions[1].id, mp.regions[2].id]);
  const beforeMerge = JSON.stringify(merged.document);
  assert.throws(
    () =>
      merged.insert(
        source,
        mp.id,
        merged.document.pages[0].regions.at(-1).id,
        1,
      ),
    /Merged/,
  );
  assert.equal(JSON.stringify(merged.document), beforeMerge);
  assert.throws(
    () => merged.insert(source, mp.id, mp.regions[0].id, 1),
    /Push stops/,
  );
  assert.equal(JSON.stringify(merged.document), beforeMerge);
  const wide = create({
      rows: 1,
      columns: 6,
      cards: ["166", "167", "168", "169"],
    }),
    wp = wide.document.pages[0];
  wide.insert(source, wp.id, wp.regions[2].id, 1);
  assert.equal(
    JSON.stringify(
      wide.document.pages[0].regions.map((r) => r.content?.cardId || null),
    ),
    JSON.stringify(["166", "167", "198", "168", "169", null]),
  );
  const single = create({ rows: 1, columns: 1 }),
    sp = single.document.pages[0];
  single.insert(source, sp.id, sp.regions[0].id, -1);
  assert.equal(single.document.overflow.length, 0);
  assert.equal(single.document.pages[0].regions[0].content.cardId, "198");
  console.log(
    "PASS: left/right insertion, first-gap stopping, row isolation, style/finish preservation, single Undo/Redo, saved round trip, barriers and Overflow-full rollback.",
  );
})();

(() => {
  const s = create({ rows: 1, columns: 2, pages: 2, cards: ["166", "167"] }),
    p = s.document.pages[0],
    other = s.document.pages[1];
  p.regions[0].content.frames = { sleeve: "master", toploader: "clear" };
  const original = JSON.stringify(s.document),
    a = p.regions[0].id,
    b = p.regions[1].id;
  s.swap(p.id, a, p.id, b);
  assert.equal(s.document.pages[0].regions[1].content.frames.sleeve, "master");
  assert.equal(s.document.overflow.length, 0);
  s.undo();
  assert.equal(JSON.stringify(s.document), original);
  s.redo();
  assert.equal(s.document.pages[0].regions[0].content.cardId, "167");
  const beforeInvalid = JSON.stringify(s.document);
  assert.throws(
    () => s.swap(p.id, a, other.id, other.regions[0].id),
    /two cards/,
  );
  assert.equal(JSON.stringify(s.document), beforeInvalid);
  s.load(JSON.parse(original));
  const incoming = [
    { cardId: "198", frames: { sleeve: "poke", toploader: "clear" } },
    { cardId: "166", variant: "reverse" },
    { cardId: "168" },
  ];
  const source = JSON.stringify(incoming);
  s.addCards(incoming, p.id);
  assert.equal(
    JSON.stringify(incoming),
    source,
    "Copy must not change the source cards",
  );
  assert.equal(s.document.pages.length, 3);
  assert.equal(
    s.document.pages[0].regions[0].content.cardId,
    "166",
    "Batch insertion must preserve occupied pockets",
  );
  assert.equal(
    s.document.pages[1].regions[0].content.frames.toploader,
    "clear",
  );
  assert.equal(s.document.pages[1].regions[1].content.variant, "reverse");
  assert.equal(s.document.pages[2].regions[0].content.cardId, "168");
  assert.doesNotThrow(() => store.validate(s.document));
  s.undo();
  assert.equal(JSON.stringify(s.document), original);
  assert.equal(s.canUndo, false);
  s.redo();
  assert.equal(s.document.pages.length, 3);
  const before = JSON.stringify(s.document);
  assert.throws(() => s.addCards([{ cardId: "bad" }], p.id), /catalogue/);
  assert.equal(JSON.stringify(s.document), before);
  assert.throws(
    () =>
      s.addCards(
        [{ cardId: "166", frames: { sleeve: "bad", toploader: "none" } }],
        p.id,
      ),
    /styles/,
  );
  assert.equal(JSON.stringify(s.document), before);
  const capped = create({ rows: 1, columns: 1, pages: 30, cards: ["166"] });
  capped.addCards(
    [{ cardId: "167" }, { cardId: "168" }],
    capped.document.pages[29].id,
  );
  assert.equal(capped.document.pages.length, 30);
  assert.equal(capped.document.overflow.length, 1);
  capped.document.overflow = Array.from(
    { length: scope.window.BinderSchema.limits.overflowItems },
    (_, i) => ({ id: "cap-" + i, cardId: "166" }),
  );
  const full = JSON.stringify(capped.document);
  assert.throws(
    () => capped.addCards([{ cardId: "166" }], capped.document.pages[29].id),
    /Overflow|overflow/i,
  );
  assert.equal(JSON.stringify(capped.document), full);
  console.log(
    "PASS: explicit swaps and batch copies preserve styles/finishes, occupied pockets, unique IDs, source data, page/Overflow limits and atomic Undo/Redo.",
  );
})();

// Moving an existing card onto another card swaps whole contents as one edit.
for (const crossPage of [false, true]) {
  const moving = create({ rows: 1, columns: 2, cards: ["166", "167"] });
  const firstPage = moving.document.pages[0];
  let targetPage = firstPage;
  if (crossPage) {
    const pid = moving.addPage(1, 2);
    targetPage = moving.document.pages.find((p) => p.id === pid);
    moving.place(
      {
        kind: "pocket",
        pageId: firstPage.id,
        regionId: firstPage.regions[1].id,
      },
      pid,
      targetPage.regions[0].id,
    );
  }
  const origin = firstPage.regions[0],
    target = crossPage ? targetPage.regions[0] : firstPage.regions[1];
  origin.content.frames = { sleeve: "master", toploader: "clear" };
  target.content.variant = "holo";
  moving.document.overflow = Array.from({ length: 2000 }, (_, i) => ({
    id: "swap-tray-" + i,
    cardId: "001",
  }));
  const before = JSON.stringify(moving.document),
    a = JSON.stringify(origin.content),
    b = JSON.stringify(target.content);
  moving.place(
    { kind: "pocket", pageId: firstPage.id, regionId: origin.id },
    targetPage.id,
    target.id,
  );
  assert.equal(JSON.stringify(origin.content), b);
  assert.equal(JSON.stringify(target.content), a);
  assert.equal(moving.document.overflow.length, 2000);
  store.validate(moving.document);
  const after = JSON.stringify(moving.document);
  moving.undo();
  assert.equal(JSON.stringify(moving.document), before);
  moving.redo();
  assert.equal(JSON.stringify(moving.document), after);
  assert.equal(JSON.stringify(store.validate(JSON.parse(after))), after);
}
console.log(
  "PASS: placed-card drops swap intact contents on the same or another page, with full Overflow, atomic Undo/Redo and backup validation.",
);

const rectangularMerge = create({ rows: 3, columns: 3 });
const rectanglePage = rectangularMerge.document.pages[0];
const idsAt = indexes => indexes.map(i => rectanglePage.regions[i].id);
const beforeInvalidMerge = JSON.stringify(rectangularMerge.document);
assert.match(rectangularMerge.mergeReason(rectanglePage.id, idsAt([0, 1, 3])), /rectangle/);
assert.throws(() => rectangularMerge.merge(rectanglePage.id, idsAt([0, 1, 3])), /rectangle/);
assert.equal(JSON.stringify(rectangularMerge.document), beforeInvalidMerge);
assert.equal(rectangularMerge.canUndo, false);
for (const indexes of [[0, 1], [0, 3, 6], [0, 1, 3, 4], [0, 1, 2, 3, 4, 5]]) {
  assert.equal(rectangularMerge.mergeReason(rectanglePage.id, idsAt(indexes)), "");
  rectangularMerge.merge(rectanglePage.id, idsAt(indexes));
  rectangularMerge.undo();
}
console.log("PASS: strips/squares/rectangles merge; L-shapes reject atomically before content moves.");
