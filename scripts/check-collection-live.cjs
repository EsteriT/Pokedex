const assert = require("node:assert/strict");
module.exports = async (a, b, sample) => {
  sample = JSON.parse(JSON.stringify(sample));
  const read = async (client) => {
    const r = await client
      .from("collections")
      .select("revision,document")
      .maybeSingle();
    if (r.error) throw r.error;
    return r.data;
  };
  const commit = (client, revision, document) =>
    client.rpc("commit_collection", { expected_revision: revision, document });
  const outcomes = await Promise.all([
    commit(a, null, sample),
    commit(a, null, { records: [] }),
  ]);
  assert.equal(
    outcomes.filter((r) => !r.error).length,
    1,
    "One simultaneous first Save wins",
  );
  assert.equal(outcomes.filter((r) => r.error?.code === "40001").length, 1);
  assert.equal((await read(a)).revision, 1);
  assert.equal(await read(b), null);
  assert.equal((await commit(a, 1, sample)).data, 2);
  assert.equal((await commit(a, 1, { records: [] })).error?.code, "40001");
  assert.equal((await commit(b, 2, sample)).error?.code, "40001");
  const owner = (await a.auth.getUser()).data.user.id;
  for (const operation of [
    a
      .from("collections")
      .update({ owner_id: "11111111-1111-4111-8111-111111111111" })
      .eq("owner_id", owner),
    a.from("collections").delete().eq("owner_id", owner),
  ])
    assert.equal((await operation).error?.code, "42501");
  const invalid = structuredClone(sample);
  invalid.records[0].quantity = 0;
  assert.equal((await commit(a, 2, invalid)).error?.code, "22023");
  assert.deepEqual((await read(a)).document, sample);
  assert.equal((await commit(b, null, { records: [] })).data, 1);
  assert.equal((await read(a)).revision, 2);
  console.log(
    "PASS: real local collection HTTP/RLS, simultaneous first saves, stale rejection, direct-write denial, validation rollback and separate accounts.",
  );
};
