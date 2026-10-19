(() => {
  "use strict";
  window.CollectionForm = {
    create(settings) {
      const $ = (id) => document.getElementById(id),
        cards = window.CARDS,
        byId = new Map(cards.map((c) => [c.id || c.collectorNumber, c]));
      let editing = null,
        focusBefore = null,
        batch = false,
        reviewing = false;
      const chosenCards = new Map();
      let currentSingleId = null;
      const isSingleReview = () => batch && reviewing && chosenCards.size === 1;
      function captureSingleDetails() {
        if (!isSingleReview()) return;
        const item = chosenCards.values().next().value;
        Object.assign(item, {
          quantity: Number($("inventory-quantity").value),
          finish: $("inventory-finish").value,
          condition: $("inventory-condition").value,
          notes: $("inventory-notes").value,
          grading:
            $("inventory-kind").value === "owned" &&
            $("inventory-status").value === "graded"
              ? {
                  company: $("inventory-company").value,
                  grade: $("inventory-grade").value,
                }
              : null,
        });
      }
      const conditions = {
        unknown: "Optional",
        nm: "Near Mint",
        lp: "Lightly Played",
        mp: "Moderately Played",
        hp: "Heavily Played",
        damaged: "Damaged",
      };
      const finishes = {
        unknown: "Optional",
        normal: "Normal",
        reverse: "Reverse holo",
        holo: "Holo",
        firstEdition: "First edition",
      };
      const { make, picture } = window.CollectionUI;
      const setLabel = (card) =>
        card.setName === "151" ? "Pokémon 151" : card.setName;
      let markTouched = false,
        markKind = null;

      // Keep the actions outside the scrolling content in the Workspace dialog.
      if (settings.applyMany) {
        const form = $("inventory-form"),
          actions = form.querySelector(".dialog-actions");
        const scrollContent = make("div", "collection-dialog-content");
        [...form.children]
          .filter((node) => node !== actions)
          .forEach((node) => scrollContent.append(node));
        form.insertBefore(scrollContent, actions);
      }
      // A single record uses a compact card-focused layout; the batch picker
      // retains its separate scrolling and review flow.
      let recordClose, recordCore;
      const coreHomes = [];
      if (settings.applyMany) {
        const heading = make("div", "inventory-detail-heading");
        const headingCopy = make("div", "");
        headingCopy.append(
          make("span", "inventory-detail-eyebrow", "My collection"),
          $("inventory-title"),
        );
        recordClose = make("button", "inventory-detail-close", "×");
        recordClose.type = "button";
        recordClose.setAttribute("aria-label", "Close card details");
        recordClose.addEventListener("click", () =>
          $("inventory-dialog").close(),
        );
        headingCopy.append($("inventory-ownership-context"));
        heading.append(headingCopy, recordClose);
        document.querySelector(".collection-dialog-content").prepend(heading);
        recordCore = make("div", "inventory-record-core");
        const nodes = [
          $("inventory-status").closest("label"),
          $("inventory-condition-label"),
          $("inventory-grading-fields"),
        ];
        nodes.forEach((node) => {
          const home = document.createComment("Record field position");
          node.before(home);
          coreHomes.push([node, home]);
        });
        $("inventory-more-details").querySelector("summary").after(recordCore);
        $("inventory-more-details")
          .querySelector("summary")
          .after($("inventory-finish").closest("label"));
        const detailFields = make("div", "inventory-detail-fields");
        [...$("inventory-more-details").children]
          .filter((node) => node.tagName !== "SUMMARY")
          .forEach((node) => detailFields.append(node));
        $("inventory-more-details").append(detailFields);
      }
      let quantityMinus, quantityPlus;
      function syncSingleQuantity() {
        const quantity = Number($("inventory-quantity").value);
        if (quantityMinus) quantityMinus.disabled = quantity <= 1;
        if (quantityPlus) quantityPlus.disabled = quantity >= 999;
        if (isSingleReview())
          chosenCards.values().next().value.quantity = quantity;
        updateApplyLabel();
      }
      if (settings.applyMany) {
        const input = $("inventory-quantity"),
          stepper = make("span", "collection-stepper");
        quantityMinus = make("button", "button secondary", "−");
        quantityPlus = make("button", "button secondary", "+");
        input.before(stepper);
        stepper.append(quantityMinus, input, quantityPlus);
        for (const [control, label, step] of [
          [quantityMinus, "Decrease quantity", -1],
          [quantityPlus, "Increase quantity", 1],
        ]) {
          control.type = "button";
          control.setAttribute("aria-label", label);
          control.addEventListener("click", () => {
            step > 0 ? input.stepUp() : input.stepDown();
            input.dispatchEvent(new Event("input", { bubbles: true }));
          });
        }
        input.addEventListener("input", syncSingleQuantity);
      }
      function singleLayout(details) {
        if (!settings.applyMany || batch || editing) return;
        $("inventory-dialog").classList.toggle("single-choosing", !details);
        $("inventory-dialog").classList.toggle("record-detail", details);
        $("inventory-dialog").classList.toggle("has-picker", !details);
        $("inventory-picker-area").hidden = details;
        $("inventory-apply").hidden = !details;
        recordClose.hidden = false;
        coreHomes.forEach(([node, home]) =>
          details ? recordCore.append(node) : home.after(node),
        );
        $("inventory-title").textContent = details
          ? "Add card"
          : "Choose a card";
        const content = document.querySelector(".collection-dialog-content");
        if (content) content.scrollTop = 0;
      }
      const purposeField = make("label", "field inventory-purpose", "Mark as");
      const purpose = make("select");
      purpose.id = "inventory-purpose";
      purposeField.append(purpose);
      const purposeHome = document.createComment("Card purpose position");
      if (settings.applyMany) {
        $("inventory-more-details").before(purposeHome, purposeField);
        $("inventory-trade").closest("label").hidden = true;
        $("inventory-chase").closest("label").hidden = true;
      }
      function syncPurpose() {
        if (!settings.applyMany) return;
        const wanted = $("inventory-kind").value === "wanted";
        if (markKind !== wanted) {
          markTouched = false;
          markKind = wanted;
        }
        const current = wanted
          ? $("inventory-chase").checked
            ? "chase"
            : ""
          : $("inventory-trade").value;
        window.CollectionUI.options(
          purpose,
          wanted
            ? [["chase", "Chase card"]]
            : [
                ["keep", "Keep"],
                ["trade", "For trade"],
                ["sale", "For sale"],
              ],
          "Optional",
        );
        purpose.value =
          !editing && !markTouched && current === "keep" ? "" : current;
      }
      purpose.addEventListener("change", () => {
        markTouched = true;
        if ($("inventory-kind").value === "wanted")
          $("inventory-chase").checked = purpose.value === "chase";
        else $("inventory-trade").value = purpose.value || "keep";
      });
      const pickerFilters = make("details", "collection-picker-filters");
      const filterSummary = make("summary", "", "Filters");
      const filterFields = make("div", "collection-picker-filter-fields");
      const pickerFilterControls = {};
      const sets = new Map(cards.map((c) => [c.setId, c.setName]));
      const filterDefinitions = [
        ["set", "Set", [...sets].sort((a, b) => a[1].localeCompare(b[1]))],
        [
          "type",
          "Type",
          [...new Set(cards.flatMap((c) => c.pokemonTypes || []))]
            .sort()
            .map((value) => [value, value]),
        ],
        [
          "rarity",
          "Rarity",
          [...new Set(cards.map((c) => c.rarity).filter(Boolean))]
            .sort()
            .map((value) => [value, value]),
        ],
      ];
      filterDefinitions.forEach(([key, label, entries]) => {
        const field = make("label", "field", label),
          select = make("select");
        select.id = "inventory-picker-" + key;
        const all = make(
          "option",
          "",
          "All " + (key === "rarity" ? "rarities" : key + "s"),
        );
        all.value = "";
        select.append(all);
        entries.forEach(([value, text]) => {
          const option = make("option", "", text);
          option.value = value;
          select.append(option);
        });
        field.append(select);
        filterFields.append(field);
        pickerFilterControls[key] = select;
        select.addEventListener("change", refreshPicker);
      });
      const clearFilters = make("button", "button secondary", "Clear filters");
      clearFilters.type = "button";
      clearFilters.addEventListener("click", () => {
        Object.values(pickerFilterControls).forEach((control) => {
          control.value = "";
        });
        refreshPicker();
      });
      filterFields.append(clearFilters);
      pickerFilters.append(filterSummary, filterFields);
      $("inventory-dialog").addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !pickerFilters.open) return;
        event.preventDefault();
        event.stopPropagation();
        pickerFilters.open = false;
        filterSummary.focus();
      });
      $("inventory-dialog").addEventListener("pointerdown", (event) => {
        if (!pickerFilters.contains(event.target)) pickerFilters.open = false;
      });
      $("inventory-picker-area")
        .querySelector(".collection-picker-heading")
        .append(pickerFilters);
      function refreshPicker() {
        $("inventory-card-grid").scrollTop = 0;
        const chosen = $("inventory-card").value,
          finish = $("inventory-finish").value;
        cardOptions(chosen);
        updateCard($("inventory-card").value === chosen ? finish : "unknown");
      }
      const bulkBar = make("div", "collection-bulk-bar");
      bulkBar.id = "collection-bulk-bar";
      const bulkCount = make("strong", "", "0 selected");
      bulkCount.setAttribute("role", "status");
      const clearSelection = make(
        "button",
        "button secondary",
        "Clear selection",
      );
      clearSelection.type = "button";
      bulkBar.append($("inventory-picker-results"), bulkCount, clearSelection);
      const browseDiscover = $("inventory-browse-discover");
      if (settings.applyMany && browseDiscover) bulkBar.append(browseDiscover);
      const reviewList = make("div", "collection-bulk-review");
      reviewList.id = "collection-bulk-review";
      $("inventory-picker-area").insertBefore(
        bulkBar,
        $("inventory-card-grid"),
      );
      $("inventory-picker-area").append(reviewList);
      const sharedSettings = make("div", "collection-review-shared");
      const kindSwitch = document.querySelector(".inventory-kind-switch");
      const destinationLabel = make(
        "span",
        "collection-add-to-label",
        "Add to:",
      );
      const destination = make("div", "collection-add-to");
      destination.append(destinationLabel);
      const kindHome = document.createComment("Record kind position");
      kindSwitch.before(kindHome);
      reviewList.before(sharedSettings);
      clearSelection.addEventListener("click", () => {
        chosenCards.clear();
        reviewing = false;
        renderPickerSelection();
        syncBatch();
      });
      function updateApplyLabel() {
        const target =
          $("inventory-kind").value === "wanted" ? "Wanted" : "Owned";
        if (isSingleReview()) {
          $("inventory-apply").textContent =
            "Add " +
            byId.get(chosenCards.keys().next().value).name +
            " to " +
            target;
        } else if (batch) {
          const count = reviewing
            ? [...chosenCards.values()].reduce(
                (n, item) =>
                  n +
                  (Number.isFinite(item.quantity) && item.quantity > 0
                    ? item.quantity
                    : 0),
                0,
              )
            : chosenCards.size;
          $("inventory-apply").textContent = reviewing
            ? "Add " +
              count +
              (count === 1 ? " card" : " cards") +
              " to " +
              target
            : count
              ? "Review " + count + (count === 1 ? " card" : " cards")
              : "Review cards";
        } else
          $("inventory-apply").textContent = editing
            ? "Update record"
            : "Add " +
              (byId.get($("inventory-card").value)?.name || "card") +
              " to " +
              target;
      }
      function syncBatch() {
        const single = isSingleReview(),
          focused =
            single || !!editing || (!batch && !!$("inventory-card").value);
        if (batch) {
          $("inventory-dialog").classList.toggle("record-detail", single);
          $("inventory-dialog").classList.toggle("single-review", single);
          $("inventory-dialog").classList.toggle("has-picker", !single);
          $("inventory-picker-area").hidden = single;
        }
        if (single) {
          const [id, item] = chosenCards.entries().next().value;
          if (currentSingleId !== id) {
            currentSingleId = id;
            $("inventory-card").value = id;
            updateCard(item.finish);
            $("inventory-quantity").value = item.quantity;
            $("inventory-condition").value = item.condition || "unknown";
            $("inventory-status").value = item.grading ? "graded" : "";
            $("inventory-company").value = item.grading?.company || "";
            $("inventory-grade").value = item.grading?.grade || "";
            $("inventory-notes").value = item.notes || "";
            $("inventory-more-details").open = false;
            updateFields();
          }
        } else currentSingleId = null;
        bulkBar.hidden = !batch || single;
        clearSelection.hidden = !chosenCards.size || reviewing;
        clearSelection.disabled = !chosenCards.size;
        $("inventory-cancel").textContent =
          batch && reviewing && !single ? "Back to cards" : "Cancel";
        if (settings.applyMany) {
          recordClose.hidden = false;
          $("inventory-more-details").hidden = batch && !single;
          $("inventory-finish").closest("label").hidden = batch && !single;
          purposeField.hidden =
            (batch && !reviewing) ||
            ($("inventory-kind").value === "wanted" &&
              [...purpose.options].every(
                (option) => !option.value || option.value === "wanted",
              ));
          sharedSettings.hidden = !batch || !reviewing || single;
          if (batch && reviewing && !single) {
            destination.append(kindSwitch);
            sharedSettings.replaceChildren(destination, purposeField);
          } else {
            if (focused) {
              destination.append(kindSwitch);
              $("inventory-quantity")
                .closest(".inventory-quick-fields")
                .before(destination);
            } else kindHome.after(kindSwitch);
            purposeHome.after(purposeField);
          }
          if (batch)
            $("inventory-title").textContent = single
              ? "Add card"
              : reviewing
                ? "Review selected cards"
                : "Add cards";
          purposeField.firstChild.textContent = "Mark as";
          $("inventory-more-details").querySelector("summary").textContent =
            "More details";
          $("inventory-ownership-context").hidden = !focused;
        }
        reviewList.hidden = !batch || !reviewing || single;
        bulkCount.textContent = chosenCards.size + " selected";
        bulkCount.hidden = chosenCards.size === 0;
        $("inventory-dialog").classList.toggle(
          "batch-picker",
          batch && !single,
        );
        $("inventory-dialog").classList.toggle(
          "batch-reviewing",
          batch && reviewing && !single,
        );
        $("inventory-card-grid").hidden = batch && reviewing;
        $("inventory-picker-results").hidden = batch && reviewing;
        $("inventory-picker-area").querySelector(
          ".collection-picker-heading",
        ).hidden = batch && reviewing;
        $("inventory-quantity").closest(".inventory-quick-fields").hidden =
          batch && !single;
        $("inventory-apply").disabled = batch && chosenCards.size === 0;
        syncSingleQuantity();
      }
      function renderBatchReview() {
        const columns = make("div", "collection-review-columns");
        columns.setAttribute("aria-hidden", "true");
        columns.append(
          make("span"),
          make("span", "", "Card"),
          make("span", "", "Copies"),
          make("span", "", "Finish"),
          make("span"),
        );
        reviewList.replaceChildren(
          columns,
          ...[...chosenCards].map(([id, value]) => {
            const card = byId.get(id),
              row = make("div", "collection-review-row");
            const art = make("span", "collection-review-art"),
              image = picture(card);
            image.loading = "eager";
            art.append(image);
            const name = make("div", "collection-review-name");
            name.append(
              make("strong", "", card.name),
              make("small", "", setLabel(card) + " · #" + card.collectorNumber),
            );
            const quantityLabel = make(
              "label",
              "field collection-review-copies",
            );
            const quantity = make("input");
            quantity.type = "number";
            quantity.min = "1";
            quantity.max = "999";
            quantity.step = "1";
            quantity.required = true;
            quantity.value = value.quantity;
            quantity.setAttribute(
              "aria-label",
              "Copies of " + card.name + " #" + card.collectorNumber,
            );
            const stepper = make("span", "collection-stepper"),
              minus = make("button", "button secondary", "−"),
              plus = make("button", "button secondary", "+");
            for (const [button, label, step] of [
              [minus, "One fewer copy of ", -1],
              [plus, "One more copy of ", 1],
            ]) {
              button.type = "button";
              button.setAttribute("aria-label", label + card.name);
              button.addEventListener("click", () => {
                step > 0 ? quantity.stepUp() : quantity.stepDown();
                quantity.dispatchEvent(new Event("input", { bubbles: true }));
              });
            }
            const syncQuantity = () => {
              value.quantity = Number(quantity.value);
              minus.disabled = value.quantity <= 1;
              plus.disabled = value.quantity >= 999;
              updateApplyLabel();
            };
            quantity.addEventListener("input", syncQuantity);
            minus.disabled = value.quantity <= 1;
            plus.disabled = value.quantity >= 999;
            stepper.append(minus, quantity, plus);
            quantityLabel.append(stepper);
            const finishLabel = make("label", "field collection-review-finish"),
              finish = make("select");
            finish.setAttribute(
              "aria-label",
              "Finish of " + card.name + " #" + card.collectorNumber,
            );
            Object.entries(finishes)
              .filter(([key]) => key === "unknown" || card.variants?.[key])
              .forEach(([key, text]) => {
                const option = make("option", "", text);
                option.value = key;
                finish.append(option);
              });
            finish.value = value.finish;
            finish.addEventListener(
              "change",
              () => (value.finish = finish.value),
            );
            finishLabel.append(finish);
            const remove = make(
              "button",
              "button secondary collection-review-remove",
              "×",
            );
            remove.type = "button";
            remove.title = "Remove " + card.name + " from selection";
            remove.setAttribute("aria-label", remove.title);
            remove.addEventListener("click", () => {
              chosenCards.delete(id);
              if (!chosenCards.size) reviewing = false;
              renderBatchReview();
              renderPickerSelection();
              syncBatch();
              (isSingleReview()
                ? $("inventory-quantity")
                : reviewing
                  ? reviewList.querySelector(".collection-review-remove")
                  : $("inventory-card-search")
              )?.focus({ preventScroll: true });
              if (!reviewing)
                $("inventory-card-search").focus({ preventScroll: true });
            });
            row.append(art, name, quantityLabel, finishLabel, remove);
            return row;
          }),
        );
      }
      const options = (id, entries, all) =>
        window.CollectionUI.options($(id), entries, all);
      function renderPicker() {
        const matches = [...$("inventory-card").options]
          .slice(1)
          .map((o) => byId.get(o.value));
        $("inventory-picker-results").textContent =
          matches.length + (matches.length === 1 ? " card" : " cards");
        $("inventory-card-grid").replaceChildren(
          ...matches.map((c) => {
            const button = make("button", "collection-pick-card");
            button.type = "button";
            button.dataset.card = c.id || c.collectorNumber;
            button.setAttribute(
              "aria-label",
              c.name + ", " + setLabel(c) + " #" + c.collectorNumber,
            );
            const art = make("span", "collection-pick-art");
            art.append(picture(c));
            button.append(
              art,
              make("strong", "", c.name),
              make("small", "", setLabel(c) + " · #" + c.collectorNumber),
              make("span", "collection-pick-check", "✓"),
            );
            button.lastChild.setAttribute("aria-hidden", "true");
            button.addEventListener("click", () => {
              if (batch) {
                const id = button.dataset.card;
                if (chosenCards.has(id)) chosenCards.delete(id);
                else chosenCards.set(id, { quantity: 1, finish: "unknown" });
                renderPickerSelection();
                syncBatch();
                $("inventory-form-error").textContent = "";
                return;
              }
              const same = $("inventory-card").value === button.dataset.card;
              const finish = $("inventory-finish").value;
              $("inventory-card").value = button.dataset.card;
              updateCard(same ? finish : "unknown");
              singleLayout(true);
              $("inventory-form-error").textContent = "";
            });
            button.addEventListener("keydown", (e) => {
              const buttons = [...$("inventory-card-grid").children],
                index = buttons.indexOf(button);
              const columns = getComputedStyle(
                $("inventory-card-grid"),
              ).gridTemplateColumns.split(" ").length;
              let next = index;
              if (e.key === "ArrowRight") next = index + 1;
              else if (e.key === "ArrowLeft") next = index - 1;
              else if (e.key === "ArrowDown") next = index + columns;
              else if (e.key === "ArrowUp") next = index - columns;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = buttons.length - 1;
              else return;
              e.preventDefault();
              next = Math.max(0, Math.min(buttons.length - 1, next));
              buttons.forEach((b, i) => (b.tabIndex = i === next ? 0 : -1));
              buttons[next]?.focus();
            });
            return button;
          }),
        );
        $("inventory-picker-empty").hidden = !!matches.length;
        renderPickerSelection();
      }
      function renderPickerSelection() {
        const buttons = [...document.querySelectorAll(".collection-pick-card")];
        const selected = $("inventory-card").value;
        const entry =
          buttons.find((b) => b.dataset.card === selected) || buttons[0];
        buttons.forEach((b) => {
          b.setAttribute(
            "aria-pressed",
            String(
              batch
                ? chosenCards.has(b.dataset.card)
                : b.dataset.card === selected,
            ),
          );
          b.tabIndex = b === entry ? 0 : -1;
        });
      }
      function cardOptions(selected = "") {
        const q = $("inventory-card-search").value.trim().toLowerCase();
        const filters = Object.fromEntries(
          Object.entries(pickerFilterControls).map(([key, control]) => [
            key,
            control.value,
          ]),
        );
        const count = Object.values(filters).filter(Boolean).length;
        filterSummary.textContent = count
          ? "Filters (" + count + ")"
          : "Filters";
        options(
          "inventory-card",
          cards
            .filter(
              (c) =>
                (!q ||
                  [c.name, c.setName, c.collectorNumber]
                    .join(" ")
                    .toLowerCase()
                    .includes(q)) &&
                (!filters.set || c.setId === filters.set) &&
                (!filters.type || c.pokemonTypes?.includes(filters.type)) &&
                (!filters.rarity || c.rarity === filters.rarity),
            )
            .map((c) => [
              c.id || c.collectorNumber,
              c.name + " · " + setLabel(c) + " #" + c.collectorNumber,
            ]),
          "Choose a card",
        );
        if ([...$("inventory-card").options].some((o) => o.value === selected))
          $("inventory-card").value = selected;
        renderPicker();
      }
      function updateCard(finish = "unknown") {
        const c = byId.get($("inventory-card").value);
        renderPickerSelection();
        $("inventory-preview").replaceChildren();
        options(
          "inventory-finish",
          c
            ? Object.keys(finishes)
                .filter((k) => k !== "unknown" && c.variants?.[k])
                .map((k) => [k, finishes[k]])
            : [],
          "Optional",
        );
        $("inventory-finish").firstChild.value = "unknown";
        $("inventory-finish").value = finish;
        updateOwnershipContext();
        if (c) {
          const artwork = picture(c);
          artwork.loading = "eager";
          $("inventory-preview").append(
            artwork,
            make("strong", "", c.name),
            make("span", "", setLabel(c) + " #" + c.collectorNumber),
          );
          if (settings.applyMany && !editing && (!batch || isSingleReview())) {
            const change = make(
              "button",
              "button secondary btn-secondary inventory-change-card",
              "Choose another card",
            );
            change.type = "button";
            change.addEventListener("click", () => {
              captureSingleDetails();
              const selection = {
                ...chosenCards.get(c.id || c.collectorNumber),
              };
              batch = true;
              reviewing = false;
              chosenCards.clear();
              chosenCards.set(c.id || c.collectorNumber, {
                ...selection,
                quantity: Number($("inventory-quantity").value) || 1,
                finish: $("inventory-finish").value,
              });
              $("inventory-dialog").classList.remove(
                "record-detail",
                "single-choosing",
              );
              $("inventory-dialog").classList.add("has-picker");
              $("inventory-picker-area").hidden = false;
              $("inventory-apply").hidden = false;
              $("inventory-condition").value = "unknown";
              $("inventory-status").value = "";
              $("inventory-company").value = "";
              $("inventory-grade").value = "";
              $("inventory-notes").value = "";
              updateFields();
              renderPickerSelection();
              syncBatch();
              $("inventory-card-search").focus({ preventScroll: true });
            });
            $("inventory-preview").append(change);
          }
        }
      }
      function updateOwnershipContext() {
        const cardId = $("inventory-card").value,
          finish = $("inventory-finish").value;
        const records = (settings.records?.() || []).filter(
          (r) => r.cardId === cardId,
        );
        const summary = $("inventory-ownership-context");
        summary.hidden = !cardId;
        if (!cardId) return;
        const count = (rows) => rows.reduce((sum, r) => sum + r.quantity, 0);
        const owned = records.filter((r) => r.kind === "owned"),
          wanted = records.filter((r) => r.kind === "wanted");
        if (!records.length) {
          summary.textContent = settings.applyMany
            ? "Not in your collection"
            : "Not recorded in your collection yet.";
          return;
        }
        if (settings.applyMany) {
          summary.textContent = count(owned)
            ? "You own " + count(owned)
            : "Not in your collection";
          return;
        }
        const matching = records.filter((r) => r.finish === finish),
          matchingOwned = matching.filter((r) => r.kind === "owned"),
          matchingWanted = matching.filter((r) => r.kind === "wanted");
        const groups = new Map();
        matchingOwned.forEach((r) => {
          const label = r.grading
            ? r.grading.company + " " + r.grading.grade
            : conditions[r.condition];
          groups.set(label, (groups.get(label) || 0) + r.quantity);
        });
        summary.textContent =
          "Already owned: " +
          count(owned) +
          " · Wanted: " +
          count(wanted) +
          ". " +
          (finishes[finish] || "Unknown") +
          " finish: " +
          count(matchingOwned) +
          " owned" +
          (groups.size
            ? " (" +
              [...groups]
                .map(([label, quantity]) => quantity + " " + label)
                .join(", ") +
              ")"
            : "") +
          " · " +
          count(matchingWanted) +
          " wanted.";
      }
      function updateFields() {
        const owned = $("inventory-kind").value === "owned",
          graded = owned && $("inventory-status").value === "graded";
        $("inventory-record-context").textContent = editing
          ? "Editing " + (owned ? "Owned" : "Wanted") + " record."
          : owned
            ? "Adding to Owned. Details are optional."
            : "Adding to Wanted.";
        $("inventory-owned-choice").setAttribute("aria-pressed", String(owned));
        $("inventory-wanted-choice").setAttribute(
          "aria-pressed",
          String(!owned),
        );
        syncPurpose();
        $("owned-fields").hidden = !owned;
        if (recordCore) recordCore.hidden = !owned;
        $("wanted-fields").hidden = owned;
        $("inventory-grading-fields").hidden = !graded;
        $("inventory-condition-label").hidden = graded;
        $("inventory-grade").required = graded;
        $("inventory-company").required = graded;
        syncSingleQuantity();
      }
      function openRecord(record = null, selection = null) {
        editing = record?.id || null;
        currentSingleId = null;
        $("inventory-dialog").classList.remove("single-review");
        markTouched = false;
        markKind = null;
        if (settings.applyMany) {
          $("inventory-dialog").classList.toggle("record-detail", !!record);
          coreHomes.forEach(([node, home]) => {
            if (record) recordCore.append(node);
            else home.after(node);
          });
          recordClose.hidden = false;
          $("inventory-more-details").querySelector("summary").textContent =
            record ? "Notes & other details" : "More details";
        }
        batch = !!settings.applyMany && !record && !selection;
        reviewing = false;
        chosenCards.clear();
        reviewList.replaceChildren();
        focusBefore = document.activeElement;
        $("inventory-form").reset();
        $("inventory-more-details").open = false;
        $("inventory-form-error").textContent = "";
        $("inventory-card-search").value = "";
        Object.values(pickerFilterControls).forEach((control) => {
          control.value = "";
        });
        pickerFilters.open = false;
        cardOptions(record?.cardId || selection?.cardId || "");
        $("inventory-apply").textContent = record
          ? "Update record"
          : "Add to Owned";
        $("inventory-title").textContent = record
          ? settings.applyMany
            ? "Card details"
            : "Edit collection record"
          : "Add cards";
        $("inventory-card").disabled = !!record;
        $("inventory-card-search").disabled = !!record;
        $("inventory-delete").hidden = !record || !settings.remove;
        $("inventory-picker-area").hidden = !!record || !!selection;
        $("inventory-dialog").classList.toggle(
          "has-picker",
          !record && !selection,
        );
        $("inventory-kind").value =
          record?.kind || selection?.kind || settings.kind?.() || "owned";
        $("inventory-quantity").value = record?.quantity || 1;
        $("inventory-condition").value = record?.condition || "unknown";
        $("inventory-status").value = record?.grading
          ? "graded"
          : record
            ? "raw"
            : "";
        $("inventory-company").value = record?.grading?.company || "";
        $("inventory-grade").value = record?.grading?.grade || "";
        $("inventory-notes").value = record?.notes || "";
        $("inventory-trade").value = record?.tradeStatus || "keep";
        $("inventory-chase").checked = record?.chase || false;
        updateCard(record?.finish || selection?.finish || "unknown");
        updateFields();
        if (record)
          $("inventory-record-context").textContent =
            "Editing " +
            (record.kind === "owned" ? "Owned" : "Wanted") +
            " record.";
        syncBatch();
        $("inventory-apply").hidden = false;
        $("inventory-dialog").classList.remove("single-choosing");
        if (!batch && !record) singleLayout(!!selection);
        $("inventory-card-grid").scrollTop = 0;
        $("inventory-dialog").showModal();
        (record && recordClose
          ? recordClose
          : record || selection
            ? $("inventory-quantity")
            : $("inventory-card-search")
        ).focus({ preventScroll: true });
        const content = document.querySelector(".collection-dialog-content");
        if (content) content.scrollTop = 0;
      }
      $("inventory-form").addEventListener(
        "invalid",
        (e) => {
          if ($("inventory-more-details").contains(e.target))
            $("inventory-more-details").open = true;
        },
        true,
      );
      $("inventory-form").addEventListener("submit", (e) => {
        e.preventDefault();
        if (batch && !reviewing) {
          if (!chosenCards.size) return;
          reviewing = true;
          renderBatchReview();
          syncBatch();
          $("inventory-dialog").scrollTop = 0;
          reviewList.querySelector("input")?.focus({ preventScroll: true });
          const content = document.querySelector(".collection-dialog-content");
          if (content) content.scrollTop = 0;
          return;
        }
        captureSingleDetails();
        const owned = $("inventory-kind").value === "owned";
        const value = {
          kind: $("inventory-kind").value,
          cardId: $("inventory-card").value,
          finish: $("inventory-finish").value,
          quantity: Number($("inventory-quantity").value),
          condition: $("inventory-condition").value,
          grading:
            owned && $("inventory-status").value === "graded"
              ? {
                  company: $("inventory-company").value,
                  grade: $("inventory-grade").value,
                }
              : null,
          notes: $("inventory-notes").value,
          chase: $("inventory-chase").checked,
          tradeStatus: $("inventory-trade").value,
        };
        try {
          if (batch) {
            if (!chosenCards.size) throw Error("Select at least one card.");
            settings.applyMany(
              [...chosenCards].map(([cardId, item]) => ({
                ...value,
                ...(chosenCards.size > 1
                  ? { condition: "unknown", grading: null, notes: "" }
                  : {}),
                cardId,
                ...item,
              })),
            );
          } else if (!byId.has(value.cardId)) {
            $("inventory-card-search").focus();
            throw Error("Select a card printing first.");
          }
          if (!batch) settings.apply(value, editing);
          $("inventory-dialog").close();
          settings.updated?.();
        } catch (error) {
          $("inventory-form-error").textContent = error.message;
        }
      });
      $("inventory-card-search").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
        }
      });
      $("inventory-finish").addEventListener("change", () => {
        if (isSingleReview())
          chosenCards.values().next().value.finish =
            $("inventory-finish").value;
        updateOwnershipContext();
      });
      $("inventory-card-search").addEventListener("input", () => {
        const chosen = $("inventory-card").value,
          finish = $("inventory-finish").value;
        cardOptions(chosen);
        updateCard($("inventory-card").value === chosen ? finish : "unknown");
      });
      $("inventory-card").addEventListener("change", () => updateCard());
      for (const id of ["inventory-kind", "inventory-status"])
        $(id).addEventListener("change", updateFields);

      $("inventory-cancel").addEventListener("click", () => {
        if (batch && reviewing && chosenCards.size > 1) {
          reviewing = false;
          syncBatch();
          $("inventory-card-search").focus({ preventScroll: true });
        } else $("inventory-dialog").close();
      });
      $("inventory-dialog").addEventListener("close", () => {
        const recordId =
          focusBefore?.dataset.record || focusBefore?.dataset.actionRecord;
        const action =
          recordId &&
          [...document.querySelectorAll("[data-action-record]")].find(
            (node) =>
              node.dataset.actionRecord === recordId &&
              node.getAttribute("aria-label") ===
                focusBefore.getAttribute("aria-label"),
          );
        const target = focusBefore?.isConnected
          ? focusBefore
          : action ||
            (recordId
              ? document.querySelector(
                  '[data-record="' + CSS.escape(recordId) + '"]',
                )
              : focusBefore?.closest(".collection-add-tile")
                ? document.querySelector(".collection-add-tile button")
                : null);
        (target || $("collection-add"))?.focus({ preventScroll: true });
      });

      for (const [id, kind] of [
        ["inventory-owned-choice", "owned"],
        ["inventory-wanted-choice", "wanted"],
      ])
        $(id).addEventListener("click", () => {
          $("inventory-kind").value = kind;
          updateFields();
          if (batch) syncBatch();
        });
      $("inventory-delete").addEventListener("click", () =>
        settings.remove?.(editing),
      );
      $("inventory-dialog").addEventListener("close", () =>
        settings.closed?.(),
      );
      $("inventory-browse-discover").addEventListener("click", () => {
        const url = new URL($("inventory-browse-discover").href);
        url.searchParams.set("q", $("inventory-card-search").value);
        $("inventory-browse-discover").href = url.href;
      });
      return { open: openRecord };
    },
  };
})();
