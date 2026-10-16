(() => {
  const section = document.getElementById("discover"),
    host = document.getElementById("discover-features");
  const reduced = () => window.DemoMotion.reduced();
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls || "";
    if (text !== undefined) n.textContent = text;
    return n;
  };
  section.querySelector(".eyebrow")?.remove();
  section.querySelector(".chapter-head > p")?.remove();
  const panel = el("div", "discover-studio"),
    controls = el("div", "discover-controls"),
    results = el("div", "discover-results"),
    note = el("p", "discover-note");
  const searchLabel = el("label", "discover-search-label", "Find a card"),
    search = el("input", "discover-search");
  search.type = "search";
  search.placeholder = "Pokémon, card number, or set";
  search.setAttribute("aria-label", "Search the sample Pokémon cards");
  searchLabel.append(search);
  const filters = el("div", "discover-filters"),
    setLabel = el("label", "", "Set"),
    set = el("select"),
    rarityLabel = el("label", "", "Rarity"),
    rarity = el("select");
  set.append(new Option("Pokémon 151", "151"));
  setLabel.append(set);
  [
    ["All rarities", "all"],
    ["Illustration rare", "ir"],
    ["Special illustration rare", "sir"],
  ].forEach(([name, value]) => rarity.append(new Option(name, value)));
  rarityLabel.append(rarity);
  filters.append(setLabel, rarityLabel);
  const palette = el("div", "discover-palette"),
    paletteLabel = el("span", "", "Match a color");
  palette.append(paletteLabel);
  const palettes = [
    { name: "Ocean blue", color: "#80a9ca", ids: ["170", "171", "181", "200"] },
    {
      name: "Forest green",
      color: "#87aa91",
      ids: ["166", "167", "172", "198"],
    },
    {
      name: "Sunset amber",
      color: "#bf977e",
      ids: ["168", "169", "199", "173"],
    },
  ];
  const colorTools = el("div", "discover-color-tools"),
    pickerLabel = el("label", "discover-picker-label", "Pick a shade"),
    picker = el("input", "discover-picker"),
    hueLabel = el("label", "discover-hue-label", "Hue"),
    hue = el("input", "discover-hue"),
    hex = el("output", "discover-hex", "#80A9CA");
  picker.type = "color";
  picker.value = "#80a9ca";
  picker.setAttribute("aria-label", "Choose a color to match");
  hue.type = "range";
  hue.min = "0";
  hue.max = "360";
  hue.step = "1";
  hue.value = "207";
  hue.setAttribute("aria-label", "Choose a hue");
  pickerLabel.append(picker);
  hueLabel.append(hue);
  hex.hidden = true;
  colorTools.append(pickerLabel, hueLabel, hex);
  palette.append(colorTools);
  const rgb = (value) =>
    [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  function colorHue(value) {
    const [r, g, b] = rgb(value).map((n) => n / 255),
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min;
    if (!d) return 0;
    const h =
      max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return Math.round((h * 60 + 360) % 360);
  }
  function hueHex(degrees) {
    const h = degrees / 60,
      c = 0.5,
      x = c * (1 - Math.abs((h % 2) - 1)),
      m = 0.35;
    const channels =
      h < 1
        ? [c, x, 0]
        : h < 2
          ? [x, c, 0]
          : h < 3
            ? [0, c, x]
            : h < 4
              ? [0, x, c]
              : h < 5
                ? [x, 0, c]
                : [c, 0, x];
    return (
      "#" +
      channels
        .map((n) =>
          Math.round((n + m) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  function syncColor(value) {
    picker.value = value;
    hue.value = String(colorHue(value));
    hex.value = value.toUpperCase();
    hex.textContent = value.toUpperCase();
    hue.setAttribute("aria-valuetext", hue.value + " degrees");
  }
  function chooseColor(value) {
    interact();
    syncColor(value);
    const selected = rgb(value);
    chosen = palettes.reduce(
      (best, p) => {
        const distance = rgb(p.color).reduce(
          (sum, n, i) => sum + (n - selected[i]) ** 2,
          0,
        );
        return distance < best.distance ? { palette: p, distance } : best;
      },
      { palette: palettes[0], distance: Infinity },
    ).palette;
    search.value = "";
    rarity.value = "all";
    render();
    note.textContent = "Closest sample matches to " + value.toUpperCase() + ".";
  }
  picker.addEventListener("focus", interact);
  picker.addEventListener("input", () => chooseColor(picker.value));
  hue.addEventListener("pointerdown", interact);
  hue.addEventListener("keydown", interact);
  hue.addEventListener("input", () => chooseColor(hueHex(Number(hue.value))));
  let chosen = null,
    userMode = false,
    active = false,
    scene = 0,
    lastReduced = reduced();
  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const cursor = el("div", "discover-cursor");
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML =
    '<svg viewBox="0 0 24 30" width="22" height="28"><path d="M3 2v23l6-6 5 9 5-3-5-8h8Z" fill="#f1f5ff" stroke="#172338" stroke-width="1.6"/></svg>';
  function cancel() {
    timers.forEach(clearTimeout);
    timers.clear();
    cursor.getAnimations().forEach((a) => a.cancel());
    cursor.style.opacity = "0";
  }
  let playback;
  function interact() {
    cancel();
    userMode = true;
    playback?.pause();
  }
  function point(node) {
    const r = node.getBoundingClientRect(),
      b = panel.getBoundingClientRect();
    const x = r.left - b.left + r.width * 0.6,
      y = r.top - b.top + r.height * 0.65,
      oldX = parseFloat(cursor.style.left) || 24,
      oldY = parseFloat(cursor.style.top) || 24;
    cursor.style.left = x + "px";
    cursor.style.top = y + "px";
    cursor.style.opacity = "1";
    if (!reduced())
      cursor.animate(
        [
          { transform: `translate(${oldX - x}px,${oldY - y}px)` },
          { transform: "translate(0,0)" },
        ],
        { duration: 900, easing: "ease-in-out" },
      );
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    let cards = window.CARDS.filter(
      (c) =>
        !query ||
        query === "151" ||
        c.name.toLowerCase().includes(query) ||
        c.collectorNumber === query ||
        String(Number(c.collectorNumber)) === query,
    );
    if (rarity.value === "ir")
      cards = cards.filter(
        (c) =>
          Number(c.collectorNumber) >= 166 && Number(c.collectorNumber) <= 182,
      );
    if (rarity.value === "sir")
      cards = cards.filter(
        (c) =>
          Number(c.collectorNumber) >= 198 && Number(c.collectorNumber) <= 204,
      );
    if (chosen)
      cards = cards.filter((c) => chosen.ids.includes(c.collectorNumber));
    if (!query && rarity.value === "all" && !chosen)
      cards = ["166", "167", "170", "181"].map((id) =>
        window.CARDS.find((c) => c.collectorNumber === id),
      );
    results.replaceChildren();
    cards.slice(0, 4).forEach((data) => {
      const item = el("div", "discover-card"),
        img = el("img");
      img.src = data.imageUrl;
      img.alt = data.name;
      img.loading = "lazy";
      item.append(
        img,
        el("span", "", data.name),
        el("small", "", "151 · #" + data.collectorNumber),
      );
      results.append(item);
    });
    if (!cards.length)
      results.append(
        el(
          "p",
          "discover-empty",
          "No matches in this sample. Try Squirtle or 181.",
        ),
      );
    [...palette.querySelectorAll("button[data-palette]")].forEach((n, i) =>
      n.setAttribute("aria-pressed", String(chosen === palettes[i])),
    );
  }
  search.addEventListener("focus", interact);
  search.addEventListener("input", () => {
    interact();
    chosen = null;
    render();
    note.textContent = "Search a name, number or set.";
  });
  set.addEventListener("focus", interact);
  rarity.addEventListener("focus", interact);
  rarity.addEventListener("change", () => {
    interact();
    chosen = null;
    render();
    note.textContent = "Find the printing you are looking for.";
  });
  const sampleNote = el(
    "p",
    "discover-sample-note",
    "Sample cards · Curated color matches",
  );
  controls.append(searchLabel, filters, palette);
  panel.append(controls, results, note, sampleNote, cursor);
  const summaries = el("div", "discover-summaries");
  const copy = [
    ["Find a card.", "Search by Pokémon, card number, or set."],
    ["Narrow it down.", "Choose a set and rarity."],
    ["Match your style.", "Pick a color for matching artwork."],
  ];
  copy.forEach(([title, text], i) => {
    const item = el("button", "discover-summary");
    item.type = "button";
    item.append(el("h3", "", title), el("p", "", text));
    item.addEventListener("click", () => {
      cancel();
      userMode = false;
      scene = i;
      playback.resume();
      active = true;
      play();
    });
    summaries.append(item);
  });
  host.append(panel, summaries);
  playback = window.DemoMotion.register(panel, {
    onPause() {
      cancel();
      userMode = true;
    },
    onResume() {
      userMode = false;
      active = false;
    },
  });
  function play() {
    if (!active && !reduced()) return;
    chosen = null;
    search.value = "";
    rarity.value = "all";
    [...summaries.children].forEach((n, i) => {
      n.classList.toggle("is-current", i === scene);
      n.setAttribute("aria-pressed", String(i === scene));
    });
    render();
    note.textContent = copy[scene][1];
    if (reduced()) {
      if (scene === 0) search.value = "Squirtle";
      if (scene === 1) {
        rarity.value = "ir";
        note.textContent = "Pokémon 151 · Illustration rare";
      }
      if (scene === 2) {
        chosen = palettes[1];
        syncColor(chosen.color);
        note.textContent = "Closest matches from the sample palettes.";
      }
      cursor.style.opacity = "0";
      render();
      return;
    }
    if (scene === 0) {
      point(search);
      later(() => {
        const word = "Squirtle";
        [...word].forEach((_, i) =>
          later(() => {
            search.value = word.slice(0, i + 1);
            render();
          }, i * 150),
        );
      }, 1200);
    }
    if (scene === 1) {
      point(rarity);
      later(() => {
        rarity.value = "ir";
        render();
        note.textContent = "Pokémon 151 · Illustration rare";
      }, 1500);
    }
    if (scene === 2) {
      point(hue);
      later(() => {
        chosen = palettes[0];
        syncColor(chosen.color);
        render();
        note.textContent = "Slide to a shade that fits your page.";
      }, 1500);
      later(() => point(picker), 4800);
      later(() => {
        chosen = palettes[1];
        syncColor(chosen.color);
        render();
        note.textContent = "Closest matches from the sample palettes.";
      }, 6200);
    }
    later(() => {
      scene = (scene + 1) % copy.length;
      play();
    }, 10000);
  }
  let frame = 0;
  function check() {
    frame = 0;
    if (lastReduced !== reduced()) {
      lastReduced = reduced();
      cancel();
      if (!userMode) {
        active = false;
      }
    }
    const y = window.DemoMotion.top(panel),
      inView =
        y < innerHeight * 0.88 &&
        y + panel.offsetHeight > 76 &&
        !document.hidden &&
        (reduced() || playback.allowed());
    if (inView && !active) {
      active = true;
      if (!userMode) {
        play();
      }
    } else if (!inView && active) {
      active = false;
      cancel();
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(check);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  document.addEventListener("demo-motion-change", schedule);
  render();
  check();
})();
