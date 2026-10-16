const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
require("./build-preview.cjs");
const root = path.resolve(__dirname, "..");
const pages = require("./project-pages.cjs");
const output = path.join(root, "dist");
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
    assert(/id="viewer-route" href="Pokedex-viewer.html"/.test(html), "Missing hosted sample viewer route");
  }
  for (const [, ref] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(ref)) continue;
    const url = new URL(ref, "https://example.test/Pokedex/" + name);
    assert(url.pathname.startsWith("/Pokedex/"), "Escapes project path: " + ref);
    assert(fs.existsSync(path.join(output, decodeURIComponent(url.pathname.slice(9)))), "Missing published file: " + ref);
  }
}
console.log("Pages deployment built and verified in dist/.");
