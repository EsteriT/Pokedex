const assert = require("node:assert/strict");
const mapping = require("./catalogue-30th-mapping.json");
const { plan, jpeg, validateImageCard } = require("./catalogue-review-images.cjs");
const snapshot = { provider: "tcgdex", language: "en", cards: mapping.cards.map(([position, name]) => ({
  id: "30th-c-" + position, setId: "30th-c", collectorNumber: position, name,
})) };
const products = { results: mapping.cards.map(([, , productId, name, number]) => ({
  productId, name, groupId: 24837, categoryId: 3,
  imageUrl: `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`,
  extendedData: [{ name: "Number", value: number }],
})) };
const cards = plan(snapshot, products);
assert.equal(cards.length, 30);
assert.equal(cards[0].id, "30th-c-001");
assert.equal(cards[0].printedNumber, "4/102");
assert.doesNotThrow(() => validateImageCard(cards[0]));
assert.throws(() => validateImageCard({ ...cards[0], localFile: "../escape.jpg" }));
assert.throws(() => validateImageCard({ ...cards[0], imageUrl: "https://example.com/image.jpg" }));
assert.throws(() => validateImageCard({ ...cards[0], providerProductId: 1 }));
assert.notEqual(cards[18].providerProductId, cards[19].providerProductId);
assert.equal(cards[18].printedNumber, "99/102");
assert.equal(cards[19].printedNumber, "100/102");
assert.match(cards[18].providerName, /Top/);
assert.match(cards[19].providerName, /Bottom/);
for (const change of [
  { groupId: 24722 }, { name: "Original Charizard" },
  { extendedData: [{ name: "Number", value: "1/30" }] },
  { imageUrl: "https://example.com/product/714372_200w.jpg" },
  { imageUrl: "https://user@tcgplayer-cdn.tcgplayer.com/product/714372_200w.jpg" },
]) {
  const bad = structuredClone(products);
  Object.assign(bad.results[0], change);
  assert.throws(() => plan(snapshot, bad));
}
assert.throws(() => plan(snapshot, { results: products.results.slice(1) }));
assert.throws(() => plan(snapshot, { results: [...products.results, products.results[0]] }));
assert.equal(jpeg(Buffer.from("<html>not an image</html>")), false);
const bytes = Buffer.alloc(1000); bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff; bytes[998] = 0xff; bytes[999] = 0xd9;
assert.equal(jpeg(bytes), true);
assert.equal(jpeg(bytes.subarray(0, 999)), false);
console.log("30th artwork checks passed: set/printing identity, sequence vs printed number, LEGEND halves, trusted URLs and JPEG bounds.");
