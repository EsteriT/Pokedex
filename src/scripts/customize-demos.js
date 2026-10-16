/* Four focused lessons, with one interruptible animation controller. */
(() => {
  "use strict";
  const motion = window.DemoMotion;
  const host = document.getElementById("customize-features");
  const section = document.getElementById("customize");
  const themes = [
    ["poke", "Poké Ball"],
    ["great", "Great Ball"],
    ["ultra", "Ultra Ball"],
    ["master", "Master Ball"],
    ["premier", "Premier Ball"],
  ];
  const timing = {
    step: 800,
    travel: 420,
    rest: 9000,
    idle: 6000,
    initial: 800,
  };
  const transitionDuration = (node) =>
    node.closest(".lesson-panel")?.dataset.playback === "playing"
      ? timing.travel
      : 180;
  const easing = "cubic-bezier(.22,1,.36,1)";
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    node.className = cls || "";
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function button(label, text = label) {
    const node = make("button", "lesson-button", text);
    node.type = "button";
    node.setAttribute("aria-label", label);
    return node;
  }
  function lesson(title, description, kind) {
    const tile = make("article", "customize-tile");
    const copy = make("div", "customize-tile-copy");
    copy.append(make("h3", "", title), make("p", "", description));
    const panel = make("div", "panel lesson-panel");
    panel.dataset.lesson = kind;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", title);
    const preview = make("div", "lesson-preview");
    const controls = make("div", "lesson-controls");
    const caption = make("p", "lesson-caption");
    const live = make("span", "lesson-live");
    live.setAttribute("role", "status");
    panel.append(preview, controls, caption, live);
    tile.append(copy, panel);
    host.append(tile);
    return { panel, preview, controls, caption, live, touched: false };
  }
  function dots(parent, choose, label) {
    const row = make("div", "lesson-dots");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    const buttons = themes.map(([id, name], i) => {
      const dot = button(name + " " + label, "");
      dot.className = "lesson-dot";
      dot.dataset.theme = id;
      const drawing = make("span", "lesson-ball-dot");
      drawing.setAttribute("aria-hidden", "true");
      dot.append(drawing);
      dot.addEventListener("click", () => choose(i));
      row.append(dot);
      return dot;
    });
    parent.append(row);
    return {
      buttons,
      select(index) {
        buttons.forEach((node, i) =>
          node.setAttribute("aria-pressed", String(i === index)),
        );
      },
    };
  }
  function pulse(node) {
    if (!motion.reduced())
      node.animate([{ opacity: 0.55 }, { opacity: 1 }], {
        duration: transitionDuration(node),
        easing,
      });
  }
  function binder() {
    const box = lesson(
      "Design your binder.",
      "Five Ball covers. Choose rows and columns independently.",
      "binder",
    );
    let state = { theme: 0, rows: 3, columns: 3 };
    const book = make("div", "lesson-pocket-page");
    const cover = make("div", "lesson-cover-preview");
    cover.setAttribute("aria-hidden", "true");
    let paintedTheme = null,
      paintedLayout = "";
    book.setAttribute("aria-hidden", "true");
    const grid = make("div", "lesson-binder-grid");
    book.append(grid);
    box.preview.classList.add("lesson-binder-pair");
    box.preview.append(cover, book);
    const choices = dots(
      box.controls,
      (index) => {
        state.theme = index;
        paint(true);
      },
      "cover",
    );
    const layout = make("div", "lesson-steppers");
    const fields = ["rows", "columns"].map((key) => {
      const group = make("div", "lesson-stepper");
      const label = make(
        "span",
        "lesson-stepper-label",
        key === "rows" ? "Rows" : "Columns",
      );
      const track = make("div", "lesson-stepper-track");
      const less = button("Decrease " + key, "−"),
        more = button("Increase " + key, "+");
      const output = make("output", "lesson-stepper-value");
      output.setAttribute("aria-label", key === "rows" ? "Rows" : "Columns");
      less.addEventListener("click", () => {
        state[key] = Math.max(1, state[key] - 1);
        paint(true);
      });
      more.addEventListener("click", () => {
        state[key] = Math.min(6, state[key] + 1);
        paint(true);
      });
      track.append(less, output, more);
      group.append(label, track);
      layout.append(group);
      return { key, less, more, output };
    });
    box.controls.append(layout);
    function paint(user = false) {
      const theme = themes[state.theme][0];
      if (paintedTheme !== theme) {
        cover.replaceChildren(window.BinderCovers.create(theme));
        paintedTheme = theme;
        pulse(cover);
      }
      choices.select(state.theme);
      const layoutKey = state.rows + "x" + state.columns;
      if (paintedLayout !== layoutKey) {
        grid.replaceChildren();
        for (let i = 0; i < state.rows * state.columns; i++)
          grid.append(make("span", "lesson-binder-pocket"));
        paintedLayout = layoutKey;
        pulse(grid);
      }
      const availableHeight = Math.max(60, book.clientHeight - 16);
      const availableWidth = Math.max(40, book.clientWidth - 16);
      const gap = 3,
        ratio = 337 / 245;
      const cell = Math.min(
        (availableWidth - gap * (state.columns - 1)) / state.columns,
        (availableHeight - gap * (state.rows - 1)) / (state.rows * ratio),
      );
      grid.style.gridTemplateColumns = `repeat(${state.columns}, ${cell}px)`;
      grid.style.gridAutoRows = cell * ratio + "px";
      fields.forEach((field) => {
        field.output.value = String(state[field.key]);
        field.less.disabled = state[field.key] === 1;
        field.more.disabled = state[field.key] === 6;
      });
      box.caption.textContent = `${themes[state.theme][1]}, ${state.rows} × ${state.columns}, ${state.rows * state.columns} pockets`;
      if (user) box.live.textContent = box.caption.textContent;
    }
    new ResizeObserver(() => paint()).observe(book);
    paint();
    return Object.assign(box, {
      snapshot: () => ({ ...state }),
      restore: (value) => {
        state = value;
        paint();
      },
      start: () => {
        state = { theme: 0, rows: 3, columns: 3 };
        paint();
      },
      final: () => {
        state = { theme: 4, rows: 2, columns: 3 };
        paint();
      },
      steps: [1, 2, 3, 4]
        .map((index) => ({
          target: () => choices.buttons[index],
          apply: () => {
            state.theme = index;
            paint();
          },
        }))
        .concat([
          {
            target: () => fields[0].less,
            apply: () => {
              state.rows = 2;
              paint();
            },
          },
          {
            target: () => fields[1].more,
            apply: () => {
              state.columns = 4;
              paint();
            },
          },
        ]),
    });
  }
  function merge() {
    const box = lesson(
      "Make a bigger pocket.",
      "Select neighboring pockets, then merge a strip or square.",
      "merge",
    );
    let state = { selected: [], merged: null };
    const grid = make("div", "lesson-merge-grid");
    grid.setAttribute("role", "group");
    grid.setAttribute(
      "aria-label",
      "Select two adjacent pockets or four pockets in a two by two square, then press Merge",
    );
    const pockets = Array.from({ length: 9 }, (_, i) => {
      const pocket = button(
        "Pocket " + (Math.floor(i / 3) + 1) + ", " + ((i % 3) + 1),
        "+",
      );
      pocket.className = "lesson-merge-pocket";
      pocket.dataset.pocket = String(i);
      pocket.style.gridColumn = String((i % 3) + 1);
      pocket.style.gridRow = String(Math.floor(i / 3) + 1);
      pocket.addEventListener("click", () => select(i, true));
      grid.append(pocket);
      return pocket;
    });
    const merged = make("div", "lesson-merged-pocket");
    merged.setAttribute("role", "img");
    merged.setAttribute("aria-hidden", "true");
    grid.append(merged);
    box.preview.append(grid);
    const row = make("div", "lesson-merge-controls");
    const commit = button("Merge selected pockets", "Merge");
    const reset = button("Reset pocket demo", "Reset");
    reset.classList.add("lesson-reset");
    row.append(commit, reset);
    box.controls.append(row);
    commit.addEventListener("click", () => combine(true));
    reset.addEventListener("click", () => clear(true));

    function validSelection() {
      const list = state.selected;
      if (list.length === 2) {
        const [a, b] = list;
        return (
          Math.abs((a % 3) - (b % 3)) +
            Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) ===
          1
        );
      }
      if (list.length !== 4) return false;
      const xs = list.map((i) => i % 3),
        ys = list.map((i) => Math.floor(i / 3));
      return (
        Math.max(...xs) - Math.min(...xs) === 1 &&
        Math.max(...ys) - Math.min(...ys) === 1
      );
    }
    function select(index, user = false) {
      if (state.merged) return;
      state.selected = state.selected.includes(index)
        ? state.selected.filter((i) => i !== index)
        : [...state.selected, index];
      paint(user);
    }
    function combine(user = false) {
      if (state.merged || !validSelection()) return;
      state.merged = [...state.selected];
      state.selected = [];
      paint(user, true);
      if (user) reset.focus({ preventScroll: true });
    }
    function clear(user = false) {
      state = { selected: [], merged: null };
      paint(user);
    }
    function paint(user = false, animateMerge = false) {
      pockets.forEach((pocket, i) => {
        const used = Boolean(state.merged?.includes(i));
        pocket.setAttribute("aria-pressed", String(state.selected.includes(i)));
        pocket.setAttribute("aria-hidden", String(used));
        pocket.disabled = Boolean(state.merged);
        pocket.style.opacity = used ? "0" : "1";
      });
      merged.setAttribute("aria-hidden", String(!state.merged));
      merged.style.opacity = state.merged ? "1" : "0";
      if (state.merged) {
        const rectangles = state.merged.map((i) =>
          pockets[i].getBoundingClientRect(),
        );
        const bounds = grid.getBoundingClientRect();
        const left = Math.min(...rectangles.map((r) => r.left));
        const top = Math.min(...rectangles.map((r) => r.top));
        const width = Math.max(...rectangles.map((r) => r.right)) - left;
        const height = Math.max(...rectangles.map((r) => r.bottom)) - top;
        merged.style.left = left - bounds.left + "px";
        merged.style.top = top - bounds.top + "px";
        merged.style.width = width + "px";
        merged.style.height = height + "px";
        merged.setAttribute(
          "aria-label",
          state.merged.length +
            " pockets merged into one " +
            (state.merged.length === 4 ? "square" : "strip"),
        );
        if (animateMerge && !motion.reduced()) {
          const first = rectangles[0];
          merged.animate(
            [
              {
                clipPath:
                  "inset(" +
                  (first.top - top) +
                  "px " +
                  (left + width - first.right) +
                  "px " +
                  (top + height - first.bottom) +
                  "px " +
                  (first.left - left) +
                  "px round 6px)",
                opacity: 0.45,
              },
              { clipPath: "inset(0px 0px 0px 0px round 6px)", opacity: 1 },
            ],
            { duration: transitionDuration(merged), easing },
          );
        }
      }
      commit.disabled = Boolean(state.merged) || !validSelection();
      box.caption.textContent = state.merged
        ? state.merged.length + " pockets merged"
        : state.selected.length === 0
          ? "Select 2 or 4 pockets"
          : validSelection()
            ? state.selected.length + " pockets selected"
            : state.selected.length === 1 || state.selected.length === 3
              ? state.selected.length + " selected · choose 2 or 4"
              : "Choose a strip or 2 × 2 square";
      if (user) box.live.textContent = box.caption.textContent;
    }
    new ResizeObserver(() => paint()).observe(grid);
    paint();
    return Object.assign(box, {
      snapshot: () => ({
        selected: [...state.selected],
        merged: state.merged && [...state.merged],
      }),
      restore: (value) => {
        state = value;
        paint();
      },
      start: () => clear(),
      final: () => {
        state = { selected: [], merged: [0, 1, 3, 4] };
        paint();
      },
      steps: [
        {
          target: () => pockets[0],
          apply: () => select(0),
          delay: timing.step,
        },
        {
          target: () => pockets[1],
          apply: () => select(1),
          delay: timing.step,
        },
        { target: () => commit, apply: () => combine(), delay: timing.step },
        { target: () => reset, apply: () => clear(), delay: timing.step },
        ...[3, 4, 7, 6].map((index) => ({
          target: () => pockets[index],
          apply: () => select(index),
          delay: timing.step,
        })),
        { target: () => commit, apply: () => combine(), delay: timing.step },
      ],
    });
  }
  function sleeves() {
    const box = lesson(
      "Sleeve it your way.",
      "Five Ball themes for sleeves. Five matching toploader options.",
      "sleeves",
    );
    let selected = 0;
    const pair = make("div", "lesson-frame-pair");
    const data = window.CARDS.find((card) => card.collectorNumber === "166");
    const frames = ["Sleeve", "Toploader"].map((label) => {
      const group = make("div", "lesson-frame-group");
      const frame = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      frame.classList.add("lesson-frame");
      frame.setAttribute("viewBox", "0 0 110 155");
      frame.setAttribute("role", "img");
      group.append(frame, make("span", "lesson-frame-label", label));
      pair.append(group);
      return frame;
    });
    box.preview.append(pair);
    const choices = dots(
      box.controls,
      (index) => {
        selected = index;
        paint(true);
      },
      "sleeve and toploader theme",
    );
    function paint(user = false) {
      frames.forEach((frame, index) => {
        const theme = themes[selected][0];
        frame.dataset.theme = theme;
        frame.replaceChildren();
        frame.setAttribute(
          "aria-label",
          data.name +
            ", " +
            themes[selected][1] +
            (index ? " toploader" : " sleeve"),
        );
        window.BinderVisuals.append(
          frame,
          {
            cardId: data.id || data.collectorNumber,
            frames: {
              sleeve: index ? "none" : theme,
              toploader: index ? theme : "none",
            },
          },
          110,
          155,
        );
        pulse(frame);
      });
      choices.select(selected);
      box.caption.textContent = themes[selected][1];
      if (user)
        box.live.textContent =
          box.caption.textContent + " sleeve and toploader";
    }
    paint();
    return Object.assign(box, {
      snapshot: () => selected,
      restore: (value) => {
        selected = value;
        paint();
      },
      start: () => {
        selected = 0;
        paint();
      },
      final: () => {
        selected = 4;
        paint();
      },
      steps: [1, 2, 3, 4].map((index) => ({
        target: () => choices.buttons[index],
        apply: () => {
          selected = index;
          paint();
        },
      })),
    });
  }
  function artwork() {
    const box = lesson(
      "Add your own artwork.",
      "Upload artwork. Add your title.",
      "artwork",
    );
    let state = {
        src: window.CUSTOMIZE_ART,
        title: "Forest favorites",
        color: "#18342a",
      },
      generation = 0;
    const card = make("div", "lesson-art-card"),
      image = make("img", "lesson-art-image"),
      text = make("span", "lesson-art-title");
    image.alt = "";
    card.append(image, text);
    box.preview.append(card);
    const label = make("label", "lesson-title-label", "Title");
    label.htmlFor = "lesson-art-title";
    const field = make("div", "lesson-title-field"),
      title = make("input", "lesson-title-input"),
      color = make("input", "lesson-color-input");
    title.id = "lesson-art-title";
    title.type = "text";
    title.maxLength = 32;
    color.type = "color";
    color.setAttribute("aria-label", "Title text color");
    field.append(title, color);
    const titleGroup = make("div", "lesson-title-group");
    titleGroup.append(label, field);
    const upload = make("label", "lesson-upload", "Upload"),
      file = make("input", "lesson-upload-input");
    file.type = "file";
    file.accept = "image/jpeg,image/png,image/webp";
    file.setAttribute("aria-label", "Upload cover artwork");
    upload.append(file);
    box.controls.classList.add("lesson-art-controls");
    box.controls.append(titleGroup, upload);
    title.addEventListener("input", () => {
      state.title = title.value;
      paint();
    });
    color.addEventListener("input", () => {
      state.color = color.value;
      paint();
    });
    image.addEventListener("error", () => {
      image.hidden = true;
      box.live.textContent = "Artwork could not load.";
    });
    file.addEventListener("change", () => {
      const item = file.files[0];
      if (!item) return;
      const token = ++generation;
      const fail = (message) => {
        if (token !== generation) return;
        box.caption.textContent = message;
        box.live.textContent = message;
        file.value = "";
      };
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(item.type) ||
        item.size > 5 * 1024 * 1024
      ) {
        fail("Use JPG, PNG or WebP under 5 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => fail("Could not open this image.");
      reader.onload = () => {
        const decoded = new Image();
        decoded.onerror = () => fail("Could not open this image.");
        decoded.onload = () => {
          if (token !== generation) return;
          state.src = reader.result;
          paint();
          box.live.textContent = "Your artwork is ready. Preview only.";
          file.value = "";
        };
        decoded.src = reader.result;
      };
      reader.readAsDataURL(item);
    });
    function paint() {
      image.hidden = !state.src;
      if (state.src && image.getAttribute("src") !== state.src)
        image.src = state.src;
      text.textContent = state.title;
      text.style.color = state.color;
      title.value = state.title;
      color.value = state.color;
      box.caption.textContent = "Preview only";
    }
    paint();
    box.panel.dataset.playback = "static";
    return box;
  }
  function guidedTour(boxes) {
    const cursor = make("span", "lesson-cursor");
    cursor.setAttribute("aria-hidden", "true");
    cursor.hidden = true;
    cursor.innerHTML =
      '<svg viewBox="0 0 20 25"><path d="M2 1v18l5-5 4 8 4-2-4-8h7Z"/></svg>';
    host.append(cursor);
    const playback = motion.register(host);
    let timer = 0,
      wake = 0,
      due = 0,
      remaining = timing.initial,
      boxIndex = 0,
      stepIndex = 0,
      prepared = false,
      pending = null,
      saved = null,
      rest = false,
      hovered = new Set(),
      idleUntil = 0,
      lastReduced = motion.reduced(),
      entered = false;
    function status(value) {
      host.dataset.playback = value;
      boxes.forEach((box, i) => {
        box.panel.dataset.playback =
          value === "playing"
            ? i === boxIndex
              ? "playing"
              : "waiting"
            : value;
      });
    }
    function stop() {
      if (timer) {
        remaining = Math.max(0, due - performance.now());
        clearTimeout(timer);
        timer = 0;
      }
      cursor.hidden = true;
      motion.stopAnimations(host);
    }
    function targetVisible(target) {
      if (!target?.isConnected || !target.offsetWidth || !target.offsetHeight)
        return false;
      const y = motion.top(target);
      return y >= 76 && y + target.offsetHeight <= innerHeight - 12;
    }
    function point(target, animate = true) {
      if (!target?.isConnected) return;
      const a = target.getBoundingClientRect(),
        b = host.getBoundingClientRect();
      const previous = { left: cursor.style.left, top: cursor.style.top };
      const hidden = cursor.hidden;
      cursor.hidden = false;
      cursor.style.left =
        a.left +
        a.width / 2 -
        b.left -
        host.clientLeft -
        (cursor.offsetWidth * 2) / 20 +
        "px";
      cursor.style.top =
        a.top +
        a.height / 2 -
        b.top -
        host.clientTop -
        cursor.offsetHeight / 25 +
        "px";
      if (animate && !hidden && previous.left && !motion.reduced())
        cursor.animate(
          [previous, { left: cursor.style.left, top: cursor.style.top }],
          { duration: timing.travel, easing },
        );
      else if (animate)
        cursor.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: timing.travel,
          easing,
        });
    }
    function finishBox() {
      if (saved !== null) boxes[boxIndex].restore(saved);
      saved = null;
      boxIndex++;
      stepIndex = 0;
      prepared = false;
      if (boxIndex === boxes.length) {
        boxIndex = 0;
        rest = true;
        remaining = timing.rest;
        cursor.hidden = true;
      }
    }
    function tick() {
      timer = 0;
      if (!playback.allowed()) {
        check();
        return;
      }
      if (rest) rest = false;
      if (pending) {
        const step = pending;
        pending = null;
        point(step.target(), false);
        step.apply();
        stepIndex++;
        remaining = timing.step - timing.travel;
        if (stepIndex === boxes[boxIndex].steps.length) finishBox();
      } else {
        const box = boxes[boxIndex];
        if (!prepared) {
          saved = box.touched ? box.snapshot() : null;
          box.start();
          prepared = true;
        }
        pending = box.steps[stepIndex];
        point(pending.target());
        remaining = timing.travel;
      }
      check();
    }
    function check() {
      clearTimeout(wake);
      wake = 0;
      if (lastReduced !== motion.reduced()) {
        lastReduced = motion.reduced();
        stop();
        if (saved !== null) boxes[boxIndex].restore(saved);
        saved = null;
        pending = null;
        prepared = false;
        stepIndex = 0;
        rest = false;
        if (lastReduced)
          boxes.forEach((box) => {
            if (!box.touched) box.final();
          });
        else {
          boxIndex = 0;
          remaining = timing.initial;
        }
      }
      if (motion.reduced()) {
        stop();
        status("reduced");
        return;
      }
      if (!entered || !playback.visible()) {
        stop();
        status("offscreen");
        return;
      }
      const active = document.activeElement;
      const focused =
        host.contains(active) &&
        (active.matches("input") || active.matches(":focus-visible"));
      if (hovered.size || focused || performance.now() < idleUntil) {
        stop();
        status("paused");
        if (!hovered.size && !focused)
          wake = setTimeout(
            check,
            Math.max(0, idleUntil - performance.now()) + 10,
          );
        return;
      }
      const target =
        pending?.target() || boxes[boxIndex].steps[stepIndex]?.target();
      if (!targetVisible(target)) {
        stop();
        status("waiting");
        return;
      }
      status(rest ? "resting" : "playing");
      if (!timer) {
        due = performance.now() + remaining;
        timer = setTimeout(tick, remaining);
      }
    }
    function engage(box, commit = false) {
      idleUntil = performance.now() + timing.idle;
      stop();
      if (commit) {
        box.touched = true;
        // Preserve other boxes' personal settings before abandoning an interrupted tour.
        if (saved !== null && boxes[boxIndex] !== box)
          boxes[boxIndex].restore(saved);
        saved = null;
        pending = null;
        prepared = false;
        stepIndex = 0;
        rest = false;
        remaining = timing.initial;
      }
      check();
    }
    boxes.forEach((box) => {
      box.panel.addEventListener("pointerenter", () => {
        hovered.add(box);
        stop();
        check();
      });
      box.panel.addEventListener("pointerleave", () => {
        hovered.delete(box);
        engage(box);
      });
      ["click", "input", "change"].forEach((type) =>
        box.panel.addEventListener(
          type,
          (event) => {
            if (event.target.closest("button,input,label.lesson-upload"))
              engage(box, true);
          },
          true,
        ),
      );
      box.panel.addEventListener("keydown", () => engage(box));
    });
    // Manual artwork fields also pause the tour while they have focus.
    host.addEventListener("focusin", () => engage(null));
    host.addEventListener("focusout", () => queueMicrotask(() => engage(null)));
    // Observe the first panel, rather than the long section, so opening the page
    // doesn't consume the walkthrough while it is below the fold.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          entered = true;
          observer.disconnect();
          check();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(boxes[0].panel);
    document.addEventListener("demo-motion-change", check);
    document.addEventListener("visibilitychange", check);
    if (lastReduced) boxes.forEach((box) => box.final());
    check();
  }
  section.querySelector(".eyebrow")?.remove();
  section.querySelector(".chapter-head > p")?.remove();
  section.querySelector("h2").textContent = "A collection with your signature.";
  guidedTour([binder(), merge(), sleeves()]);
  artwork();
})();
