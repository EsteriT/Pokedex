const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");
require("./backend-env.cjs")([
  "POKEDEX_SUPABASE_URL",
  "POKEDEX_SUPABASE_PUBLISHABLE_KEY",
  "POKEDEX_USAGE_GATEWAY",
]);
const folder = path.resolve(__dirname, "../src/vendor");
fs.mkdirSync(folder, { recursive: true });
const url = process.env.POKEDEX_SUPABASE_URL || "";
const publishableKey = process.env.POKEDEX_SUPABASE_PUBLISHABLE_KEY || "";
if (!!url !== !!publishableKey)
  throw Error(
    "Set both POKEDEX_SUPABASE_URL and POKEDEX_SUPABASE_PUBLISHABLE_KEY.",
  );
if (url) {
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw Error(
      "Use the Supabase API origin without credentials, a path or query parameters.",
    );
  if (
    !(
      parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co")
    ) &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  )
    throw Error("Use a Supabase HTTPS URL or the local test stack.");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    // Local Supabase may still provide an anon JWT. Reject privileged JWTs.
    let role;
    try {
      if (
        !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(publishableKey)
      )
        throw Error();
      role = JSON.parse(
        Buffer.from(publishableKey.split(".")[1], "base64url"),
      ).role;
    } catch {}
    if (role !== "anon")
      throw Error(
        "Only a publishable key or legacy anon key belongs in the browser.",
      );
  }
}
fs.writeFileSync(
  path.join(folder, "backend-config.js"),
  "window.POKEDEX_BACKEND = " +
    JSON.stringify({
      url,
      publishableKey,
      ...(process.env.POKEDEX_USAGE_GATEWAY === "true" && url
        ? { usageGateway: true }
        : {}),
    }) +
    ";\n",
);
buildSync({
  stdin: {
    contents:
      "import { createClient } from '@supabase/supabase-js'; window.createSupabaseClient = createClient;",
    resolveDir: path.resolve(__dirname, ".."),
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  minify: true,
  outfile: path.join(folder, "supabase.js"),
  legalComments: "eof",
});
const notices = [
  "@supabase/supabase-js",
  "@supabase/auth-js",
  "@supabase/functions-js",
  "@supabase/postgrest-js",
  "@supabase/realtime-js",
  "@supabase/storage-js",
  "@supabase/phoenix",
  "iceberg-js",
  "tslib",
]
  .map((name) => {
    const directory = path.resolve(__dirname, "../node_modules", name);
    const file = fs
      .readdirSync(directory)
      .find((file) => /^licen[cs]e/i.test(file));
    if (!file) throw Error("Missing dependency license: " + name);
    return name + "\n" + fs.readFileSync(path.join(directory, file), "utf8");
  })
  .join("\n\n");
fs.appendFileSync(
  path.join(folder, "supabase.js"),
  "\n/* Third-party notices\n" + notices.replaceAll("*/", "* /") + "\n*/\n",
);
console.log(
  "Built pinned Supabase browser client; backend " +
    (url ? "configured" : "disabled (local prototype)") +
    ".",
);
