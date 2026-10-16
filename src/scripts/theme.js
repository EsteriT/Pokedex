(() => {
  const key = "pokedex-preview-theme",
    system = matchMedia("(prefers-color-scheme: dark)");
  const valid = (value) => ["light", "dark", "system"].includes(value);
  let choice = "light";
  try {
    const saved = localStorage.getItem(key);
    if (valid(saved)) choice = saved;
  } catch {}
  function apply() {
    document.documentElement.dataset.theme =
      choice === "system" ? (system.matches ? "dark" : "light") : choice;
    document.documentElement.dataset.themeChoice = choice;
  }
  apply();
  system.addEventListener("change", () => {
    if (choice === "system") apply();
  });
  document.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("theme-choice");
    const toggle = document.getElementById("theme-toggle");
    function save(value) {
      choice = value;
      try {
        localStorage.setItem(key, choice);
      } catch {}
      apply();
      if (toggle) {
        const dark = document.documentElement.dataset.theme === "dark";
        toggle.setAttribute("aria-pressed", String(dark));
        toggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
        toggle.setAttribute("aria-label", toggle.title);
      }
    }
    if (toggle) {
      toggle.addEventListener("click", () =>
        save(
          document.documentElement.dataset.theme === "dark" ? "light" : "dark",
        ),
      );
      save(choice);
    }
    if (!select) return;
    select.value = choice;
    select.addEventListener("change", () => {
      if (!valid(select.value)) return;
      choice = select.value;
      try {
        localStorage.setItem(key, choice);
      } catch {}
      apply();
    });
  });
})();
