/* Expanded catalogue: selection is a draft until the existing binder action runs. */
(() => {
  "use strict";
  window.EditorCardBrowser = {
    init(h) {
      const $ = (id) => document.getElementById(id);
      const make = (tag, text, cls = "") => {
        const n = document.createElement(tag);
        n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
      };
      const button = (text, action, primary = false) => {
        const b = make(
          "button",
          text,
          "browser-button" + (primary ? " primary" : ""),
        );
        b.type = "button";
        b.addEventListener("click", action);
        return b;
      };
      const chosen = new Set(),
        filters = {};
      let page = 0,
        matches = [],
        total = 0,
        request = 0,
        timer,
        origin;
      const dialog = make("dialog", undefined, "binder-card-browser");
      dialog.id = "binder-card-browser";
      dialog.setAttribute("aria-labelledby", "binder-card-browser-title");
      const heading = make("header", undefined, "card-browser-heading");
      const title = make("h2", "Add cards to binder");
      title.id = "binder-card-browser-title";
      const close = button("", () => dialog.close());
      close.classList.add("icon-button");
      const closeIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      closeIcon.setAttribute("class", "ui-symbol");
      closeIcon.setAttribute("viewBox", "0 0 24 24");
      closeIcon.setAttribute("aria-hidden", "true");
      const closePath = document.createElementNS(closeIcon.namespaceURI, "path");
      closePath.setAttribute("d", "M6 6l12 12M18 6L6 18");
      closeIcon.append(closePath);
      close.append(closeIcon);
      close.setAttribute("aria-label", "Close card catalogue");
      heading.append(title, close);
      const searchRow = make("div", undefined, "card-browser-search");
      const search = make("input");
      search.type = "search";
      search.placeholder = "Find a card by name, number, or set";
      search.maxLength = 120;
      search.setAttribute("aria-label", "Search expanded card catalogue");
      searchRow.append(search);
      const body = make("div", undefined, "card-browser-body");
      const filterPanel = make("aside", undefined, "card-browser-filters");
      filterPanel.setAttribute("aria-label", "Catalogue filters");
      function select(key, label, entries, all) {
        const field = make("label", label),
          control = make("select");
        control.id = "browser-" + key;
        for (const [value, text] of [["", all], ...entries]) {
          const option = make("option", text);
          option.value = value;
          control.append(option);
        }
        control.addEventListener("change", () => load());
        filters[key] = control;
        field.append(control);
        filterPanel.append(field);
      }
      const values = (key) =>
        [...new Set(window.CARDS.flatMap((c) => c[key] || []).filter(Boolean))]
          .sort()
          .map((v) => [v, v]);
      const info = window.CardCatalogue.info;
      select(
        "set",
        "Set",
        window.CardCatalogue.sets().map((s) => [s.id, s.name]),
        "All sets",
      );
      select(
        "type",
        "Type",
        info?.types?.map((v) => [v, v]) || values("pokemonTypes"),
        "All types",
      );
      select(
        "rarity",
        "Rarity",
        info?.rarities?.map((v) => [v, v]) || values("rarity"),
        "All rarities",
      );
      select(
        "finish",
        "Available finish",
        Object.entries(window.DiscoverCatalogue.finishNames),
        "Any finish",
      );
      select(
        "sort",
        "Sort",
        [
          ["number", "Card number"],
          ["set", "Set"],
        ],
        "Name A\u2013Z",
      );
      filterPanel.append(
        button("Clear filters", () => {
          Object.values(filters).forEach((c) => (c.value = ""));
          load();
        }),
      );
      const catalogue = make("section", undefined, "card-browser-catalogue");
      catalogue.setAttribute("aria-label", "Card catalogue");
      const status = make("p", "", "card-browser-status");
      status.setAttribute("role", "status");
      const grid = make("div", undefined, "card-browser-grid");
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", "Select cards to add");
      const more = button("Load more cards", () => load(true));
      more.hidden = true;
      const retry = button("Retry search", () => load());
      retry.hidden = true;
      catalogue.append(status, grid, retry, more);
      body.append(filterPanel, catalogue);
      const footer = make("footer", undefined, "card-browser-actions");
      const selected = make("span", "0 selected");
      selected.setAttribute("role", "status");
      const clear = button("Clear selection", () => {
        chosen.clear();
        sync();
      });
      const cancel = button("Cancel", () => dialog.close());
      const add = button(
        "Add to binder",
        () => {
          if (!chosen.size) return;
          const ok = h.run(
            () =>
              h.state.addCards(
                [...chosen].map((cardId) => ({ cardId })),
                h.page().id,
              ),
            "Cards added. Save to keep your changes.",
          );
          if (ok) {
            h.clearSelection();
            chosen.clear();
            dialog.close();
          } else
            status.textContent =
              "Cards could not be added. Your selection is kept; close the catalogue to read the binder message.";
        },
        true,
      );
      add.id = "browser-add-cards";
      footer.append(selected, clear, cancel, add);
      dialog.append(heading, searchRow, body, footer);
      document.body.append(dialog);
      function sync() {
        selected.textContent = chosen.size + " selected";
        add.textContent = chosen.size
          ? "Add " +
            chosen.size +
            (chosen.size === 1 ? " card" : " cards") +
            " to binder"
          : "Add to binder";
        add.disabled = !chosen.size;
        clear.disabled = !chosen.size;
        for (const tile of grid.children)
          tile.setAttribute(
            "aria-pressed",
            String(chosen.has(tile.dataset.card)),
          );
      }
      function tile(card) {
        const id = card.id || card.collectorNumber;
        const b = button("", () => {
          if (chosen.has(id)) chosen.delete(id);
          else if (chosen.size < 2000) chosen.add(id);
          sync();
        });
        b.className = "card-browser-tile";
        b.dataset.card = id;
        b.setAttribute(
          "aria-label",
          card.name + ", " + card.setName + " #" + card.collectorNumber,
        );
        b.title =
          card.name + " \u00b7 " + card.setName + " #" + card.collectorNumber;
        const img = make("img");
        img.src = window.CardCatalogue.thumbnail(card);
        img.alt = card.name;
        img.loading = "lazy";
        img.draggable = false;
        const check = make("span", "\u2713", "card-browser-check");
        check.setAttribute("aria-hidden", "true");
        b.append(
          img,
          make("strong", card.name),
          make("small", card.setName + " \u00b7 #" + card.collectorNumber),
          check,
        );
        return b;
      }
      async function load(append = false) {
        clearTimeout(timer);
        const token = ++request,
          next = append ? page + 1 : 1;
        if (!append) {
          page = 0;
          matches = [];
          grid.replaceChildren();
        }
        const query = Object.fromEntries(
          Object.entries(filters).map(([key, control]) => [key, control.value]),
        );
        query.q = search.value.trim();
        more.disabled = true;
        more.hidden = !append;
        retry.hidden = true;
        status.textContent = "Loading cards...";
        try {
          const result = await window.CardCatalogue.search(query, next);
          if (token !== request || !dialog.open) return;
          page = next;
          total = result.total;
          matches.push(...result.cards);
          const added = result.cards.map(tile);
          grid.append(...added);
          status.textContent = matches.length
            ? matches.length + " of " + total + " cards"
            : "No matching cards. Try another search or clear filters.";
          more.hidden = matches.length >= total;
          sync();
          if (append) added[0]?.focus();
        } catch (error) {
          if (token !== request || !dialog.open) return;
          status.textContent = error.message;
          retry.hidden = append;
          more.hidden = !append;
        } finally {
          if (token === request) more.disabled = false;
        }
      }
      search.addEventListener("input", () => {
        clearTimeout(timer);
        request++;
        more.hidden = true;
        timer = setTimeout(() => load(), 250);
      });
      dialog.addEventListener("close", () => {
        request++;
        clearTimeout(timer);
        window.UIControls.restoreFocus(origin, $("expand-cards"));
      });
      window.addEventListener("pokedex-account-changed", () => {
        chosen.clear();
        dialog.close();
      });
      return {
        open() {
          origin = document.activeElement;
          $("card-filters").open = false;
          chosen.clear();
          h.selected().forEach((id) => chosen.add(id));
          search.value = $("card-search").value;
          filters.type.value = $("type-filter").value;
          filters.set.value =
            window.CardCatalogue.sets().find(
              (s) => s.name === $("set-filter").value,
            )?.id || "";
          sync();
          dialog.showModal();
          search.focus();
          load();
        },
      };
    },
  };
})();
