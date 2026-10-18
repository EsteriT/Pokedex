/* The account collection never overwrites the browser's original inventory. */
(() => {
  "use strict";
  const local = window.CollectionStore,
    model = window.CollectionState,
    binders = window.BinderRepository,
    enabled = !!binders?.enabled;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const ready = binders?.ready || Promise.resolve();
  function check() {
    if (enabled) {
      if (!binders.user)
        throw Error("Sign in with Google to use your account collection.");
      binders.assertSession();
    }
  }
  function requestError(error) {
    const e = Error(
      error.code === "40001"
        ? "Collection changed on another device. Download your draft backup, then reload the saved collection before saving again."
        : error.message ||
            "Collection request failed. Your draft is still available.",
    );
    e.code = error.code;
    return e;
  }
  async function read() {
    await ready;
    if (!enabled) return local.read();
    check();
    const { data, error } = await binders.client
      .from("collections")
      .select("revision,document")
      .maybeSingle();
    check();
    if (error) throw requestError(error);
    return data
      ? { revision: data.revision, document: model.validate(data.document) }
      : null;
  }
  async function save(document, revision) {
    const snapshot = model.validate(clone(document));
    if (enabled && new Blob([JSON.stringify(snapshot)]).size > 16 * 1024 * 1024)
      throw Error(
        "Cloud collections are limited to 16 MB. Download a backup before reducing large notes.",
      );
    await ready;
    if (!enabled) return local.save(snapshot, revision);
    check();
    const token = await binders.accessToken();
    check();
    const { data, error } = await binders.client
      .rpc("commit_collection", {
        expected_revision: revision,
        document: snapshot,
      })
      // Pin a pending write to its original account, even if the SDK session changes.
      .setHeader("Authorization", "Bearer " + token);
    check();
    if (error) {
      binders.reportFailure?.(error, token);
      throw requestError(error);
    }
    if (!Number.isSafeInteger(data) || data < 1)
      throw Error(
        "Save response was incomplete. Download your draft and reload before retrying.",
      );
    return data;
  }
  function previewImport(current, browser) {
    const account = model.validate(current),
      source = model.validate(browser);
    const groups = new Map(account.records.map((r) => [model.key(r), r]));
    return {
      groups: source.records.length,
      added: source.records.filter((r) => !groups.has(model.key(r))).length,
      overlaps: source.records.filter((r) => groups.has(model.key(r))).length,
    };
  }
  function importDocument(current, browser, overlap) {
    if (!["keep", "replace"].includes(overlap))
      throw Error("Choose how to handle matching groups.");
    const account = model.validate(current),
      source = model.validate(browser);
    const records = clone(account.records),
      positions = new Map(records.map((r, i) => [model.key(r), i]));
    const ids = new Set(records.map((r) => r.id));
    for (const record of source.records) {
      const index = positions.get(model.key(record));
      if (index !== undefined) {
        if (overlap === "replace")
          records[index] = { ...record, id: records[index].id };
      } else {
        const id = ids.has(record.id) ? crypto.randomUUID() : record.id;
        ids.add(id);
        positions.set(model.key(record), records.length);
        records.push({ ...record, id });
      }
    }
    return model.validate({ records });
  }
  window.CollectionRepository = {
    enabled,
    ready,
    read,
    save,
    check,
    empty: () => (enabled ? { records: [] } : clone(window.SAMPLE_COLLECTION)),
    readBrowser: () => local.read(),
    previewImport,
    importDocument,
  };
})();
