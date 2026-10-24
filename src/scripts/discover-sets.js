(async () => {
  "use strict";
  await window.CardCatalogue?.ready;
  const $ = (id) => document.getElementById(id);
  if (window.CardCatalogue?.enabled)
    $("sets-note").textContent =
      "Browse English sets in the catalogue.";
  $("future-english-sets").hidden = (window.CardCatalogue?.info?.sets.length || 0) > 10;
  const tabs = [$("cards-tab"), $("sets-tab")];
  const grouped = new Map();
  for (const card of window.CARDS || []) {
    if (!grouped.has(card.setId))
      grouped.set(card.setId, {
        id: card.setId,
        name: card.setName,
        cards: [],
      });
    grouped.get(card.setId).cards.push(card);
  }
  const sets = (
    window.CardCatalogue?.info?.sets.map((set) => ({
      ...set,
      cards: set.preview || [],
    })) || [...grouped.values()]
  );
  const printingCount = (set) => set.count ?? set.cards.length;
  const printingLabel = (set) => {
    const count = printingCount(set);
    return count + (set.count == null ? " sample" : "") +
      (count === 1 ? " printing" : " printings");
  };
  function setArt(set) {
    const art = document.createElement("span");
    art.className = "set-art";
    art.setAttribute("aria-hidden", "true");
    const fallback = document.createElement("span");
    fallback.className = "set-logo-fallback";
    fallback.textContent = set.name;
    art.append(fallback);
    const logo = window.CardCatalogue.setLogo(set);
    if (logo) {
      const img = document.createElement("img");
      img.className = "set-logo";
      img.dataset.cardSrc = logo;
      img.width = 280;
      img.height = 120;
      img.decoding = "async";
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => {
        img.classList.add("is-loaded");
        fallback.hidden = true;
      }, { once: true });
      img.addEventListener("error", () => img.remove(), { once: true });
      art.append(img);
    }
    return art;
  }
  function showView(view, focus = false) {
    const isSets = view === "sets";
    tabs.forEach((tab, index) => {
      const selected = (index === 1) === isSets;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $("discover-cards-panel").hidden = isSets;
    $("discover-sets-panel").hidden = !isSets;
    window.DiscoverImages.watch();
    const url = new URL(location.href);
    if (isSets) url.searchParams.set("view", "sets");
    else url.searchParams.delete("view");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (focus) tabs[isSets ? 1 : 0].focus({ preventScroll: true });
  }
  function openSet(set) {
    // A new set starts with an unfiltered sample, never silently inherits other filters.
    $("search-form").reset();
    $("filters-form").reset();
    $("color-enabled").checked = false;
    $("chosen-color").value = "#7eac91";
    $("set-filter").value = set.id;
    $("sort-order").value = "number";
    showView("cards");
    $("set-filter").dispatchEvent(new Event("change", { bubbles: true }));
    $("cards-tab").focus({ preventScroll: true });
    $("discover-cards-panel").scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  }
  function renderSets() {
    const query = $("set-query").value.trim().toLocaleLowerCase();
    const matches = sets.filter((set) =>
      set.name.toLocaleLowerCase().includes(query),
    );
    const sort = $("sets-sort").value;
    matches.sort((a, b) => {
      const byName = a.name.localeCompare(b.name);
      if (sort === "count") return printingCount(b) - printingCount(a) || byName;
      return sort === "name-desc" ? -byName : byName;
    });
    $("sets-grid").replaceChildren(
      ...matches.map((set) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "set-tile";
        button.dataset.setId = set.id;
        button.setAttribute(
          "aria-label",
          "Browse " + set.name + ", " + printingLabel(set),
        );
        const art = setArt(set);
        const meta = document.createElement("span");
        meta.className = "set-meta";
        const name = document.createElement("strong");
        name.textContent = set.name;
        const count = document.createElement("span");
        count.textContent = printingLabel(set);
        meta.append(name, count);
        if (set.missingImages) {
          const badge = document.createElement("small");
          badge.textContent = set.missingImages + " images unavailable";
          meta.append(badge);
        }
        if (set.expectedCount > printingCount(set)) {
          const gap = document.createElement("small");
          gap.textContent = (set.expectedCount - printingCount(set)) + " records unavailable";
          meta.append(gap);
        }
        button.append(art, meta);
        button.addEventListener("click", () => openSet(set));
        return button;
      }),
    );
    window.DiscoverImages.watch($("sets-grid"));
    $("sets-empty").hidden = matches.length > 0;
    $("sets-count").textContent =
      matches.length + " " + (matches.length === 1 ? "set" : "sets");
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showView(index ? "sets" : "cards"));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        next = 1 - index;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = 1;
      else return;
      event.preventDefault();
      showView(next ? "sets" : "cards", true);
    });
  });
  $("set-query").addEventListener("input", renderSets);
  $("sets-sort").addEventListener("change", renderSets);
  $("reset-set-search").addEventListener("click", () => {
    $("set-query").value = "";
    renderSets();
    $("set-query").focus();
  });
  renderSets();
  showView(
    new URLSearchParams(location.search).get("view") === "sets"
      ? "sets"
      : "cards",
  );
})();
