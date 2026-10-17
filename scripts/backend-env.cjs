const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const file = path.resolve(__dirname, "../.env.local");
const values = fs.existsSync(file)
  ? parseEnv(fs.readFileSync(file, "utf8"))
  : {};
module.exports = function load(keys) {
  for (const key of keys)
    if (process.env[key] === undefined && values[key])
      process.env[key] = values[key];
};
