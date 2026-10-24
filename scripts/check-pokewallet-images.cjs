const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

async function check(mode) {
  const written = new Map();
  let requests = 0;
  const secret = "pk_test_" + "a".repeat(32);
  const providerCard = { id: "pk_" + "b".repeat(64), card_info: { name: "Fixture", set_id: "1533", product_type: "card" }, tcgplayer: { url: "https://www.tcgplayer.com/product/123" } };
  const fixtures = {
    "image-card-coverage.json": { uncoveredCards: [{ id: "s-1", setId: "s", name: "Fixture" }] },
    "expanded-name-review.json": { groups: [{ setId: "s", providerGroupId: 1533 }] },
    "pokewallet-sets-eng.json": { data: [{ set_id: "1533", language: "eng" }] },
    "extended-printing-review.json": { cards: [{ id: "s-1", candidates: [{ productId: 123 }] }] },
  };
  const bulk = mode === "bulk";
  let providerRows = [providerCard];
  if (bulk) {
    const sources = Array.from({ length: 65 }, (_, i) => ({ id: `s-${i + 1}`, setId: "s", name: "Fixture" }));
    fixtures["image-card-coverage.json"].uncoveredCards = sources;
    fixtures["extended-printing-review.json"].cards = sources.map((card, i) => ({ id: card.id, candidates: [{ productId: 123 + i }] }));
    providerRows = sources.map((_, i) => ({ ...providerCard, id: "pk_" + String(i + 1).padStart(64, "0"), tcgplayer: { url: `https://www.tcgplayer.com/product/${123 + i}` } }));
    fixtures["pokewallet-image-pilot.json"] = { samples: [{ localId: "s-1", httpStatus: 404 }] };
    fixtures["pokewallet-image-check.json"] = { samples: [{ localId: "s-2", httpStatus: 200, localFile: "wallet-product-124.jpg" }] };
  }
  const fakeFs = {
    readFile: async file => {
      const value = fixtures[path.basename(file)];
      assert.ok(value, "unexpected file read");
      return JSON.stringify(value);
    },
    stat: async () => { throw Object.assign(Error("absent"), { code: "ENOENT" }); },
    writeFile: async (file, value) => written.set(path.basename(file), file.endsWith(".json") ? JSON.parse(value) : value),
  };
  const context = {
    __dirname, module: { exports: {} }, Buffer, URL, Date, AbortSignal,
    setTimeout: callback => callback(),
    process: { env: { POKEWALLET_API_KEY: secret } }, console: { log: () => {} },
    require: name => name === "node:fs/promises" ? fakeFs : require(name),
    fetch: async (url, options) => {
      requests++;
      assert.equal(options.headers["X-API-Key"], secret);
      assert.equal(options.redirect, "error");
      assert.ok(!url.includes(secret));
      if (mode === "rate-limit") return new Response("limited", { status: 429 });
      if (url.includes("/sets/")) return Response.json({
        success: true, set: { set_id: "1533", language: mode === "wrong-language" ? "jap" : "eng" },
        cards: mode === "duplicate" ? [providerCard, providerCard] : providerRows,
        pagination: { page: 1, total_pages: 1, total: mode === "duplicate" ? 2 : providerRows.length },
      }, { headers: mode === "allowance" ? { "X-RateLimit-Remaining-Hour": "0" } : {} });
      assert.match(url, /\/images\/pk_[a-f0-9]+\?size=high$/);
      if (bulk) assert.ok(!url.includes("pk_" + "1".padStart(64, "0")) && !url.includes("pk_" + "2".padStart(64, "0")), "Previously checked pictures must not be requested again");
      if (mode === "image-denied") return new Response("denied", { status: 403 });
      const bytes = Buffer.alloc(256); bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;
      return new Response(bytes, { headers: { "Content-Type": "image/jpeg" } });
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "catalogue-pokewallet-images.cjs"), "utf8"), context);
  const run = context.module.exports.main({ bulk });
  if (["rate-limit", "duplicate", "wrong-language"].includes(mode)) {
    await assert.rejects(run, mode === "rate-limit" ? /HTTP 429/ : mode === "duplicate" ? /repeated/ : /Unexpected English/);
    assert.equal(requests, 1);
    assert.equal(written.has("pokewallet-image-pilot.json"), false);
  } else if (bulk || mode === "allowance") {
    await run;
    const result = written.get(bulk ? "pokewallet-image-check.json" : "pokewallet-image-pilot.json");
    assert.equal(requests, bulk ? 60 : 1);
    assert.equal(result.newRequests, requests);
    assert.equal(result.samples.length, bulk ? 61 : 0);
    assert.equal(result.untestedCards, bulk ? 4 : 1);
    assert.match(result.stopped, /allowance/);
    assert.ok(!JSON.stringify([...written.values()]).includes(secret));
  } else {
    await run;
    const result = written.get("pokewallet-image-pilot.json");
    assert.equal(result.newRequests, 2);
    assert.equal(result.mappedLocalCards, 1);
    assert.equal(result.samples.length, 1);
    assert.equal(result.samples[0].httpStatus, mode === "image-denied" ? 403 : 200);
    assert.equal(Boolean(result.samples[0].localFile), mode !== "image-denied");
    assert.ok(!JSON.stringify([...written.values()]).includes(secret));
  }
}
(async () => {
  for (const mode of ["success", "image-denied", "rate-limit", "duplicate", "wrong-language", "bulk", "allowance"]) await check(mode);
  console.log("Pokewallet image fixtures passed: authenticated requests, exact products, language/duplicate denial, resume, request caps, no retry and no key in reports.");
})().catch(error => { console.error(error); process.exitCode = 1; });
