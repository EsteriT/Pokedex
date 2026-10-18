const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { readOnlyQuery } = require("./backup-supabase.cjs");
const { target, run } = require("./backup-automation.cjs");
const { decrypt, maxBytes } = require("./backup-crypto.cjs");
async function main() {
  const token = "sbp_fctest_only",
    query = "select 1 as value";
  assert.deepEqual(
    await readOnlyQuery(query, target, token, async (url, options) => {
      assert.equal(
        url,
        "https://api.supabase.com/v1/projects/" + target + "/database/query",
      );
      assert.equal(options.method, "POST");
      assert.equal(options.redirect, "error");
      assert.equal(options.headers.Authorization, "Bearer " + token);
      assert.deepEqual(JSON.parse(options.body), { query, read_only: true });
      assert(options.signal instanceof AbortSignal);
      return new Response('[{"value":1}]', { status: 201 });
    }),
    [{ value: 1 }],
  );
  for (const status of [401, 403, 429, 500, 503, 301]) {
    await assert.rejects(
      readOnlyQuery(
        query,
        target,
        token,
        async () =>
          new Response("private database response and credentials", { status }),
      ),
      (error) =>
        !error.message.includes("private database") &&
        error.code.startsWith("SUPABASE_HTTP_"),
    );
  }
  for (const text of ["private@example.test", "{}", "[null]", "[[1]]"])
    await assert.rejects(
      readOnlyQuery(query, target, token, async () => new Response(text)),
      /Invalid or oversized/,
    );
  await assert.rejects(
    readOnlyQuery(query, target, token, async () => {
      throw Error("private credential URL");
    }),
    (error) =>
      error.code === "SUPABASE_NETWORK" &&
      !error.message.includes("credential"),
  );
  let cancelled = false;
  await assert.rejects(
    readOnlyQuery(query, target, token, async () => ({
      ok: true,
      body: (async function* () {
        try {
          const chunk = Buffer.alloc(512 * 1024);
          for (let i = 0; i <= maxBytes / chunk.length; i++) yield chunk;
        } finally {
          cancelled = true;
        }
      })(),
    })),
    /Invalid or oversized/,
  );
  assert(cancelled, "Oversized response must cancel reading");
  await assert.rejects(
    readOnlyQuery(query, "../other", token),
    /explicit project/,
  );
  await assert.rejects(
    readOnlyQuery(query, target, "sbp_legacy"),
    /scoped Database Read/,
  );
  const signals = [];
  await assert.rejects(
    run({
      snapshot: async () => {
        throw Object.assign(Error("private database error"), {
          code: "SUPABASE_HTTP_403",
        });
      },
      store: { list: async () => ({ objects: [] }) },
      ping: async (signal) => signals.push(signal),
      passphrase: "unused-test-passphrase",
    }),
    (error) =>
      error.message.includes("SUPABASE_HTTP_403") &&
      !error.message.includes("private database"),
  );
  assert.deepEqual(signals, ["start", "fail"]);
  const saved = Object.fromEntries(
    [
      "POKEDEX_BACKUP_PASSPHRASE",
      "POKEDEX_BACKUP_URL",
      "POKEDEX_BACKUP_SECRET_KEY",
    ].map((n) => [n, process.env[n]]),
  );
  const runtime = path.resolve(__dirname, "../.scratch/runtime");
  fs.mkdirSync(runtime, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtime, "readonly-test-"));
  try {
    Object.assign(process.env, {
      POKEDEX_BACKUP_PASSPHRASE: "test-only-readonly-passphrase",
      POKEDEX_BACKUP_URL: "https://" + target + ".supabase.co",
      POKEDEX_BACKUP_SECRET_KEY: "sb_secret_test_only",
    });
    let calls = 0;
    const file = await require("./backend-ops.cjs").main(
      "backup",
      ["--hosted", target],
      {
        directory,
        quiet: true,
        query: async (sql, t) => {
          assert.equal(t.label, target);
          assert(sql.startsWith("select "));
          calls++;
          return calls === 1
            ? [{ controls: true, counters: true }]
            : [{ snapshot: { accounts: [], objects: [] } }];
        },
      },
    );
    assert.equal(
      calls,
      2,
      "Hosted automation queries must use the injected API, without a CLI connection preflight",
    );
    assert.equal(
      decrypt(fs.readFileSync(file), process.env.POKEDEX_BACKUP_PASSPHRASE)
        .target,
      target,
    );
    const originalFetch = global.fetch;
    try {
      let stopped = false;
      global.fetch = async (_url, options) => {
        assert.equal(
          options.redirect,
          "error",
          "Private artwork must not follow redirects",
        );
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(500001));
            },
            cancel() {
              stopped = true;
            },
          }),
          { headers: { "content-type": "image/png" } },
        );
      };
      let queries = 0;
      await assert.rejects(
        require("./backend-ops.cjs").main("backup", ["--hosted", target], {
          directory,
          quiet: true,
          query: async () =>
            ++queries === 1
              ? [{ controls: true, counters: true }]
              : [
                  {
                    snapshot: {
                      accounts: [],
                      objects: [
                        {
                          path:
                            "00000000-0000-0000-0000-000000000000/" +
                            "a".repeat(64) +
                            ".png",
                          size: 3,
                        },
                      ],
                    },
                  },
                ],
        }),
        /Artwork exceeds the 500 KB limit/,
      );
      assert(
        stopped,
        "Oversized artwork must cancel its stream before buffering the whole response",
      );
      assert.equal(
        fs.readdirSync(directory).length,
        1,
        "A failed download must not create an archive",
      );
    } finally {
      global.fetch = originalFetch;
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assert.equal(path.dirname(directory), runtime);
    fs.rmSync(directory, { recursive: true, force: true });
  }
  console.log(
    "PASS: direct read-only API, bounded/private responses, credential isolation, safe HTTP diagnostics and shared encrypted snapshot without privileged CLI preflight.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
