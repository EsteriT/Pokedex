(() => {
  "use strict";
  const repository = window.BinderRepository || window.BinderStore;
  const $ = (id) => document.getElementById(id),
    catalogue = window.DiscoverCatalogue;
  const cards = window.CARDS || [];
  let activeCard = null,
    detailFocus = null,
    page = 1,
    filtered = [],
    ready = false,
    previousSort = "name";
  const pageSize = 24,
    params = new URLSearchParams(location.search);
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const announce = (text) => ($("discover-message").textContent = text);
  function image(card, large = false) {
    const holder = make("div", "card-image" + (large ? " large-image" : "")),
      img = make("img");
    img.src = card.imageUrl;
    img.alt = card.name + " — " + card.setName + " #" + card.collectorNumber;
    img.loading = large ? "eager" : "lazy";
    img.addEventListener(
      "error",
      () => {
        img.hidden = true;
        holder.append(make("span", "image-unavailable", "Image unavailable"));
      },
      { once: true },
    );
    holder.append(img);
    return holder;
  }
  function options(id, entries, all) {
    $(id).replaceChildren(make("option", "", all));
    $(id).firstChild.value = "";
    entries.forEach(([value, label]) => {
      const n = make("option", "", label);
      n.value = value;
      $(id).append(n);
    });
  }
  function filters() {
    return {
      q: $("card-query").value.trim(),
      set: $("set-filter").value,
      type: $("type-filter").value,
      rarity: $("rarity-filter").value,
      finish: $("finish-filter").value,
      sort:
        $("sort-order").value === "color"
          ? previousSort
          : $("sort-order").value,
      colorEnabled: $("color-enabled").checked,
      color: $("chosen-color").value,
    };
  }
  function remember(f) {
    const query = new URLSearchParams();
    if (new URLSearchParams(location.search).get("view") === "sets")
      query.set("view", "sets");
    for (const key of ["q", "set", "type", "rarity", "finish", "sort"])
      if (f[key] && !(key === "sort" && f[key] === "name"))
        query.set(key, f[key]);
    if (f.colorEnabled) query.set("color", f.color);
    if (page > 1) query.set("page", page);
    history.replaceState(
      null,
      "",
      location.pathname + (query.size ? "?" + query : "") + location.hash,
    );
  }
  function chip(label, clear) {
    const b = make("button", "filter-chip", label);
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("ui-symbol");
    const path = document.createElementNS(icon.namespaceURI, "path");
    path.setAttribute("d", "M6 6l12 12M18 6L6 18");
    icon.append(path);
    b.append(icon);
    b.type = "button";
    b.setAttribute("aria-label", "Remove filter: " + label);
    b.addEventListener("click", () => {
      clear();
      refresh();
      $("card-query").focus();
    });
    return b;
  }
  function refresh(resetPage = true) {
    if (!ready) return;
    const focusId = document.activeElement?.dataset.cardId;
    if (resetPage) page = 1;
    const f = filters();
    filtered = catalogue.search(cards, f);
    page = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
    const shown = filtered.slice((page - 1) * pageSize, page * pageSize);
    $("card-grid").replaceChildren(
      ...shown.map((c) => {
        const b = make("button", "discover-card");
        b.type = "button";
        b.dataset.cardId = c.id || c.collectorNumber;
        b.setAttribute(
          "aria-label",
          "View " + c.name + ", " + c.setName + ", number " + c.collectorNumber,
        );
        const meta = make("div", "card-meta");
        meta.append(
          make("strong", "", c.name),
          make("span", "", c.setName + " · #" + c.collectorNumber),
          make("small", "", c.rarity),
        );
        b.append(image(c), meta);
        b.addEventListener("click", () => openCard(c));
        return b;
      }),
    );
    $("card-grid").hidden = !shown.length;
    $("no-results").hidden = !!shown.length;
    $("results-state").hidden = true;
    $("result-count").textContent =
      `${filtered.length} ${filtered.length === 1 ? "card" : "cards"}${f.colorEnabled ? " · ranked by curated sample colors" : ""}`;
    $("page-status").textContent =
      `Page ${page} of ${Math.max(1, Math.ceil(filtered.length / pageSize))}`;
    $("previous-results").disabled = page === 1;
    $("next-results").disabled = page * pageSize >= filtered.length;
    $("pagination").hidden = !shown.length;
    $("active-filters").replaceChildren();
    if (f.q)
      $("active-filters").append(
        chip("Search: " + f.q, () => ($("card-query").value = "")),
      );
    for (const [key, id] of [
      ["set", "set-filter"],
      ["type", "type-filter"],
      ["rarity", "rarity-filter"],
      ["finish", "finish-filter"],
    ])
      if (f[key])
        $("active-filters").append(
          chip($(id).selectedOptions[0].textContent, () => ($(id).value = "")),
        );
    if (f.colorEnabled)
      $("active-filters").append(
        chip("Color " + f.color, () => ($("color-enabled").checked = false)),
      );
    $("clear-filters").disabled =
      !f.q && !f.set && !f.type && !f.rarity && !f.finish && !f.colorEnabled;
    previousSort = f.sort;
    const colorOption = $("sort-order").querySelector('[value="color"]');
    colorOption.hidden = !f.colorEnabled;
    $("sort-order").value = f.colorEnabled ? "color" : previousSort;
    $("sort-order").disabled = f.colorEnabled;
    const count = [f.set, f.type, f.rarity, f.finish, f.colorEnabled].filter(
      Boolean,
    ).length;
    $("filter-count").textContent = count ? "· " + count + " active" : "";
    $("color-value").textContent = f.color.toUpperCase();
    document.querySelectorAll(".color-swatch").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(
          f.colorEnabled && button.dataset.color === f.color.toLowerCase(),
        ),
      );
    });
    remember(f);
    if (focusId)
      document
        .querySelector('[data-card-id="' + CSS.escape(focusId) + '"]')
        ?.focus({ preventScroll: true });
  }
  function openCard(card) {
    $("detail-message").textContent = "";
    activeCard = card;
    const changingPrinting = $("details-dialog").open;
    if (!changingPrinting) detailFocus = document.activeElement;
    $("detail-art").replaceChildren(image(card, true));
    $("detail-title").textContent = card.name;
    $("detail-set").textContent = card.setName + " · #" + card.collectorNumber;
    const facts = [
      ["Rarity", card.rarity],
      ["Type", card.pokemonTypes.join(" / ") || card.category],
      ["Illustrator", card.illustrator || "Not specified"],
      ["HP", card.hp || "—"],
    ];
    $("card-facts").replaceChildren(
      ...facts.flatMap(([label, value]) => [
        make("dt", "", label),
        make("dd", "", value),
      ]),
    );
    options(
      "detail-finish",
      catalogue.finishes(card).map((key) => [key, catalogue.finishNames[key]]),
      "Select finish",
    );
    const finishes = catalogue.finishes(card);
    $("detail-finish").value = finishes.includes($("finish-filter").value)
      ? $("finish-filter").value
      : finishes[0] || "";
    window.DiscoverCollection?.select(card, $("detail-finish").value);
    $("price-mode").value = "raw";
    $("card-condition").value = "unknown";
    $("grading-company").value = "PSA";
    $("card-grade").value = "9";
    updatePrice();
    $("provider-link").href =
      "https://api.tcgdex.net/v2/en/cards/" +
      encodeURIComponent(card.providerId);
    renderRelated(card);
    if (!changingPrinting) {
      $("details-dialog").showModal();
      document.querySelector(".detail-scroll").scrollTop = 0;
      $("close-details").focus();
    } else {
      $("details-dialog").scrollTop = 0;
      document.querySelector(".detail-scroll").scrollTop = 0;
      $("detail-title").focus({ preventScroll: true });
    }
  }
  function renderRelated(card) {
    const related = catalogue.related(cards, card);
    $("related-description").textContent = related.length
      ? "Other printings in this sample catalogue. Choose one to view its details."
      : "No other printings in this sample. More will appear with the full catalogue.";
    $("related-list").replaceChildren(
      ...related.map((c) => {
        const b = make("button", "discover-card related-card");
        b.type = "button";
        b.setAttribute(
          "aria-label",
          "View related printing: " +
            c.name +
            ", " +
            c.setName +
            " #" +
            c.collectorNumber,
        );
        const info = make("div", "card-meta");
        info.append(
          make("strong", "", c.name),
          make("span", "", c.setName + " · #" + c.collectorNumber),
          make("small", "", c.rarity),
        );
        b.append(image(c), info);
        b.addEventListener("click", () => openCard(c));
        return b;
      }),
    );
  }
  let imageZoom = 1,
    imageReady = false,
    fitWidth = 0,
    fitHeight = 0;
  function updateImageZoom() {
    const img = $("zoomed-image");
    if (imageReady) {
      img.style.width = fitWidth * imageZoom + "px";
      img.style.height = fitHeight * imageZoom + "px";
    }
    $("image-zoom").value = imageZoom;
    $("image-zoom-value").textContent = Math.round(imageZoom * 100) + "%";
    $("image-zoom").disabled = !imageReady;
    $("image-fit").disabled = !imageReady;
    $("image-zoom-in").disabled = !imageReady || imageZoom >= 3;
    $("image-zoom-out").disabled = !imageReady || imageZoom <= 1;
    if (imageReady)
      $("image-status").textContent =
        imageZoom > 1
          ? "Scroll inside the image to explore it. Arrow keys also scroll when the image area is focused."
          : "Image fitted to the viewer. Use Zoom to inspect the artwork and card text.";
  }
  function fitImage() {
    if (!imageReady) return;
    const viewport = $("image-viewport"),
      img = $("zoomed-image"),
      ratio = img.naturalWidth / img.naturalHeight;
    fitHeight = Math.min(
      viewport.clientHeight - 32,
      (viewport.clientWidth - 32) / ratio,
    );
    fitWidth = fitHeight * ratio;
    updateImageZoom();
  }
  $("view-image").addEventListener("click", () => {
    const img = $("zoomed-image");
    imageZoom = 1;
    imageReady = false;
    img.hidden = false;
    img.style.width = "";
    img.style.height = "";
    $("image-title").textContent = activeCard.name;
    $("image-printing").textContent =
      activeCard.setName + " · #" + activeCard.collectorNumber;
    img.alt =
      activeCard.name +
      " — " +
      activeCard.setName +
      " #" +
      activeCard.collectorNumber;
    $("image-status").textContent = "Loading larger image…";
    updateImageZoom();
    $("image-dialog").showModal();
    $("close-image").focus();
    img.src = activeCard.imageUrl;
  });
  $("zoomed-image").addEventListener("load", () => {
    imageReady = true;
    fitImage();
    $("image-viewport").scrollTo(0, 0);
  });
  $("zoomed-image").addEventListener("error", () => {
    imageReady = false;
    $("zoomed-image").hidden = true;
    updateImageZoom();
    $("image-status").textContent =
      "Image unavailable. Close the viewer and try again when your connection is restored.";
  });
  $("close-image").addEventListener("click", () => $("image-dialog").close());
  $("image-dialog").addEventListener("close", () => {
    if (
      $("details-dialog").open &&
      !document.querySelector("#placement-dialog[open]")
    )
      $("view-image").focus({ preventScroll: true });
  });
  $("image-zoom").addEventListener("input", () => {
    imageZoom = Number($("image-zoom").value);
    updateImageZoom();
  });
  for (const [id, delta] of [
    ["image-zoom-in", 0.25],
    ["image-zoom-out", -0.25],
  ])
    $(id).addEventListener("click", () => {
      imageZoom = Math.max(1, Math.min(3, imageZoom + delta));
      updateImageZoom();
    });
  $("image-fit").addEventListener("click", () => {
    imageZoom = 1;
    fitImage();
    $("image-viewport").scrollTo(0, 0);
  });
  new ResizeObserver(() => {
    if ($("image-dialog").open && imageReady) fitImage();
  }).observe($("image-viewport"));
  function updatePrice() {
    const graded = $("price-mode").value === "graded";
    $("raw-fields").hidden = graded;
    $("graded-fields").hidden = !graded;
    const condition = $("card-condition").value,
      grade = $("card-grade").value;
    const amount = graded
      ? { 8: 24, 9: 35, 10: 60 }[grade]
      : { nm: 12.5, lp: 9, mp: 6, hp: 3, damaged: 1.5 }[condition];
    $("price-value").textContent =
      amount === undefined
        ? "No example selected"
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(amount);
    $("price-context").textContent =
      amount === undefined
        ? "Choose a condition to preview the price interface."
        : "Fictional UI example only. This is not an estimate for " +
          activeCard.name +
          ".";
    $("price-source").textContent =
      "Source: illustrative interface data · Updated: not connected";
  }
  async function openPlacement() {
    try {
      if (repository.enabled) await repository.ready;
      const binders = repository.enabled
        ? await repository.refresh()
        : repository.read();
      $("placement-workspace").hidden = !!binders.length;
      if (!binders.length) {
        announce("Create a binder in Workspace first.");
        $("placement-error").textContent =
          "No binders yet. Create one in Workspace, then return here.";
      } else $("placement-error").textContent = "";
      options(
        "target-binder",
        binders.map((b) => [b.id, b.name]),
        "Choose a binder",
      );
      $("target-binder").value = binders[0]?.id || "";
      $("placement-card").textContent =
        activeCard.name +
        " · " +
        activeCard.setName +
        " #" +
        activeCard.collectorNumber;
      updatePages();
      $("details-dialog").close();
      $("placement-dialog").showModal();
      $("target-binder").focus();
    } catch (error) {
      $("detail-message").textContent = error.message;
    }
  }
  function updatePages() {
    try {
      const b = repository
        .read()
        .find((b) => b.id === $("target-binder").value);
      options(
        "target-page",
        b
          ? Array.from(
              { length: b.document?.pages.length || b.pages },
              (_, i) => [String(i), "Page " + (i + 1)],
            )
          : [],
        "Choose a page",
      );
      $("target-page").value = b ? "0" : "";
      $("placement-confirm").disabled = !b;
    } catch (error) {
      $("placement-error").textContent = error.message;
      $("placement-confirm").disabled = true;
    }
  }
  function placeInEditor() {
    try {
      const b = repository
          .read()
          .find((b) => b.id === $("target-binder").value),
        index = Number($("target-page").value);
      if (
        !b ||
        $("target-page").value === "" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= (b.document?.pages.length || b.pages)
      )
        throw Error("Choose a valid binder and page.");
      const destination = new URL($("editor-route").href);
      destination.hash = encodeURIComponent(
        JSON.stringify({
          id: b.id,
          name: b.name,
          pages: b.pages,
          rows: b.rows,
          columns: b.columns,
          cards: b.cards,
          placeCard: activeCard.id || activeCard.collectorNumber,
          finish: $("detail-finish").value,
          page: index,
          returnTo: location.pathname + location.search,
        }),
      );
      location.assign(destination.href);
    } catch (error) {
      $("placement-error").textContent = error.message;
    }
  }
  $("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    refresh();
  });
  $("card-query").addEventListener("input", () => refresh());
  for (const id of [
    "set-filter",
    "type-filter",
    "rarity-filter",
    "finish-filter",
    "sort-order",
    "color-enabled",
    "chosen-color",
  ])
    $(id).addEventListener("change", () => refresh());
  document.querySelectorAll(".color-swatch").forEach((button) => {
    button.addEventListener("click", () => {
      $("chosen-color").value = button.dataset.color;
      $("color-enabled").checked = true;
      refresh();
    });
  });
  function clear() {
    $("search-form").reset();
    $("filters-form").reset();
    $("color-enabled").checked = false;
    $("chosen-color").value = "#7eac91";
    $("sort-order").value = "name";
    refresh();
    $("card-query").focus();
  }
  $("clear-filters").addEventListener("click", clear);
  $("no-results-clear").addEventListener("click", clear);
  for (const [id, delta] of [
    ["previous-results", -1],
    ["next-results", 1],
  ])
    $(id).addEventListener("click", () => {
      page += delta;
      refresh(false);
      $("results-heading").focus();
      $("results-heading").scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    });
  $("close-details").addEventListener("click", () =>
    $("details-dialog").close(),
  );
  $("details-dialog").addEventListener("close", () => {
    window.UIControls.restoreFocus(detailFocus, $("card-query"));
  });
  for (const id of [
    "price-mode",
    "card-condition",
    "card-grade",
    "grading-company",
    "detail-finish",
  ])
    $(id).addEventListener("change", updatePrice);
  $("add-to-binder").addEventListener("click", openPlacement);
  $("add-to-collection").addEventListener("click", () =>
    window.DiscoverCollection.open(activeCard, $("detail-finish").value),
  );
  $("detail-finish").addEventListener("change", () =>
    window.DiscoverCollection.select(activeCard, $("detail-finish").value),
  );
  $("target-binder").addEventListener("change", updatePages);
  $("target-page").addEventListener("change", () => {
    $("placement-confirm").disabled = $("target-page").value === "";
  });
  $("placement-confirm").addEventListener("click", placeInEditor);
  $("placement-cancel").addEventListener("click", () => {
    $("placement-dialog").close();
    $("details-dialog").showModal();
    $("add-to-binder").focus();
  });
  $("placement-dialog").addEventListener("cancel", (e) => {
    e.preventDefault();
    $("placement-cancel").click();
  });
  document.addEventListener("click", (e) =>
    document.querySelectorAll(".account[open]").forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    }),
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll(".account[open]")
        .forEach((d) => (d.open = false));
  });
  function initialize() {
    try {
      if (!cards?.length || !catalogue)
        throw Error("Sample catalogue is unavailable.");
      options(
        "set-filter",
        [...new Map(cards.map((c) => [c.setId, c.setName])).entries()].sort(
          (a, b) => a[1].localeCompare(b[1]),
        ),
        "All sets",
      );
      options(
        "type-filter",
        [...new Set(cards.flatMap((c) => c.pokemonTypes))]
          .sort()
          .map((v) => [v, v]),
        "All types",
      );
      options(
        "rarity-filter",
        [...new Set(cards.map((c) => c.rarity))].sort().map((v) => [v, v]),
        "All rarities",
      );
      options(
        "finish-filter",
        Object.entries(catalogue.finishNames).filter(([key]) =>
          cards.some((c) => c.variants?.[key]),
        ),
        "All finishes",
      );
      for (const [key, id] of [
        ["q", "card-query"],
        ["set", "set-filter"],
        ["type", "type-filter"],
        ["rarity", "rarity-filter"],
        ["finish", "finish-filter"],
        ["sort", "sort-order"],
      ])
        if (params.has(key)) {
          const value = params.get(key);
          if (key === "q" || [...$(id).options].some((n) => n.value === value))
            $(id).value = value;
        }
      if (/^#[a-f0-9]{6}$/i.test(params.get("color") || "")) {
        $("chosen-color").value = params.get("color");
        $("color-enabled").checked = true;
      }
      page = Math.max(1, parseInt(params.get("page"), 10) || 1);
      ready = true;
      refresh(false);
      $("catalogue-note").textContent =
        `${cards.length} sample printings across ${new Set(cards.map((c) => c.setId)).size} sets · full catalogue and live prices coming later.`;
    } catch (error) {
      $("results-state").hidden = false;
      $("results-state").textContent = error.message;
      $("retry").hidden = false;
    }
  }
  $("retry").addEventListener("click", () => location.reload());
  document.addEventListener("click", (event) => {
    if ($("filters-panel").open && !$("filters-panel").contains(event.target))
      $("filters-panel").open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      !document.querySelector("dialog[open]") &&
      $("filters-panel").open
    ) {
      $("filters-panel").open = false;
      $("filters-title").focus({ preventScroll: true });
      event.preventDefault();
    }
  });
  initialize();
})();
