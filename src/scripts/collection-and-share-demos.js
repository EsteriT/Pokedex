(() => {
  const reduced = () => window.DemoMotion.reduced();
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls || "";
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const ids = ["166", "167", "198", "168", "169", "199", "170", "171", "200"];
  function card(id) {
    const d = window.CARDS.find((c) => c.collectorNumber === id),
      n = el("div", "cs-card"),
      img = el("img");
    img.src = d.imageUrl;
    img.alt = d.name;
    img.loading = "lazy";
    n.append(img);
    return n;
  }
  function icon(kind) {
    const n = el("span", "showcase-icon");
    n.setAttribute("aria-hidden", "true");
    const paths = {
      collection:
        '<rect x="4" y="3" width="12" height="16" rx="2"/><path d="M8 7h4M8 11h4M18 6h2v15H8v-2"/>',
      link: '<path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/>',
      image:
        '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
      print: '<path d="M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6zM17 11h1"/>',
    };
    n.innerHTML = '<svg viewBox="0 0 24 24">' + paths[kind] + "</svg>";
    return n;
  }
  function page() {
    const n = el("div", "cs-page");
    ids.forEach((id) => n.append(card(id)));
    return n;
  }
  function clean(id) {
    const s = document.getElementById(id);
    s.querySelector(".eyebrow")?.remove();
    s.querySelector(".chapter-head > p")?.remove();
    return [s, document.getElementById(id + "-features")];
  }
  // Each section owns its timeline; input cancels playback without losing state.
  function lifecycle(root, sequence) {
    let active = false,
      frame = 0;
    const timers = new Set();
    let userControlled = false,
      lastReduced = reduced();
    const later = (fn, ms) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (active && !userControlled) fn();
      }, ms);
      timers.add(id);
    };
    function stop() {
      timers.forEach(clearTimeout);
      timers.clear();
      window.DemoMotion.stopAnimations(root);
    }
    function start() {
      sequence(later);
      if (!reduced()) later(start, 15000);
    }
    const playback = window.DemoMotion.register(root, {
      onPause() {
        userControlled = true;
        stop();
      },
      onResume() {
        userControlled = false;
        active = false;
      },
    });
    function check() {
      frame = 0;
      if (lastReduced !== reduced()) {
        lastReduced = reduced();
        stop();
        active = false;
      }
      const y = window.DemoMotion.top(root),
        r = { top: y, bottom: y + root.offsetHeight },
        now =
          r.top < innerHeight * 0.9 &&
          r.bottom > 76 &&
          !document.hidden &&
          (reduced() || playback.allowed());
      if (now && !active) {
        active = true;
        if (!userControlled) start();
      } else if (!now && active) {
        active = false;
        stop();
      }
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("visibilitychange", schedule);
    document.addEventListener("demo-motion-change", schedule);
    check();
    return () => {
      userControlled = true;
      playback.pause();
      stop();
    };
  }
  function pulse(n) {
    if (!reduced())
      n.animate(
        [
          { opacity: 0.35, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 900 },
      );
  }
  const [, ch] = clean("collect"),
    dashboard = el("div", "collection-dashboard"),
    cards = el("div", "collection-cards"),
    metrics = el("div", "collection-metrics");
  const top = el("div", "collection-top");
  const setName = el("span", "collection-set", "Pokémon 151");
  setName.prepend(icon("collection"));
  top.append(setName, el("span", "showcase-badge", "Interactive sample"));
  dashboard.append(top);
  const owned = el("div", "collection-item"),
    missing = el("div", "collection-item is-missing"),
    wanted = el("div", "collection-item is-wanted");
  owned.append(card("166"), el("span", "collection-state", "Owned"));
  missing.append(card("168"), el("span", "collection-state", "Missing"));
  wanted.append(card("181"), el("span", "collection-state", "Wanted"));
  cards.append(owned, missing, wanted);
  const progress = el("div", "collection-progress"),
    progressTitle = el("h3", "", "Set progress"),
    count = el("strong", "collection-count", "174 / 207"),
    bar = el("div", "collection-bar"),
    fill = el("span"),
    progressCopy = el("p", "", "Cards collected in this set");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Sample set completion");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "207");
  bar.append(fill);
  progressTitle.append(el("span", "landing-future planned-badge", "Planned"));
  progress.append(progressTitle, count, bar, progressCopy);
  const value = el("div", "collection-value"),
    valueTitle = el("h3", "", "Collection value"),
    amount = el("strong", "collection-amount", "$428.60"),
    valueCopy = el("p", "", "Estimated collection value"),
    priceNote = el(
      "small",
      "",
      "Illustrative USD values · no live pricing connected",
    );
  valueTitle.append(el("span", "landing-future", "Planned"));
  value.append(valueTitle, amount, valueCopy, priceNote);
  metrics.append(progress, value);
  const body = el("div", "collection-body");
  body.append(cards, metrics);
  dashboard.append(body);
  const footer = el("div", "collection-footer"),
    description = el("div");
  description.append(
    el("h3", "", "Owned or wanted. All in one place."),
    el("p", "", "Add cards in My collection, then set quantity and condition."),
  );
  const mark = el("button", "collection-mark", "Mark Charmander as owned");
  mark.type = "button";
  footer.append(description, mark);
  dashboard.append(footer);
  ch.append(dashboard);
  const pointer = el("div", "cs-pointer");
  pointer.setAttribute("aria-hidden", "true");
  pointer.innerHTML =
    '<svg viewBox="0 0 24 30" width="22" height="28"><path d="M3 2v23l6-6 5 9 5-3-5-8h8Z" fill="#f1f5ff" stroke="#172338" stroke-width="1.6"/></svg>';
  dashboard.append(pointer);
  function update(isOwned) {
    missing.classList.toggle("is-missing", !isOwned);
    missing.querySelector(".collection-state").textContent = isOwned
      ? "Owned"
      : "Missing";
    bar.setAttribute("aria-valuenow", String(isOwned ? 175 : 174));
    count.textContent = isOwned ? "175 / 207" : "174 / 207";
    fill.style.width = ((isOwned ? 175 : 174) / 207) * 100 + "%";
    amount.textContent = isOwned ? "$440.20" : "$428.60";
    mark.textContent = isOwned
      ? "Charmander added ✓"
      : "Mark Charmander as owned";
    mark.disabled = isOwned;
    pointer.style.opacity = "0";
  }
  const takeControl = lifecycle(dashboard, (later) => {
    update(false);
    if (reduced()) return;
    later(() => {
      const r = mark.getBoundingClientRect(),
        b = dashboard.getBoundingClientRect();
      pointer.style.left = r.left - b.left + r.width * 0.6 + "px";
      pointer.style.top = r.top - b.top + r.height * 0.6 + "px";
      pointer.style.opacity = "1";
      pulse(pointer);
    }, 2000);
    later(() => {
      update(true);
      pulse(missing);
      pulse(count);
      pulse(amount);
    }, 4200);
  });
  mark.addEventListener("click", () => {
    takeControl();
    update(true);
    pulse(missing);
  });
  const [share, sh] = clean("share"),
    journey = el("div", "share-journey"),
    spread = el("div", "share-spread"),
    copy = el("div", "share-viewer-copy"),
    modes = el("div", "share-view-modes");
  spread.append(page(), page());
  spread.setAttribute("aria-label", "Sample binder pages");
  copy.append(
    el("h3", "share-public-description", "See your finished binder."),
    el(
      "p",
      "",
      "Open View in My binders. Browse one page or two, and zoom in on any card.",
    ),
  );
  const single = el("button", "", "One page"),
    double = el("button", "", "Two pages");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Sample binder view");
  [single, double].forEach((b) => (b.type = "button"));
  function setSpread(two) {
    spread.classList.toggle("is-single", !two);
    single.setAttribute("aria-pressed", String(!two));
    double.setAttribute("aria-pressed", String(two));
    spread.lastElementChild.hidden = !two;
  }
  modes.append(single, double);
  const link = el("a", "cta share-open", "Open sample binder");
  link.href =
    document.getElementById("viewer-route").getAttribute("href") +
    "?binder=sample-blue";
  copy.append(modes, link);
  const upcoming = share.querySelector(".section-upcoming");
  if (upcoming) copy.append(upcoming);
  journey.append(spread, copy);
  sh.append(journey);
  const control = lifecycle(journey, (later) => {
    setSpread(true);
    if (!reduced()) {
      later(() => setSpread(false), 5000);
      later(() => setSpread(true), 10000);
    }
  });
  single.addEventListener("click", () => {
    control();
    setSpread(false);
  });
  double.addEventListener("click", () => {
    control();
    setSpread(true);
  });
})();
