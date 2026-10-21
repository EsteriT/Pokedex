/* Offline planning arithmetic only. No credentials, network or Docker. */
const fs = require("node:fs"),
  path = require("node:path");
const { maxBytes: backupLimitBytes } = require("./backup-crypto.cjs");
const GB = 1e9,
  MiB = 1024 ** 2;
// Review official sources in docs/CAPACITY-AND-COST.md before using a new quote.
const prices = {
  free: {
    databaseBytes: 500e6,
    storageBytes: GB,
    egressBytes: 5 * GB,
    invocations: 500000,
  },
  pro: {
    baseUsd: 25,
    databaseBytes: 8 * GB,
    storageBytes: 100 * GB,
    egressBytes: 250 * GB,
    invocations: 2000000,
  },
  r2: {
    freeGbMonths: 10,
    storageUsdPerGbMonth: 0.015,
    freeA: 1e6,
    aUsdPerMillion: 4.5,
    freeB: 10e6,
    bUsdPerMillion: 0.36,
  },
};
function nonnegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw Error(label + " must be a finite non-negative number.");
}
function r2Cost(gbMonths, classA, classB) {
  for (const n of [gbMonths, classA, classB]) nonnegative(n, "R2 usage");
  const p = prices.r2;
  return (
    Math.ceil(Math.max(0, gbMonths - p.freeGbMonths)) * p.storageUsdPerGbMonth +
    Math.ceil(Math.max(0, classA - p.freeA) / 1e6) * p.aUsdPerMillion +
    Math.ceil(Math.max(0, classB - p.freeB) / 1e6) * p.bUsdPerMillion
  );
}
function estimate(config, profile, accounts) {
  for (const key of [
    "daysPerMonth",
    "backupsPerDay",
    "retainedBackupCopies",
    "catalogueAndArchiveOverheadBytes",
    "databaseBaselineBytes",
    "databaseDocumentMultiplier",
    "archiveSizeRatio",
    "egressHeadroomMultiplier",
    "publicEgressBytesPerMonth",
    "publicGatewayRequestsPerMonth",
  ])
    nonnegative(config[key], key);
  for (const key of [
    "savedDocumentBytesPerAccount",
    "artworkBytesPerAccount",
    "otherEgressBytesPerActiveAccountPerMonth",
    "gatewayRequestsPerActiveAccountPerMonth",
  ])
    nonnegative(profile[key], key);
  if (!Number.isSafeInteger(accounts) || accounts < 0 || accounts > 1e7)
    throw Error("Account count must be an integer from 0 to 10,000,000.");
  if (
    config.daysPerMonth < 1 ||
    config.retainedBackupCopies < 1 ||
    config.egressHeadroomMultiplier < 1 ||
    config.archiveSizeRatio <= 0
  )
    throw Error(
      "Use positive days/copies/archive ratio and at least 1x egress headroom.",
    );
  const documents = accounts * profile.savedDocumentBytesPerAccount;
  const artwork = accounts * profile.artworkBytesPerAccount;
  const runs = config.daysPerMonth * config.backupsPerDay;
  // Base64 and per-account JSON overhead apply BEFORE gzip/encryption.
  const snapshot =
    config.catalogueAndArchiveOverheadBytes +
    documents +
    (artwork * 4) / 3 +
    accounts * 4096;
  const backupSourceBytesPerMonth =
    (config.catalogueAndArchiveOverheadBytes + documents + artwork) * runs;
  const egress =
    (backupSourceBytesPerMonth +
      accounts * profile.otherEgressBytesPerActiveAccountPerMonth +
      config.publicEgressBytesPerMonth) *
    config.egressHeadroomMultiplier;
  const invocations =
    accounts * profile.gatewayRequestsPerActiveAccountPerMonth +
    config.publicGatewayRequestsPerMonth;
  const database =
    config.databaseBaselineBytes +
    documents * config.databaseDocumentMultiplier;
  // One PUT + one LIST and a verification GET + expiry HEAD per daily run.
  // Extra pages, retries and manual runs are excluded; monitoring must use actuals.
  const r2 = r2Cost(
    (snapshot * config.archiveSizeRatio * config.retainedBackupCopies) / GB,
    runs * 2,
    runs * 2,
  );
  const usage = {
    databaseBytes: database,
    storageBytes: artwork,
    egressBytes: egress,
    invocations,
  };
  if (
    Object.values({ ...usage, snapshot }).some(
      (value) => !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER,
    )
  )
    throw Error(
      "Modeled usage exceeds the calculator's precise numeric range.",
    );
  const exceeded = Object.keys(usage).filter(
    (key) => usage[key] > prices.free[key],
  );
  const pro = prices.pro;
  const proEstimate =
    pro.baseUsd +
    Math.max(0, database / GB - pro.databaseBytes / GB) * 0.125 +
    Math.max(0, artwork / GB - pro.storageBytes / GB) * 0.0213 +
    Math.max(0, egress / GB - pro.egressBytes / GB) * 0.09 +
    Math.ceil(Math.max(0, invocations - pro.invocations) / 1e6) * 2 +
    r2;
  return {
    profile: profile.name,
    accounts,
    monthlyActiveAccountsAssumed: accounts,
    usage,
    backupSourceBytesPerMonth,
    snapshotUncompressedBytes: Math.ceil(snapshot),
    backupLimitBytes,
    backupLimitExceeded: snapshot > backupLimitBytes,
    r2RetainedGb:
      (snapshot * config.archiveSizeRatio * config.retainedBackupCopies) / GB,
    r2EstimatedUsd: r2,
    freeEnvelopeExceeded: exceeded,
    // Free over-quota usage is not silently treated as paid, working capacity.
    freePlanEstimatedUsd: exceeded.length ? null : r2,
    proWhatIfEstimatedUsd: proEstimate,
  };
}
function main(args) {
  const json = args.includes("--json"),
    files = args.filter((arg) => arg !== "--json");
  if (files.length > 1 || files.some((arg) => arg.startsWith("--")))
    throw Error(
      "Usage: node scripts/capacity-plan.cjs [aggregate-assumptions.json] [--json]",
    );
  const config = JSON.parse(
    fs.readFileSync(
      files[0] || path.join(__dirname, "../docs/CAPACITY-ASSUMPTIONS.json"),
      "utf8",
    ),
  );
  if (
    !Array.isArray(config.profiles) ||
    !config.profiles.length ||
    !Array.isArray(config.accountCounts) ||
    !config.accountCounts.length
  )
    throw Error(
      "Assumptions need non-empty profiles and accountCounts arrays.",
    );
  const rows = config.profiles.flatMap((profile) =>
    config.accountCounts.map((count) => estimate(config, profile, count)),
  );
  if (json) {
    console.log(
      JSON.stringify(
        { reviewedAt: config.reviewedAt, modelOnly: true, rows },
        null,
        2,
      ),
    );
    return;
  }
  console.log(
    "Planning estimates; all accounts assumed active. GB = 1e9 bytes; MiB = 1,048,576 bytes.",
  );
  console.table(
    rows.map((r) => ({
      Profile: r.profile,
      Accounts: r.accounts,
      "DB GB": +(r.usage.databaseBytes / GB).toFixed(3),
      "Artwork GB": +(r.usage.storageBytes / GB).toFixed(3),
      "Monthly source GB": +(r.usage.egressBytes / GB).toFixed(3),
      "Snapshot MiB": +(r.snapshotUncompressedBytes / MiB).toFixed(1),
      "Backup fits": !r.backupLimitExceeded,
      "Free quotas exceeded":
        r.freeEnvelopeExceeded.join(", ") || "none in model",
      "Pro what-if USD": +r.proWhatIfEstimatedUsd.toFixed(2),
    })),
  );
  console.log(
    "Source traffic includes daily backup reads. Invocations model protection ON; it is currently OFF.",
  );
  console.log(
    "Prices exclude taxes, optional add-ons, other projects/traffic, and compute upgrades. A Pro quote does not fix an oversized backup.",
  );
  console.log(
    "Not a concurrency benchmark or spending cap. See docs/CAPACITY-AND-COST.md.",
  );
}
if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { estimate, r2Cost, prices };
