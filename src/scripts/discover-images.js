/* Start visible Discover artwork first, without fetching hidden views. */
(() => {
  "use strict";
  const pending = new Set();
  const load = (image, priority = "auto") => {
    if (!image.dataset.cardSrc) return;
    image.loading = "eager";
    image.fetchPriority = priority;
    image.src = image.dataset.cardSrc;
    delete image.dataset.cardSrc;
    observer?.unobserve(image);
    pending.delete(image);
  };
  const observer = window.IntersectionObserver
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) load(entry.target);
        },
        { rootMargin: "200px 0px" },
      )
    : null;
  function watch(root = document) {
    for (const image of pending)
      if (!image.isConnected) {
        observer?.unobserve(image);
        pending.delete(image);
      }
    let first = true;
    for (const image of root.querySelectorAll("img[data-card-src]")) {
      const rect = image.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < innerHeight &&
        rect.bottom > 0 &&
        rect.left < innerWidth &&
        rect.right > 0;
      if (visible) {
        load(image, first ? "high" : "auto");
        first = false;
      } else if (observer) {
        pending.add(image);
        observer.observe(image);
      } else if (!image.closest("[hidden]")) load(image);
    }
  }
  // Set the initial view before either asynchronous catalogue renderer runs.
  const sets = new URLSearchParams(location.search).get("view") === "sets";
  document.getElementById("discover-cards-panel").hidden = sets;
  document.getElementById("discover-sets-panel").hidden = !sets;
  window.DiscoverImages = { watch };
})();
