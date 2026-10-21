const assert = require("node:assert/strict");
const { estimate, r2Cost } = require("./capacity-plan.cjs");
const config = require("../docs/CAPACITY-ASSUMPTIONS.json");
const profile = config.profiles[0];
const ten = estimate(config, profile, 10);
assert.equal(ten.usage.storageBytes, 10000000);
assert.equal(ten.backupSourceBytesPerMonth, 435000000);
assert.equal(ten.usage.egressBytes, 768750000);
assert.equal(ten.snapshotUncompressedBytes, 17874294);
assert.equal(ten.backupLimitExceeded, false);
assert.equal(ten.freePlanEstimatedUsd, 0);
assert.equal(ten.proWhatIfEstimatedUsd, 25);
// Fewer active visits do not remove stored accounts from every daily export.
const quiet = estimate(
  config,
  { ...profile, otherEgressBytesPerActiveAccountPerMonth: 0 },
  10,
);
assert.equal(quiet.backupSourceBytesPerMonth, ten.backupSourceBytesPerMonth);
const hundred = estimate(config, profile, 100);
assert(hundred.freeEnvelopeExceeded.includes("egressBytes"));
assert.equal(hundred.freePlanEstimatedUsd, null);
assert.equal(hundred.backupLimitExceeded, false);
assert.equal(estimate(config, profile, 500).backupLimitExceeded, true);
assert.equal(
  estimate(config, config.profiles[1], 50).backupLimitExceeded,
  true,
);
const storageEnvelope = {
  ...profile,
  savedDocumentBytesPerAccount: 3 * 2300000 + 16 * 1024 ** 2,
  artworkBytesPerAccount: 60 * 500000,
};
assert.equal(estimate(config, storageEnvelope, 4).backupLimitExceeded, false);
assert.equal(estimate(config, storageEnvelope, 5).backupLimitExceeded, true);
// Backup cap is checked before compression, including when gzip is optimistic.
assert.equal(
  estimate({ ...config, archiveSizeRatio: 0.01 }, profile, 500)
    .backupLimitExceeded,
  true,
);
assert.equal(r2Cost(10, 1e6, 10e6), 0);
assert.equal(r2Cost(10.01, 0, 0), 0.015);
assert.equal(r2Cost(0, 1000001, 0), 4.5);
assert.equal(r2Cost(0, 0, 10000001), 0.36);
assert.throws(() => r2Cost(-1, 0, 0));
assert.throws(() => r2Cost(NaN, 0, 0));
for (const count of [-1, 1.5, Infinity, "10"])
  assert.throws(() => estimate(config, profile, count));
assert.throws(() =>
  estimate(config, { ...profile, artworkBytesPerAccount: -1 }, 1),
);
assert.throws(() =>
  estimate(
    config,
    { ...profile, artworkBytesPerAccount: Number.MAX_VALUE },
    10,
  ),
);
assert.throws(() => estimate({ ...config, daysPerMonth: 0 }, profile, 1));
assert.throws(() =>
  estimate({ ...config, egressHeadroomMultiplier: 0.5 }, profile, 1),
);
console.log(
  "PASS: offline capacity arithmetic, source backup traffic, pre-compression cap, free over-quota status and billing-unit rounding.",
);
