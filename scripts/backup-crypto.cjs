const {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} = require("node:crypto");
const { gzipSync, gunzipSync } = require("node:zlib");
const magic = Buffer.from("POKEDEX-BACKUP-1\n"),
  maxBytes = 256 * 1024 * 1024;
function key(passphrase, salt) {
  if (
    typeof passphrase !== "string" ||
    passphrase.length < 16 ||
    passphrase.length > 1024
  )
    throw Error("Use a backup passphrase of 16 to 1024 characters.");
  return scryptSync(passphrase, salt, 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}
function encrypt(value, passphrase) {
  const json = Buffer.from(JSON.stringify(value));
  if (json.length > maxBytes)
    throw Error(
      "Backup exceeds the 256 MB beta limit. Use a streaming backup before growing further.",
    );
  const salt = randomBytes(16),
    iv = randomBytes(12),
    secret = key(passphrase, salt);
  try {
    const cipher = createCipheriv("aes-256-gcm", secret, iv);
    cipher.setAAD(magic);
    const data = Buffer.concat([cipher.update(gzipSync(json)), cipher.final()]);
    return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), data]);
  } finally {
    secret.fill(0);
  }
}
function decrypt(bytes, passphrase) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < magic.length + 45 ||
    bytes.length > maxBytes + 1048576 ||
    !bytes.subarray(0, magic.length).equals(magic)
  )
    throw Error("Not a supported encrypted Pokedex backup.");
  let offset = magic.length;
  const salt = bytes.subarray(offset, (offset += 16)),
    iv = bytes.subarray(offset, (offset += 12)),
    tag = bytes.subarray(offset, (offset += 16)),
    secret = key(passphrase, salt);
  try {
    const decipher = createDecipheriv("aes-256-gcm", secret, iv);
    decipher.setAAD(magic);
    decipher.setAuthTag(tag);
    const packed = Buffer.concat([
      decipher.update(bytes.subarray(offset)),
      decipher.final(),
    ]);
    return JSON.parse(
      gunzipSync(packed, { maxOutputLength: maxBytes }).toString("utf8"),
    );
  } catch {
    throw Error(
      "Backup could not be opened. The passphrase is wrong or the file is damaged.",
    );
  } finally {
    secret.fill(0);
  }
}
module.exports = { encrypt, decrypt, maxBytes };
