const fs = require("node:fs"),
  path = require("node:path");
const { config, heartbeat, run, target } = require("./backup-automation.cjs");
require("./backend-env.cjs")([
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "HEALTHCHECKS_PING_URL",
  "POKEDEX_BACKUP_PASSPHRASE",
  "POKEDEX_BACKUP_SECRET_KEY",
  "SUPABASE_ACCESS_TOKEN",
]);
async function main() {
  let settings;
  try {
    settings = config(process.env);
  } catch (error) {
    try {
      await heartbeat(process.env.HEALTHCHECKS_PING_URL, "fail");
    } catch {}
    throw error;
  }
  const runtime = path.resolve(__dirname, "../.scratch/runtime");
  fs.mkdirSync(runtime, { recursive: true });
  const directory = fs.mkdtempSync(path.join(runtime, "backup-run-"));
  const store = require("./backup-r2.cjs").connect(process.env);
  process.env.POKEDEX_BACKUP_URL = "https://" + target + ".supabase.co";
  try {
    const result = await run({
      store,
      passphrase: settings.passphrase,
      ping: (signal) => heartbeat(settings.ping, signal),
      snapshot: async () => {
        const file = await require("./backend-ops.cjs").main(
          "backup",
          ["--hosted", target],
          {
            directory,
            quiet: true,
            query: (sql, t) =>
              require("./backup-supabase.cjs").readOnlyQuery(
                sql,
                t.label,
                process.env.SUPABASE_ACCESS_TOKEN,
              ),
          },
        );
        return fs.readFileSync(file);
      },
    });
    console.log("Verified encrypted R2 backup: " + JSON.stringify(result));
  } finally {
    store.close();
    if (
      path.dirname(directory) !== runtime ||
      !path.basename(directory).startsWith("backup-run-")
    )
      throw Error("Refused cleanup outside this backup's temporary directory.");
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main };
