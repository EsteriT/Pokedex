const assert = require("node:assert/strict");
const { encrypt, decrypt } = require("./backup-crypto.cjs");
const value = {
    format: "pokedex-service",
    accounts: [{ notes: "private artwork and records" }],
    files: [],
  },
  pass = "test-only-long-passphrase";
const bytes = encrypt(value, pass);
assert(!bytes.includes(Buffer.from("private artwork")));
assert.deepEqual(decrypt(bytes, pass), value);
assert(
  !encrypt(value, pass).equals(bytes),
  "Random salt/nonce for every backup",
);
assert.throws(
  () => decrypt(bytes, "wrong-but-long-passphrase"),
  /could not be opened/,
);
const damaged = Buffer.from(bytes);
damaged[damaged.length - 1] ^= 1;
assert.throws(() => decrypt(damaged, pass), /could not be opened/);
assert.throws(() => encrypt(value, "short"), /16 to 1024/);
assert.throws(
  () => decrypt(Buffer.from("not a backup"), pass),
  /Not a supported/,
);
console.log(
  "PASS: encrypted backup round trip, random salt/nonce, wrong passphrase, tamper detection and format limits.",
);
