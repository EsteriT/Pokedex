(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls = "", text) => {
    const n = document.createElement(tag);
    n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const button = (id, label, fn, cls = "tool-button") => {
    const b = el("button", cls, label);
    b.type = "button";
    b.id = id;
    b.addEventListener("click", fn);
    return b;
  };
  function init(h) {
    let pageSequence = 0;
    let clipboard = null,
      coverDraft = {},
      coverArt = null,
      coverToken = 0,
      viewDoc = null,
      viewIndex = -1,
      lastFocus = null;
    const defaults = (c) => ({
      sleeve: "none",
      toploader: "none",
      ...(c?.frames || h.state.document.frames),
    });
    const label = el("span", "studio-action-note");
    label.id = "style-clipboard-status";
    label.setAttribute("role", "status");
    const actions = $("selection-actions");
    actions.prepend(button("inspect-pocket", "Inspect", () => inspect()));
    actions.append(
      button("copy-card-style", "Copy styles", () => {
        const cards = selectedCards();
        if (cards.length !== 1) return;
        clipboard = defaults(cards[0].content);
        label.textContent = "Style copied";
        refresh();
      }),
    );
    actions.append(
      button("paste-card-style", "Paste styles", () => {
        h.run(
          () =>
            h.state.applyFramePatch(
              clipboard,
              "selection",
              h.page().id,
              h.selected(),
            ),
          "Styles pasted.",
        );
        label.textContent = "Styles pasted";
      }),
    );

    actions.append(label);
    const actionIcons = {
      "inspect-pocket":
        "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zm7 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
      "pocket-content": "M4 16l12-12 4 4L8 20H4v-4zm10-10 4 4",
      "pocket-style":
        "M14 3H4v18h14V12M18 2l1.2 3.8L23 7l-3.8 1.2L18 12l-1.2-3.8L13 7l3.8-1.2zM7 12h4M7 16h7",
      "to-overflow": "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7M14 10v7",
      merge: "M3 4h7v16H3zM14 4h7v16h-7zM9 12h6m-4-2 2 2-2 2",
      unmerge: "M3 4h18v16H3zM12 4v16M8 10l-2 2 2 2M16 10l2 2-2 2",
    };
    for (const [id, path] of Object.entries(actionIcons)) {
      const action = $(id),
        name = action.textContent.trim();
      action.setAttribute("aria-label", name);
      action.title = name;
      action.classList.add("selection-icon");
      action.innerHTML =
        '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="' +
        path +
        '"/></svg>';
    }
    const dismiss = button(
      "selection-dismiss",
      "",
      () => $("clear-selection").click(),
      "selection-icon",
    );
    dismiss.setAttribute("aria-label", "Clear selection");
    dismiss.title = "Clear selection";
    dismiss.innerHTML =
      '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    actions.append(dismiss);

    function selectedCards() {
      return h
        .page()
        .regions.filter(
          (r) =>
            h.selected().includes(r.id) &&
            window.BinderVisuals.isCard(r.content),
        );
    }
    function refresh() {
      const selected = h.selected(),
        r = h.page().regions.find((r) => r.id === selected[0]);
      $("inspect-pocket").hidden = selected.length !== 1 || !r?.content;
      $("copy-card-style").hidden = selectedCards().length !== 1;
      $("paste-card-style").hidden = !selectedCards().length || !clipboard;
      label.hidden = !selected.length || !label.textContent;
      $("duplicate-page").disabled = h.state.document.pages.length >= 30;
      actions.hidden =
        document.querySelector(".selection-status").dataset.placing ===
          "true" || [...actions.children].every((n) => n.hidden);
    }
    const preview = button(
      "preview-binder",
      "Preview",
      () => openViewer(),
      "button secondary studio-preview-button",
    );
    document
      .querySelector(".topbar-actions")
      .insertBefore(preview, document.querySelector(".save-actions"));
    document.querySelector(".page-actions").append(
      button("duplicate-page", "Duplicate page", () => {
        open(duplicateDialog);
      }),
    );
    const duplicateButton = $("duplicate-page");
    duplicateButton.title = "Duplicate page";
    duplicateButton.setAttribute("aria-label", "Duplicate page");
    duplicateButton.innerHTML =
      '<svg class="ui-symbol" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="13" height="14" rx="2"/><path d="M16 7V3H3v14h4"/></svg>';
    duplicateButton.append(el("span", "", "Duplicate page"));
    const duplicateDialog = dialog("duplicate-dialog", "Duplicate page");
    const options = el("div", "duplicate-options");
    for (const [labelText, include, detail] of [
      ["Layout only", false, "Keep pocket shapes; start with empty pockets."],
      [
        "Layout and content",
        true,
        "Copy cards, artwork, placeholders and styles.",
      ],
    ]) {
      const b = button(
        include ? "duplicate-full" : "duplicate-layout",
        labelText,
        () => {
          duplicateDialog.close();
          h.run(
            () => h.setPage(h.state.duplicatePage(h.page().id, include)),
            "Page duplicated.",
          );
        },
        "duplicate-option",
      );
      b.append(el("span", "", detail));
      options.append(b);
    }
    duplicateDialog.append(options);
    function dialog(id, title) {
      const d = el("dialog", "studio-dialog");
      d.id = id;
      d.setAttribute("aria-labelledby", id + "-title");
      const head = el("div", "studio-dialog-heading"),
        heading = el("h2", "", title);
      heading.id = id + "-title";
      head.append(
        heading,
        button(id + "-close", "", () => d.close(), "icon-button studio-close"),
      );
      head.lastChild.setAttribute("aria-label", "Close " + title.toLowerCase());
      head.lastChild.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      d.append(head);
      document.body.append(d);
      d.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...d.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
          ),
        ].filter((n) => n.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
      d.addEventListener("close", () => {
        window.UIControls.restoreFocus(
          lastFocus,
          () => document.querySelector(".editor-pocket"),
          $("select-pockets"),
        );
      });
      return d;
    }
    function open(d) {
      lastFocus = document.activeElement;
      d.showModal();
      d.querySelector("button").focus({ preventScroll: true });
    }
    function pageSVG(page, doc, inspectRegion = null, thumbnail = false) {
      page = doc.pages?.find(p => p.id === page.id) || page;
      const cw = 80,
        ch = (80 * 337) / 245,
        gap = cw * 0.06,
        w = page.columns * (cw + gap) - gap,
        ht = page.rows * (ch + gap) - gap;
      const svg = h.svg("svg", {
        viewBox: "0 0 " + w + " " + ht,
        role: "img",
        "aria-label":
          "Binder page " + page.rows + " rows by " + page.columns + " columns",
      });
      window.BinderCovers.stylePage(svg, { ...doc.cover, pageStyle: page.pageStyle || doc.cover?.pageStyle });
      svg.style.background = "var(--page-background)";
      for (const r of inspectRegion ? [inspectRegion] : page.regions) {
        const xs = r.cells.map((c) => c[1]),
          ys = r.cells.map((c) => c[0]),
          x0 = Math.min(...xs),
          y0 = Math.min(...ys),
          rw = (Math.max(...xs) - x0 + 1) * (cw + gap) - gap,
          rh = (Math.max(...ys) - y0 + 1) * (ch + gap) - gap;
        const g = h.svg("g", {
            transform:
              "translate(" +
              (inspectRegion ? 0 : x0 * (cw + gap)) +
              " " +
              (inspectRegion ? 0 : y0 * (ch + gap)) +
              ")",
          }),
          defs = h.svg("defs"),
          id = "studio-clip-" + ++pageSequence,
          clip = h.svg("clipPath", { id }),
          geo = h.geometry(r.cells, cw, ch, gap);
        geo.rects.forEach((rect) => clip.append(h.svg("rect", { ...rect, rx: r.cells.length === 1 ? 3 : 0 })));
        defs.append(clip);
        g.append(defs);
        geo.rects.forEach((rect) =>
          g.append(
            h.svg("rect", {
              ...rect,
              fill: !r.content ? "var(--soft)" : "var(--page-background, var(--surface))",
            }),
          ),
        );
        if (r.content)
          window.BinderVisuals.append(
            g,
            r.content,
            rw,
            rh,
            doc.frames,
            id,
            h.svg,
          );
        if (!r.content) {
          const center = [(Math.min(...ys) + Math.max(...ys)) / 2,
            (Math.min(...xs) + Math.max(...xs)) / 2];
          const [cy, cx] = r.cells.reduce((best, cell) =>
            Math.hypot(cell[0] - center[0], cell[1] - center[1]) <
            Math.hypot(best[0] - center[0], best[1] - center[1]) ? cell : best);
          const plus = h.svg("text", {
            x: window.BinderSchema.rectangular(r.cells) ? rw / 2 : (cx - x0) * (cw + gap) + cw / 2,
            y: window.BinderSchema.rectangular(r.cells) ? rh / 2 : (cy - y0) * (ch + gap) + ch / 2,
            fill: "var(--muted)", "text-anchor": "middle",
            "dominant-baseline": "central", "font-size": 14,
          });
          plus.textContent = "+";
          g.append(plus);
        }
        g.append(
          h.svg("path", {
            d: geo.outline,
            fill: "none",
            stroke: (page.pageStyle || doc.cover?.pageStyle) ? "var(--pocket-border)" : thumbnail && !r.content ? "var(--muted)" : "var(--line)",
            "stroke-width": thumbnail ? 4 : 1,
            "stroke-dasharray": "0",
          }),
        );
        svg.append(g);
        if (inspectRegion) svg.setAttribute("viewBox", "0 0 " + rw + " " + rh);
      }
      return svg;
    }
    const viewer = dialog("binder-view-dialog", "Binder preview");
    viewer.classList.add("binder-view-dialog");
    const viewStage = el("div", "binder-view-stage"),
      viewNav = el("div", "binder-view-nav"),
      viewPrev = button(
        "view-previous",
        "Previous",
        () => turnView(-1),
        "button secondary",
      ),
      viewNext = button(
        "view-next",
        "Next",
        () => turnView(1),
        "button primary",
      ),
      viewCount = el("span", "");
    viewCount.id = "view-page-count";
    viewCount.setAttribute("role", "status");
    viewNav.append(viewPrev, viewCount, viewNext);
    viewer.append(viewStage, viewNav);
    function openViewer() {
      viewDoc = structuredClone(h.state.document);
      viewIndex = -1;
      $("binder-view-dialog-title").textContent = viewDoc.name;
      renderView();
      open(viewer);
    }
    function renderView(direction = 0) {
      viewStage.replaceChildren();
      const content = el("div", "binder-view-content");
      if (viewIndex === -1)
        content.append(
          window.BinderCovers.create(
            viewDoc.cover || "classic",
            viewDoc.name,
            viewDoc,
          ),
        );
      else content.append(pageSVG(viewDoc.pages[viewIndex], viewDoc));
      viewStage.append(content);
      viewPrev.disabled = viewIndex === -1;
      viewNext.disabled = viewIndex === viewDoc.pages.length - 1;
      viewNext.textContent = "Next";
      viewPrev.textContent = "Previous";
      viewCount.textContent =
        viewIndex === -1
          ? "Cover"
          : "Page " + (viewIndex + 1) + " of " + viewDoc.pages.length;
      if (direction && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        content.animate(
          direction > 0
            ? [
                {
                  opacity: 0.35,
                  transform: "perspective(1000px) rotateY(-12deg)",
                },
                { opacity: 1, transform: "perspective(1000px) rotateY(0deg)" },
              ]
            : [
                {
                  opacity: 0.35,
                  transform: "perspective(1000px) rotateY(12deg)",
                },
                { opacity: 1, transform: "perspective(1000px) rotateY(0deg)" },
              ],
          { duration: 180, easing: "ease-out" },
        );
    }
    function turnView(delta) {
      const opening = viewIndex === -1 && delta === 1;
      const departing = opening
        ? viewStage.firstElementChild?.cloneNode(true)
        : null;
      const next = viewIndex + delta;
      if (next < -1 || next >= viewDoc.pages.length) return;
      viewIndex = next;
      renderView(delta);
      if (
        departing &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        departing.classList.add("departing-cover");
        viewStage.append(departing);
        const animation = departing.animate(
          [
            { transform: "rotateY(0deg)", opacity: 1 },
            { transform: "rotateY(-95deg)", opacity: 0 },
          ],
          { duration: 180, easing: "ease-in-out", fill: "forwards" },
        );
        animation.finished.then(
          () => departing.remove(),
          () => departing.remove(),
        );
      }
    }
    viewer.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        turnView(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        turnView(-1);
      }
    });
    const inspectDialog = dialog("inspect-dialog", "Pocket");
    inspectDialog.classList.add("inspect-dialog");
    const inspectArea = el("div", "inspect-area"),
      inspectArt = el("div", "inspect-art"),
      inspectMeta = el("p", "inspect-meta"),
      zoomLabel = el("label", "inspect-zoom", "Zoom"),
      zoom = document.createElement("input");
    zoom.type = "range";
    zoom.min = 1;
    zoom.max = 3;
    zoom.step = 0.25;
    zoom.value = 1;
    zoom.id = "inspect-zoom";
    zoomLabel.append(zoom);
    inspectArea.append(inspectArt);
    inspectDialog.append(inspectArea, inspectMeta, zoomLabel);

    let inspectRatio = 245 / 337,
      inspectSize = { w: 0, h: 0 };
    function fitInspection() {
      const availableW = Math.max(1, inspectArea.clientWidth - 48),
        availableH = Math.max(1, inspectArea.clientHeight - 48);
      inspectSize.w = Math.min(availableW, availableH * inspectRatio);
      inspectSize.h = inspectSize.w / inspectRatio;
      zoomInspection();
    }
    function zoomInspection() {
      inspectArt.style.width = inspectSize.w * Number(zoom.value) + "px";
      inspectArt.style.height = inspectSize.h * Number(zoom.value) + "px";
    }
    zoom.addEventListener("input", () => {
      zoomInspection();
      inspectArea.scrollLeft =
        (inspectArea.scrollWidth - inspectArea.clientWidth) / 2;
    });
    new ResizeObserver(() => {
      if (inspectDialog.open) requestAnimationFrame(fitInspection);
    }).observe(inspectArea);
    function inspect(rid) {
      const p = h.page(),
        r = p.regions.find((r) => r.id === (rid || h.selected()[0]));
      if (!r?.content) return;
      h.clearPending();
      $("inspect-dialog-title").textContent = window.BinderVisuals.name(
        r.content,
      );
      inspectArt.replaceChildren(pageSVG(p, h.state.document, r));
      inspectArt.style.width = "100%";
      inspectArt.style.height = "100%";
      zoom.value = 1;
      inspectArea.scrollTo(0, 0);
      const card = window.CARDS.find(
        (c) => (c.id || c.collectorNumber) === r.content.cardId,
      );
      inspectMeta.textContent =
        r.content.kind === "artwork"
          ? r.content.name
          : r.content.kind === "placeholder"
            ? "Reserved pocket"
            : card
              ? [
                  card.setName || card.set,
                  "#" + card.collectorNumber,
                  card.rarity,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "";
      open(inspectDialog);
      const vb = inspectArt.querySelector("svg").viewBox.baseVal;
      inspectRatio = vb.width / vb.height;
      fitInspection();
    }
    $("binder-page").addEventListener("dblclick", (e) => {
      const b = e.target.closest("[data-region-id]");
      if (b) inspect(b.dataset.regionId);
    });
    // Three independent cover sections share one compact settings area.
    const design = $("cover-design-controls"),
      uploadGroup = el("div", "custom-cover-controls");
    uploadGroup.id = "custom-cover-controls";
    const summary = el("summary", "", "Your artwork");
    uploadGroup.append(summary);
    const body = el("div", "custom-cover-body");
    const uploadLabel = el(
        "label",
        "button secondary studio-upload",
        "Upload artwork",
      ),
      input = document.createElement("input");
    input.id = "cover-artwork-file";
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    uploadLabel.append(input);
    const remove = button("remove-cover-artwork", "Remove artwork", () => {
      coverDraft = { ...coverDraft, theme: "classic" };
      h.coverTheme("classic");
      syncCover();
      h.preview();
    });
    const error = el("p", "studio-error");
    error.id = "cover-upload-error";
    error.setAttribute("role", "status");
    const crop = el("div", "cover-crop-controls");
    crop.id = "cover-crop-controls";
    const fitLabel = el("label", "field", "Image fit"),
      fit = document.createElement("select");
    fit.id = "cover-image-fit";
    for (const [value, text] of [
      ["cover", "Fill cover"],
      ["contain", "Fit image"],
    ]) {
      const o = el("option", "", text);
      o.value = value;
      fit.append(o);
    }
    fitLabel.append(fit);
    crop.append(fitLabel);
    const cropInputs = {};
    for (const [key, labelText, min, max, step] of [
      ["zoom", "Zoom", 1, 2, 0.05],
      ["x", "Horizontal position", 0, 100, 1],
      ["y", "Vertical position", 0, 100, 1],
    ]) {
      const l = el("label", "field", labelText),
        i = document.createElement("input");
      i.type = "range";
      i.min = min;
      i.max = max;
      i.step = step;
      i.id = "cover-crop-" + key;
      cropInputs[key] = i;
      l.append(i);
      crop.append(l);
      i.addEventListener("input", () => {
        if (coverArt) {
          coverArt[key] = Number(i.value);
          h.preview();
        }
      });
    }
    fit.addEventListener("change", () => {
      if (coverArt) {
        coverArt.fit = fit.value;
        syncCover();
        h.preview();
      }
    });
    crop.append(
      button("reset-cover-crop", "Reset crop", () => {
        if (coverArt) {
          Object.assign(coverArt, { fit: "cover", zoom: 1, x: 50, y: 50 });
          syncCover();
          h.preview();
        }
      }),
    );
    const titleDetails = el("div", "cover-title-controls"),
      titleInput = document.createElement("input");
    titleInput.id = "cover-title-text";
    titleInput.maxLength = 60;
    titleInput.type = "text";
    const titleLabel = el("label", "field", "Cover title");
    titleLabel.append(titleInput);
    const subtitleLabel = el("label", "field", "Subtitle"),
      subtitle = document.createElement("input");
    subtitle.id = "cover-subtitle";
    subtitle.type = "text";
    subtitle.maxLength = 60;
    subtitleLabel.append(subtitle);
    subtitle.addEventListener("input", () => {
      coverDraft.subtitle = subtitle.value;
      h.preview();
    });
    titleDetails.append(titleLabel);
    const titleFields = {};
    for (const [key, text, values] of [
      ["position", "Position", ["top", "center", "bottom"]],
      ["align", "Alignment", ["left", "center", "right"]],
      ["size", "Text size", ["small", "medium", "large"]],
    ]) {
      const l = el("label", "field", text),
        s = document.createElement("select");
      s.id = "cover-title-" + key;
      values.forEach((value) => {
        const o = el("option", "", value[0].toUpperCase() + value.slice(1));
        o.value = value;
        s.append(o);
      });
      l.append(s);
      titleFields[key] = s;
      titleDetails.append(l);
      s.addEventListener("change", () => {
        coverDraft.title[key] = s.value;
        if (key === "position") {
          readableTitle();
          syncCover();
        }
        h.preview();
      });
    }
    const colorLabel = el("label", "field", "Title color"),
      color = document.createElement("input");
    color.type = "color";
    color.id = "cover-title-color";
    colorLabel.append(color);
    const coverBackgrounds = {
      classic: ["#34465c", "#1e2c3a"],
      poke: ["#c94b58", "#eee5e1"],
      great: ["#35699d", "#eceeea"],
      ultra: ["#242a31", "#e7e3d7"],
      master: ["#805c9f", "#ece9ef"],
      premier: ["#eeeeec", "#eeeeec"],
    };
    function titleContrast(a, b) {
      const luminance = (hex) => {
        const rgb = hex
          .match(/[0-9a-f]{2}/gi)
          .map((n) => parseInt(n, 16) / 255)
          .map((n) =>
            n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
          );
        return rgb.reduce(
          (sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i],
          0,
        );
      };
      const x = luminance(a),
        y = luminance(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function readableTitle(force = false) {
      const palette = coverBackgrounds[coverDraft.theme];
      if (!palette) {
        if (force) coverDraft.title.color = "#ffffff";
        return;
      }
      const background = palette[coverDraft.title.position === "top" ? 0 : 1];
      if (force || titleContrast(coverDraft.title.color, background) < 4.5)
        coverDraft.title.color =
          titleContrast("#ffffff", background) >
          titleContrast("#29313b", background)
            ? "#ffffff"
            : "#29313b";
    }
    const contrast = button("cover-title-contrast", "Auto color", () => {
      readableTitle(true);
      syncCover();
      h.preview();
    });
    colorLabel.classList.add("cover-color-quick");
    colorLabel.append(contrast);
    titleDetails.append(colorLabel);
    const visibleLabel = el("label", "cover-title-visible"),
      visible = document.createElement("input");
    visible.type = "checkbox";
    visible.id = "cover-title-visible";
    visibleLabel.append(visible, el("span", "", "Show title"));
    titleDetails.append(visibleLabel);
    titleInput.addEventListener("input", () => {
      coverDraft.title.text = titleInput.value;
      h.preview();
    });
    color.addEventListener("input", () => {
      coverDraft.title.color = color.value;
      h.preview();
    });
    visible.addEventListener("change", () => {
      coverDraft.title.visible = visible.checked;
      h.preview();
    });
    body.append(uploadLabel, remove, error, crop);
    uploadGroup.append(body);
    const presets = el("div", "cover-setting-section");
    presets.id = "cover-presets-settings";
    presets.append(el("summary", "", "Cover presets"), $("cover-options"));
    const textSettings = el("div", "cover-setting-section");
    textSettings.id = "cover-text-settings";
    textSettings.append(el("summary", "", "Text"), titleDetails);
    uploadGroup.classList.add("cover-setting-section");
    design.querySelector(".customizer-kicker")?.remove();
    design.replaceChildren(presets, textSettings, uploadGroup);
    function groupTitle(title, nodes) {
      const group = el("fieldset", "cover-text-group");
      group.append(el("legend", "", title), ...nodes);
      return group;
    }
    const colorGroup = el("div", "cover-color-field");
    colorGroup.append(colorLabel, contrast);
    titleDetails.replaceChildren(
      groupTitle("Title", [titleLabel, visibleLabel, subtitleLabel]),
      groupTitle("Position", [
        titleFields.position.parentElement,
        titleFields.align.parentElement,
      ]),
      groupTitle("Style", [titleFields.size.parentElement, colorGroup]),
    );
    const pageSettings = el("div", "cover-setting-section");
    pageSettings.id = "binder-page-settings";
    pageSettings.append(el("summary", "", "Page appearance"));
    const pageBody = el("div", "binder-setting-grid"),
      backgroundLabel = el("label", "field", "Page color"),
      background = document.createElement("input"),
      borderLabel = el("label", "field", "Pocket borders"),
      borders = document.createElement("select");
    const appearanceScope = document.createElement("select"), scopeLabel = el("label", "field", "Apply to"),
      scopeNote = el("p", "panel-hint");
    appearanceScope.id = "page-appearance-scope";
    for (const [value, label] of [["page", "This page"], ["all", "All pages"]]) {
      const option = el("option", "", label); option.value = value; appearanceScope.append(option);
    }
    scopeLabel.append(appearanceScope);
    pageSettings.append(scopeLabel);
    const pageEdits = new Map();
    let allAppearance;
    appearanceScope.addEventListener("change", () => { syncPageStyle(); h.preview(); });
    function appearanceValue() {
      const page = h.page();
      if (appearanceScope.value === "all") return allAppearance !== undefined ? allAppearance : coverDraft.pageStyle;
      if (pageEdits.has(page.id)) return pageEdits.get(page.id) || (allAppearance !== undefined ? allAppearance : coverDraft.pageStyle);
      return allAppearance !== undefined ? allAppearance : page.pageStyle || coverDraft.pageStyle;
    }
    function stageAppearance(value) {
      if (appearanceScope.value === "all") { allAppearance = value; pageEdits.clear(); }
      else pageEdits.set(h.page().id, value);
    }
    function syncPageStyle() {
      const value = appearanceValue();
      background.value = value?.background || "#24262e";
      borders.value = value?.pockets || "none";
      $("reset-page-appearance").textContent = appearanceScope.value === "all" ? "Reset all pages" : "Use binder default";
      scopeNote.textContent = appearanceScope.value === "all"
        ? "Replaces individual page styles. New pages inherit this default."
        : "Page " + (h.state.document.pages.findIndex(p => p.id === h.page().id) + 1) + " only";
    }
    function designDocument(theme) {
      const cover = coverValue(theme);
      if (allAppearance === null) delete cover.pageStyle;
      else if (allAppearance !== undefined) cover.pageStyle = allAppearance;
      const pages = h.state.document.pages.map(page => {
        const result = { ...page };
        if (allAppearance !== undefined) delete result.pageStyle;
        if (pageEdits.has(page.id)) {
          const style = pageEdits.get(page.id);
          if (style === null) delete result.pageStyle;
          else result.pageStyle = style;
        }
        return result;
      });
      return { ...h.state.document, cover, pages };
    }
    background.type = "color";
    background.id = "binder-page-color";
    borders.id = "binder-pocket-borders";
    for (const value of ["none", "subtle", "defined"]) {
      const option = el("option", "", value[0].toUpperCase() + value.slice(1));
      option.value = value;
      borders.append(option);
    }
    backgroundLabel.append(background);
    borderLabel.append(borders);
    pageBody.append(backgroundLabel, borderLabel,
      button("reset-page-appearance", "Reset", () => {
        stageAppearance(null);
        syncCover();
        h.preview();
      }, "button secondary"));
    function updatePageStyle() {
      stageAppearance({ background: background.value, pockets: borders.value });
      h.preview();
    }
    background.addEventListener("input", updatePageStyle);
    borders.addEventListener("change", updatePageStyle);
    pageSettings.append(pageBody, scopeNote);

    const savedSettings = el("div", "cover-setting-section");
    savedSettings.id = "binder-saved-designs";
    savedSettings.append(el("summary", "", "Reusable design"));
    const designActions = el("div", "binder-setting-grid"),
      designStatus = el("p", "panel-hint"),
      designFile = document.createElement("input");
    designStatus.id = "binder-design-status";
    designStatus.setAttribute("role", "status");
    designFile.id = "binder-design-file";
    designFile.type = "file";
    designFile.accept = ".json,application/json";
    designFile.hidden = true;
    designActions.append(
      button("save-binder-design", "Download design", () => {
        try {
          const value = window.BinderSchema.cover(designDocument(coverDraft.theme).cover);
          const url = URL.createObjectURL(new Blob([JSON.stringify({
            format: "binder-minder-design", version: 1, cover: value,
          }, null, 2)], { type: "application/json" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "binder-minder-design.json";
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          designStatus.textContent = "Design downloaded. Artwork is included; cards are not.";
        } catch (e) { designStatus.textContent = e.message; }
      }, "button secondary"),
      button("load-binder-design", "Load design", () => designFile.click(), "button secondary"),
    );
    let designToken = 0;
    designFile.addEventListener("change", async () => {
      const file = designFile.files[0], token = ++designToken;
      coverToken++;
      input.disabled = false;
      if (!file) return;
      try {
        if (file.size > window.BinderSchema.limits.encodedImageChars + 10000)
          throw Error("Choose a design file smaller than 660 KB.");
        const value = JSON.parse(await file.text());
        if (token !== designToken) return;
        if (!value || value.format !== "binder-minder-design" || value.version !== 1)
          throw Error("Choose a Binder Minder design file.");
        coverDraft = window.BinderSchema.cover(value.cover);
        coverArt = coverDraft.artwork ? structuredClone(coverDraft.artwork) : null;
        ensureTitle();
        h.coverTheme(coverDraft.theme);
        syncCover();
        designStatus.textContent = "Design loaded for preview. Apply to use it.";
        h.preview();
      } catch (e) {
        if (token === designToken) designStatus.textContent = e.message;
      } finally { designFile.value = ""; }
    });
    savedSettings.append(designActions, designFile, designStatus,
      el("p", "panel-hint", "Design files contain your cover artwork. Keep private designs safe."));
    design.append(pageSettings, savedSettings);
    const settingSections = [presets, textSettings, uploadGroup, pageSettings, savedSettings];
    const sectionButtons = el("div", "binder-section-buttons");
    sectionButtons.id = "binder-customization-options";
    sectionButtons.setAttribute("role", "group");
    sectionButtons.setAttribute("aria-label", "Binder customization options");
    let activeSection = presets;
    const choices = [
      [presets, "Cover", "Cover presets", "M5 3h14v18H5zM8 3v18"],
      [textSettings, "Text", "Cover text", "M4 5h16M12 5v15M8 20h8"],
      [uploadGroup, "Artwork", "Cover artwork", "M3 3h18v18H3zM3 16l5-5 4 4 3-3 6 6M14 7h2"],
      [pageSettings, "Pages", "Page appearance", "M4 4h16v16H4zM4 9h16M9 4v16"],
      [savedSettings, "Designs", "Reusable designs", "M4 3h14l3 3v15H4zM8 3v6h9V3M8 21v-8h9v8"],
    ];
    for (const [section, labelText, name, path] of choices) {
      section.querySelector("summary")?.remove();
      const control = button("binder-option-" + section.id, labelText,
        () => selectBinderSection(section), "binder-section-button");
      const symbol = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      symbol.setAttribute("class", "ui-symbol");
      symbol.setAttribute("viewBox", "0 0 24 24");
      symbol.setAttribute("aria-hidden", "true");
      const outline = document.createElementNS(symbol.namespaceURI, "path");
      outline.setAttribute("d", path);
      symbol.append(outline);
      control.prepend(symbol);
      control.setAttribute("aria-label", name);
      control.setAttribute("aria-controls", section.id);
      control.title = name;
      section.setAttribute("role", "region");
      section.setAttribute("aria-labelledby", control.id);
      sectionButtons.append(control);
    }
    $("cover-customizer").insertBefore(sectionButtons, document.querySelector(".customizer-design-body"));
    function selectBinderSection(section, preview = true) {
      activeSection = section;
      settingSections.forEach((item, index) => {
        item.hidden = item !== section;
        sectionButtons.children[index].setAttribute("aria-pressed", String(item === section));
      });
      document.querySelector(".customizer-design-body").scrollTop = 0;
      if (preview) h.preview();
    }
    input.addEventListener("change", async () => {
      const token = ++coverToken,
        file = input.files[0];
      designToken++;
      if (!file) return;
      error.textContent = "";
      input.disabled = true;
      try {
        const art = await window.BinderMedia.upload(file);
        if (token !== coverToken) return;
        coverArt = art;
        coverDraft.theme = "custom";
        h.coverTheme("custom");
        syncCover();
        h.preview();
      } catch (e) {
        if (token === coverToken) error.textContent = e.message;
      } finally {
        if (token === coverToken) input.disabled = false;
      }
    });
    function beginCover() {
      coverToken++;
      designToken++;
      designStatus.textContent = "";
      pageEdits.clear();
      allAppearance = undefined;
      appearanceScope.value = "page";

      input.disabled = false;
      input.value = "";
      error.textContent = "";
      coverDraft = structuredClone(
        h.state.document.cover || { theme: "classic" },
      );
      coverArt = coverDraft.artwork
        ? structuredClone(coverDraft.artwork)
        : null;
      ensureTitle();
      selectBinderSection(presets, false);
      syncCover();
    }
    function ensureTitle() {
      coverDraft.title = {
        text: h.state.document.name,
        visible: true,
        position: "bottom",
        align: "center",
        size: "medium",
        color: ["classic", "custom"].includes(coverDraft.theme)
          ? "#ffffff"
          : "#29313b",
        ...coverDraft.title,
      };
    }
    function syncCover() {
      const custom = coverDraft.theme === "custom" && !!coverArt;
      crop.hidden = !custom;
      remove.hidden = !custom;
      if (custom) {
        fit.value = coverArt.fit;
        for (const key of Object.keys(cropInputs)) {
          cropInputs[key].value = coverArt[key];
          cropInputs[key].disabled = coverArt.fit === "contain";
        }
      }
      subtitle.value = coverDraft.subtitle ?? "POK\u00c9MON COLLECTION";
      background.value = coverDraft.pageStyle?.background || "#24262e";
      borders.value = coverDraft.pageStyle?.pockets || "none";
      syncPageStyle();
      titleInput.value = coverDraft.title.text;
      color.value = coverDraft.title.color;
      visible.checked = coverDraft.title.visible;
      for (const key of Object.keys(titleFields))
        titleFields[key].value = coverDraft.title[key];
    }
    function coverValue(theme) {
      return {
        ...coverDraft,
        theme,
        ...(theme === "custom" ? { artwork: coverArt } : {}),
      };
    }
    function coverPreset(theme) {
      coverDraft.theme = theme;
      readableTitle();
      syncCover();
    }
    function endCover() {
      coverToken++;
      designToken++;
      input.disabled = false;
    }
    // Crop controls with no effect in Fit mode are disabled together.
    const reset = button("reset-artwork-crop", "Reset crop", () =>
      h.resetPocketCrop(),
    );
    $("artwork-crop-controls").append(reset);
    return {
      refresh,
      inspect,
      beginCover,
      coverValue,
      coverPreset,
      endCover,
      pageSVG,
      showPages: () => activeSection === pageSettings,
      syncPageStyle,
      designDocument,
      appearancePatch: () => ({ all: allAppearance, pages: [...pageEdits] }),
      appearanceDirty: () => allAppearance !== undefined || pageEdits.size > 0,
    };
  }
  window.EditorStudio = { init };
})();
