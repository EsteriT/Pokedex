/* Public HTTP acceptance; refuses every non-loopback backend. */
const assert = require("node:assert/strict");
module.exports = async function (client) {
  if (
    !["localhost", "127.0.0.1"].includes(new URL(client.supabaseUrl).hostname)
  )
    throw Error("Local catalogue checks only.");
  const info = await client.rpc("catalogue_info");
  assert(!info.error, info.error?.message);
  assert(info.data.sets.length >= 10 && info.data.sets.length <= 500);
  assert(info.data.count >= 1291);
  const timings = [];
  for (const q of [
    "",
    "Bulbasaur",
    "Charizard",
    "#001",
    "151",
    "base1-4",
    "%' or true --",
  ]) {
    const start = performance.now();
    const result = await client.rpc("search_catalogue", {
      filters: { q },
      page_number: 1,
    });
    timings.push(performance.now() - start);
    assert(!result.error, result.error?.message);
    assert(result.data.cards.length <= 24);
    if (q === "#001")
      assert(result.data.cards.every((c) => Number(c.collectorNumber) === 1));
    if (q === "base1-4")
      assert(result.data.cards.some((c) => c.id === "base1-4"));
  }
  const page1 = await client.rpc("search_catalogue", { page_number: 1 });
  const page2 = await client.rpc("search_catalogue", { page_number: 2 });
  assert.equal(page1.data.cards.length, 24);
  assert.equal(page2.data.cards.length, 24);
  assert(
    !page1.data.cards.some((c) => page2.data.cards.some((d) => d.id === c.id)),
  );
  const alias = await client.rpc("search_catalogue", {
    filters: { q: "sv03.5-001" },
  });
  assert.equal(
    alias.data.cards[0].id,
    "001",
    "Legacy sample ID remains canonical",
  );
  const denied = await client
    .schema("binder_private")
    .from("catalogue")
    .update({ variants: {} })
    .eq("card_id", "001");
  assert(denied.error, "Clients cannot change catalogue records");
  const oversized = await client.rpc("catalogue_cards", {
    ids: Array(101).fill("001"),
  });
  assert(oversized.error);
  console.log(
    "PASS: local public catalogue API, 24-card pages, stable aliases, numeric search and direct-write denial. Slowest sampled local search: " +
      Math.ceil(Math.max(...timings)) +
      " ms.",
  );
};
