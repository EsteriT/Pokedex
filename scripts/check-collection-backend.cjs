const assert = require("node:assert/strict");
module.exports = async function checkCollection(db, as, a, b, sample) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const commit = (uid, revision, document, role) =>
    as(
      uid,
      (tx) =>
        tx.query("select public.commit_collection($1,$2::jsonb) as revision", [
          revision,
          JSON.stringify(document),
        ]),
      role,
    );
  const read = (uid) =>
    as(uid, (tx) => tx.query("select * from public.collections"));
  const original = clone(sample);
  assert.equal((await commit(a, null, original)).rows[0].revision, 1);
  assert.deepEqual((await read(a)).rows[0].document, original);
  assert.equal((await read(b)).rows.length, 0);
  await assert.rejects(
    commit(null, null, original, "anon"),
    /permission denied/,
  );
  await assert.rejects(commit(null, null, original), /Sign in/);
  for (const query of [
    "delete from public.collections",
    "update public.collections set revision=99",
    "insert into public.collections(owner_id,document) values (auth.uid(),'{}')",
  ])
    await assert.rejects(
      as(a, (tx) => tx.exec(query)),
      /permission denied/,
    );
  await assert.rejects(
    as(a, (tx) => tx.query("select binder_private.valid_collection('{}')")),
    /permission denied/,
  );
  const invalid = [
    null,
    {},
    { records: {} },
    { records: [null] },
    { ...original, extra: true },
  ];
  for (const [field, values] of Object.entries({
    id: [null, "", "<script>", 1],
    cardId: [null, "missing", 1],
    kind: [null, "other"],
    finish: [null, "holo", "missing"],
    quantity: [null, 0, -1, 1000, 1.5, "2"],
    condition: [null, "mint"],
    notes: [null, 9, "a".repeat(2001), "😀".repeat(1001)],
    grading: [
      { company: "Fake", grade: "9" },
      { company: "PSA", grade: "" },
      { company: "PSA", grade: "9 " },
      { company: "PSA", grade: "9\u00a0" },
      { company: "PSA", grade: "x".repeat(21) },
      false,
    ],
    chase: [null, "false", true],
    tradeStatus: [null, "other"],
  }))
    for (const value of values) {
      const doc = clone(original);
      doc.records[0][field] = value;
      invalid.push(doc);
    }
  const duplicate = clone(original);
  duplicate.records.push({ ...duplicate.records[0], id: "duplicate" });
  invalid.push(duplicate);
  const duplicateId = clone(original);
  duplicateId.records[1].id = duplicateId.records[0].id;
  invalid.push(duplicateId);
  const missing = clone(original);
  delete missing.records[0].grading;
  invalid.push(missing);
  const extra = clone(original);
  extra.records[0].owner_id = b;
  invalid.push(extra);
  for (const grade of ["9 ", "9\u00a0", "\uFEFF9", "😀".repeat(11)]) {
    const doc = clone(original);
    doc.records[3].grading.grade = grade;
    invalid.push(doc);
  }
  const tooMany = {
    records: Array.from({ length: 5001 }, (_, i) => ({
      ...original.records[0],
      id: "record-" + i,
    })),
  };
  invalid.push(tooMany);
  for (const doc of invalid)
    await assert.rejects(commit(a, 1, doc), /Invalid collection/);
  const maximum = {
    records: Array.from({ length: 5000 }, (_, i) => ({
      ...original.records[0],
      id: "group-" + i,
      condition: "unknown",
      grading: { company: "Other", grade: "Group " + i },
    })),
  };
  assert.equal(
    (
      await db.query(
        "select binder_private.valid_collection($1::jsonb) as valid",
        [JSON.stringify(maximum)],
      )
    ).rows[0].valid,
    true,
  );
  const oversize = clone(maximum);
  oversize.records.forEach((r) => (r.notes = "界".repeat(1200)));
  assert.equal(
    (
      await db.query(
        "select binder_private.valid_collection($1::jsonb) as valid",
        [JSON.stringify(oversize)],
      )
    ).rows[0].valid,
    false,
    "Cloud payload budget is enforced independently of group count",
  );
  assert.equal(
    (await read(a)).rows[0].revision,
    1,
    "Invalid Save must be atomic",
  );
  const unicode = clone(original);
  unicode.records[0].notes = "😀".repeat(1000);
  assert.equal((await commit(a, 1, unicode)).rows[0].revision, 2);
  await assert.rejects(commit(a, 1, original), /changed on another device/);
  await assert.rejects(commit(b, 2, original), /changed on another device/);
  assert.equal((await commit(b, null, { records: [] })).rows[0].revision, 1);
  assert.deepEqual((await read(b)).rows[0].document, { records: [] });
  assert.equal((await read(a)).rows[0].revision, 2);
  const wrapper = await db.query(
    "select prosecdef from pg_proc where oid='public.commit_collection(integer,jsonb)'::regprocedure",
  );
  assert.equal(wrapper.rows[0].prosecdef, false);
  console.log(
    "PASS: collection SQL ownership, direct-write denial, field validation, duplicate groups/IDs, UTF-16 limits, atomic rejection, revision conflicts and independent accounts.",
  );
};
