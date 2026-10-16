(() => {
  "use strict";
  const canFocus = (node) => !!(
    node?.isConnected &&
    node.matches("button,input,select,textarea,a[href],summary,[tabindex]") &&
    !node.matches(":disabled") &&
    !node.closest("[hidden],[inert],dialog:not([open])") &&
    node.getClientRects().length &&
    getComputedStyle(node).visibility !== "hidden"
  );
  function restoreFocus(preferred, ...fallbacks) {
    requestAnimationFrame(() => {
      if (document.querySelector("dialog[open]")) return;
      const targets = [preferred, ...fallbacks].map((value) =>
        typeof value === "function" ? value() : value,
      );
      targets.find(canFocus)?.focus({ preventScroll: true });
    });
  }
  window.UIControls = { canFocus, restoreFocus };
  const actions =
    "button.tool-button,button.text-danger,#empty-overflow,#clear-selection,#reset-artwork-crop,#reset-cover-crop,#remove-cover-artwork,.card-menu .menu-items button,.editor-more-menu button,.collection-more-panel > button";
  const disclosures =
    ".canvas-zoom > summary,.editing-tips > summary,.layout-settings > summary,.custom-cover-controls > summary,.discover-filters > summary,.inventory-more-details > summary,.collection-filters > summary,.collection-more > summary,.editor-more > summary,.pocket-more > summary";
  const icons = {
    "⋯": "M5 12h.01M12 12h.01M19 12h.01",
    "×": "M6 6l12 12M18 6L6 18",
    "✕": "M6 6l12 12M18 6L6 18",
    "←": "M14 6l-6 6 6 6",
    "→": "M10 6l6 6-6 6",
    "⌄": "M6 9l6 6 6-6",
  };
  function svg(d) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.classList.add("ui-symbol");
    const p = document.createElementNS(s.namespaceURI, "path");
    p.setAttribute("d", d);
    s.append(p);
    return s;
  }
  function enhance(root) {
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    const match = (selector) => [
      ...(root.matches?.(selector) ? [root] : []),
      ...root.querySelectorAll(selector),
    ];
    match(actions).forEach((n) => n.classList.add("action-button"));
    match(disclosures).forEach((n) => n.classList.add("disclosure-button"));
    match(
      "button.icon-button,button[id*=close],.account summary > span[aria-hidden],.card-menu > summary",
    ).forEach((n) => {
      const text = n.textContent.trim();
      if (!icons[text]) return;
      if (n.tagName === "BUTTON" && !n.hasAttribute("aria-label"))
        n.setAttribute(
          "aria-label",
          text === "×" || text === "✕"
            ? "Close"
            : text === "←"
              ? "Previous"
              : "Next",
        );
      n.replaceChildren(svg(icons[text]));
      n.classList.add("control-icon");
    });
  }
  enhance(document);
  // Native stacked close watchers can dismiss both a confirmation and its editor.
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !== "Escape" ||
        document.querySelectorAll("dialog[open]").length < 2
      )
        return;
      const dialog = event.target.closest("dialog[open]");
      if (!dialog) return;
      event.preventDefault();
      event.stopPropagation();
      if (dialog.dispatchEvent(new Event("cancel", { cancelable: true })))
        dialog.close();
    },
    true,
  );
  const observer = new MutationObserver((records) => {
    for (const r of records)
      for (const n of r.addedNodes) if (n.nodeType === 1) enhance(n);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
