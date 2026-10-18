const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
module.exports = async (a, b, admin, url, publicKey) => {
  const session = (await a.auth.getSession()).data.session,
    owner = session.user.id;
  const snapshot = await a.rpc("account_snapshot");
  assert(!snapshot.error, snapshot.error?.message);
  assert(snapshot.data.binders.length);
  const unicodeDoc = structuredClone(snapshot.data.binders[0].document);
  unicodeDoc.name = "\ud83d\ude00".repeat(31);
  const rejectedUnicode = await a.rpc("restore_account", {
    expected: snapshot.data.binders.map(({ id, revision }) => ({
      id,
      revision,
    })),
    documents: [{ id: snapshot.data.binders[0].id, document: unicodeDoc }],
    expected_collection: snapshot.data.collection?.revision ?? null,
    collection_document: snapshot.data.collection?.document || { records: [] },
  });
  assert.equal(
    rejectedUnicode.error?.code,
    "22023",
    "Direct API writes must not poison portable backups",
  );
  assert.deepEqual(
    (await a.rpc("account_snapshot")).data,
    snapshot.data,
    "Rejected restore keeps all saved snapshots intact",
  );
  const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
      "base64",
    ),
    path =
      owner + "/" + createHash("sha256").update(bytes).digest("hex") + ".png";
  assert(!(await a.rpc("reserve_binder_artwork", { object_path: path })).error);
  const uploaded = await a.storage
    .from("binder-artwork")
    .upload(path, bytes, { contentType: "image/png" });
  assert(!uploaded.error || String(uploaded.error.statusCode) === "409");
  await require("./check-ops-live.cjs")(a, url, publicKey);
  const begun = await a.rpc("begin_account_deletion", {
    confirmation: "DELETE",
  });
  assert(!begun.error, begun.error?.message);
  assert(begun.data.artwork.includes(path));
  assert.equal(
    (await a.rpc("finish_account_deletion", { confirmation: "DELETE" })).error
      ?.code,
    "55000",
  );
  const collection = await a
    .from("collections")
    .select("revision,document")
    .maybeSingle();
  assert.equal(
    (
      await a.rpc("commit_collection", {
        expected_revision: collection.data?.revision ?? null,
        document: collection.data?.document || { records: [] },
      })
    ).error?.code,
    "42501",
  );
  const rejected = await a.storage
    .from("binder-artwork")
    .upload(owner + "/" + "f".repeat(64) + ".png", bytes, {
      contentType: "image/png",
    });
  assert(rejected.error, "Pending deletion must block uploads");
  const outsider = await b.rpc("account_snapshot");
  assert(!outsider.error);
  assert(!outsider.data.artwork.includes(path));
  const denied = await b.storage.from("binder-artwork").remove([path]);
  assert(denied.error || !denied.data.length);
  assert(!(await a.storage.from("binder-artwork").download(path)).error);
  const removed = await a.storage
    .from("binder-artwork")
    .remove(begun.data.artwork);
  assert(!removed.error, removed.error?.message);
  const done = await a.rpc("finish_account_deletion", {
    confirmation: "DELETE",
  });
  assert(!done.error, done.error?.message);
  const gone = await admin.auth.admin.getUserById(owner);
  assert(
    gone.error &&
      (gone.error.status === 404 || gone.error.code === "user_not_found"),
  );
  const headers = {
    apikey: publicKey,
    Authorization: "Bearer " + session.access_token,
    "Content-Type": "application/json",
  };
  const stale = await fetch(url + "/rest/v1/rpc/account_snapshot", {
    method: "POST",
    headers,
    body: "{}",
  });
  assert(!stale.ok, "A deleted user's unexpired token must not export data");
  const read = await fetch(url + "/rest/v1/binders?select=id", { headers });
  if (read.ok) assert.deepEqual(await read.json(), []);
  const write = await fetch(url + "/rest/v1/rpc/commit_collection", {
    method: "POST",
    headers,
    body: JSON.stringify({
      expected_revision: null,
      document: { records: [] },
    }),
  });
  assert(!write.ok, "Deleted account must not be resurrected by a stale token");
  console.log(
    "PASS: real Auth/Storage deletion, partial-removal retry, pending write/upload denial, other-account isolation and stale JWT protection.",
  );
  return owner;
};
