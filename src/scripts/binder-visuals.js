(() => {
  "use strict";
  const cards =
    window.CardCatalogue?.byId ||
    new Map(window.CARDS.map((c) => [c.id || c.collectorNumber, c]));
  const palettes = {
    poke: ["#cf5965", "#f2ece5", "#30313a"],
    great: ["#447fb9", "#edf1ef", "#d85d6a"],
    ultra: ["#30343c", "#efdfb2", "#d2ad50"],
    master: ["#8b69af", "#eeeaf4", "#db9bb7"],
    premier: ["#eeeae5", "#eeeae5", "#c55b65"],
    clear: ["#9aafc6", "#c8d9e3", "#a5b8c8"],
  };
  const name = (c) =>
    c?.kind === "artwork"
      ? c.name || "Artwork"
      : c?.kind === "placeholder"
        ? cards.get(c.cardId)?.name
          ? cards.get(c.cardId).name + " placeholder"
          : "Reserved pocket"
        : cards.get(c?.cardId)?.name || "Card";
  let frameSequence = 0;
  function append(svg, c, w, h, defaults = {}, clipId = "", node) {
    if (!c || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
      return;
    const make =
      node ||
      ((tag, attrs = {}) => {
        const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (const [k, v] of Object.entries(attrs))
          n.setAttribute(k, String(v));
        return n;
      });
    const group = make(
      "g",
      clipId ? { "clip-path": "url(#" + clipId + ")" } : {},
    );
    svg.append(group);
    if (c.kind === "artwork") {
      const scale =
        (c.fit === "contain"
          ? Math.min(w / c.width, h / c.height)
          : Math.max(w / c.width, h / c.height)) *
        (c.fit === "contain" ? 1 : c.zoom);
      const iw = c.width * scale,
        ih = c.height * scale;
      const image = make("image", {
        href: c.src,
        x: ((w - iw) * c.x) / 100,
        y: ((h - ih) * c.y) / 100,
        width: iw,
        height: ih,
        preserveAspectRatio: "none",
      });
      image.addEventListener("error", () => {
        image.remove();
        const text = make("text", {
          x: w / 2,
          y: h / 2,
          "text-anchor": "middle",
          fill: "var(--muted)",
          "font-size": Math.min(12, w * 0.1),
        });
        text.textContent = "Image unavailable";
        group.append(text);
      });
      group.append(image);
      return;
    }
    if (c.kind === "placeholder") {
      const palette = c.style === "soft" ? "var(--soft)" : "var(--surface)";
      const edge = Math.min(2, w * 0.1, h * 0.1);
      const inset = Math.min(8, w * 0.1, h * 0.1);
      group.append(
        make("rect", {
          x: edge,
          y: edge,
          width: w - 2 * edge,
          height: h - 2 * edge,
          rx: 5,
          fill: palette,
          stroke: "var(--muted)",
          "stroke-dasharray": "5 5",
          opacity: 0.7,
        }),
      );
      const data = cards.get(c.cardId);
      if (data)
        group.append(
          make("image", {
            href: data.imageUrl,
            x: inset,
            y: inset,
            width: w - 2 * inset,
            height: h - 2 * inset,
            preserveAspectRatio: "xMidYMid meet",
            opacity: 0.16,
          }),
        );
      if (c.style === "ball") {
        group.append(
          make("circle", {
            cx: w / 2,
            cy: h / 2 - 5,
            r: Math.min(w, h) * 0.14,
            fill: "none",
            stroke: "var(--muted)",
            "stroke-width": 2,
          }),
        );
        group.append(
          make("path", {
            d:
              "M" +
              (w / 2 - Math.min(w, h) * 0.14) +
              " " +
              (h / 2 - 5) +
              "h" +
              Math.min(w, h) * 0.28,
            stroke: "var(--muted)",
            "stroke-width": 2,
          }),
        );
      }
      const text = make("text", {
        x: w / 2,
        y: h * 0.72,
        "text-anchor": "middle",
        fill: "var(--muted)",
        "font-size": Math.min(12, w * 0.1),
      });
      text.textContent = "Reserved";
      group.append(text);
      return;
    }
    const card = cards.get(c.cardId);
    if (!card) return;
    const frames = c.frames || defaults || {},
      pad =
        Math.min(w, h) *
        (frames.toploader && frames.toploader !== "none"
          ? 0.11
          : frames.sleeve && frames.sleeve !== "none"
            ? 0.075
            : 0);
    const iw = Math.min(w - 2 * pad, ((h - 2 * pad) * 245) / 337),
      ih = (iw * 337) / 245,
      x = (w - iw) / 2,
      y = (h - ih) / 2;

    // Match the landing page's Ball-gradient rims and translucent rigid case.
    const stops = {
      poke: [
        [0, "#c84351"],
        [0.45, "#c84351"],
        [0.45, "#252734"],
        [0.55, "#252734"],
        [0.55, "#e5e9ed"],
        [1, "#e5e9ed"],
      ],
      great: [
        [0, "#c84351"],
        [0.3, "#355eac"],
        [0.45, "#355eac"],
        [0.45, "#252734"],
        [0.55, "#252734"],
        [0.55, "#e5e9ed"],
        [1, "#e5e9ed"],
      ],
      ultra: [
        [0, "#d3b558"],
        [0.3, "#252734"],
        [0.45, "#252734"],
        [0.45, "#d3b558"],
        [0.55, "#d3b558"],
        [0.55, "#e5e9ed"],
        [1, "#e5e9ed"],
      ],
      master: [
        [0, "#c787b9"],
        [0.3, "#7460a4"],
        [0.45, "#7460a4"],
        [0.45, "#252734"],
        [0.55, "#252734"],
        [0.55, "#e5e9ed"],
        [1, "#e5e9ed"],
      ],
      premier: [
        [0, "#edf0f2"],
        [0.45, "#edf0f2"],
        [0.45, "#c84351"],
        [0.55, "#c84351"],
        [0.55, "#edf0f2"],
        [1, "#edf0f2"],
      ],
      clear: [
        [0, "#c4d8ed"],
        [0.5, "#edf5fc"],
        [1, "#9db5ce"],
      ],
    };
    function rim(style, inset, thickness, rigid) {
      const id = "ball-rim-" + ++frameSequence;
      const defs = make("defs"),
        gradient = make("linearGradient", {
          id,
          x1: "0%",
          y1: "0%",
          x2: style === "poke" || style === "premier" ? "0%" : "100%",
          y2: "100%",
        });
      for (const [offset, color] of stops[style] || stops.clear)
        gradient.append(
          make("stop", { offset: offset * 100 + "%", "stop-color": color }),
        );
      defs.append(gradient);
      group.append(defs);
      const bx = x - inset,
        by = y - inset,
        bw = iw + 2 * inset,
        bh = ih + 2 * inset;
      group.append(
        make("rect", {
          x: bx,
          y: by,
          width: bw,
          height: bh,
          rx: Math.min(w, h) * 0.025,
          fill: rigid ? "#a9c4e0" : "var(--surface)",
          "fill-opacity": rigid ? 0.13 : 1,
          stroke: "url(#" + id + ")",
          "stroke-width": thickness,
        }),
      );
      if (rigid) {
        group.append(
          make("rect", {
            x: bx + thickness * 1.4,
            y: by + thickness * 1.4,
            width: Math.max(0, bw - thickness * 2.8),
            height: Math.max(0, bh - thickness * 2.8),
            rx: 3,
            fill: "none",
            stroke: "#d4e5fc",
            "stroke-opacity": 0.45,
            "stroke-width": thickness * 0.65,
          }),
        );
        group.append(
          make("path", {
            d:
              "M" +
              (bx + thickness * 2) +
              " " +
              (by + thickness * 2) +
              "H" +
              (bx + bw - thickness * 2),
            stroke: "#eef6ff",
            "stroke-width": thickness * 0.55,
            opacity: 0.65,
          }),
        );
      }
    }
    if (frames.toploader && frames.toploader !== "none")
      rim(
        frames.toploader,
        pad * 0.8,
        Math.max(1, Math.min(w, h) * 0.025),
        true,
      );
    if (frames.sleeve && frames.sleeve !== "none")
      rim(
        frames.sleeve,
        Math.min(w, h) * 0.035,
        Math.max(1, Math.min(w, h) * 0.012),
        false,
      );
    const image = make("image", {
      href: card.imageUrl,
      x,
      y,
      width: iw,
      height: ih,
      preserveAspectRatio: "xMidYMid meet",
    });
    image.addEventListener("error", () => {
      image.remove();
      const text = make("text", {
        x: w / 2,
        y: h / 2,
        "text-anchor": "middle",
        fill: "var(--muted)",
        "font-size": 10,
      });
      text.textContent = card.name;
      group.append(text);
    });
    group.append(image);
  }
  window.BinderVisuals = {
    name,
    append,
    palettes,
    isCard: (c) => !!c && !c.kind && !!c.cardId,
  };
})();
