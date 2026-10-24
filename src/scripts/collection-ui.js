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
    return window.CardCatalogue.picture(card, large);
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
