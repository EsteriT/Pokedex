/* Operator-only coverage pilot. No catalogue writes or browser API keys. */
const fs = require("node:fs/promises");
const path = require("node:path");
const { gaps, setKey, nameKey, numberKey, readJson } = require("./catalogue-coverage.cjs");
const root = path.resolve(__dirname, "..");
const folder = path.join(root, ".scratch/catalogue/provider-audit");

function candidates(card, rows, setId) {
  return rows.filter(row => {
    const info = row.card_info;
    return typeof row.id === "string" && info?.product_type === "card" &&
      String(info.set_id) === String(setId) && numberKey(info.card_number) !== "" &&
      numberKey(info.card_number) === numberKey(card.collectorNumber) &&
      nameKey(info.name) === nameKey(card.name);
  }).map(row => ({
    provider: "pokewallet", providerCardId: row.id, name: row.card_info.name,
    number: row.card_info.card_number,
    imageAvailability: "not yet fetched; metadata match only",
  }));
}

async function main() {
  const key = process.env.POKEWALLET_API_KEY;
  if (!key || key.length < 20 || key.length > 256 || /\s/.test(key))
    throw Error("Set POKEWALLET_API_KEY privately, or run scripts/enter-pokewallet-pilot.ps1. Never paste it into chat.");
  const snapshot = JSON.parse(await fs.readFile(path.join(root, ".scratch/catalogue/tcgdex-en-full.json"), "utf8"));
  const report = gaps(snapshot);
  await fs.mkdir(folder, { recursive: true });
  let requests = 0;
  let remaining = Infinity;
  async function request(endpoint, filename, validate) {
    const file = path.join(folder, filename + ".json");
    try {
      const stat = await fs.stat(file);
      if (Date.now() - stat.mtimeMs < 86400000) {
        const cached = JSON.parse(await fs.readFile(file, "utf8"));
        if (!validate(cached)) throw Error("Cached provider response does not match the expected schema.");
        return cached;
      }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (requests >= 10 || remaining < 1)
      throw Error("Conservative pilot request allowance exhausted; stop and review before continuing.");
    requests++;
    const response = await fetch("https://api.pokewallet.io" + endpoint, {
      headers: { "X-API-Key": key, "User-Agent": "BinderMinder-CoverageAudit/0.1" },
      redirect: "error", signal: AbortSignal.timeout(20000),
    });
    for (const header of ["X-RateLimit-Remaining-Hour", "X-RateLimit-Remaining-Day"]) {
      const value = response.headers.get(header);
      if (value !== null && /^\d+$/.test(value)) remaining = Math.min(remaining, Number(value));
    }
    const data = await readJson(response);
    if (!validate(data)) throw Error("Unexpected provider response; no automatic retry or import.");
    await fs.writeFile(file, JSON.stringify(data));
    return data;
  }
  const directory = await request("/sets?language=eng", "pokewallet-sets-eng", data =>
    data.success === true && Array.isArray(data.data) && data.data.length <= 2000 &&
    data.data.every(set => typeof set.name === "string" && /^-?\d+$/.test(set.set_id)));
  const selected = report.imageGroups.flatMap(set => {
    const matches = directory.data.filter(other => other.language === "eng" &&
      setKey(other.name) === setKey(set.setName));
    return matches.length === 1 ? [{ local: set, provider: matches[0] }] : [];
  }).slice(0, 4);
  const result = {
    generatedAt: new Date().toISOString(), snapshotFetchedAt: snapshot.fetchedAt,
    scope: "Up to four exact-name English groups; at most ten new API requests. No image requests.",
    checkedGroups: [], candidates: [],
    warning: "Metadata candidates only; printing variants and image availability require review. No imports.",
  };
  for (const { local, provider } of selected) {
    let pages = 1;
    const rows = [];
    const seen = new Set();
    for (let page = 1; page <= pages; page++) {
      const data = await request(
        `/sets/${encodeURIComponent(provider.set_id)}?language=eng&limit=200&page=${page}`,
        `pokewallet-set-${provider.set_id}-page-${page}`,
        data => data.success === true && !data.disambiguation &&
          String(data.set?.set_id) === provider.set_id && data.set.language === "eng" &&
          Array.isArray(data.cards) && data.cards.length <= 200 &&
          data.cards.every(card => typeof card.id === "string" && card.card_info) &&
          data.pagination?.page === page && Number.isSafeInteger(data.pagination.total_pages) &&
          data.pagination.total_pages >= 1 && data.pagination.total_pages <= 10 &&
          Number.isSafeInteger(data.pagination.total) && data.pagination.total >= 0);
      if (page > 1 && pages !== data.pagination.total_pages)
        throw Error("Provider pagination changed during the pilot; stop and retry later.");
      pages = data.pagination.total_pages;
      for (const row of data.cards) {
        if (seen.has(row.id)) throw Error("Duplicate provider card across pages; audit stopped.");
        seen.add(row.id);
        rows.push(row);
      }
      if (page === pages && rows.length !== data.pagination.total)
        throw Error("Provider pagination count mismatch; audit stopped.");
    }
    const found = report.missingImages.filter(card => card.setId === local.setId)
      .map(card => ({ ...card, candidates: candidates(card, rows, provider.set_id) }))
      .filter(card => card.candidates.length);
    result.checkedGroups.push({
      ...local, providerSetId: provider.set_id, providerSetName: provider.name,
      cardsWithMetadataCandidates: found.length,
      ambiguousCards: found.filter(card => card.candidates.length > 1).length,
    });
    result.candidates.push(...found);
  }
  result.newRequests = requests;
  await fs.writeFile(path.join(folder, "pokewallet-pilot.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(`Pokewallet pilot: ${selected.length} groups, ${result.candidates.length} metadata candidates, ${requests} new requests.`);
  console.log("Report: .scratch/catalogue/provider-audit/pokewallet-pilot.json. Images not verified; no catalogue changes.");
}
module.exports = { candidates, main };
if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
