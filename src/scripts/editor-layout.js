(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const shell = document.querySelector(".editor-shell");
  if (!shell) return;
  const cards = $("cards-drawer"),
    canvas = document.querySelector(".canvas-panel");
  const stage = $("canvas-stage"),
    custom = $("cover-customizer");
  const cardsTool = $("cards-tool"),
    controls = document.querySelector(".controls-pill");
  const strip = document.querySelector(".page-strip");
  const selection = document.querySelector(".selection-status");
  const dock = document.querySelector(".editor-dock"),
    toast = document.querySelector(".editor-feedback");
  const narrow = matchMedia("(max-width: 1100px)");
  const phone = matchMedia("(max-width: 700px)");
  const preference = "pokedex.editor.cards-open.v2";
  let cardsOpen = false,
    wasCustomizing = false,
    restoreCards = true;
  try {
    cardsOpen = localStorage.getItem(preference) === "true";
  } catch {}

  function setCards(open, persist = false, focus = false) {
    if (open && phone.matches) setPages(false);
    cardsOpen = open;
    cards.hidden = !open;
    shell.classList.toggle("cards-open", open);
    cardsTool.setAttribute("aria-expanded", String(open));
    if (persist) {
      try {
        localStorage.setItem(preference, String(open));
      } catch {}
    }
    synchronizeAccessibility();
    requestAnimationFrame(() => {
      layout();
      if (focus)
        (open ? $("card-search") : cardsTool).focus({ preventScroll: true });
    });
  }
  cardsTool.addEventListener("click", () => {
    if (utilityEntries.some(([details]) => details.open)) {
      closePopovers();
      syncUtility();
      setCards(true, true, true);
      return;
    }
    if (shell.classList.contains("customizing")) {
      $("cover-cancel").click();
      setCards(true, true, true);
    } else setCards(!cardsOpen, true, true);
  });
  $("cards-close").addEventListener("click", () => setCards(false, true, true));
  $("select-pockets").addEventListener(
    "click",
    () => {
      if (shell.classList.contains("customizing")) $("cover-cancel").click();
      if (narrow.matches) setCards(false, false);
    },
    true,
  );

  const pagesSidebar = $("pages-sidebar");
  const pagesBody = $("pages-body"),
    pagesControls = $("pages-controls");
  pagesBody.append($("page-list"));
  canvas.append(document.querySelector(".page-navigation"));
  pagesControls.append(dock);
  const settings = document.querySelector(".layout-settings");
  const settingsBody = document.querySelector(".layout-settings-body");
  settings.querySelector("summary").title = "View and page settings";
  settings
    .querySelector("summary")
    .setAttribute("aria-label", "View and page settings");
  settingsBody.querySelector("h2").textContent = "View and settings";
  const view = document.querySelector(".page-view-control");
  view.querySelector("span").classList.remove("sr-only");
  view.querySelector("span").textContent = "Page view";
  view.classList.add("field");
  settingsBody.querySelector(".layout-fields").prepend(view);
  const rail = document.querySelector(".editor-rail");
  rail.append(settings, $("undo"), $("redo"));
  document.querySelector(".history-tools").remove();
  controls.remove();
  dock.remove();
  strip.hidden = true;
  let sidebarView = "pages";
  function showSidebar(view) {
    sidebarView = view;

    setPages(true);
    if (view === "pages") requestAnimationFrame(revealActiveThumbnail);
  }
  $("pages-view").addEventListener("click", () => showSidebar("pages"));
  $("overflow-view").addEventListener("click", () => showSidebar("overflow"));
  function setPages(open) {
    if (open && phone.matches) {
      setCards(false);
      if (shell.classList.contains("customizing")) $("cover-cancel").click();
    }
    shell.classList.toggle("pages-collapsed", !open);
    $("pages-view").setAttribute(
      "aria-pressed",
      String(open && sidebarView === "pages"),
    );
    $("overflow-view").setAttribute(
      "aria-pressed",
      String(open && sidebarView === "overflow"),
    );
    pagesBody.hidden = !open || sidebarView !== "pages";
    $("sidebar-overflow").hidden = !open || sidebarView !== "overflow";
    $("empty-overflow").hidden = !open || sidebarView !== "overflow";
    pagesControls.hidden = false;
    $("pages-toggle").setAttribute("aria-expanded", String(open));
    $("pages-toggle").setAttribute(
      "aria-label",
      (open ? "Collapse" : "Expand") + " binder sidebar",
    );
    if (!open) closePopovers();
    requestAnimationFrame(layout);
  }
  $("pages-toggle").addEventListener("click", () =>
    setPages($("pages-toggle").getAttribute("aria-expanded") !== "true"),
  );
  const mobileLabels = [
    ["cards-tool", "Cards"],
    ["edit-cover-preview", "Cover"],
    ["customize-binder", "Styles"],
    ["select-pockets", "Select"],
  ];
  function mobileLabel(node, text) {
    const label = document.createElement("span");
    label.className = "mobile-tool-label";
    label.textContent = text;
    label.setAttribute("aria-hidden", "true");
    node.append(label);
  }
  for (const [id, text] of mobileLabels) mobileLabel($(id), text);
  mobileLabel($("pages-toggle"), "Pages");
  const pagesIcon = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  pagesIcon.setAttribute("viewBox", "0 0 24 24");
  pagesIcon.setAttribute("aria-hidden", "true");
  pagesIcon.classList.add("ui-symbol", "mobile-pages-icon");
  pagesIcon.innerHTML = '<path d="M4 3h11v15H4zM9 21h11V6"/>';
  $("pages-toggle").prepend(pagesIcon);
  const preview = $("preview-binder");
  preview.setAttribute("aria-label", "Preview binder");
  preview.innerHTML =
    '<svg class="ui-symbol mobile-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span>Preview</span>';
  rail.append(preview);
  const back = document.querySelector(".workspace-back");
  back.setAttribute("aria-label", "Back to Workspace");
  back.innerHTML =
    '<svg class="ui-symbol mobile-back-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>← Workspace</span>';
  const desktopHint = cards.querySelector(".panel-hint").textContent;
  function syncPhoneTools() {
    const home = phone.matches
      ? document.querySelector(".editor-rail")
      : document.querySelector(".sidebar-views");
    if (phone.matches) home.append($("pages-toggle"));
    else home.prepend($("pages-toggle"));
  }
  syncPhoneTools();
  document.querySelector(".editor-rail").addEventListener(
    "click",
    (event) => {
      if (
        phone.matches &&
        !shell.classList.contains("pages-collapsed") &&
        event.target.closest("button, summary") &&
        !event.target.closest("#pages-toggle")
      )
        setPages(false);
    },
    true,
  );
  let activeThumbnail = null;
  function revealActiveThumbnail() {
    const current = $("page-list").querySelector('[aria-current="page"]');
    if (!current || pagesBody.hidden) return;
    const item = current.getBoundingClientRect(),
      list = $("page-list").getBoundingClientRect();
    if (item.top < list.top) $("page-list").scrollTop += item.top - list.top;
    else if (item.bottom > list.bottom)
      $("page-list").scrollTop += item.bottom - list.bottom;
  }
  new MutationObserver(() => {
    const current = $("page-list").querySelector('[aria-current="page"]');
    if (!current || current.dataset.focusKey === activeThumbnail) return;
    activeThumbnail = current.dataset.focusKey;
    requestAnimationFrame(revealActiveThumbnail);
  }).observe($("page-list"), { childList: true });
  $("page-list").addEventListener("dragover", (event) => {
    if (![...event.dataTransfer.types].includes("application/x-binder-page"))
      return;
    event.preventDefault();
    const bounds = $("page-list").getBoundingClientRect();
    if (event.clientY < bounds.top + 40) $("page-list").scrollTop -= 16;
    else if (event.clientY > bounds.bottom - 40) $("page-list").scrollTop += 16;
  });

  $("select-pockets").before($("customize-binder"));
  $("help-credits").append(document.querySelector(".credits-popover"));
  const popovers = [
    [
      document.querySelector(".layout-settings"),
      ".layout-settings-body",
      "utility",
    ],
    [document.querySelector(".account"), ".account-panel", "account"],
  ];
  const isUtility = (details) => details.matches(".layout-settings");
  const utilityEntries = popovers.filter(([details]) => isUtility(details));
  let arranging = false,
    wasUtility = false,
    restoreUtilityCards = false;
  function syncUtility() {
    const active = utilityEntries.some(([details]) => details.open);
    shell.classList.toggle("utility-open", active);
    if (active && !wasUtility) {
      wasUtility = true;
      restoreUtilityCards = shell.classList.contains("customizing")
        ? restoreCards
        : cardsOpen;
      if (shell.classList.contains("customizing")) $("cover-cancel").click();
      setCards(false);
    } else if (!active && wasUtility) {
      wasUtility = false;
      if (!narrow.matches && !shell.classList.contains("customizing"))
        setCards(restoreUtilityCards);
    }
    requestAnimationFrame(layout);
  }
  for (const [details, selector] of utilityEntries) {
    const panel = details.querySelector(selector),
      heading = panel.querySelector("h2");
    const name = "page-settings";
    const head = document.createElement("div");
    head.className = "utility-heading";
    heading.id = "utility-" + name + "-title";
    panel.id = "utility-" + name;
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-labelledby", heading.id);
    details.querySelector("summary").setAttribute("aria-controls", panel.id);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "utility-close icon-button";
    close.setAttribute("aria-label", "Close view and page settings");
    close.title = close.getAttribute("aria-label");
    close.innerHTML =
      '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    close.addEventListener("click", () => {
      details.open = false;
      syncUtility();
      requestAnimationFrame(() =>
        details.querySelector("summary").focus({ preventScroll: true }),
      );
    });
    head.append(heading);
    head.append(close);
    panel.prepend(head);
  }
  const floating = new Map();
  let floatingDrag = null;
  function placeFloating(node) {
    const item = floating.get(node);
    if (!item?.moved || !node.getClientRects().length) return;
    const top =
      document.querySelector(".calm-topbar").getBoundingClientRect().bottom + 8;
    Object.assign(node.style, {
      position: "fixed",
      right: "auto",
      bottom: "auto",
      margin: "0",
      transform: "none",
      width: "max-content",
      maxWidth: "calc(100vw - 32px)",
      maxHeight: Math.max(40, innerHeight - top - 16) + "px",
    });
    const box = node.getBoundingClientRect();
    item.x = Math.max(16, Math.min(item.x, innerWidth - box.width - 16));
    item.y = Math.max(top, Math.min(item.y, innerHeight - box.height - 16));
    node.style.left = item.x + "px";
    node.style.top = item.y + "px";
  }
  function resetFloating(node) {
    const item = floating.get(node);
    item.moved = false;
    if (item.original === null) node.removeAttribute("style");
    else node.setAttribute("style", item.original);
    layout();
  }
  function finishFloating(cancel = false) {
    if (!floatingDrag) return;
    const drag = floatingDrag;
    floatingDrag = null;
    drag.node.classList.remove("floating-moving");
    if (cancel) {
      Object.assign(floating.get(drag.node), drag.before);
      if (drag.style === null) drag.node.removeAttribute("style");
      else drag.node.setAttribute("style", drag.style);
    }
    if (drag.handle.hasPointerCapture(drag.pointerId))
      drag.handle.releasePointerCapture(drag.pointerId);
  }
  function makeFloating(node, name) {
    const item = {
      moved: false,
      x: 0,
      y: 0,
      original: node.getAttribute("style"),
    };
    floating.set(node, item);
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "floating-handle";
    handle.setAttribute("aria-label", "Move " + name);
    handle.title =
      "Drag to move. Arrow keys move; Home resets; Esc cancels a drag.";
    handle.innerHTML =
      '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor" stroke="none"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></g></svg>';
    const heading = node.querySelector(":scope > .utility-heading");
    if (heading) heading.prepend(handle);
    else {
      const slot = document.createElement("div");
      slot.className = "floating-grip-slot";
      slot.append(handle);
      node.prepend(slot);
    }
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      const box = node.getBoundingClientRect();
      floatingDrag = {
        node,
        handle,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: box.left,
        top: box.top,
        before: { ...item },
        style: node.getAttribute("style"),
      };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      const drag = floatingDrag;
      if (!drag || drag.handle !== handle || event.pointerId !== drag.pointerId)
        return;
      const dx = event.clientX - drag.startX,
        dy = event.clientY - drag.startY;
      if (!item.moved && Math.hypot(dx, dy) < 3) return;
      item.moved = true;
      item.x = drag.left + dx;
      item.y = drag.top + dy;
      node.classList.add("floating-moving");
      placeFloating(node);
    });
    handle.addEventListener("pointerup", () => finishFloating());
    handle.addEventListener("pointercancel", () => finishFloating(true));
    handle.addEventListener("lostpointercapture", () => finishFloating());
    handle.addEventListener("keydown", (event) => {
      const direction = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      if (!direction && event.key !== "Home") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Home") {
        resetFloating(node);
        return;
      }
      const box = node.getBoundingClientRect(),
        step = event.shiftKey ? 24 : 8;
      Object.assign(item, {
        moved: true,
        width: box.width,
        x: box.left + direction[0] * step,
        y: box.top + direction[1] * step,
      });
      placeFloating(node);
    });
  }
  makeFloating(selection, "selection tools");

  function positionNavigation() {
    const nav = document.querySelector(".page-navigation"),
      area = canvas.getBoundingClientRect(),
      page = $("binder-page").getBoundingClientRect(),
      size = $("previous-page").getBoundingClientRect().width;
    if (!page.width || !size) return;
    const clearance = 24;
    let left = page.left - area.left - clearance - size,
      right = area.right - page.right - clearance - size,
      y =
        page.top -
        area.top +
        page.height / 2 +
        ($("binder-page").classList.contains("is-spread") ? 24 : 0);
    if (left < 0 || right < 0) {
      left = Math.max(0, page.left - area.left);
      right = Math.max(0, area.right - page.right);
      y = Math.min(
        area.height - size / 2 - 8,
        page.bottom - area.top + 16 + size / 2,
      );
    }
    Object.assign(nav.style, {
      left: left + "px",
      right: right + "px",
      top: y + "px",
      bottom: "auto",
      transform: "translateY(-50%)",
    });
  }
  new ResizeObserver(positionNavigation).observe($("binder-page"));
  stage.addEventListener("scroll", positionNavigation, { passive: true });
  function closePopovers(except = null, returnFocus = false) {
    for (const [details] of popovers)
      if (details !== except && details.open) {
        details.open = false;
        details.querySelector("summary").setAttribute("aria-expanded", "false");
        if (returnFocus)
          requestAnimationFrame(() =>
            details.querySelector("summary").focus({ preventScroll: true }),
          );
      }
    syncUtility();
  }
  function positionPopovers() {
    const area = canvas.getBoundingClientRect(),
      pill = rail.getBoundingClientRect(),
      viewport = stage.getBoundingClientRect();
    const safeTop = Math.max(80, area.top + 24);
    for (const [details, selector, kind] of popovers) {
      if (!details.open) continue;
      const box = details.querySelector(selector),
        trigger = details.querySelector("summary").getBoundingClientRect();
      const safeBottom =
        kind === "controls"
          ? Math.min(viewport.bottom - 24, pill.top - 8)
          : viewport.bottom - 24;
      if (kind === "utility") {
        const sidebar = rail.getBoundingClientRect();
        const width = phone.matches
          ? Math.min(320, innerWidth - 32)
          : parseFloat(
              getComputedStyle(shell).getPropertyValue("--cards-column"),
            ) - 16;
        box.style.width = width + "px";
        box.style.maxHeight = Math.max(120, area.height - 24) + "px";
        box.style.height = "auto";
        box.style.left =
          Math.max(16, Math.min(sidebar.right + 16, innerWidth - width - 16)) +
          "px";
        box.style.top = area.top + "px";
        box.style.right = "auto";
        box.style.bottom = "auto";
        if (phone.matches)
          shell.style.setProperty(
            "--utility-height",
            box.getBoundingClientRect().height + 16 + "px",
          );
        continue;
      }
      const width = Math.min(
        kind === "controls" ? 240 : kind === "rail" ? 288 : 240,
        innerWidth - 32,
      );
      box.style.width = Math.max(160, width) + "px";
      box.style.maxHeight =
        Math.max(
          120,
          ["controls", "context"].includes(kind)
            ? safeBottom - safeTop
            : innerHeight - 112,
        ) + "px";
      if (phone.matches && kind === "rail") {
        box.style.maxHeight = Math.max(80, trigger.top - area.top - 16) + "px";
        box.style.overflowY = "auto";
      }
      const r = box.getBoundingClientRect();
      let left, top;
      if (kind === "rail") {
        left =
          document.querySelector(".editor-rail").getBoundingClientRect().right +
          12;
        top = phone.matches ? trigger.top - r.height - 8 : area.top;
        if (phone.matches) left = innerWidth - r.width - 8;
      } else if (kind === "context") {
        left = trigger.left;
        top = trigger.bottom + 8;
      } else if (kind === "account") {
        left = trigger.right - r.width;
        top = trigger.bottom + 24;
      } else {
        left = pill.left;
        top = safeBottom - r.height;
      }
      left = Math.max(16, Math.min(left, innerWidth - r.width - 16));
      top = Math.max(
        ["controls", "context"].includes(kind)
          ? safeTop
          : phone.matches
            ? area.top + 8
            : 80,
        Math.min(
          top,
          (["controls", "context"].includes(kind)
            ? safeBottom
            : innerHeight - 16) - r.height,
        ),
      );
      box.style.left = left + "px";
      box.style.top = top + "px";
      box.style.right = "auto";
      box.style.bottom = "auto";
    }
  }
  for (const [details] of popovers) {
    details
      .querySelector("summary")
      .setAttribute("aria-expanded", String(details.open));
    details.addEventListener("toggle", () => {
      details
        .querySelector("summary")
        .setAttribute("aria-expanded", String(details.open));
      if (details.open) {
        if (pagesControls.contains(details) && pagesControls.hidden)
          setPages(true);
        closePopovers(details);
        requestAnimationFrame(positionPopovers);
      }
      syncUtility();
    });
  }
  document.addEventListener("pointerdown", (event) => {
    for (const [details] of popovers)
      if (
        details.open &&
        !isUtility(details) &&
        !details.contains(event.target)
      )
        details.open = false;
  });
  function synchronizeAccessibility() {
    const customizing = shell.classList.contains("customizing");
    cards.setAttribute("role", phone.matches ? "dialog" : "complementary");
    custom.setAttribute("role", narrow.matches ? "dialog" : "complementary");
    cards.toggleAttribute("aria-modal", phone.matches && cardsOpen);
    const styling = shell.classList.contains("styling-card");
    custom.toggleAttribute(
      "aria-modal",
      narrow.matches && customizing && !styling,
    );
    if (cards.hasAttribute("aria-modal"))
      cards.setAttribute("aria-modal", "true");
    if (custom.hasAttribute("aria-modal"))
      custom.setAttribute("aria-modal", "true");
    // Cover editing blocks the canvas; card styling permits explicit retargeting.
    const blocked = (customizing && !styling) || (phone.matches && cardsOpen);
    stage.inert = blocked;
    strip.inert = customizing || blocked;
    selection.inert = customizing || blocked;
  }
  function layout() {
    if (arranging || document.body.classList.contains("is-dragging")) return;
    arranging = true;
    cards.querySelector(".panel-hint").textContent = phone.matches
      ? "Tap a card, then a pocket."
      : desktopHint;
    positionPopovers();
    positionNavigation();
    for (const node of floating.keys()) placeFloating(node);
    window.dispatchEvent(new Event("editor-layout"));
    arranging = false;
  }
  new MutationObserver(() => {
    const customizing = shell.classList.contains("customizing");
    if (customizing !== wasCustomizing) {
      wasCustomizing = customizing;
      if (customizing) {
        if (phone.matches) setPages(false);
        restoreCards = wasUtility ? restoreUtilityCards : cardsOpen;
        closePopovers();
        setCards(false, false);
      } else if (
        !narrow.matches &&
        !utilityEntries.some(([details]) => details.open)
      )
        setCards(restoreCards, false);
    }
    synchronizeAccessibility();
    requestAnimationFrame(layout);
  }).observe(shell, { attributes: true, attributeFilter: ["class"] });
  const sizes = new ResizeObserver(() => requestAnimationFrame(layout));
  for (const node of [
    canvas,
    strip,
    selection,
    ...utilityEntries.map(([details, selector]) =>
      details.querySelector(selector),
    ),
  ])
    sizes.observe(node);
  new MutationObserver(() => requestAnimationFrame(layout)).observe(selection, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  new MutationObserver(() => requestAnimationFrame(layout)).observe(toast, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  window.addEventListener("resize", layout);
  document.addEventListener("dragend", () => requestAnimationFrame(layout));
  document.addEventListener("drop", () =>
    requestAnimationFrame(() => {
      closePopovers();
      layout();
    }),
  );
  narrow.addEventListener("change", () => {
    synchronizeAccessibility();
    layout();
  });
  phone.addEventListener("change", () => {
    syncPhoneTools();
    setPages(!phone.matches);
    layout();
  });

  function visibleControls(container) {
    return [
      ...container.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
      ),
    ].filter(
      (node) =>
        node.getClientRects().length &&
        !node.closest("[hidden]") &&
        !node.closest("details:not([open]) > :not(summary)"),
    );
  }
  document.addEventListener(
    "keydown",
    (event) => {
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        if (shell.classList.contains("picking-style-card")) {
          $("pick-style-card").click();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (floatingDrag) {
          finishFloating(true);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const open = popovers.find(([details]) => details.open);
        if (open) {
          closePopovers(null, true);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (shell.classList.contains("customizing")) {
          $("cover-cancel").click();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (
          !selection.hidden ||
          $("select-pockets").getAttribute("aria-pressed") === "true"
        ) {
          $("clear-selection").click();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (cardsOpen) {
          setCards(false, true, true);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (phone.matches && !shell.classList.contains("pages-collapsed")) {
          setPages(false);
          $("pages-toggle").focus({ preventScroll: true });
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      if (event.key === "Tab") {
        const popup = popovers.find(
          ([details]) =>
            details.open && details.contains(document.activeElement),
        );
        const drawer = narrow.matches
          ? shell.classList.contains("customizing") &&
            !shell.classList.contains("styling-card")
            ? custom
            : cardsOpen
              ? cards
              : null
          : null;
        const container = popup?.[0] || drawer;
        if (!container) return;
        const items = visibleControls(container),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    },
    true,
  );
  document
    .querySelector(".editor-rail")
    .addEventListener("keydown", (event) => {
      const buttons = [
        ...document.querySelectorAll(
          ".editor-rail > button,.editor-rail > a,.editor-rail > details > summary",
        ),
      ].filter(window.UIControls.canFocus);
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      let next;
      if (
        event.key === "ArrowDown" ||
        (phone.matches && event.key === "ArrowRight")
      )
        next = (index + 1) % buttons.length;
      else if (
        event.key === "ArrowUp" ||
        (phone.matches && event.key === "ArrowLeft")
      )
        next = (index + buttons.length - 1) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault();
      buttons[next].focus();
    });
  const icons = {
    "download-backup": "M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5",
    "restore-backup": "M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5",
    "preview-binder":
      "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
    "theme-toggle":
      "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0",
    "help-trigger":
      "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0",
    "help-close": "M6 6l12 12M18 6 6 18",
    "discover-nav": "M21 21l-6-6M3 10a7 7 0 1 0 14 0 7 7 0 0 0-14 0",
    "return-results": "M14 5l-7 7 7 7",
    undo: "M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12",
    redo: "M15 5l5 5-5 5M20 10H10a6 6 0 0 0 0 12",
    "copy-card-style": "M8 7H4v14h12v-4M8 3h12v14H8zM11 7h6m-6 4h6",
    "paste-card-style": "M9 4H5v17h14V4h-4M9 2h6v5H9zM9 12h6m-6 4h6",
    "move-to-page": "M3 4h10v16H3zM13 12h8m-3-3 3 3-3 3",
    "copy-cards-binder": "M8 7H3v14h12v-5M8 3h12v13H8zM11 7h6m-3-3v6",
    "swap-selected-cards": "M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4",
    "layout-apply": "M4 12l5 5L20 6",
    "delete-page": "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
    "cover-apply": "M4 12l5 5L20 6",
    "cover-cancel": "M6 6l12 12M18 6 6 18",
    "custom-tab-cover": "M5 3h14v18H5zM8 3v18",
    "custom-tab-sleeve": "M4 5h13v16H4zM8 2h12v15",
    "custom-tab-toploader": "M3 2h18v20H3zM6 5h12v14H6z",
    "placement-indicator": "M12 3v18M3 12h18",
    "feedback-undo": "M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12",
    "toast-indicator": "M4 12l5 5L20 6",
  };
  function icon(node, label, path = icons[node?.id]) {
    if (!node || !path) return;
    node.title = label;
    node.setAttribute("aria-label", label);
    node.classList.add("workshop-icon");
    node.innerHTML =
      '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="' +
      path +
      '"/></svg>';
  }
  window.EditorIcon = icon;
  $("selection-actions").append($("selection-dismiss"));
  const download = document.querySelector(".editor-download");
  download.id = "download-backup";
  rail.append(
    download,
    $("restore-backup"),
    $("discover-nav"),
    $("return-results"),
  );
  $("editor-download-slot").remove();
  $("restore-backup").addEventListener("click", () => $("import-file").click());
  settingsBody.querySelector(".page-actions").append($("delete-page"));
  const applyLayout = document.querySelector(
    "#layout-form button[type=submit]",
  );
  applyLayout.id = "layout-apply";
  for (const [id, label] of [
    ["download-backup", "Download backup"],
    ["restore-backup", "Restore backup"],
    ["preview-binder", "Preview binder"],
    ["theme-toggle", "Color theme"],
    ["discover-nav", "Discover"],
    ["return-results", "Return to Discover results"],
    ["undo", "Undo"],
    ["redo", "Redo"],
    ["copy-card-style", "Copy styles"],
    ["paste-card-style", "Paste styles"],
    ["move-to-page", "Move to page"],
    ["copy-cards-binder", "Copy cards to another binder"],
    ["swap-selected-cards", "Swap selected cards"],
    ["layout-apply", "Apply layout"],
    ["delete-page", "Delete page"],
    ["cover-apply", "Apply customization"],
    ["cover-cancel", "Cancel customization"],
    ["custom-tab-cover", "Cover"],
    ["custom-tab-sleeve", "Sleeves"],
    ["custom-tab-toploader", "Toploaders"],
    ["feedback-undo", "Undo"],
  ])
    icon($(id), label);
  const placementIcon = document.createElement("span");
  placementIcon.id = "placement-indicator";
  placementIcon.hidden = true;
  icon(placementIcon, "Choose a destination pocket");
  selection.prepend(placementIcon);
  $("editor-message").classList.add("notification-copy");
  const helpButton = document.createElement("button");
  helpButton.id = "help-trigger";
  helpButton.type = "button";
  icon(helpButton, "Workshop help");
  pagesControls.append(helpButton);
  icon($("help-close"), "Close help");
  const help = $("workshop-help");
  const guides = [
    [
      "Add and insert cards",
      "Open Cards. Drag a card into a pocket, or choose a card and then its destination. On phones, tap a card and then a pocket. A left-edge drop pushes cards right; a right-edge drop pushes left. Centre drops replace content. Shifts stop at a gap; a full row sends the end card to Overflow. Artwork and merged pockets block shifting.",
    ],
    [
      "Select and move cards",
      "Click or tap cards to select or deselect them. Each extra click adds another card to the selection. Selected cards are highlighted; other cards dim. Drag a card to move it into an empty pocket or swap it with another placed card. On a touchscreen, hold a placed card briefly, then drag. Escape clears the selection. Delete moves the selected items to Overflow.",
    ],
    [
      "Merge and design pockets",
      "Use Select pockets to merge, select pockets connected along an edge, then choose Merge. Replaced contents are kept in Overflow. Select one merged pocket to split it with Unmerge. Design pocket adds artwork or a reserved placeholder.",
    ],
    [
      "Covers, sleeves and toploaders",
      "Cover changes the binder cover. Transparent shows its first page. Card styles changes sleeves or toploaders for selected cards, the active page or the binder. Turn pages while styling, then click a card to target it. On phones, use the target icon beside Apply to. Apply creates a draft edit; Save keeps it.",
    ],
    [
      "Pages and layout",
      "Use the side arrows to turn pages; the plus adds a page at the end. Pages previews can be dragged to reorder; keyboard users can focus a preview and press Alt + Up or Alt + Down. View and settings changes page view, rows and columns, duplicates or deletes pages. The binder fits automatically between open side panels. Up to 30 pages.",
    ],
    [
      "Overflow and history",
      "Overflow keeps displaced cards and artwork separately from Pages. Choose an item and a destination pocket to put it back. Clear Overflow asks for confirmation and supports Undo. Undo and Redo are on the left toolbar.",
    ],
    [
      "Save and backups",
      "Save stores your binder in this browser only. Download backup exports the current binder. Restore backup validates a file and asks before replacing your draft; Save is still required. Backups let you move binders between browsers. There is no cloud sync or automatic save.",
    ],
    [
      "Copy and swap",
      "Select exactly two cards to Swap. Copy cards to another binder opens a destination chooser; open that binder, Paste, then Save. Copy styles and Paste styles reuse a card's sleeve and toploader choices. Add cards supports selecting several catalogue cards at once.",
    ],
    [
      "Keyboard shortcuts",
      "Ctrl or Command + S: Save. Ctrl or Command + Z: Undo. Shift + Ctrl or Command + Z: Redo. Left / Right: turn pages when focus is outside a field or toolbar. Escape: dismiss the active popup, placement or selection. Delete: move selected items to Overflow. Tab: move between controls. Alt + Up / Down: reorder a focused page preview.",
    ],
  ];
  for (const [title, copy] of guides) {
    const guide = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = title;
    const body = document.createElement("p");
    body.textContent = copy;
    guide.append(summary, body);
    $("help-guides").append(guide);
  }
  $("help-search").addEventListener("input", () => {
    const q = $("help-search").value.trim().toLowerCase();
    for (const guide of $("help-guides").children)
      guide.hidden = !guide.textContent.toLowerCase().includes(q);
    $("help-empty").hidden = [...$("help-guides").children].some(
      (g) => !g.hidden,
    );
  });
  helpButton.addEventListener("click", () => {
    closePopovers();
    help.showModal();
    $("help-search").focus();
  });
  $("help-close").addEventListener("click", () => help.close());
  help.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    help.close();
  });
  help.addEventListener("close", () =>
    helpButton.focus({ preventScroll: true }),
  );
  document.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (
      /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) ||
      rail.contains(e.target) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = $(e.key === "ArrowLeft" ? "previous-page" : "next-page");
      if (next.dataset.add !== "true") next.click();
    }
  });
  window.EditorMobile = {
    showBinder() {
      closePopovers();
      if (narrow.matches) {
        if (phone.matches && sidebarView === "overflow") setPages(false);
        setCards(false, false);
        requestAnimationFrame(() =>
          document
            .querySelector("#binder-page button")
            ?.focus({ preventScroll: true }),
        );
      }
    },
  };
  window.EditorLayout = { positionPopovers, setCards };
  setPages(!phone.matches);
  setCards(cardsOpen || $("paste-copied-cards")?.hidden === false);
  if (shell.classList.contains("customizing")) {
    wasCustomizing = true;
    restoreCards = cardsOpen;
    setCards(false);
  }
  synchronizeAccessibility();
  layout();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("editor-loading");
      document.getElementById("editor-startup").hidden = true;
    }),
  );
  if (selection.dataset.placing === "true") window.EditorMobile.showBinder();
})();
