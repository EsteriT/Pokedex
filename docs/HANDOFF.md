# Current project handoff

This file describes the current implementation. [HISTORY.md](HISTORY.md) preserves earlier milestones; some older descriptions are superseded.

## Accepted milestone

**Frontend MVP — accepted by the user on 2026-10-16.** Preserve this approved frontend baseline unless a later request changes it. See [FRONTEND-MVP.md](FRONTEND-MVP.md) for the scope, checks and remaining release/integration work. This acceptance does not imply backend or production readiness.

## Working rules

Read AGENTS.md and README.md. Preserve the approved palette and behavior. Keep plain HTML/CSS/JavaScript. Edit source pages, rebuild every preview, run check/test, and review responsive visuals after UI changes. No backend, deployment or outbound messaging is authorized by routine frontend work.

## Current pages

- **Landing:** independent feature demos and artwork; demos stop off-screen/on interaction and respect reduced motion. Lower chapters from Find what fits through the footer use compact spacing and concise action-based explanations. Feature chapters and support sections each occupy at least one desktop viewport below navigation, with compact centered content and consistent padding. Phones/tablets retain natural height. FAQ has a clear background; planned cards use a faint page/surface blend. Plain Coming soon summaries in all five feature sections link to a bottom roadmap grouped by section, plus account, smooth browsing, help/privacy and accessibility. Roadmap text has no colored cards or pretend buttons; collection sample metrics retain plain Planned labels. Made to be seen demonstrates One page / Two pages, links to the sample read-only viewer, and keeps future sharing/exports in one note. Collection metrics remain illustrative.
- **Workspace:** minimal side-by-side saved covers, binder actions and viewer links, and My collection. Create binder shares the tab-row action position with collection actions; View/Edit use neutral shared controls. Captions are at least 14px, menus fit narrow viewports and Escape returns focus. Three binders per browser; up to 30 pages each.
- **Editor:** binder-first canvas with the existing left tool rail and Cards/Customize functions, a collapsible right Pages sidebar, vertically reorderable page previews and its own controls footer. Cards starts closed; selection actions and dismissible notifications float without reserving canvas space. Desktop Cards/Customize drawers retain their resizing behavior; narrow drawers overlay the canvas.
- **Discover:** artwork-first responsive gallery of 55 sample English printings across six sets. Search, collapsible filters and sort share a compact toolbar; visible swatches and the custom color picker use the existing curated-palette ranking and URL state. Sets use larger artwork compositions. Card details prioritize artwork and binder/collection actions, with fictional prices in a secondary disclosure. Related printings, image zoom, 24-card pagination and manual collection Save/Undo remain. Escape dismisses a nested image/inventory dialog without closing its parent details.

- **Viewer:** saved browser-local binders in a read-only cover/page presentation, opened from Workspace → View binder. Responsive navigation, zoom/pan, card/artwork inspection and supported fullscreen. No unlisted links yet.

## Binder behavior

Swap, cross-binder card copying and multi-card picker insertion are implemented. Click exactly two cards, then choose the Swap icon. The Copy cards to another binder icon opens a destination chooser; its same-tab session handoff preserves effective card frames and finishes without editing either saved binder. The destination opens Cards with Paste copied cards; Paste creates one undoable draft edit, and manual Save is still required. Unsaved navigation warnings remain. Cards → Select cards supports independent choices across filters, a count and Clear; Add N cards fills empty ordinary pockets from the active page forward, creates pages up to the 30-page limit, then uses Overflow. Existing pockets, merged regions, artwork and physical inventory are untouched. Every copied card receives a fresh content ID. A failed batch rolls back fully. `editor-arrange.js` owns these controls and the handoff; `editor-state.js` owns the edits/history.

Landing roadmap wording distinguishes implemented picker selection, page thumbnails and artwork crop controls from deferred whole-set insertion, automatic binder arrangement, uploaded card-frame artwork and saved reusable designs. Discover's curated palette matching is available; full-catalogue automatic artwork analysis stays planned. Find what fits uses moderately larger cards, including on shorter desktop windows.

Manual Save only; unsaved changes warn on navigation but have no automatic draft. Cards, optimized artwork and placeholders share generic movement/overflow behavior. Catalogue/Overflow replacement, shrinking/deleting a page, and merging preserve displaced items in Overflow. Dropping one placed card onto another swaps their complete contents; an empty target still moves the card. Clearing Overflow confirms and supports Undo. Connected merged shapes preserve gaps and clipped hit areas.

Directional insertion from Add cards is implemented: the left quarter of a pocket pushes right, the right quarter pushes left, and the centre preserves ordinary replacement. Click/touch/keyboard placement offers two push-direction toggles; toggling the active direction off returns to replacement. Shifts stay in the target row, stop at the first empty pocket, and only eject the end card to Overflow if no gap exists. Merged pockets, artwork and reserved placeholders block shifting. Preview outlines identify the affected path and the ejected card without moving drop targets or changing data. Card identities, finishes and frames travel with each card. Each insertion is one Undo/Redo step, with the existing Overflow capacity rollback and manual Save behavior.

Cover design opens from the cover miniature; Card styles opens sleeves/toploaders. Styles can target selected cards, a page or the binder, including Overflow/future additions. Click a card directly on the visible canvas to retarget a sleeve/toploader draft; modifier-click toggles cards on the active page. Narrow screens use Choose a card on binder without losing the draft. Cover mode still blocks canvas interaction. Mixed selections are explicit; changing one style preserves untouched styles. Copy/Paste styles has direct contextual icons. Duplicate page offers layout-only or full content, with new IDs and Undo.

Preview binder provides a clean cover/page viewer with keyboard navigation and reduced motion. Inspect enlarges a selected pocket. Custom cover artwork supports Fill/Fit/crop reset and title text/position/alignment/size/color. Apply edits the document; Save persists it. Customizer presets scroll separately from the action footer.

Pages and Overflow remain separate, mutually exclusive right-sidebar views, switched by the existing top icons. Each uses the full content height above the pinned controls. View/settings is compact and anchored beside its left-rail button. Only the selection toolbar remains draggable. Workshop zoom/Fit controls and both More menus are removed; the canvas always fits automatically. Backup actions use Download backup / Restore backup; file formats and validation are unchanged.

## Ownership and saving

Physical inventory is independent from digital placement. Owned/Wanted, quantities, condition, grading, chase status, notes and trade status support explicit local Save/Undo/import. Discover and Workspace use the same collection form/store. Stale saves, unavailable/full storage and malformed imports fail explicitly; do not silently overwrite records.

## Runtime ownership

| Files                                           | Responsibility                                         |
| ----------------------------------------------- | ------------------------------------------------------ |
| binder-schema.js                                | Pure cover/image/frame validation and limits           |
| binder-media.js                                 | Local image decoding and optimization                  |
| editor-state.js / binder-store.js               | Undoable binder edits / explicit browser storage       |
| binder-visuals.js / binder-covers.js            | Shared pocket/card/cover rendering                     |
| editor.js / editor-studio.js / editor-layout.js | Editing interactions, design/viewing, drawers/popovers |
| collection-state.js / collection-form.js        | Inventory model/store / shared visual picker           |
| collection.js / discover-collection.js          | Workspace / Discover inventory UI                      |
| discover-core.js / discover.js                  | Pure catalogue filtering / Discover UI                 |
| workspace.js                                    | Binder list/actions and viewer/editor routing          |
| theme.js / ui-controls.js                       | Theme preference / visible controls and centered icons |
| \*-demos.js / hero-carousel.js / demo-motion.js | Landing demos and motion lifecycle                     |

## Styles and assets

fonts.css references licensed TTF files in assets/fonts/. site-system.css owns shared typography, spacing and controls. app-header.css/site-footer.css and binder-covers.css are reusable components. editor.css provides base canvas layout; editor-calm.css owns the current responsive editor layout; editor-studio.css owns viewer/designer components. Landing theme/demo styles remain separate.

The sample cover artwork is assets/images/pokemon-cover-art.jpg; its attribution is in assets/credits/. Preserve all licenses/attributions. SOURCE-MANIFEST.json records historical import provenance, not current file hashes.

## Verification

Run npm run build, npm run check and npm test. scripts/project-pages.cjs is the single page manifest for build/check. Browser checks cover manual saves/reloads, Undo, imports, scopes/mixed styles, custom artwork, page duplication, 6×3/3×6 and concave merges, collection handoffs, image failures, keyboard focus and reduced motion. Visually review all pages in light/dark at desktop, tablet and narrow widths. Existing automated checks are evidence for tested flows, not a guarantee for every browser/user.

## Deferred work

Backend/authentication, Supabase/cloud conflict recovery, live catalogue/prices, public sharing, printing/PDF/image export, bulk inventory/checklists, lazy catalogue requests, caching, rate limits/storage quotas, saved style presets, drag-to-pan cropping and automatic cover-title contrast remain future decisions. Keep the user’s no-autosave preference.

## Approved editor baseline

Preserve the minimalist editor: no page metadata above the canvas; save status only while unsaved; fixed left tool rail without its surrounding panel or drag grip. The right sidebar shares Pages and Overflow, with icon shortcuts and context-only Clear. Its footer exposes searchable Help. Undo/Redo and View/settings are direct left-rail controls. Selection uses a movable compact icon overlay and a visible count only for multiple pockets. Placement and routine selection stay quiet; completed edits retain dismissible timed Undo feedback. Nothing reserves a smaller Fit area. Existing drawer, styling, keyboard and manual-save behavior remains. Earlier layouts are archived in HISTORY.md.

## Maintenance — 2026-10-15

Binder identifiers are validated before saving. Overflow rejects edits beyond its existing 2,000-item capacity with full rollback. Storage clear events refresh clean Workspace/Discover views while preserving dirty edits. Stale rename reports a missing binder. Obsolete selectors, repeated declarations, unused demo controls and unreachable branches were removed without changing the approved appearance. See CODEBASE-AUDIT.md for evidence and limitations.

Editor refinements: both the left tool rail and right sidebar have full-height canvas dividers. Overflow remains a separate view and fills the available height to the pinned footer. The former More menus are removed; View/settings groups page view, rows and columns in one compact row. Card styles uses a card-and-sparkle icon.

Sidebar header: expanded order is Collapse, Pages, Overflow (then Clear when applicable); collapsed order is Expand above Pages and Overflow. Opening the panel slides in over 160ms; reduced-motion disables the animation.

Cards drawer cleanup: a short edge-drop hint, outlined search/filters and selection controls, and a shared count/selection row leave more space for artwork. Sample labels are removed from this drawer; catalogue scope remains documented elsewhere. Contextual actions are direct named icons. Invalid merge guidance stays available through the Merge tooltip and its screen-reader description without adding a visible toolbar row.

Phone editor layout (700px and below): the binder uses the full canvas width, with a 56px header and a horizontally scrollable icon dock using the existing tool order plus Pages. Cards, customization and Pages/Overflow open as mutually exclusive full-width bottom sheets; Pages and Overflow remain distinct views. The existing Pages toggle moves into the phone dock and returns to its desktop header above the breakpoint. Phone Cards uses tap-to-place instructions, side-by-side filters and 16px inputs; short landscape Cards separates filters from artwork. Escape dismisses the Pages sheet and restores its dock trigger. Desktop layout and editing behavior remain unchanged.

Mobile customization refinement: compact three-column cover/frame presets, a segmented tab row and a target-picker icon beside Apply to. The pinned footer distinguishes Apply from Cancel. The live cover/binder preview fits in the unobscured area above the portrait sheet or beside landscape controls; choosing a card restores the normal canvas. Save has a fixed touch target and a separate account target. Apply remains a draft edit followed by explicit manual Save.

## Icon workshop — 2026-10-16

The left rail provides Cards, Cover, Select pockets to merge, Card styles, View/settings, Undo, Redo, Preview, Download backup, Restore backup and Discover as bounded icon controls. The header replaces Preview with a light/dark toggle; Save remains explicit. Tooltips and accessible names describe every icon. On phones the icon dock scrolls horizontally and pins Pages at the right edge.

Normal card clicks toggle selection without moving content; additional clicks accumulate on the active page. Selection uses a thick outline, check badge and dimmed unselected cards. Mouse drag moves cards; touch hold (220ms) then drag moves a placed card. The Move icon offers page-and-pocket placement for click/keyboard users, including the current page. Merge mode is separate. Context actions (including Swap and copy between binders) have direct icons. Routine feedback shows a short visible action sentence with Undo and Close, expiring after three seconds (paused during hover/focus). Errors keep useful explanatory text.

The canvas automatically fits and has no manual viewport zoom/Fit controls or page-count caption. Visible bordered navigation buttons turn pages and show a plus at the end. Sleeve/toploader editing allows existing-page navigation while preserving the draft and direct card retargeting. Cover mode blocks card editing. Transparent is a validated cover preset rendering the first page with the shared artwork/styles and merged-region clipping; it persists in backups, Workspace and both viewers.

The right footer question mark opens a searchable Help drawer covering placement/push, selection/movement, merging, styling, pages, Overflow, history, backups, copying and actual keyboard commands. Escape closes it and restores focus. Pages and Overflow remain separate full-height views. Desktop and mobile buttons retain keyboard access; real mobile hardware and Safari still need manual release testing.

## Workshop polish — 2026-10-16

Cards, customization and View/settings occupy the left tool column on tablet/desktop; both page views fit and center in the space between the open panels. Phone sheets retain the upper preview and touch navigation. Changing from Cover to Sleeves/Toploaders refreshes navigation immediately; page turning preserves the styling draft, and Apply requires a valid selection/page target. Cover editing clears merge mode. A card dropped onto another placed card swaps identities, finishes and frames without touching Overflow; catalogue insertion/replacement and non-card displacement retain their prior behavior. A self-drop cancels quietly.

Floating selection tools size to their currently visible actions even after dragging, with smaller bold icons inside consistent buttons. Icons and disclosure chevrons are centered; customizer section headings have bounded padding and one chevron. Empty pockets always show a plus, including a safe position within a concave merged shape. An unselected facing page has no red active outline, and collapsed Pages/Overflow shortcuts have no selected state. Brief notifications show the action as text for three seconds, with Close and the existing version-safe Undo. Save remains explicit and browser-local.

Regression checks cover the exact Cover-to-style path on desktop/phones, both page views and pane combinations at desktop/tablet widths, native card swaps, state history with full Overflow, toolbar shrinking after dragging, icon centers, disclosure bounds and notification expiry/dismissal. Brave/Edge and phone-size emulation are available; physical iOS/Safari still require manual release checks.

## GitHub publishing

The user authorized publication to `EsteriT/Pokedex`. The original MVP tag stays on `dcff24c`; publishing changes are separate. `npm run build:pages` creates the checked static artifact in `dist/`. The Pages workflow deploys pushes to `main`; see [DEPLOYMENT.md](DEPLOYMENT.md). Routine frontend work still does not authorize unrelated hosting or backend changes.

## Post-MVP interaction fixes

Landing CTA links omit decorative arrows, including Explore Pokedex and the sample viewer link. Entering pocket-merge mode retains an existing selection, keeps the rail button visibly active before selection, and disables placed-pocket dragging while picking merge targets. Exiting merge mode clears the selection. Text tabs in Design pocket size to their labels and wrap within narrow dialogs.
