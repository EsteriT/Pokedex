const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const pages = require("./project-pages.cjs");
let backendConfig;
for (const [entry, name] of pages) {
  const html = fs.readFileSync(path.join(root, "preview", name), "utf8");
  const match = html.match(/window\.POKEDEX_BACKEND = (.+);/);
  assert(
    entry === "index.html" || match,
    "Missing embedded backend configuration: " + name,
  );
  if (!match) continue;
  const backend = JSON.parse(match[1]);
  if (backend.url && new URL(backend.url).protocol !== "https:")
    throw Error(
      "Refusing to publish a local Supabase configuration. Use hosted settings or an unconfigured prototype build.",
    );
  const config = JSON.stringify(backend);
  assert(
    backendConfig === undefined || backendConfig === config,
    "Preview pages have inconsistent backend configurations. Rebuild all previews.",
  );
  backendConfig = config;
}
const output = path.join(root, "dist");
const allowed = new Set([
  "index.html",
  ".nojekyll",
  ...pages.map(([, name]) => name),
]);
if (fs.existsSync(output))
  for (const name of fs.readdirSync(output))
    assert(allowed.has(name), "Unexpected file in deployment output: " + name);
fs.mkdirSync(output, { recursive: true });
for (const [, name] of pages) {
  fs.copyFileSync(path.join(root, "preview", name), path.join(output, name));
}
const landing = pages.find(([entry]) => entry === "index.html")[1];
fs.copyFileSync(path.join(output, landing), path.join(output, "index.html"));
fs.writeFileSync(path.join(output, ".nojekyll"), "");
// Validate the published artifact, including relative links under a project path.
for (const name of ["index.html", ...pages.map(([, name]) => name)]) {
  const html = fs.readFileSync(path.join(output, name), "utf8");
  assert(!/<(?:script[^>]+src|link[^>]+rel="stylesheet")/.test(html), name);
  if (name === "index.html" || name === landing) {
    assert(
      /id="viewer-route" href="Pokedex-viewer.html"/.test(html),
      "Missing hosted sample viewer route",
    );
  }
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(ref)) continue;
    const url = new URL(ref, "https://example.test/Pokedex/" + name);
    assert(
      url.pathname.startsWith("/Pokedex/"),
      "Escapes project path: " + ref,
    );
    assert(
      fs.existsSync(
        path.join(output, decodeURIComponent(url.pathname.slice(9))),
      ),
      "Missing published file: " + ref,
    );
  }
}
console.log("Pages deployment built and verified in dist/.");
