(async () => {
  "use strict";
  const repository = window.BinderRepository || window.BinderStore;
  if (repository.enabled) await repository.ready;
  const $ = (id) => document.getElementById(id);
  const binderId = new URLSearchParams(location.search).get("binder");
  const cards = new Map(
    window.CARDS.map((c) => [c.id || c.collectorNumber, c]),
  );
  let doc,
    index = -1,
    zoom = 1,
    mode = "single",
    pickerKey = "",
    pageAnimation = null,
    focusReturn = null,
    sequence = 0,
    gesture = null,
    suppressClick = false;
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) =>
      node.setAttribute(key, String(value)),
    );
    return node;
  };
  function sampleDocument(binder) {
    const rows = binder.rows || 3,
      columns = binder.columns || 3;
    return {
      name: binder.name,
      cover: { theme: "classic" },
      frames: {},
      pages: Array.from({ length: binder.pages || 1 }, (_, page) => ({
        rows,
        columns,
        regions: Array.from({ length: rows * columns }, (_, cell) => ({
          id: "sample-" + page + "-" + cell,
          cells: [[Math.floor(cell / columns), cell % columns]],
          content:
            page === 0 && binder.cards[cell]
              ? { cardId: binder.cards[cell] }
              : null,
        })),
      })),
    };
  }
  function unavailable(message) {
    doc = null;
    $("viewer-shell").hidden = true;
    $("viewer-error").hidden = false;
    $("viewer-error-message").textContent = message;
    $("viewer-title").textContent = "Binder viewer";
    $("viewer-source").textContent = repository.enabled
      ? "Private binder"
      : "Local preview";
    document.title = "Binder viewer — Pokedex";
    $("viewer-fullscreen").hidden = true;
    $("viewer-cover-art").replaceChildren();
    $("viewer-page-art").replaceChildren();
    if ($("viewer-inspect").open) $("viewer-inspect").close();
  }
  function load() {
    try {
      if (repository.enabled && !repository.user)
        return unavailable(
          "Sign in from Workspace to view your private cloud binder.",
        );
      if (!binderId)
        return unavailable("Choose a binder from Workspace to view it.");
      const binder = repository.read().find((b) => b.id === binderId);
      if (!binder)
        return unavailable(
          "This binder is no longer available. Return to Workspace to choose another.",
        );
      doc = binder.document || sampleDocument(binder);
      index = Math.min(index, doc.pages.length - 1);
      $("viewer-error").hidden = true;
      $("viewer-shell").hidden = false;
      $("viewer-title").textContent = doc.name;
      document.title = doc.name + " — Pokedex viewer";
      $("viewer-source").textContent = binder.document
        ? repository.enabled
          ? "Private cloud binder"
          : "Saved on this browser"
        : "Sample binder";
      $("viewer-cover-art").replaceChildren(
        window.BinderCovers.create(doc.cover || "classic", doc.name, doc),
      );
      $("viewer-cover-count").textContent =
        doc.pages.length + (doc.pages.length === 1 ? " page" : " pages");
      $("viewer-fullscreen").hidden = !(
        document.fullscreenEnabled && $("viewer-main").requestFullscreen
      );
      render();
    } catch (error) {
      unavailable(error.message);
    }
  }
  window.addEventListener("pokedex-account-changed", () =>
    unavailable("Account changed. Return to Workspace to sign in again."),
  );
  function regionArt(region, width, height, cellWidth, cellHeight, gap) {
    const art = svg("svg", {
      viewBox: "0 0 " + width + " " + height,
      "aria-hidden": "true",
    });
    const id = "viewer-clip-" + ++sequence;
    const clip = svg("clipPath", { id });
    const geometry = window.BinderGeometry(
      region.cells,
      cellWidth,
      cellHeight,
      gap,
    );
    geometry.rects.forEach((rect) => clip.append(svg("rect", rect)));
    const defs = svg("defs");
    defs.append(clip);
    art.append(defs);
    geometry.rects.forEach((rect) =>
      art.append(svg("rect", { ...rect, fill: "var(--surface)" })),
    );
    if (region.content)
      window.BinderVisuals.append(
        art,
        region.content,
        width,
        height,
        doc.frames,
        id,
        svg,
      );
    art.append(
      svg("path", {
        d: geometry.outline,
        fill: "none",
        stroke: "var(--line)",
        "stroke-width": 1,
        "stroke-dasharray": region.content ? "0" : "4 4",
      }),
    );
    return { art, id };
  }

  function visiblePages() {
    if (!doc || index < 0) return [];
    return mode === "spread" ? [index, index + 1] : [index];
  }
  function rangeLabel() {
    if (index < 0) return "Cover";
    const last = Math.min(
      index + (mode === "spread" ? 2 : 1),
      doc.pages.length,
    );
    return mode === "spread" && last > index + 1
      ? "Pages " + (index + 1) + "–" + last + " of " + doc.pages.length
      : "Page " + (index + 1) + " of " + doc.pages.length;
  }
  function renderCover() {
    const viewport = $("viewer-viewport");
    if (!viewport.clientWidth || !viewport.clientHeight) return;
    const width = Math.max(
      60,
      Math.min(
        300,
        viewport.clientWidth - 80,
        (viewport.clientHeight - 148) * 0.75,
      ),
    );
    $("viewer-cover-art").style.width = width + "px";
  }
  function renderPage() {
    if (!doc || index < 0) {
      renderCover();
      return;
    }
    const viewport = $("viewer-viewport"),
      area = $("viewer-page-art");
    if (viewport.clientWidth <= 48 || viewport.clientHeight <= 48) return;
    const cw = 80,
      ch = (80 * 337) / 245,
      gap = 8,
      padding = 16,
      footer = 26,
      spine = mode === "spread" ? 24 : 0;
    const pages = visiblePages().map((i) => {
      const page = doc.pages[i];
      const reference = page || doc.pages[index];
      return {
        page,
        index: i,
        width: reference.columns * (cw + gap) - gap + padding * 2,
        height: reference.rows * (ch + gap) - gap + padding * 2 + footer,
      };
    });
    const width = pages.reduce((total, p) => total + p.width, 0) + spine;
    const height = Math.max(...pages.map((p) => p.height));
    const scale =
      Math.min(
        (viewport.clientWidth - 48) / width,
        (viewport.clientHeight - 48) / height,
      ) * zoom;
    const activeRegion = document.activeElement?.dataset.viewerRegion;
    area.style.width = width * scale + "px";
    area.style.height = height * scale + "px";
    area.classList.toggle("is-spread", mode === "spread");
    area.setAttribute("aria-label", rangeLabel());
    const sheets = [];
    let left = 0;
    pages.forEach(
      (
        { page, index: pageIndex, width: sheetWidth, height: sheetHeight },
        position,
      ) => {
        const sheet = document.createElement("section");
        sheet.className = "viewer-sheet" + (!page ? " is-blank" : "");
        sheet.style.left = left * scale + "px";
        sheet.style.width = sheetWidth * scale + "px";
        sheet.style.height = sheetHeight * scale + "px";
        sheet.setAttribute(
          "aria-label",
          page ? "Page " + (pageIndex + 1) : "Blank facing page, end of binder",
        );
        sheet.dataset.pageIndex = pageIndex;
        if (page) {
          const content = document.createElement("div");
          content.className = "viewer-sheet-pockets";
          content.style.left = padding * scale + "px";
          content.style.top = padding * scale + "px";
          page.regions.forEach((region) => {
            const x = Math.min(...region.cells.map((c) => c[1])),
              y = Math.min(...region.cells.map((c) => c[0]));
            const rw =
              (Math.max(...region.cells.map((c) => c[1])) - x + 1) *
                (cw + gap) -
              gap;
            const rh =
              (Math.max(...region.cells.map((c) => c[0])) - y + 1) *
                (ch + gap) -
              gap;
            const node = document.createElement(
              region.content ? "button" : "div",
            );
            node.className = "viewer-pocket";
            node.style.left = x * (cw + gap) * scale + "px";
            node.style.top = y * (ch + gap) * scale + "px";
            node.style.width = rw * scale + "px";
            node.style.height = rh * scale + "px";
            const { art, id } = regionArt(
              region,
              rw * scale,
              rh * scale,
              cw * scale,
              ch * scale,
              gap * scale,
            );
            node.style.clipPath = "url(#" + id + ")";
            node.append(art);
            if (region.content) {
              node.type = "button";
              node.dataset.viewerRegion = region.id;
              node.setAttribute(
                "aria-label",
                "Page " +
                  (pageIndex + 1) +
                  ": inspect " +
                  window.BinderVisuals.name(region.content),
              );
              node.addEventListener("click", () => inspect(region, node));
            } else node.setAttribute("aria-hidden", "true");
            content.append(node);
          });
          sheet.append(content);
          const label = document.createElement("span");
          label.className = "viewer-sheet-number";
          label.textContent = pageIndex + 1;
          label.setAttribute("aria-hidden", "true");
          sheet.append(label);
        }
        sheets.push(sheet);
        left += sheetWidth + (position === 0 ? spine : 0);
      },
    );
    if (mode === "spread") {
      const gutter = document.createElement("div");
      gutter.className = "viewer-spine";
      gutter.setAttribute("aria-hidden", "true");
      gutter.style.left = pages[0].width * scale + "px";
      gutter.style.width = spine * scale + "px";
      gutter.style.height = height * scale + "px";
      for (let i = 0; i < 3; i++) gutter.append(document.createElement("span"));
      sheets.push(gutter);
    }
    area.replaceChildren(...sheets);
    if (activeRegion)
      area
        .querySelector(
          '[data-viewer-region="' + CSS.escape(activeRegion) + '"]',
        )
        ?.focus({ preventScroll: true });
  }
  function render() {
    if (!doc) return;
    if (mode === "spread" && index >= 0) index -= index % 2;
    $("viewer-cover").hidden = index !== -1;
    $("viewer-page-art").hidden = index === -1;
    $("viewer-controls").hidden = index === -1;
    const key = mode + ":" + doc.pages.length;
    if (pickerKey !== key) {
      pickerKey = key;
      const starts = doc.pages
        .map((_, i) => i)
        .filter((i) => mode === "single" || i % 2 === 0);
      $("viewer-page-picker").replaceChildren(
        ...[-1, ...starts].map((i) => {
          const option = document.createElement("option");
          option.value = i;
          const last = Math.min(i + 2, doc.pages.length);
          option.textContent =
            i < 0
              ? "Cover"
              : mode === "spread" && last > i + 1
                ? "Pages " + (i + 1) + "–" + last + " of " + doc.pages.length
                : "Page " + (i + 1) + " of " + doc.pages.length;
          return option;
        }),
      );
    }
    $("viewer-page-picker").value = index;
    $("viewer-page-picker").setAttribute(
      "aria-label",
      "Choose binder page. " + rangeLabel(),
    );
    $("viewer-previous").textContent = index === 0 ? "Cover" : "Previous";
    $("viewer-previous").setAttribute(
      "aria-label",
      index === 0
        ? "Return to cover"
        : mode === "spread"
          ? "Previous two-page spread"
          : "Previous page",
    );
    $("viewer-next").setAttribute(
      "aria-label",
      mode === "spread" ? "Next two-page spread" : "Next page",
    );
    $("viewer-next").disabled =
      index + (mode === "spread" ? 2 : 1) >= doc.pages.length;
    $("viewer-single").setAttribute("aria-pressed", String(mode === "single"));
    $("viewer-spread").setAttribute("aria-pressed", String(mode === "spread"));
    $("viewer-zoom").value = zoom;
    $("viewer-zoom-value").textContent = Math.round(zoom * 100) + "%";
    $("viewer-viewport").classList.toggle("is-zoomed", zoom > 1);
    $("viewer-viewport").classList.toggle("showing-cover", index < 0);
    renderPage();
  }
  function turn(next) {
    if (!doc || next < -1 || next >= doc.pages.length) return;
    if (mode === "spread" && next >= 0) next -= next % 2;
    if (next === index) return;
    const direction = next > index ? 1 : -1;
    const focusedPocket = !!document.activeElement?.dataset.viewerRegion;
    index = next;
    zoom = 1;
    render();
    $("viewer-viewport").scrollTo(0, 0);
    $("viewer-status").textContent = rangeLabel();
    if (index < 0) $("viewer-open").focus({ preventScroll: true });
    else if (
      focusedPocket ||
      $("viewer-cover").contains(document.activeElement)
    )
      $("viewer-page-picker").focus({ preventScroll: true });
    pageAnimation?.cancel();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const content = index < 0 ? $("viewer-cover") : $("viewer-page-art");
      pageAnimation = content.animate(
        [
          {
            opacity: 0.65,
            transform:
              "perspective(1200px) rotateY(" +
              direction * -5 +
              "deg) translateX(" +
              direction * 8 +
              "px)",
          },
          {
            opacity: 1,
            transform: "perspective(1200px) rotateY(0deg) translateX(0)",
          },
        ],
        { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" },
      );
    }
  }
  function advance(direction) {
    if (index < 0) {
      if (direction > 0) turn(0);
      return;
    }
    turn(
      direction < 0 && index === 0
        ? -1
        : index + direction * (mode === "spread" ? 2 : 1),
    );
  }
  for (const choice of ["single", "spread"]) {
    $("viewer-" + choice).addEventListener("click", () => {
      mode = choice;
      zoom = 1;
      render();
      $("viewer-viewport").scrollTo(0, 0);
      $("viewer-status").textContent =
        (choice === "spread" ? "Two-page view. " : "Single-page view. ") +
        rangeLabel();
    });
  }
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
    "change",
    (event) => {
      if (event.matches) pageAnimation?.finish();
    },
  );
  function inspect(region, node) {
    const content = region.content,
      card = cards.get(content.cardId);
    focusReturn = node;
    $("viewer-inspect-title").textContent = window.BinderVisuals.name(content);
    $("viewer-inspect-art").replaceChildren();
    if (!content.kind && card) {
      const img = document.createElement("img");
      img.src = card.imageUrl;
      img.alt = card.name;
      img.addEventListener(
        "error",
        () => {
          img.replaceWith(document.createTextNode("Image unavailable."));
        },
        { once: true },
      );
      $("viewer-inspect-art").append(img);
      const finishes = {
        normal: "Normal",
        reverse: "Reverse holo",
        holo: "Holo",
        firstEdition: "First edition",
      };
      $("viewer-inspect-meta").textContent = [
        card.setName,
        "#" + card.collectorNumber,
        content.variant && finishes[content.variant],
        card.rarity,
      ]
        .filter(Boolean)
        .join(" · ");
    } else {
      const cw = 80,
        ch = (80 * 337) / 245,
        gap = 8;
      const rw =
        (Math.max(...region.cells.map((c) => c[1])) -
          Math.min(...region.cells.map((c) => c[1])) +
          1) *
          (cw + gap) -
        gap;
      const rh =
        (Math.max(...region.cells.map((c) => c[0])) -
          Math.min(...region.cells.map((c) => c[0])) +
          1) *
          (ch + gap) -
        gap;
      $("viewer-inspect-art").append(
        regionArt(region, rw, rh, cw, ch, gap).art,
      );
      $("viewer-inspect-meta").textContent =
        content.kind === "artwork" ? "Binder artwork" : "Reserved pocket";
    }
    $("viewer-inspect").showModal();
    $("viewer-inspect").scrollTop = 0;
    $("viewer-inspect-close").focus();
  }
  const viewOptions = document.querySelector(".viewer-options");
  document.addEventListener("pointerdown", (event) => {
    if (!viewOptions.contains(event.target)) viewOptions.open = false;
  });
  viewOptions.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !viewOptions.open) return;
    viewOptions.open = false;
    viewOptions.querySelector("summary").focus();
    event.preventDefault();
    event.stopPropagation();
  });
  $("viewer-open").addEventListener("click", () => turn(0));
  $("viewer-previous").addEventListener("click", () => advance(-1));
  $("viewer-next").addEventListener("click", () => advance(1));
  $("viewer-page-picker").addEventListener("change", (event) =>
    turn(Number(event.target.value)),
  );
  $("viewer-fit").addEventListener("click", () => {
    zoom = 1;
    render();
    $("viewer-viewport").scrollTo(0, 0);
  });
  $("viewer-zoom").addEventListener("input", (event) => {
    zoom = Number(event.target.value);
    render();
  });
  $("viewer-inspect-close").addEventListener("click", () =>
    $("viewer-inspect").close(),
  );
  $("viewer-inspect").addEventListener("close", () => {
    const target = focusReturn?.isConnected
      ? focusReturn
      : $("viewer-page-art").querySelector(
          '[data-viewer-region="' +
            CSS.escape(focusReturn?.dataset.viewerRegion || "") +
            '"]',
        );
    target?.focus({ preventScroll: true });
  });
  document.addEventListener("keydown", (event) => {
    if (
      $("viewer-inspect").open ||
      /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)
    )
      return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      advance(event.key === "ArrowRight" ? 1 : -1);
    }
  });
  $("viewer-fullscreen").addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $("viewer-main").requestFullscreen();
    } catch {
      $("viewer-status").classList.remove("sr-only");
      $("viewer-status").textContent =
        "Fullscreen is unavailable in this browser window.";
    }
  });
  document.addEventListener("fullscreenchange", () => {
    $("viewer-fullscreen").textContent = document.fullscreenElement
      ? "Exit fullscreen"
      : "Fullscreen";
    renderPage();
  });
  const viewport = $("viewer-viewport");
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || zoom > 1 || event.isPrimary === false)
      return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      suppressClick = true;
      advance(dx < 0 ? 1 : -1);
      setTimeout(() => (suppressClick = false), 400);
    }
  });
  viewport.addEventListener("pointercancel", () => (gesture = null));
  viewport.addEventListener(
    "click",
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    { capture: true },
  );
  new ResizeObserver(renderPage).observe(viewport);
  window.addEventListener("storage", (event) => {
    if (event.key === "pokedex.workspace.v1" || event.key === null) {
      if ($("viewer-inspect").open) $("viewer-inspect").close();
      load();
      $("viewer-status").textContent = doc
        ? "Updated to the latest saved version."
        : "";
    }
  });
  load();
})();
