(() => {
  "use strict";
  const repo = window.BinderRepository,
    config = window.POKEDEX_BACKEND;
  if (!repo?.enabled) return;
  async function context() {
    await repo.ready;
    const token = await repo.identityToken();
    return { token, guard: () => repo.assertIdentity() };
  }
  async function rpc(name, args, ctx) {
    ctx.guard();
    const { data, error } = await repo.client
      .rpc(name, args)
      .setHeader("Authorization", "Bearer " + ctx.token);
    ctx.guard();
    if (error)
      throw Error(
        error.code === "40001"
          ? "Saved data changed on another device. Reload before restoring."
          : error.message,
      );
    return data;
  }
  // A fixed token prevents a mid-request account switch from retargeting files.
  async function storage(path, options, ctx) {
    ctx.guard();
    const response = await fetch(config.url + "/storage/v1/object/" + path, {
      ...options,
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: {
        apikey: config.publishableKey,
        Authorization: "Bearer " + ctx.token,
        ...options?.headers,
      },
    });
    ctx.guard();
    let duplicate = false;
    if (!response.ok && options?.method === "POST") {
      const error = await response
        .clone()
        .json()
        .catch(() => null);
      // Storage may carry its duplicate code inside an HTTP 400 response.
      duplicate =
        response.status === 409 || String(error?.statusCode) === "409";
    }
    if (!response.ok && !duplicate)
      throw Error(
        "Artwork request failed (" +
          response.status +
          "). Retry before continuing.",
      );
    return response;
  }
  async function download(path, ctx) {
    const response = await storage("binder-artwork/" + path, {}, ctx);
    const blob = await response.blob();
    if (blob.size > 500000)
      throw Error("Stored artwork exceeds the backup limit.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return window.AccountBackup.image(
      "data:" + blob.type + ";base64," + btoa(binary),
    );
  }
  async function upload(src, ctx) {
    window.AccountBackup.image(src);
    const binary = atob(src.slice(src.indexOf(",") + 1)),
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      type = src.slice(5, src.indexOf(";")),
      extension = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
      }[type],
      digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      path =
        repo.user.id +
        "/" +
        Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") +
        "." +
        extension;
    await rpc("reserve_binder_artwork", { object_path: path }, ctx);
    await storage(
      "binder-artwork/" + path,
      {
        method: "POST",
        body: bytes,
        headers: { "Content-Type": type, "x-upsert": "false" },
      },
      ctx,
    );
    return "storage:" + path;
  }
  function images(doc) {
    return [
      ...(doc.cover?.theme === "custom" ? [doc.cover.artwork] : []),
      ...doc.pages
        .flatMap((p) => p.regions.map((r) => r.content))
        .concat(doc.overflow)
        .filter((c) => c?.kind === "artwork"),
    ];
  }
  async function exportData() {
    const ctx = await context(),
      snapshot = await rpc("account_snapshot", {}, ctx),
      cache = new Map();
    for (const path of snapshot.artwork)
      cache.set("storage:" + path, await download(path, ctx));
    const binders = snapshot.binders.map((b) => {
      const doc = structuredClone(b.document);
      for (const image of images(doc)) {
        if (!cache.has(image.src))
          throw Error(
            "Artwork is missing. No incomplete backup was downloaded.",
          );
        image.src = cache.get(image.src);
      }
      return doc;
    });
    ctx.guard();
    return window.AccountBackup.validate({
      format: "pokedex-account",
      version: 1,
      exportedAt: new Date().toISOString(),
      binders,
      collection: snapshot.collection?.document || { records: [] },
      artwork: [...cache.values()],
    });
  }
  async function restoreData(input) {
    const backup = window.AccountBackup.validate(input),
      ctx = await context(),
      snapshot = await rpc("account_snapshot", {}, ctx);
    if (snapshot.deleting)
      throw Error(
        "Account deletion has started. Finish deletion before using a new account.",
      );
    const cache = new Map();
    for (const src of backup.artwork) cache.set(src, await upload(src, ctx));
    const documents = [];
    for (const inputDoc of backup.binders) {
      const document = structuredClone(inputDoc);
      for (const image of images(document)) {
        if (!cache.has(image.src))
          cache.set(image.src, await upload(image.src, ctx));
        image.src = cache.get(image.src);
      }
      documents.push({ id: crypto.randomUUID(), document });
    }
    await rpc(
      "restore_account",
      {
        expected: snapshot.binders.map(({ id, revision }) => ({
          id,
          revision,
        })),
        documents,
        expected_collection: snapshot.collection?.revision ?? null,
        collection_document: backup.collection,
      },
      ctx,
    );
  }
  async function deleteAccount(confirmation) {
    const ctx = await context(),
      snapshot = await rpc("begin_account_deletion", { confirmation }, ctx);
    if (snapshot.artwork.length)
      await storage(
        "binder-artwork",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: snapshot.artwork }),
        },
        ctx,
      );
    await rpc("finish_account_deletion", { confirmation }, ctx);
    // The account is gone; optional browser cleanup must not strand this page.
    try {
      sessionStorage.removeItem("pokedex.copied-cards.v1");
    } catch {}
    try {
      await repo.client.auth.signOut({ scope: "local" });
    } catch {}
    location.reload();
  }
  window.AccountData = { exportData, restoreData, deleteAccount };
})();
