/* Portable application data only. Credentials and browser drafts are excluded. */
(() => {
  "use strict";
  const maxBytes = 80 * 1024 * 1024;
  function image(src) {
    if (
      typeof src !== "string" ||
      src.length > 666710 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)
    )
      throw Error("Invalid backup artwork.");
    const bytes = atob(src.slice(src.indexOf(",") + 1));
    if (!bytes.length || bytes.length > 500000)
      throw Error("Backup artwork is too large.");
    return src;
  }
  function validate(input) {
    if (
      !input ||
      input.format !== "pokedex-account" ||
      input.version !== 1 ||
      !Array.isArray(input.binders) ||
      input.binders.length > 3 ||
      !Array.isArray(input.artwork) ||
      input.artwork.length > 60
    )
      throw Error("This is not a supported Pokedex account backup.");
    const collection = window.CollectionState.validate(input.collection);
    if (new Blob([JSON.stringify(collection)]).size > 16 * 1024 * 1024)
      throw Error("Account collections are limited to 16 MB.");
    return {
      format: "pokedex-account",
      version: 1,
      exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "",
      binders: input.binders.map((b) => window.BinderStore.validate(b)),
      collection,
      artwork: [...new Set(input.artwork.map(image))],
    };
  }
  window.AccountBackup = { maxBytes, image, validate };
})();
