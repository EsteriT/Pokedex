(() => {
  "use strict";
  const repository = window.BinderRepository;
  if (!repository?.enabled) return;
  function button(label, action) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "button secondary";
    b.textContent = label;
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await action();
      } catch (e) {
        note.textContent = e.message;
      } finally {
        b.disabled = false;
      }
    });
    return b;
  }
  const account = document.querySelector(".account"),
    panel = account?.querySelector(".account-panel");
  if (!panel) return;
  const note = document.createElement("p");
  note.setAttribute("role", "status");
  repository.ready.then(() => {
    panel.classList.add("cloud-account-panel");
    const user = repository.user;
    account.querySelector("summary").setAttribute("aria-label", "Account menu");
    const label = account.querySelector("summary > span:not(.avatar)");
    if (label) label.textContent = user ? "Your account" : "Sign in";
    panel.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = user?.email || "Cloud binders";
    panel.append(heading, note);
    if (!user) {
      note.textContent = "Sign in to save private binders and your collection.";
      const route = document.querySelector(
        '#workspace-nav, .workspace-back, a[href*="workspace"], #editor-route',
      );
      const callback = new URL(route?.href || location.href);
      callback.search = "";
      callback.hash = "";
      panel.append(
        button("Continue with Google", () => repository.signIn(callback.href)),
      );
      return;
    }
    note.textContent =
      "Private binders and collection. Use Save to keep changes.";
    panel.append(button("Sign out", () => repository.signOut()));
    panel.append(
      button("Remove unused artwork", async () => {
        const count = await repository.cleanupArtwork();
        note.textContent =
          count +
          " unused images removed. Recently uploaded images are kept for 24 hours.";
      }),
    );
    if (!document.getElementById("binder-grid")) return;
    const importButton = button("Import a browser binder", async () => {
      let dialog = document.getElementById("local-binder-import");
      if (dialog) {
        dialog.showModal();
        return;
      }
      dialog = document.createElement("dialog");
      dialog.id = "local-binder-import";
      dialog.className = "cloud-dialog";
      const title = document.createElement("h2");
      title.id = "local-import-title";
      title.textContent = "Import a browser binder";
      dialog.setAttribute("aria-labelledby", title.id);
      const help = document.createElement("p");
      help.textContent =
        "Choose a saved binder to copy into this account. The browser original stays intact.";
      const options = document.createElement("div"),
        status = document.createElement("p");
      options.className = "cloud-import-options";
      status.setAttribute("role", "status");
      for (const b of window.BinderStore.read()) {
        const choose = button(b.name, async () => {
          if (!confirm('Copy "' + b.name + '" into this account?')) return;
          choose.disabled = true;
          try {
            await repository.importLocal(b.id);
            location.reload();
          } catch (e) {
            status.textContent = e.message;
          }
        });
        options.append(choose);
      }
      if (!options.children.length)
        help.textContent =
          "There are no saved browser binders to import. You can restore a downloaded backup inside a cloud binder.";
      const close = button("Close", () => dialog.close());
      dialog.append(title, help, options, status, close);
      document.body.append(dialog);
      dialog.addEventListener("close", () => importButton.focus());
      dialog.showModal();
    });
    panel.append(importButton);
  });
  window.addEventListener("pokedex-account-changed", () => {
    note.textContent =
      "Account changed. Download any draft backup, then reload before continuing.";
    // Never silently replace an open editor draft with another account's data.
    const reload = button("Reload account", () => location.reload());
    panel.append(reload);
    account.open = true;
    const grid = document.getElementById("binder-grid");
    if (grid) grid.hidden = true;
    document
      .querySelectorAll("#binder-grid a, #binder-grid button")
      .forEach((n) => {
        n.inert = true;
      });
  });
})();
