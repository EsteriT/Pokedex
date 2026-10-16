const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
const root = path.resolve(__dirname, "..");
const pages = require("./project-pages.cjs");
let checked = 0;
for (const [entry] of pages) {
  const source = path.join(root, "src", entry),
    html = fs.readFileSync(source, "utf8");
  const ids = new Set();
  for (const match of html.matchAll(/(?:^|\s)id="([^"]+)"/g)) {
    if (ids.has(match[1]))
      throw Error("Duplicate HTML id in " + entry + ": " + match[1]);
    ids.add(match[1]);
  }
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const ref = match[1];
    if (/^(?:https?:|#|data:)/.test(ref)) continue;
    const file = path.resolve(path.dirname(source), ref.split("#")[0]);
    if (!fs.existsSync(file))
      throw Error("Missing dependency in " + entry + ": " + ref);
    checked++;
  }
}
// Parse every source module, including newly added helpers.
let modules = 0;
for (const directory of ["scripts", "data"]) {
  const folder = path.join(root, "src", directory);
  for (const file of fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".js"))) {
    const source = path.join(folder, file);
    new vm.Script(fs.readFileSync(source, "utf8"), { filename: source });
    modules++;
  }
}
// CSS asset references must exist even when the source pages are opened directly.
for (const file of fs
  .readdirSync(path.join(root, "src/styles"))
  .filter((file) => file.endsWith(".css"))) {
  const source = path.join(root, "src/styles", file);
  for (const match of fs
    .readFileSync(source, "utf8")
    .matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
    const ref = match[1];
    if (/^(?:data:|https?:|#)/.test(ref)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(source), ref)))
      throw Error("Missing CSS asset: " + file + ": " + ref);
  }
}
for (const name of [
  "README.md",
  "AGENTS.md",
  "docs/HANDOFF.md",
  "docs/DESIGN.md",
  "docs/ARCHITECTURE.md",
  "docs/WEBSITE-GOALS-AND-FUNCTIONS.md",
])
  if (!fs.existsSync(path.join(root, name)))
    throw Error("Missing document: " + name);
for (const [, file] of pages) {
  const html = fs.readFileSync(path.join(root, "preview", file), "utf8");
  if (/<link\s+rel="stylesheet"|<script\s+src=/.test(html))
    throw Error("Preview dependency was not embedded: " + file);
  if (
    /url\(["']?(?:\.\.\/)*assets\/fonts\//.test(html) ||
    html.includes('window.CUSTOMIZE_ART = "../assets/images/')
  )
    throw Error("Preview binary assets were not embedded: " + file);
  for (const match of html.matchAll(/href="([^"#]+\.html)(?:#[^"]*)?"/g))
    if (!fs.existsSync(path.join(root, "preview", match[1])))
      throw Error("Broken preview page link: " + match[1]);
}
console.log(
  "Checked " +
    checked +
    " source references, " +
    modules +
    " JavaScript modules, static HTML IDs, required documents, and all standalone preview links.",
);
