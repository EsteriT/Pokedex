/* Actual PostgreSQL execution in PGlite. Full Auth/HTTP/Storage tests also need
   the local Docker stack; this suite does not claim to exercise those services. */
const { PGlite } = require("@electric-sql/pglite");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");
const { randomUUID, webcrypto } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const scope = { window: {}, crypto: webcrypto };
for (const file of [
  "data/sample-cards.js",
  "data/sample-card-details.js",
  "data/sample-collection.js",
  "scripts/binder-schema.js",
  "scripts/editor-state.js",
  "scripts/binder-store.js",
])
  vm.runInNewContext(
    fs.readFileSync(path.join(root, "src", file), "utf8"),
    scope,
  );
const document = () =>
  JSON.parse(
    JSON.stringify(
      scope.window.BinderState.create({
        name: "Test binder",
        rows: 2,
        columns: 2,
        cards: ["001"],
      }).document,
    ),
  );
const a = randomUUID(),
  b = randomUUID();

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now());
      create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated,anon;
      grant select,insert,delete,update on storage.objects to authenticated;`);
    await db.query("insert into auth.users values ($1),($2)", [a, b]);
    for (const file of fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(
        fs.readFileSync(path.join(root, "supabase/migrations", file), "utf8"),
      );
    const catalogue = await db.query(
      "select card_id,variants from binder_private.catalogue order by card_id",
    );
    const expectedCatalogue = JSON.parse(
      JSON.stringify(
        scope.window.CARDS.map((c) => ({
          card_id: c.id || c.collectorNumber,
          variants: c.variants || null,
        })),
      ),
    );
    expectedCatalogue.sort((a, b) =>
      a.card_id < b.card_id ? -1 : a.card_id > b.card_id ? 1 : 0,
    );
    assert.deepEqual(
      catalogue.rows,
      expectedCatalogue,
      "Catalogue changes need a matching database migration",
    );
    const as = async (uid, action, role = "authenticated") =>
      db.transaction(async (tx) => {
        await tx.exec("set local role " + role);
        await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [
          uid || "",
        ]);
        return action(tx);
      });
    const read = (uid) =>
      as(uid, (tx) =>
        tx.query("select * from public.binders order by position"),
      ).then((r) => r.rows);
    await require("./check-collection-backend.cjs")(
      db,
      as,
      a,
      b,
      scope.window.SAMPLE_COLLECTION,
    );
    const commit = (uid, expected, docs, role) =>
      as(
        uid,
        (tx) =>
          tx.query("select public.commit_binders($1::jsonb,$2::jsonb)", [
            JSON.stringify(expected),
            JSON.stringify(docs),
          ]),
        role,
      );
    const revisions = (rows) =>
      rows.map((r) => ({ id: r.id, revision: r.revision }));
    const wire = (rows) =>
      rows.map((r) => ({ id: r.id, document: r.document }));
    const id = randomUUID(),
      doc = document();
    assert.equal(
      (
        await db.query(
          "select binder_private.valid_document($1::jsonb) as valid",
          [JSON.stringify(doc)],
        )
      ).rows[0].valid,
      true,
    );
    await assert.rejects(
      commit(null, [], [{ id, document: doc }], "anon"),
      /permission denied/,
    );
    await assert.rejects(commit(null, [], [{ id, document: doc }]), /Sign in/);
    await commit(a, [], [{ id, document: doc }]);
    let rows = await read(a);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].revision, 1);
    assert.equal(
      (await read(b)).length,
      0,
      "Other account cannot read a binder",
    );
    await assert.rejects(commit(b, [], [{ id, document: doc }]), /unavailable/);
    await assert.rejects(
      as(a, (tx) => tx.query("update public.binders set owner_id=$1", [b])),
      /permission denied/,
    );
    await assert.rejects(
      as(a, (tx) => tx.query("delete from public.binders")),
      /permission denied/,
    );
    const stale = revisions(rows);
    const changed = structuredClone(doc);
    changed.name = "New version";
    await commit(a, stale, [{ id, document: changed }]);
    await assert.rejects(
      commit(a, stale, [{ id, document: doc }]),
      /changed on another device/,
    );
    rows = await read(a);
    assert.equal(rows[0].document.name, "New version");
    assert.equal(rows[0].revision, 2);
    const invalids = [
      null,
      {},
      { ...doc, pages: [] },
      { ...doc, pages: Array(31).fill(doc.pages[0]) },
      { ...doc, overflow: [null] },
      { ...doc, frames: { sleeve: "bad", toploader: "none" } },
      { ...doc, name: "\t\n" },
      { ...doc, name: "\u00a0\u2000\ufeff" },
      { ...doc, name: " ".repeat(61) + "Binder" },
    ];
    for (const alter of [
      (d) => (d.pages[0].regions[1].cells = [[0, 0]]),
      (d) => (d.pages[0].regions[0].cells = [[99, 0]]),
      (d) => d.pages[0].regions.pop(),
      (d) => (d.pages[0].regions[1].id = d.pages[0].id),
      (d) => (d.pages[0].regions[0].content.cardId = "outside-catalogue"),
      (d) => (d.pages[0].regions[0].content.cardId = 166),
      (d) =>
        (d.pages[0].regions[0].content = {
          id: "numeric-placeholder",
          kind: "placeholder",
          style: "outline",
          cardId: 166,
        }),
      (d) => (d.pages[0].regions[0].content.variant = "imaginary"),
      (d) => (d.pages[0].rows = 2.5),
      (d) => (d.pages[0].regions[0].cells = [[0.5, 0]]),
      (d) =>
        (d.pages[0].regions[0].content = {
          id: "art",
          kind: "artwork",
          src: "javascript:alert(1)",
        }),
    ]) {
      const d = structuredClone(doc);
      alter(d);
      invalids.push(d);
    }
    for (const invalid of invalids)
      await assert.rejects(
        commit(a, revisions(rows), [{ id, document: invalid }]),
        /Invalid binder/,
      );
    assert.equal(
      (await read(a))[0].revision,
      2,
      "Failed saves leave the previous document intact",
    );
    const disconnected = structuredClone(doc);
    disconnected.pages[0].regions = [
      {
        id: "r1",
        cells: [
          [0, 0],
          [1, 1],
        ],
        content: null,
      },
      { id: "r2", cells: [[0, 1]], content: null },
      { id: "r3", cells: [[1, 0]], content: null },
    ];
    await assert.rejects(
      commit(a, revisions(rows), [{ id, document: disconnected }]),
      /Invalid binder/,
    );
    const full = [
      ...wire(rows),
      { id: randomUUID(), document: document() },
      { id: randomUUID(), document: document() },
    ];
    await commit(a, revisions(rows), full);
    rows = await read(a);
    await assert.rejects(
      commit(a, revisions(rows), [
        ...wire(rows),
        { id: randomUUID(), document: document() },
      ]),
      /three binders/,
    );
    // Two clients start from the same revision snapshot: exactly one may commit.
    const expected = revisions(rows),
      next1 = wire(rows),
      next2 = wire(rows);
    next1[0].document.name = "Device one";
    next2[0].document.name = "Device two";
    const outcomes = await Promise.allSettled([
      commit(a, expected, next1),
      commit(a, expected, next2),
    ]);
    assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(outcomes.filter((r) => r.status === "rejected").length, 1);
    await commit(b, [], [{ id: randomUUID(), document: document() }]);
    rows = await read(a);
    await commit(a, revisions(rows), wire(rows).slice(1));
    assert.equal((await read(a)).length, 2);
    assert.equal((await read(b)).length, 1);
    const objectPath = a + "/" + "a".repeat(64) + ".png";
    const reserve = (uid, path) =>
      as(uid, (tx) =>
        tx.query("select public.reserve_binder_artwork($1)", [path]),
      );
    await assert.rejects(reserve(b, objectPath), /Invalid artwork path/);
    await reserve(a, objectPath);
    await assert.rejects(
      as(b, (tx) =>
        tx.query(
          "insert into storage.objects(bucket_id,name,metadata) values ('binder-artwork',$1,'{\"size\":100}')",
          [objectPath],
        ),
      ),
      /row-level security/,
    );
    await as(a, (tx) =>
      tx.query(
        "insert into storage.objects(bucket_id,name,metadata) values ('binder-artwork',$1,'{\"size\":100}')",
        [objectPath],
      ),
    );
    assert.equal(
      (await as(b, (tx) => tx.query("select * from storage.objects"))).rows
        .length,
      0,
    );
    const art = {
      id: "artwork",
      kind: "artwork",
      src: "storage:" + objectPath,
      name: "Test art",
      width: 1,
      height: 1,
      fit: "contain",
      zoom: 1,
      x: 50,
      y: 50,
    };
    rows = await read(a);
    const artworkDoc = structuredClone(rows[0].document);
    artworkDoc.pages[0].regions[0].content = art;
    const next = wire(rows);
    next[0].document = artworkDoc;
    await commit(a, revisions(rows), next);
    await db.query(
      "update binder_private.artwork set created_at=now()-interval '25 hours' where path=$1",
      [objectPath],
    );
    await reserve(a, objectPath);
    assert.equal(
      (
        await db.query(
          "select created_at > now()-interval '1 minute' as renewed from binder_private.artwork where path=$1",
          [objectPath],
        )
      ).rows[0].renewed,
      true,
      "Retrying an old reservation protects the fresh upload during its grace period",
    );
    await db.query(
      "update binder_private.artwork set created_at=now()-interval '25 hours' where path=$1",
      [objectPath],
    );
    assert.equal(
      (
        await as(a, (tx) =>
          tx.query("delete from storage.objects where name=$1 returning name", [
            objectPath,
          ]),
        )
      ).rows.length,
      0,
      "Referenced artwork cannot be deleted",
    );
    rows = await read(a);
    const badPath = wire(rows);
    badPath[0].document.pages[0].regions[0].content.src =
      "storage:" + b + "/" + "a".repeat(64) + ".png";
    await assert.rejects(commit(a, revisions(rows), badPath), /Invalid binder/);
    const inline = wire(rows);
    inline[0].document.pages[0].regions[0].content.src =
      "data:image/png;base64,AAAA";
    await assert.rejects(commit(a, revisions(rows), inline), /Invalid binder/);
    const without = wire(rows);
    without[0].document.pages[0].regions[0].content = null;
    await commit(a, revisions(rows), without);
    const cleanup = () =>
      as(a, (tx) =>
        tx.query("select public.cleanup_binder_artwork() as paths"),
      );
    assert.deepEqual((await cleanup()).rows[0].paths, [objectPath]);
    await as(a, (tx) =>
      tx.query("delete from storage.objects where name=$1", [objectPath]),
    );
    await cleanup();
    assert.equal(
      (
        await db.query("select * from binder_private.artwork where path=$1", [
          objectPath,
        ])
      ).rows.length,
      0,
    );
    for (let i = 0; i < 60; i++)
      await reserve(b, b + "/" + i.toString(16).padStart(64, "0") + ".png");
    await assert.rejects(
      reserve(b, b + "/" + "f".repeat(64) + ".png"),
      /storage is full/,
    );
    const privileges =
      await db.query(`select proname,prosecdef,proconfig from pg_proc
      where pronamespace='public'::regnamespace and proname='commit_binders'`);
    assert.equal(
      privileges.rows[0].prosecdef,
      false,
      "Exposed wrapper does not bypass RLS",
    );
    await require("./check-account-backend.cjs")(db, as, document);
    console.log(
      "Backend PostgreSQL checks passed: ownership, privileges, document validation, limits, stale saves, atomic rollback, independent accounts, Storage policies/reservations/cleanup.",
    );
    console.log(
      "Concurrent requests above are serialized by PGlite; real multi-connection lock contention still requires the Docker stack.",
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
