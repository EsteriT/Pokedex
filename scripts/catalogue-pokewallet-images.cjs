/* Operator-only diagnostic; authenticated pictures stay in the local review folder. */
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { readJson } = require("./catalogue-coverage.cjs");
const root = path.resolve(__dirname, "..");
const folder = path.join(root, ".scratch/catalogue/provider-audit");

function productId(card) {
  let url;
  try { url = new URL(card.tcgplayer?.url); } catch { return null; }
  const match = /^\/product\/(\d+)(?:\/|$)/.exec(url.pathname);
  if (url.protocol !== "https:" || !["www.tcgplayer.com", "tcgplayer.com"].includes(url.hostname) ||
      url.port || url.username || url.password || !match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function imageKind(bytes) {
  if (bytes.length < 128 || bytes.length > 4 * 1024 * 1024) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
async function main({ bulk = false } = {}) {
  const key = process.env.POKEWALLET_API_KEY;
  if (!key || key.length < 20 || key.length > 256 || /\s/.test(key))
    throw Error("Enter the key through scripts/enter-pokewallet-pilot.ps1 -Images. Do not put it in chat.");
  const load = async name => JSON.parse(await fs.readFile(path.join(folder, name + ".json"), "utf8"));
  const coverage = await load("image-card-coverage");
  const basic = await load("expanded-name-review");
  const directory = await load("pokewallet-sets-eng");
  const review = await load("extended-printing-review");
  const failed = coverage.uncoveredCards;
  if (!Array.isArray(failed) || failed.length > 2000) throw Error("Invalid local image-gap report.");
  const reportName = bulk ? "pokewallet-image-check.json" : "pokewallet-image-pilot.json";
  const limit = bulk ? 60 : 18;
  const result = { checkedAt: new Date().toISOString(), scope: bulk ? "Resumable image check, at most 60 new requests per run; no imports." : "Metadata for failed-image groups and at most eight image samples; no imports.", groups: [], samples: [], newRequests: 0 };
  if (bulk) {
    for (const name of ["pokewallet-image-pilot", "pokewallet-image-check"]) {
      let previous;
      try { previous = await load(name); } catch (error) { if (error.code !== "ENOENT") throw error; }
      for (const sample of previous?.samples || []) {
        if (!failed.some(card => card.id === sample.localId)) throw Error("Saved image check contains an unknown local card.");
        const index = result.samples.findIndex(row => row.localId === sample.localId);
        if (index < 0) result.samples.push(sample);
        else result.samples[index] = sample;
      }
    }
  }
  const save = () => fs.writeFile(path.join(folder, reportName), JSON.stringify(result, null, 2) + "\n");
  let remaining = Infinity;
  async function request(endpoint) {
    if (result.newRequests >= limit || remaining < 1) throw Error("Conservative request allowance exhausted.");
    result.newRequests++;
    const response = await fetch("https://api.pokewallet.io" + endpoint, {
      headers: { "X-API-Key": key, "User-Agent": "BinderMinder-CoverageAudit/0.1" },
      redirect: "error", signal: AbortSignal.timeout(20000),
    });
    for (const name of ["X-RateLimit-Remaining-Hour", "X-RateLimit-Remaining-Day"]) {
      const value = response.headers.get(name);
      if (value !== null && /^\d+$/.test(value)) remaining = Math.min(remaining, Number(value));
    }
    return response;
  }
  const groupIds = [...new Set(failed.map(card => basic.groups.find(group => group.setId === card.setId)?.providerGroupId))];
  const providerCards = new Map();
  for (const id of groupIds) {
    if (!Number.isSafeInteger(id) || !directory.data.some(set => set.set_id === String(id) && set.language === "eng"))
      throw Error("Group is not an explicitly mapped English Pokewallet set.");
    let totalPages = 1;
    const rows = [];
    const seen = new Set();
    for (let page = 1; page <= totalPages; page++) {
      const cache = path.join(folder, `pokewallet-set-${id}-page-${page}.json`);
      let data;
      try {
        const stat = await fs.stat(cache);
        if (Date.now() - stat.mtimeMs < 86400000) data = JSON.parse(await fs.readFile(cache, "utf8"));
      } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!data) data = await readJson(await request(`/sets/${id}?language=eng&limit=200&page=${page}`));
      if (data.success !== true || data.disambiguation || String(data.set?.set_id) !== String(id) ||
          data.set.language !== "eng" || !Array.isArray(data.cards) || data.cards.length > 200 ||
          data.pagination?.page !== page || !Number.isSafeInteger(data.pagination.total_pages) ||
          data.pagination.total_pages < 1 || data.pagination.total_pages > 3 ||
          !Number.isSafeInteger(data.pagination.total) || data.pagination.total < 0)
        throw Error("Unexpected English set response; audit stopped.");
      if (page > 1 && totalPages !== data.pagination.total_pages) throw Error("Provider pagination changed.");
      totalPages = data.pagination.total_pages;
      for (const card of data.cards) {
        if (typeof card.id !== "string" || seen.has(card.id)) throw Error("Invalid or repeated provider card.");
        seen.add(card.id);
        rows.push(card);
        const product = productId(card);
        if (product && card.card_info?.product_type === "card" && String(card.card_info.set_id) === String(id)) {
          const matches = providerCards.get(product) || [];
          matches.push(card);
          providerCards.set(product, matches);
        }
      }
      if (page === totalPages && rows.length !== data.pagination.total) throw Error("Pagination count mismatch.");
      await fs.writeFile(cache, JSON.stringify(data));
    }
    result.groups.push({ providerSetId: id, records: rows.length });
  }
  const sampledSets = new Set();
  result.mappedLocalCards = failed.filter(source => review.cards.find(card => card.id === source.id)?.candidates.some(candidate => providerCards.has(candidate.productId))).length;
  for (const source of failed) {
    if (bulk ? result.samples.some(sample => sample.localId === source.id) : sampledSets.has(source.setId) || sampledSets.size >= 8) continue;
    if (result.newRequests >= limit || remaining < 1) {
      result.stopped = "Request allowance reached; run again after your hourly allowance resets.";
      break;
    }
    const local = review.cards.find(card => card.id === source.id);
    const match = local?.candidates.find(candidate => providerCards.get(candidate.productId)?.length === 1);
    if (!match) continue;
    const card = providerCards.get(match.productId)[0];
    if (!/^(?:pk_)?[a-f0-9]{32,256}$/i.test(card.id)) throw Error("Unexpected provider image ID.");
    sampledSets.add(source.setId);
    const sample = { localId: source.id, localName: source.name, providerProductId: match.productId, providerCardId: card.id, providerName: card.card_info.name, printedNumber: card.card_info.card_number };
    const response = await request(`/images/${encodeURIComponent(card.id)}?size=high`);
    sample.httpStatus = response.status;
    if (response.ok) {
      const parts = [];
      let count = 0;
      for await (const bytes of response.body) {
        count += bytes.length;
        if (count > 4 * 1024 * 1024) throw Error("Image response exceeds 4 MiB.");
        parts.push(bytes);
      }
      const bytes = Buffer.concat(parts);
      const kind = imageKind(bytes);
      if (!kind || !response.headers.get("content-type")?.startsWith("image/")) throw Error("Response is not a supported image.");
      sample.localFile = `wallet-product-${match.productId}.${kind}`;
      sample.bytes = count;
      sample.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      await fs.writeFile(path.join(folder, sample.localFile), bytes);
    } else {
      await response.body?.cancel();
      sample.error = `HTTP ${response.status}; no retry.`;
    }
    result.samples.push(sample);
    await save();
    if ([401,403,429].includes(response.status)) {
      result.stopped = `HTTP ${response.status}; no retry.`;
      break;
    }
    if (bulk) await new Promise(resolve => setTimeout(resolve, 150));
  }
  result.untestedCards = failed.filter(source => !result.samples.some(sample => sample.localId === source.id)).length;
  await save();
  console.log(`Pokewallet image ${bulk ? "check" : "pilot"}: ${result.mappedLocalCards}/${failed.length} metadata mappings; ${result.samples.filter(sample => sample.localFile).length}/${result.samples.length} checked pictures downloaded; ${result.untestedCards} untested; ${result.newRequests} new requests.`);
  if (result.stopped) console.log(result.stopped);
  console.log(`Report: .scratch/catalogue/provider-audit/${reportName}. Nothing imported.`);
}
module.exports = { productId, imageKind, main };
if (require.main === module) main({ bulk: process.argv.includes("--remaining") }).catch(error => { console.error(error.message); process.exitCode = 1; });
