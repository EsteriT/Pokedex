(async () => {
  "use strict";
  if (window.BinderRepository?.enabled) await window.EditorReady;
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
  const phone = matchMedia(
    "(max-width: 700px), (max-width: 1024px) and (max-height: 500px)",
  );
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
    if (!open) $("card-filters").open = false;
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

  const pagesBody = $("pages-body"),
    pagesControls = $("pages-controls");
  pagesBody.append($("page-list"));
  canvas.append(document.querySelector(".page-navigation"));
  pagesControls.append(dock);
  const settings = document.querySelector(".layout-settings");
  const settingsBody = document.querySelector(".layout-settings-body");
  settings.querySelector("summary").title = "Page settings";
  settings
    .querySelector("summary")
    .setAttribute("aria-label", "Page settings");
  settingsBody.querySelector("h2").textContent = "Page settings";
  const view = document.querySelector(".page-view-control");
  view.querySelector("span").classList.remove("sr-only");
  view.querySelector("span").textContent = "Page view";
  view.classList.add("field");
  view.hidden = true;
  settingsBody.prepend(view);
  const viewSection = document.createElement("div"), viewLabel = document.createElement("span"), viewButtons = document.createElement("div");
  viewSection.className = "page-view-section";
  viewLabel.textContent = "View";
  viewButtons.className = "page-view-buttons";
  viewButtons.setAttribute("role", "group");
  viewButtons.setAttribute("aria-label", "Page view");
  for (const [value, label] of [["one", "Single"], ["two", "Spread"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.pageView = value;
    button.textContent = label;
    button.setAttribute("aria-pressed", String($("page-view").value === value));
    button.addEventListener("click", () => {
      if ($("page-view").value === value) return;
      $("page-view").value = value;
      $("page-view").dispatchEvent(new Event("change", { bubbles: true }));
    });
    viewButtons.append(button);
  }
  viewSection.append(viewLabel, viewButtons);
  settingsBody.insertBefore(viewSection, $("layout-form"));
  $("layout-form").insertBefore($("layout-impact"), $("layout-count").nextSibling);
  $("move-page-left").hidden = true;
  $("move-page-right").hidden = true;
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
    $("pages-toggle").title = open ? "Hide pages and overflow" : "Show pages and overflow";
    if (!open) closePopovers();
    requestAnimationFrame(layout);
  }
  $("pages-toggle").addEventListener("click", () =>
    setPages($("pages-toggle").getAttribute("aria-expanded") !== "true"),
  );
  const mobileLabels = [
    ["cards-tool", "Cards"],
    ["edit-cover-preview", "Binder"],
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
    close.setAttribute("aria-label", "Close page settings");
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
  for (const panel of [cards, custom]) {
    const resize = document.createElement("button");
    resize.type = "button";
    resize.className = "sheet-size";
    resize.setAttribute("aria-label", "Expand panel");
    resize.setAttribute("aria-expanded", "false");
    resize.setAttribute("aria-controls", panel.id);
    resize.title = "Expand panel";
    resize.innerHTML =
      '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>';
    panel
      .querySelector(".panel-heading, .customizer-heading")
      .insertBefore(
        resize,
        panel.querySelector("#cards-close, #customize-close"),
      );
    resize.addEventListener("click", () => {
      const expanded = panel.classList.toggle("sheet-expanded");
      resize.setAttribute("aria-expanded", String(expanded));
      resize.setAttribute(
        "aria-label",
        expanded ? "Reduce panel" : "Expand panel",
      );
      resize.title = resize.getAttribute("aria-label");
      layout();
    });
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
  function viewportLayout() {
    const viewport = window.visualViewport;
    document.body.style.setProperty(
      "--editor-height",
      (viewport?.scale === 1 ? viewport.height : innerHeight) + "px",
    );
    layout();
  }
  window.addEventListener("resize", viewportLayout);
  window.visualViewport?.addEventListener("resize", viewportLayout);
  viewportLayout();
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
        if ($("selection-more")?.open) {
          $("selection-more").open = false;
          $("selection-more").querySelector("summary").focus();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (cardsOpen && $("card-filters").open) {
          $("card-filters").open = false;
          $("card-filters").querySelector("summary").focus();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
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
  for (const group of [
    [
      $("cards-tool"),
      $("edit-cover-preview"),
      $("customize-binder"),
      $("select-pockets"),
    ],
    [settings, $("undo"), $("redo")],
    [preview, download, $("restore-backup")],
  ]) {
    group.forEach((node) => node.classList.add("workshop-tool"));
    group[0].classList.add("workshop-group-start");
    group[0].style.setProperty(
      "--group-height",
      group.length * 40 + (group.length - 1) * 6 + 8 + "px",
    );
  }
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
    ["delete-page", "Delete page"],
    ["cover-apply", "Apply customization"],
    ["cover-cancel", "Cancel customization"],
    ["custom-tab-cover", "Cover"],
    ["custom-tab-sleeve", "Sleeves"],
    ["custom-tab-toploader", "Toploaders"],
    ["feedback-undo", "Undo"],
  ])
    icon($(id), label);
  for (const [id, label] of [["custom-tab-sleeve", "Sleeves"], ["custom-tab-toploader", "Toploaders"]]) {
    const text = document.createElement("span");
    text.textContent = label;
    $(id).append(text);
  }
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
    ["Cards", [["Place", "Drag a card into a pocket, or choose a card then its pocket."], ["Insert", "Drop near an edge to shift the row."], ["Replace", "Drop in the center to replace content."]], "Shifts stop at a gap. A full row sends its end card to Overflow. Artwork and merged pockets block shifting. On phones, tap a catalogue card then a pocket."],
    ["Selection", [["Select", "Click cards to select or deselect."], ["Move / swap", "Drag onto an empty pocket or another card."], ["Remove", "Move selected items to Overflow."]], "On touchscreens, hold a placed card briefly, then drag. Select exactly two cards for Swap. More contains copy/paste styles and copy to another binder."],
    ["Pockets", [["Merge", "Select pockets forming a rectangle, then Merge."], ["Split", "Select a merged pocket, then More > Unmerge."], ["Design", "Add artwork or a placeholder with Design pocket."]], "Strips and squares are allowed. L-shaped merges are not. Displaced contents go to Overflow."],
    ["Appearance", [["Binder", "Change the cover, text, artwork or page appearance."], ["Cards", "Choose sleeves or toploaders and an Apply to target."], ["Keep", "Apply changes, then Save."]], "Page appearance can target This page or All pages. All pages replaces individual page styles and sets the default for new pages. Card styles can target selected cards, this page or the binder."],
    ["Pages", [["Turn", "Use the side arrows."], ["Add", "Choose Add page after the last thumbnail."], ["Reorder", "Drag page thumbnails into order."]], "View and settings contains page view, rows, columns, duplicate and delete. Up to 30 pages. The canvas fits automatically."],
    ["Overflow", [["Find", "Open the tray beside Pages."], ["Restore", "Choose an item, then its destination pocket."], ["Recover", "Use Undo to reverse a recent edit."]], "Overflow holds displaced cards and artwork. Clear overflow asks for confirmation and supports Undo. Redo restores an undone change."],
    ["Saving", [["Save", "Signed in: saves to your account. Local demo: saves in this browser."], ["Back up", "Download backup exports this binder."], ["Restore", "Choose a backup, confirm, then Save."]], "Saving is manual. Restore validates the file before replacing your draft. Keep a downloaded backup for a portable copy."],
  ];
  for (const [title, rows, extra] of guides) {
    const guide = document.createElement("details");
    guide.className = "help-topic";
    guide.name = "workshop-help-topics";
    guide.open = title === "Cards";
    const summary = document.createElement("summary");
    summary.textContent = title;
    const body = document.createElement("div");
    body.className = "help-topic-body";
    for (const [action, instruction] of rows) {
      const row = document.createElement("div");
      row.className = "help-action-row";
      const label = document.createElement("strong"), copy = document.createElement("span");
      label.textContent = action;
      copy.textContent = instruction;
      row.append(label, copy);
      body.append(row);
    }
    const more = document.createElement("details"), label = document.createElement("summary"), copy = document.createElement("p");
    more.className = "help-more";
    label.textContent = "More details";
    copy.textContent = extra;
    more.append(label, copy);
    body.append(more);
    guide.append(summary, body);
    $("help-guides").append(guide);
  }
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318" : "Ctrl";
  const shortcuts = [
    ["Save", [modifier, "S"]],
    ["Undo", [modifier, "Z"]],
    ["Redo", [modifier, "Shift", "Z"]],
    ["Turn pages", ["\u2190", "\u2192"], " / "],
    ["Dismiss / clear selection", ["Esc"]],
    ["Move selection to Overflow", ["Delete"]],
    ["Reorder focused page", ["Alt", "\u2191 / \u2193"]],
    ["Move between controls", ["Tab"]],
  ];
  for (const [action, keys, separator = " + "] of shortcuts) {
    const row = document.createElement("div"), label = document.createElement("span"), caps = document.createElement("span");
    row.className = "help-shortcut-row";
    caps.className = "help-keycaps";
    label.textContent = action;
    keys.forEach((key, i) => {
      if (i) caps.append(document.createTextNode(separator));
      const cap = document.createElement("kbd");
      cap.textContent = key;
      caps.append(cap);
    });
    row.append(label, caps);
    $("help-shortcuts").append(row);
  }
  const keyNote = document.createElement("p");
  keyNote.className = "help-key-note";
  keyNote.textContent = "Shortcuts depend on focus and open dialogs. Reorder needs a focused page thumbnail.";
  $("help-shortcuts").append(keyNote);
  let helpSection = "basics";
  function filterHelp() {
    const q = $("help-search").value.trim().toLowerCase();
    const basics = helpSection === "basics", panel = $(basics ? "help-guides" : "help-shortcuts");
    $("help-guides").hidden = !basics;
    $("help-shortcuts").hidden = basics;
    for (const section of ["basics", "shortcuts"])
      $("help-" + section + "-tab").setAttribute("aria-pressed", String(section === helpSection));
    const entries = [...panel.children].filter(node => !node.classList.contains("help-key-note"));
    for (const entry of entries) {
      entry.hidden = !entry.textContent.toLowerCase().includes(q);
      if (basics && q && !entry.hidden) entry.open = true;
    }
    $("help-empty").hidden = entries.some(entry => !entry.hidden);
    $("help-empty").textContent = "No matches in " + (basics ? "Basics. Try Shortcuts." : "Shortcuts. Try Basics.");
  }
  for (const section of ["basics", "shortcuts"])
    $("help-" + section + "-tab").addEventListener("click", () => {
      helpSection = section;
      filterHelp();
      document.querySelector(".help-scroll").scrollTop = 0;
    });
  $("help-search").addEventListener("input", filterHelp);
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
  // Selection actions share a stable hierarchy; secondary tools stay available in More.
  const selectionActions = $("selection-actions"),
    more = document.createElement("details"),
    moreTrigger = document.createElement("summary"),
    moreBody = document.createElement("div");
  more.id = "selection-more";
  moreTrigger.textContent = "\u22ef";
  moreTrigger.setAttribute("aria-label", "More selection actions");
  moreTrigger.title = "More actions";
  moreBody.className = "selection-more-body";
  more.append(moreTrigger, moreBody);
  const secondaryIds = ["swap-selected-cards", "unmerge", "copy-card-style", "paste-card-style", "copy-cards-binder"];
  for (const id of secondaryIds) {
    const control = $(id);
    if (!control) continue;
    const label = document.createElement("span");
    label.textContent = control.getAttribute("aria-label") || control.title || control.textContent;
    control.append(label);
    moreBody.append(control);
  }
  for (const [id, text] of [["pocket-content", "Design pocket"], ["pocket-style", "Customize"], ["merge", "Merge"]]) {
    const label = document.createElement("span");
    label.className = "selection-primary-label";
    label.textContent = text;
    $(id).append(label);
  }
  selectionActions.append($("pocket-style"), $("pocket-content"), $("merge"), $("inspect-pocket"), $("move-to-page"), more, $("to-overflow"), $("selection-dismiss"));
  function selectionHierarchy() {
    const merging = $("select-pockets").getAttribute("aria-pressed") === "true";
    const primary = merging ? (!$("merge").hidden ? "merge" : null)
      : !$("pocket-style").hidden ? "pocket-style" : !$("pocket-content").hidden ? "pocket-content" : null;
    for (const id of ["pocket-content", "pocket-style", "merge"]) {
      const node = $(id), active = id === primary;
      if (node.classList.contains("selection-primary") !== active) node.classList.toggle("selection-primary", active);
    }
    if (selection.classList.contains("merge-toolbar") !== merging) selection.classList.toggle("merge-toolbar", merging);
    const content = $("pocket-content"), contentParent = primary === "pocket-style" ? moreBody : selectionActions;
    if (content.parentElement !== contentParent) {
      if (contentParent === selectionActions) selectionActions.insertBefore(content, $("merge"));
      else moreBody.prepend(content);
    }
    const hideMore = ![...moreBody.children].some(n => !n.hidden);
    if (more.hidden !== hideMore) more.hidden = hideMore;
    if (hideMore || selection.hidden) more.open = false;
  }
  more.addEventListener("toggle", () => {
    if (!more.open) return;
    const rect = more.getBoundingClientRect(), height = moreBody.getBoundingClientRect().height;
    more.classList.toggle("opens-up", rect.bottom + height + 8 > innerHeight - 12 && rect.top > height + 12);
  });
  moreBody.addEventListener("click", event => {
    if (event.target.closest("button")) more.open = false;
  });
  document.addEventListener("pointerdown", event => {
    if (more.open && !more.contains(event.target)) more.open = false;
  });
  more.addEventListener("keydown", event => {
    if (event.key === "Escape") { more.open = false; moreTrigger.focus(); event.stopPropagation(); }
  });
  new MutationObserver(selectionHierarchy).observe(selection, { subtree: true, attributes: true, attributeFilter: ["hidden", "class", "data-count"] });
  selectionHierarchy();
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
