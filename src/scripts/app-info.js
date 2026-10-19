(() => {
  "use strict";
  const panel = document.querySelector(".account-panel"),
    dialog = document.getElementById("app-credits");
  if (!panel || !dialog) return;
  const links = document.createElement("div");
  links.className = "app-info-links";
  const help = document.createElement("a");
  help.href = dialog.querySelector('a[href$="#faq"]').href;
  help.textContent = "Help & FAQ";
  const about = document.createElement("button");
  about.type = "button";
  about.className = "button secondary";
  about.textContent = "About & credits";
  about.addEventListener("click", () => dialog.showModal());
  links.append(help, about);
  const attach = () => panel.append(links);
  attach();
  // The signed-in menu is rebuilt once its account has loaded.
  if (window.BinderRepository?.enabled)
    window.BinderRepository.ready.then(attach, attach);
})();
