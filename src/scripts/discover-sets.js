(async () => {
  "use strict";
  await window.CardCatalogue?.ready;
  const $ = (id) => document.getElementById(id);
  if (window.CardCatalogue?.enabled)
    $("sets-note").textContent =
      "Browse the ten English trial sets. More sets will follow after review.";
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
      cards: set.preview,
    })) || [...grouped.values()]
  ).sort((a, b) => a.name.localeCompare(b.name));
  let lastSetButton = null;
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
  function openSet(set, button) {
    lastSetButton = button;
    // A new set starts with an unfiltered sample, never silently inherits other filters.
    $("search-form").reset();
    $("filters-form").reset();
    $("color-enabled").checked = false;
    $("chosen-color").value = "#7eac91";
    $("set-filter").value = set.id;
    $("sort-order").value = "number";
    showView("cards");
    $("set-filter").dispatchEvent(new Event("change", { bubbles: true }));
    $("back-to-sets").hidden = false;
    $("back-to-sets").focus({ preventScroll: true });
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
    $("sets-grid").replaceChildren(
      ...matches.map((set) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "set-tile";
        button.dataset.setId = set.id;
        button.setAttribute(
          "aria-label",
          "Browse " +
            set.name +
            ", " +
            (set.count || set.cards.length) +
            (set.cards.length === 1 ? " printing" : " printings"),
        );
        const art = document.createElement("span");
        art.className = "set-art";
        art.setAttribute("aria-hidden", "true");
        art.style.setProperty(
          "--set-tint",
          set.cards[0]?.palette?.[0] || "var(--lavender)",
        );
        set.cards.slice(0, 3).forEach((card, index) => {
          const img = document.createElement("img");
          img.dataset.cardSrc =
            window.CardCatalogue?.thumbnail(card) || card.imageUrl;
          img.width = 245;
          img.height = 337;
          img.decoding = "async";
          img.alt = "";
          img.loading = "lazy";
          img.style.setProperty("--card-index", index);
          img.addEventListener("error", () => img.remove(), { once: true });
          art.append(img);
        });
        const meta = document.createElement("span");
        meta.className = "set-meta";
        const name = document.createElement("strong");
        name.textContent = set.name;
        const count = document.createElement("span");
        count.textContent =
          (set.count || set.cards.length) +
          (set.cards.length === 1 ? " printing" : " printings");
        const badge = document.createElement("small");
        badge.textContent = set.count
          ? set.missingImages
            ? set.missingImages + " images unavailable"
            : "English - TCGdex"
          : "Sample set";
        meta.append(name, count, badge);
        button.append(art, meta);
        button.addEventListener("click", () => openSet(set, button));
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
  $("back-to-sets").addEventListener("click", () => {
    showView("sets");
    if (lastSetButton?.isConnected) {
      lastSetButton.focus({ preventScroll: true });
      lastSetButton.scrollIntoView({ block: "nearest", behavior: "instant" });
    } else $("sets-tab").focus();
  });
  $("set-query").addEventListener("input", renderSets);
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
