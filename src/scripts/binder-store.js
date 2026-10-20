/* Explicit local saves for the frontend prototype. Never stores editor drafts. */
(() => {
  "use strict";
  const key = "pokedex.workspace.v1",
    copy = (value) => JSON.parse(JSON.stringify(value));
  const known =
    window.CardCatalogue?.byId ||
    new Set(window.CARDS.map((c) => c.id || c.collectorNumber));
  const metadata =
    window.CardCatalogue?.byId ||
    new Map(window.CARDS.map((c) => [c.id || c.collectorNumber, c]));
  function validate(input) {
    const doc = input?.format === "pokedex-binder" ? input.document : input;
    if (
      !doc ||
      typeof doc.name !== "string" ||
      !doc.name.trim() ||
      doc.name.length > 60 ||
      !Array.isArray(doc.pages) ||
      doc.pages.length < 1 ||
      doc.pages.length > 30 ||
      !Array.isArray(doc.overflow) ||
      doc.overflow.length > window.BinderSchema.limits.overflowItems
    )
      throw Error(
        "Invalid binder file. Expected a name, 1–30 pages, and an overflow list.",
      );
    const cover =
      doc.cover === undefined
        ? undefined
        : window.BinderSchema.cover(doc.cover);
    const ids = new Set();
    const identifier = (value) => {
      if (!window.BinderSchema.validIdentifier(value) || ids.has(value))
        throw Error("Invalid or duplicate binder item identifier.");
      ids.add(value);
      return value;
    };
    let artworkSize = cover?.artwork?.src.length || 0;
    const frames = window.BinderSchema.frames;
    const content = (value) => {
      if (value === null) return null;
      if (value?.kind === "artwork") {
        if (!window.BinderSchema.validImage(value))
          throw Error("Invalid artwork or image crop.");
        artworkSize += value.src.length;
        if (artworkSize > window.BinderSchema.limits.artworkChars)
          throw Error(
            "Binder artwork exceeds the local prototype storage limit.",
          );
        return {
          id: identifier(value.id),
          kind: "artwork",
          src: value.src,
          name: value.name,
          width: value.width,
          height: value.height,
          fit: value.fit,
          zoom: value.zoom,
          x: value.x,
          y: value.y,
        };
      }
      if (value?.kind === "placeholder") {
        if (
          (value.cardId && !known.has(value.cardId)) ||
          !["outline", "soft", "ball"].includes(value.style)
        )
          throw Error("Invalid placeholder printing or style.");
        return {
          id: identifier(value.id),
          kind: "placeholder",
          style: value.style,
          ...(value.cardId ? { cardId: value.cardId } : {}),
        };
      }
      if (value?.kind !== undefined)
        throw Error("Invalid pocket content type.");
      if (!value || !known.has(value.cardId))
        throw Error(
          "This file contains cards outside the available catalogue.",
        );
      if (
        value.variant &&
        !["normal", "reverse", "holo", "firstEdition"].includes(value.variant)
      )
        throw Error("Invalid card finish.");
      if (
        value.variant &&
        metadata.get(value.cardId)?.variants &&
        !metadata.get(value.cardId).variants[value.variant]
      )
        throw Error("This finish is unavailable for the selected card.");
      return {
        id: identifier(value.id),
        cardId: value.cardId,
        ...(value.variant ? { variant: value.variant } : {}),
        ...(value.frames !== undefined ? { frames: frames(value.frames) } : {}),
      };
    };
    const pages = doc.pages.map((p) => {
      if (
        !p ||
        ![p.rows, p.columns].every(
          (n) => Number.isInteger(n) && n >= 1 && n <= 6,
        ) ||
        !Array.isArray(p.regions) ||
        p.regions.length < 1 ||
        p.regions.length > 36
      )
        throw Error("Invalid page layout. Rows and columns must be 1–6.");
      const pid = identifier(p.id),
        occupied = new Set();
      const regions = p.regions.map((r) => {
        if (!r || typeof r !== "object") throw Error("Invalid pocket region.");
        const rid = identifier(r.id);
        if (!Array.isArray(r.cells) || !r.cells.length || r.cells.length > 36)
          throw Error("Invalid pocket cells.");
        const cells = r.cells.map((cell) => {
          if (
            !Array.isArray(cell) ||
            cell.length !== 2 ||
            !cell.every(Number.isInteger) ||
            cell[0] < 0 ||
            cell[1] < 0 ||
            cell[0] >= p.rows ||
            cell[1] >= p.columns ||
            occupied.has(cell.join(","))
          )
            throw Error("Pocket cells overlap or fall outside their page.");
          occupied.add(cell.join(","));
          return [...cell];
        });
        if (!window.BinderSchema.connected(cells))
          throw Error("Merged pocket cells must connect along an edge.");
        return { id: rid, cells, content: content(r.content) };
      });
      if (occupied.size !== p.rows * p.columns)
        throw Error("Page contains missing pockets.");
      return { id: pid, rows: p.rows, columns: p.columns, regions };
    });
    return {
      name: doc.name.trim(),
      ...(cover ? { cover } : {}),
      ...(doc.frames !== undefined ? { frames: frames(doc.frames) } : {}),
      pages,
      overflow: doc.overflow.map(content).map((c) => {
        if (!c) throw Error("Overflow cannot contain empty items.");
        return c;
      }),
    };
  }
  const samples = () =>
    (window.SAMPLE_BINDERS || []).map((b) => ({ ...copy(b), revision: 0 }));
  function read() {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch {
      throw Error(
        "Browser storage is unavailable. Download a backup to keep your work.",
      );
    }
    if (!raw) return samples();
    try {
      const data = JSON.parse(raw);
      if (
        data.version !== 1 ||
        !Array.isArray(data.binders) ||
        data.binders.length > 3
      )
        throw Error();
      const ids = new Set();
      return data.binders.map((b) => {
        if (
          !b ||
          !window.BinderSchema.validIdentifier(b.id) ||
          ids.has(b.id) ||
          typeof b.name !== "string" ||
          !b.name.trim() ||
          b.name.length > 60 ||
          !Array.isArray(b.cards) ||
          !Number.isSafeInteger(b.revision) ||
          b.revision < 0 ||
          ![b.rows, b.columns].every(
            (n) => Number.isInteger(n) && n >= 1 && n <= 6,
          ) ||
          !Number.isInteger(b.pages) ||
          b.pages < 1 ||
          b.pages > 30 ||
          b.cards.length > 2000 ||
          !b.cards.every((id) => known.has(id))
        )
          throw Error();
        ids.add(b.id);
        return {
          ...copy(b),
          document: b.document ? validate(b.document) : undefined,
        };
      });
    } catch {
      throw Error(
        "Saved workspace data could not be read. It has not been overwritten. Restore a backup or explicitly reset the sample workspace.",
      );
    }
  }
  function write(binders) {
    if (binders.length > 3) throw Error("All three binder slots are in use.");
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, binders }));
    } catch {
      throw Error(
        "Local save failed. Browser storage may be full or unavailable. Download backup to keep your work.",
      );
    }
    return copy(binders);
  }
  function save(id, doc, expectedRevision) {
    if (!window.BinderSchema.validIdentifier(id))
      throw Error(
        "Invalid binder identifier. Reopen the binder from Workspace.",
      );
    const valid = validate(doc),
      binders = read(),
      index = binders.findIndex((b) => b.id === id);
    const prior = index < 0 ? null : binders[index];
    if ((prior?.revision ?? null) !== expectedRevision)
      throw Error(
        "This binder changed in another tab. Download your current backup, then reopen the binder before saving again.",
      );
    if (!prior && binders.length >= 3)
      throw Error(
        "All three binder slots are in use. Download backup or free a slot in Workspace.",
      );
    const first = valid.pages[0];
    const entry = {
      ...prior,
      id,
      name: valid.name,
      pages: valid.pages.length,
      rows: first.rows,
      columns: first.columns,
      cards: first.regions
        .filter((r) => r.content && !r.content.kind)
        .map((r) => r.content.cardId),
      style: prior?.style || "lavender",
      revision: (prior?.revision || 0) + 1,
      document: valid,
    };
    if (index < 0) binders.push(entry);
    else binders[index] = entry;
    write(binders);
    return entry;
  }
  window.BinderStore = {
    read,
    write,
    save,
    validate,
    reset: () => write(samples()),
  };
})();
