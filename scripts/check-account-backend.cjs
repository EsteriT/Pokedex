const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs"),
  path = require("node:path");
module.exports = async (db, as, document) => {
  const exposed = await db.query(`select proname,prosecdef,
    has_function_privilege('anon',oid,'EXECUTE') as anonymous,
    has_function_privilege('authenticated',oid,'EXECUTE') as authenticated
    from pg_proc where pronamespace='public'::regnamespace and proname in
    ('account_snapshot','begin_account_deletion','finish_account_deletion','restore_account','report_account_failure')`);
  assert.equal(exposed.rows.length, 5);
  assert(
    exposed.rows.every((f) => !f.prosecdef && !f.anonymous && f.authenticated),
    "Every exposed account function is an authenticated invoker wrapper",
  );
  const a = randomUUID(),
    b = randomUUID(),
    sid = randomUUID(),
    other = randomUUID();
  await db.query("insert into auth.users values ($1),($2)", [a, b]);
  await db.query(
    "insert into auth.sessions(id,user_id) values ($1,$2),($3,$4)",
    [sid, a, other, b],
  );
  const call = (uid, session, sql, params = []) =>
    as(uid, async (tx) => {
      await tx.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ session_id: session }),
      ]);
      return tx.query(sql, params);
    });
  const run = (sql, params) => call(a, sid, sql, params);
  const invalidName = document();
  invalidName.name = "\ud83d\ude00".repeat(31);
  const invalidTitle = document();
  invalidTitle.cover = {
    theme: "classic",
    title: {
      text: invalidName.name,
      visible: true,
      position: "bottom",
      align: "center",
      size: "medium",
      color: "#123456",
    },
  };
  for (const invalid of [invalidName, invalidTitle])
    await assert.rejects(
      run(
        "select public.restore_account('[]',$1,null,'{\"records\":[]}'::jsonb)",
        [JSON.stringify([{ id: randomUUID(), document: invalid }])],
      ),
      /Invalid binder/,
    );
  const imagePath = a + "/" + "c".repeat(64) + ".png";
  await run("select public.reserve_binder_artwork($1)", [imagePath]);
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values ('binder-artwork',$1,'{\"size\":500000}')",
    [imagePath],
  );
  const image = {
    src: "storage:" + imagePath,
    name: "Image",
    width: 1,
    height: 1,
    fit: "contain",
    zoom: 1,
    x: 50,
    y: 50,
  };
  const preflight = () =>
    db.query(
      fs.readFileSync(
        path.join(
          __dirname,
          "../supabase/diagnostics/portable-binder-preflight.sql",
        ),
        "utf8",
      ),
    );
  const legacyId = randomUUID(),
    legacy = structuredClone(invalidName);
  legacy.pages[0].regions[1].content = {
    id: randomUUID(),
    kind: "artwork",
    ...image,
  };
  await db.query(
    "insert into public.binders(id,owner_id,document,position) values ($1,$2,$3,0)",
    [legacyId, a, JSON.stringify(legacy)],
  );
  let diagnostics = (await preflight()).rows[0];
  assert.equal(Number(diagnostics.binders_with_oversized_text), 1);
  assert.equal(Number(diagnostics.binders_with_oversized_images), 1);
  await db.query("delete from storage.objects where name=$1", [imagePath]);
  assert.equal(
    Number((await preflight()).rows[0].binders_with_missing_images),
    1,
  );
  await db.query("delete from public.binders where id=$1", [legacyId]);
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata) values ('binder-artwork',$1,'{\"size\":500000}')",
    [imagePath],
  );
  const imageValid = async (value) =>
    (
      await as(
        a,
        (tx) =>
          tx.query("select binder_private.valid_image($1) as valid", [
            JSON.stringify(value),
          ]),
        "postgres",
      )
    ).rows[0].valid;
  assert.equal(
    await imageValid(image),
    false,
    "An image too large for a portable data URI cannot enter a binder",
  );
  await db.query(
    "update storage.objects set metadata='{\"size\":487482}' where name=$1",
    [imagePath],
  );
  assert.equal(
    await imageValid({ ...image, name: "\ud83d\ude00".repeat(50) }),
    true,
    "Boundary artwork bytes and UTF-16 name length remain valid",
  );
  assert.equal(
    await imageValid({ ...image, name: "\ud83d\ude00".repeat(51) }),
    false,
  );
  await db.query("delete from storage.objects where name=$1", [imagePath]);
  await db.query("delete from binder_private.artwork where path=$1", [
    imagePath,
  ]);
  await assert.rejects(
    call(a, other, "select public.account_snapshot()"),
    /Session ended/,
  );
  await assert.rejects(
    call(a, null, "select public.account_snapshot()"),
    /Session ended/,
  );
  await assert.rejects(
    as(a, (tx) => tx.query("select public.account_snapshot()"), "anon"),
    /permission denied/,
  );
  const validUnicode = document();
  validUnicode.name = "\ud83d\ude00".repeat(30);
  validUnicode.cover = {
    ...invalidTitle.cover,
    title: { ...invalidTitle.cover.title, text: validUnicode.name },
  };
  await run("select public.restore_account('[]',$1,null,'{\"records\":[]}')", [
    JSON.stringify([{ id: randomUUID(), document: validUnicode }]),
  ]);
  const snapshot = (await run("select public.account_snapshot() as value"))
    .rows[0].value;
  assert.equal(snapshot.binders.length, 1);
  assert.equal(snapshot.collection.revision, 1);
  const expected = snapshot.binders.map(({ id, revision }) => ({
    id,
    revision,
  }));
  await assert.rejects(
    run("select public.restore_account($1,'[]',99,'{\"records\":[]}')", [
      JSON.stringify(expected),
    ]),
    /changed|version/i,
  );
  assert.equal(
    (await run("select public.account_snapshot() as value")).rows[0].value
      .binders.length,
    1,
    "Collection conflict rolls back binder deletion",
  );
  await assert.rejects(
    run("select public.begin_account_deletion('delete')"),
    /Type DELETE/,
  );
  await db.query(
    "update auth.sessions set created_at=now()-interval '11 minutes' where id=$1",
    [sid],
  );
  await assert.rejects(
    run("select public.begin_account_deletion('DELETE')"),
    /Sign in again/,
  );
  await db.query("update auth.sessions set created_at=now() where id=$1", [
    sid,
  ]);
  const objectPath = a + "/" + "a".repeat(64) + ".png";
  await run("select public.reserve_binder_artwork($1)", [objectPath]);
  await run(
    "insert into storage.objects(bucket_id,name,metadata) values ('binder-artwork',$1,'{\"size\":4}')",
    [objectPath],
  );
  await run("select public.begin_account_deletion('DELETE')");
  await assert.rejects(
    run("select public.finish_account_deletion('DELETE')"),
    /Artwork removal is incomplete/,
  );
  await assert.rejects(
    run("select public.commit_collection(1,'{\"records\":[]}')"),
    /deletion is in progress/,
  );
  await assert.rejects(
    run("select public.commit_binders($1,'[]')", [JSON.stringify(expected)]),
    /deletion is in progress/,
  );
  await assert.rejects(
    run("select public.reserve_binder_artwork($1)", [
      a + "/" + "b".repeat(64) + ".png",
    ]),
    /deletion is in progress/,
  );
  await assert.rejects(
    run(
      "insert into storage.objects(bucket_id,name,metadata) values ('binder-artwork',$1,'{\"size\":4}')",
      [a + "/" + "b".repeat(64) + ".png"],
    ),
    /row-level security/,
  );
  assert.equal(
    (
      await call(
        b,
        other,
        "delete from storage.objects where name=$1 returning name",
        [objectPath],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await run("delete from storage.objects where name=$1 returning name", [
        objectPath,
      ])
    ).rows.length,
    1,
  );
  await run("select public.report_account_failure('conflict')");
  await run(
    "select public.report_account_failure('private text is not a category')",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int as count from binder_private.operation_counts where owner_id=$1",
        [a],
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(
    run("select * from binder_private.operation_counts"),
    /permission denied/,
  );
  await run("select public.finish_account_deletion('DELETE')");
  for (const table of [
    "auth.users",
    "auth.sessions",
    "public.binders",
    "public.collections",
    "binder_private.artwork",
    "binder_private.account_deletions",
    "binder_private.operation_counts",
  ]) {
    const column =
      table === "auth.users"
        ? "id"
        : table === "auth.sessions"
          ? "user_id"
          : "owner_id";
    assert.equal(
      (
        await db.query(
          `select count(*)::int as count from ${table} where ${column}=$1`,
          [a],
        )
      ).rows[0].count,
      0,
      table + " cascaded",
    );
  }
  await assert.rejects(
    run("select public.account_snapshot()"),
    /Session ended/,
  );
  await assert.rejects(
    run("select public.commit_collection(null,'{\"records\":[]}')"),
    /Account unavailable/,
  );
  assert.equal(
    (await call(b, other, "select public.account_snapshot() as value")).rows[0]
      .value.binders.length,
    0,
  );
  console.log(
    "PASS: account snapshot isolation, recent/live sessions, atomic restore conflicts, resumable deletion, write/upload lock, cascades and stale-token denial.",
  );
};
