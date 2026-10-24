/* Public metadata only. Account documents and login tokens never enter this cache. */
(() => {
  "use strict";
  const cards = window.CARDS;
  const byId = new Map(cards.map((c) => [c.id || c.collectorNumber, c]));
  const config = window.POKEDEX_BACKEND || {};
  const sampleCards = [...cards];
  let remote = false,
    info = null;
  const searches = new Map();
  const pendingSearches = new Map();
  const imageAllowed = (value) =>
    value === "" ||
    /^https:\/\/assets\.tcgdex\.net\/en\/[A-Za-z0-9./_-]+\/high\.webp$/.test(
      value,
    );
  function register(rows) {
    if (!Array.isArray(rows) || rows.length > 100)
      throw Error("Invalid catalogue response.");
    const safeRows = rows.map((row) => {
      if (
        !row ||
        typeof row.id !== "string" ||
        !/^[A-Za-z0-9_.-]{1,80}$/.test(row.id) ||
        typeof row.name !== "string" ||
        row.name.length > 160 ||
        !imageAllowed(row.imageUrl) ||
        !Array.isArray(row.pokemonTypes) ||
        !row.variants ||
        typeof row.setId !== "string" ||
        typeof row.setName !== "string" ||
        typeof row.collectorNumber !== "string" ||
        typeof row.providerId !== "string" ||
        row.providerId.length > 80 ||
        row.setId.length > 40 ||
        row.setName.length > 160 ||
        row.collectorNumber.length > 30 ||
        row.pokemonTypes.length > 4 ||
        row.pokemonTypes.some((t) => typeof t !== "string" || t.length > 30) ||
        typeof row.rarity !== "string" ||
        row.rarity.length > 100 ||
        typeof row.category !== "string" ||
        row.category.length > 40 ||
        typeof row.illustrator !== "string" ||
        row.illustrator.length > 160 ||
        !Array.isArray(row.palette) ||
        row.palette.length > 8 ||
        row.palette.some((c) => !/^#[a-f0-9]{6}$/i.test(c)) ||
        ["normal", "reverse", "holo", "firstEdition", "wPromo"].some(
          (key) => typeof row.variants[key] !== "boolean",
        )
      )
        throw Error("Invalid card metadata. Reload the catalogue.");
      // Never assign unknown properties from public responses or recovery files.
      const safe = Object.fromEntries(
        [
          "id",
          "providerId",
          "collectorNumber",
          "name",
          "imageUrl",
          "setId",
          "setName",
          "rarity",
          "category",
          "illustrator",
        ].map((key) => [key, row[key]]),
      );
      safe.pokemonTypes = [...row.pokemonTypes];
      safe.palette = [...row.palette];
      safe.hp =
        Number.isInteger(row.hp) && row.hp >= 0 && row.hp <= 10000
          ? row.hp
          : null;
      safe.variants = Object.fromEntries(
        ["normal", "reverse", "holo", "firstEdition", "wPromo"].map((key) => [
          key,
          row.variants[key],
        ]),
      );
      return safe;
    });
    for (const row of safeRows) {
      const prior = byId.get(row.id);
      if (prior) Object.assign(prior, row);
      else {
        const card = { ...row, palette: row.palette || [] };
        byId.set(row.id, card);
        cards.push(card);
      }
    }
    return safeRows.map((row) => byId.get(row.id));
  }
  async function rpc(name, body) {
    const response = await (window.PokedexFetch || fetch)(
      config.url + "/rest/v1/rpc/" + name,
      {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
        credentials: "omit",
        redirect: "error",
      },
    );
    if (!response.ok) {
      if (window.PokedexFetch?.error)
        throw await window.PokedexFetch.error(
          response,
          "Catalogue could not load. Please retry.",
        );
      throw Error("Catalogue could not load. Please retry.");
    }
    return response.json();
  }
  let limitedStartup = null,
    retryAt = 0,
    retrying = null;
  async function initialize() {
    if (!config.url || config.catalogue === false) return;
    try {
      const result = await rpc("catalogue_info", {});
      if (!Array.isArray(result?.sets) || !result.sets.length) return;
      if (
        result.sets.length > 500 ||
        !Number.isInteger(result.count) || result.count < 1 || result.count > 50000 ||
        result.sets.some(set => !set || typeof set.id !== 'string' ||
          !/^[A-Za-z0-9.-]{1,40}$/.test(set.id) || typeof set.name !== 'string' ||
          set.name.length > 160 || !Number.isInteger(set.count) || set.count < 1 ||
          set.count > 1000 || (set.preview && (!Array.isArray(set.preview) || set.preview.length > 3))) ||
        new Set(result.sets.map(set => set.id)).size !== result.sets.length ||
        !Array.isArray(result.types) ||
        !Array.isArray(result.rarities)
      )
        throw Error();
      for (const set of result.sets) register(set.preview || []);
      info = result;
      remote = true;
      limitedStartup = null;
    } catch (error) {
      if (error.code === "PXD429") {
        limitedStartup = error;
        retryAt = Date.now() + error.retryAfter * 1000;
      }
      /* An older backend retains its sample catalogue until migration/import. */
    }
  }
  const ready = initialize();
  async function connected() {
    await ready;
    if (!limitedStartup) return;
    if (Date.now() < retryAt) throw limitedStartup;
    retrying ||= initialize().finally(() => {
      retrying = null;
    });
    await retrying;
    if (limitedStartup) throw limitedStartup;
  }
  async function search(filters = {}, page = 1) {
    await connected();
    if (!remote || filters.colorEnabled) {
      const source = filters.colorEnabled ? sampleCards : cards;
      const found = window.DiscoverCatalogue.search(source, filters);
      return {
        total: found.length,
        cards: found.slice((page - 1) * 24, page * 24),
      };
    }
    const clean = Object.fromEntries(
      ["q", "set", "type", "rarity", "finish", "sort", "category", "illustrator", "hpMin", "hpMax", "qScope", "typeMatch"].map((key) => [
        key,
        Array.isArray(filters[key]) ? [...filters[key]] : String(filters[key] ?? ""),
      ]),
    );
    if (!clean.sort) clean.sort = "name";
    clean.q = clean.q.trim().slice(0, 120);
    const key = JSON.stringify([clean, page]);
    if (searches.has(key)) return searches.get(key);
    if (pendingSearches.has(key)) return pendingSearches.get(key);
    const pending = rpc("search_catalogue", {
      filters: clean,
      page_number: page,
    })
      .then((result) => {
        if (
          !Number.isSafeInteger(result?.total) ||
          result.total < 0 ||
          !Array.isArray(result.cards) ||
          result.cards.length > 24
        )
          throw Error("Invalid search response.");
        const value = { total: result.total, cards: register(result.cards) };
        searches.set(key, value);
        if (searches.size > 40) searches.delete(searches.keys().next().value);
        return value;
      })
      .finally(() => pendingSearches.delete(key));
    pendingSearches.set(key, pending);
    return pending;
  }
  async function ensure(value) {
    const ids = new Set(),
      stack = [value];
    let visited = 0;
    while (stack.length) {
      if (++visited > 150000) throw Error("Document is too complex.");
      const item = stack.pop();
      if (!item || typeof item !== "object") continue;
      if (typeof item.cardId === "string") ids.add(item.cardId);
      if (typeof item.placeCard === "string") ids.add(item.placeCard);
      if (Array.isArray(item.cards))
        for (const id of item.cards) if (typeof id === "string") ids.add(id);
      for (const child of Object.values(item))
        if (child && typeof child === "object") stack.push(child);
    }
    await connected();
    const missing = [...ids].filter((id) => !byId.has(id));
    if (!missing.length) return;
    if (!remote)
      throw Error(
        "This file needs the connected catalogue. No saved data was changed.",
      );
    for (let start = 0; start < missing.length; start += 100) {
      const batch = missing.slice(start, start + 100);
      register(await rpc("catalogue_cards", { ids: batch }));
      if (batch.some((id) => !byId.has(id)))
        throw Error(
          "A saved printing is unavailable. No saved data was changed.",
        );
    }
  }
  function sets() {
    return (
      info?.sets || [
        ...new Map(
          sampleCards.map((c) => [c.setId, { id: c.setId, name: c.setName }]),
        ).values(),
      ]
    );
  }
  // Keep canonical artwork full-size; only small browsing tiles use thumbnails.
  function thumbnail(card) {
    const source = card?.imageUrl || "";
    return /^https:\/\/assets\.tcgdex\.net\/en\/[A-Za-z0-9_./-]+\/high\.webp$/.test(
      source,
    )
      ? source.replace(/\/high\.webp$/, "/low.webp")
      : source;
  }
  function picture(card, large = false) {
    const image = document.createElement("img");
    const unavailable = () => {
      image.dataset.imageUnavailable = "true";
      image.alt = "Image unavailable for " + (card?.name || "this card");
      image.src = "data:image/svg+xml," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 245 337"><rect x="1" y="1" width="243" height="335" rx="8" fill="#edf1f7" stroke="#8b95a5"/><path d="M85 147h75v54H85zm0 42 23-22 18 17 12-12 22 20" fill="none" stroke="#596273" stroke-width="3"/><text x="122.5" y="230" text-anchor="middle" fill="#596273" font-family="sans-serif" font-size="15">Image unavailable</text></svg>',
      );
    };
    image.alt = card?.name || "Card";
    image.loading = large ? "eager" : "lazy";
    image.decoding = "async";
    image.draggable = false;
    image.addEventListener("error", unavailable, { once: true });
    const source = large ? card?.imageUrl : thumbnail(card);
    if (source) image.src = source;
    else unavailable();
    return image;
  }
  function setLogo(set) {
    if (set?.logo === null) return "";
    const asset = /^https:\/\/assets\.tcgdex\.net\/en\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/logo(?:\.webp)?$/;
    if (typeof set?.logo === "string") {
      const match = set.logo.match(asset);
      if (match && match[2] === set.id)
        return set.logo.replace(/(?:\.webp)?$/, ".webp");
    }
    // Older catalogue responses omit logos; reuse their canonical card asset directory.
    for (const card of set?.preview || set?.cards || []) {
      const match = card.imageUrl?.match(/^https:\/\/assets\.tcgdex\.net\/en\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/[A-Za-z0-9_.-]+\/high\.webp$/);
      if (match && match[2] === set.id)
        return "https://assets.tcgdex.net/en/" + match[1] + "/" + match[2] + "/logo.webp";
    }
    return "";
  }
  window.CardCatalogue = {
    setLogo,
    thumbnail,
    picture,
    ready,
    byId,
    search,
    ensure,
    sets,
    register,
    get enabled() {
      return remote;
    },
    get info() {
      return info;
    },
  };
})();
