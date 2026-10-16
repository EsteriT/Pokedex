(() => {
  const root = document.getElementById("binder-carousel");
  const stage = root.querySelector(".binder-wheel");
  const dots = root.querySelector(".binder-dots");
  const binders = window.HERO_BINDERS;
  const reduced = () => window.DemoMotion.reduced();
  let active = 0,
    phase = 0,
    targetPhase = null,
    frame = 0,
    lastTime = 0,
    dragStart = null,
    dragging = false,
    paused = reduced(),
    velocity = 0;
  const slides = binders.map((binder, i) => {
    const slide = document.createElement("button");
    slide.type = "button";
    slide.className = "binder-slide";
    slide.setAttribute("aria-label", "Show " + binder.name + " binder");
    const page = document.createElement("div");
    page.className = "binder-page" + (binder.rows === 4 ? " cross-page" : "");
    binder.cards.forEach((data) => {
      const pocket = document.createElement("div");
      pocket.className = "binder-pocket" + (!data ? " vacant" : "");
      if (data) {
        const image = document.createElement("img");
        image.src = data.image;
        image.alt = data.name + " · " + data.number;
        image.draggable = false;
        image.loading = i === 0 ? "eager" : "lazy";
        image.decoding = "async";
        const fallback = document.createElement("span");
        fallback.className = "binder-image-fallback";
        fallback.textContent = data.name;
        let tried = false;
        image.onerror = () => {
          if (data.fallback && !tried) {
            tried = true;
            image.src = data.fallback;
          } else {
            pocket.classList.add("image-missing");
          }
        };
        pocket.append(image, fallback);
      }
      page.append(pocket);
    });
    slide.append(page);
    slide.addEventListener("click", (event) => {
      if (event.detail === 0 && !dragging) go(i);
    });
    stage.append(slide);
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "binder-dot";
    dot.setAttribute("aria-label", "Show " + binder.name);
    dot.addEventListener("click", () => go(i));
    dots.append(dot);
    return slide;
  });
  function update() {
    slides.forEach((slide, i) => {
      let offset = (i - active + binders.length) % binders.length;
      if (offset > binders.length / 2) offset -= binders.length;
      slide.dataset.position = offset;
      slide.tabIndex = offset === 0 ? 0 : -1;
      slide.setAttribute(
        "aria-hidden",
        Math.abs(offset) > 1 ? "true" : "false",
      );
      slide.setAttribute("aria-current", i === active ? "true" : "false");
      slide.inert = Math.abs(offset) > 1;
      dots.children[i].setAttribute(
        "aria-current",
        i === active ? "true" : "false",
      );
    });
  }
  function paint() {
    const width = stage.clientWidth,
      height = stage.clientHeight;
    if (!width || !height) return;
    slides.forEach((slide, i) => {
      let offset =
        (((i - phase) % binders.length) + binders.length) % binders.length;
      if (offset > binders.length / 2) offset -= binders.length;
      const angle = (offset * Math.PI) / 3,
        depth = (Math.cos(angle) + 1) / 2;
      // Fit each complete binder and reserve room for perspective and its shadow.
      const fit = Math.min(
        1,
        Math.max(0, width - 48) / (slide.offsetWidth * 1.12),
        Math.max(0, height - 48) / (slide.offsetHeight * 1.12),
      );
      const scale = (0.34 + 0.66 * depth * depth) * fit;
      const limit = Math.max(
        0,
        (width - slide.offsetWidth * scale * 1.12) / 2 - 24,
      );
      const shift = Math.max(
        -limit,
        Math.min(limit, Math.sin(angle) * slide.offsetWidth * 0.88),
      );
      slide.style.transform = `translate(calc(-50% + ${shift}px),-50%) scale(${scale}) rotateY(${-Math.sin(angle) * 28}deg)`;
      slide.style.opacity = String(Math.max(0, (depth - 0.25) / 0.75));
      slide.style.filter = `brightness(${0.62 + 0.38 * depth})`;
      slide.style.zIndex = String(Math.round(depth * 100));
      slide.style.pointerEvents = Math.abs(offset) < 1.65 ? "auto" : "none";
      slide.inert = Math.abs(offset) >= 1.65;
      slide.setAttribute(
        "aria-hidden",
        Math.abs(offset) >= 1.65 ? "true" : "false",
      );
    });
  }
  function tick(now) {
    frame = 0;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    if (!dragStart) {
      if (targetPhase !== null) {
        const difference = targetPhase - phase;
        if (Math.abs(difference) < 0.001) {
          phase = targetPhase;
          targetPhase = null;
        } else phase += difference * (1 - Math.exp(-dt * 6));
      } else if (Math.abs(velocity) > 0.02) {
        phase += velocity * dt;
        velocity *= Math.exp(-2.4 * dt);
        if (Math.abs(velocity) <= 0.02) velocity = 0;
      } else if (!paused) phase += dt / 12;
    }
    const next =
      ((Math.round(phase) % binders.length) + binders.length) % binders.length;
    if (next !== active) {
      active = next;
      update();
    }
    paint();
    if (
      !document.hidden &&
      playback.visible() &&
      !dragStart &&
      (!paused || targetPhase !== null || velocity !== 0)
    )
      frame = requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (
      !document.hidden &&
      !dragStart &&
      (!paused || targetPhase !== null || velocity !== 0)
    )
      frame = requestAnimationFrame(tick);
  }
  function go(index) {
    playback.pause();
    velocity = 0;
    active = (index + binders.length) % binders.length;
    let difference =
      (((active - phase) % binders.length) + binders.length) % binders.length;
    if (difference > binders.length / 2) difference -= binders.length;
    if (reduced()) {
      phase += difference;
      targetPhase = null;
      paint();
    } else targetPhase = phase + difference;
    update();
    playback.resume();
  }
  root
    .querySelector('[data-direction="previous"]')
    .addEventListener("click", () => go(active - 1));
  root
    .querySelector('[data-direction="next"]')
    .addEventListener("click", () => go(active + 1));
  const playback = window.DemoMotion.register(stage, {
    onPause() {
      paused = true;
      velocity = 0;
      targetPhase = null;
      schedule();
    },
    onResume() {
      paused = !playback.allowed();
      schedule();
    },
  });
  document.addEventListener("demo-motion-change", () => {
    paused = !playback.allowed();
    if (reduced()) {
      velocity = 0;
      if (targetPhase !== null) {
        phase = targetPhase;
        targetPhase = null;
      }
      active =
        ((Math.round(phase) % binders.length) + binders.length) %
        binders.length;
      update();
      paint();
    }
    schedule();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      go(active + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  function syncDrag() {
    const next =
      ((Math.round(phase) % binders.length) + binders.length) % binders.length;
    if (next !== active) {
      active = next;
      update();
    }
    paint();
  }
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.isPrimary === false || dragStart) return;
    playback.pause();
    targetPhase = null;
    velocity = 0;
    dragging = false;
    dragStart = {
      id: event.pointerId,
      x: event.clientX,
      phase,
      pixels: Math.max(180, Math.min(320, stage.clientWidth * 0.4)),
      samples: [{ x: event.clientX, t: event.timeStamp }],
    };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add("dragging");
    schedule();
    if (event.pointerType === "mouse") event.preventDefault();
  });
  function moveDrag(event) {
    if (!dragStart || event.pointerId !== dragStart.id) return;
    const dx = event.clientX - dragStart.x;
    if (Math.abs(dx) > 3) dragging = true;
    phase = dragStart.phase - dx / dragStart.pixels;
    dragStart.samples.push({ x: event.clientX, t: event.timeStamp });
    while (
      dragStart.samples.length > 2 &&
      dragStart.samples[0].t < event.timeStamp - 100
    )
      dragStart.samples.shift();
    syncDrag();
  }
  stage.addEventListener("pointermove", moveDrag);
  function endDrag(event, cancelled = false) {
    if (!dragStart || event.pointerId !== dragStart.id) return;
    if (!cancelled) moveDrag(event);
    const state = dragStart,
      first = state.samples[0],
      last = state.samples[state.samples.length - 1],
      dt = (last.t - first.t) / 1000;
    velocity =
      !cancelled && !reduced() && dragging && dt > 0
        ? Math.max(-6, Math.min(6, -(last.x - first.x) / state.pixels / dt))
        : 0;
    dragStart = null;
    stage.classList.remove("dragging");
    if (stage.hasPointerCapture(event.pointerId))
      stage.releasePointerCapture(event.pointerId);
    playback.resume();
    setTimeout(() => (dragging = false), 0);
  }
  stage.addEventListener("pointerup", (event) => endDrag(event));
  stage.addEventListener("pointercancel", (event) => endDrag(event, true));
  stage.addEventListener("lostpointercapture", (event) => {
    if (dragStart) endDrag(event, true);
  });
  let wheelTime = 0;
  stage.addEventListener(
    "wheel",
    (event) => {
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.shiftKey
            ? event.deltaY
            : 0;
      if (Math.abs(delta) < 15) return;
      event.preventDefault();
      if (Date.now() - wheelTime < 650) return;
      wheelTime = Date.now();
      go(active + (delta > 0 ? 1 : -1));
    },
    { passive: false },
  );
  window.addEventListener("resize", paint);
  document.addEventListener("visibilitychange", schedule);
  update();
  paint();
  schedule();
})();
