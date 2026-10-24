const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = file => fs.readFileSync(path.join(root, "src/scripts", file), "utf8");
class Node {
  constructor(tag = "div") {
    this.tagName = tag; this.children = []; this.handlers = {}; this.dataset = {};
    this.hidden = false; this.disabled = false; this._value = "";
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  get options() { return this.tagName === "select" ? this.children : undefined; }
  get selectedOptions() { return this.options.filter(o => o.selected); }
  get value() { return this.tagName === "select" ? this.selectedOptions[0]?.value || "" : this._value; }
  set value(value) {
    this._value = value;
    if (this.options) for (const o of this.options) o.selected = o.value === value;
  }
  append(...nodes) { for (const n of nodes) { this.children.push(n); n.parentElement = this; } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  before(node) { this.parentElement.append(node); }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(type, callback, options) { (this.handlers[type] ||= []).push({ callback, once: options?.once }); }
  dispatchEvent(event) {
    for (const h of [...this.handlers[event.type] || []]) {
      if (h.once) this.handlers[event.type].splice(this.handlers[event.type].indexOf(h), 1);
      h.callback(event);
    }
  }
  click() { this.dispatchEvent({ type: "click" }); }
  closest() { return null; }
}
function documentFixture() {
  const elements = new Map();
  return {
    elements, createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag),
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Node()); return elements.get(id); },
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
  };
}
async function main() {
  const document = documentFixture();
  const scope = { window: { CARDS: [] }, document, Event };
  vm.runInNewContext(source("card-catalogue.js"), scope);
  const card = { name: "Fixture", imageUrl: "https://assets.tcgdex.net/en/base/base1/1/high.webp" };
  for (const large of [false, true]) {
    const image = scope.window.CardCatalogue.picture(card, large);
    assert.equal(image.src, large ? card.imageUrl : card.imageUrl.replace("/high.webp", "/low.webp"));
    image.dispatchEvent({ type: "error" });
    assert.match(image.src, /^data:image\/svg\+xml,/);
    assert.equal(image.dataset.imageUnavailable, "true");
    assert.match(image.alt, /Image unavailable/);
    assert.equal(image.handlers.error.length, 0, "Fallback must not retry a failing URL in a loop");
  }
  const missing = scope.window.CardCatalogue.picture({ name: "Missing", imageUrl: "" });
  assert.match(missing.src, /^data:/, "Never assign an empty source while waiting for an error event");

  const selectors = ['set-filter','type-filter','rarity-filter','category-filter','finish-filter','illustrator-filter'];
  for (const id of selectors) {
    const select = new Node("select");
    for (const [value, text] of [["", "All"], ["first", "First"], ["second", "Second"]]) {
      const option = new Node("option"); option.value = value; option.textContent = text; option.selected = !value;
      select.append(option);
    }
    const label = new Node("label"), host = new Node(); host.append(label); label.append(select);
    document.elements.set(id, select);
  }
  const pickerScope = { window: { addEventListener() {} }, document, Event, innerWidth: 1200, innerHeight: 900 };
  vm.runInNewContext(source("discover-filter-pickers.js"), pickerScope);
  pickerScope.window.DiscoverFilterPickers.initialize(true);
  const panels = selectors.map(id => document.elements.get(id).parentElement.parentElement.children.find(n => n.tagName === "details").children[1]);
  for (const panel of panels) {
    const search = panel.children.find(n => n.type === "search");
    const list = panel.children.find(n => n.className === "filter-picker-list");
    search.value = "unmatched"; search.dispatchEvent(new Event("input"));
    assert(list.children.every(row => row.hidden));
  }
  panels[0].children.find(n => n.tagName === "button").click();
  assert(panels[0].children.find(n => n.className === "filter-picker-list").children.every(row => !row.hidden));
  pickerScope.window.DiscoverFilterPickers.resetSearches();
  for (const panel of panels) {
    assert.equal(panel.children.find(n => n.type === "search").value, "");
    assert(panel.children.find(n => n.className === "filter-picker-list").children.every(row => !row.hidden));
    assert(panel.children.find(n => n.tagName === "p").hidden);
  }

  const timers = new Map(), requests = [];
  let serial = 0;
  const editorDocument = documentFixture();
  const make = (tag, cls, text) => { const n = new Node(tag); n.className = cls; n.textContent = text; return n; };
  const editor = {
    $: id => editorDocument.getElementById(id), el: make, visualSVG: () => new Node("svg"),
    renderPocketPreview() {}, nameOf: () => "Fixture", placeholderDraft: {}, Event,
    window: { CARDS: [], CardCatalogue: { enabled: true, picture: card => scope.window.CardCatalogue.picture(card), search(filters) {
      return new Promise((resolve, reject) => requests.push({ q: filters.q, resolve, reject }));
    } } },
    setTimeout(fn, ms) { assert.equal(ms, 250); timers.set(++serial, fn); return serial; },
    clearTimeout(id) { timers.delete(id); },
  };
  const code = source("editor.js");
  const historyDocument = documentFixture();
  let undos = 0, redos = 0;
  const history = {
    $: id => historyDocument.getElementById(id), coverOpen: true,
    state: { canUndo: true, canRedo: true, undo() { undos++; }, redo() { redos++; } },
    run: fn => fn(),
  };
  const historyRender = code.slice(code.indexOf('    $("undo").disabled ='), code.indexOf('    const needsSave ='));
  const historyEvents = code.slice(code.indexOf('  $("undo").addEventListener("click",'), code.indexOf('  async function saveLocal()'));
  vm.runInNewContext(historyRender + historyEvents, history);
  assert(history.$("undo").disabled && history.$("redo").disabled);
  // Direct dispatch also verifies handlers protect the draft independently of disabled controls.
  history.$("undo").click(); history.$("redo").click();
  assert.equal(undos + redos, 0);
  history.coverOpen = false;
  vm.runInNewContext(historyRender, history);
  assert(!history.$("undo").disabled && !history.$("redo").disabled);
  history.$("undo").click(); history.$("redo").click();
  assert.equal(undos, 1); assert.equal(redos, 1);
  const rendered = {};
  const navigation = {
    state: { document: { pages: [{ id: "first" }, { id: "second" }] } },
    pageId: "first", selected: ["old-selection"], selectMode: true,
    coverOpen: true, customTab: "sleeve",
    renderFrameChoices() { rendered.scope = navigation.pageId; },
    render() { rendered.page = navigation.pageId; },
    previewCover() { rendered.preview = navigation.pageId; },
  };
  vm.runInNewContext(code.slice(code.indexOf("  function showPage("), code.indexOf("  function turn(")), navigation);
  navigation.showPage("unknown"); assert.equal(navigation.pageId, "first");
  navigation.showPage("second");
  assert.equal(navigation.selected.length, 0); assert.equal(navigation.selectMode, false);
  assert.deepEqual(rendered, { scope: "second", page: "second", preview: "second" });
  navigation.customTab = "cover"; navigation.showPage("first");
  assert.equal(rendered.page, "first"); assert.equal(rendered.preview, "first");
  const fragment = code.slice(code.indexOf("  let placeholderQuery = null,"), code.indexOf("  function setPocketTab("));
  vm.runInNewContext(fragment, editor);
  const note = () => editor.$("placeholder-target-note").textContent;
  const type = q => { editor.$("placeholder-search").value = q; editor.renderPlaceholderChoices(); };
  const fire = () => { const [id, fn] = [...timers][0]; timers.delete(id); return fn(); };
  type("a"); type("ab");
  assert.equal(timers.size, 1); assert.equal(requests.length, 0); assert.match(note(), /Loading/);
  const first = fire(); assert.equal(requests[0].q, "ab");
  type("abc"); requests[0].resolve({ cards: [] }); await first;
  assert.match(note(), /Loading/, "An old response must not replace a newer pending query");
  const second = fire(); requests[1].reject(Error("Offline fixture")); await second;
  assert.match(note(), /Offline fixture/);
  editor.$("placeholder-card-options").children.find(n => n.textContent === "Retry search").click();
  assert.match(note(), /Loading/);
  const retry = fire(); requests[2].resolve({ cards: [] }); await retry;
  assert.equal(note(), "No matching cards.");
  type("cancelled"); editor.$("pocket-dialog").dispatchEvent(new Event("close"));
  assert.equal(timers.size, 0); assert.equal(requests.length, 3);
  type("late"); const late = fire(); editor.$("pocket-dialog").dispatchEvent(new Event("close"));
  const before = note(); requests[3].resolve({ cards: [] }); await late; assert.equal(note(), before);
  editor.placeholderDraft.cardId = "existing-target";
  type("different target"); assert.match(note(), /Loading/, "Keep the old target while clearly reporting the new search");
  editor.$("pocket-dialog").dispatchEvent(new Event("close"));
  console.log("PASS: picture fallbacks, picker resets, customizer history guards/page synchronization, debounced loading, stale/closed response rejection and retry.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
