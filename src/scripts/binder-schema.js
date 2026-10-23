/* Shared, side-effect-free binder validation and limits. */
(() => {
  "use strict";
  const limits = Object.freeze({
    uploadBytes: 5 * 1024 * 1024,
    decodedPixels: 24000000,
    outputDimension: 1200,
    imageDimension: 1600,
    encodedImageChars: 650000,
    artworkChars: 1800000,
    importBytes: 8 * 1024 * 1024,
    overflowItems: 2000,
  });
  const frameValues = Object.freeze({
    sleeve: Object.freeze([
      "none",
      "poke",
      "great",
      "ultra",
      "master",
      "premier",
    ]),
    toploader: Object.freeze([
      "none",
      "clear",
      "poke",
      "great",
      "ultra",
      "master",
      "premier",
    ]),
  });
  function frames(value) {
    if (
      !value ||
      !frameValues.sleeve.includes(value.sleeve) ||
      !frameValues.toploader.includes(value.toploader)
    )
      throw Error("Invalid card frame styles.");
    return { sleeve: value.sleeve, toploader: value.toploader };
  }
  const validIdentifier = (value) =>
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
  function validImage(v) {
    return (
      !!v &&
      typeof v.src === "string" &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v.src) &&
      v.src.length <= limits.encodedImageChars &&
      [v.width, v.height].every(
        (n) => Number.isInteger(n) && n > 0 && n <= limits.imageDimension,
      ) &&
      ["cover", "contain"].includes(v.fit) &&
      [v.zoom, v.x, v.y].every(Number.isFinite) &&
      v.zoom >= 1 &&
      v.zoom <= 2 &&
      v.x >= 0 &&
      v.x <= 100 &&
      v.y >= 0 &&
      v.y <= 100 &&
      typeof v.name === "string" &&
      v.name.length <= 100
    );
  }
  function cover(value) {
    if (
      !value ||
      ![
        "classic",
        "transparent",
        "poke",
        "great",
        "ultra",
        "master",
        "premier",
        "custom",
      ].includes(value.theme)
    )
      throw Error("Invalid binder cover theme.");
    if (value.theme === "custom" && !validImage(value.artwork))
      throw Error("Choose a valid cover image and crop.");
    if (value.subtitle !== undefined &&
        (typeof value.subtitle !== "string" || value.subtitle.length > 60))
      throw Error("Keep the cover subtitle within 60 characters.");
    const appearance = value.pageStyle;
    if (appearance !== undefined && (!appearance ||
        !/^#[0-9a-f]{6}$/i.test(appearance.background) ||
        !["none", "subtle", "defined"].includes(appearance.pockets)))
      throw Error("Choose a valid page color and pocket border.");
    const title = value.title;
    if (
      title !== undefined &&
      (!title ||
        typeof title.text !== "string" ||
        title.text.length > 60 ||
        typeof title.visible !== "boolean" ||
        !["top", "center", "bottom"].includes(title.position) ||
        !["left", "center", "right"].includes(title.align) ||
        !["small", "medium", "large"].includes(title.size) ||
        !/^#[0-9a-f]{6}$/i.test(title.color))
    )
      throw Error("Invalid cover title settings.");
    return {
      theme: value.theme,
      ...(value.subtitle !== undefined ? { subtitle: value.subtitle } : {}),
      ...(appearance ? { pageStyle: {
        background: appearance.background, pockets: appearance.pockets,
      }} : {}),
      ...(value.theme === "custom"
        ? {
            artwork: {
              src: value.artwork.src,
              name: value.artwork.name,
              width: value.artwork.width,
              height: value.artwork.height,
              fit: value.artwork.fit,
              zoom: value.artwork.zoom,
              x: value.artwork.x,
              y: value.artwork.y,
            },
          }
        : {}),
      ...(title
        ? {
            title: {
              text: title.text,
              visible: title.visible,
              position: title.position,
              align: title.align,
              size: title.size,
              color: title.color,
            },
          }
        : {}),
    };
  }
  function rectangular(cells) {
    if (!cells.length) return false;
    const ys = cells.map(c => c[0]), xs = cells.map(c => c[1]);
    return new Set(cells.map(c => c.join(","))).size ===
      (Math.max(...ys) - Math.min(...ys) + 1) * (Math.max(...xs) - Math.min(...xs) + 1);
  }
  function connected(cells) {
    if (!cells.length) return false;
    const keys = new Set(cells.map((cell) => cell.join(",")));
    const seen = new Set(),
      queue = [cells[0]];
    while (queue.length) {
      const [y, x] = queue.pop(),
        key = y + "," + x;
      if (!keys.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push([y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]);
    }
    return seen.size === cells.length;
  }
  window.BinderSchema = Object.freeze({
    connected,
    rectangular,
    validIdentifier,
    limits,
    frameValues,
    frames,
    validImage,
    cover,
  });
})();
