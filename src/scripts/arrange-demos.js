(() => {
  const container = document.getElementById("arrange-features");
  const reduced = () => window.DemoMotion.reduced();
  const ids = ["166", "167", "198", "168", "169", "199", "170", "171", "200"];
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls || "";
    if (text !== undefined) n.textContent = text;
    return n;
  };
  function card(id) {
    const data = window.CARDS.find((c) => c.collectorNumber === id);
    const n = el("div", "card");
    const img = el("img");
    img.src = data.imageUrl;
    img.alt = data.name;
    img.draggable = false;
    img.loading = "lazy";
    img.onerror = () => n.classList.add("failed");
    n.append(img, el("span", "fallback", data.name));
    return n;
  }
  function page(values) {
    const g = el("div", "page-grid");
    values.forEach((id) => {
      const p = el("div", "pocket");
      if (id) p.append(card(id));
      else p.textContent = "+";
      g.append(p);
    });
    return g;
  }
  function mini(values, label) {
    const n = el("div", "mini-page");
    n.append(page(values), el("div", "arrange-page-label", label));
    return n;
  }
  const definitions = [
    [
      "Place and swap cards.",
      "Drag a card into a pocket. Swap two cards or make room for another.",
      "placement",
    ],
    [
      "Organize your pages.",
      "Reorder whole pages or move a card to the next one.",
      "pages",
    ],
    [
      "Copy and undo.",
      "Copy cards between binders. Undo a change whenever you need.",
      "copy",
    ],
    [
      "Start with a set.",
      "Coming soon: add a whole set and arrange by number or evolution.",
      "set",
    ],
  ];
  function controller(article, stage, kind) {
    let running = false,
      cursor,
      cursorX = 20,
      cursorY = 20,
      sceneIndex = 0;
    const timers = new Set(),
      motions = new Set();
    function later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (running) fn();
      }, ms * 2);
      timers.add(id);
    }
    function motion(node, frames, duration = 800) {
      if (reduced()) return;
      const animation = node.animate(frames, {
        duration: duration * 1.6,
        easing: "cubic-bezier(.22,.68,0,1)",
        fill: "both",
      });
      motions.add(animation);
      animation.onfinish = () => {
        animation.cancel();
        motions.delete(animation);
      };
      return animation;
    }
    function point(node, press = false, duration = 550) {
      if (!cursor || reduced()) return;
      const rect = node.getBoundingClientRect(),
        base = stage.getBoundingClientRect();
      const x = rect.left - base.left + rect.width * 0.55,
        y = rect.top - base.top + rect.height * 0.45;
      const dx = cursorX - x,
        dy = cursorY - y;
      cursor.style.left = x + "px";
      cursor.style.top = y + "px";
      cursor.style.opacity = "1";
      motion(
        cursor,
        [
          { transform: `translate(${dx}px,${dy}px)` },
          { transform: "translate(0,0)" },
        ],
        duration,
      );
      cursorX = x;
      cursorY = y;
      if (press)
        later(() => {
          cursor.classList.add("is-pressing");
          later(() => cursor.classList.remove("is-pressing"), 250);
        }, duration * 0.8);
    }
    function flip(nodes, change) {
      const before = nodes.map((n) => n.getBoundingClientRect());
      change();
      nodes.forEach((n, i) => {
        const after = n.getBoundingClientRect();
        motion(n, [
          {
            transform: `translate(${before[i].left - after.left}px,${before[i].top - after.top}px)`,
          },
          { transform: "translate(0,0)" },
        ]);
      });
    }
    function fly(source, target, id, move = false) {
      point(source, true);
      later(() => {
        const origin = source.parentElement;
        const a = source.getBoundingClientRect(),
          b = target.getBoundingClientRect(),
          r = stage.getBoundingClientRect();
        const floating = card(id);
        floating.classList.add("arrange-float");
        Object.assign(floating.style, {
          left: a.left - r.left + "px",
          top: a.top - r.top + "px",
          width: a.width + "px",
        });
        stage.append(floating);
        source.style.opacity = ".25";
        point(target, false, 900);
        motion(
          floating,
          [
            { transform: "translate(0,0)" },
            { transform: `translate(${b.left - a.left}px,${b.top - a.top}px)` },
          ],
          900,
        );
        later(() => {
          target.replaceChildren(card(id));
          source.style.opacity = "1";
          if (move) origin.replaceChildren("+");
          floating.remove();
          cursor.classList.add("is-pressing");
          later(() => cursor.classList.remove("is-pressing"), 250);
        }, 880);
      }, 500);
    }
    function build() {
      stage.replaceChildren();
      const caption = el("div", "arrange-step");
      const say = (text) => (caption.textContent = text);
      if (kind === "placement") {
        const tray = el("div", "arrange-tray");
        tray.append(el("span", "", "Your cards"), card("173"), card("172"));
        const board = page([
          "166",
          "167",
          null,
          "168",
          "169",
          null,
          "170",
          "171",
          "200",
        ]);
        stage.append(tray, board, caption);
        say("Drag a card into an empty pocket");
        if (running && !reduced()) {
          later(() => fly(tray.children[1], board.children[2], "173"), 600);
          later(() => {
            say("Swap two cards to change their positions");
            point(board.children[0], true);
          }, 1900);
          later(() => point(board.children[8], true), 2450);
          later(() => {
            const a = board.children[0],
              b = board.children[8],
              first = a.firstElementChild,
              last = b.firstElementChild;
            flip([first, last], () => {
              a.replaceChildren(last);
              b.replaceChildren(first);
            });
          }, 3000);
          later(() => {
            say("Move cards aside to make room");
            point(tray.children[2], true);
          }, 4100);
          later(() => point(board.children[3]), 4450);
          later(() => {
            const cells = [
                board.children[3],
                board.children[4],
                board.children[5],
              ],
              cards = cells.slice(0, 2).map((p) => p.firstElementChild);
            const before = cards.map((n) => n.getBoundingClientRect());
            cells[2].replaceChildren(cards[1]);
            cells[1].replaceChildren(cards[0]);
            cells[0].replaceChildren(card("172"));
            cards.slice(0, 2).forEach((n, i) => {
              const b = n.getBoundingClientRect();
              motion(n, [
                { transform: `translate(${before[i].left - b.left}px,0)` },
                { transform: "translate(0,0)" },
              ]);
            });
          }, 5000);
        }
      } else if (kind === "pages") {
        const row = el("div", "arrange-page-row");
        const first = mini(ids, "Page 1"),
          second = mini(ids.slice().reverse(), "Page 2"),
          third = mini(
            ["170", "171", null, null, null, null, null, null, null],
            "Page 3",
          );
        row.append(first, second, third);
        stage.append(row, caption);
        say("Reorder a whole page");
        if (running && !reduced()) {
          later(() => point(second, true), 150);
          later(() => point(first), 650);
          later(() => flip([...row.children], () => row.prepend(second)), 1300);
          later(() => {
            say("Move a card → next page");
            fly(
              first.querySelector(".card"),
              third.querySelector(".page-grid").children[2],
              "166",
              true,
            );
          }, 3000);
        }
      } else if (kind === "copy") {
        const source = mini(ids, "Binder A"),
          dest = mini(
            ["170", "171", null, null, null, null, null, null, null],
            "Binder B",
          );
        const arrow = el("span", "scene-arrow", "→");
        stage.append(source, arrow, dest, caption);
        const keys = el(
          "div",
          "arrange-shortcuts",
          "Copy cards · Try a change · Go back",
        );
        stage.append(keys);
        say("Select several → copy to another binder");
        if (running && !reduced()) {
          later(() => {
            point(source.querySelectorAll(".card")[0], true);
            source
              .querySelectorAll(".card")[0]
              .classList.add("arrange-selected");
          }, 600);
          later(() => {
            point(source.querySelectorAll(".card")[1], true);
            source
              .querySelectorAll(".card")[1]
              .classList.add("arrange-selected");
          }, 1200);
          later(
            () => point(dest.querySelector(".page-grid").children[2], true),
            1800,
          );
          later(() => {
            dest
              .querySelector(".page-grid")
              .children[2].replaceChildren(card("166"));
            dest
              .querySelector(".page-grid")
              .children[3].replaceChildren(card("167"));
            motion(dest, [{ opacity: 0.4 }, { opacity: 1 }]);
            say("Two cards copied together");
          }, 2500);
          later(() => point(keys, true), 3500);
          later(() => {
            dest.querySelector(".page-grid").children[2].replaceChildren("+");
            dest.querySelector(".page-grid").children[3].replaceChildren("+");
            say("Undo → return to before the edit");
          }, 4200);
          later(() => point(keys, true), 5100);
          later(() => {
            dest
              .querySelector(".page-grid")
              .children[2].replaceChildren(card("166"));
            dest
              .querySelector(".page-grid")
              .children[3].replaceChildren(card("167"));
            say("Redo → bring the cards back");
          }, 5800);
        }
      } else {
        const board = page([
          "200",
          "169",
          "166",
          "199",
          "171",
          "167",
          "170",
          "198",
          "168",
        ]);
        board.classList.add("arrange-sort-grid");
        stage.append(board, caption);
        say("Add a set → arrange by number");
        const sort = el("span", "arrange-demo-action", "Sort: number");
        stage.append(sort);
        if (running && !reduced()) {
          later(() => point(sort, true), 400);
          later(() => {
            const nodes = [...board.children],
              numbers = [
                "200",
                "169",
                "166",
                "199",
                "171",
                "167",
                "170",
                "198",
                "168",
              ];
            flip(nodes, () => {
              numbers
                .map((id, i) => ({ id, node: nodes[i] }))
                .sort((a, b) => Number(a.id) - Number(b.id))
                .forEach(({ node }) => board.append(node));
            });
            say("Sorted by number");
          }, 1300);
          later(() => {
            sort.textContent = "Arrange: evolution lines";
            point(sort, true);
          }, 3000);
          later(() => {
            say("Or compose it your way");
            const nodes = [...board.children];
            flip(nodes, () =>
              [0, 1, 6, 2, 3, 7, 4, 5, 8].forEach((i) =>
                board.append(nodes[i]),
              ),
            );
          }, 3900);
        }
      }
      cursor = el("div", "arrange-demo-cursor");
      cursor.setAttribute("aria-hidden", "true");
      cursor.innerHTML =
        '<svg viewBox="0 0 24 30" width="22" height="28"><path d="M3 2v23l6-6 5 9 5-3-5-8h8Z" fill="#f1f5ff" stroke="#172338" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      cursorX = 20;
      cursorY = 20;
      stage.append(cursor);
    }
    function cycle() {
      kind = definitions[sceneIndex][2];
      article.querySelectorAll(".arrange-summary").forEach((node, i) => {
        node.classList.toggle("is-current", i === sceneIndex);
        node.setAttribute("aria-pressed", String(i === sceneIndex));
      });
      build();
      sceneIndex = (sceneIndex + 1) % definitions.length;
      if (running && !reduced()) later(cycle, 7800);
    }
    function pause() {
      if (!running) return;
      running = false;
      timers.forEach(clearTimeout);
      timers.clear();
      motions.forEach((a) => a.cancel());
      motions.clear();
      sceneIndex = (sceneIndex + definitions.length - 1) % definitions.length;
    }
    function stop() {
      running = false;
      timers.forEach(clearTimeout);
      timers.clear();
      motions.forEach((a) => a.cancel());
      motions.clear();
      sceneIndex = 0;
      kind = "placement";
      build();
    }
    build();
    return {
      start() {
        if (running) return;
        running = true;
        cycle();
      },
      replay(index) {
        stop();
        sceneIndex = index;
        running = true;
        cycle();
      },
      pause,
      stop,
    };
  }
  container.replaceChildren();
  const article = el("article", "arrange-demo arrange-unified"),
    stage = el("div", "arrange-stage"),
    summaries = el("div", "arrange-summaries");
  stage.setAttribute("role", "group");
  stage.setAttribute(
    "aria-label",
    "Continuous walkthrough: place cards, arrange pages, copy and undo, and sort a set",
  );
  definitions.forEach(([title, copy], index) => {
    const summary = el("div", "arrange-summary");
    summary.setAttribute("role", "button");
    summary.tabIndex = 0;
    summary.setAttribute("aria-label", "Show demonstration: " + title);
    summary.setAttribute("aria-pressed", "false");
    summary.append(el("h3", "", title), el("p", "", copy));
    const select = () => {
      playback.resume();
      demo.replay(index);
    };
    summary.addEventListener("click", select);
    summary.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    summaries.append(summary);
  });
  article.append(stage, summaries);
  container.append(article);
  const demo = controller(article, stage, "placement");
  const playback = window.DemoMotion.register(stage, {
    onPause: () => demo.pause(),
    onResume() {
      visible = false;
    },
  });
  let visible = false,
    scrollFrame = 0,
    lastReduced = reduced();
  function check() {
    scrollFrame = 0;
    if (lastReduced !== reduced()) {
      lastReduced = reduced();
      demo.pause();
      visible = false;
    }
    const top = window.DemoMotion.top(stage),
      nowVisible =
        top < window.innerHeight * 0.88 &&
        top + stage.offsetHeight > 76 &&
        (reduced() || playback.allowed());
    if (nowVisible && !visible && !document.hidden) demo.start();
    else if (!nowVisible && visible) demo.pause();
    visible = nowVisible;
  }
  function onScroll() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(check);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  document.addEventListener("visibilitychange", onScroll);
  document.addEventListener("demo-motion-change", onScroll);
  check();
})();
