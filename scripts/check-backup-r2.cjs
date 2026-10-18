const assert = require("node:assert/strict"),
  { Readable } = require("node:stream");
const { storeFor } = require("./backup-r2.cjs");
const { bucket, prefix } = require("./backup-automation.cjs");
async function main() {
  let response,
    failure,
    last,
    closed = false;
  const store = storeFor({
    async send(command, options) {
      assert.equal(command.input.Bucket, bucket);
      assert(options.abortSignal instanceof AbortSignal);
      last = command;
      if (failure) throw failure;
      return response;
    },
    destroy() {
      closed = true;
    },
  });
  const key = prefix + "test-only.pdxbackup",
    bytes = Buffer.from("encrypted test fixture");
  await store.put(key, bytes);
  assert.equal(last.constructor.name, "PutObjectCommand");
  assert.equal(last.input.StorageClass, "STANDARD");
  assert.equal(last.input.IfNoneMatch, "*");
  assert.equal(last.input.CacheControl, "no-store");
  assert.equal(last.input.Body, bytes);
  response = {
    ContentLength: bytes.length,
    Body: Readable.from([bytes.subarray(0, 3), bytes.subarray(3)]),
  };
  assert.deepEqual(await store.get(key, bytes.length), bytes);
  for (const [length, chunks] of [
    [1, [bytes]],
    [bytes.length, [bytes, bytes]],
    [bytes.length, [bytes.subarray(0, 1)]],
  ]) {
    response = { ContentLength: length, Body: Readable.from(chunks) };
    await assert.rejects(store.get(key, bytes.length), /size|exceeds/);
    assert(response.Body.destroyed);
  }
  response = {
    Contents: [{ Key: key, LastModified: new Date() }],
    IsTruncated: true,
    NextContinuationToken: "next",
  };
  assert.equal((await store.list(prefix)).cursor, "next");
  assert.equal(last.constructor.name, "ListObjectsV2Command");
  assert.equal(last.input.Prefix, prefix);
  assert.equal(last.input.MaxKeys, 1000);
  response = { IsTruncated: true };
  await assert.rejects(store.list(prefix, "next"), /cursor/);
  await store.remove(key);
  assert.equal(last.constructor.name, "DeleteObjectCommand");
  failure = { $metadata: { httpStatusCode: 404 } };
  assert.equal(await store.exists(key), false);
  failure = { $metadata: { httpStatusCode: 403 } };
  await assert.rejects(store.exists(key));
  failure = undefined;
  response = {};
  assert.equal(await store.exists(key), true);
  assert.throws(() => store.put("unrelated/key", bytes), /outside/);
  assert.throws(() => store.remove("unrelated/key"), /outside/);
  await assert.rejects(store.list("other/"), /outside/);
  store.close();
  assert(closed);
  console.log(
    "PASS: R2 SDK command scope, bounded downloads, private Standard uploads, pagination, expiry confirmation and connection cleanup.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
