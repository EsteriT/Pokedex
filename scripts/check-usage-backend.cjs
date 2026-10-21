const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
module.exports = async (db, as) => {
  const a = randomUUID(),
    b = randomUUID(),
    secret = randomBytes(32).toString("hex");
  await db.query("insert into auth.users(id) values($1),($2)", [a, b]);
  await db.query(
    "update binder_private.usage_gateway set secret_digest=sha256(convert_to($1,'UTF8')),enabled=true",
    [secret],
  );
  const call = (uid, category, byteCost = 0, header = secret) =>
    as(
      uid,
      async (tx) => {
        await tx.query("select set_config('request.headers',$1,true)", [
          JSON.stringify({ "x-pokedex-gateway": header }),
        ]);
        return (
          await tx.query("select public.admit_usage($1,$2) result", [
            category,
            byteCost,
          ])
        ).rows[0].result;
      },
      uid ? "authenticated" : "anon",
    );
  await assert.rejects(call(a, "write", 0, "wrong"), /unavailable/);
  await assert.rejects(call(null, "write"), /Sign in/);
  await assert.rejects(call(a, "invented"), /Invalid usage/);
  await assert.rejects(call(a, "read", -1), /Invalid usage/);
  assert((await call(a, "write")).allowed);
  await db.query(
    "update binder_private.usage_buckets set tokens=0,updated_at=now()+interval '1 minute' where actor=$1 and bucket='write'",
    [a],
  );
  const limited = await call(a, "write");
  assert.equal(limited.allowed, false);
  assert(limited.retry_after >= 1 && limited.retry_after <= 60);
  assert(
    (await call(b, "write")).allowed,
    "Another account has its own budget",
  );
  assert(
    (await call(a, "deletion")).allowed,
    "Save exhaustion does not consume deletion attempts",
  );
  await assert.rejects(
    as(a, (tx) =>
      tx.query("select public.commit_collection(null,$1)", [
        JSON.stringify({ records: [null] }),
      ]),
    ),
    /Invalid collection/,
  );
  assert.equal(
    (await call(a, "write")).allowed,
    false,
    "A failed write did not restore admission tokens",
  );
  await db.query(
    "update binder_private.usage_buckets set tokens=0,updated_at=now()-interval '2 minutes' where actor=$1",
    [a],
  );
  assert((await call(a, "write")).allowed, "Tokens refill");
  await db.query(
    "update binder_private.usage_buckets set tokens=0,updated_at=now()+interval '1 minute' where actor=$1 and bucket='bytes'",
    [a],
  );
  assert.equal(
    (await call(a, "read", 1024)).allowed,
    false,
    "Transfer budget independent of request count",
  );
  assert((await call(null, "public")).allowed);
  const publicRows = await db.query(
    "select * from binder_private.usage_buckets where actor='public'",
  );
  assert.equal(
    publicRows.rows.length,
    2,
    "Anonymous traffic cannot grow an arbitrary identifier table",
  );
  await assert.rejects(
    as(a, (tx) => tx.query("select * from binder_private.usage_buckets")),
    /permission denied/,
  );
  await assert.rejects(
    as(a, (tx) => tx.query("select * from binder_private.usage_gateway")),
    /permission denied/,
  );
  await assert.rejects(
    as(a, (tx) => tx.query("select public.require_usage_gateway()")),
    /gateway/,
  );
  await as(a, async (tx) => {
    await tx.query("select set_config('request.headers',$1,true)", [
      JSON.stringify({ "x-pokedex-gateway": secret }),
    ]);
    await tx.query("select public.require_usage_gateway()");
  });
  await db.query("delete from auth.users where id=$1 or id=$2", [a, b]);
  assert.equal(
    (
      await db.query(
        "select * from binder_private.usage_buckets where actor=$1 or actor=$2",
        [a, b],
      )
    ).rows.length,
    0,
  );
  await db.query(
    "update binder_private.usage_gateway set enabled=false,secret_digest=null",
  );
  await db.query(
    "delete from binder_private.usage_buckets where actor='public'",
  );
  console.log(
    "PASS: private gateway admission, per-account budgets, transfer limits, refill, separate deletion budget, committed-attempt accounting and bounded private counters.",
  );
};
