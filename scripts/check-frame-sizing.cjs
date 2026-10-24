const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const scope = { window: { CARDS: [{ id: "test", name: "Test", imageUrl: "test.jpg" }] } };
vm.runInNewContext(fs.readFileSync(require("node:path").join(__dirname, "../src/scripts/binder-visuals.js"), "utf8"), scope);
function node(tag, attrs = {}) {
  return { tag, attrs, children: [], events: {},
    append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } },
    addEventListener(type, fn) { this.events[type] = fn; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); },
  };
}
function flatten(n) { return [n, ...n.children.flatMap(flatten)]; }
for (const [w, h] of [[48, 66], [245, 337], [490, 337], [80, 400]]) {
  let baseline;
  for (const frames of [{}, { sleeve: "poke" }, { toploader: "clear" }, { sleeve: "master", toploader: "ultra" }]) {
    const root = node("svg");
    scope.window.BinderVisuals.append(root, { cardId: "test", frames }, w, h, {}, "", node);
    const all = flatten(root), image = all.find(n => n.tag === "image");
    const bounds = [image.attrs.x, image.attrs.y, image.attrs.width, image.attrs.height];
    const framed = frames.sleeve || frames.toploader;
    if (framed) {
      const holder = all.find(n => n.tag === "rect");
      const edge = holder.attrs, halfStroke = edge["stroke-width"] / 2;
      assert(Math.abs(edge.x - halfStroke) < 0.001);
      assert(Math.abs(edge.y - halfStroke) < 0.001);
      assert(Math.abs(edge.x + edge.width + halfStroke - w) < 0.001);
      assert(Math.abs(edge.y + edge.height + halfStroke - h) < 0.001);
      assert(image.attrs.x > edge.x + halfStroke);
      assert(image.attrs.y > edge.y + halfStroke);
      if (!baseline) baseline = bounds;
      assert.deepEqual(bounds, baseline, "Framed styles share card size and position");
    } else {
      assert.equal(image.attrs.width, Math.min(w, h * 245 / 337));
      assert.equal(image.attrs.height, image.attrs.width * 337 / 245);
    }
    for (const n of all.filter(n => n.tag === "rect")) {
      const a = n.attrs, stroke = (a["stroke-width"] || 0) / 2;
      assert(a.x - stroke >= -0.001 && a.y - stroke >= -0.001);
      assert(a.x + a.width + stroke <= w + 0.001 && a.y + a.height + stroke <= h + 0.001);
    }
  }
}
for (const source of ["", "broken.jpg"]) {
  scope.window.CARDS[0].imageUrl = source;
  const root = node("svg");
  scope.window.BinderVisuals.append(root, { cardId: "test" }, 245, 337, {}, "", node);
  if (source) flatten(root).find(n => n.tag === "image").events.error();
  assert(!flatten(root).some(n => n.tag === "image"));
  assert(flatten(root).some(n => n.tag === "text" && n.textContent === "Image unavailable"));
}
console.log("PASS: unframed cards fill available space; framed styles share consistent geometry; outer holders fill normal, small and merged pockets with cards inset inside.");
