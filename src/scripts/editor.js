window.EditorReady = (async () => {
  "use strict";
  const repository = window.BinderRepository || window.BinderStore;
  if (repository.enabled) await repository.ready;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  await window.CardCatalogue?.ready;
  try {
    if (location.hash)
      await window.CardCatalogue?.ensure(
        JSON.parse(decodeURIComponent(location.hash.slice(1))),
      );
  } catch (error) {
    console.warn(error.message);
  }
  const $ = (id) => document.getElementById(id),
    cards =
      window.CardCatalogue?.byId ||
      new Map(window.CARDS.map((c) => [c.id || c.collectorNumber, c]));
  let seed = {
    name: "My first binder",
    pages: 1,
    rows: 3,
    columns: 3,
    cards: ["166", "167", "198", "168", "169", "199"],
  };
  try {
    if (location.hash) {
      const value = JSON.parse(decodeURIComponent(location.hash.slice(1)));
      if (value && typeof value === "object")
        seed = {
          id: window.BinderSchema.validIdentifier(value.id)
            ? value.id
            : undefined,
          returnTo:
            typeof value.returnTo === "string" && value.returnTo.length <= 1200
              ? value.returnTo
              : "",
          placeCard: cards.has(value.placeCard) ? value.placeCard : undefined,
          finish: ["normal", "reverse", "holo", "firstEdition"].includes(
            value.finish,
          )
            ? value.finish
            : undefined,
          customize: value.customize === true,
          page: Number.isInteger(value.page) ? value.page : 0,
          name: String(value.name || seed.name).slice(0, 60),
          pages: Number.isInteger(value.pages) ? value.pages : 1,
          rows: Number.isInteger(value.rows) ? value.rows : 3,
          columns: Number.isInteger(value.columns) ? value.columns : 3,
          cards: Array.isArray(value.cards)
            ? value.cards.filter((c) => cards.has(c))
            : [],
        };
    }
  } catch {}
  let returnTo = "";
  if (seed.returnTo) {
    try {
      const target = new URL(seed.returnTo, location.href),
        route = new URL($("discover-nav").href);
      if (
        target.origin === route.origin &&
        target.pathname === route.pathname
      ) {
        target.hash = "";
        returnTo = target.pathname + target.search;
        $("discover-nav").href = target.href;
        $("return-results").href = target.href;
        $("return-results").hidden = false;
      }
    } catch {}
  }
  let stored;
  try {
    if (repository.enabled && !repository.user && seed.id)
      throw Error("Sign in from Workspace to open your private cloud binder.");
    stored = repository.read().find((b) => b.id === seed.id);
    if (seed.id && !stored)
      throw Error(
        "This binder is no longer available. Return to Workspace to choose a binder.",
      );
    if (stored && !stored.document)
      seed = {
        ...seed,
        name: stored.name,
        pages: stored.pages,
        rows: stored.rows,
        columns: stored.columns,
        cards: stored.cards,
      };
  } catch (error) {
    const panel = document.createElement("section"),
      title = document.createElement("h1"),
      explanation = document.createElement("p"),
      back = document.createElement("a");
    panel.id = "editor-load-error";
    panel.setAttribute("role", "alert");
    title.textContent = "Binder unavailable";
    explanation.textContent = error.message;
    back.href = document.querySelector(".workspace-back").href;
    back.className = "button secondary";
    back.textContent = "Back to Workspace";
    panel.append(title, explanation, back);
    $("editor-main").replaceChildren(panel);
    document.querySelector(".editor-feedback").hidden = true;
    $("theme-toggle").hidden = true;
    $("rename-binder").disabled = true;
    $("binder-title").textContent = "Binder unavailable";
    $("save").disabled = true;
    $("save-status").textContent = "Not loaded";
    document.documentElement.classList.remove("editor-loading");
    back.focus();
    return;
  }
  const state = window.BinderState.create(seed);
  let binderId = seed.id || crypto.randomUUID(),
    revision = null,
    loadedDocument = false;
  if (stored) {
    revision = stored.revision;
    if (stored.document) {
      state.load(stored.document);
      loadedDocument = true;
    }
  }
  let saving = false,
    savedLocally = loadedDocument,
    selectMode = false,
    fittedScale = 1;
  const focusKey = () => {
    const active = document.activeElement;
    return {
      id: active?.id,
      key: active?.dataset.focusKey,
      pocket: active?.dataset.regionId,
      active,
    };
  };
  function restoreFocus(focus) {
    if (!focus || focus.active?.isConnected) return;
    const target = focus.id
      ? $(focus.id)
      : focus.key
        ? document.querySelector(
            '[data-focus-key="' + CSS.escape(focus.key) + '"]',
          )
        : focus.pocket
          ? document.querySelector(
              '[data-region-id="' + CSS.escape(focus.pocket) + '"]',
            )
          : null;
    (
      target ||
      document.querySelector("#binder-page button") ||
      $("select-pockets")
    ).focus({ preventScroll: true });
  }
  let pageId =
      state.document.pages[
        Math.max(0, Math.min(state.document.pages.length - 1, seed.page || 0))
      ].id,
    selected = [],
    spreadMode = false,
    pending = null,
    insertDirection = 0,
    dragSource = null,
    ignorePocketClickUntil = 0,
    confirmation = null,
    leaving = null,
    dialogFocus = new WeakMap(),
    leaveApproved = false,
    savedOnce = false,
    editVersion = 0,
    toastAction = null;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  let messageTimer,
    savedTimer,
    toastRemaining = 3000,
    toastStarted = 0;
  const toast = document.querySelector(".editor-feedback");
  // Keep notifications outside scrolling, hidden and inert editor panels.
  document.body.append(toast);
  let toastHovered = false,
    toastSuppressed = false;
  function positionToast() {
    const canvas = document.querySelector(".canvas-panel"),
      rect = canvas.getBoundingClientRect();
    const offset = 16;
    const mobileUtility =
      innerWidth <= 700 &&
      document
        .querySelector(".editor-shell")
        .classList.contains("utility-open");
    toastSuppressed = mobileUtility;
    toast.style.visibility =
      rect.width > 0 && !mobileUtility ? "visible" : "hidden";
    if (mobileUtility) pauseToast();
    else resumeToast();
    toast.style.setProperty("--toast-center", rect.right - 16 + "px");
    toast.style.setProperty(
      "--toast-room",
      Math.max(0, Math.min(420, rect.width - 32)) + "px",
    );
    toast.style.setProperty(
      "--toast-bottom",
      innerHeight - rect.bottom + offset + "px",
    );
  }
  function pauseToast() {
    if (!toastStarted) return;
    clearTimeout(messageTimer);
    toastRemaining = Math.max(
      0,
      toastRemaining - (performance.now() - toastStarted),
    );
    toastStarted = 0;
  }
  function resumeToast() {
    if (
      toast.hidden ||
      toast.classList.contains("is-error") ||
      toastSuppressed ||
      toastHovered ||
      toast.contains(document.activeElement) ||
      toastStarted
    )
      return;
    toastStarted = performance.now();
    messageTimer = setTimeout(() => {
      toast.hidden = true;
      toastStarted = 0;
    }, toastRemaining);
  }
  // Geometry-based hover keeps the toast itself transparent to drag/drop.
  document.addEventListener(
    "pointermove",
    (event) => {
      if (toast.hidden) return;
      const rect = toast.getBoundingClientRect();
      const hovered =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (hovered === toastHovered) return;
      toastHovered = hovered;
      if (hovered) pauseToast();
      else resumeToast();
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    toastHovered = false;
    resumeToast();
  });
  toast.addEventListener("focusin", pauseToast);
  toast.addEventListener("focusout", () => requestAnimationFrame(resumeToast));
  window.addEventListener("resize", positionToast);
  window.addEventListener("editor-layout", positionToast);
  document.addEventListener("scroll", positionToast, true);
  const message = (text, error = false, action = null) => {
    toastAction = action ? { kind: action, version: editVersion } : null;
    clearTimeout(messageTimer);
    toastStarted = 0;
    toastRemaining = 3000;
    $("editor-message").textContent = error
      ? text
      : text.replace(/\.\s[\s\S]*$/, ".");
    $("editor-message").title = text;
    toast.hidden = !text;
    toast.classList.toggle("is-error", error);
    toast.setAttribute("role", error ? "alert" : "status");
    toast.title = text;
    if ($("toast-indicator")) $("toast-indicator").title = text;
    syncToastAction();
    positionToast();
    resumeToast();
  };
  $("feedback-dismiss").addEventListener("click", () => message(""));
  function syncToastAction() {
    const valid =
      toastAction &&
      toastAction.version === editVersion &&
      (toastAction.kind === "redo" ? state.canRedo : state.canUndo);
    $("feedback-undo").hidden = !valid;
    $("feedback-undo").textContent =
      toastAction?.kind === "redo" ? "Redo" : "Undo";
    window.EditorIcon?.($("feedback-undo"), $("feedback-undo").textContent);
  }
  const currentPage = () =>
    state.document.pages.find((p) => p.id === pageId) ||
    state.document.pages[0];
  const nameOf = (id) => cards.get(id)?.name || "Sample card";
  function run(fn, text, action = "undo") {
    try {
      const before = JSON.stringify(state.document);
      fn();
      const changed = before !== JSON.stringify(state.document);
      if (changed) editVersion++;
      if (!state.document.pages.some((p) => p.id === pageId))
        pageId = state.document.pages[0].id;
      selected = [];
      pending = null;
      render();
      if (text) message(text, false, changed ? action : null);
      return true;
    } catch (error) {
      message(error.message, true);
      return false;
    }
  }
  function openDialog(d) {
    dialogFocus.set(d, {
      node: document.activeElement,
      region: selected[0],
    });
    d.showModal();
  }
  [
    $("confirm-dialog"),
    $("leave-dialog"),
    $("name-dialog"),
    $("pocket-dialog"),
    $("move-dialog"),
  ].forEach((d) =>
    d.addEventListener("close", () => {
      const focus = dialogFocus.get(d);
      window.UIControls.restoreFocus(
        focus?.node,
        () =>
          focus?.region &&
          document.querySelector(
            '.editor-pocket[data-region-id="' + CSS.escape(focus.region) + '"]',
          ),
        () => document.querySelector(".editor-pocket"),
        $("select-pockets"),
      );
    }),
  );
  function confirm(title, copy, action) {
    $("confirm-title").textContent = title;
    $("confirm-copy").textContent = copy;
    confirmation = action;
    openDialog($("confirm-dialog"));
    $("confirm-cancel").focus();
  }
  $("confirm-cancel").addEventListener("click", () =>
    $("confirm-dialog").close(),
  );
  $("confirm-yes").addEventListener("click", () => {
    $("confirm-dialog").close();
    const action = confirmation;
    confirmation = null;
    action?.();
  });
  function setPending(source) {
    insertDirection = 0;
    selectMode = false;
    pending = source;
    selected = source.kind === "pocket" ? [source.regionId] : [];
    render();
    if (source.kind !== "pocket") window.EditorMobile?.showBinder();
    message("");
  }
  function drag(node, source) {
    node.draggable = source.kind !== "pocket" || !selectMode;
    let touch = null,
      holdTimer;
    const clearTouch = () => {
      clearTimeout(holdTimer);
      document
        .querySelectorAll(".is-touch-target")
        .forEach((n) => n.classList.remove("is-touch-target"));
      node.classList.remove("is-touch-dragging");
    };
    node.addEventListener("pointerdown", (e) => {
      if (selectMode || e.pointerType === "mouse" || source.kind !== "pocket")
        return;
      touch = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
      holdTimer = setTimeout(() => {
        if (!touch) return;
        touch.active = true;
        node.setPointerCapture(touch.id);
        node.classList.add("is-touch-dragging");
      }, 220);
    });
    node.addEventListener("pointermove", (e) => {
      if (!touch || e.pointerId !== touch.id) return;
      if (!touch.active) {
        if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 8) {
          clearTouch();
          touch = null;
        }
        return;
      }
      e.preventDefault();
      document
        .querySelectorAll(".is-touch-target")
        .forEach((n) => n.classList.remove("is-touch-target"));
      document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest(".editor-pocket")
        ?.classList.add("is-touch-target");
    });
    node.addEventListener("pointerup", (e) => {
      if (!touch || e.pointerId !== touch.id) return;
      const active = touch.active;
      touch = null;
      clearTouch();
      if (!active) return;
      ignorePocketClickUntil = performance.now() + 450;
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest(".editor-pocket");
      if (
        target &&
        (target.dataset.pageId !== source.pageId ||
          target.dataset.regionId !== source.regionId)
      )
        placeCard(source, target.dataset.pageId, target.dataset.regionId, 0);
    });
    node.addEventListener("pointercancel", () => {
      touch = null;
      clearTouch();
    });
    node.addEventListener("dragstart", (e) => {
      document.body.classList.add("is-dragging");
      selectMode = false;
      if (source.kind === "pocket") activatePage(source.pageId);
      dragSource = source;
      insertDirection = 0;
      pending = source;
      selected = source.kind === "pocket" ? [source.regionId] : [];
      e.dataTransfer.setData("application/x-pokedex", JSON.stringify(source));
      e.dataTransfer.effectAllowed =
        source.kind === "catalogue" ? "copy" : "move";
      updateSelection();
    });
  }
  // Only an active drag from a placed pocket can leave the page for overflow.
  document.addEventListener("dragover", (event) => {
    if (dragSource?.kind !== "pocket" || event.target.closest("#binder-page"))
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });
  document.addEventListener("drop", (event) => {
    if (dragSource?.kind !== "pocket" || event.target.closest("#binder-page"))
      return;
    event.preventDefault();
    const source = dragSource;
    dragSource = null;
    document.body.classList.remove("is-dragging");
    run(
      () => state.toOverflow(source.pageId, [source.regionId]),
      "Item moved to overflow.",
    );
  });
  document.addEventListener(
    "drop",
    () => {
      document.body.classList.remove("is-dragging");
      clearInsertPreview();
    },
    true,
  );
  document.addEventListener("dragend", () => {
    clearInsertPreview();
    document.body.classList.remove("is-dragging");
    if (dragSource && pending === dragSource) {
      pending = null;
      selected = [];
      dragSource = null;
      render();
      message("");
    } else dragSource = null;
  });
  function clearInsertPreview() {
    document
      .querySelectorAll(".is-insert-path,[data-insert-label]")
      .forEach((n) => {
        n.classList.remove("is-insert-path", "is-insert-overflow");
        delete n.dataset.insertLabel;
      });
  }
  function previewInsertion(button, pid, rid, direction) {
    clearInsertPreview();
    if (!direction || pending?.kind !== "catalogue") return;
    try {
      const plan = state.insertionPreview(pid, rid, direction);
      for (const id of plan.regions) {
        const n = document.querySelector('[data-region-id="' + id + '"]');
        n?.classList.add("is-insert-path");
        if (id === plan.regions.at(-1) && plan.overflow)
          n?.classList.add("is-insert-overflow");
      }
      button.dataset.insertLabel = direction === 1 ? "→" : "←";
      const text =
        "Push " +
        (direction === 1 ? "right" : "left") +
        (plan.overflow
          ? " · End card moves to Overflow."
          : " · Stops at the empty pocket.");
      if ($("selection-copy").textContent !== text)
        $("selection-copy").textContent = text;
      $("selection-copy").title = text;
      $("selection-copy").setAttribute("aria-label", text);
      if (!pending && selected.length > 1)
        $("selection-copy").textContent = String(selected.length);
      const indicator = $("placement-indicator");
      if (indicator) {
        indicator.hidden = !pending;
        indicator.title = text;
        indicator.setAttribute("aria-label", text);
      }
    } catch (error) {
      button.dataset.insertLabel = "×";
      if ($("selection-copy").textContent !== error.message)
        $("selection-copy").textContent = error.message;
    }
  }
  function dropDirection(event, button) {
    if (pending?.kind !== "catalogue") return 0;
    const rect = button.getBoundingClientRect(),
      fraction = (event.clientX - rect.left) / rect.width;
    return fraction < 0.25 ? 1 : fraction > 0.75 ? -1 : insertDirection;
  }
  function placeCard(source, pid, rid, direction = 0) {
    if (
      source.kind === "pocket" &&
      source.pageId === pid &&
      source.regionId === rid
    ) {
      pending = null;
      selected = [];
      render();
      message("");
      return;
    }
    const origin =
      source.kind === "pocket"
        ? state.document.pages
            .find((p) => p.id === source.pageId)
            ?.regions.find((r) => r.id === source.regionId)?.content
        : null;
    const target = state.document.pages
      .find((p) => p.id === pid)
      ?.regions.find((r) => r.id === rid)?.content;
    const swap =
      window.BinderVisuals.isCard(origin) &&
      window.BinderVisuals.isCard(target);
    clearInsertPreview();
    run(
      () => {
        activatePage(pid);
        if (direction && source.kind === "catalogue")
          state.insert(source, pid, rid, direction);
        else state.place(source, pid, rid);
        recentlyPlaced = rid;
      },
      swap
        ? "Cards swapped."
        : direction
          ? "Card inserted."
          : source.kind === "pocket"
            ? "Card moved."
            : "Card added.",
    );
  }
  for (const [id, direction] of [
    ["insert-right", 1],
    ["insert-left", -1],
  ])
    $(id).addEventListener("click", () => {
      insertDirection = insertDirection === direction ? 0 : direction;
      clearInsertPreview();
      updateSelection();
    });
  function catalogueCard(content, source) {
    if (content.kind) return customContentCard(content, source);
    const data = cards.get(content.cardId),
      b = el("button", "catalogue-card");
    b.title =
      window.BinderVisuals.name(content) +
      " · " +
      data.setName +
      " #" +
      data.collectorNumber;
    b.type = "button";
    b.dataset.focusKey = source.kind + ":" + (source.cardId || source.id);
    b.setAttribute(
      "aria-label",
      (source.kind === "overflow" ? "Place overflow card " : "Select ") +
        window.BinderVisuals.name(content) +
        ", " +
        data.setName +
        " printing #" +
        data.collectorNumber,
    );
    if (
      pending?.kind === source.kind &&
      (source.kind === "catalogue"
        ? pending.cardId === source.cardId
        : pending.id === source.id)
    )
      b.classList.add("is-selected");
    const image = el("img");
    image.src = window.CardCatalogue?.thumbnail(data) || data?.imageUrl || "";
    image.alt = nameOf(content.cardId);
    image.draggable = false;
    image.loading = "lazy";
    b.append(
      image,
      el("strong", "", nameOf(content.cardId)),
      el("small", "", data.setName + " · #" + data.collectorNumber),
    );
    b.addEventListener("click", () => setPending(source));
    drag(b, source);
    return b;
  }
  let catalogueQuery = null,
    resultPage = 1,
    resultRequest = 0;
  const resultPager = el("div", "catalogue-pagination");
  const previousCards = el("button", "button secondary", "Previous");
  const nextCards = el("button", "button secondary", "Next");
  const resultPageLabel = el("span");
  previousCards.type = nextCards.type = "button";
  resultPager.append(previousCards, resultPageLabel, nextCards);
  resultPager.hidden = true;
  $("card-results").after(resultPager);
  previousCards.addEventListener("click", () => {
    resultPage--;
    renderResults();
  });
  nextCards.addEventListener("click", () => {
    resultPage++;
    renderResults();
  });
  async function renderResults() {
    const focus = focusKey(),
      scroll = $("card-results").scrollTop;
    const q = $("card-search").value.trim().toLowerCase(),
      type = $("type-filter").value,
      set = $("set-filter").value;
    const signature = JSON.stringify([q, type, set]);
    if (signature !== catalogueQuery) resultPage = 1;
    catalogueQuery = signature;
    let results, total;
    const request = ++resultRequest;
    try {
      if (window.CardCatalogue?.enabled) {
        previousCards.disabled = nextCards.disabled = true;
        $("result-count").textContent = "Loading cards...";
        const result = await window.CardCatalogue.search(
          { q, type, set },
          resultPage,
        );
        if (request !== resultRequest) return;
        results = result.cards;
        total = result.total;
        resultPager.hidden = total <= 24;
        resultPageLabel.textContent =
          resultPage + " / " + Math.max(1, Math.ceil(total / 24));
        previousCards.disabled = resultPage === 1;
        nextCards.disabled = resultPage * 24 >= total;
      } else {
        results = window.CARDS.filter(
          (c) =>
            (!q ||
              [c.name, c.collectorNumber, c.setName]
                .join(" ")
                .toLowerCase()
                .includes(q) ||
              String(Number(c.collectorNumber)) === q) &&
            (!type || c.pokemonTypes.includes(type)) &&
            (!set || c.setName === set),
        );
        total = results.length;
      }
    } catch (error) {
      if (request !== resultRequest) return;
      $("result-count").textContent = error.message;
      const retry = el("button", "button secondary", "Retry search");
      retry.type = "button";
      retry.addEventListener("click", () => renderResults());
      $("card-results").replaceChildren(retry);
      resultPager.hidden = true;
      return;
    }
    $("result-count").textContent = total + (total === 1 ? " card" : " cards");
    $("card-results").replaceChildren(
      ...results.map((c) =>
        catalogueCard(
          { cardId: c.id || c.collectorNumber },
          { kind: "catalogue", cardId: c.id || c.collectorNumber },
        ),
      ),
    );
    if (!results.length)
      $("card-results").append(
        el(
          "p",
          "empty-results",
          "No matches. Try another name or clear the filters.",
        ),
      );
    $("card-results").scrollTop = scroll;
    renderCoverControls();
    restoreFocus(focus);
  }
  function renderOverflow() {
    const items = state.document.overflow;
    $("overflow-count").textContent = items.length;
    $("overflow-badge").textContent = items.length;
    $("overflow-badge").hidden = !items.length;
    $("overflow-view").setAttribute(
      "aria-label",
      "Overflow, " + items.length + (items.length === 1 ? " item" : " items"),
    );
    $("empty-overflow").disabled = !items.length;
    $("overflow-items").replaceChildren(
      ...items.map((c) => catalogueCard(c, { kind: "overflow", id: c.id })),
    );
    if (!items.length)
      $("overflow-items").append(
        el("p", "overflow-empty", "No displaced cards"),
      );
  }
  const ns = "http://www.w3.org/2000/svg";
  function svgNode(tag, attrs = {}) {
    const n = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => n.setAttribute(key, value));
    return n;
  }
  // Fill cells and only the gutters that connect cells in this region.
  // Fine-grid tiles also define the outline and the pointer hit area.
  const pocketGeometry = window.BinderGeometry;
  const naturalImages = new Map();
  function cardImageSize(cardId) {
    const card = cards.get(cardId);
    if (!card) return { width: 245, height: 337 };
    if (!naturalImages.has(card.imageUrl)) {
      const img = new Image();
      naturalImages.set(card.imageUrl, img);
      img.addEventListener("load", () => requestAnimationFrame(renderCanvas), {
        once: true,
      });
      img.src = card.imageUrl;
    }
    const img = naturalImages.get(card.imageUrl);
    return { width: img.naturalWidth || 245, height: img.naturalHeight || 337 };
  }
  function visiblePages() {
    const pages = state.document.pages,
      index = pages.findIndex((p) => p.id === pageId);
    return spreadMode
      ? pages.slice(
          Math.floor(Math.max(0, index) / 2) * 2,
          Math.floor(Math.max(0, index) / 2) * 2 + 2,
        )
      : [currentPage()];
  }
  function activatePage(id) {
    if (pageId !== id) {
      pageId = id;
      selected = [];
    }
  }
  function renderCanvas() {
    const focus = focusKey();
    const stage = $("canvas-stage"),
      area = $("binder-page");
    const style = getComputedStyle(stage);
    const px = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const py = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    if (stage.clientWidth <= px || stage.clientHeight <= py) return;
    const showCover = coverOpen && customTab === "cover";
    area.classList.toggle("is-cover-preview", showCover);
    if (showCover) {
      const fit = Math.max(
        0.001,
        Math.min(
          (stage.clientWidth - px - 16) / 260,
          (stage.clientHeight - py - 16) / (260 / 0.75),
        ),
      );
      const scale = fit;
      const width = 260 * scale;
      stage.dataset.scale = scale;
      stage.dataset.fitScale = fit;
      area.classList.remove("is-spread");
      area.style.width = width + "px";
      area.style.height = width / 0.75 + "px";
      area.setAttribute("aria-label", "Live binder cover preview");
      const book = window.BinderCovers.create(
        studio.coverValue(coverDraft),
        state.document.name,
        state.document,
      );
      book.style.width = "100%";
      book.style.height = "100%";
      area.replaceChildren(book);
      stage.classList.toggle("is-fit", scale <= fit + 0.00001);
      restoreFocus(focus);
      return;
    }
    area.setAttribute("aria-label", "Binder page pockets");
    const shown = visiblePages();
    const contents = shown
      .flatMap((page) => page.regions)
      .filter((r) => window.BinderVisuals.isCard(r.content));
    const reference = contents.length
      ? cardImageSize(contents[0].content.cardId)
      : { width: 245, height: 337 };
    const ratio = 337 / 245,
      base = reference.width,
      gapBase = base * 0.06;
    let maxScale = contents.length ? 1 : Infinity;
    for (const r of contents) {
      const image = cardImageSize(r.content.cardId);
      const xs = r.cells.map((c) => c[1]),
        ys = r.cells.map((c) => c[0]);
      const width =
        (Math.max(...xs) - Math.min(...xs) + 1) * (base + gapBase) - gapBase;
      const height =
        (Math.max(...ys) - Math.min(...ys) + 1) * (base * ratio + gapBase) -
        gapBase;
      const imageRatio = image.width / image.height;
      const drawnWidth = Math.min(width, height * imageRatio);
      maxScale = Math.min(maxScale, image.width / drawnWidth);
    }
    const dimensions = shown.map((page) => ({
      width: page.columns * base + (page.columns - 1) * gapBase,
      height: page.rows * base * ratio + (page.rows - 1) * gapBase,
    }));
    if (spreadMode && shown.length === 1) dimensions.push({ ...dimensions[0] });
    const bookGap = spreadMode ? (innerWidth <= 700 ? 16 : 32) : 0,
      labelSpace = spreadMode ? 48 : 0;
    const logicalWidth = dimensions.reduce((sum, d) => sum + d.width, 0),
      logicalHeight = Math.max(...dimensions.map((d) => d.height));
    fittedScale = Math.max(
      0.001,
      Math.min(
        maxScale,
        (stage.clientWidth - px - bookGap) / logicalWidth,
        (stage.clientHeight - py - labelSpace) / logicalHeight,
      ),
    );
    const scale = fittedScale;
    stage.classList.toggle("is-fit", scale <= fittedScale + 0.00001);
    stage.dataset.scale = scale;
    stage.dataset.fitScale = fittedScale;
    const cw = base * scale,
      ch = base * ratio * scale,
      gap = gapBase * scale;
    area.classList.toggle("is-spread", spreadMode);
    area.style.width = logicalWidth * scale + bookGap + "px";
    area.style.height = logicalHeight * scale + labelSpace + "px";
    area.replaceChildren();
    let sheetOffset = 0;
    dimensions.forEach((dimension, pageIndex) => {
      const p = shown[pageIndex];
      const sheet = spreadMode ? el("section", "editor-sheet") : area;
      if (spreadMode) {
        sheet.style.left = sheetOffset + "px";
        sheet.style.top = labelSpace + "px";
        sheet.style.width = dimension.width * scale + "px";
        sheet.style.height = dimension.height * scale + "px";
        sheetOffset += dimension.width * scale + bookGap;
        sheet.classList.toggle(
          "is-active",
          p?.id === pageId && selected.length > 0,
        );
        sheet.setAttribute(
          "aria-label",
          p
            ? "Page " +
                (state.document.pages.findIndex((page) => page.id === p.id) + 1)
            : "No following page",
        );
        if (p) {
          sheet.dataset.pageId = p.id;
          const label = el(
            "button",
            "sheet-label",
            "Page " +
              (state.document.pages.findIndex((page) => page.id === p.id) + 1),
          );
          label.type = "button";
          label.setAttribute(
            "aria-pressed",
            String(p.id === pageId && selected.length > 0),
          );
          label.title = "Edit this page";
          label.addEventListener("click", () => {
            activatePage(p.id);
            render();
          });
          sheet.append(label);
        } else {
          sheet.classList.add("empty-sheet");
          sheet.append(el("span", "", "No next page"));
          const add = el("button", "tool-button", "Add page");
          add.type = "button";
          add.disabled = state.document.pages.length >= 30;
          add.addEventListener("click", () =>
            document.getElementById("add-page").click(),
          );
          sheet.append(add);
        }
        area.append(sheet);
      }
      if (!p) return;
      p.regions.forEach((r) => {
        const ys = r.cells.map((c) => c[0]),
          xs = r.cells.map((c) => c[1]),
          y0 = Math.min(...ys),
          x0 = Math.min(...xs),
          height = (Math.max(...ys) - y0 + 1) * (ch + gap) - gap,
          width = (Math.max(...xs) - x0 + 1) * (cw + gap) - gap,
          b = el("button", "editor-pocket");
        b.type = "button";
        b.dataset.regionId = r.id;
        b.dataset.pageId = p.id;
        b.style.left = x0 * (cw + gap) + "px";
        b.style.top = y0 * (ch + gap) + "px";
        b.style.width = width + "px";
        b.style.height = height + "px";
        if (p.id === pageId && selected.includes(r.id))
          b.classList.add("is-selected");
        b.classList.toggle("has-content", !!r.content);
        b.classList.toggle("is-merged", r.cells.length > 1);
        b.classList.toggle("can-place", !!pending && pending.regionId !== r.id);
        if (recentlyPlaced === r.id) b.classList.add("just-placed");
        b.setAttribute(
          "aria-pressed",
          String(p.id === pageId && selected.includes(r.id)),
        );
        b.setAttribute(
          "aria-label",
          (r.content ? window.BinderVisuals.name(r.content) : "Empty pocket") +
            ", row " +
            (y0 + 1) +
            ", column " +
            (x0 + 1) +
            (r.cells.length > 1
              ? ", merged " + r.cells.length + " pockets"
              : ""),
        );
        const svg = svgNode("svg", {
            viewBox: `0 0 ${width} ${height}`,
            "aria-hidden": "true",
          }),
          defs = svgNode("defs", {}),
          clip = svgNode("clipPath", { id: "clip-" + r.id }),
          geometry = pocketGeometry(r.cells, cw, ch, gap);
        const outline = geometry.outline;
        geometry.rects.forEach((rect) => clip.append(svgNode("rect", rect)));
        defs.append(clip);
        svg.append(
          defs,
          svgNode("rect", {
            width,
            height,
            fill: r.content ? "transparent" : "var(--soft)",
            "clip-path": "url(#clip-" + r.id + ")",
          }),
        );
        if (r.content) {
          window.BinderVisuals.append(
            svg,
            coverOpen &&
              customTab !== "cover" &&
              window.BinderVisuals.isCard(r.content) &&
              ($("frame-scope").value === "binder" ||
                (p.id === pageId &&
                  ($("frame-scope").value === "page" ||
                    selected.includes(r.id))))
              ? {
                  ...r.content,
                  frames: {
                    sleeve: "none",
                    toploader: "none",
                    ...(r.content.frames || state.document.frames),
                    ...frameTouched,
                    ...(frameHover || {}),
                  },
                }
              : r.content,
            width,
            height,
            state.document.frames,
            "clip-" + r.id,
            svgNode,
          );
          if (!coverOpen)
            drag(b, { kind: "pocket", pageId: p.id, regionId: r.id });
        } else {
          const plus = el("span", "empty-plus", "+");
          plus.setAttribute("aria-hidden", "true");
          if (r.cells.length > 1) {
            const cx = (Math.max(...xs) + x0) / 2,
              cy = (Math.max(...ys) + y0) / 2;
            const [y, x] = r.cells.reduce((best, cell) =>
              Math.hypot(cell[0] - cy, cell[1] - cx) <
              Math.hypot(best[0] - cy, best[1] - cx)
                ? cell
                : best,
            );
            Object.assign(plus.style, {
              inset: "auto",
              left: (x - x0) * (cw + gap) + cw / 2 + "px",
              top: (y - y0) * (ch + gap) + ch / 2 + "px",
              transform: "translate(-50%, -50%)",
            });
          }
          b.append(plus);
        }
        svg.append(
          svgNode("path", {
            d: outline,
            fill: "none",
            stroke: selected.includes(r.id) ? "var(--accent)" : "none",
            "stroke-width": selected.includes(r.id) ? 8 : 1,
            "stroke-dasharray": "0",
          }),
        );
        b.prepend(svg);
        b.style.clipPath = "url(#clip-" + r.id + ")";
        b.addEventListener("click", (e) => {
          if (performance.now() < ignorePocketClickUntil) return;
          if (coverOpen) {
            if (
              customTab !== "cover" &&
              window.BinderVisuals.isCard(r.content)
            ) {
              const pageChanged = pageId !== p.id;
              activatePage(p.id);
              pending = null;
              selectMode = false;
              selected =
                e.ctrlKey || e.metaKey || e.shiftKey
                  ? selected.includes(r.id)
                    ? selected.filter((id) => id !== r.id)
                    : [...selected, r.id]
                  : [r.id];
              const scope = $("frame-scope");
              scope.querySelector('[value="selection"]').disabled =
                !selectedCards().length;
              scope.querySelector('[value="selection"]').textContent =
                "Selected cards (" + selectedCards().length + ")";
              scope.value = selectedCards().length ? "selection" : "page";
              scope.querySelector('[value="page"]').disabled = false;
              setStylePicking(false);
              renderFrameChoices();
              if (pageChanged) {
                render();
                renderCoverControls();
              }
              previewCover();
            }
            return;
          }
          activatePage(p.id);
          if (selectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
            pending = null;
            selected = selected.includes(r.id)
              ? selected.filter((id) => id !== r.id)
              : [...selected, r.id];
            render();
            return;
          }
          if (pending) {
            placeCard(pending, p.id, r.id, insertDirection);
            return;
          }
          selected = selected.includes(r.id)
            ? selected.filter((id) => id !== r.id)
            : [
                ...selected.filter((id) =>
                  p.regions.some((r) => r.id === id && r.content),
                ),
                r.id,
              ];
          render();
        });
        b.addEventListener("dragover", (e) => {
          if (pending) {
            e.preventDefault();
            b.classList.add("is-drop-target");
            previewInsertion(b, p.id, r.id, dropDirection(e, b));
            if (!dropDirection(e, b)) updateSelection();
          }
        });
        b.addEventListener("dragleave", () => {
          b.classList.remove("is-drop-target");
          clearInsertPreview();
          updateSelection();
        });
        for (const event of ["pointerenter", "focus"])
          b.addEventListener(event, () =>
            previewInsertion(b, p.id, r.id, insertDirection),
          );
        for (const event of ["pointerleave", "blur"])
          b.addEventListener(event, () => {
            clearInsertPreview();
            updateSelection();
          });
        b.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          dragSource = null;
          b.classList.remove("is-drop-target");
          try {
            const source = JSON.parse(
              e.dataTransfer.getData("application/x-pokedex"),
            );
            if (
              !["catalogue", "pocket", "overflow"].includes(source.kind) ||
              (source.kind === "catalogue" && !cards.has(source.cardId))
            )
              return;
            placeCard(source, p.id, r.id, dropDirection(e, b));
          } catch {
            message("Choose a sample card from this editor.", true);
          }
        });
        sheet.append(b);
      });
    });
    restoreFocus(focus);
  }
  function updateSelection() {
    const p = currentPage();
    document
      .querySelector(".editor-shell")
      .classList.toggle("has-selection", !!selected.length && !pending);
    document
      .querySelector(".editor-shell")
      .classList.toggle("merge-mode", selectMode);
    let text = "";
    if (pending) {
      const item =
        pending.kind === "catalogue"
          ? { cardId: pending.cardId }
          : pending.kind === "overflow"
            ? state.document.overflow.find((c) => c.id === pending.id)
            : state.document.pages
                .find((page) => page.id === pending.pageId)
                ?.regions.find((r) => r.id === pending.regionId)?.content;
      text =
        "Place " +
        window.BinderVisuals.name(item) +
        ": choose a destination pocket.";
    } else if (selected.length)
      text =
        selected.length +
        " pocket" +
        (selected.length === 1 ? "" : "s") +
        " selected";
    $("selection-copy").textContent = text;
    $("selection-copy").title = text;
    $("selection-copy").setAttribute("aria-label", text);
    if (!pending && selected.length > 1)
      $("selection-copy").textContent = String(selected.length);
    const indicator = $("placement-indicator");
    if (indicator) {
      indicator.hidden = !pending;
      indicator.title = text;
      indicator.setAttribute("aria-label", text);
    }
    $("insert-actions").hidden = pending?.kind !== "catalogue";
    $("insert-right").setAttribute(
      "aria-pressed",
      String(insertDirection === 1),
    );
    $("insert-left").setAttribute(
      "aria-pressed",
      String(insertDirection === -1),
    );
    if (pending?.kind === "catalogue" && insertDirection)
      $("selection-copy").textContent =
        "Insert and shift " +
        (insertDirection === 1 ? "right" : "left") +
        ": choose a pocket.";
    document.querySelector(".selection-status").dataset.count = selected.length;
    $("selection-copy").classList.toggle(
      "sr-only",
      !!pending || selected.length === 1,
    );
    $("clear-selection").classList.toggle("sr-only", !pending);
    document.querySelector(".selection-status").dataset.placing =
      String(!!pending);
    document.querySelector(".selection-status").hidden =
      !pending && !selected.length;
    $("clear-selection").hidden = !pending && !selected.length;
    const reason = state.mergeReason(pageId, selected);
    $("merge").disabled = !!reason;
    $("merge").title = reason || "Merge selected connected pockets";
    $("merge").setAttribute("aria-describedby", "tool-help");
    $("tool-help").textContent =
      selected.length > 1 && reason
        ? reason
        : selected.length === 1
          ? "Select more connected pockets to Merge, or select a merged pocket to Unmerge."
          : "Select pockets to enable Merge, Unmerge, and Move.";
    $("selection-actions").hidden = !selected.length || !!pending;
    $("merge").hidden = !selectMode || selected.length < 2;
    $("tool-help").hidden = !(selected.length > 1 && reason);
    $("select-pockets").setAttribute("aria-pressed", String(selectMode));
    $("move-to-page").disabled =
      selected.length !== 1 ||
      !p.regions.find((r) => r.id === selected[0])?.content;
    $("unmerge").disabled =
      selected.length !== 1 ||
      !p.regions.find((r) => r.id === selected[0] && r.cells.length > 1);
    $("unmerge").title = $("unmerge").disabled
      ? "Select one merged pocket."
      : "Split this pocket; contents move to overflow.";
    $("move-to-page").title = $("move-to-page").disabled
      ? "Select one placed item."
      : "Choose a page, then a destination pocket.";
    $("to-overflow").title =
      "Remove selected items from this page; keep them in overflow. Undo restores them.";
    $("to-overflow").disabled = !p.regions.some(
      (r) => selected.includes(r.id) && r.content,
    );
    for (const id of ["unmerge", "move-to-page", "to-overflow"])
      $(id).hidden = $(id).disabled;
    $("selection-actions").hidden =
      !!pending ||
      !selected.length ||
      [...$("selection-actions").children].every((n) => n.hidden);

    const single =
      selected.length === 1 && (!pending || pending.kind === "pocket");
    $("pocket-content").hidden = !single;
    $("pocket-style").hidden = !selected.some((id) =>
      window.BinderVisuals.isCard(p.regions.find((r) => r.id === id)?.content),
    );
    $("selection-actions").hidden =
      !!pending || [...$("selection-actions").children].every((n) => n.hidden);
    arrangeTools?.refresh();
  }
  document.querySelector(".editor-feedback").hidden = true;

  let studio = null,
    arrangeTools = null,
    frameTouched = {},
    recentlyPlaced = null;
  let coverOpen = false,
    coverDraft = "classic",
    coverFocus = null,
    customTab = "cover",
    frameDraft = { sleeve: "none", toploader: "none" },
    coverBaseline = "",
    pocketTarget = null,
    pocketTab = "artwork",
    artDraft = null,
    placeholderDraft = { kind: "placeholder", style: "outline" },
    uploadToken = 0;
  const selectedCards = () =>
    currentPage().regions.filter(
      (r) => selected.includes(r.id) && window.BinderVisuals.isCard(r.content),
    );
  function visualSVG(content, w = 245, h = 337, frames = {}, clip = "") {
    const svg = svgNode("svg", {
      viewBox: "0 0 " + w + " " + h,
      "aria-hidden": "true",
    });
    window.BinderVisuals.append(svg, content, w, h, frames, clip, svgNode);
    return svg;
  }
  function customContentCard(content, source) {
    const b = el("button", "catalogue-card custom-content-card");
    b.type = "button";
    b.dataset.focusKey = source.kind + ":" + source.id;
    b.setAttribute("aria-label", "Place " + window.BinderVisuals.name(content));
    const image = visualSVG(content);
    b.append(
      image,
      el("strong", "", window.BinderVisuals.name(content)),
      el("small", "", content.kind === "artwork" ? "Artwork" : "Placeholder"),
    );
    if (pending?.kind === "overflow" && pending.id === source.id)
      b.classList.add("is-selected");
    b.addEventListener("click", () => setPending(source));
    drag(b, source);
    return b;
  }
  function renderCoverControls() {
    $("customize-label").textContent = "Card styles";
    $("customize-binder").title = "Style card sleeves and toploaders";
    $("customize-binder").setAttribute(
      "aria-expanded",
      String(coverOpen && customTab !== "cover"),
    );
    $("edit-cover-preview").setAttribute(
      "aria-expanded",
      String(coverOpen && customTab === "cover"),
    );
    $("header-cover-art").replaceChildren(
      window.BinderCovers.create(
        state.document.cover || "classic",
        state.document.name,
        state.document,
      ),
    );
    $("edit-cover-preview").setAttribute(
      "aria-label",
      "Cover design · " + window.BinderCovers.name(state.document.cover?.theme),
    );
    $("rename-binder").disabled = coverOpen;
    $("feedback-undo").disabled = coverOpen;
    if (coverOpen) {
      $("undo").disabled = true;
      $("redo").disabled = true;
    }
  }
  function previewCard() {
    return (
      selectedCards()[0]?.content ||
      currentPage().regions.find((r) => window.BinderVisuals.isCard(r.content))
        ?.content || { cardId: "166" }
    );
  }
  function renderFrameChoices() {
    syncStyleScope();
    const key = customTab === "sleeve" ? "sleeve" : "toploader",
      values = [
        "none",
        ...(key === "toploader" ? ["clear"] : []),
        ...window.BinderCovers.themes
          .filter((t) => !["classic", "transparent"].includes(t.id))
          .map((t) => t.id),
      ];
    $("frame-option-label").textContent =
      key === "sleeve" ? "SLEEVE STYLE" : "TOPLOADER STYLE";
    $("frame-style-options").replaceChildren(
      ...values.map((value) => {
        const b = el("button", "frame-style-option");
        b.type = "button";
        b.dataset.frameStyle = value;
        b.setAttribute("aria-pressed", String(frameDraft[key] === value));
        const styles = { ...previewFrames(), [key]: value };
        b.append(
          visualSVG({ ...previewCard(), frames: styles }, 48, 66, styles),
          el(
            "span",
            "",
            value === "none"
              ? "None"
              : value === "clear"
                ? "Clear"
                : window.BinderCovers.name(value),
          ),
        );
        const name = b.lastElementChild;
        const dot = el("i", "preset-color-dot");
        dot.setAttribute("aria-hidden", "true");
        dot.dataset.theme = value;
        dot.style.backgroundColor = {
          poke: "#dc5a68",
          great: "#76a6dd",
          ultra: "#e7c96c",
          master: "#b29ad7",
          premier: "#f0f1f3",
          clear: "#ccd5df",
          none: "#aeb6c5",
        }[value];
        name.prepend(dot);
        const show = () => {
          frameHover = { [key]: value };
          previewCover();
        };
        const hide = () => {
          frameHover = null;
          previewCover();
        };
        b.addEventListener("pointerenter", show);
        b.addEventListener("pointerleave", hide);
        b.addEventListener("focus", show);
        b.addEventListener("blur", hide);
        b.addEventListener("click", () => {
          frameHover = null;
          frameDraft[key] = value;
          frameTouched[key] = value;
          renderFrameChoices();
          previewCover();
        });
        return b;
      }),
    );
  }

  function scopeCards() {
    const scope = $("frame-scope").value;
    if (!scope) return [];
    return scope === "binder"
      ? [
          ...state.document.pages.flatMap((p) =>
            p.regions.map((r) => r.content),
          ),
          ...state.document.overflow,
        ].filter(window.BinderVisuals.isCard)
      : currentPage()
          .regions.filter((r) => scope === "page" || selected.includes(r.id))
          .map((r) => r.content)
          .filter(window.BinderVisuals.isCard);
  }
  function syncStyleScope() {
    const scope = $("frame-scope"),
      count = selectedCards().length,
      pageAvailable = currentPage().regions.some((r) =>
        window.BinderVisuals.isCard(r.content),
      );
    const option = scope.querySelector('[value="selection"]');
    option.disabled = !count;
    option.textContent = count
      ? "Selected cards (" + count + ")"
      : "Select cards";
    scope.querySelector('[value="page"]').disabled = !pageAvailable;
    if (!scope.value || scope.selectedOptions[0]?.disabled)
      scope.value = pageAvailable ? "page" : "";
    const items = scopeCards();
    for (const k of ["sleeve", "toploader"]) {
      if (frameTouched[k]) {
        frameDraft[k] = frameTouched[k];
        continue;
      }
      const values = new Set(
        items.map((c) => (c.frames || state.document.frames)?.[k] || "none"),
      );
      frameDraft[k] =
        values.size > 1
          ? "mixed"
          : values.values().next().value ||
            state.document.frames?.[k] ||
            "none";
    }
  }
  let frameHover = null;
  function previewFrames() {
    const base = {
      sleeve: "none",
      toploader: "none",
      ...(previewCard().frames || state.document.frames),
    };
    for (const k of ["sleeve", "toploader"])
      if (frameDraft[k] !== "mixed") base[k] = frameDraft[k];
    return { ...base, ...(frameHover || {}) };
  }
  function styleScopeText() {
    const scope = $("frame-scope").value;
    const mixed = ["sleeve", "toploader"].filter(
      (k) => frameDraft[k] === "mixed",
    );
    return (
      (scope === "binder" ? "Includes overflow and future additions" : "") +
      (mixed.length
        ? (scope === "binder" ? " · " : "") +
          "Mixed " +
          mixed.join(" / ") +
          ": unchanged until chosen"
        : "")
    );
  }

  function previewCover() {
    const cover = customTab === "cover";
    $("customizer-tab-hint").textContent = cover
      ? "Preview on your binder. Apply cover, then Save."
      : customTab === "sleeve"
        ? "Sleeves protect the surface of a card."
        : "Toploaders are rigid cases around a card.";
    document
      .querySelector(".editor-shell")
      .classList.toggle("styling-card", !cover);
    $("cover-selection-status").hidden = cover;
    if (!cover) {
      syncStyleScope();
    }
    $("edit-cover-preview").setAttribute(
      "aria-expanded",
      String(coverOpen && cover),
    );
    $("customize-binder").setAttribute(
      "aria-expanded",
      String(coverOpen && !cover),
    );
    $("frame-scope").parentElement.hidden = cover;
    $("cover-design-controls").hidden = !cover;
    $("frame-design-controls").hidden = cover;
    for (const tab of ["cover", "sleeve", "toploader"])
      $("custom-tab-" + tab).setAttribute(
        "aria-pressed",
        String(tab === customTab),
      );
    if (cover) {
      $("cover-preview-art").replaceChildren(
        window.BinderCovers.create(
          studio.coverValue(coverDraft),
          state.document.name,
          state.document,
        ),
      );
      $("cover-preview-name").textContent =
        studio.coverValue(coverDraft).title?.text || state.document.name;
      $("cover-preview-theme").textContent =
        window.BinderCovers.name(coverDraft);
      $("cover-selection-status").textContent =
        window.BinderCovers.name(coverDraft) + " · preview only.";
      $("customizer-copy").textContent =
        "Choose a cover, then apply your design.";
      $("cover-apply").textContent = "Apply cover";
      $("cover-apply").disabled =
        (coverDraft === "custom" && !studio.coverValue(coverDraft).artwork) ||
        JSON.stringify(studio.coverValue(coverDraft)) === coverBaseline;
    } else {
      const card = previewCard();
      $("cover-preview-art").replaceChildren(
        visualSVG(
          { ...card, frames: previewFrames() },
          245,
          337,
          previewFrames(),
        ),
      );
      $("cover-preview-name").textContent = window.BinderVisuals.name(card);
      $("cover-preview-theme").textContent =
        (frameDraft.sleeve === "none"
          ? "No sleeve"
          : frameDraft.sleeve === "mixed"
            ? "Mixed sleeves"
            : window.BinderCovers.name(frameDraft.sleeve) + " sleeve") +
        " · " +
        (frameDraft.toploader === "none"
          ? "No toploader"
          : frameDraft.toploader === "clear"
            ? "Clear toploader"
            : frameDraft.toploader === "mixed"
              ? "Mixed toploaders"
              : window.BinderCovers.name(frameDraft.toploader) + " toploader");
      $("cover-selection-status").textContent =
        "Preview only · artwork and ownership are unchanged.";
      $("customizer-copy").textContent =
        $("frame-scope").value === "binder"
          ? "Applies to every card and future additions. Replaces individual styles."
          : "Applies to your chosen cards.";
      $("cover-apply").textContent = "Apply card styles";
      $("cover-apply").disabled =
        !Object.keys(frameTouched).length ||
        ($("frame-scope").value !== "binder" && !scopeCards().length);
      $("cover-selection-status").textContent = styleScopeText();
      $("cover-selection-status").hidden = !$("cover-selection-status")
        .textContent;
    }
    document
      .querySelectorAll("[data-cover-theme]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.coverTheme === coverDraft),
        ),
      );
    updatePageNavigation();
    renderCoverControls();
    window.EditorIcon?.($("cover-apply"), $("cover-apply").textContent);
    renderCanvas();
  }
  function openCover(tab = "cover") {
    selectMode = false;
    pending = null;
    if (tab === "cover") selected = [];
    if (coverOpen) {
      customTab = tab;
      frameHover = null;
      renderFrameChoices();
      previewCover();
      return;
    }
    studio.beginCover();
    coverBaseline = JSON.stringify(
      studio.coverValue(state.document.cover?.theme || "classic"),
    );
    frameTouched = {};
    coverFocus = document.activeElement;
    coverDraft = state.document.cover?.theme || "classic";
    customTab = tab;
    frameDraft = {
      sleeve: "none",
      toploader: "none",
      ...(selectedCards()[0]?.content.frames || state.document.frames),
    };
    const scope = $("frame-scope");
    scope.querySelector('[value="selection"]').disabled =
      !selectedCards().length;
    scope.querySelector('[value="selection"]').textContent =
      "Selected cards (" + selectedCards().length + ")";
    scope.querySelector('[value="page"]').disabled =
      !currentPage().regions.some((r) =>
        window.BinderVisuals.isCard(r.content),
      );
    scope.value = selectedCards().length ? "selection" : "binder";
    coverOpen = true;
    document.querySelector(".editor-shell").classList.add("customizing");
    $("cover-customizer").hidden = false;
    $("cover-preview-stage").hidden = false;
    $("cover-options").replaceChildren(
      ...window.BinderCovers.themes.map((theme) => {
        const b = el("button", "cover-option");
        b.type = "button";
        b.dataset.coverTheme = theme.id;
        b.setAttribute("aria-pressed", String(theme.id === coverDraft));
        b.append(
          window.BinderCovers.create(theme.id, "", state.document),
          el("span", "", theme.name),
        );
        b.addEventListener("click", () => {
          coverDraft = theme.id;
          studio.coverPreset(theme.id);
          previewCover();
        });
        return b;
      }),
    );
    render();
    renderFrameChoices();
    previewCover();
    $("custom-tab-" + tab).focus({ preventScroll: true });

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  function closeCover() {
    setStylePicking(false);
    frameHover = null;
    studio.endCover();

    coverOpen = false;
    document
      .querySelector(".editor-shell")
      .classList.remove("customizing", "styling-card", "picking-style-card");
    $("cover-customizer").hidden = true;
    $("cover-preview-stage").hidden = true;
    render();
    window.UIControls.restoreFocus(coverFocus, $("customize-binder"));
  }
  $("customize-binder").addEventListener("click", () =>
    coverOpen && customTab !== "cover" ? closeCover() : openCover("sleeve"),
  );
  $("edit-cover-preview").addEventListener("click", () =>
    coverOpen && customTab === "cover" ? closeCover() : openCover("cover"),
  );
  $("pocket-style").addEventListener("click", () => openCover("sleeve"));
  function setStylePicking(on) {
    document
      .querySelector(".editor-shell")
      .classList.toggle("picking-style-card", on);
    $("cover-customizer").hidden = on;
    if (!on && coverOpen && matchMedia("(max-width: 1100px)").matches)
      $("pick-style-card").focus({ preventScroll: true });
  }
  $("pick-style-card").addEventListener("click", () => {
    setStylePicking(
      !document
        .querySelector(".editor-shell")
        .classList.contains("picking-style-card"),
    );
  });
  for (const tab of ["cover", "sleeve", "toploader"])
    $("custom-tab-" + tab).addEventListener("click", () => {
      customTab = tab;
      frameHover = null;
      renderFrameChoices();
      previewCover();
    });
  $("frame-scope").addEventListener("change", () => {
    syncStyleScope();
    renderFrameChoices();
    previewCover();
  });
  for (const id of ["cover-cancel", "customize-close"])
    $(id).addEventListener("click", closeCover);
  $("cover-apply").addEventListener("click", () => {
    const scope = $("frame-scope").value,
      pid = pageId,
      rids = [...selected],
      theme = coverDraft,
      frames = { ...frameTouched },
      coverValue = studio.coverValue(theme),
      tab = customTab;
    closeCover();
    run(
      () =>
        tab === "cover"
          ? state.setCoverDetails(coverValue)
          : state.applyFramePatch(frames, scope, pid, rids),
      tab === "cover"
        ? "Cover applied. Save binder to keep it."
        : "Card styles applied. Save binder to keep them.",
    );
  });
  function renderPocketPreview() {
    if (!pocketTarget) return;
    const r = state.document.pages
      .find((p) => p.id === pocketTarget.pid)
      ?.regions.find((r) => r.id === pocketTarget.rid);
    if (!r) return;
    const xs = r.cells.map((c) => c[1]),
      ys = r.cells.map((c) => c[0]),
      w = (Math.max(...xs) - Math.min(...xs) + 1) * 77 - 7,
      h = (Math.max(...ys) - Math.min(...ys) + 1) * ((70 * 337) / 245 + 7) - 7;
    const svg = svgNode("svg", {
        viewBox: "0 0 " + w + " " + h,
        "aria-hidden": "true",
      }),
      defs = svgNode("defs"),
      clip = svgNode("clipPath", { id: "design-pocket-clip" }),
      geo = pocketGeometry(r.cells, 70, (70 * 337) / 245, 7);
    geo.rects.forEach((rect) => {
      clip.append(svgNode("rect", rect));
      svg.append(svgNode("rect", { ...rect, fill: "var(--surface)" }));
    });
    defs.append(clip);
    svg.append(defs);
    const c = pocketTab === "artwork" ? artDraft : placeholderDraft;
    if (c)
      window.BinderVisuals.append(
        svg,
        c,
        w,
        h,
        {},
        "design-pocket-clip",
        svgNode,
      );
    svg.append(
      svgNode("path", {
        d: geo.outline,
        fill: "none",
        stroke: "var(--line)",
        "stroke-width": 1,
      }),
    );
    $("pocket-design-preview").replaceChildren(svg);
    $("pocket-apply").disabled = pocketTab === "artwork" && !artDraft;
    $("artwork-crop-controls").hidden = !artDraft;
    for (const key of ["zoom", "x", "y"])
      $("artwork-" + key).disabled = artDraft?.fit === "contain";
    for (const fit of ["cover", "contain"])
      $("artwork-fit-" + fit).setAttribute(
        "aria-pressed",
        String(artDraft?.fit === fit),
      );
  }
  let placeholderQuery = null,
    placeholderMatches = [],
    placeholderRequest = 0;
  function renderPlaceholderChoices() {
    $("placeholder-style-options").replaceChildren(
      ...["outline", "soft", "ball"].map((style) => {
        const b = el("button", "placeholder-style-choice");
        b.type = "button";
        b.dataset.placeholderStyle = style;
        b.setAttribute(
          "aria-pressed",
          String(placeholderDraft.style === style),
        );
        b.append(
          visualSVG({ kind: "placeholder", style }, 70, 96),
          el(
            "span",
            "",
            style === "ball" ? "Ball" : style === "soft" ? "Soft" : "Outline",
          ),
        );
        b.addEventListener("click", () => {
          placeholderDraft.style = style;
          renderPlaceholderChoices();
          renderPocketPreview();
        });
        return b;
      }),
    );
    const q = $("placeholder-search").value.trim().toLowerCase();
    if (window.CardCatalogue?.enabled && placeholderQuery !== q) {
      placeholderQuery = q;
      placeholderMatches = [];
      const request = ++placeholderRequest;
      void window.CardCatalogue.search({ q })
        .then((result) => {
          if (request !== placeholderRequest) return;
          placeholderMatches = result.cards.slice(0, 6);
          renderPlaceholderChoices();
        })
        .catch((error) => {
          if (request === placeholderRequest)
            $("placeholder-target-note").textContent = error.message;
        });
    }
    const results = window.CardCatalogue?.enabled
      ? placeholderMatches
      : window.CARDS.filter(
          (c) =>
            !q ||
            [c.name, c.setName, c.collectorNumber]
              .join(" ")
              .toLowerCase()
              .includes(q),
        ).slice(0, 6);
    $("placeholder-card-options").replaceChildren(
      ...results.map((c) => {
        const b = el("button", "placeholder-card-choice");
        b.type = "button";
        b.dataset.placeholderCard = c.id || c.collectorNumber;
        b.setAttribute(
          "aria-label",
          c.name + ", " + c.setName + " #" + c.collectorNumber,
        );
        b.setAttribute(
          "aria-pressed",
          String(placeholderDraft.cardId === b.dataset.placeholderCard),
        );
        const img = el("img");
        img.src = window.CardCatalogue?.thumbnail(c) || c.imageUrl;
        img.alt = "";
        img.loading = "lazy";
        b.append(
          img,
          el("span", "", c.name),
          el("small", "", c.setName + " #" + c.collectorNumber),
        );
        b.addEventListener("click", () => {
          placeholderDraft.cardId = b.dataset.placeholderCard;
          renderPlaceholderChoices();
          renderPocketPreview();
        });
        return b;
      }),
    );
    $("placeholder-clear-target").setAttribute(
      "aria-pressed",
      String(!placeholderDraft.cardId),
    );
    $("placeholder-target-note").textContent = placeholderDraft.cardId
      ? "Target: " +
        nameOf(placeholderDraft.cardId) +
        ". This does not change your collection or Wanted records."
      : results.length
        ? "Reserve a space without a target card."
        : "No matching cards.";
  }
  function setPocketTab(tab) {
    pocketTab = tab;
    for (const t of ["artwork", "placeholder"])
      $("pocket-tab-" + t).setAttribute("aria-pressed", String(t === tab));
    $("pocket-artwork-controls").hidden = tab !== "artwork";
    $("pocket-placeholder-controls").hidden = tab !== "placeholder";
    renderPlaceholderChoices();
    renderPocketPreview();
  }
  function openPocket() {
    const r = currentPage().regions.find((r) => r.id === selected[0]);
    if (!r || selected.length !== 1) return;
    pocketTarget = { pid: pageId, rid: r.id };
    artDraft =
      r.content?.kind === "artwork" ? structuredClone(r.content) : null;
    placeholderDraft =
      r.content?.kind === "placeholder"
        ? structuredClone(r.content)
        : {
            kind: "placeholder",
            style: "outline",
            ...(r.content?.cardId ? { cardId: r.content.cardId } : {}),
          };
    $("pocket-artwork-file").value = "";
    $("placeholder-search").value = "";
    $("pocket-design-error").textContent = "";
    $("pocket-remove").hidden = !r.content;
    $("pocket-design-title").textContent =
      r.cells.length > 1 ? "Design merged pocket" : "Design pocket";
    $("pocket-upload-note").textContent = artDraft
      ? artDraft.name
      : "JPG, PNG or WebP · up to 5 MB. Optimized for browser storage.";
    for (const k of ["zoom", "x", "y"])
      $("artwork-" + k).value = artDraft?.[k] ?? (k === "zoom" ? 1 : 50);
    setPocketTab(r.content?.kind === "placeholder" ? "placeholder" : "artwork");
    openDialog($("pocket-dialog"));
    $("pocket-tab-" + pocketTab).focus();
  }
  $("pocket-content").addEventListener("click", openPocket);
  for (const tab of ["artwork", "placeholder"])
    $("pocket-tab-" + tab).addEventListener("click", () => setPocketTab(tab));
  $("placeholder-search").addEventListener("input", renderPlaceholderChoices);
  $("placeholder-clear-target").addEventListener("click", () => {
    delete placeholderDraft.cardId;
    renderPlaceholderChoices();
    renderPocketPreview();
  });
  for (const fit of ["cover", "contain"])
    $("artwork-fit-" + fit).addEventListener("click", () => {
      if (artDraft) {
        artDraft.fit = fit;
        renderPocketPreview();
      }
    });
  for (const key of ["zoom", "x", "y"])
    $("artwork-" + key).addEventListener("input", () => {
      if (artDraft) {
        artDraft[key] = Number($("artwork-" + key).value);
        renderPocketPreview();
      }
    });
  for (const id of ["pocket-cancel", "pocket-close"])
    $(id).addEventListener("click", () => $("pocket-dialog").close());
  $("pocket-dialog").addEventListener("close", () => {
    uploadToken++;
  });
  $("pocket-artwork-file").addEventListener("change", async (e) => {
    const file = e.target.files[0],
      token = ++uploadToken;
    if (!file) return;
    $("pocket-design-error").textContent = "";
    try {
      const artwork = await window.BinderMedia.upload(file);
      if (token !== uploadToken || !$("pocket-dialog").open) return;
      artDraft = { kind: "artwork", ...artwork };
      for (const k of ["zoom", "x", "y"]) $("artwork-" + k).value = artDraft[k];
      $("pocket-upload-note").textContent = file.name;
      renderPocketPreview();
    } catch (error) {
      if (token === uploadToken)
        $("pocket-design-error").textContent = error.message;
    }
  });
  $("pocket-apply").addEventListener("click", () => {
    try {
      if (!pocketTarget) throw Error("Select a pocket.");
      const value = pocketTab === "artwork" ? artDraft : placeholderDraft;
      if (!value) throw Error("Choose an image first.");
      const target = { ...pocketTarget };
      if (
        !run(
          () => state.putContent(target.pid, target.rid, value),
          "Pocket design applied.",
        )
      ) {
        $("pocket-design-error").textContent = $("editor-message").textContent;
        return;
      }
      $("pocket-dialog").close();
    } catch (error) {
      $("pocket-design-error").textContent = error.message;
    }
  });
  $("pocket-remove").addEventListener("click", () => {
    const target = { ...pocketTarget };
    $("pocket-dialog").close();
    run(
      () => state.toOverflow(target.pid, [target.rid]),
      "Item moved to Overflow. Undo restores it.",
    );
  });

  function render() {
    renderCoverControls();
    const focus = focusKey(),
      overflowScroll = $("overflow-items").scrollTop,
      pageScroll = $("page-list").scrollTop;
    const p = currentPage();
    pageId = p.id;
    const index = state.document.pages.findIndex((n) => n.id === p.id);
    $("binder-title").textContent = state.document.name;
    $("binder-title").title = state.document.name;
    document.title = state.document.name + " — Pokedex editor";

    $("page-rows").value = p.rows;
    $("page-columns").value = p.columns;
    updateLayoutImpact();

    $("undo").disabled = !state.canUndo;
    $("undo").title = state.canUndo
      ? "Undo the last edit (Ctrl/⌘ + Z)"
      : "No edits to undo.";
    $("redo").disabled = !state.canRedo;
    $("redo").title = state.canRedo
      ? "Redo the last undone edit"
      : "Undo an edit before using Redo.";
    const needsSave = state.dirty || !savedLocally;
    $("save").disabled = saving || coverOpen || !needsSave;
    $("save").title = repository.enabled
      ? "Save privately to your account"
      : "Save on this browser";
    $("save").classList.toggle("primary", needsSave);
    $("save").classList.toggle("secondary", !needsSave);
    $("save-status").textContent = needsSave
      ? "Unsaved changes"
      : savedOnce
        ? "✓ Saved"
        : "All changes saved";
    $("save-status").classList.toggle("save-status-dirty", needsSave);
    $("save-status").hidden = !needsSave;
    updatePageNavigation();
    $("page-view").value = spreadMode ? "two" : "one";
    $("move-page-left").disabled = index === 0;
    $("move-page-right").disabled = index === state.document.pages.length - 1;
    $("delete-page").disabled = state.document.pages.length === 1;
    $("delete-page").title =
      state.document.pages.length === 1 ? "Keep at least one page" : "";
    $("add-page").disabled = state.document.pages.length >= 30;
    $("add-page").title =
      state.document.pages.length >= 30 ? "Maximum 30 pages" : "";
    const addPageTile = $("add-page");
    $("page-list").replaceChildren(
      ...state.document.pages.map((page, i) => {
        const b = el("button", "page-button");
        b.append(
          studio.pageSVG(page, state.document, null, true),
          el("span", "", "Page " + (i + 1)),
        );
        b.draggable = true;
        b.addEventListener("keydown", (event) => {
          if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key))
            return;
          event.preventDefault();
          const delta = event.key === "ArrowUp" ? -1 : 1;
          if (i + delta >= 0 && i + delta < state.document.pages.length)
            run(() => state.reorder(page.id, delta), "Page order updated.");
        });
        b.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("application/x-binder-page", page.id);
          event.dataTransfer.effectAllowed = "move";
        });
        b.addEventListener("dragover", (event) => {
          if (
            [...event.dataTransfer.types].includes("application/x-binder-page")
          ) {
            event.preventDefault();
            b.classList.add("page-drop-target");
          }
        });
        b.addEventListener("dragleave", () =>
          b.classList.remove("page-drop-target"),
        );
        b.addEventListener("drop", (event) => {
          const source = event.dataTransfer.getData(
            "application/x-binder-page",
          );
          if (!source) return;
          event.preventDefault();
          event.stopPropagation();
          const from = state.document.pages.findIndex((p) => p.id === source),
            to = state.document.pages.findIndex((p) => p.id === page.id);
          if (from < 0 || to < 0 || from === to) return;
          run(() => state.reorder(source, to - from), "Page order updated.");
        });
        b.type = "button";
        b.setAttribute("aria-label", "Open page " + (i + 1));
        b.title = "Page " + (i + 1);
        b.dataset.focusKey = "page:" + page.id;
        if (page.id === pageId) b.setAttribute("aria-current", "page");
        b.classList.toggle(
          "in-spread",
          spreadMode && Math.floor(i / 2) === Math.floor(index / 2),
        );
        b.addEventListener("click", () => {
          pageId = page.id;
          selected = [];
          selectMode = false;
          render();
        });
        return b;
      }),
    );
    addPageTile.hidden = state.document.pages.length >= 30;
    $("page-list").append(addPageTile);
    updateSelection();
    renderResults();
    renderOverflow();
    renderCanvas();
    studio?.refresh();
    if (recentlyPlaced) {
      const id = recentlyPlaced;
      setTimeout(() => {
        if (recentlyPlaced === id) {
          recentlyPlaced = null;
          document
            .querySelectorAll(".just-placed")
            .forEach((n) => n.classList.remove("just-placed"));
        }
      }, 450);
    }
    $("overflow-items").scrollTop = overflowScroll;
    $("page-list").scrollTop = pageScroll;
    syncToastAction();
    restoreFocus(focus);
  }
  let cardSearchTimer;
  $("card-search").addEventListener("input", () => {
    if (!window.CardCatalogue?.enabled) return renderResults();
    clearTimeout(cardSearchTimer);
    resultRequest++;
    cardSearchTimer = setTimeout(renderResults, 250);
  });
  $("type-filter").addEventListener("change", renderResults);
  for (const name of (
    window.CardCatalogue?.sets().map((set) => set.name) || [
      ...new Set(window.CARDS.map((c) => c.setName)),
    ]
  ).sort()) {
    const option = el("option", "", name);
    option.value = name;
    $("set-filter").append(option);
  }
  $("set-filter").addEventListener("change", renderResults);
  $("clear-selection").addEventListener("click", () => {
    selectMode = false;
    selected = [];
    pending = null;
    render();
  });
  $("undo").addEventListener("click", () =>
    run(() => state.undo(), "Change undone.", "redo"),
  );
  $("redo").addEventListener("click", () =>
    run(() => state.redo(), "Change restored."),
  );
  async function saveLocal() {
    if (
      saving ||
      coverOpen ||
      document.querySelector("dialog[open]") ||
      (!state.dirty && savedLocally)
    )
      return;
    const snapshot = structuredClone(state.document);
    saving = true;
    $("save").disabled = true;
    $("save").setAttribute("aria-busy", "true");
    try {
      const entry = await repository.save(binderId, snapshot, revision);
      revision = entry.revision;
      history.replaceState(
        null,
        "",
        "#" +
          encodeURIComponent(
            JSON.stringify({ id: binderId, ...(returnTo ? { returnTo } : {}) }),
          ),
      );
      state.save(snapshot);
      clearTimeout(savedTimer);
      savedOnce = true;
      savedTimer = setTimeout(() => {
        savedOnce = false;
        render();
      }, 2000);
      savedLocally = true;
      render();
      message("");
    } catch (error) {
      message(error.message, true);
      if (repository.enabled && error.code === "40001") showSaveConflict();
    } finally {
      saving = false;
      $("save").removeAttribute("aria-busy");
      render();
    }
  }
  function showSaveConflict() {
    let dialog = $("cloud-save-conflict");
    if (dialog) {
      dialog.showModal();
      return;
    }
    dialog = document.createElement("dialog");
    dialog.id = "cloud-save-conflict";
    dialog.className = "cloud-dialog";
    dialog.tabIndex = -1;
    const title = document.createElement("h2");
    title.id = "cloud-conflict-title";
    title.textContent = "A newer version exists";
    dialog.setAttribute("aria-labelledby", title.id);
    const text = document.createElement("p");
    text.setAttribute("role", "status");
    text.textContent = "Your unsaved draft is safe. Choose what to keep.";
    let resolving = false;
    const action = (label, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        label === "Keep editing" ? "button primary" : "button secondary";
      b.textContent = label;
      b.addEventListener("click", async () => {
        if (resolving) return;
        resolving = true;
        dialog.focus();
        actions
          .querySelectorAll("button")
          .forEach((button) => (button.disabled = true));
        try {
          await fn();
        } catch (e) {
          text.textContent = e.message;
        } finally {
          resolving = false;
          actions
            .querySelectorAll("button")
            .forEach((button) => (button.disabled = false));
          if (dialog.open) b.focus();
        }
      });
      return b;
    };
    const actions = document.createElement("div");
    actions.className = "cloud-dialog-actions";
    dialog.append(title, text, actions);
    actions.append(
      action("Keep editing", () => dialog.close()),
      action("Reload saved version", () => {
        if (
          window.confirm(
            "Discard this unsaved draft and reload the saved binder?",
          )
        )
          location.reload();
      }),
      action("Save as copy", async () => {
        const snapshot = structuredClone(state.document),
          id = crypto.randomUUID();
        snapshot.name = snapshot.name.slice(0, 53) + " (copy)";
        const saved = await repository.save(id, snapshot, null);
        binderId = id;
        revision = saved.revision;
        state.rename(snapshot.name);
        state.save(snapshot);
        savedLocally = true;
        history.replaceState(
          null,
          "",
          "#" + encodeURIComponent(JSON.stringify({ id })),
        );
        dialog.close();
        render();
      }),
    );
    dialog.addEventListener("close", () =>
      ($("save").disabled ? $("rename-binder") : $("save")).focus(),
    );
    dialog.addEventListener("cancel", (event) => {
      if (resolving) event.preventDefault();
    });
    dialog.addEventListener("keydown", (event) => {
      if (resolving && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    document.body.append(dialog);
    dialog.showModal();
  }
  $("save").addEventListener("click", saveLocal);
  window.addEventListener("pokedex-before-signout", (event) => {
    if (
      state.dirty &&
      !window.confirm(
        "This binder has unsaved edits. Download a backup or Save before signing out. Sign out anyway?",
      )
    )
      event.preventDefault();
  });
  $("feedback-undo").addEventListener("click", () => {
    if (!toastAction || toastAction.version !== editVersion) return;
    const undo = toastAction.kind === "undo";
    run(
      () => (undo ? state.undo() : state.redo()),
      undo ? "Change undone." : "Change restored.",
      undo ? "redo" : "undo",
    );
  });
  $("select-pockets").addEventListener("click", () => {
    selectMode = !selectMode;
    pending = null;
    if (!selectMode) selected = [];
    render();
    message(selectMode ? "Select neighboring pockets, then Merge." : "");
  });
  $("move-to-page").addEventListener("click", () => {
    const p = currentPage(),
      r = p.regions.find((r) => r.id === selected[0]);
    if (!r?.content) return;
    $("destination-page").replaceChildren(
      ...state.document.pages.map((p) => {
        const option = el(
          "option",
          "",
          "Page " + (state.document.pages.indexOf(p) + 1),
        );
        option.value = p.id;
        return option;
      }),
    );
    openDialog($("move-dialog"));
    $("destination-page").focus();
  });
  $("move-cancel").addEventListener("click", () => $("move-dialog").close());
  $("move-confirm").addEventListener("click", () => {
    const source = { kind: "pocket", pageId, regionId: selected[0] };
    const destination = $("destination-page").value;
    $("move-dialog").close();
    pageId = destination;
    selected = [];
    pending = source;
    selectMode = false;
    render();
    message("");
    document
      .querySelector("#binder-page button")
      ?.focus({ preventScroll: true });
  });
  $("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > window.BinderSchema.limits.importBytes)
        throw Error("Choose a binder backup file up to 8 MB.");
      const input = JSON.parse(await file.text());
      await window.CardCatalogue?.ensure(input);
      const doc = window.BinderStore.validate(input);
      confirm(
        "Import binder?",
        `Replace the current editor contents with “${doc.name}” (${doc.pages.length} pages)? Your saved binder is unchanged until Save. Undo is available.`,
        () =>
          run(() => {
            state.replace(doc);
            pageId = doc.pages[0].id;
          }, "Backup restored. Review it, then Save to keep it."),
      );
    } catch (error) {
      message(
        error instanceof SyntaxError
          ? "This is not a valid backup file."
          : error.message,
        true,
      );
    }
  });
  function updateLayoutImpact() {
    const rows = Number($("page-rows").value),
      columns = Number($("page-columns").value);
    const count = currentPage().regions.filter(
      (r) => r.content && r.cells.some(([y, x]) => y >= rows || x >= columns),
    ).length;
    $("layout-impact").textContent = [rows, columns].every(
      (n) => Number.isInteger(n) && n >= 1 && n <= 6,
    )
      ? count
        ? count +
          (count === 1
            ? " card will move to overflow."
            : " cards will move to overflow.")
        : "No cards will move to overflow."
      : "Choose whole numbers from 1 to 6.";
  }
  for (const id of ["page-rows", "page-columns"])
    $(id).addEventListener("input", updateLayoutImpact);
  $("layout-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const rows = Number($("page-rows").value),
      columns = Number($("page-columns").value);
    const p = currentPage();
    if (
      ![rows, columns].every((n) => Number.isInteger(n) && n >= 1 && n <= 6)
    ) {
      message("Choose whole numbers from 1 to 6.", true);
      return;
    }
    const affected = p.regions.filter((r) =>
      r.cells.some(([y, x]) => y >= rows || x >= columns),
    );
    const cards = affected.filter((r) => r.content).length,
      split = affected.filter((r) => r.cells.length > 1).length;
    const details = affected
      .filter((r) => r.content || r.cells.length > 1)
      .map(
        (r) =>
          `Row ${Math.min(...r.cells.map((c) => c[0])) + 1}, column ${Math.min(...r.cells.map((c) => c[1])) + 1}: ${r.content ? window.BinderVisuals.name(r.content) : "empty merged pocket"}`,
      )
      .join("; ");
    const apply = () =>
      run(
        () => state.resize(pageId, rows, columns),
        cards
          ? "Page layout updated. " +
              cards +
              " item" +
              (cards === 1 ? "" : "s") +
              " moved to overflow."
          : "Page layout updated. No cards moved to overflow.",
      );
    if (affected.length)
      confirm(
        "Preview layout change",
        `${rows} rows × ${columns} columns. ${cards} cards move to overflow; ${split} merged pockets are removed and their remaining cells become separate pockets. ${details} Undo is available.`,
        apply,
      );
    else apply();
  });
  const addPageTile = el("button", "add-page");
  addPageTile.append(
    el("span", "add-page-symbol", "+"),
    el("span", "add-page-caption sr-only", "Add page"),
  );
  addPageTile.id = "add-page";
  addPageTile.type = "button";
  addPageTile.title = "Add page";
  addPageTile.setAttribute("aria-label", "Add page");
  $("page-list").append(addPageTile);
  $("add-page").addEventListener("click", () =>
    run(() => {
      pageId = state.addPage(currentPage().rows, currentPage().columns);
    }, "Page added."),
  );
  function updatePageNavigation() {
    const index = state.document.pages.findIndex((p) => p.id === pageId);
    $("previous-page").disabled = spreadMode ? index < 2 : index === 0;
    const lastSpread = spreadMode
      ? Math.floor(index / 2) * 2 + 2 >= state.document.pages.length
      : index === state.document.pages.length - 1;
    $("next-page").dataset.add = String(lastSpread);
    $("next-page").disabled =
      lastSpread && (state.document.pages.length >= 30 || coverOpen);
    if (coverOpen && customTab === "cover")
      $("previous-page").disabled = $("next-page").disabled = true;
    $("next-page").setAttribute(
      "aria-label",
      lastSpread ? "Add page" : "Next page",
    );
    $("next-page").title = lastSpread
      ? state.document.pages.length >= 30
        ? "Maximum 30 pages"
        : "Add page"
      : "Next page";
    $("next-page")
      .querySelector("path")
      .setAttribute("d", lastSpread ? "M5 12h14M12 5v14" : "M10 6l6 6-6 6");
  }
  function turn(delta) {
    const pages = state.document.pages,
      index = pages.findIndex((p) => p.id === pageId);
    const target = spreadMode
      ? Math.floor(index / 2) * 2 + delta * 2
      : index + delta;
    if (pages[target]) {
      pageId = pages[target].id;
      selected = [];
      selectMode = false;
      if (coverOpen && customTab !== "cover") {
        syncStyleScope();
        renderFrameChoices();
      }
      render();
      if (coverOpen) previewCover();
    }
  }
  $("page-view").addEventListener("change", () => {
    spreadMode = $("page-view").value === "two";
    selected = [];
    pending = null;
    render();
  });
  $("previous-page").addEventListener("click", () => turn(-1));
  $("next-page").addEventListener("click", () => {
    if ($("next-page").dataset.add === "true") $("add-page").click();
    else turn(1);
  });
  $("move-page-left").addEventListener("click", () =>
    run(() => state.reorder(pageId, -1), "Page moved earlier."),
  );
  $("move-page-right").addEventListener("click", () =>
    run(() => state.reorder(pageId, 1), "Page moved later."),
  );
  $("delete-page").addEventListener("click", () => {
    const count = currentPage().regions.filter((r) => r.content).length;
    confirm(
      "Delete this page?",
      count + " placed cards will move to overflow. You can Undo this change.",
      () =>
        run(
          () => state.deletePage(pageId),
          "Page deleted; content kept in overflow.",
        ),
    );
  });
  $("empty-overflow").addEventListener("click", () =>
    confirm(
      "Clear overflow?",
      `Remove ${state.document.overflow.length} displaced cards from this digital binder? Physical ownership is unaffected. You can Undo this change.`,
      () =>
        run(
          () => state.clearOverflow(),
          "Overflow cleared. Undo is available.",
        ),
    ),
  );
  $("to-overflow").addEventListener("click", () =>
    run(
      () => state.toOverflow(pageId, selected),
      "Selected cards moved to overflow.",
    ),
  );
  $("merge").addEventListener("click", () => {
    const reason = state.mergeReason(pageId, selected);
    if (reason) {
      message(reason, true);
      return;
    }
    const count = currentPage().regions.filter(
      (r) => selected.includes(r.id) && r.content,
    ).length;
    confirm(
      "Merge selected pockets?",
      `Merge ${selected.length} connected regions into one empty pocket. ${count} placed cards will move to overflow. Undo is available.`,
      () =>
        run(() => {
          state.merge(pageId, selected);
          selectMode = false;
        }, "Pockets merged; contents kept in overflow."),
    );
  });
  $("unmerge").addEventListener("click", () =>
    run(
      () => state.unmerge(pageId, selected[0]),
      "Pocket unmerged. Any placed card moved to overflow.",
    ),
  );
  $("rename-binder").addEventListener("click", () => {
    $("new-name").value = state.document.name;
    openDialog($("name-dialog"));
    $("new-name").focus();
  });
  $("name-cancel").addEventListener("click", () => $("name-dialog").close());
  $("name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    run(() => state.rename($("new-name").value), "Binder renamed.");
    $("name-dialog").close();
  });
  const download = el("button", "editor-download", "Download backup");
  download.type = "button";
  download.addEventListener("click", () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(state.document, null, 2)], {
          type: "application/json",
        }),
      ),
      a = el("a");
    a.href = url;
    a.download = "pokedex-binder.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message("Backup downloaded.");
  });
  $("editor-download-slot").append(download);
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (a && a.getAttribute("href")?.startsWith("#")) return;
    if (
      !a ||
      a.download ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey ||
      a.target === "_blank"
    )
      return;
    if (state.dirty) {
      e.preventDefault();
      leaving = a.href;
      openDialog($("leave-dialog"));
    }
  });
  $("leave-cancel").addEventListener("click", () => $("leave-dialog").close());
  $("leave-confirm").addEventListener("click", () => {
    $("leave-dialog").close();
    const href = leaving;
    leaving = null;
    leaveApproved = true;
    location.assign(href);
  });
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty && !leaveApproved) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveLocal();
      return;
    }
    if (document.querySelector("dialog[open]")) return;
    if (coverOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeCover();
      } else if (e.ctrlKey || e.metaKey) {
        if (["s", "z", "y"].includes(e.key.toLowerCase())) e.preventDefault();
      }
      return;
    }
    if (
      e.target.matches("input,textarea,select") ||
      document.querySelector("dialog[open]")
    )
      return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      run(
        () => (e.shiftKey ? state.redo() : state.undo()),
        e.shiftKey ? "Change restored." : "Change undone.",
        e.shiftKey ? "undo" : "redo",
      );
    }

    if (e.key === "Escape") $("clear-selection").click();
    if (e.key === "Delete" && selected.length) {
      e.preventDefault();
      run(
        () => state.toOverflow(pageId, selected),
        "Selected cards moved to overflow.",
      );
    }
  });
  document.addEventListener("click", (e) =>
    document.querySelectorAll(".account[open]").forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    }),
  );
  let canvasResizeFrame;
  new ResizeObserver(() => {
    cancelAnimationFrame(canvasResizeFrame);
    canvasResizeFrame = requestAnimationFrame(() => {
      renderCanvas();
      positionToast();
    });
  }).observe($("canvas-stage"));

  studio = window.EditorStudio.init({
    state,
    page: currentPage,
    selected: () => selected,
    run,
    svg: svgNode,
    geometry: pocketGeometry,
    setPage: (pid) => {
      pageId = pid;
    },
    clearPending: () => {
      pending = null;
      selected = [];
      render();
    },
    preview: previewCover,
    coverTheme: (theme) => {
      coverDraft = theme;
    },
    resetPocketCrop: () => {
      if (!artDraft) return;
      Object.assign(artDraft, { fit: "cover", zoom: 1, x: 50, y: 50 });
      for (const key of ["zoom", "x", "y"])
        $("artwork-" + key).value = artDraft[key];
      renderPocketPreview();
    },
  });

  arrangeTools = window.EditorArrange.init({
    state,
    page: currentPage,
    selected: () => selected,
    run,
    binderId: () => binderId,
    openDialog,
    notify: message,
    clearPending: () => {
      pending = null;
      selected = [];
      selectMode = false;
      render();
    },
  });

  render();
  if (seed.customize) openCover();
  if (seed.placeCard) {
    const finish = cards.get(seed.placeCard).variants?.[seed.finish]
      ? seed.finish
      : undefined;
    setPending({ kind: "catalogue", cardId: seed.placeCard, variant: finish });
  }
  // Entry routes and focus must not land visitors halfway down the editor.
  requestAnimationFrame(() =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
  window.addEventListener("pageshow", () =>
    window.scrollTo({ top: 0, left: 0, behavior: "instant" }),
  );
})();
