const { spawnSync } = require("node:child_process");
const path = require("node:path");
require("./backend-env.cjs")([
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID",
  "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET",
]);
const action = process.argv[2];
if (!["start", "stop", "status"].includes(action))
  throw Error("Use start, stop or status.");
if (
  action === "start" &&
  (!process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID ||
    !process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)
) {
  console.error(
    "Fill the two Google OAuth values in .env.local first. See docs/BACKEND-FOUNDATION.md.",
  );
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [
    path.resolve(__dirname, "../node_modules/supabase/dist/supabase.js"),
    action,
  ],
  { stdio: "inherit", env: process.env, cwd: path.resolve(__dirname, "..") },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
