(() => {
  const entrances = new WeakSet(),
    revealed = new WeakSet(),
    activeEntrances = new Set(),
    preference = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  function top(root) {
    let y = 0;
    for (let n = root; n; n = n.offsetParent) y += n.offsetTop;
    return y - window.scrollY;
  }
  function visible(entry) {
    const y = top(entry.root),
      bottom = y + entry.root.offsetHeight;
    return (
      !document.hidden &&
      bottom > 96 &&
      y < innerHeight - 48 &&
      Math.min(bottom, innerHeight) - Math.max(y, 76) > 48
    );
  }
  function update() {
    frame = 0;
    document.dispatchEvent(new Event("demo-motion-change"));
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.DemoMotion = {
    top,
    reduced: () => preference.matches,
    reveal(node, delay = 0) {
      if (preference.matches || revealed.has(node)) return;
      revealed.add(node);
      const animation = node.animate(
        [
          { opacity: 0, transform: "translateY(20px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        {
          duration: 1050,
          delay,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        },
      );
      entrances.add(animation);
      activeEntrances.add(animation);
      animation.finished.then(
        () => activeEntrances.delete(animation),
        () => activeEntrances.delete(animation),
      );
    },
    stopAnimations(root) {
      root.getAnimations({ subtree: true }).forEach((animation) => {
        if (!entrances.has(animation)) animation.cancel();
      });
    },
    register(root, { onResume = () => {}, onPause = () => {} } = {}) {
      const entry = { root, paused: false };
      const api = {
        allowed: () => !entry.paused && !preference.matches && visible(entry),
        visible: () => visible(entry),
        pause() {
          entry.paused = true;
          onPause();
          schedule();
        },
        resume() {
          entry.paused = false;
          onResume();
          schedule();
        },
      };
      schedule();
      return api;
    },
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  preference.addEventListener("change", () => {
    if (preference.matches)
      activeEntrances.forEach((animation) => animation.finish());
    schedule();
  });
})();
