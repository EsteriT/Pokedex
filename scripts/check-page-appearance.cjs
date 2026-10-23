const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../src/scripts', name), 'utf8');
function node(tag, attrs = {}) {
  return {
    tag, attrs, children: [], dataset: {}, namespaceURI: 'http://www.w3.org/2000/svg',
    style: { values: {}, setProperty(k, v) { this.values[k] = v; } },
    setAttribute(k, v) { this.attrs[k] = v; },
    append(...items) { this.children.push(...items); },
  };
}
const scope = { window: {}, document: { createElement: node, createElementNS: (_, tag) => node(tag) } };
for (const file of ['binder-schema.js', 'binder-geometry.js', 'binder-covers.js'])
  vm.runInNewContext(read(file), scope);
const page = { id: 'page1', rows: 1, columns: 1, regions: [{ id: 'r1', cells: [[0, 0]], content: null }] };
const original = { name: 'Test', cover: { theme: 'transparent' }, pages: [page] };
const studio = read('editor-studio.js');
const draftFunction = studio.slice(studio.indexOf('    function designDocument('), studio.indexOf('    background.type ='));
Object.assign(scope, {
  coverDraft: { theme: 'transparent' }, coverValue: theme => ({ theme }),
  h: { state: { document: original } }, pageEdits: new Map(),
  allAppearance: { background: '#ff0000', pockets: 'defined' },
});
vm.runInNewContext(draftFunction, scope);
const draft = scope.designDocument('transparent');
assert.equal(draft.cover.pageStyle.pockets, 'defined');
assert.equal(original.cover.pageStyle, undefined, 'Preview cannot mutate the saved document');
const book = scope.window.BinderCovers.create(draft.cover, draft.name, draft);
assert.equal(book.style.values['--page-background'], '#ff0000');
assert.equal(book.style.values['--pocket-border'], 'var(--muted)');
const flatten = n => [n, ...n.children.flatMap(flatten)];
assert(flatten(book).some(n => n.tag === 'rect' && n.attrs.fill === 'var(--pocket-fill)'), 'Transparent empty pockets must contrast with page color');
// Execute the real download callback against the same resolved draft.
let exported;
Object.assign(scope, {
  Blob, URL: { createObjectURL(b) { exported = b; return 'blob:test'; }, revokeObjectURL() {} },
  button: (_, label, callback) => callback, designStatus: {}, setTimeout() {},
  document: { createElement: () => ({ click() {}, remove() {} }), body: { append() {} } },
});
const start = studio.indexOf('button("save-binder-design",');
const callback = studio.slice(start, studio.indexOf('button("load-binder-design",', start)).trim().replace(/,$/, '');
vm.runInNewContext('(' + callback + ')()', scope);
const viewer = read('viewer.js');
const renderFunction = viewer.slice(viewer.indexOf('  function regionArt('), viewer.indexOf('  function visiblePages('));
const render = new Function('doc', 'window', 'svg', 'region', 'appearance',
  'let sequence=0;' + renderFunction + 'return regionArt(region,80,110,80,110,5,appearance).art;');
for (const [pockets, border] of [['none', 'transparent'], ['subtle', 'var(--line)'], ['defined', 'var(--muted)']]) {
  const art = render(original, scope.window, node, page.regions[0], { background: '#ff0000', pockets });
  assert.equal(art.style.values['--pocket-border'], border, 'Viewer must honor individual page borders');
  assert.equal(art.style.values['--page-background'], '#ff0000');
  assert.equal(art.children.find(n => n.tag === 'path').attrs.stroke, 'var(--pocket-border)');
  assert.equal(art.children.find(n => n.tag === 'rect').attrs.fill, 'var(--pocket-fill)');
}
scope.allAppearance = null;
assert.equal(scope.designDocument('transparent').cover.pageStyle, undefined, 'Reset removes the draft default');
exported.text().then(text => {
  const design = JSON.parse(text);
  assert.deepEqual(design.cover.pageStyle, { background: '#ff0000', pockets: 'defined' });
  assert.equal(design.pages, undefined, 'Portable designs must not include cards or pages');
  console.log('PASS: resolved design export/transparent preview, reset, individual viewer borders and contrasting empty pockets.');
}).catch(error => { console.error(error); process.exitCode = 1; });
