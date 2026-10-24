const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { gaps, nameKey, setKey, numberKey, productCandidates, readJson } = require("./catalogue-coverage.cjs");
const { candidates: walletCandidates } = require("./catalogue-pokewallet-pilot.cjs");
const { productId, imageKind } = require("./catalogue-pokewallet-images.cjs");

(async () => {
  assert.equal(setKey("SWSH: Crown Zenith: Galarian Gallery"), setKey("Crown Zenith Galarian Gallery"));
  assert.equal(numberKey("SV001/SV122"), "SV1");
  assert.equal(numberKey("001/102"), "1");
  assert.equal(numberKey("050a/147"), "50A");
  assert.equal(numberKey("BW004"), "BW4");
  assert.notEqual(numberKey("50a"), numberKey("50b"));
  assert.equal(productId({ tcgplayer: { url: "https://www.tcgplayer.com/product/123/pokemon-card" } }), 123);
  assert.equal(productId({ tcgplayer: { url: "https://example.com/product/123" } }), null);
  assert.equal(productId({ tcgplayer: { url: "https://user@www.tcgplayer.com/product/123" } }), null);
  assert.equal(imageKind(Buffer.alloc(256)), null);
  const imageFixture = Buffer.alloc(256);
  imageFixture[0] = 0xff; imageFixture[1] = 0xd8; imageFixture[2] = 0xff;
  assert.equal(imageKind(imageFixture), "jpg");
  assert.notEqual(numberKey("SV001"), numberKey("001"));
  assert.notEqual(nameKey("Unown !"), nameKey("Unown ?"));
  const card = { collectorNumber: "001", name: "Pikachu" };
  const product = {
    productId: 7, name: "Pikachu",
    imageUrl: "https://tcgplayer-cdn.tcgplayer.com/product/7_200w.jpg",
    extendedData: [{ name: "Number", value: "1/102" }],
  };
  assert.equal(productCandidates(card, [product]).length, 1);
  assert.equal(productCandidates(card, [product, { ...product, productId: 8 }]).length, 2);
  for (const change of [
    { name: "Pikachu (Cosmos Holo)" }, { imageUrl: "https://example.com/card.jpg" },
    { imageUrl: "https://user@tcgplayer-cdn.tcgplayer.com/card.jpg" },
    { extendedData: [{ name: "Number", value: "2/102" }] }, { extendedData: [] },
  ]) assert.equal(productCandidates(card, [{ ...product, ...change }]).length, 0);
  const walletCard = { id: "provider-card", card_info: {
    name: "Pikachu", card_number: "1/102", set_id: "100", product_type: "card",
  } };
  assert.equal(walletCandidates(card, [walletCard], "100").length, 1);
  assert.equal(walletCandidates(card, [walletCard], "101").length, 0);
  assert.equal(walletCandidates(card, [{ ...walletCard, card_info: {
    ...walletCard.card_info, product_type: "sealed",
  } }], "100").length, 0);
  assert.equal(walletCandidates(card, [walletCard, { ...walletCard, id: "alternate-printing" }], "100").length, 2);
  const report = gaps({
    provider: "tcgdex", language: "en", fetchedAt: "fixture",
    sets: [{ id: "s", name: "Set", count: 2, logo: null }],
    cards: [{ ...card, id: "s-001", setId: "s", imageUrl: "" },
      { ...card, id: "s-002", setId: "s", imageUrl: "https://example.com/image" }],
    unavailableSets: [{ id: "absent", name: "Absent", expectedCount: 7 }],
    coverageGaps: [{ id: "s", name: "Set", availableCount: 2, expectedCount: 4 }],
  });
  assert.equal(report.summary.missingImageUrls, 1);
  assert.equal(report.summary.missingLogoUrls, 1);
  assert.equal(report.summary.missingRecords, 9);
  assert.equal(report.missingImages[0].id, "s-001");
  assert.throws(() => gaps({ provider: "other", language: "en", cards: [], sets: [] }));
  assert.deepEqual(await readJson(new Response('{"ok":true}')), { ok: true });
  await assert.rejects(readJson(new Response("limited", { status: 429 })), /HTTP 429/);
  await assert.rejects(readJson(new Response("x".repeat(16 * 1024 * 1024 + 1))), /16 MiB/);
  async function pilotFixture(failure) {
    const written = new Map();
    let requests = 0;
    const fixtureSnapshot = {
      provider: "tcgdex", language: "en", sets: [{ id: "s", name: "Set", count: 1 }],
      cards: [{ ...card, id: "s-001", setId: "s", imageUrl: "" }],
    };
    const fakeFs = {
      readFile: async file => {
        assert.ok(file.endsWith("tcgdex-en-full.json"));
        return JSON.stringify(fixtureSnapshot);
      },
      stat: async () => { throw Object.assign(Error("absent"), { code: "ENOENT" }); },
      mkdir: async () => {},
      writeFile: async (file, value) => written.set(path.basename(file), JSON.parse(value)),
    };
    const context = {
      __dirname, module: { exports: {} },
      process: { env: { POKEWALLET_API_KEY: "pk_test_" + "x".repeat(32) } },
      console: { log: () => {} }, AbortSignal,
      require: name => name === "node:fs/promises" ? fakeFs : require(name),
      fetch: async (url, options) => {
        requests++;
        assert.equal(options.redirect, "error");
        assert.equal(options.headers["X-API-Key"], context.process.env.POKEWALLET_API_KEY);
        if (failure === "rate-limit") return new Response("limited", { status: 429 });
        if (url.endsWith("/sets?language=eng")) return Response.json({
          success: true, data: [{ set_id: "100", name: "Set", language: "eng" }], total: 1,
        });
        const page = Number(new URL(url).searchParams.get("page"));
        return Response.json({
          success: true, set: { set_id: "100", language: "eng" },
          cards: [{ ...walletCard, id: failure === "duplicate" ? "same" : "row-" + page }],
          pagination: { page, limit: 200, total_pages: 2, total: failure === "count" ? 3 : 2 },
        });
      },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "catalogue-pokewallet-pilot.cjs"), "utf8"), context);
    const running = context.module.exports.main();
    if (failure) {
      await assert.rejects(running, failure === "rate-limit" ? /HTTP 429/ : failure === "duplicate" ? /Duplicate/ : /count mismatch/);
      assert.equal(written.has("pokewallet-pilot.json"), false);
      if (failure === "rate-limit") assert.equal(requests, 1);
    } else {
      await running;
      const result = written.get("pokewallet-pilot.json");
      assert.equal(result.newRequests, 3);
      assert.equal(result.candidates.length, 1);
      assert.equal(result.candidates[0].candidates.length, 2);
      assert.equal(result.checkedGroups[0].ambiguousCards, 1);
      assert.ok(!JSON.stringify([...written.values()]).includes(context.process.env.POKEWALLET_API_KEY));
    }
  }
  for (const failure of [null, "rate-limit", "duplicate", "count"]) await pilotFixture(failure);
  console.log("Catalogue coverage checks passed: gaps, conservative matching, ambiguity, response bounds and rate-limit stop.");
})().catch(error => { console.error(error); process.exitCode = 1; });
