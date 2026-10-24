/* Read-only, explicit printing review. No catalogue import or frontend changes. */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const mapping = require("./catalogue-30th-mapping.json");
const root = path.resolve(__dirname, "..");
const folder = path.join(root, ".scratch/catalogue/provider-audit");

function plan(snapshot, products) {
  if (snapshot.provider !== "tcgdex" || snapshot.language !== "en" ||
      snapshot.cards.filter(card => card.setId === mapping.localSetId).length !== 30 ||
      !Array.isArray(products.results)) throw Error("Unexpected review input.");
  const seen = new Set();
  return mapping.cards.map(([position, localName, productId, providerName, printedNumber]) => {
    const id = mapping.localSetId + "-" + position;
    const local = snapshot.cards.find(card => card.id === id && card.setId === mapping.localSetId);
    const rows = products.results.filter(row => row.productId === productId);
    if (!local || local.name !== localName || local.collectorNumber !== position ||
        rows.length !== 1 || seen.has(productId)) throw Error("Review mapping does not match source identities.");
    seen.add(productId);
    const product = rows[0];
    const number = product.extendedData?.find(field => field.name === "Number")?.value;
    if (product.groupId !== mapping.providerGroupId || product.categoryId !== 3 ||
        product.name !== providerName || number !== printedNumber)
      throw Error("Provider printing changed; manual review required.");
    const url = new URL(product.imageUrl);
    if (url.origin !== "https://tcgplayer-cdn.tcgplayer.com" || url.username || url.password ||
        url.search || url.hash || url.pathname !== `/product/${productId}_200w.jpg`)
      throw Error("Unexpected candidate image URL.");
    return {
      id, localName, localSequence: position, providerProductId: productId,
      providerName, providerSetId: String(mapping.providerGroupId), printedNumber,
      imageUrl: url.href.replace("_200w.jpg", "_in_1000x1000.jpg"),
      localFile: `30th-product-${productId}.jpg`,
    };
  });
}
function jpeg(bytes) {
  return bytes.length >= 1000 && bytes.length <= 4 * 1024 * 1024 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}
function validateImageCard(card) {
  const url = new URL(card.imageUrl);
  const id = card.providerProductId;
  if (!Number.isSafeInteger(id) || id < 1 ||
      url.origin !== "https://tcgplayer-cdn.tcgplayer.com" || url.username || url.password ||
      url.search || url.hash || url.pathname !== `/product/${id}_in_1000x1000.jpg` ||
      !["30th-product-" + id + ".jpg", "review-product-" + id + ".jpg"].includes(card.localFile))
    throw Error("Untrusted review image or output filename.");
}
async function download(card) {
  validateImageCard(card);
  const file = path.join(folder, card.localFile);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < 86400000) {
      const bytes = await fs.readFile(file);
      if (!jpeg(bytes)) throw Error("Cached file is not a complete JPEG.");
      return { ...card, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), cached: true };
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const response = await fetch(card.imageUrl, {
    headers: { "User-Agent": "BinderMinder-CoverageAudit/0.1" },
    redirect: "error", signal: AbortSignal.timeout(20000),
  });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "image/jpeg") {
    await response.body?.cancel();
    throw Error(`Image ${card.id} returned HTTP ${response.status} or a non-JPEG response.`);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) throw Error("Image exceeds review size limit.");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!jpeg(bytes)) throw Error("Image response is not a complete JPEG.");
  await fs.writeFile(file, bytes);
  return { ...card, bytes: size, sha256: crypto.createHash("sha256").update(bytes).digest("hex"), cached: false };
}
async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--download"))
    throw Error("Usage: node scripts/catalogue-review-images.cjs [--download]");
  const snapshot = JSON.parse(await fs.readFile(path.join(root, ".scratch/catalogue/tcgdex-en-full.json"), "utf8"));
  const products = JSON.parse(await fs.readFile(path.join(folder, "tcgcsv-products-24837.json"), "utf8"));
  const cards = plan(snapshot, products);
  const checked = [];
  for (const card of cards) {
    checked.push(process.argv.includes("--download") ? await download(card) : card);
    if (process.argv.includes("--download")) await new Promise(resolve => setTimeout(resolve, 150));
  }
  const result = {
    checkedAt: new Date().toISOString(), localSetId: mapping.localSetId,
    source: "Public TCGCSV metadata and TCGplayer image CDN; Pokewallet directory confirms numeric set 24837.",
    status: process.argv.includes("--download") ? "Downloaded JPEGs; pending visual receipt" : "Explicit metadata mapping only",
    note: "Preserve existing internal IDs and sequence. Original printed numbers differ. Nothing imported.", cards: checked,
  };
  const reportFile = process.argv.includes("--download") ? "reviewed-30th-c.json" : "30th-image-plan.json";
  await fs.writeFile(path.join(folder, reportFile), JSON.stringify(result, null, 2) + "\n");
  console.log(`30th Classic Collection: ${checked.length} explicit printing mappings${process.argv.includes("--download") ? ", all JPEG downloads passed" : ""}. No imports.`);
}
module.exports = { plan, jpeg, validateImageCard, download };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
