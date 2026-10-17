/* Binder document operations. No storage or network side effects. */
(() => {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const id = () => crypto.randomUUID();
  const region = (cells) => ({ id: id(), cells, content: null });
  const page = (rows, columns) => ({
    id: id(),
    rows,
    columns,
    regions: Array.from({ length: rows * columns }, (_, i) =>
      region([[Math.floor(i / columns), i % columns]]),
    ),
  });
  function create(seed = {}) {
    const rows = Math.max(1, Math.min(6, Number(seed.rows) || 3)),
      columns = Math.max(1, Math.min(6, Number(seed.columns) || 3));
    const doc = {
      name: String(seed.name || "My binder").slice(0, 60),
      pages: Array.from(
        { length: Math.max(1, Math.min(30, Number(seed.pages) || 1)) },
        () => page(rows, columns),
      ),
      overflow: [],
    };
    (seed.cards || []).forEach((cardId, i) => {
      const content = { id: id(), cardId };
      if (i < rows * columns) doc.pages[0].regions[i].content = content;
      else doc.overflow.push(content);
    });
    let current = doc,
      saved = copy(doc),
      past = [],
      future = [];
    const findPage = (pid) => current.pages.find((p) => p.id === pid);
    const findRegion = (pid, rid) =>
      findPage(pid)?.regions.find((r) => r.id === rid);
    function insertionPath(pid, rid, direction) {
      const p = findPage(pid),
        start = findRegion(pid, rid);
      if (!p || !start || ![1, -1].includes(direction))
        throw Error("Choose a pocket and push direction.");
      if (start.cells.length !== 1)
        throw Error("Merged pockets cannot be shifted.");
      const [row, column] = start.cells[0],
        path = [];
      for (let col = column; col >= 0 && col < p.columns; col += direction) {
        const r = p.regions.find((r) =>
          r.cells.some(([y, x]) => y === row && x === col),
        );
        if (
          !r ||
          r.cells.length !== 1 ||
          (r.content && (r.content.kind || !r.content.cardId))
        )
          throw Error(
            "Push stops at merged pockets, artwork and reserved pockets. Choose another direction.",
          );
        path.push(r);
        if (!r.content) break;
      }
      return path;
    }
    function change(fn) {
      const before = copy(current);
      try {
        fn();
        if (current.overflow.length > window.BinderSchema.limits.overflowItems)
          throw Error(
            "Overflow is full. Clear unused items before moving more cards.",
          );
      } catch (error) {
        current = before;
        throw error;
      }
      if (JSON.stringify(before) !== JSON.stringify(current)) {
        past.push(before);
        if (past.length > 100) past.shift();
        future = [];
        return true;
      }
      return false;
    }
    function take(source) {
      if (source.kind === "catalogue")
        return {
          id: id(),
          cardId: source.cardId,
          ...(source.variant ? { variant: source.variant } : {}),
        };
      if (source.kind === "overflow") {
        const i = current.overflow.findIndex((c) => c.id === source.id);
        if (i < 0) throw Error("That item is no longer in overflow.");
        return current.overflow.splice(i, 1)[0];
      }
      const r = findRegion(source.pageId, source.regionId);
      if (!r?.content) throw Error("That pocket is now empty.");
      const c = r.content;
      r.content = null;
      return c;
    }
    function applyFramePatch(value, scope = "selection", pid, rids = []) {
      return change(() => {
        const valid = window.BinderSchema.frameValues;
        if (
          !value ||
          !Object.keys(value).length ||
          Object.keys(value).some((k) => !valid[k]?.includes(value[k]))
        )
          throw Error("Choose a card style first.");
        const effective = (c) => ({
          sleeve: "none",
          toploader: "none",
          ...(c.frames || current.frames),
        });
        const all = [
          ...current.pages.flatMap((p) => p.regions.map((r) => r.content)),
          ...current.overflow,
        ].filter((c) => c && !c.kind && c.cardId);
        if (scope === "binder") {
          const prior = {
            sleeve: "none",
            toploader: "none",
            ...current.frames,
          };
          all.forEach((c) => {
            c.frames = { ...effective(c), ...value };
          });
          current.frames = { ...prior, ...value };
          all.forEach((c) => {
            if (JSON.stringify(c.frames) === JSON.stringify(current.frames))
              delete c.frames;
          });
        } else {
          const p = findPage(pid);
          if (!p || !["page", "selection"].includes(scope))
            throw Error("Choose a valid style scope.");
          const items = p.regions
            .filter((r) => scope === "page" || rids.includes(r.id))
            .map((r) => r.content)
            .filter((c) => c && !c.kind && c.cardId);
          if (!items.length) throw Error("Select cards to style.");
          items.forEach((c) => (c.frames = { ...effective(c), ...value }));
        }
      });
    }
    return {
      get document() {
        return current;
      },
      get dirty() {
        return JSON.stringify(current) !== JSON.stringify(saved);
      },
      get canUndo() {
        return past.length > 0;
      },
      get canRedo() {
        return future.length > 0;
      },
      insertionPreview(pid, rid, direction) {
        const path = insertionPath(pid, rid, direction);
        return {
          regions: path.map((r) => r.id),
          overflow: !!path.at(-1).content,
        };
      },
      insert(source, pid, rid, direction) {
        return change(() => {
          if (
            source.kind !== "catalogue" ||
            !window.CARDS.some(
              (c) => (c.id || c.collectorNumber) === source.cardId,
            )
          )
            throw Error("Choose a card from Add cards to insert.");
          const path = insertionPath(pid, rid, direction);
          let incoming = take(source);
          for (const r of path) [r.content, incoming] = [incoming, r.content];
          if (incoming) current.overflow.push(incoming);
        });
      },
      place(source, pid, rid) {
        return change(() => {
          if (
            source.kind === "pocket" &&
            source.pageId === pid &&
            source.regionId === rid
          )
            return;
          const target = findRegion(pid, rid);
          if (!target) throw Error("Choose a valid pocket.");
          const origin =
            source.kind === "pocket"
              ? findRegion(source.pageId, source.regionId)
              : null;
          if (
            origin?.content?.cardId &&
            !origin.content.kind &&
            target.content?.cardId &&
            !target.content.kind
          ) {
            [origin.content, target.content] = [target.content, origin.content];
            return;
          }
          const c = take(source);
          if (target.content) current.overflow.push(target.content);
          target.content = c;
        });
      },
      swap(pid, first, secondPid, second) {
        return change(() => {
          const a = findRegion(pid, first),
            b = findRegion(secondPid, second);
          if (
            !a?.content?.cardId ||
            a.content.kind ||
            !b?.content?.cardId ||
            b.content.kind
          )
            throw Error("Choose two cards to swap.");
          [a.content, b.content] = [b.content, a.content];
        });
      },
      addCards(values, pid) {
        return change(() => {
          if (!Array.isArray(values) || !values.length || values.length > 2000)
            throw Error("Choose between 1 and 2,000 cards.");
          if (
            values.some(
              (value) =>
                !value ||
                value.kind ||
                !window.CARDS.some(
                  (c) => (c.id || c.collectorNumber) === value.cardId,
                ),
            )
          )
            throw Error("Choose cards from the available catalogue.");
          const start = current.pages.findIndex((p) => p.id === pid);
          if (start < 0) throw Error("Page unavailable.");
          const contents = values.map((value) => ({
            ...copy(value),
            id: id(),
          }));
          let index = 0;
          for (let n = start; index < contents.length; n++) {
            if (n === current.pages.length) {
              if (current.pages.length === 30) break;
              current.pages.push(
                page(current.pages[start].rows, current.pages[start].columns),
              );
            }
            const slots = current.pages[n].regions
              .filter((r) => r.cells.length === 1 && !r.content)
              .sort(
                (a, b) =>
                  a.cells[0][0] - b.cells[0][0] ||
                  a.cells[0][1] - b.cells[0][1],
              );
            for (const r of slots) {
              if (index === contents.length) break;
              r.content = contents[index++];
            }
          }
          current.overflow.push(...contents.slice(index));
          window.BinderStore.validate(current);
        });
      },
      putContent(pid, rid, value) {
        return change(() => {
          const target = findRegion(pid, rid);
          if (!target) throw Error("Choose an available pocket.");
          if (!["artwork", "placeholder"].includes(value.kind))
            throw Error("Choose artwork or a placeholder.");
          const content = copy(value);
          if (
            content.kind === "placeholder" &&
            (!["outline", "soft", "ball"].includes(content.style) ||
              (content.cardId &&
                !window.CARDS.some(
                  (c) => (c.id || c.collectorNumber) === content.cardId,
                )))
          )
            throw Error("Choose a valid placeholder style and printing.");
          if (content.kind === "artwork") {
            if (!window.BinderSchema.validImage(content))
              throw Error("Choose a valid optimized image and crop.");
          }
          const same =
            target.content?.kind === content.kind &&
            (content.kind === "placeholder" ||
              target.content.src === content.src);
          content.id = same ? target.content.id : id();
          if (!same && target.content) current.overflow.push(target.content);
          target.content = content;
          const size = [
            ...current.pages.flatMap((p) => p.regions.map((r) => r.content)),
            ...current.overflow,
          ].reduce(
            (sum, c) => sum + (c?.kind === "artwork" ? c.src.length : 0),
            0,
          );
          if (
            size + (current.cover?.artwork?.src.length || 0) >
            window.BinderSchema.limits.artworkChars
          )
            throw Error(
              "Artwork storage for this prototype is full. Remove unused artwork from Overflow or use smaller images.",
            );
        });
      },
      setFrames(value, scope = "binder", pid, rids = []) {
        return applyFramePatch(
          window.BinderSchema.frames({
            sleeve: value.sleeve || "none",
            toploader: value.toploader || "none",
          }),
          scope,
          pid,
          rids,
        );
      },

      setCoverDetails(value) {
        return change(() => {
          current.cover = window.BinderSchema.cover(value);
          window.BinderStore.validate(current);
        });
      },
      applyFramePatch(value, scope = "selection", pid, rids = []) {
        return applyFramePatch(value, scope, pid, rids);
      },
      duplicatePage(pid, includeContent = false) {
        let newId;
        change(() => {
          if (current.pages.length >= 30)
            throw Error("A binder can have up to 30 pages.");
          const i = current.pages.findIndex((p) => p.id === pid);
          if (i < 0) throw Error("Page unavailable.");
          const p = copy(current.pages[i]);
          p.id = id();
          newId = p.id;
          p.regions.forEach((r) => {
            r.id = id();
            if (!includeContent) r.content = null;
            else if (r.content) r.content.id = id();
          });
          current.pages.splice(i + 1, 0, p);
          window.BinderStore.validate(current);
        });
        return newId;
      },
      setCover(theme) {
        return change(() => {
          if (
            ![
              "classic",
              "transparent",
              "poke",
              "great",
              "ultra",
              "master",
              "premier",
            ].includes(theme)
          )
            throw Error("Choose an available cover theme.");
          current.cover = { theme };
        });
      },
      rename(name) {
        return change(() => {
          if (!name.trim()) throw Error("Enter a binder name.");
          current.name = name.trim().slice(0, 60);
        });
      },
      addPage(rows = 3, columns = 3) {
        let pid;
        change(() => {
          if (current.pages.length >= 30)
            throw Error("A binder can have up to 30 pages.");
          const p = page(rows, columns);
          current.pages.push(p);
          pid = p.id;
        });
        return pid;
      },
      deletePage(pid) {
        return change(() => {
          if (current.pages.length === 1)
            throw Error("Keep at least one page in your binder.");
          const p = findPage(pid);
          if (!p) throw Error("Page unavailable.");
          p.regions.forEach((r) => {
            if (r.content) current.overflow.push(r.content);
          });
          current.pages = current.pages.filter((p) => p.id !== pid);
        });
      },
      reorder(pid, delta) {
        return change(() => {
          const i = current.pages.findIndex((p) => p.id === pid),
            j = i + delta;
          if (i < 0 || j < 0 || j >= current.pages.length) return;
          [current.pages[i], current.pages[j]] = [
            current.pages[j],
            current.pages[i],
          ];
        });
      },
      resize(pid, rows, columns) {
        return change(() => {
          if (
            ![rows, columns].every(
              (n) => Number.isInteger(n) && n >= 1 && n <= 6,
            )
          )
            throw Error("Use whole numbers from 1 to 6.");
          const p = findPage(pid);
          if (!p) throw Error("Page unavailable.");
          const kept = [],
            used = new Set();
          p.regions.forEach((r) => {
            if (r.cells.every(([y, x]) => y < rows && x < columns)) {
              kept.push(r);
              r.cells.forEach(([y, x]) => used.add(y + "," + x));
            } else if (r.content) current.overflow.push(r.content);
          });
          for (let y = 0; y < rows; y++)
            for (let x = 0; x < columns; x++)
              if (!used.has(y + "," + x)) kept.push(region([[y, x]]));
          p.rows = rows;
          p.columns = columns;
          p.regions = kept;
        });
      },
      toOverflow(pid, rids) {
        return change(() => {
          rids.forEach((rid) => {
            const r = findRegion(pid, rid);
            if (r?.content) {
              current.overflow.push(r.content);
              r.content = null;
            }
          });
        });
      },
      clearOverflow() {
        return change(() => {
          current.overflow = [];
        });
      },
      merge(pid, rids) {
        return change(() => {
          const p = findPage(pid),
            regions = p.regions.filter((r) => rids.includes(r.id));
          if (regions.length < 2)
            throw Error("Select at least two pockets with Ctrl/⌘ + click.");
          const cells = regions.flatMap((r) => r.cells);
          if (!window.BinderSchema.connected(cells))
            throw Error("Selected pockets must connect along an edge.");
          regions.forEach((r) => {
            if (r.content) current.overflow.push(r.content);
          });
          p.regions = p.regions.filter((r) => !rids.includes(r.id));
          p.regions.push(region(cells));
        });
      },
      unmerge(pid, rid) {
        return change(() => {
          const p = findPage(pid),
            r = findRegion(pid, rid);
          if (!r || r.cells.length === 1) return;
          if (r.content) current.overflow.push(r.content);
          p.regions = p.regions.filter((n) => n.id !== rid);
          r.cells.forEach((c) => p.regions.push(region([c])));
        });
      },
      undo() {
        if (!past.length) return;
        future.push(copy(current));
        current = past.pop();
      },
      redo() {
        if (!future.length) return;
        past.push(copy(current));
        current = future.pop();
      },
      load(doc) {
        current = copy(doc);
        saved = copy(doc);
        past = [];
        future = [];
      },
      replace(doc) {
        return change(() => {
          current = copy(doc);
        });
      },
      mergeReason(pid, rids) {
        const regions =
          findPage(pid)?.regions.filter((r) => rids.includes(r.id)) || [];
        if (regions.length < 2) return "Select at least two connected pockets.";
        const cells = regions.flatMap((r) => r.cells);
        return window.BinderSchema.connected(cells)
          ? ""
          : "Selected pockets must connect along an edge.";
      },
      save(snapshot = current) {
        saved = copy(snapshot);
        return copy(saved);
      },
    };
  }
  window.BinderState = { create };
})();
