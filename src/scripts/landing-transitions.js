/* One entrance system for the landing page; demo timelines remain independent. */
(() => {
  const motion = window.DemoMotion;
  const targets = [];
  let frame = 0;
  document.querySelectorAll("main > .chapter").forEach((section) => {
    const heading = section.querySelector(".chapter-head");
    if (heading) targets.push({ node: heading, delay: 0 });
    const nodes =
      section.id === "arrange"
        ? [
            section.querySelector(".arrange-stage"),
            section.querySelector(".arrange-summaries"),
          ]
        : section.id === "customize"
          ? [...section.querySelectorAll(".customize-tile")]
          : section.id === "discover"
            ? [
                section.querySelector(".discover-studio"),
                section.querySelector(".discover-summaries"),
              ]
            : [
                section.querySelector(".collection-dashboard") ||
                  section.querySelector(".share-journey"),
              ];
    nodes
      .filter(Boolean)
      .forEach((node, i) =>
        targets.push({ node, delay: 80 + Math.min(i, 2) * 70 }),
      );
  });
  document
    .querySelectorAll(".landing-faq, .closing")
    .forEach((node) => targets.push({ node, delay: 0 }));
  const pending = new Set();
  // Content already on screen (including a direct anchor destination) stays visible.
  targets.forEach((target) => {
    if (!motion.reduced() && motion.top(target.node) >= innerHeight * 0.94) {
      target.node.classList.add("landing-enter-pending");
      pending.add(target);
    }
  });
  function show(target, animate) {
    pending.delete(target);
    target.node.classList.remove("landing-enter-pending");
    if (animate) {
      if (target.node.classList.contains("customize-tile"))
        target.node.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 180,
          easing: "cubic-bezier(.22,1,.36,1)",
        });
      else motion.reveal(target.node, target.delay);
    }
  }
  function check() {
    frame = 0;
    pending.forEach((target) => {
      const y = motion.top(target.node);
      if (motion.reduced() || y < innerHeight * 0.94) {
        show(target, !motion.reduced() && y + target.node.offsetHeight > 0);
      }
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(check);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("demo-motion-change", schedule);
  document.addEventListener("focusin", (event) => {
    pending.forEach((target) => {
      if (target.node.contains(event.target)) show(target, false);
    });
  });
  check();
})();
