(() => {
  "use strict";
  const themes = [
    ["classic", "Classic"],
    ["transparent", "Transparent"],
    ["poke", "Poké Ball"],
    ["great", "Great Ball"],
    ["ultra", "Ultra Ball"],
    ["master", "Master Ball"],
    ["premier", "Premier Ball"],
  ].map(([id, name]) => ({ id, name }));
  let previewSequence = 0;
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  function create(value = "classic", name = "My binder", documentValue = null) {
    const cover =
      typeof value === "string"
        ? { theme: value }
        : value || { theme: "classic" };
    const theme = cover.theme || "classic";
    const book = make("div", "binder-cover-art cover-" + theme);
    book.setAttribute("aria-hidden", "true");
    if (theme === "transparent") {
      const doc = documentValue?.document || documentValue;
      const page = Array.isArray(doc?.pages) ? doc.pages[0] : null;
      const rows = page?.rows || doc?.rows || 3,
        columns = page?.columns || doc?.columns || 3;
      const regions =
        page?.regions ||
        Array.from({ length: rows * columns }, (_, i) => ({
          cells: [[Math.floor(i / columns), i % columns]],
          content: doc?.cards?.[i] ? { cardId: doc.cards[i] } : null,
        }));
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const cw = 80,
        ch = (80 * 337) / 245,
        gap = 5;
      svg.setAttribute(
        "viewBox",
        "0 0 " + (columns * (cw + gap) - gap) + " " + (rows * (ch + gap) - gap),
      );
      for (const region of regions) {
        const xs = region.cells.map((c) => c[1]),
          ys = region.cells.map((c) => c[0]);
        const group = document.createElementNS(svg.namespaceURI, "svg");
        const width =
          (Math.max(...xs) - Math.min(...xs) + 1) * (cw + gap) - gap;
        const height =
          (Math.max(...ys) - Math.min(...ys) + 1) * (ch + gap) - gap;
        group.setAttribute("x", Math.min(...xs) * (cw + gap));
        group.setAttribute("y", Math.min(...ys) * (ch + gap));
        group.setAttribute("width", width);
        group.setAttribute("height", height);
        group.setAttribute("viewBox", "0 0 " + width + " " + height);
        const clipId = "transparent-pocket-" + ++previewSequence;
        const geometry = window.BinderGeometry(region.cells, cw, ch, gap);
        const clip = document.createElementNS(svg.namespaceURI, "clipPath");
        clip.id = clipId;
        for (const box of geometry.rects) {
          const tile = document.createElementNS(svg.namespaceURI, "rect");
          for (const [key, value] of Object.entries(box))
            tile.setAttribute(key, value);
          clip.append(tile);
        }
        const defs = document.createElementNS(svg.namespaceURI, "defs");
        defs.append(clip);
        group.append(defs);
        const rect = document.createElementNS(svg.namespaceURI, "rect");
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", "var(--soft)");
        rect.setAttribute("clip-path", "url(#" + clipId + ")");
        group.append(rect);
        if (region.content && window.BinderVisuals)
          window.BinderVisuals.append(
            group,
            region.content,
            width,
            height,
            doc?.frames,
            clipId,
            (tag, attrs = {}) => {
              const n = document.createElementNS(svg.namespaceURI, tag);
              for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
              return n;
            },
          );
        svg.append(group);
      }
      book.append(svg);
      return book;
    }

    book.append(
      make("span", "cover-spine"),
      make("span", "cover-stripe"),
      make("span", "cover-mark", theme === "master" ? "M" : ""),
    );
    const seal = make("span", "cover-seal");
    seal.append(make("span", "cover-seal-core"));
    book.append(seal);
    const title = make("div", "cover-book-title");
    title.append(
      make("span", "", "POKÉMON COLLECTION"),
      make("strong", "", name),
    );
    book.append(title);
    if (theme === "custom" && cover.artwork) {
      const a = cover.artwork,
        image = make("img", "cover-custom-image");
      image.src = a.src;
      image.alt = "";
      image.style.objectFit = a.fit;
      image.style.objectPosition = a.x + "% " + a.y + "%";
      image.style.transform =
        "scale(" + (a.fit === "contain" ? 1 : a.zoom) + ")";
      const wrap = make("div", "cover-custom-image-wrap");
      wrap.append(image);
      book.prepend(wrap);
      image.addEventListener("error", () => {
        image.remove();
        wrap.append(make("span", "cover-image-error", "Image unavailable"));
      });
      book.classList.add("has-custom-art");
    }
    if (cover.title) {
      const t = cover.title;
      title.hidden = !t.visible;
      title.querySelector("strong").textContent = t.text || name;
      title.style.color = t.color;
      title.style.textAlign = t.align;
      title.dataset.position = t.position;
      title.dataset.size = t.size;
    }
    return book;
  }
  window.BinderCovers = {
    themes,
    create,
    name: (id) =>
      id === "custom"
        ? "Custom artwork"
        : themes.find((t) => t.id === id)?.name || "Classic",
  };
})();
