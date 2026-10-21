/* Called by the loopback-only live harness, which owns accounts/config cleanup.
   Reports contain timings/counts only; never documents, identities or tokens. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { randomUUID, webcrypto, createHash } = require("node:crypto");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function together(jobs) {
  const results = await Promise.allSettled(jobs);
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((r) => r.value);
}
function summarize(samples) {
  const times = samples.map((x) => x.ms).sort((a, b) => a - b);
  const percentile = (p) =>
    Math.round(times[Math.max(0, Math.ceil(times.length * p) - 1)] || 0);
  const statuses = {};
  for (const x of samples) statuses[x.status] = (statuses[x.status] || 0) + 1;
  return {
    requests: samples.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: percentile(1),
    statuses,
    responseBytes: samples.reduce((sum, x) => sum + x.bytes, 0),
  };
}
const timingBudgets = {
  ordinary: { p95Ms: 1000, maxMs: 5000 },
  maximum: { maxMs: 15000 },
  lock: { maxMs: 5000 },
};
function timingFailure(stats, budget) {
  return Object.entries(budget)
    .filter(([metric, limit]) => stats[metric] > limit)
    .map(
      ([metric, limit]) => `${metric} ${stats[metric]} ms exceeds ${limit} ms`,
    )
    .join("; ");
}
module.exports = async ({ account, sql, url, publicKey, protectedFetch }) => {
  assert(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
  const scope = { window: {}, crypto: webcrypto };
  for (const file of [
    "data/sample-cards.js",
    "data/sample-card-details.js",
    "scripts/binder-schema.js",
    "scripts/editor-state.js",
  ])
    vm.runInNewContext(fs.readFileSync("src/" + file, "utf8"), scope);
  const binder = () =>
    JSON.parse(
      JSON.stringify(
        scope.window.BinderState.create({
          name: "Load acceptance",
          rows: 3,
          columns: 3,
          cards: ["001", "004", "007"],
        }).document,
      ),
    );
  const cards = JSON.parse(
    sql(
      "select json_agg(card_id order by card_id) from binder_private.catalogue",
    ),
  );
  assert(cards.length >= 834, "Import the ten trial sets before load checks.");
  const ordinaryCollection = (quantity) => ({
    records: cards.slice(0, 100).map((cardId, i) => ({
      id: "ordinary_" + i,
      kind: "owned",
      cardId,
      finish: "unknown",
      quantity,
      condition: "unknown",
      grading: null,
      notes: "Local load acceptance",
      chase: false,
      tradeStatus: "keep",
    })),
  });
  const people = [];
  for (let i = 0; i < (process.argv.includes("--large-only") ? 2 : 10); i++)
    people.push(await account());
  const policy = fs
    .readFileSync("supabase/config.toml", "utf8")
    .match(/\[edge_runtime\][\s\S]*?policy\s*=\s*"([^"]+)"/)[1];
  const report = {
    recordedAt: new Date().toISOString(),
    localOnly: true,
    runtime: "actual local Supabase Edge",
    workerPolicy: policy,
    users: people.length,
    ordinaryCollectionRecords: 100,
    timingBudgets,
    scope: process.argv.includes("--large-only") ? "large-only" : "full",
    completed: false,
    scenarios: [],
    failures: [],
  };
  const sourceHash = () =>
    createHash("sha256")
      .update(
        [
          "supabase/config.toml",
          "supabase/functions/usage-gateway/gateway.mjs",
          "supabase/functions/usage-gateway/index.ts",
          "supabase/functions/usage-gateway/deno.json",
          "supabase/migrations/20261020162450_collection_validation_batch.sql",
          "src/scripts/backend-fetch.js",
          "scripts/check-usage-live.cjs",
          "scripts/check-usage-load.cjs",
        ]
          .map((file) => fs.readFileSync(file, "utf8"))
          .join("\n"),
      )
      .digest("hex");
  report.sourceHash = sourceHash();
  const admissionStats = () =>
    JSON.parse(
      sql(
        "select json_build_object('calls',coalesce(sum(calls),0),'executionMs',coalesce(sum(total_exec_time),0)) from extensions.pg_stat_statements where query like '%admit_usage%' and query not like '%pg_stat_statements%'",
      ),
    );
  let samples = [],
    gateway = true;
  async function request(person, path, body, label, expected = [200]) {
    const start = performance.now();
    let response, text;
    try {
      response = await (gateway ? protectedFetch : fetch)(
        url + "/rest/v1/" + path,
        {
          method: body === undefined ? "GET" : "POST",
          headers: {
            apikey: publicKey,
            "Content-Type": "application/json",
            ...(person ? { Authorization: "Bearer " + person.token } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(30000),
        },
      );
      text = await response.text();
    } catch (error) {
      samples.push({
        label,
        ms: performance.now() - start,
        status: "transport-error",
        bytes: 0,
      });
      throw Error(label + " transport interrupted (" + error.name + ").");
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    samples.push({
      label,
      ms: performance.now() - start,
      status: response.status,
      bytes: Buffer.byteLength(text),
    });
    assert(
      expected.includes(response.status),
      label +
        " HTTP " +
        response.status +
        " (" +
        String(data?.code || "no code") +
        ")",
    );
    return {
      data,
      status: response.status,
      retry: Number(response.headers.get("retry-after")),
    };
  }
  const rpc = (p, name, body, expected) =>
    request(
      p,
      "rpc/" + name,
      body,
      name,
      expected ||
        (["commit_binders", "restore_account"].includes(name) ? [204] : [200]),
    );
  const readBinders = (p) =>
    request(p, "binders?select=*&order=position", undefined, "binder read");
  const readCollection = (p) =>
    request(
      p,
      "collections?select=revision,document",
      undefined,
      "collection read",
    );
  const expected = (rows) => rows.map(({ id, revision }) => ({ id, revision }));
  async function session(p, cycles, pause) {
    await rpc(null, "catalogue_info", {});
    for (let i = 0; i < cycles; i++) {
      const [saved, collection] = await together([
        readBinders(p),
        readCollection(p),
      ]);
      await rpc(null, "search_catalogue", {
        filters: { q: ["", "Bulbasaur", "Charizard", "151"][i % 4] },
        page_number: 1,
      });
      await rpc(null, "catalogue_cards", { ids: cards.slice(0, 100) });
      const document = saved.data[0]?.document || binder();
      document.name = "Load acceptance " + i;
      await rpc(p, "commit_binders", {
        expected: expected(saved.data),
        documents: [{ id: saved.data[0]?.id || randomUUID(), document }],
      });
      await readBinders(p); // BinderRepository refreshes after Save.
      await rpc(p, "commit_collection", {
        expected_revision: collection.data[0]?.revision ?? null,
        document: ordinaryCollection(i + 1),
      });
      if (pause && i + 1 < cycles) await delay(pause);
    }
    const snapshot = (await rpc(p, "account_snapshot", {})).data;
    assert.deepEqual(snapshot.collection.document, ordinaryCollection(cycles));
    await rpc(p, "restore_account", {
      expected: expected(snapshot.binders),
      documents: snapshot.binders.map(({ id, document }) => ({ id, document })),
      expected_collection: snapshot.collection?.revision ?? null,
      collection_document: snapshot.collection?.document || { records: [] },
    });
    assert.equal((await readBinders(p)).data.length, 1);
  }
  async function scenario(name, mode, run, budget = "ordinary") {
    gateway = mode === "gateway";
    sql("update binder_private.usage_gateway set enabled=" + gateway);
    // Controlled starting state between measurements; never reset mid-session.
    sql(
      "delete from binder_private.usage_buckets where actor='public' or owner_id in (" +
        people.map((p) => "'" + p.id + "'").join(",") +
        ")",
    );
    samples = [];
    const before = admissionStats();
    const start = performance.now();
    try {
      await run();
    } catch (error) {
      report.failures.push({ name, mode, message: error.message });
    }
    const row = {
      name,
      mode,
      timingBudget: budget,
      wallMs: Math.round(performance.now() - start),
      ...summarize(samples),
      operations: {},
    };
    const timingError = timingFailure(row, timingBudgets[budget]);
    if (timingError) report.failures.push({ name, mode, message: timingError });
    const after = admissionStats();
    row.admissionCalls = after.calls - before.calls;
    row.meanAdmissionDatabaseMs = row.admissionCalls
      ? Math.round(
          ((after.executionMs - before.executionMs) / row.admissionCalls) * 100,
        ) / 100
      : 0;
    for (const label of new Set(samples.map((s) => s.label)))
      row.operations[label] = summarize(
        samples.filter((s) => s.label === label),
      );
    report.scenarios.push(row);
    console.log(
      JSON.stringify({
        name,
        mode,
        requests: row.requests,
        p95Ms: row.p95Ms,
        statuses: row.statuses,
      }),
    );
  }
  try {
    if (!process.argv.includes("--large-only")) {
      for (const mode of ["direct", "gateway"]) {
        for (const count of [1, 5, 10])
          await scenario(
            count + " users: browse, four paired saves, backup/restore",
            mode,
            () =>
              together(
                people.slice(0, count).map(async (p, i) => {
                  await delay(i * 150);
                  await session(p, 4, 5000);
                }),
              ),
          );
      }
      await scenario(
        "Three tabs: browse together, then Save and backup",
        "gateway",
        async () => {
          const p = people[0];
          await together(
            Array.from({ length: 3 }, async () => {
              await together([readBinders(p), readCollection(p)]);
              await rpc(null, "search_catalogue", {
                filters: { q: "Pikachu" },
              });
            }),
          );
          await session(p, 1, 0);
          await rpc(p, "account_snapshot", {});
        },
      );
      // Full supported record count, with multibyte notes near the 16 MiB cap.
    }
    const large = {
      records: Array.from({ length: 5000 }, (_, i) => ({
        id: "load_" + i,
        kind: "owned",
        cardId: cards[Math.floor(i / 6)],
        finish: "unknown",
        quantity: 1,
        condition: ["unknown", "nm", "lp", "mp", "hp", "damaged"][i % 6],
        grading: null,
        notes: "界".repeat(850) + "a".repeat(350),
        chase: false,
        tradeStatus: "keep",
      })),
    };
    const fullBinder = binder();
    fullBinder.pages = Array.from({ length: 30 }, (_, page) => ({
      id: "page_" + page,
      rows: 6,
      columns: 6,
      regions: Array.from({ length: 36 }, (_, cell) => ({
        id: "region_" + page + "_" + cell,
        cells: [[Math.floor(cell / 6), cell % 6]],
        content: { id: "card_" + page + "_" + cell, cardId: "001" },
      })),
    }));
    fullBinder.overflow = Array.from({ length: 2000 }, (_, i) => ({
      id: "overflow_" + i,
      cardId: "001",
    }));
    report.largeFixture = {
      collectionRecords: 5000,
      collectionInputBytes: Buffer.byteLength(JSON.stringify(large)),
      binders: 3,
      pagesEach: 30,
      pocketsEachPage: 36,
      overflowEach: 2000,
    };
    for (const mode of ["direct", "gateway"])
      await scenario(
        "Maximum record/page counts: Save, read, account restore",
        mode,
        async () => {
          const p = people.at(-1);
          const old = (await readBinders(p)).data;
          await rpc(p, "commit_binders", {
            expected: expected(old),
            documents: Array.from({ length: 3 }, () => ({
              id: randomUUID(),
              document: fullBinder,
            })),
          });
          const collection = (await readCollection(p)).data[0];
          await rpc(p, "commit_collection", {
            expected_revision: collection?.revision ?? null,
            document: large,
          });
          const snapshot = (await rpc(p, "account_snapshot", {})).data;
          assert.equal(snapshot.collection.document.records.length, 5000);
          await rpc(p, "restore_account", {
            expected: expected(snapshot.binders),
            documents: snapshot.binders.map(({ id, document }) => ({
              id,
              document,
            })),
            expected_collection: snapshot.collection.revision,
            collection_document: snapshot.collection.document,
          });
          const reread = (await readCollection(p)).data[0];
          assert.equal(reread.document.records.length, 5000);
          assert.equal(
            reread.document.records[4999].notes,
            large.records[4999].notes,
          );
        },
        "maximum",
      );
    await scenario(
      "Same-account burst: limits reject excess and another account works",
      "gateway",
      async () => {
        const p = people[0];
        const replies = [];
        for (let wave = 0; wave < 4; wave++)
          replies.push(
            ...(await together(
              Array.from({ length: 12 }, () =>
                request(
                  p,
                  "binders?select=id",
                  undefined,
                  "burst read",
                  [200, 429],
                ),
              ),
            )),
          );
        assert(
          replies.some((r) => r.status === 429),
          "The conservative transfer budget must stop the burst.",
        );
        assert(
          replies
            .filter((r) => r.status === 429)
            .every((r) => r.retry >= 1 && r.retry <= 60),
        );
        await readBinders(people[1]);
      },
    );
    // Hold this disposable actor's admission lock longer than the 1s timeout.
    await scenario(
      "Admission lock timeout: fail closed, recover after release",
      "gateway",
      async () => {
        const cp = require("node:child_process"),
          p = people[0];
        const locker = cp.spawn(
          "docker",
          [
            "exec",
            "-i",
            "supabase_db_pokedex-local",
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-X",
            "-tA",
            "-v",
            "ON_ERROR_STOP=1",
          ],
          { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
        );
        const ended = new Promise((resolve) => locker.once("close", resolve));
        try {
          const ready = new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => reject(Error("Disposable lock holder not ready.")),
              5000,
            );
            locker.stdout.on("data", (data) => {
              if (data.toString().includes("LOCK_READY")) {
                clearTimeout(timer);
                resolve();
              }
            });
            locker.once("error", reject);
          });
          locker.stdin.end(
            "begin; select pg_advisory_xact_lock(hashtextextended('usage:" +
              p.id +
              "',0)); select 'LOCK_READY'; select pg_sleep(2.5); commit;\n",
          );
          await ready;
          const start = performance.now();
          await request(p, "binders?select=id", undefined, "held lock read", [
            503,
          ]);
          assert(
            performance.now() - start < 5000,
            "Lock failure must be bounded.",
          );
          assert.equal(await ended, 0);
          await readBinders(p);
        } finally {
          if (locker.exitCode === null) locker.kill();
        }
      },
      "lock",
    );
    report.completed = true;
  } finally {
    report.unchangedDuringRun = report.sourceHash === sourceHash();
    if (!report.unchangedDuringRun)
      report.failures.push({
        name: "Measurement integrity",
        message: "A measured source/config file changed during the run.",
      });
    report.acceptancePassed =
      report.scope === "full" &&
      report.completed &&
      report.failures.length === 0;
    sql("update binder_private.usage_gateway set enabled=true");
    fs.mkdirSync(".scratch/qa", { recursive: true });
    fs.writeFileSync(
      ".scratch/qa/usage-load-results.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    fs.copyFileSync(
      ".scratch/qa/usage-load-results.json",
      ".scratch/qa/usage-load-" +
        report.recordedAt.replace(/[:.]/g, "-") +
        ".json",
    );
  }
  assert.equal(
    report.failures.length,
    0,
    "Load acceptance failures: " +
      report.failures.map((f) => f.name + ": " + f.message).join("; "),
  );
  console.log(
    "PASS: requested local usage scenarios. Full acceptance requires an unchanged full run. Evidence: .scratch/qa/usage-load-results.json",
  );
};
module.exports.timingFailure = timingFailure;
