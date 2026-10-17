/* Canonical cloud documents contain private Storage paths. Only the in-memory
   editor/portable backups receive image data; expiring URLs are never saved. */
(() => {
  "use strict";
  function create(client, owner, guard) {
    const bucket = client.storage.from("binder-artwork"),
      cache = new Map();
    const images = (doc) => [
      ...(doc.cover?.theme === "custom" ? [doc.cover.artwork] : []),
      ...doc.pages
        .flatMap((p) => p.regions.map((r) => r.content))
        .concat(doc.overflow)
        .filter((c) => c?.kind === "artwork"),
    ];
    function bytesOf(src) {
      const base64 = src.slice(src.indexOf(",") + 1),
        binary = atob(base64);
      return Uint8Array.from(binary, (c) => c.charCodeAt(0));
    }
    async function hydrate(input) {
      const doc = structuredClone(input);
      for (const image of images(doc)) {
        guard();
        const path = image.src?.startsWith("storage:")
          ? image.src.slice(8)
          : null;
        if (
          !path ||
          !new RegExp("^" + owner + "/[0-9a-f]{64}\\.(png|jpg|webp)$").test(
            path,
          )
        )
          throw Error("Invalid private artwork reference.");
        if (!cache.has(path)) {
          const { data, error } = await bucket.download(path);
          if (error)
            throw Error(
              "Could not load private artwork. Retry before editing this binder.",
            );
          if (
            data.size > 500000 ||
            !["image/png", "image/jpeg", "image/webp"].includes(data.type)
          )
            throw Error("Invalid stored artwork.");
          const bytes = new Uint8Array(await data.arrayBuffer());
          let binary = "";
          for (const byte of bytes) binary += String.fromCharCode(byte);
          cache.set(path, "data:" + data.type + ";base64," + btoa(binary));
        }
        guard();
        image.src = cache.get(path);
      }
      return window.BinderStore.validate(doc);
    }
    async function pack(input) {
      const doc = window.BinderStore.validate(input);
      for (const image of images(doc)) {
        guard();
        const bytes = bytesOf(image.src),
          type = image.src.slice(5, image.src.indexOf(";"));
        const extension = {
          "image/png": "png",
          "image/jpeg": "jpg",
          "image/webp": "webp",
        }[type];
        const digest = new Uint8Array(
          await crypto.subtle.digest("SHA-256", bytes),
        );
        const path =
          owner +
          "/" +
          Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") +
          "." +
          extension;
        if (!cache.has(path)) {
          const { error: reservation } = await client.rpc(
            "reserve_binder_artwork",
            { object_path: path },
          );
          if (reservation) throw Error(reservation.message);
          guard();
          const { error } = await bucket.upload(
            path,
            new Blob([bytes], { type }),
            { contentType: type, upsert: false },
          );
          if (error && String(error.statusCode) !== "409")
            throw Error(
              "Artwork upload failed. Your binder draft is unchanged. " +
                error.message,
            );
          guard();
          cache.set(path, image.src);
        }
        image.src = "storage:" + path;
      }
      return doc;
    }
    async function cleanup() {
      guard();
      let result = await client.rpc("cleanup_binder_artwork");
      if (result.error) throw Error(result.error.message);
      guard();
      const paths = result.data || [];
      let removedCount = 0;
      if (paths.length) {
        // A later Undo/restore may reuse these bytes and must upload them again.
        for (const path of paths) cache.delete(path);
        const { data, error } = await bucket.remove(paths);
        if (error) throw Error(error.message);
        guard();
        removedCount = data?.length || 0;
        result = await client.rpc("cleanup_binder_artwork");
        if (result.error) throw Error(result.error.message);
      }
      return removedCount;
    }
    return { hydrate, pack, cleanup };
  }
  window.BinderCloudMedia = { create };
})();
