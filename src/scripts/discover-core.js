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
    const accepts = (choice, value) => !choice || (Array.isArray(choice) ? !choice.length || choice.includes(value) : choice === value);
    const choices = choice => Array.isArray(choice) ? choice : choice ? [choice] : [];
    const numberMatches = c => /^#?\d+$/.test(q)
      ? Number(q.replace('#','')) === Number(c.collectorNumber)
      : c.collectorNumber.toLowerCase() === q.replace('#','');
    const results = cards.filter((c) => {
      const terms = [
        c.name,
        c.collectorNumber,
        c.setName,
        c.setId,
        c.providerId,
        c.illustrator,
      ]
        .join(" ")
        .toLowerCase();
      const scope = filters.qScope || 'all';
      const queryMatches = !q || (scope === 'name' ? c.name.toLowerCase().includes(q)
        : scope === 'number' ? numberMatches(c)
        : scope === 'set' ? (c.setName + ' ' + c.setId).toLowerCase().includes(q)
        : scope === 'illustrator' ? (c.illustrator || '').toLowerCase().includes(q)
        : /^#?\d+$/.test(q) ? numberMatches(c) : terms.includes(q));
      return (
        queryMatches &&
        accepts(filters.set, c.setId) &&
        (!choices(filters.type).length || (filters.typeMatch === 'all'
          ? choices(filters.type).every(t => c.pokemonTypes.includes(t))
          : c.pokemonTypes.some(t => accepts(filters.type,t)))) &&
        accepts(filters.rarity, c.rarity) &&
        accepts(filters.category, c.category) &&
        (Array.isArray(filters.illustrator) ? accepts(filters.illustrator,c.illustrator) : !filters.illustrator || (c.illustrator || '').toLowerCase().includes(filters.illustrator.toLowerCase())) &&
        (filters.hpMin == null || filters.hpMin === '' || c.hp != null && c.hp >= Number(filters.hpMin)) &&
        (filters.hpMax == null || filters.hpMax === '' || c.hp != null && c.hp <= Number(filters.hpMax)) &&
        (!choices(filters.finish).length || finishes(c).some(f => accepts(filters.finish,f)))
      );
    });
    if (filters.colorEnabled)
      results.sort(
        (a, b) =>
          distance(filters.color, a.palette) -
            distance(filters.color, b.palette) || a.name.localeCompare(b.name),
      );
    else
      results.sort((a, b) => {
        if (filters.sort === 'name-desc') return b.name.localeCompare(a.name) || a.providerId.localeCompare(b.providerId);
        if (filters.sort === 'number-desc') return a.setName.localeCompare(b.setName) || Number(b.collectorNumber) - Number(a.collectorNumber) || a.providerId.localeCompare(b.providerId);
        if (filters.sort === 'hp' || filters.sort === 'hp-desc') return (a.hp == null) - (b.hp == null) || (filters.sort === 'hp' ? 1 : -1) * ((a.hp || 0) - (b.hp || 0)) || a.name.localeCompare(b.name);
        return (
        filters.sort === "number"
          ? a.setName.localeCompare(b.setName) ||
            Number(a.collectorNumber) - Number(b.collectorNumber)
          : filters.sort === "set"
            ? a.setName.localeCompare(b.setName) || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name) ||
              a.providerId.localeCompare(b.providerId)
        );
      });
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
