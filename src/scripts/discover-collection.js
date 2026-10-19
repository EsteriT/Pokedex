(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    repository = window.CollectionRepository;
  let state = window.CollectionState.create(repository.empty()),
    revision = null,
    blocked = true,
    persisting = false,
    loadId = 0,
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
    $("discover-collection-save").disabled =
      !state.dirty || blocked || persisting;
    $("detail-collection-save").hidden = !state.dirty;
    $("detail-collection-save").disabled = blocked || persisting;
    $("discover-collection-save").toggleAttribute("aria-busy", persisting);
    $("discover-collection-reload").disabled = persisting;
    $("discover-collection-undo").hidden = !state.canUndo;
    $("detail-collection-undo").hidden = !state.canUndo;
    $("discover-collection-download").hidden = !state.dirty;
    const tools = document.querySelector(".discover-save-tools");
    tools.hidden = !state.dirty && $("discover-collection-reload").hidden;
    if (tools.hidden) {
      tools.open = false;
      if (tools.contains(document.activeElement))
        $("discover-workspace-collection").focus();
    }
  }
  async function load(onlyIfChanged = false) {
    if (persisting) return;
    const request = ++loadId,
      wasBlocked = blocked;
    blocked = true;
    render();
    try {
      const saved = await repository.read();
      if (request !== loadId) return;
      if (
        !onlyIfChanged ||
        (saved?.revision ?? null) !== revision ||
        wasBlocked
      ) {
        state.load(saved?.document || repository.empty());
        revision = saved?.revision ?? null;
      }
      blocked = false;
      $("discover-collection-reload").hidden = true;
    } catch (error) {
      if (request !== loadId) return;
      announce(error.message);
      $("discover-collection-reload").hidden = false;
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
      repository.check();
      const merged = state.upsert(value, id);
      pendingMessage =
        (merged
          ? "Copies combined. "
          : "Card added to " +
            (value.kind === "owned" ? "Owned" : "Wanted") +
            ". ") + "Unsaved changes · Save collection to keep them.";
    },
  });
  async function save() {
    if (blocked || persisting) return;
    persisting = true;
    const snapshot = JSON.parse(JSON.stringify(state.document));
    render();
    try {
      revision = await repository.save(snapshot, revision);
      state.save(snapshot);
      $("discover-collection-reload").hidden = true;
      announce(
        repository.enabled
          ? "Collection saved to your account."
          : "Collection saved on this browser. Open My collection to view it.",
      );
    } catch (error) {
      announce(error.message);
      $("discover-collection-reload").hidden = false;
    } finally {
      persisting = false;
      render();
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
    async open(selected, selectedFinish) {
      if (!state.dirty) await load(true);
      if (blocked || !$("details-dialog").open) return;
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
    if (
      repository.enabled ||
      (e.key !== "pokedex.collection.v1" && e.key !== null)
    )
      return;
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
  $("discover-collection-reload").addEventListener("click", () => {
    if (
      !state.dirty ||
      window.confirm(
        "Discard unsaved collection edits and reload? Download a draft backup first to keep them.",
      )
    )
      load();
  });
  window.addEventListener("pokedex-before-signout", (e) => {
    if (persisting) {
      e.preventDefault();
      announce("Wait for collection Save to finish before signing out.");
      return;
    }
    if (
      state.dirty &&
      !window.confirm(
        "Sign out and discard unsaved collection edits? Download a backup first to keep them.",
      )
    )
      e.preventDefault();
  });
  window.addEventListener("pokedex-account-changed", () => {
    ++loadId;
    blocked = true;
    if (!state.dirty) state.load({ records: [] });
    announce(
      "Account changed. Download any draft backup, then reload before continuing.",
    );
    render();
  });
  load();
})();
