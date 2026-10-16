/* Local binder arrangement tools; all document edits use the shared history. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  function node(tag, text, cls = "") {
    const n = document.createElement(tag);
    n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function init(h) {
    const clipboardKey = "pokedex.copied-cards.v1",
      chosen = new Set();
    let selecting = false,
      copied = null;
    const card = (c) => c && !c.kind && c.cardId;
    const selected = () =>
      h
        .page()
        .regions.filter((r) => h.selected().includes(r.id) && card(r.content));
    function button(id, label, action, cls = "button secondary") {
      const b = node("button", label, cls);
      b.id = id;
      b.type = "button";
      b.addEventListener("click", action);
      return b;
    }
    function dialog(id, title) {
      const d = node("dialog", undefined, "studio-dialog arrange-dialog");
      d.id = id;
      const head = node("div", undefined, "studio-dialog-heading"),
        heading = node("h2", title);
      heading.id = id + "-title";
      const close = button(id + "-close", "×", () => d.close(), "icon-button");
      close.setAttribute("aria-label", "Close " + title.toLowerCase());
      head.append(heading, close);
      d.append(head);
      d.setAttribute("aria-labelledby", heading.id);
      document.body.append(d);
      let focus;
      d.addEventListener("close", () =>
        requestAnimationFrame(() => {
          if (document.querySelector("dialog[open]")) return;
          const menu = focus?.closest("details");
          const target =
            menu && !menu.open ? menu.querySelector("summary") : focus;
          if (target?.isConnected) target.focus({ preventScroll: true });
        }),
      );
      return {
        d,
        open() {
          focus = document.activeElement;
          h.openDialog(d);
        },
      };
    }
    const picker = node("div", undefined, "arrange-picker-tools");
    const select = button("picker-select-cards", "Select cards", () => {
      selecting = !selecting;
      chosen.clear();
      h.clearPending();
      refreshPicker();
    });
    select.setAttribute("aria-pressed", "false");
    $("result-count").before(picker);
    picker.append($("result-count"), select);
    const batch = node("div", undefined, "arrange-picker-tools");
    batch.hidden = true;
    batch.setAttribute("role", "group");
    batch.setAttribute("aria-label", "Selected cards");
    const add = button(
      "picker-add-selected",
      "Add 0 cards",
      () => {
        h.run(() => {
          h.state.addCards(
            [...chosen].map((cardId) => ({ cardId })),
            h.page().id,
          );
          chosen.clear();
          selecting = false;
          refreshPicker();
        }, "Selected cards added. Save to keep your changes.");
      },
      "button primary",
    );
    batch.append(
      add,
      button(
        "picker-clear-selected",
        "Clear",
        () => {
          chosen.clear();
          refreshPicker();
        },
        "btn-link",
      ),
    );
    picker.after(batch);
    const results = $("card-results");
    function refreshPicker() {
      select.textContent = selecting ? "Cancel selection" : "Select cards";
      select.setAttribute("aria-pressed", String(selecting));
      batch.hidden = !selecting;
      add.disabled = !chosen.size;
      add.textContent =
        "Add " + chosen.size + " card" + (chosen.size === 1 ? "" : "s");
      for (const b of results.querySelectorAll(".catalogue-card")) {
        const id = b.dataset.focusKey?.slice("catalogue:".length);
        if (selecting) {
          b.classList.toggle("is-selected", chosen.has(id));
          b.setAttribute("aria-pressed", String(chosen.has(id)));
        } else if (b.hasAttribute("aria-pressed")) {
          b.removeAttribute("aria-pressed");
          b.classList.remove("is-selected");
        }
      }
    }
    results.addEventListener(
      "click",
      (e) => {
        const b = e.target.closest(".catalogue-card");
        if (!selecting || !b) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const id = b.dataset.focusKey.slice("catalogue:".length);
        chosen.has(id) ? chosen.delete(id) : chosen.add(id);
        refreshPicker();
      },
      true,
    );
    results.addEventListener(
      "dragstart",
      () => {
        if (selecting) {
          selecting = false;
          chosen.clear();
          refreshPicker();
        }
      },
      true,
    );
    new MutationObserver(refreshPicker).observe(results, { childList: true });
    const menu = document.getElementById("selection-actions");
    const swap = button("swap-selected-cards", "Swap these cards", () => {
      const cards = selected();
      h.run(
        () =>
          h.state.swap(h.page().id, cards[0]?.id, h.page().id, cards[1]?.id),
        "Cards swapped.",
      );
    });
    const copy = button(
      "copy-cards-binder",
      "Copy cards to another binder…",
      () => {
        destinations.replaceChildren();
        try {
          for (const b of window.BinderStore.read().filter(
            (b) => b.id !== h.binderId(),
          ))
            destinations.add(new Option(b.name, b.id));
          copyLink.hidden = !destinations.options.length;
          copyNote.textContent = destinations.options.length
            ? "The source stays unchanged. Open the destination, choose Paste copied cards, then Save there. Unsaved source edits keep their normal leave warning."
            : "Create another binder in Workspace first.";
          copyDialog.open();
        } catch (error) {
          h.notify(error.message, true);
        }
      },
    );
    menu.append(swap, copy);
    swap.hidden = copy.hidden = true;
    const copyDialog = dialog(
        "copy-cards-dialog",
        "Copy cards to another binder",
      ),
      destinations = node("select"),
      destinationLabel = node("label", "Destination binder", "field"),
      copyNote = node("p");
    destinations.id = "copy-destination";
    destinationLabel.htmlFor = destinations.id;
    destinationLabel.append(destinations);
    const copyLink = node("a", "Open binder to paste", "button primary");
    copyLink.id = "open-copy-destination";
    copyLink.href = location.href;
    copyLink.addEventListener("click", (e) => {
      try {
        if (!destinations.value) throw Error("Choose a destination binder.");
        const cards = selected().map((r) => ({
          ...structuredClone(r.content),
          frames: {
            sleeve: "none",
            toploader: "none",
            ...(r.content.frames || h.state.document.frames),
          },
        }));
        sessionStorage.setItem(
          clipboardKey,
          JSON.stringify({ target: destinations.value, cards }),
        );
        const url = new URL(location.href);
        url.search = "?paste=" + crypto.randomUUID();
        url.hash = encodeURIComponent(
          JSON.stringify({ id: destinations.value }),
        );
        copyLink.href = url.href;
        copyDialog.d.close();
      } catch (error) {
        e.preventDefault();
        h.notify("Could not copy cards: " + error.message, true);
      }
    });
    copyDialog.d.append(destinationLabel, copyNote, copyLink);
    const paste = button(
      "paste-copied-cards",
      "Paste copied cards",
      () => {
        h.run(() => {
          h.state.addCards(copied.cards, h.page().id);
          copied = null;
          paste.hidden = true;
          try {
            sessionStorage.removeItem(clipboardKey);
          } catch {}
        }, "Copied cards added. Save this binder to keep them.");
      },
      "button primary",
    );
    paste.hidden = true;
    batch.after(paste);
    try {
      const raw = sessionStorage.getItem(clipboardKey);
      if (raw && raw.length < 2000000) {
        const value = JSON.parse(raw);
        if (
          value.target === h.binderId() &&
          Array.isArray(value.cards) &&
          value.cards.length &&
          value.cards.length <= 2000
        ) {
          copied = value;
          paste.textContent = "Paste " + copied.cards.length + " copied cards";
          paste.hidden = false;
        }
      }
    } catch (error) {
      h.notify("Copied cards could not be read. Copy them again.", true);
    }
    function refresh() {
      const cards = selected();
      swap.hidden = cards.length !== 2 || h.selected().length !== 2;
      copy.hidden = !cards.length;
      refreshPicker();
    }
    return { refresh };
  }
  window.EditorArrange = { init };
})();
