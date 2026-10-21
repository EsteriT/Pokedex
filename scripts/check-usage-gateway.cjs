const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
(async () => {
  const { timingFailure } = require("./check-usage-load.cjs");
  const budget = { p95Ms: 1000, maxMs: 5000 };
  assert.equal(timingFailure({ p95Ms: 1000, maxMs: 5000 }, budget), "");
  assert.match(timingFailure({ p95Ms: 1001, maxMs: 1001 }, budget), /p95Ms/);
  assert.match(timingFailure({ p95Ms: 100, maxMs: 5001 }, budget), /maxMs/);
  assert.equal(
    timingFailure({ p95Ms: 9000, maxMs: 9000 }, { maxMs: 15000 }),
    "",
  );
  const { createGateway, route } = await import(
    "../supabase/functions/usage-gateway/gateway.mjs"
  );
  const config = {
    url: "https://project.supabase.co",
    publicKey: "server-anon-key",
    secret: "a".repeat(64),
    origins: ["http://localhost:5500"],
  };
  const path = "/rest/v1/rpc/commit_collection";
  const input = (p = path, method = "POST", body = "{}", headers = {}) =>
    new Request("https://edge.test/functions/v1/usage-gateway" + p, {
      method,
      headers: {
        origin: config.origins[0],
        ...(!["GET", "HEAD", "OPTIONS"].includes(method)
          ? { "Content-Length": String(Buffer.byteLength(body)) }
          : {}),
        ...headers,
      },
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? { body } : {}),
    });
  let calls = [],
    allowed = true,
    fail = false;
  const handle = createGateway(config, async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/admit_usage"))
      return Response.json({ allowed, retry_after: 7 });
    return Response.json(
      fail ? { message: "Invalid collection." } : { ok: true },
      { status: fail ? 400 : 200 },
    );
  });
  let response = await handle(
    input(path, "POST", "{}", {
      Authorization: "Bearer abc.def.ghi",
      "x-pokedex-gateway": "forged",
      "content-profile": "binder_private",
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(
    JSON.parse(calls[0].init.body).byte_cost,
    2 + 1024,
    "Small saves reserve measured input bytes plus bounded output, not 18 MiB.",
  );
  assert.equal(
    calls[0].init.headers.get("authorization"),
    "Bearer abc.def.ghi",
  );
  assert.equal(calls[1].init.headers.get("x-pokedex-gateway"), config.secret);
  assert.equal(calls[1].init.headers.get("content-profile"), "public");
  assert.equal(calls[1].init.headers.get("apikey"), config.publicKey);
  assert(!JSON.stringify([...response.headers]).includes(config.secret));
  allowed = false;
  calls = [];
  response = await handle(input());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "7");
  assert.equal(calls.length, 1, "Rejected requests never reach expensive work");
  assert.match((await response.json()).message, /unsaved/);
  allowed = true;
  fail = true;
  calls = [];
  assert.equal((await handle(input())).status, 400);
  assert(
    calls[0].url.endsWith("/admit_usage"),
    "Admission occurs before invalid downstream work",
  );
  calls = [];
  for (const p of [
    "/rest/v1/rpc/admit_usage",
    "/graphql/v1",
    "/storage/v1/object/sign/binder-artwork/x",
    "/rest/v1/rpc/unknown",
  ])
    assert.equal((await handle(input(p))).status, 404);
  assert.equal(calls.length, 0);
  assert.equal(
    (await handle(input(path, "POST", "{}", { origin: "https://evil.test" })))
      .status,
    403,
  );
  assert.equal(
    (await createGateway({ ...config, secret: "" })(input())).status,
    503,
  );
  assert(route("/rest/v1/binders", "HEAD"));
  assert(!route("/rest/v1/binders", "PATCH"));
  const preflight = await handle(input(path, "OPTIONS"));
  assert.equal(preflight.status, 204);
  assert(
    preflight.headers
      .get("access-control-allow-headers")
      .includes("x-pokedex-body-bytes"),
  );
  const file =
    "/storage/v1/object/binder-artwork/" +
    "a".repeat(36) +
    "/" +
    "b".repeat(64) +
    ".png";
  assert(route(file, "GET"));
  assert(route(file, "POST"));
  assert(!route(file, "PUT"));
  calls = [];
  assert.equal(
    (
      await handle(
        input("/rest/v1/rpc/report_account_failure", "POST", "x".repeat(1025)),
      )
    ).status,
    413,
  );
  assert.equal(
    calls.length,
    1,
    "Oversized bodies consume an attempt but are not forwarded",
  );
  assert.equal(
    JSON.parse(calls[0].init.body).byte_cost,
    2048,
    "Invalid uploads still spend the maximum input/output reservation.",
  );
  calls = [];
  assert.equal(
    (
      await handle(
        input(path, "POST", '{"note":"界"}', { "Content-Length": "1" }),
      )
    ).status,
    413,
  );
  assert.equal(
    calls.length,
    1,
    "An understated size cannot reach the main operation.",
  );
  calls = [];
  await handle(input(path, "POST", '{"note":"界"}'));
  assert.equal(
    JSON.parse(calls[0].init.body).byte_cost,
    Buffer.byteLength('{"note":"界"}') + 1024,
  );
  calls = [];
  const unknownSize = input(path);
  unknownSize.headers.delete("content-length");
  await handle(unknownSize);
  assert.equal(
    JSON.parse(calls[0].init.body).byte_cost,
    18 * 1024 * 1024 + 1024,
    "Unknown-length bodies keep the conservative maximum.",
  );
  allowed = false;
  let buffered = false;
  const denied = input(path);
  await handle({
    url: denied.url,
    headers: denied.headers,
    method: denied.method,
    body: {
      getReader() {
        buffered = true;
        throw Error("Do not buffer denied uploads.");
      },
    },
  });
  assert.equal(
    buffered,
    false,
    "Admission rejects unauthorized/excess work before reading private uploads.",
  );
  allowed = true;
  const interrupted = createGateway(config, async () => {
    throw Error("private upstream diagnostics");
  });
  response = await interrupted(input());
  assert.equal(response.status, 503);
  assert(!(await response.text()).includes("diagnostics"));
  let safetyCalls = 0;
  const reply = (makeReply) =>
    createGateway(config, async (url) =>
      url.endsWith("/admit_usage")
        ? Response.json({ allowed: true })
        : makeReply(),
    );
  response = await reply(
    () => new Response("decoded body", { headers: { "Content-Length": "1" } }),
  )(input("/rest/v1/binders", "GET"));
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(await response.text(), "decoded body");
  response = await reply(
    () => new Response(null, { headers: { "Content-Length": "500000" } }),
  )(input(file, "HEAD"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  const batch = createGateway(config, async () => {
    safetyCalls++;
    return Response.json({ allowed: true });
  });
  assert.equal(
    (
      await batch(
        input(path, "POST", "{}", { Prefer: "params=multiple-objects" }),
      )
    ).status,
    400,
  );
  assert.equal(safetyCalls, 1, "Batch preference must not reach upstream");
  const forwarded = [];
  const scope = {
    window: { POKEDEX_BACKEND: { url: config.url, usageGateway: true } },
    URL,
    Request,
    Headers,
    Blob,
    ArrayBuffer,
    TextEncoder,
    fetch: async (...args) => {
      forwarded.push(args);
      return new Response();
    },
  };
  vm.runInNewContext(
    fs.readFileSync("src/scripts/backend-fetch.js", "utf8"),
    scope,
  );
  await scope.window.PokedexFetch(
    config.url + "/rest/v1/collections?select=*",
    { method: "GET" },
  );
  assert.equal(
    forwarded[0][0],
    config.url + "/functions/v1/usage-gateway/rest/v1/collections?select=*",
  );
  await scope.window.PokedexFetch(config.url + "/auth/v1/token", {
    method: "POST",
  });
  assert.equal(
    forwarded[1][0],
    config.url + "/auth/v1/token",
    "OAuth/session URL remains unchanged",
  );
  const original = new Request(config.url + "/rest/v1/rpc/commit_binders", {
    method: "POST",
    body: "{}",
    headers: { Authorization: "Bearer original-token" },
  });
  await scope.window.PokedexFetch(original);
  assert.equal(
    forwarded[2][0].headers.get("authorization"),
    "Bearer original-token",
  );
  assert.equal(await forwarded[2][0].text(), "{}");
  await scope.window.PokedexFetch(
    config.url + "/rest/v1/rpc/commit_collection",
    { method: "POST", body: '{"notes":"界"}' },
  );
  assert.equal(
    forwarded[3][1].headers.get("x-pokedex-body-bytes"),
    String(Buffer.byteLength('{"notes":"界"}')),
  );
  const error = await scope.window.PokedexFetch.error(
    new Response("{}", { status: 429, headers: { "Retry-After": "7" } }),
  );
  assert.match(error.message, /7 seconds/);
  // Startup throttling must show a wait, not silently replace live catalogue
  // results with samples. Retrying after the wait reinitializes metadata once.
  let now = 1000,
    requests = 0;
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  const startup = {
    window: {
      CARDS: [],
      POKEDEX_BACKEND: { url: config.url, publishableKey: "public" },
    },
    URL,
    Request,
    Headers,
    Blob,
    ArrayBuffer,
    TextEncoder,
    Response,
    AbortSignal,
    Date: Clock,
    fetch: async (url) => {
      requests++;
      if (requests === 1)
        return new Response("{}", {
          status: 429,
          headers: { "Retry-After": "1" },
        });
      return url.endsWith("/catalogue_info")
        ? Response.json({
            sets: [{ id: "set", preview: [] }],
            types: [],
            rarities: [],
          })
        : Response.json({ total: 0, cards: [] });
    },
  };
  for (const name of ["backend-fetch", "card-catalogue"])
    vm.runInNewContext(
      fs.readFileSync("src/scripts/" + name + ".js", "utf8"),
      startup,
    );
  await startup.window.CardCatalogue.ready;
  await assert.rejects(startup.window.CardCatalogue.search(), /1 seconds/);
  assert.equal(requests, 1);
  now += 1001;
  assert.equal((await startup.window.CardCatalogue.search()).total, 0);
  assert.equal(requests, 3);
  console.log(
    "PASS: allowlisted gateway routes, original JWT, independent admission, 429/retry, bounded bodies, private diagnostics, browser transport and Auth isolation.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
