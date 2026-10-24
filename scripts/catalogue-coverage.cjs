/* Read-only provider audit. Reports candidates; never edits the catalogue. */
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const folder = path.join(root, ".scratch/catalogue/provider-audit");

function nameKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9!?]/g, "");
}
function setKey(value) {
  return nameKey(String(value || "").replace(/^(?:SWSH|SV):\s*/i, ""));
}
function numberKey(value) {
  const number = String(value || "").trim().split("/")[0].toUpperCase();
  const match = /^([A-Z]*)(\d+)([A-Z]*)$/.exec(number);
  return match ? match[1] + String(Number(match[2])) + match[3] : number;
}
function gaps(snapshot) {
  if (
    snapshot.provider !== "tcgdex" || snapshot.language !== "en" ||
    !Array.isArray(snapshot.sets) || !Array.isArray(snapshot.cards)
  ) throw Error("Expected the prepared English TCGdex snapshot.");
  const sets = new Map(snapshot.sets.map(set => [set.id, set]));
  const missingImages = snapshot.cards.filter(card => !card.imageUrl);
  const perSet = new Map();
  for (const card of missingImages) {
    if (!sets.has(card.setId)) throw Error("Card references an unknown set.");
    const group = perSet.get(card.setId) || {
      setId: card.setId, setName: sets.get(card.setId).name,
      availableCards: sets.get(card.setId).count, missingImages: 0,
    };
    group.missingImages++;
    perSet.set(card.setId, group);
  }
  const absentGroups = (snapshot.unavailableSets || []).map(set => ({
    setId: set.id, setName: set.name, availableCards: 0,
    listedCards: set.expectedCount, missingRecords: set.expectedCount,
  }));
  const partialGroups = (snapshot.coverageGaps || []).map(set => ({
    setId: set.id, setName: set.name, availableCards: set.availableCount,
    listedCards: set.expectedCount,
    missingRecords: Math.max(0, set.expectedCount - set.availableCount),
  }));
  return {
    generatedAt: new Date().toISOString(), snapshotFetchedAt: snapshot.fetchedAt,
    summary: {
      sets: snapshot.sets.length, cards: snapshot.cards.length,
      missingImageUrls: missingImages.length,
      setsWithMissingImageUrls: perSet.size,
      missingLogoUrls: snapshot.sets.filter(set => !set.logo).length,
      missingRecords: [...absentGroups, ...partialGroups]
        .reduce((sum, set) => sum + set.missingRecords, 0),
    },
    notes: [
      "Missing URL fields are not an HTTP availability test of all provider assets.",
      "Counts of absent records cannot establish their identities or completeness.",
      "Cross-provider candidates require language, printing and artwork review; nothing is imported.",
    ],
    imageGroups: [...perSet.values()].sort((a, b) => b.missingImages - a.missingImages),
    missingImages: missingImages.map(card => ({
      id: card.id, providerId: card.providerId, setId: card.setId,
      setName: card.setName, collectorNumber: card.collectorNumber,
      name: card.name, variants: card.variants,
    })),
    missingLogos: snapshot.sets.filter(set => !set.logo)
      .map(set => ({ setId: set.id, setName: set.name })),
    recordGaps: [...absentGroups, ...partialGroups],
  };
}

function productCandidates(card, products) {
  return products.filter(product => {
    const number = product.extendedData?.find(field => field.name === "Number")?.value;
    let url;
    try { url = new URL(product.imageUrl); } catch { return false; }
    return url.protocol === "https:" && !url.username && !url.password &&
      url.hostname === "tcgplayer-cdn.tcgplayer.com" &&
      numberKey(number) !== "" && numberKey(number) === numberKey(card.collectorNumber) &&
      nameKey(product.name) === nameKey(card.name);
  }).map(product => ({
    provider: "tcgcsv", productId: product.productId,
    name: product.name, imageUrl: product.imageUrl,
    status: "candidate-only; language/printing/artwork not verified",
  }));
}

async function readJson(response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw Error(`Provider returned HTTP ${response.status}; no automatic retry.`);
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 16 * 1024 * 1024) throw Error("Provider response exceeded 16 MiB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function csvRequest(endpoint, filename) {
  const file = path.join(folder, filename + ".json");
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < 86400000)
      return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await new Promise(resolve => setTimeout(resolve, 150));
  const response = await fetch("https://tcgcsv.com/tcgplayer/3/" + endpoint, {
    headers: { "User-Agent": "BinderMinder-CoverageAudit/0.1" },
    redirect: "error", signal: AbortSignal.timeout(20000),
  });
  const data = await readJson(response);
  if (data.success !== true || !Array.isArray(data.results))
    throw Error("Unexpected TCGCSV response; audit stopped.");
  await fs.writeFile(file, JSON.stringify(data));
  return data;
}
async function tcgcsvPilot(report) {
  const directory = await csvRequest("groups", "tcgcsv-groups");
  const groups = report.imageGroups.flatMap(set => {
    const matches = directory.results.filter(group => setKey(group.name) === setKey(set.setName));
    return matches.length === 1 ? [{ ...set, group: matches[0] }] : [];
  }).slice(0, 8);
  const result = {
    scope: "At most eight exact-normalized-name groups, highest missing-image count first.",
    checkedGroups: [], candidates: [],
    warning: "URL candidates only. No images, ownership, finishes or catalogue records were changed.",
  };
  for (const { group, ...set } of groups) {
    if (!Number.isSafeInteger(group.groupId) || group.groupId < 1)
      throw Error("Invalid provider group ID.");
    const products = await csvRequest(group.groupId + "/products", "tcgcsv-products-" + group.groupId);
    const matches = report.missingImages.filter(card => card.setId === set.setId)
      .map(card => ({ ...card, candidates: productCandidates(card, products.results) }));
    const found = matches.filter(card => card.candidates.length);
    result.checkedGroups.push({
      ...set, providerGroupId: group.groupId, providerGroupName: group.name,
      cardsWithCandidates: found.length,
      uniquelyMatchedCards: found.filter(card => card.candidates.length === 1).length,
      ambiguousCards: found.filter(card => card.candidates.length > 1).length,
    });
    result.candidates.push(...found);
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--tcgcsv-pilot"))
    throw Error("Usage: node scripts/catalogue-coverage.cjs [--tcgcsv-pilot]");
  const snapshot = JSON.parse(await fs.readFile(
    path.join(root, ".scratch/catalogue/tcgdex-en-full.json"), "utf8"));
  const report = gaps(snapshot);
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, "coverage-gaps.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("Prepared catalogue gaps:", JSON.stringify(report.summary));
  if (args.includes("--tcgcsv-pilot")) {
    const pilot = await tcgcsvPilot(report);
    await fs.writeFile(path.join(folder, "tcgcsv-pilot.json"), JSON.stringify(pilot, null, 2) + "\n");
    console.log("TCGCSV groups checked:", pilot.checkedGroups.length,
      "cards with candidate image URLs:", pilot.candidates.length);
    for (const group of pilot.checkedGroups)
      console.log(`${group.setName}: ${group.cardsWithCandidates}/${group.missingImages} candidates (${group.ambiguousCards} ambiguous)`);
  }
  console.log("Reports: .scratch/catalogue/provider-audit/; no application/database changes.");
}

module.exports = { gaps, nameKey, setKey, numberKey, productCandidates, readJson };
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
