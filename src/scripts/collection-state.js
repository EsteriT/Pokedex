/* Physical inventory is independent of every digital binder document. */
(() => {
  "use strict";
  const copy = (v) => JSON.parse(JSON.stringify(v));
  // Includes fully escaped notes in a maximum-size, pretty-printed backup.
  const limits = Object.freeze({
    records: 5000,
    notes: 2000,
    importBytes: 64 * 1024 * 1024,
  });
  const cards =
    window.CardCatalogue?.byId ||
    new Map(window.CARDS.map((c) => [c.id || c.collectorNumber, c]));
  const conditions = ["unknown", "nm", "lp", "mp", "hp", "damaged"];
  const key = (r) =>
    JSON.stringify([
      r.kind,
      r.cardId,
      r.finish,
      r.kind === "owned" ? r.condition : "",
      r.grading?.company || "",
      r.grading?.grade || "",
    ]);
  function validateRecord(r) {
    if (
      !r ||
      !["owned", "wanted"].includes(r.kind) ||
      !cards.has(r.cardId) ||
      !Number.isInteger(r.quantity) ||
      r.quantity < 1 ||
      r.quantity > 999
    )
      throw Error(
        "Choose a printing and a whole-number quantity from 1 to 999.",
      );
    if (r.finish !== "unknown" && !cards.get(r.cardId).variants?.[r.finish])
      throw Error("Choose a finish available for this printing, or Unknown.");
    if (
      !conditions.includes(r.condition) ||
      !["keep", "trade", "sale"].includes(r.tradeStatus) ||
      typeof r.notes !== "string" ||
      r.notes.length > limits.notes
    )
      throw Error(
        "Invalid condition, trade status, or notes. Notes may contain up to 2,000 characters.",
      );
    if (
      typeof r.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(r.id) ||
      typeof r.chase !== "boolean"
    )
      throw Error("Invalid record identifier or chase flag.");
    let grading = null;
    if (r.grading) {
      if (
        !["PSA", "BGS", "CGC", "Other"].includes(r.grading.company) ||
        typeof r.grading.grade !== "string" ||
        !r.grading.grade.trim() ||
        r.grading.grade.length > 20
      )
        throw Error("Choose a grading company and enter the grade or label.");
      grading = { company: r.grading.company, grade: r.grading.grade.trim() };
    }
    return {
      id: r.id,
      kind: r.kind,
      cardId: r.cardId,
      finish: r.finish,
      quantity: r.quantity,
      condition: r.kind === "owned" && !grading ? r.condition : "unknown",
      grading: r.kind === "owned" ? grading : null,
      notes: r.notes.trim(),
      chase: r.kind === "wanted" && !!r.chase,
      tradeStatus: r.kind === "owned" ? r.tradeStatus : "keep",
    };
  }
  function validate(doc) {
    if (doc?.format === "pokedex-collection") doc = doc.document;
    if (
      !doc ||
      !Array.isArray(doc.records) ||
      doc.records.length > limits.records
    )
      throw Error(
        "Invalid collection file. Expected a records list with at most 5,000 groups.",
      );
    const ids = new Set(),
      groups = new Set();
    const records = doc.records.map((value) => {
      const r = validateRecord(value);
      if (ids.has(r.id) || groups.has(key(r)))
        throw Error(
          "Duplicate record identifiers or ownership groups in this file.",
        );
      ids.add(r.id);
      groups.add(key(r));
      return r;
    });
    return { records };
  }
  function create(initial = { records: [] }) {
    let current = validate(initial),
      saved = copy(current),
      past = [],
      future = [];
    const change = (fn) => {
      const before = copy(current);
      try {
        fn();
      } catch (error) {
        current = before;
        throw error;
      }
      if (JSON.stringify(before) !== JSON.stringify(current)) {
        past.push(before);
        if (past.length > 100) past.shift();
        future = [];
      }
    };
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
      upsert(value, id = null) {
        let merged = false;
        change(() => {
          const r = validateRecord({ ...value, id: id || crypto.randomUUID() });
          if (id && !current.records.some((n) => n.id === id))
            throw Error("This record is no longer available.");
          const existing = current.records.find(
            (n) => n.id !== id && key(n) === key(r),
          );
          if (existing) {
            if (existing.tradeStatus !== r.tradeStatus)
              throw Error(
                "This ownership group already exists with a different trade status. Edit that group to change its status.",
              );
            if (existing.quantity + r.quantity > 999)
              throw Error("The combined quantity would exceed 999.");
            const notes = [
              ...new Set([existing.notes, r.notes].filter(Boolean)),
            ].join("\n");
            if (notes.length > limits.notes)
              throw Error("Combined notes exceed 2,000 characters.");
            existing.quantity += r.quantity;
            existing.notes = notes;
            existing.chase = existing.chase || r.chase;
            if (id)
              current.records = current.records.filter((n) => n.id !== id);
            merged = true;
          } else {
            const i = current.records.findIndex((n) => n.id === id);
            if (i < 0) {
              if (current.records.length >= limits.records)
                throw Error("Maximum 5,000 groups.");
              current.records.push(r);
            } else current.records[i] = r;
          }
        });
        return merged;
      },
      remove(id) {
        change(() => {
          current.records = current.records.filter((r) => r.id !== id);
        });
      },
      replace(doc) {
        change(() => {
          current = validate(doc);
        });
      },
      undo() {
        if (past.length) {
          future.push(copy(current));
          current = past.pop();
        }
      },
      redo() {
        if (future.length) {
          past.push(copy(current));
          current = future.pop();
        }
      },
      save(snapshot = current) {
        saved = validate(copy(snapshot));
      },
      load(doc) {
        current = validate(doc);
        saved = copy(current);
        past = [];
        future = [];
      },
    };
  }
  const storageKey = "pokedex.collection.v1";
  const getRaw = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      throw Error(
        "Browser storage is unavailable. Download backup to keep your work.",
      );
    }
  };
  function read() {
    const raw = getRaw();
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (
        data.version !== 1 ||
        !Number.isSafeInteger(data.revision) ||
        data.revision < 0
      )
        throw Error();
      return { revision: data.revision, document: validate(data.document) };
    } catch {
      throw Error(
        "Saved collection could not be read. It has not been overwritten. Reload after restoring valid data.",
      );
    }
  }
  function save(doc, revision) {
    const latest = read();
    if ((latest?.revision ?? null) !== revision)
      throw Error(
        "Collection changed in another tab. Download your edits, then reload before saving again.",
      );
    const data = {
      version: 1,
      revision: (latest?.revision || 0) + 1,
      document: validate(doc),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      throw Error(
        "Save failed: browser storage is full or unavailable. Download backup to keep your work.",
      );
    }
    return data.revision;
  }
  window.CollectionState = { create, validate, key, limits };
  window.CollectionStore = { read, save };
})();
