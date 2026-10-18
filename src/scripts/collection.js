(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    repository = window.CollectionRepository,
    cards = window.CARDS,
    byId = new Map(cards.map((c) => [c.id || c.collectorNumber, c]));
  let revision = null,
    persisted = false,
    blocked = true,
    loading = true,
    persisting = false,
    loadId = 0,
    view = "owned",
    editing = null,
    confirmAction = null;
  let selecting = false;
  const selected = new Set();
  let state = window.CollectionState.create(repository.empty());
  const { make, picture } = window.CollectionUI;
  const filterPanel = document.querySelector(
    "#collection-panel .collection-filters",
  );
  document
    .querySelector("#collection-panel > .inventory-toolbar")
    .insertBefore(
      filterPanel,
      document.querySelector(".collection-sort-label"),
    );
  const toolbar = document.querySelector(
    "#collection-panel > .inventory-toolbar",
  );
  toolbar.prepend(
    document.querySelector(".collection-topbar .collection-switch"),
  );
  toolbar.append(document.querySelector(".collection-actions"));
  document.querySelector(".collection-topbar").remove();
  $("collection-list").after($("collection-selection-actions"));
  const selectionBar = $("collection-selection-actions");
  const sizeSelectionBar = () => {
    const space = selectionBar.hidden
      ? 0
      : selectionBar.getBoundingClientRect().height +
        parseFloat(getComputedStyle(selectionBar).bottom) +
        16;
    $("collection-panel").style.setProperty(
      "--collection-selection-space",
      space + "px",
    );
  };
  new ResizeObserver(sizeSelectionBar).observe(selectionBar);
  window.addEventListener("resize", sizeSelectionBar);
  let toastTimer,
    savedTimer,
    savedUntil = 0;
  const message = (text) => {
    clearTimeout(toastTimer);
    $("collection-message-text").textContent = text;
    $("collection-toast-redo").hidden = !state.canRedo;
    $("collection-toast-undo").hidden = !state.canUndo || state.canRedo;
    $("collection-message").hidden = false;
    toastTimer = setTimeout(() => {
      $("collection-message").hidden = true;
    }, 4000);
  };
  $("collection-toast-undo").addEventListener("click", () =>
    run(() => state.undo(), "Change undone."),
  );
  $("collection-toast-redo").addEventListener("click", () =>
    run(() => state.redo(), "Change restored."),
  );

  // Keep keyboard traversal inside the active collection dialog at both ends.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const dialog = [...document.querySelectorAll("dialog[open]")]
      .filter((node) =>
        node.matches(
          "#inventory-dialog,#collection-confirm,.collection-bulk-edit",
        ),
      )
      .at(-1);
    if (!dialog) return;
    const controls = [
      ...dialog.querySelectorAll(
        'button,input:not([type="hidden"]),select,textarea,a[href],summary,[tabindex]',
      ),
    ].filter((node) => {
      if (
        node.disabled ||
        node.tabIndex < 0 ||
        !node.getClientRects().length ||
        getComputedStyle(node).visibility === "hidden"
      )
        return false;
      for (
        let parent = node.parentElement;
        parent && parent !== dialog;
        parent = parent.parentElement
      ) {
        if (parent.hidden) return false;
        if (
          parent.tagName === "DETAILS" &&
          !parent.open &&
          !parent.querySelector(":scope > summary")?.contains(node)
        )
          return false;
      }
      return true;
    });
    const first = controls[0],
      last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  });
  const collectionTools = document.querySelector(
    "#collection-panel .collection-more",
  );
  document.addEventListener("pointerdown", (e) => {
    if (collectionTools.open && !collectionTools.contains(e.target))
      collectionTools.open = false;
  });
  collectionTools.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && collectionTools.open) {
      e.preventDefault();
      collectionTools.open = false;
      collectionTools.querySelector("summary").focus();
    }
  });
  const options = (id, entries, all) =>
    window.CollectionUI.options($(id), entries, all);
  function render() {
    const active = document.activeElement,
      key = active?.dataset.record || active?.dataset.actionRecord;
    const owned = state.document.records.filter((r) => r.kind === "owned"),
      wanted = state.document.records.filter((r) => r.kind === "wanted");
    const counted = view === "owned" ? owned : wanted;
    const copies = counted.reduce((sum, r) => sum + r.quantity, 0);
    const unique = new Set(counted.map((r) => r.cardId)).size;
    const sets = new Set(counted.map((r) => byId.get(r.cardId).setId)).size;
    $("owned-total").textContent = copies;
    $("printing-total").textContent = unique;
    $("sets-total").textContent = sets;
    $("total-card-label").textContent =
      copies === 1 ? "Total card" : "Total cards";
    $("unique-card-label").textContent =
      unique === 1 ? "Unique card" : "Unique cards";
    $("set-total-label").textContent = sets === 1 ? "Set" : "Sets";
    document
      .querySelector(".collection-summary")
      .setAttribute(
        "aria-label",
        (view === "owned" ? "Owned" : "Wanted") + " collection totals",
      );
    $("collection-owned").setAttribute(
      "aria-pressed",
      String(view === "owned"),
    );
    $("collection-wanted").setAttribute(
      "aria-pressed",
      String(view === "wanted"),
    );
    $("condition-filter-label").hidden = view === "wanted";
    $("trade-filter-label").hidden = view === "wanted";
    $("chase-filter-label").hidden = view !== "wanted";
    const query = $("collection-search").value.trim().toLowerCase(),
      set = $("inventory-set-filter").value,
      condition = $("inventory-condition-filter").value,
      trade = $("inventory-trade-filter").value;
    const filterCount =
      Number(!!set) +
      (view === "owned"
        ? Number(!!condition) + Number(!!trade)
        : Number($("inventory-chase-filter").checked));
    $("collection-filter-summary").textContent = filterCount
      ? "Filters (" + filterCount + ")"
      : "Filters";
    const rows = state.document.records
      .filter((r) => {
        const c = byId.get(r.cardId);
        return (
          r.kind === view &&
          (!query ||
            [c.name, c.setName, c.collectorNumber]
              .join(" ")
              .toLowerCase()
              .includes(query)) &&
          (!set || c.setId === set) &&
          (view === "wanted" ||
            !condition ||
            (r.condition === condition && !r.grading)) &&
          (view === "wanted" || !trade || r.tradeStatus === trade) &&
          (view === "owned" || !$("inventory-chase-filter").checked || r.chase)
        );
      })
      .sort((a, b) => {
        const ca = byId.get(a.cardId),
          cb = byId.get(b.cardId);
        const sort = $("collection-sort").value;
        return (
          (sort === "quantity"
            ? b.quantity - a.quantity
            : sort === "set"
              ? ca.setName.localeCompare(cb.setName) ||
                ca.collectorNumber.localeCompare(
                  cb.collectorNumber,
                  undefined,
                  { numeric: true },
                )
              : 0) ||
          ca.name.localeCompare(cb.name) ||
          a.id.localeCompare(b.id)
        );
      });
    const visibleIds = new Set(rows.map((r) => r.id));
    selected.forEach((id) => {
      if (!visibleIds.has(id)) selected.delete(id);
    });
    $("collection-list").classList.toggle("is-selecting", selecting);
    $("collection-select").setAttribute("aria-pressed", String(selecting));
    $("collection-selection-actions").hidden = !selecting;
    $("collection-selected-count").textContent = selected.size + " selected";
    $("collection-remove-selected").disabled = blocked || selected.size === 0;
    $("collection-edit-selected").disabled = blocked || selected.size === 0;
    $("collection-select-all").disabled = blocked || rows.length === 0;
    $("collection-select").disabled = blocked;
    $("collection-list").replaceChildren(
      ...rows.map((r) => {
        const c = byId.get(r.cardId),
          row = make("li", "inventory-row"),
          button = make("button", "inventory-card");
        row.classList.toggle("is-selected", selected.has(r.id));
        button.type = "button";
        button.disabled = blocked;
        button.dataset.record = r.id;
        button.setAttribute(
          "aria-label",
          (selecting ? "Select " : "Edit ") +
            c.name +
            ", " +
            c.setName +
            " #" +
            c.collectorNumber +
            ", " +
            r.quantity +
            " " +
            r.kind +
            " copies",
        );
        if (selecting)
          button.setAttribute("aria-pressed", String(selected.has(r.id)));
        const art = make("span", "inventory-art");
        const image = picture(c);
        art.append(image);
        const loaded = () => {
          art.classList.remove("is-loading");
          art.removeAttribute("aria-busy");
        };
        if (!image.complete) {
          art.classList.add("is-loading");
          art.setAttribute("aria-busy", "true");
        }
        image.addEventListener("load", loaded, { once: true });
        image.addEventListener("error", loaded, { once: true });
        const info = make("span", "inventory-card-info");
        info.append(
          make("strong", "", c.name),
          make("small", "", c.setName + " · #" + c.collectorNumber),
        );
        if (r.quantity > 1)
          info.append(
            make("span", "inventory-quantity", r.quantity + " copies"),
          );
        const purposeText =
          r.kind === "owned"
            ? { keep: "Keep", trade: "For trade", sale: "For sale" }[
                r.tradeStatus
              ]
            : r.chase
              ? "Chase card"
              : "Wanted";
        if (r.kind === "owned" ? r.tradeStatus !== "keep" : r.chase)
          info.append(
            make(
              "span",
              "collection-purpose-tag purpose-" +
                (r.kind === "owned"
                  ? r.tradeStatus
                  : r.chase
                    ? "chase"
                    : "wanted"),
              purposeText,
            ),
          );
        button.setAttribute(
          "aria-label",
          button.getAttribute("aria-label") + ", " + purposeText,
        );
        button.append(art, info);
        if (selecting) {
          const selectionLabel = make("label", "collection-card-checkbox");
          const check = make("input");
          check.type = "checkbox";
          check.checked = selected.has(r.id);
          check.setAttribute(
            "aria-label",
            "Select " + c.name + " #" + c.collectorNumber,
          );
          check.dataset.actionRecord = r.id;
          check.addEventListener("change", () => {
            check.checked ? selected.add(r.id) : selected.delete(r.id);
            render();
          });
          selectionLabel.append(check, make("span", "sr-only", "Select"));
          row.append(selectionLabel);
        }
        button.addEventListener("click", () => {
          if (selecting) {
            if (selected.has(r.id)) selected.delete(r.id);
            else selected.add(r.id);
            render();
          } else openRecord(r);
        });
        row.append(button);
        if (!selecting) {
          const actions = make("div", "collection-card-actions");
          actions.setAttribute("role", "group");
          actions.setAttribute("aria-label", "Quick actions for " + c.name);
          const quick = (text, label, action, disabled = false) => {
            const control = make(
              "button",
              "button secondary btn-secondary",
              text,
            );
            const iconPaths = {
              Wanted:
                "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
              Owned: "M6 3h12v18l-6-4-6 4V3Z",
              Details:
                "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
            };
            if (iconPaths[text]) {
              const icon = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg",
              );
              icon.setAttribute("viewBox", "0 0 24 24");
              icon.setAttribute("class", "collection-action-icon");
              icon.setAttribute("aria-hidden", "true");
              const line = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path",
              );
              line.setAttribute("d", iconPaths[text]);
              icon.append(line);
              control.replaceChildren(icon);
            }
            control.type = "button";
            control.title = label;
            control.setAttribute("aria-label", label);
            control.dataset.actionRecord = r.id;
            control.disabled = disabled || blocked;
            control.addEventListener("click", action);
            actions.append(control);
          };
          quick(
            "−",
            "One fewer copy of " + c.name,
            () =>
              run(
                () => state.upsert({ ...r, quantity: r.quantity - 1 }, r.id),
                "Quantity updated.",
              ),
            r.quantity <= 1,
          );
          quick(
            "+",
            "One more copy of " + c.name,
            () =>
              run(
                () => state.upsert({ ...r, quantity: r.quantity + 1 }, r.id),
                "Quantity updated.",
              ),
            r.quantity >= 999,
          );
          quick(
            view === "owned" ? "Wanted" : "Owned",
            "Move " + c.name + " to " + (view === "owned" ? "Wanted" : "Owned"),
            () =>
              run(
                () =>
                  state.upsert(
                    {
                      ...r,
                      kind: view === "owned" ? "wanted" : "owned",
                      tradeStatus: "keep",
                      chase: false,
                      grading: null,
                      condition: "unknown",
                    },
                    r.id,
                  ),
                "Card moved. Undo is available.",
              ),
          );
          quick("Details", "Open details for " + c.name, () => openRecord(r));
          row.append(actions);
        }
        return row;
      }),
    );
    if (rows.length) {
      const tile = make("li", "collection-add-tile");
      const add = make("button", "button btn-secondary", "+ Add cards");
      add.type = "button";
      add.disabled = blocked;
      add.addEventListener("click", () => form.open());
      tile.append(add);
      $("collection-list").append(tile);
    }
    $("collection-select-all").textContent =
      rows.length && rows.every((r) => selected.has(r.id))
        ? "Deselect all"
        : "Select all";
    $("collection-select-all").title =
      "Select all cards matching the current search and filters";
    $("collection-active-filters").replaceChildren();
    for (const [id, label, relevant] of [
      ["inventory-set-filter", "Set", true],
      ["inventory-condition-filter", "Condition", view === "owned"],
      ["inventory-trade-filter", "Trade", view === "owned"],
      ["inventory-chase-filter", "Chase cards", view === "wanted"],
    ]) {
      const control = $(id),
        value = control.type === "checkbox" ? control.checked : control.value;
      if (!relevant || !value) continue;
      const text =
        control.type === "checkbox"
          ? label
          : label + ": " + control.selectedOptions[0].text;
      const chip = make("button", "collection-filter-chip", text + " ×");
      chip.type = "button";
      chip.setAttribute("aria-label", "Remove filter: " + text);
      chip.addEventListener("click", () => {
        if (control.type === "checkbox") control.checked = false;
        else control.value = "";
        render();
        $("collection-filter-summary").focus();
      });
      $("collection-active-filters").append(chip);
    }
    const count = state.document.records.filter((r) => r.kind === view).length;
    $("inventory-results").textContent =
      rows.length + " " + (rows.length === 1 ? "card group" : "card groups");
    $("inventory-empty").hidden = !!rows.length || loading || blocked;
    $("inventory-empty-title").textContent = count
      ? "No matching records"
      : view === "owned"
        ? "No owned cards yet"
        : "No Wanted cards yet";
    $("inventory-empty-copy").textContent = count
      ? "Try another search or clear the filters."
      : "Add a printing to start tracking " +
        (view === "owned" ? "your collection." : "your wanted cards.");
    $("collection-empty-add").hidden = false;
    $("collection-save").disabled =
      blocked || persisting || (!state.dirty && persisted);
    $("collection-save").toggleAttribute("aria-busy", persisting);
    $("collection-reload").disabled = persisting;
    $("collection-browser-import").hidden = !repository.enabled;
    $("collection-browser-import").disabled = blocked || persisting;
    $("collection-empty-add").disabled = blocked;
    $("collection-save").title = repository.enabled
      ? "Save to your account"
      : "Save on this browser";
    $("collection-save-status").textContent = loading
      ? "Loading collection..."
      : blocked
        ? repository.enabled
          ? "Account collection unavailable"
          : "Local data unavailable"
        : persisting
          ? "Saving..."
          : !$("collection-save").disabled
            ? "Unsaved changes"
            : Date.now() < savedUntil
              ? "✓ Saved"
              : "All changes saved";
    $("collection-save-status").classList.toggle(
      "is-unsaved",
      !blocked && !$("collection-save").disabled,
    );
    $("collection-undo").disabled = !state.canUndo;
    $("collection-undo").hidden = !state.canUndo;
    $("collection-redo").hidden = !state.canRedo;
    $("collection-redo").disabled = !state.canRedo;
    $("collection-add").disabled = blocked;
    $("collection-import").disabled = blocked || persisting;
    if (key && !active.isConnected)
      (
        document.querySelector('[data-record="' + CSS.escape(key) + '"]') ||
        $("collection-add")
      ).focus({ preventScroll: true });
  }
  function run(action, text) {
    try {
      if (blocked)
        throw Error("Collection is unavailable. Reload before editing.");
      repository.check();
      const result = action();
      render();
      message(typeof text === "function" ? text(result) : text);
      return true;
    } catch (error) {
      message(error.message);
      return false;
    }
  }
  const syncError = (text = "") => {
    $("collection-sync-message").textContent = text;
    $("collection-sync-message").hidden = !text;
  };
  async function load() {
    if (persisting) return;
    const request = ++loadId;
    blocked = true;
    loading = true;
    render();
    try {
      const saved = await repository.read();
      if (request !== loadId) return;
      state.load(saved?.document || repository.empty());
      revision = saved?.revision ?? null;
      persisted = !!saved || repository.enabled;
      blocked = false;
      syncError();
    } catch (error) {
      if (request !== loadId) return;
      syncError(error.message);
      message(error.message);
    }
    loading = false;
    render();
  }
  async function save() {
    if (blocked || persisting) return;
    persisting = true;
    const snapshot = JSON.parse(JSON.stringify(state.document));
    render();
    try {
      revision = await repository.save(snapshot, revision);
      state.save(snapshot);
      persisted = true;
      syncError();
      savedUntil = Date.now() + 2000;
      clearTimeout(savedTimer);
      savedTimer = setTimeout(render, 2050);
      message(
        repository.enabled
          ? "Collection saved to your account."
          : "Collection saved on this browser. Binder layouts are unaffected.",
      );
    } catch (error) {
      syncError(error.message);
      message(error.message);
    } finally {
      persisting = false;
      render();
    }
  }

  const form = window.CollectionForm.create({
    kind: () => view,
    records: () => state.document.records,
    applyMany(values) {
      if (blocked) throw Error("Reload your collection before editing.");
      repository.check();
      const staged = window.CollectionState.create(state.document);
      values.forEach((value) => staged.upsert(value));
      state.replace(staged.document);
      view = values[0].kind;
      message(
        values.length +
          " printings added. Undo is available; Save keeps the change.",
      );
    },
    apply(value, id) {
      if (blocked) throw Error("Reload your collection before editing.");
      repository.check();
      const merged = state.upsert(value, id);
      view = value.kind;
      message(
        merged
          ? "Copies combined with the existing group. Save to keep the change."
          : "Record updated. Save to keep the change.",
      );
    },
    updated: render,
    remove(id) {
      editing = id;
      removeRecord();
    },
  });
  const openRecord = (record) => form.open(record);
  $("collection-empty-add").addEventListener("click", () => form.open());
  // Only purpose changes are applied in bulk; quantity, finish and notes stay intact.
  const editSelected = make("button", "button secondary", "Edit selected");
  editSelected.id = "collection-edit-selected";
  editSelected.type = "button";
  $("collection-remove-selected").before(editSelected);
  const bulkDialog = make("dialog", "collection-bulk-edit");
  bulkDialog.setAttribute("aria-labelledby", "collection-bulk-edit-title");
  const bulkForm = make("form");
  const bulkTitle = make("h2", "", "Edit selected cards");
  bulkTitle.id = "collection-bulk-edit-title";
  const bulkScope = make("p", "");
  const bulkLabel = make("label", "field", "Mark as");
  const bulkPurpose = make("select");
  bulkPurpose.id = "collection-bulk-purpose";
  bulkLabel.append(bulkPurpose);
  const bulkError = make("p", "form-error");
  bulkError.setAttribute("role", "status");
  const bulkActions = make("div", "dialog-actions");
  const bulkCancel = make("button", "button secondary", "Cancel");
  bulkCancel.type = "button";
  const bulkApply = make("button", "button primary", "Apply changes");
  bulkApply.type = "submit";
  bulkActions.append(bulkCancel, bulkApply);
  const bulkHeading = make("div", "inventory-detail-heading");
  const bulkClose = make("button", "inventory-detail-close", "×");
  bulkClose.type = "button";
  bulkClose.setAttribute("aria-label", "Close bulk editor");
  bulkClose.addEventListener("click", () => bulkDialog.close());
  bulkHeading.append(bulkTitle, bulkClose);
  bulkForm.append(bulkHeading, bulkScope, bulkLabel, bulkError, bulkActions);
  bulkDialog.append(bulkForm);
  document.body.append(bulkDialog);
  bulkCancel.addEventListener("click", () => bulkDialog.close());
  bulkDialog.addEventListener("close", () => editSelected.focus());
  editSelected.addEventListener("click", () => {
    window.CollectionUI.options(
      bulkPurpose,
      view === "owned"
        ? [
            ["keep", "Keep"],
            ["trade", "For trade"],
            ["sale", "For sale"],
          ]
        : [
            ["wanted", "Wanted"],
            ["chase", "Chase card"],
          ],
      "Leave unchanged",
    );
    bulkScope.textContent =
      selected.size + " selected. Copies, finishes and notes stay the same.";
    bulkError.textContent = "";
    bulkApply.disabled = true;
    bulkDialog.showModal();
  });
  bulkPurpose.addEventListener(
    "change",
    () => (bulkApply.disabled = !bulkPurpose.value),
  );
  bulkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!bulkPurpose.value || !selected.size) return;
    try {
      const staged = window.CollectionState.create(state.document);
      const rows = state.document.records.filter((r) => selected.has(r.id));
      rows.forEach((r) =>
        staged.upsert(
          {
            ...r,
            tradeStatus: r.kind === "owned" ? bulkPurpose.value : r.tradeStatus,
            chase:
              r.kind === "wanted" ? bulkPurpose.value === "chase" : r.chase,
          },
          r.id,
        ),
      );
      state.replace(staged.document);
      bulkDialog.close();
      render();
      message(
        rows.length +
          " records updated. Undo is available; Save keeps the change.",
      );
    } catch (error) {
      bulkError.textContent = error.message;
    }
  });
  $("collection-select").addEventListener("click", () => {
    selecting = !selecting;
    selected.clear();
    render();
  });
  $("collection-selection-cancel").addEventListener("click", () => {
    selecting = false;
    selected.clear();
    render();
    $("collection-select").focus();
  });
  $("collection-select-all").addEventListener("click", () => {
    const ids = [...$("collection-list").querySelectorAll("[data-record]")].map(
      (n) => n.dataset.record,
    );
    const all = ids.every((id) => selected.has(id));
    ids.forEach((id) => (all ? selected.delete(id) : selected.add(id)));
    render();
  });
  $("collection-remove-selected").addEventListener("click", () => {
    const ids = new Set(selected);
    const records = state.document.records.filter((r) => ids.has(r.id));
    if (!records.length) return;
    const copies = records.reduce((n, r) => n + r.quantity, 0);
    confirm(
      "Remove selected cards?",
      "Remove " +
        records.length +
        " groups (" +
        copies +
        " copies) from your collection? Binder placements stay unchanged. Undo is available.",
      () => {
        run(
          () =>
            state.replace({
              ...state.document,
              records: state.document.records.filter((r) => !ids.has(r.id)),
            }),
          "Selected records removed. Undo restores them; Save keeps the change.",
        );
        selected.clear();
        selecting = false;
        render();
        $("collection-select").focus();
      },
    );
  });
  $("collection-add").addEventListener("click", () => form.open());
  function confirm(title, copy, action) {
    $("collection-confirm-title").textContent = title;
    $("collection-confirm-copy").textContent = copy;
    confirmAction = action;
    $("collection-confirm").showModal();
    $("collection-confirm-cancel").focus();
  }
  function removeRecord() {
    const r = state.document.records.find((r) => r.id === editing);
    if (!r) return;
    confirm(
      "Remove this record?",
      `Remove ${r.quantity} ${r.kind === "owned" ? "owned" : "wanted"} copies of ${byId.get(r.cardId).name} from this inventory? Digital binder placements are unaffected. Undo is available.`,
      () => {
        $("inventory-dialog").close();
        run(
          () => state.remove(r.id),
          "Record removed. Undo is available; Save keeps the change.",
        );
      },
    );
  }
  $("collection-confirm-close").addEventListener("click", () =>
    $("collection-confirm-cancel").click(),
  );
  $("collection-confirm-cancel").addEventListener("click", () => {
    $("collection-confirm").close();
    if ($("inventory-dialog").open) $("inventory-delete").focus();
  });
  $("collection-confirm-yes").addEventListener("click", () => {
    $("collection-confirm").close();
    const action = confirmAction;
    confirmAction = null;
    action?.();
  });
  $("collection-save").addEventListener("click", save);
  $("collection-undo").addEventListener("click", () =>
    run(() => state.undo(), "Change undone."),
  );
  $("collection-redo").addEventListener("click", () =>
    run(() => state.redo(), "Change restored."),
  );
  for (const [id, kind] of [
    ["collection-owned", "owned"],
    ["collection-wanted", "wanted"],
  ])
    $(id).addEventListener("click", () => {
      view = kind;
      render();
    });
  for (const id of [
    "collection-search",
    "collection-sort",
    "inventory-set-filter",
    "inventory-condition-filter",
    "inventory-trade-filter",
    "inventory-chase-filter",
  ])
    $(id).addEventListener(
      id === "collection-search" ? "input" : "change",
      render,
    );
  $("collection-clear").addEventListener("click", () => {
    $("collection-search").value = "";
    for (const id of [
      "inventory-set-filter",
      "inventory-condition-filter",
      "inventory-trade-filter",
    ])
      $(id).value = "";
    $("inventory-chase-filter").checked = false;
    render();
    $("collection-search").focus();
  });
  $("collection-download").addEventListener("click", () => {
    const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                format: "pokedex-collection",
                version: 1,
                document: state.document,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      ),
      a = make("a");
    a.href = url;
    a.download = "pokedex-collection.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message(
      "Downloaded current collection data. This does not save it to an account.",
    );
  });
  $("collection-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > window.CollectionState.limits.importBytes)
        throw Error("Choose a backup file up to 64 MB.");
      const doc = window.CollectionState.validate(
        JSON.parse(await file.text()),
      );
      confirm(
        "Import collection?",
        `Replace the current inventory with ${doc.records.length} groups? Saved data is unchanged until Save. Undo is available.`,
        () =>
          run(
            () => state.replace(doc),
            "Collection imported. Review it, then Save.",
          ),
      );
    } catch (error) {
      message(
        error instanceof SyntaxError
          ? "This is not a valid backup file."
          : error.message,
      );
    }
  });
  $("collection-browser-import").addEventListener("click", () => {
    try {
      repository.check();
      const source = repository.readBrowser();
      if (!source)
        throw Error(
          "No saved browser collection to import. Restore a backup instead.",
        );
      const summary = repository.previewImport(state.document, source.document);
      const dialog = make("dialog", "cloud-dialog");
      dialog.setAttribute("aria-labelledby", "collection-browser-title");
      const title = make("h2", "", "Import browser collection");
      title.id = "collection-browser-title";
      const copy = make(
        "p",
        "",
        `${summary.groups} browser groups: ${summary.added} new, ${summary.overlaps} matching. Review the draft, then Save. The browser original stays unchanged. Quantities are never added together.`,
      );
      const label = make("label", "field", "Matching groups");
      const choice = make("select");
      for (const [value, text] of [
        ["", "Choose what to keep"],
        ["keep", "Keep account records"],
        ["replace", "Use browser records"],
      ]) {
        const option = make("option", "", text);
        option.value = value;
        choice.append(option);
      }
      label.append(choice);
      label.hidden = !summary.overlaps;
      const error = make("p");
      error.setAttribute("role", "alert");
      const actions = make("div", "dialog-actions");
      const cancel = make("button", "button secondary", "Cancel");
      cancel.type = "button";
      const apply = make("button", "button primary", "Import into draft");
      apply.type = "button";
      cancel.onclick = () => dialog.close();
      apply.onclick = () => {
        try {
          repository.check();
          if (blocked || persisting)
            throw Error("Reload your account before importing.");
          const merged = repository.importDocument(
            state.document,
            source.document,
            summary.overlaps ? choice.value : "keep",
          );
          state.replace(merged);
          render();
          dialog.close();
          message("Browser records imported into draft. Review, then Save.");
        } catch (e) {
          error.textContent = e.message;
        }
      };
      actions.append(cancel, apply);
      dialog.append(title, copy, label, error, actions);
      document.body.append(dialog);
      dialog.addEventListener("close", () => {
        dialog.remove();
        $("collection-browser-import").focus();
      });
      dialog.showModal();
      cancel.focus();
    } catch (error) {
      message(error.message);
    }
  });
  window.addEventListener("pokedex-before-account-action", (e) => {
    if (
      persisting ||
      state.dirty ||
      document.querySelector("#inventory-dialog[open]")
    ) {
      e.preventDefault();
      syncError(
        "Save or download your collection draft, then reload before using account data controls.",
      );
    }
  });
  window.addEventListener("pokedex-before-signout", (e) => {
    if (persisting) {
      e.preventDefault();
      syncError("Wait for collection Save to finish before signing out.");
      return;
    }
    if (
      state.dirty &&
      !window.confirm(
        "Sign out and discard unsaved collection edits? Download a backup first to keep them.",
      )
    )
      e.preventDefault();
  });
  window.addEventListener("pokedex-account-changed", () => {
    ++loadId;
    blocked = true;
    loading = false;
    selected.clear();
    if (!state.dirty) state.load({ records: [] });
    syncError(
      "Account changed. Download any draft backup, then reload before continuing.",
    );
    render();
  });
  $("collection-reload").addEventListener("click", () => {
    if (state.dirty) {
      confirm(
        "Reload collection?",
        "Unsaved collection edits will be discarded. Download backup first if you want to keep them.",
        load,
      );
    } else load();
  });
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "s" &&
      !$("collection-panel").hidden
    ) {
      e.preventDefault();
      if (!document.querySelector("dialog[open]")) save();
    }
  });
  window.addEventListener("storage", (e) => {
    if (
      !repository.enabled &&
      (e.key === "pokedex.collection.v1" || e.key === null)
    ) {
      if (state.dirty || document.querySelector("dialog[open]"))
        message(
          "Collection changed in another tab. Download edits or reload before saving.",
        );
      else load();
    }
  });
  options(
    "inventory-set-filter",
    [...new Map(cards.map((c) => [c.setId, c.setName])).entries()].sort(
      (a, b) => a[1].localeCompare(b[1]),
    ),
    "All sets",
  );
  if (repository.enabled)
    $("collection-storage-help").textContent =
      "Private account collection. Save keeps edits. Browser imports never add overlapping quantities automatically. Download backups to keep a portable copy. Sample catalogue; live prices are unavailable.";
  await load();
  if (location.hash) {
    try {
      const selection = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      const card = byId.get(selection.cardId);
      if (!card)
        throw Error("That printing is unavailable in this sample catalogue.");
      if (!["owned", "wanted"].includes(selection.kind))
        selection.kind = "owned";
      if (selection.finish !== "unknown" && !card.variants?.[selection.finish])
        selection.finish = "unknown";
      view = selection.kind;
      render();
      if (!blocked) form.open(null, selection);
    } catch (error) {
      message(
        error instanceof SyntaxError
          ? "The card selection link is invalid."
          : error.message,
      );
    }
    history.replaceState(null, "", location.pathname + location.search);
  }
})();
