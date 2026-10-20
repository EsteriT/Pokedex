(() => {
  "use strict";
  const repo = window.BinderRepository;
  if (!repo?.enabled) return;
  function allowed() {
    const result = window.dispatchEvent(
      new Event("pokedex-before-account-action", { cancelable: true }),
    );
    if (!result)
      document.querySelector(".account-panel [role=status]").textContent =
        "Save your collection draft, or download its backup and reload, before using account data controls.";
    return result;
  }
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  repo.ready.then(() => {
    if (!repo.user) return;
    const panel = document.querySelector(".account-panel");
    const trigger = element("button", "Account data", "button secondary");
    trigger.type = "button";
    panel.append(trigger);
    const dialog = element("dialog", "", "cloud-dialog account-data-dialog");
    dialog.id = "account-data-dialog";
    const heading = element("h2", "Your account data");
    heading.id = "account-data-title";
    dialog.setAttribute("aria-labelledby", heading.id);
    const status = element("p");
    status.setAttribute("role", "status");
    const explanation = element(
      "p",
      "Save your edits first. The account backup includes saved binders, collection records and all uploaded artwork. Your downloaded file is not encrypted; keep it private.",
    );
    const actions = element("div", "", "cloud-import-options");
    let busy = false;
    function button(label, action) {
      const b = element("button", label, "button secondary");
      b.type = "button";
      b.addEventListener("click", async () => {
        if (busy || !allowed()) return;
        busy = true;
        dialog.setAttribute("aria-busy", "true");
        dialog
          .querySelectorAll("button,input")
          .forEach((n) => (n.disabled = true));
        status.textContent = "Working. Keep this page open.";
        try {
          await action();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          busy = false;
          dialog.removeAttribute("aria-busy");
          dialog
            .querySelectorAll("button,input")
            .forEach((n) => (n.disabled = false));
          deletion.disabled = confirmation.value !== "DELETE";
        }
      });
      return b;
    }
    const download = button("Download all my data", async () => {
      const data = await window.AccountData.exportData(),
        href = URL.createObjectURL(
          new Blob([JSON.stringify(data)], { type: "application/json" }),
        ),
        link = element("a");
      link.href = href;
      link.download =
        "pokedex-account-" + new Date().toISOString().slice(0, 10) + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      status.textContent =
        "Backup downloaded. Keep a private copy off this computer.";
    });
    const fileLabel = element("label", "Choose an account backup to restore");
    const file = element("input");
    file.id = "account-backup-file";
    fileLabel.htmlFor = file.id;
    file.type = "file";
    file.accept = ".json,application/json";
    const restore = button("Restore account backup", async () => {
      const selected = file.files[0];
      if (!selected) throw Error("Choose an account backup first.");
      if (selected.size > window.AccountBackup.maxBytes)
        throw Error("Backup exceeds 80 MB.");
      let data;
      try {
        const input = JSON.parse(await selected.text());
        await window.CardCatalogue?.ensure(input);
        data = window.AccountBackup.validate(input);
      } catch {
        throw Error("This file is not a valid account backup.");
      }
      if (
        !confirm(
          "Replace this account's saved binders and collection with " +
            data.binders.length +
            " binders and " +
            data.collection.records.length +
            " collection groups? Download your current data first. Existing artwork is kept for recovery.",
        )
      ) {
        status.textContent = "Restore cancelled. No saved records changed.";
        return;
      }
      await window.AccountData.restoreData(data);
      location.reload();
    });
    const warning = element(
      "p",
      "Delete removes your cloud binders, collection, artwork and sign-in account permanently. Once it starts, saving is locked until deletion finishes. Browser originals and downloaded backups remain on your devices. Encrypted operator backups expire after 7 days; scheduled cleanup and storage-provider processing can take longer.",
    );
    const deleteHeading = element("h3", "Delete account");
    const confirmationLabel = element("label", "Type DELETE to confirm");
    const confirmation = element("input");
    confirmation.id = "account-delete-confirmation";
    confirmation.autocomplete = "off";
    confirmation.spellcheck = false;
    confirmationLabel.htmlFor = confirmation.id;
    const deletion = button("Delete my account permanently", async () => {
      await window.AccountData.deleteAccount(confirmation.value);
    });
    deletion.classList.add("account-danger");
    deletion.disabled = true;
    confirmation.addEventListener(
      "input",
      () => (deletion.disabled = confirmation.value !== "DELETE"),
    );
    const reauth = button("Sign in again with Google", () =>
      repo.signIn(location.origin + location.pathname),
    );
    const recent = element(
      "p",
      "Deletion requires a sign-in from the last 10 minutes. If asked, sign in again, then return here to confirm or retry.",
    );
    const close = element("button", "Close", "button secondary");
    close.type = "button";
    close.addEventListener("click", () => dialog.close());
    const footer = element("div", "", "cloud-dialog-actions");
    footer.append(close);
    actions.append(download, fileLabel, file, restore);
    dialog.append(
      heading,
      explanation,
      actions,
      deleteHeading,
      warning,
      recent,
      reauth,
      confirmationLabel,
      confirmation,
      deletion,
      status,
      footer,
    );
    document.body.append(dialog);
    trigger.addEventListener("click", () => {
      if (!allowed()) return;
      document.querySelector(".account").open = false;
      dialog.showModal();
    });
    dialog.addEventListener("cancel", (e) => {
      if (busy) e.preventDefault();
    });
    dialog.addEventListener("close", () => {
      confirmation.value = "";
      deletion.disabled = true;
      document.querySelector(".account > summary").focus();
    });
    window.addEventListener("pokedex-account-changed", () => {
      dialog.close();
      file.value = "";
      status.textContent = "";
    });
  });
})();
