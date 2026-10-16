/* Mobile navigation stays inline; desktop navigation remains always visible. */
(() => {
  const toggle = document.querySelector(".landing-menu-toggle");
  const nav = document.getElementById("landing-navigation");
  const mobile = window.matchMedia("(max-width: 1100px)");
  function setOpen(open, returnFocus = false) {
    toggle.setAttribute("aria-expanded", String(open));
    nav.hidden = mobile.matches && !open;
    if (returnFocus) toggle.focus();
  }
  function sync() {
    toggle.hidden = !mobile.matches;
    setOpen(false);
  }
  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", (event) => {
    if (mobile.matches && event.target.closest("a")) setOpen(false, true);
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      mobile.matches &&
      toggle.getAttribute("aria-expanded") === "true"
    ) {
      setOpen(false, true);
    }
  });
  mobile.addEventListener("change", sync);
  // A viewport change must not retain a horizontal offset from the wider layout.
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (window.scrollX)
        window.scrollTo({ left: 0, top: window.scrollY, behavior: "instant" });
    });
  });
  sync();
})();

function openFutureTarget(hash) {
  if (!hash.startsWith("#future-")) return;
  const target = document.getElementById(hash.slice(1));
  if (target?.matches("details")) target.open = true;
}
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#future-']");
  if (link) openFutureTarget(link.getAttribute("href"));
});
window.addEventListener("hashchange", () => openFutureTarget(location.hash));
openFutureTarget(location.hash);
/* Animate FAQ height while leaving the question in normal document flow. */
document.querySelectorAll(".faq-question").forEach((details) => {
  const summary = details.querySelector("summary");
  let animation = null;
  summary.addEventListener("click", (event) => {
    event.preventDefault();
    if (animation) return;
    const opening = !details.open,
      start = details.getBoundingClientRect().height;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      details.open = opening;
      return;
    }
    if (opening) details.open = true;
    const end = opening
      ? details.getBoundingClientRect().height
      : summary.getBoundingClientRect().height;
    details.style.overflow = "hidden";
    animation = details.animate(
      [{ height: start + "px" }, { height: end + "px" }],
      { duration: 280, easing: "cubic-bezier(.22,1,.36,1)" },
    );
    animation.onfinish = () => {
      details.open = opening;
      details.style.overflow = "";
      animation = null;
    };
  });
});
