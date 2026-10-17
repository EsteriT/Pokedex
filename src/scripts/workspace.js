(() => {
  "use strict";
  const repository = window.BinderRepository || window.BinderStore;
  let persisting = false;
  const $ = (id) => document.getElementById(id),
    limit = 3;
  const grid = $("binder-grid"),
    edit = $("edit-dialog"),
    deletion = $("delete-dialog");
  let binders = [],
    mode = "create",
    currentId = null,
    returnFocus = null;
  const announce = (text) => ($("announcement").textContent = text);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const button = (text, cls, action) => {
    const n = el("button", cls, text);
    n.type = "button";
    n.addEventListener("click", action);
    return n;
  };
  function modal(dialog) {
    returnFocus = document.activeElement;
    document
      .querySelectorAll(
        ".account[open], .card-menu[open], .collection-more[open]",
      )
      .forEach((n) => (n.open = false));
    dialog.showModal();
  }
  [edit, deletion].forEach((d) => {
    d.querySelectorAll(".close-dialog").forEach((b) =>
      b.addEventListener("click", () => d.close()),
    );
    d.addEventListener("close", () => {
      if (returnFocus?.isConnected) returnFocus.focus();
      else
        ($("create-binder").disabled
          ? grid.querySelector(".open-button")
          : $("create-binder")
        )?.focus();
    });
  });
  function beginCreate() {
    if (repository.enabled && !repository.user) {
      announce(
        "Sign in with Google from the account menu to create a cloud binder.",
      );
      document.querySelector(".account").open = true;
      return;
    }
    if (binders.length >= limit) {
      announce("All three binder slots are in use.");
      return;
    }
    mode = "create";
    currentId = null;
    $("binder-form").reset();
    $("form-title").textContent = "Create a binder.";
    $("form-eyebrow").textContent = "CREATE BINDER";
    $("form-description").textContent =
      "Start with one page. Add more as your collection grows.";
    $("form-submit").textContent = "Create binder";
    $("layout-fields").hidden = false;
    $("creation-note").hidden = false;
    $("form-error").textContent = "";
    modal(edit);
    $("binder-name").focus();
  }
  function rename(b) {
    mode = "rename";
    currentId = b.id;
    $("binder-name").value = b.name;
    $("form-title").textContent = "Rename your binder.";
    $("form-eyebrow").textContent = "RENAME BINDER";
    $("form-description").textContent =
      "Update the name shown in your workspace.";
    $("form-submit").textContent = "Rename binder";
    $("layout-fields").hidden = true;
    $("creation-note").hidden = true;
    $("form-error").textContent = "";
    modal(edit);
    $("binder-name").focus();
    $("binder-name").select();
  }
  async function duplicate(b) {
    if (binders.length >= limit) {
      announce("Delete a binder before duplicating another.");
      return;
    }
    const duplicated = {
      ...b,
      id: crypto.randomUUID(),
      name: b.name.slice(0, 53) + " (copy)",
      cards: [...b.cards],
      revision: 0,
      document: b.document
        ? {
            ...JSON.parse(JSON.stringify(b.document)),
            name: b.name.slice(0, 53) + " (copy)",
          }
        : undefined,
    };
    if (!(await persist([...binders, duplicated]))) return;
    render();
    announce("Binder duplicated.");
  }
  async function persist(next) {
    if (persisting) return false;
    persisting = true;
    grid.setAttribute("aria-busy", "true");
    try {
      // Refuse stale Workspace actions rather than overwrite another tab's work.
      const latest = repository.enabled
        ? await repository.refresh()
        : repository.read();
      if (JSON.stringify(latest) !== JSON.stringify(binders)) {
        binders = latest;
        render();
        announce(
          "Workspace changed in another tab. Review the refreshed binders and try again.",
        );
        return false;
      }
      binders = await repository.write(next);
      return true;
    } catch (error) {
      announce(error.message);
      if (edit.open) $("form-error").textContent = error.message;
      return false;
    } finally {
      persisting = false;
      grid.setAttribute("aria-busy", "false");
    }
  }
  function askDelete(b) {
    currentId = b.id;
    $("delete-copy").textContent =
      `“${b.name}” and its ${b.pages} ${b.pages === 1 ? "page" : "pages"} will be permanently deleted. Physical inventory is unaffected.`;
    modal(deletion);
    deletion.querySelector(".close-dialog").focus();
  }
  function binderDestination(b, customize = false) {
    const destination = new URL(document.getElementById("editor-route").href);
    destination.hash = encodeURIComponent(
      JSON.stringify({
        id: b.id,
        customize,
        name: b.name,
        pages: b.pages,
        rows: b.rows,
        columns: b.columns,
        cards: b.cards,
      }),
    );
    return destination.href;
  }
  function openBinder(b, customize = false) {
    window.location.assign(binderDestination(b, customize));
  }

  async function reorderBinder(id, targetIndex) {
    if ($("binder-search").value.trim()) {
      announce("Clear search before reordering binders.");
      return;
    }
    const from = binders.findIndex((b) => b.id === id);
    if (
      from < 0 ||
      targetIndex < 0 ||
      targetIndex >= binders.length ||
      from === targetIndex
    )
      return;
    const next = [...binders],
      moved = next.splice(from, 1)[0];
    next.splice(targetIndex, 0, moved);
    if (!(await persist(next))) return;
    render();
    document
      .querySelector('[data-focus-key="' + CSS.escape(id + ":menu") + '"]')
      ?.focus({ preventScroll: true });
    announce(
      moved.name +
        " moved to position " +
        (targetIndex + 1) +
        ". Shelf order saved.",
    );
  }
  function positionBinderMenu(menu) {
    const panel = menu.querySelector(".menu-items");
    panel.style.setProperty("--menu-shift", "0px");
    const anchor = menu.getBoundingClientRect();
    panel.style.top = anchor.height + 8 + "px";
    const r = panel.getBoundingClientRect();
    const preferredTop =
      r.bottom > innerHeight - 16
        ? anchor.top - r.height - 8
        : anchor.bottom + 8;
    const top = Math.max(
      16,
      Math.min(preferredTop, innerHeight - r.height - 16),
    );
    panel.style.top = top - anchor.top + "px";
    const shift =
      r.left < 16
        ? 16 - r.left
        : r.right > innerWidth - 16
          ? innerWidth - 16 - r.right
          : 0;
    panel.style.setProperty("--menu-shift", shift + "px");
  }
  window.addEventListener("resize", () => {
    document.querySelectorAll(".card-menu[open]").forEach(positionBinderMenu);
  });
  function card(b) {
    const article = el("article", "binder-card"),
      art = el("a", "binder-art has-cover");
    const theme = b.document?.cover?.theme || "classic";
    article.dataset.coverTheme = theme;

    art.href = binderDestination(b);
    art.tabIndex = -1;
    art.setAttribute("aria-label", "Open " + b.name);

    const cover = window.BinderCovers.create(
      b.document?.cover || theme,
      b.name,
      b,
    );
    art.append(cover);
    article.dataset.binderId = b.id;
    const filtered = !!$("binder-search").value.trim(),
      index = binders.findIndex((n) => n.id === b.id);
    const info = el("div", "binder-info"),
      top = el("div", "binder-top"),
      menu = el("details", "card-menu"),
      summary = el("summary", "", "⋯");
    summary.setAttribute("aria-label", "Actions for " + b.name);
    summary.title = "Actions for " + b.name;
    const items = el("div", "menu-items");

    const view = el("a", "view-binder-action button secondary", "View binder");
    const destination = new URL($("viewer-route").href);
    destination.searchParams.set("binder", b.id);
    view.href = destination.href;
    view.textContent = "View";
    view.setAttribute("aria-label", "View " + b.name);
    view.dataset.focusKey = b.id + ":view";
    items.append(button("Customize", "", () => openBinder(b, true)));
    for (const [label, delta] of [
      ["Move earlier", -1],
      ["Move later", 1],
    ]) {
      const move = button(label, "", () => reorderBinder(b.id, index + delta));
      move.disabled =
        filtered || index + delta < 0 || index + delta >= binders.length;
      move.title = filtered ? "Clear search to reorder" : "";
      items.append(move);
    }

    items.append(button("Rename", "", () => rename(b)));
    const copy = button("Duplicate", "", () => duplicate(b));
    copy.disabled = binders.length >= limit;
    if (copy.disabled) copy.title = "All three binder slots are in use";
    items.append(
      copy,
      el("hr", "binder-menu-divider"),
      button("Delete", "delete-action", () => askDelete(b)),
    );
    items
      .querySelectorAll("button")
      .forEach((n) => (n.dataset.focusKey = b.id + ":" + n.textContent));
    summary.dataset.focusKey = b.id + ":menu";
    menu.append(summary, items);
    menu.addEventListener("toggle", () => {
      if (menu.open) {
        document.querySelectorAll(".card-menu[open]").forEach((other) => {
          if (other !== menu) other.open = false;
        });
        positionBinderMenu(menu);
      }
    });

    const heading = el("h2", ""),
      title = el("a", "open-button", b.name);
    title.href = binderDestination(b);
    title.title = b.name;
    title.dataset.focusKey = b.id + ":open";
    title.setAttribute("aria-label", "Open " + b.name);
    heading.append(title);

    top.append(heading, menu);

    const metadata = el("p", "binder-meta");
    metadata.append(
      el("span", "", b.pages + " " + (b.pages === 1 ? "page" : "pages")),
      el("span", "meta-separator", "·"),
      el("span", "", window.BinderCovers.name(theme)),
    );
    metadata
      .querySelector(".meta-separator")
      .setAttribute("aria-hidden", "true");
    const actions = el("div", "binder-card-actions");
    const editLink = el("a", "edit-binder-action button secondary", "Edit");
    editLink.href = binderDestination(b);
    editLink.setAttribute("aria-label", "Edit " + b.name);
    editLink.dataset.focusKey = b.id + ":edit";
    actions.append(view, editLink);
    info.append(top, metadata, actions);
    article.append(art, info);
    return article;
  }
  function render() {
    const active = document.activeElement,
      key = active?.dataset.focusKey;
    const query = $("binder-search").value.trim().toLowerCase(),
      filtered = binders.filter((b) => b.name.toLowerCase().includes(query));
    grid.replaceChildren(...filtered.map(card));
    grid.setAttribute("aria-busy", "false");
    $("error-state").hidden = true;
    $("empty-state").hidden = binders.length !== 0;
    $("no-results").hidden = binders.length === 0 || filtered.length !== 0;
    grid.hidden = binders.length === 0 || filtered.length === 0;
    $("limit-copy").textContent = `${binders.length} of ${limit} binders`;
    $("tab-count").textContent = binders.length;
    $("create-binder").disabled = binders.length >= limit;
    $("limit-notice").hidden = binders.length < limit;
    if (key && !active.isConnected) {
      const next = document.querySelector(
        '[data-focus-key="' + CSS.escape(key) + '"]',
      );
      (next || grid.querySelector(".open-button") || $("create-binder")).focus({
        preventScroll: true,
      });
    }
  }
  $("binder-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("binder-name").value.trim();
    if (!name) {
      $("form-error").textContent = "Give your binder a name.";
      $("binder-name").focus();
      return;
    }
    let next = JSON.parse(JSON.stringify(binders));
    if (mode === "rename") {
      const b = next.find((b) => b.id === currentId);
      if (!b) {
        $("form-error").textContent =
          "This binder is no longer available. Close this dialog and choose another binder.";
        return;
      }
      b.name = name;
      b.revision = (b.revision || 0) + 1;
      if (b.document) b.document.name = name;
    } else {
      if (binders.length >= limit) {
        $("form-error").textContent = "All three binder slots are in use.";
        return;
      }
      const rows = Number($("binder-rows").value),
        columns = Number($("binder-columns").value);
      if (
        !Number.isInteger(rows) ||
        !Number.isInteger(columns) ||
        rows < 1 ||
        rows > 6 ||
        columns < 1 ||
        columns > 6
      ) {
        $("form-error").textContent = "Choose whole numbers from 1 to 6.";
        return;
      }
      next.push({
        id: crypto.randomUUID(),
        revision: 0,
        name,
        pages: 1,
        rows,
        columns,
        style: "lavender",
        cards: [],
        label: "YOUR NEXT COLLECTION",
      });
      $("binder-search").value = "";
    }
    if (!(await persist(next))) return;
    render();
    edit.close();
    announce(
      mode === "rename" ? "Binder renamed." : "Binder created with one page.",
    );
  });
  $("confirm-delete").addEventListener("click", async () => {
    if (!(await persist(binders.filter((b) => b.id !== currentId)))) return;
    render();
    deletion.close();
    announce(
      "Sample binder permanently deleted. Physical inventory is unaffected.",
    );
  });
  function tab(which, focus = false) {
    const binder = which === "binders";
    const url = new URL(location.href);
    if (binder) url.searchParams.delete("tab");
    else url.searchParams.set("tab", "collection");
    history.replaceState(null, "", url.href);
    $("binders-panel").hidden = !binder;
    $("collection-panel").hidden = binder;
    for (const [id, selected] of [
      ["binders-tab", binder],
      ["collection-tab", !binder],
    ]) {
      $(id).setAttribute("aria-selected", String(selected));
      $(id).tabIndex = selected ? 0 : -1;
    }
    if (focus) $(binder ? "binders-tab" : "collection-tab").focus();
  }
  for (const id of ["binders-tab", "collection-tab"]) {
    $(id).addEventListener("click", () =>
      tab(id === "binders-tab" ? "binders" : "collection"),
    );
    $(id).addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        tab(
          e.key === "Home"
            ? "binders"
            : e.key === "End"
              ? "collection"
              : id === "binders-tab"
                ? "collection"
                : "binders",
          true,
        );
      }
    });
  }

  $("binder-search").addEventListener("input", render);
  $("clear-search").addEventListener("click", () => {
    $("binder-search").value = "";
    render();
    $("binder-search").focus();
  });
  $("create-binder").addEventListener("click", beginCreate);
  $("empty-create").addEventListener("click", beginCreate);
  async function initialize() {
    try {
      if (repository.enabled) await repository.ready;
      if (!Array.isArray(window.SAMPLE_BINDERS))
        throw Error("Sample data missing");
      binders = repository.read();
      if (repository.enabled) {
        document.querySelector(
          "#binders-panel .preview-disclosure",
        ).textContent =
          "Private cloud binders. Use Save in the editor to keep card changes.";
        $("error-state").querySelector("p").textContent =
          "Your saved binders have not been changed.";
      }
      $("binder-search").value = "";
      render();
    } catch (error) {
      announce(error.message);
      grid.hidden = true;
      $("empty-state").hidden = true;
      $("no-results").hidden = true;
      $("error-state").hidden = false;
      grid.setAttribute("aria-busy", "false");
    }
  }
  $("retry").addEventListener("click", () =>
    repository.enabled ? location.reload() : initialize(),
  );
  $("reset-demo")?.addEventListener("click", () => {
    if (
      !window.confirm(
        "Reset this browser's saved binders to the sample binders? Download any binders you want to keep first. This cannot be undone.",
      )
    )
      return;
    try {
      window.BinderStore.reset();
    } catch (error) {
      announce(error.message);
      return;
    }
    initialize();
    document.querySelector(".account").open = false;
    announce("Sample binders reset. Collection records are unchanged.");
  });
  document.addEventListener("click", (e) => {
    document
      .querySelectorAll(
        ".account[open], .card-menu[open], .collection-more[open]",
      )
      .forEach((d) => {
        if (!d.contains(e.target)) d.open = false;
      });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll(
          ".account[open], .card-menu[open], .collection-more[open]",
        )
        .forEach((d) => {
          d.open = false;
          d.querySelector("summary")?.focus({ preventScroll: true });
        });
  });
  window.addEventListener("storage", (e) => {
    if (
      (e.key === "pokedex.workspace.v1" || e.key === null) &&
      !document.querySelector("dialog[open]")
    )
      initialize();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) initialize();
  });
  tab(
    new URLSearchParams(location.search).get("tab") === "collection"
      ? "collection"
      : "binders",
  );
  grid.append(el("div", "skeleton"), el("div", "skeleton"));
  setTimeout(initialize, 200);
})();
