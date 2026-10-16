(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let state = window.CollectionState.create(window.SAMPLE_COLLECTION),
    revision = null,
    blocked = false,
    statusText = "",
    pendingMessage = "";
  const announce = (text) => {
    statusText = text;
    $("discover-collection-status").textContent = text;
    $("detail-message").textContent = text;
    $("discover-collection-bar").hidden = false;
    updateAnnouncementTarget();
  };
  function updateAnnouncementTarget() {
    const inDetails = $("details-dialog").open;
    $("discover-collection-status").setAttribute(
      "aria-live",
      inDetails ? "off" : "polite",
    );
    if (inDetails) {
      $("detail-message").setAttribute("role", "status");
      $("detail-message").setAttribute("aria-live", "polite");
    } else {
      $("detail-message").removeAttribute("role");
      $("detail-message").setAttribute("aria-live", "off");
    }
  }
  function render() {
    updateAnnouncementTarget();
    $("discover-collection-save").disabled = !state.dirty || blocked;
    $("detail-collection-save").hidden = !state.dirty;
    $("detail-collection-save").disabled = blocked;
    $("discover-collection-undo").hidden = !state.canUndo;
    $("detail-collection-undo").hidden = !state.canUndo;
    $("discover-collection-download").hidden = !state.dirty;
  }
  function load(onlyIfChanged = false) {
    try {
      const saved = window.CollectionStore.read();
      if (onlyIfChanged && (saved?.revision ?? null) === revision && !blocked)
        return;
      state.load(saved?.document || window.SAMPLE_COLLECTION);
      revision = saved?.revision ?? null;
      blocked = false;
    } catch (error) {
      blocked = true;
      announce(error.message);
    }
    render();
  }
  const form = window.CollectionForm.create({
    kind: () => "owned",
    records: () => state.document.records,
    updated: () => {
      announce(pendingMessage);
      render();
    },
    apply(value, id) {
      if (blocked)
        throw Error(
          "Saved collection is unavailable. It has not been overwritten.",
        );
      const merged = state.upsert(value, id);
      pendingMessage =
        (merged
          ? "Copies combined. "
          : "Card added to " +
            (value.kind === "owned" ? "Owned" : "Wanted") +
            ". ") + "Unsaved changes · Save collection to keep them.";
    },
  });
  function save() {
    try {
      revision = window.CollectionStore.save(state.document, revision);
      state.save();
      announce(
        "Collection saved on this browser. Open My collection to view it.",
      );
      render();
    } catch (error) {
      announce(error.message);
    }
  }
  for (const id of ["discover-collection-save", "detail-collection-save"])
    $(id).addEventListener("click", save);
  function undo() {
    state.undo();
    announce(
      state.dirty
        ? "Change undone · unsaved changes remain."
        : "Change undone.",
    );
    render();
  }
  for (const id of ["discover-collection-undo", "detail-collection-undo"])
    $(id).addEventListener("click", undo);
  $("discover-collection-download").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: "pokedex-collection",
              version: 1,
              document: state.document,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pokedex-collection.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  for (const id of [
    "discover-workspace-collection",
    "open-workspace-collection",
  ]) {
    const url = new URL($(id).href);
    url.searchParams.set("tab", "collection");
    $(id).href = url.href;
  }
  window.DiscoverCollection = {
    select(selected, selectedFinish) {
      const url = new URL($("open-workspace-collection").href);
      url.hash = encodeURIComponent(
        JSON.stringify({
          cardId: selected.id || selected.collectorNumber,
          finish: selectedFinish || "unknown",
          kind: "owned",
        }),
      );
      $("open-workspace-collection").href = url.href;
      render();
    },
    open(selected, selectedFinish) {
      if (!state.dirty) load(true);
      if (blocked) {
        announce(
          "Saved collection is unavailable. Restore or reload valid collection data first.",
        );
        return;
      }
      form.open(null, {
        cardId: selected.id || selected.collectorNumber,
        finish: selectedFinish || "unknown",
        kind: "owned",
      });
    },
  };
  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("storage", (e) => {
    if (e.key !== "pokedex.collection.v1" && e.key !== null) return;
    if (state.dirty || $("inventory-dialog").open)
      announce(
        "Collection changed in another tab. Download your edits before reloading; saving will detect the conflict.",
      );
    else load();
  });
  $("details-dialog").addEventListener("close", updateAnnouncementTarget);
  $("details-dialog").addEventListener("toggle", () => {
    updateAnnouncementTarget();
    if ($("details-dialog").open && statusText)
      $("detail-message").textContent = statusText;
  });
  load();
})();
