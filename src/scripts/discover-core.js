/* Pure sample-catalogue search. No network, pricing, or storage side effects. */
(() => {
  "use strict";
  const finishNames = {
    normal: "Normal",
    reverse: "Reverse holo",
    holo: "Holo",
    firstEdition: "First edition",
  };
  const finishes = (card) =>
    Object.keys(finishNames).filter((key) => card.variants?.[key]);
  function distance(hex, palette) {
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const chosen = rgb(hex);
    return Math.min(
      ...palette.map((h) => Math.hypot(...rgb(h).map((n, i) => n - chosen[i]))),
    );
  }
  function search(cards, filters) {
    const q = (filters.q || "").trim().toLowerCase();
    const results = cards.filter((c) => {
      const terms = [
        c.name,
        c.collectorNumber,
        c.setName,
        c.setId,
        c.providerId,
      ]
        .join(" ")
        .toLowerCase();
      return (
        (!q ||
          terms.includes(q) ||
          (q.match(/^#?\d+$/) &&
            Number(q.replace("#", "")) === Number(c.collectorNumber))) &&
        (!filters.set || c.setId === filters.set) &&
        (!filters.type || c.pokemonTypes.includes(filters.type)) &&
        (!filters.rarity || c.rarity === filters.rarity) &&
        (!filters.finish || finishes(c).includes(filters.finish))
      );
    });
    if (filters.colorEnabled)
      results.sort(
        (a, b) =>
          distance(filters.color, a.palette) -
            distance(filters.color, b.palette) || a.name.localeCompare(b.name),
      );
    else
      results.sort((a, b) =>
        filters.sort === "number"
          ? a.setName.localeCompare(b.setName) ||
            Number(a.collectorNumber) - Number(b.collectorNumber)
          : filters.sort === "set"
            ? a.setName.localeCompare(b.setName) || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name) ||
              a.providerId.localeCompare(b.providerId),
      );
    return results;
  }
  const subject = (card) =>
    card.name
      .toLowerCase()
      .trim()
      .replace(/\s+(ex|gx|vmax|vstar|v)$/i, "");
  const related = (cards, card) =>
    cards.filter(
      (c) =>
        (c.id || c.collectorNumber) !== (card.id || card.collectorNumber) &&
        subject(c) === subject(card),
    );
  window.DiscoverCatalogue = {
    related,
    search,
    finishes,
    finishNames,
    distance,
  };
})();
