/* Shared collection controls used by the gallery and card picker. */
(() => {
  "use strict";
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function picture(card, large = false) {
    const image = make("img");
    image.src = large
      ? card.imageUrl
      : window.CardCatalogue?.thumbnail(card) || card.imageUrl;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener(
      "error",
      () => {
        const parent = image.parentElement;
        if (!parent) return;
        image.hidden = true;
        parent.classList.add("art-unavailable");
        if (parent.id === "inventory-preview")
          image.replaceWith(
            make("span", "collection-image-fallback", "Image unavailable"),
          );
      },
      { once: true },
    );
    return image;
  }
  function options(select, entries, all) {
    const placeholder = make("option", "", all);
    placeholder.value = "";
    const choices = entries.map(([value, label]) => {
      const option = make("option", "", label);
      option.value = value;
      return option;
    });
    select.replaceChildren(placeholder, ...choices);
  }
  window.CollectionUI = Object.freeze({ make, picture, options });
})();
