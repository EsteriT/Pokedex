const fs = require("fs"),
  path = require("path"),
  vm = require("vm");
const root = path.resolve(__dirname, "..");
const pages = require("./project-pages.cjs");
const outputs = new Map(pages);

function embedStyles(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/url\(["']?([^"')]+)["']?\)/g, (match, ref) => {
      if (!ref.startsWith("../../assets/fonts/")) return match;
      const font = fs.readFileSync(path.resolve(path.dirname(file), ref));
      return 'url("data:font/ttf;base64,' + font.toString("base64") + '")';
    });
}

fs.mkdirSync(path.join(root, "preview"), { recursive: true });
for (const [entry, output] of pages) {
  const source = path.join(root, "src", entry);
  let html = fs.readFileSync(source, "utf8");
  html = html.replace(
    /<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g,
    (_, file) =>
      "<style>" +
      embedStyles(path.resolve(path.dirname(source), file)) +
      "</style>",
  );
  html = html.replace(
    /<script\s+src="([^"]+)"\s*>\s*<\/script>/g,
    (_, file) => {
      let code = fs.readFileSync(
        path.resolve(path.dirname(source), file),
        "utf8",
      );
      if (file === "data/sample-artwork.js") {
        const artwork = fs.readFileSync(
          path.join(root, "assets/images/pokemon-cover-art.jpg"),
        );
        code = code.replace(
          JSON.stringify("../assets/images/pokemon-cover-art.jpg"),
          JSON.stringify(
            "data:image/jpeg;base64," + artwork.toString("base64"),
          ),
        );
      }
      new vm.Script(code, { filename: file });
      return "<script>" + code + "</script>";
    },
  );
  html = html.replace(
    /href="([^"#]+\.html)(#[^"]*)?"/g,
    (match, file, hash = "") =>
      outputs.has(file) ? 'href="' + outputs.get(file) + hash + '"' : match,
  );
  fs.writeFileSync(path.join(root, "preview", output), html);
  console.log("Built " + output + "; embedded JavaScript parsed successfully.");
}
