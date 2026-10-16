/* One manifest for preview builds and dependency checks. */
module.exports = Object.freeze(
  [
    ["index.html", "Pokedex-landing-page.html"],
    ["workspace.html", "Pokedex-workspace.html"],
    ["editor.html", "Pokedex-editor.html"],
    ["discover.html", "Pokedex-discover.html"],
    ["viewer.html", "Pokedex-viewer.html"],
  ].map(Object.freeze),
);
