# Implementation history

Historical record retained from the prototype iterations. Earlier entries may be superseded. Use [HANDOFF.md](HANDOFF.md) for current behavior and file ownership.

# Current landing-page handoff

## Start here
Open preview/Pokedex-landing-page.html. Read DESIGN.md for the visual specification and WEBSITE-GOALS-AND-FUNCTIONS.md for product scope.

This package is a copy of the latest landing-page design, not a transcript export. Its current source and preview are authoritative. Earlier conversation requests were repeatedly replaced; use the final decisions recorded here.

## Current status
The page is a standalone HTML/CSS/JavaScript prototype. It has six main sections, a visible FAQ, closing action, compact footer, and Light / Dark / System modes. The user intends to finish all page designs before connecting the application in Codex. Integration is not authorized by this handoff.

## Source map
| File | Responsibility |
| --- | --- |
| src/index.html | Header, section containers, footer, dependency order |
| src/styles/base.css | Original shared structure and component styling |
| src/styles/hero-carousel.css | Hero wheel geometry and card-pocket layout |
| src/styles/arrange.css | Arrangement demonstration components |
| src/styles/layout-and-spacing.css | Current section layouts, responsive rules, consistent spacing |
| src/styles/light-theme.css | Final porcelain palette, typography, card presentation, light-mode overrides |
| src/styles/dark-theme.css | Dark palette and theme-specific control styling |
| src/scripts/theme.js | Theme choice, localStorage, system appearance |
| src/scripts/demo-motion.js | Shared viewport eligibility, preserved entrance animations, user pause state |
| src/scripts/hero-carousel.js | Six-binder carousel, drag, momentum, arrows, dots, gradual autoplay |
| src/scripts/arrange-demos.js | Placement, swapping, push, pages, copy/undo, sorting |
| src/scripts/customize-demos.js | Cover/grid, pocket merge, sleeve/toploader examples; includes inherited scene helpers |
| src/scripts/discover-demo.js | Sample search/filter results and color picker/hue slider |
| src/scripts/collection-and-share-demos.js | Ownership/completion/value updates and share/export/print examples |
| src/data/sample-cards.js | Sample Pokémon 151 catalogue |
| src/data/hero-binders.js | Six hero binder arrangements and remote card image URLs |
| src/data/embedded-ocean-artwork.js | Embedded data URL for the downloaded ocean photograph |
| assets/ | Original photograph and credit |
| scripts/ | Dependency-free preview build and reference/syntax check |

Style order is intentional: base → hero → arrange → layout/spacing → light theme → dark theme. Avoid changing that order casually; later files override earlier ones. Do not remove inherited helpers without checking live references.

## Final interaction requirements
- All visible feature demos loop from the start after finishing. They are independent, not arbitrated one at a time.
- No replay, pause, or resume buttons, including the hero carousel.
- Stop animations off-screen and while the browser tab is hidden.
- User input stops that example and preserves choices. Do not overwrite them with autoplay on return.
- Reduced motion shows static examples.
- Fade entrance is one-time and uses stable layout positions. It must not flicker or change section height.
- Selecting an Arrange or Discover explanation must not scroll the page.
- Independent rows/columns range from 1 to 6; zero was removed as confusing.

## Known limitations and review targets
- Main Create your binder actions now open the sample Workspace prototype. They do not perform sign-in or open a production editor.
- Search uses a sample catalogue. Color matching selects among three curated palettes; the limitation is visible.
- Collection prices are illustrative USD numbers, not live data.
- Sharing/export/printing are visual examples. Privacy and printing answers are labeled planned.
- Card images use external hosts; there is no offline image cache in this package.
- CSS includes accumulated overrides. A later cleanup should preserve appearance and cascade order.
- Mobile layout, all dark-theme states, keyboard usability, and fade stability need a complete real-browser QA pass. Prior verification was build/syntax checks and focused simulated behavior checks; do not claim comprehensive visual QA.

## Latest behavior fixes

- Reduced-motion changes are read live by every demo; manually chosen values remain preserved.
- Binder grid and cover sizing follows board resizing without restarting its demo.
- Discover shows the selected search, rarity, or palette result statically with reduced motion.

## Verification
Run npm run build and npm run check. This transfer also verifies source-file copy hashes and compares the generated preview with the original preview to ensure no design changes were introduced by reorganizing files.

## Next Codex prompt
Read the handoff, design, and product documents. Inspect the current source. Continue only the landing-page work requested by the user, preserve the latest appearance and interaction rules, and rebuild the preview after changes. Do not connect production functions yet.

## Origin
Copied from C:/Users/thukh/Documents/Codex/2026-10-11/i-wna/outputs/pokedex-style-preview. The original remains intact. Packaging date: 2026-10-12.

Binder preview sizing: the preview uses a 264px board with space reserved for its title. Pockets, gaps, borders, and plus symbols scale uniformly to fit every 1–6 row/column combination. Cover buttons and the Master Ball emblem use the shorter cover dimension, preserving their proportions on tall and wide pages. The outer demo box remains 360px tall.

## Application planning documents

DESIGN.md now preserves the existing landing-page specification and adds a proposed application design with questions Q01–Q20. ARCHITECTURE.md records proposed data/API responsibilities, reliability/security requirements, and questions Q21–Q30. Recommendations and open questions are not approvals. The user authorized these planning documents; application-page implementation, backend integration, and deployment still require a subsequent request. The warmer light theme remains proposed, not applied.

## Workspace frontend built — 2026-10-12

The My binders view is now a frontend prototype in src/workspace.html, src/styles/workspace.css, src/scripts/workspace.js, and src/data/sample-binders.js. It uses the existing palette, two sample binders, three-slot limit, search, create (name and 1–6 independent rows/columns, one starting page), rename, duplicate, permanent-delete confirmation, and a read-only binder preview. Account menu identifies the sample account; My collection is a placeholder. Data is held in memory only, resets on reload, and is clearly labeled. No sign-in/backend/editor has been implemented. Landing creation/Explore actions link to Workspace; its logo links home. The builder generates both standalone previews and check validates both pages. Fine-tuning follows user review.

## Workspace refinement — 2026-10-12

Removed decorative intro/tagline/studio-note copy. Retained one concise sample-data/reset disclosure beside the heading. Search uses a subtle container border focus state; keyboard users retain a visible neutral outline on the container instead of a red input rectangle. Footer is now a contentinfo landmark outside main, with real Home/FAQ links and fan-project identification, positioned at the bottom on short pages without an overlay. HTML source and Workspace code use consistent Prettier formatting while preserving dependency execution order. Dialogs have explicit accessible titles.

## Workspace card and footer alignment — 2026-10-12

Binder grid rows stretch to equal heights, including Create another binder; fixed placeholder heights were removed at every breakpoint. Binder metadata/actions align even when names wrap. Landing and Workspace share site-footer.css and matching footer content; Workspace section/FAQ links point back to the landing page. Sample-data notice remains by the Workspace heading.

## Application header — 2026-10-12

Workspace now has application-level navigation with Workspace marked aria-current="page", logo linking to landing, theme selector, and sample-account menu. Shared styles are in src/styles/app-header.css for reuse on editor and Discover pages. At narrow widths navigation occupies its own row. Discover has no link until its page exists; My binders/My collection remain page-level tabs. The landing retains feature-section navigation.

## Binder editor frontend milestone — 2026-10-12

Editor source: src/editor.html, src/styles/editor.css, src/scripts/editor-state.js (pure document operations), src/scripts/editor.js (UI). Workspace Open binder passes sample seed via URL fragment through an explicit source link, rewritten to the matching standalone preview. No draft storage/database/account persistence. Manual Save records an in-memory sample snapshot; UI states reload/leaving resets sample edits, with optional explicit JSON download. Catalogue search uses sample 151 records. Click/drag placement replaces occupied content into overflow; Undo/Redo covers placement, resizing, page changes, connected pocket merges, unmerge, overflow clearing, and rename. Pages have independent 1–6 grids, add/delete/reorder/navigation with maximum 30 and minimum one page. Occupied merge/overflow clear/page deletion have confirmations; keyboard selection and shortcuts are provided. Artwork uploads, covers/frames, cross-binder copy, production saving, pricing, and sharing remain later editor refinements/integration. This milestone is not the completed production editor.


## Outside-page card drops — 2026-10-12

Dragging a placed card outside the binder page within the editor moves it to overflow; Undo restores it. Gaps within the page do not remove cards, and catalogue/overflow drags outside the page do not add or remove contents. Merge/Unmerge guidance appears beside the layout summary.


## Merged pocket spacing and picker alignment — 2026-10-12

Merged region geometry fills only gutters connecting its own cells, preserving spacing beside separate pockets, including irregular shapes. The same tile geometry defines clipping and external outlines. On side-by-side layouts the card picker stretches to the canvas panel height, with a scrolling results area and bottom-aligned hint. Mobile keeps a separate bounded card list.


## Concave merge corner correction — 2026-10-12

Only four occupied corners fill a gutter intersection. Three-corner fills previously produced stepped borders protruding into gutters around an unmerged pocket. U-shaped merges now preserve the complete horizontal gutter above their separate bottom pocket; all rotated L shapes preserve concave gutters.


## Frontend reliability and usability — 2026-10-12

Explicit editor Save now stores validated full binder documents in browser localStorage through binder-store.js and updates Workspace metadata. Workspace create/rename/duplicate/delete persist only on those explicit actions. No editor autosave or recovery draft exists. Saved data is browser/origin-specific, not cloud/private-account persistence; JSON download/import provide portable backups. Import validates card IDs, complete/nonoverlapping grids, connected merged regions, IDs and limits before an undoable replacement; Save is still required. Storage failures and stale-tab saves are reported without overwriting documents. Three binders and 30 pages remain limits. Reset requires confirmation.

Focus and list scroll are restored during editor rerenders; Select pockets mode avoids modifier shortcuts; connectivity disables invalid Merge before confirmation. Pending click moves survive page navigation and Move to page offers a destination picker. Cancelled drags clear placement state. Layout shrink preview lists displaced cards and affected merges. Sticky controls include visible feedback/Undo; zoom and Fit page preserve card proportions. Sample cards display set/printing labels without claiming unavailable variants. Starting cards exceeding page capacity go to overflow. Remaining-slot copy is calculated. Backend/authentication/live catalogue/prices, artwork and production sync remain unimplemented.


## Discover frontend milestone — 2026-10-12

Discover is now authorized and implemented as src/discover.html with discover.css, discover-core.js (pure search), discover.js (UI), and sample-card-details.js. Verified TCGdex snapshot: 55 cards across six English sets (HeartGold SoulSilver, Black & White, XY, Sun & Moon, Sword & Shield, and 151). This is a small local sample, not the full 2010-onward catalogue or a runtime API integration. The metadata source is https://api.tcgdex.net/v2/en/cards and documentation https://tcgdex.dev/rest. Curated palettes demonstrate chosen-color ranking, not full artwork analysis. Search, set/type/rarity/finish filters, sorting, URL-preserved state, filter chips, 24-card pagination, missing-image/no-results/loading/error states, accessible details dialogs, raw/graded fictional USD price examples, and binder/page selection are implemented. All price examples explicitly identify fictional data, with source/update states unconnected.

Discover opens the editor with a pending card placement on the chosen page; it does not modify or save the binder itself. Placement and Save remain explicit. Existing 151 binder IDs remain compatible; new sample card IDs are set-qualified to prevent number collisions. Finish choice is optionally preserved in saved pocket content. Workspace and editor headers link Discover; landing feature anchors retain their existing behavior. Four standalone previews are generated and checked. Authentication, live market coverage, full catalogue ingestion, ownership tracking, artwork analysis and cloud saving remain later integration work.


## Discover usability fixes — 2026-10-12

Failed catalogue dependency loading now offers Reload page to re-request scripts. On phones up to 560px, filters start collapsed in a native keyboard-accessible disclosure with an active-filter count; desktop retains expanded filters. Chosen-color ranking displays Closest color while preserving the previous ordinary sort when ranking is switched off. Discover passes the current search/filter/page URL to the editor; its Discover header and Return to results link restore that context, including after explicit Save/reload. Return URLs are restricted to the current same-origin Discover route. Combined name-and-set text search was intentionally left unchanged; use a name query plus the Set filter.


## Discover artwork inspection — 2026-10-12

Card details close icon is now a centered SVG. Clicking the artwork opens a larger image dialog with 100–300% zoom, +/- buttons, Fit image, native scrolling/arrow-key exploration, image loading/failure states, Escape closure and focus return. Related printings use normalized card/Pokémon names within the 55-card sample, exclude the current printing, and switch details in place without losing the original results focus. Empty related lists clearly identify the limited sample. Images retain their proportions and original artwork; no new provider or market integration was added.


## My collection frontend foundation — 2026-10-13

Workspace My collection is implemented with collection.css, collection.js (UI), collection-state.js (pure inventory and explicit local storage), and sample-collection.js. Owned groups use printing/finish/condition plus grading-company/grade distinctions; Wanted groups are independent and support extra copies of already-owned cards and chase flags. Quantities, Unknown-default condition, grading labels, optional notes, and whole-group trade/sale status are editable. Duplicate compatible groups combine quantities and retain notes, with conflicting trade statuses rejected instead of overwritten. Removal has confirmation and Undo. Search/set/condition/trade/chase filters and totals are implemented.

Manual Save uses a separate pokedex.collection.v1 store, detects stale-tab saves, and reports storage errors. No automatic drafts or cloud/account persistence. Inventory never writes digital binder records. JSON download/import are explicit, validated and undoable; import still needs Save. Unsaved browser-close/navigation warnings are provided. Workspace URL ?tab=collection opens this tab. Collection value remains unconnected. Set-completion checklists and ownership integration in Discover are the next collection refinements, not included in this foundation.


## My collection simplification — 2026-10-13

Totals use a compact line. Filters are collapsed with an active count; Wanted hides condition/trade controls. More contains JSON import/download, reload and contextual Redo; Undo appears after edits. Rows only badge trade/sale/chase status. Quick add defaults to the active Owned/Wanted view with Unknown condition; optional fields sit under More details, expanded for editing. Search refinement preserves the selected finish when the printing remains selected. Manual Save and independent inventory storage remain unchanged.


## Visual selection and Discover collection connection — 2026-10-13

CollectionForm is a shared visual selection/edit form used by Workspace and Discover. Thumbnail cards show name, set, number, selection outline/checkmark and a selected-artwork preview; search supports keyboard-operable buttons and empty/missing-image states. Owned/Wanted selection, finish, quantity and optional details use the same form. Browse Discover opens another tab to preserve the current unsaved Workspace session. Discover can add records in-session and explicitly Save collection to the same independent browser store; Undo, download-edits and stale-tab protection remain available. Open in My collection passes validated printing/finish through a one-time fragment, opening an uncommitted form. Binder placement remains independent and unchanged. No backend/autosave/live catalogue was introduced.


## Collection usability fixes — 2026-10-13

Card-search Enter never applies inventory changes. Opening/cancelling another Discover addition preserves Undo when the stored revision is unchanged; actual external updates still refresh clean state. Selected-image failures show a visible fallback. Add copies and Update record distinguish actions. Discover Undo is also inside card details next to Save. Choose in My collection explicitly opens an uncommitted selection form. Selected-card context summarizes Owned/Wanted totals for the printing and breaks down the chosen finish by condition/grade, without decorating every thumbnail. Discover routes status announcements to one active region. Manual Save, artwork-led design and binder/inventory separation remain unchanged. Bulk selection remains a later option, not part of this simplification.


## Pinned for later — 2026-10-13

User deferred the following work; do not implement it without a subsequent request.

- Preserve search and scroll position across navigation; recent searches and recently selected cards.
- Bulk collection additions with review of quantities/finishes; user-chosen set-completion checklists.
- Server-side catalogue pagination, picker pagination/Load more, cached results, loading/retry/empty states for live requests. Current image lazy loading does not mean the full catalogue is fetched lazily.
- Live-price source, market, condition/grade and freshness indicators.
- Recovery/comparison for conflicting edits across tabs/devices, preserving the existing Manual Save decision and no automatic recovery drafts.
- User rate limiting and resource controls for backend/API integration: request bursts and sustained usage for catalogue search, price checks, writes, uploads, exports and reporting. Enforce on the server using authenticated user identity, with appropriate anonymous/IP controls and provider-wide limits.
- Review per-account storage/upload quotas, file-size/type constraints, expensive-job concurrency, duplicate request protection, abuse monitoring and service spending caps. Keep confirmed beta limits of three binders per account and 30 pages per binder; other values remain undecided.
- Explain limit feedback with a clear retry time, preserve user input and unsaved edits, and avoid punitive lockouts for ordinary usage. Exact limits, implementation and provider allowances will be chosen during backend design.

These items are a deferred backlog, not claims of implemented functionality. Existing frontend behavior remains unchanged.


## Binder cover customization — 2026-10-13

Editor Customize opens an artwork-led cover preview with an adjoining theme panel; Workspace binder menu has a direct Customize route. Classic and five Ball themes are available. Choosing a theme previews it only; Cancel/Escape restore the editing view, Apply creates one undoable cover edit, and explicit Save persists it. Save/Undo/Redo are disabled during uncommitted cover selection. Saved covers appear on Workspace tiles and survive duplicate/rename, validated JSON import/export and reload. Older binder documents without cover data remain valid. Covers are scoped to a binder; sleeves/toploaders and artwork customization remain the next sections, not implemented by this milestone.


## My binders visual upgrade — 2026-10-13

Workspace binder tiles use consistent large cover previews (Classic for uncustomized binders), theme-tinted stages, restrained depth and compact page/theme metadata. Cover and title links open the binder; titles provide the primary keyboard stop, while native links also support opening another tab. Customize/Rename/Duplicate/Delete remain in the menu. The New binder tile uses a quiet book outline and stretches to match the row. Hover lift has keyboard feedback and reduced-motion support. Display defaults do not write cover changes; saved customization and existing actions are preserved. Styles are scoped to My binders in workspace-binders.css.


## Interactive bookshelf and binder preview — 2026-10-13

My binders retains Grid as the initial view and adds an optional horizontally scrollable Bookshelf view. Covers have pointer tilt in Grid and a pull-forward treatment in Bookshelf, with focus feedback and reduced-motion support. Preview in each menu opens the cover and browses all saved pages read-only, including independent grids and irregular merged regions; older sample binders clearly identify sample pages. Editor access remains one click. A draggable grip and Move left/right menu controls reorder binder records through existing stale-state checked browser persistence. Search must be cleared to reorder; drag cancellation does not write. Shelf order is local and explicit, independent of binder content and collection records. This preview is not public sharing.


## Minimal cover row — 2026-10-13 (supersedes Grid/Bookshelf presentation)

User rejected both decorated tile and shelf treatments. My binders now uses a single minimal responsive cover layout: upright saved covers side by side, names and compact metadata below, without large tile backgrounds, shelf/spine labels, view toggles, or a duplicate creation tile. Uncustomized binders show Classic without writing defaults. Subtle hover/focus lift and press feedback respect reduced motion; one click still opens the editor. Preview, Customize, Rename, Duplicate, Delete and Move left/right remain in the menu. Visible drag grips/pointer tilt are removed to keep the presentation minimal; stored order is preserved. New binder creation uses the existing heading action and empty state. Saved-page preview remains available.


## Minimal binder editing UI — 2026-10-13

Editor now uses a compact sticky toolbar with icon Undo/Redo, Select pockets, Customize, More and manual Save/status. Rename and JSON import/download live under More. Pocket operations appear with a selection inside the canvas, with Merge contextual to multiple pockets; guidance is shown only when needed. Page settings are expandable; overflow remains visible. Zoom is a compact canvas disclosure and editing tips are optional. A quieter canvas and restrained side panels preserve the palette, card artwork and core editing behavior. More-menu dismissal is scoped so page/zoom/help disclosures are not closed by unrelated clicks. Cover customization, explicit saves and existing confirmations remain intact.


## Left-side editor tools — 2026-10-13

Editing tools now use labeled icon buttons in the left column with Page settings and Overflow. Add cards sits below the tool panel; the canvas has the remaining width. Save/status is beside the binder title. Contextual pocket operations remain at the canvas. On mobile the tools precede the canvas and the card picker follows it. Cover customization behavior is unchanged; a more prominent visual entry is proposed for a subsequent decision.


## Balanced editor columns — 2026-10-13 (corrects previous left-tool placement)

User clarified that editing tools and Overflow belong on the right. The editor now has a wider card catalogue on the left, a smaller central binder canvas and a wider tools/settings/Overflow panel on the right. Catalogue thumbnails are larger and Overflow has a taller scrollable list. Desktop canvas height is reduced to 500px while preserving Fit/zoom and card proportions. Tablet places the tools below the two main columns; mobile stacks tools, canvas and catalogue. Cover customization retains its dedicated preview. Save remains beside the title.


## Visual customization milestone — 2026-10-13

Editor title has a clickable saved-cover miniature labeled Edit cover. Customize uses Cover/Sleeves/Toploaders visual sections with None and themed presets, combined preview and explicit scope (selected cards/current page/all binder cards, including future placements). Styles apply only to actual cards and persist with placed cards through movement/Overflow; applying binder-wide styles resets existing overrides.

A selected pocket opens Artwork/Placeholder design. JPG/PNG/WebP uploads up to 5 MB are decoded and optimized locally (maximum 1200px output; bounded encoded size). Fill/Fit, zoom and positioning preview the actual merged shape before Apply. Placeholders have visual styles and optional target printings without changing collection ownership/Wanted records. Replacements preserve displaced content in Overflow; editing the same image crop preserves its ID. Undo/Redo, manual Save/reload, JSON validation and Workspace saved-page preview support typed content and card styles. Art stays in browser-stored binder JSON in this frontend milestone; no cloud upload/printing/sharing was added. A temporary per-binder encoded artwork bound protects browser storage; quota failures remain explicit without overwriting data.


## Landing-matched card frames — 2026-10-13

Sleeves and toploaders now use the landing page Ball-gradient rims, rounded corners and translucent rigid-case inset. Shared rendering keeps editor choices, placed cards and Workspace previews consistent. Editor heading scrolls naturally instead of sticking at the top. Selected-card, page and binder styling scopes remain available.


## Editor visual polish — 2026-10-13

Editor uses consistent Segoe UI typography, a quieter cover/title header, compact save status, grouped SVG page navigation, refined panel borders and rounded controls. Storage/sample explanation lives in More rather than the title area; sample catalogue remains labeled. Guidance is shortened, with contextual pocket tools and existing behavior retained. The header remains nonsticky. Scoped editor-polish.css follows the editor customization styles.


## Manrope typography — 2026-10-13

Binder editor uses bundled Manrope regular/medium/semibold/bold, including inherited form controls. Embedded font data keeps standalone previews independent of font-network requests. SIL Open Font License retained in assets/manrope-OFL.txt.


## Compact editor entry — 2026-10-13

Editor title row contains return navigation, binder name and Save/status. Cover miniature moves beside right-side design tools. Entry/reload/pageshow reset document scroll to the top; pending-card focus avoids scrolling. Existing responsive tool placement and customization remain intact.


## Banner removal and customization entry — 2026-10-13

Standalone editor title/notification banner removed. Binder name is in the canvas heading, My binders is in application navigation, and Save/status sits above right-side tools (moves into customizer while open). Routine notifications no longer display; error feedback remains beside tools. Removed customizer scrollIntoView; entering customization resets to page top. Redundant preview guidance is removed.


## Shared spacing and typography — 2026-10-13

All four pages load site-system.css last, with bundled Manrope and a shared 4/8/12/16/24/32px spacing scale. Equivalent page titles, panel titles, body/control text and metadata use common size tokens; landing display headings retain their larger marketing role. Editor binder name/page count stack with a 4px gap. Cover preview fills its stretched panel; preset grid is separated from action buttons by a 24px margin and 16px padded divider. Desktop/390/320px fit and cover geometry verified.


## Distinct design entries — 2026-10-13

Clickable cover preview opens Cover design. The former Customize tool is now Card styles and opens Sleeves, with Toploaders beside it. Selected-card/page/binder scopes remain unchanged. My binders navigation remains the return route.


## Binder studio refinement — 2026-10-13

Editor adds Preview binder (cover opening, page navigation/keyboard and reduced-motion support), selected-pocket Inspect with zoom, Copy/Paste card styles under contextual More actions, and Duplicate page under Page settings (layout-only or full content; unique IDs; Undo; 30-page limit). Preserved irregular merged geometry is shared with inspection/viewing. Pocket hover/selection/drop states and a brief placement animation provide restrained feedback; long titles wrap.

Cover design has an Artwork & title disclosure: optimized JPG/PNG/WebP upload, Fill/Fit, crop reset, zoom/position, optional title text/color/size/alignment/position. Custom covers render in editor/Workspace/viewer and survive explicit Save/reload/JSON. binder-media.js shares cover validation and image normalization; embedded image bytes remain bounded browser-local data. Full page duplication respects aggregate artwork bounds. No backend, upload service, public sharing or printing integration was added.

Card style scopes display affected counts and Mixed sleeves/toploaders. Only explicitly chosen style fields apply, preserving differing untouched styles. Binder-wide changes include Overflow/future placements. Fit mode centers artwork and disables ineffective crop controls; Reset crop restores Fill/zoom/position defaults. editor-studio.js/css isolates viewer/inspector/custom-cover UI; editor-state.js owns undoable duplication/cover/frame-patch operations. Browser checks cover Save/reload, custom cover Workspace rendering, mixed-style preservation, inspection, duplication, 6x3/3x6 and L-shaped pockets, upload failure, keyboard focus, reduced motion and mobile fit. All model regressions pass.


## Final control and visual consistency pass — 2026-10-13

Text actions (Fit, Zoom, editing tips, page settings, crop reset, destructive actions and menus) now have visible bordered controls. Workspace tabs are segmented buttons and binder menus have centered SVG dots. ui-controls.js enhances static/dynamic action buttons and replaces font-based close/chevron icons while preserving accessible labels and native behavior. All headings/forms use Manrope; bundled font faces move into fonts.css to keep site-system.css readable. Shared dropdown chevrons sit 14px from the edge with 40px trailing padding; close icons use centered SVGs, and header/footer marks share sizing and centering.

Customizer presets/artwork scroll within customizer-design-body while Cancel/Apply remain in a separate footer, preventing overlap. All four pages were checked at 1600/1280/900/390/320px in light/dark themes; editor, collection, Discover, inspection/viewing, Save/Undo, mixed styling, merged geometry, and error-state workflows pass. This is an automated/visual usability review, not a replacement for human testing or a guarantee across every browser.

## Archived handoff implementation notes — 2026-10-15

These chronological notes are superseded where they differ from the current HANDOFF.

## Cleanup — 2026-10-13

Removed 98 unused CSS rules, 47 exact duplicate declarations and empty groups. Consolidated three editor tweak sheets into editor-layout.css. Centralized image validation/limits and upload processing; removed unused locals. Binary font/artwork data moved out of readable source code; preview builds remain self-contained. Formatted source and checks consistently. Requirements remain in DESIGN/ARCHITECTURE; historical implementation notes are in HISTORY.

## Landing mobile layout — 2026-10-13

Landing-only landing-responsive.css provides compact inline Menu navigation below 1100px, a stacked hero and demos on smaller screens, mobile-sized form/style controls, and a single-column phone footer. landing-navigation.js controls menu visibility, closes it after a section link or Escape, returns focus, and resets on desktop/mobile resize. Desktop appearance and demo motion behavior remain intact. Other application pages await their own mobile design pass.

## Landing showcase refresh — 2026-10-13

Tablet customization demos use equal copy tracks and matching 500px stages; sleeves/toploaders span the next row. landing-showcase.css owns the collection gallery, ownership badges, progress/value panels and sharing/export tiles, with light/dark and phone layouts. The redundant sharing source illustration was removed. Sharing/exports remain planned previews; the sample collection button still pauses its own demo and updates only illustrative values. Sample completion now exposes an accessible progressbar.

## Landing boundary and resize correction — 2026-10-13

Landing root/main sections are explicitly constrained to the viewport; horizontal animation overflow is contained at the root and carousel stage. Arrange has no viewport-height minimum, its page-row flex children fit the panel, and tablets through 1100px use a stacked centered demo with a two-column feature list. Resize resets any retained horizontal scroll offset while preserving vertical position. Collection/sharing visual designs are unchanged. Verification now includes normal-motion timelines and repeated desktop/phone/iPad Mini/iPad Pro resizing without reload, not only reduced-motion initial loads.

## Landing section transitions — 2026-10-13

landing-transitions.js coordinates one-time entrances across headings, demos, FAQ and closing. It replaces the separate Arrange/Customize/Discover/Collection reveal triggers while preserving independent instructional playback. Entrances use 20px vertical motion, 1050ms easing and a short stagger; they remain independent of demo cancellation. Initial viewport/direct-link content stays visible, keyboard focus reveals pending content, and reduced motion finishes active entrances and shows remaining content. landing-motion.css removes section divider borders and uses 80–136px desktop/tablet and 64px phone section padding. Collection/sharing visual designs are unchanged.

## Collection gallery and cover consistency — 2026-10-13

Workspace collection uses collection-gallery.css for an artwork-first responsive grid, compact Owned/Wanted and quantity badges, a combined search/filter/sort toolbar, removable filter chips, visible card selection and contextual bulk removal. Bulk removal confirms group/copy counts, preserves binder placements and uses one undoable collection replacement; Save remains explicit. Filter changes prune selection to visible records. Optional record fields stay behind More details; desktop editing enlarges artwork and mobile editing uses a full-screen dialog. Existing image-led Add cards and Discover handoffs are preserved. Empty collections have a direct picker action.
cover-consistency.css defines proportionate spine/stripe/seal/symbol/title dimensions via cover-relative sizing across saved covers, editor thumbnails and designer/viewer. Replaced older per-context dimensions. The editor thumbnail now renders the actual named cover without a box or duplicate caption. Title color is visible above presets, with a Use theme contrast shortcut; Apply and Save remain separate. Existing custom artwork/crop and saved title colors are preserved.

Cover settings order: Artwork & title disclosure appears above Cover style presets; Title color and theme contrast sit inside its title settings.

## Compact cover studio — 2026-10-13

Cover settings now have three exclusive disclosure sections: Cover presets (one six-preset grid), Text (including color/contrast), and Your artwork (upload/fit/crop/reset/removal). Replaced the combined Artwork & title disclosure. Remove artwork returns to Classic; it is not a second cover picker. cover-studio-compact.css makes the preview smaller, gives settings more width, removes nested preset/settings scrollbars and preserves page scrolling plus Apply/Cancel. Sleeves/toploaders retain their existing tabs and scope controls. Tested live title/color previews, exclusive sections, no duplicate presets, responsive widths and explicit Apply/Save.

Sleeve/toploader choices now use a compact three-column grid (up to three rows). During card styling only, the live preview stays sticky while browsing; phones use a short card/name preview strip. Cover design retains its normal scrolling preview. Scope, draft/Apply and manual Save behavior are unchanged.

Live preview remains sticky in every customization tab, including Cover. Phones use the same compact preview strip for covers and cards so text/artwork settings remain usable beneath it.

## Workspace responsive refinement — 2026-10-13

workspace-responsive.css is scoped to Workspace: tablet covers use three proportional columns; phones retain two columns, readable names/metadata, full-row search and 44px action menus. Compact header/account controls preserve navigation. Create/rename/delete/preview dialogs have constrained mobile dimensions and larger form controls. Binder menu horizontal offsets are clamped on open/resize to keep first/last menus within the viewport. My collection retains its gallery design and shares the refined header. Desktop binder appearance and local Save behavior are preserved.

## Collection mobile flow and multi-card additions — 2026-10-13

Workspace Add cards now uses multi-select artwork tiles, keeps selections across searches, and offers a review step with independent quantities/finishes. Owned/Wanted and optional shared condition/grading/notes apply to the selected cards. Batch additions are validated in a temporary CollectionState and committed as one undoable replacement; a failing entry leaves the collection unchanged. Editing existing records and Discover single-card additions preserve their existing flow. Cancel clears the draft selection; cloud/local Save remains explicit. Phones use a full-screen, single-scrolling picker/review with a sticky search and action row. Prototype explanations and collection totals are tucked into About/More disclosures; save status and action/error feedback remain visible.

## Add cards filters and footer layout — 2026-10-13

The Workspace inventory form separates a single scrolling content area from a dedicated action footer, preventing buttons from overlaying card tiles. Add cards has combined set/type/rarity filters, a clear action, and selection preservation across searches/filter changes. Filters are shared by the collection form, including Discover single-card flows; existing-record editing stays unchanged. Workspace desktop/modal and full-screen phone layouts keep actions reachable without nested grid scrolling.

## Discover responsive refinement — 2026-10-13

discover-responsive.css scopes tablet/phone browsing and dialogs. Filters collapse through 980px; tablets use three card columns and phones two. Phone details use a fixed close header and one content scroll area; image viewing fills remaining height and refits on viewport resize. Add-to-binder and inventory forms use larger touch controls and fit narrow screens. Opening a new card resets the detail content scroll; returning from zoom preserves the current card context. Full sets remain a proposed Cards/Sets view within Discover, not implemented live catalogue loading.

## Discover set directory — 2026-10-13

Discover now has keyboard-accessible Cards/Sets tabs and a searchable directory of the six available sample sets. Set tiles use actual sample artwork and counts, open an unfiltered set in card-number order, and provide Back to sets. Filters and card details retain their existing behavior. More English sets and Japanese sets are noninteractive Coming later placeholders; no full-catalogue ingestion is implied. The Sets view supports a ?view=sets link. discover-sets.css supplies three desktop/two tablet-phone columns, contained artwork, reduced-motion interaction and theme-aware styling. Manual collection Save remains accessible outside both panels.

## Binder editor responsive workflow — 2026-10-13

editor-responsive.css and editor-mobile.js provide Binder/Cards/Tools views below 700px. The binder opens first; the original Save/status and error controls are moved into a compact shared toolbar without duplicate handlers or buttons. Catalogue/overflow taps return to Binder for explicit pocket placement; Select pockets also returns to Binder. Tools shows the overflow count and uses a full-width tray. Each phone view retains its scroll position; inactive panels are inert and tab navigation supports arrow/Home/End keys. Resizing keeps the focused panel visible and returns the original controls to desktop/customizer homes. Tablets through 1100px use a wider canvas beside the catalogue and tools/overflow below. Touch controls are at least 44px, form fields avoid mobile focus zoom, dialogs fit viewport bounds, and the existing compact sticky customization preview is preserved. Hidden canvases skip geometry work until visible. Desktop design, Undo/Redo and explicit Save remain unchanged.

## Pocket removal and menu bounds — 2026-10-13

Remove from page is a direct contextual action for selected placed contents, outside More actions; it preserves contents in overflow and is undoable. Phone secondary pocket actions expand inline rather than extending beyond the viewport; desktop popovers clamp horizontally on open/resize. Canvas rendering skips transient stages smaller than its padding allowance. Shared card/artwork rendering rejects invalid dimensions and scales placeholder insets safely for very small pockets, preventing negative SVG dimensions while switching phone views or customization.

## Hero carousel resumes after interaction — 2026-10-13

The landing binder carousel resumes automatic rotation after a released/cancelled drag and after arrow/dot/keyboard navigation. Flick inertia decays before the existing regular pace (one binder every 12 seconds) takes over. Off-screen/hidden-tab pauses and live reduced-motion preferences are preserved. This is an explicit user-requested exception to the other instructional demos, which still pause after interaction.

## Whole binder carousel bounds — 2026-10-13

Hero carousel paint fits each complete binder to the stage width/height with perspective and shadow margins, then clamps lateral orbit travel to the remaining space. Side binders remain within the stage instead of being clipped at its edges. Resize recomputes positions without resetting the carousel phase. Existing drag/swipe inertia, regular rotation, controls and reduced-motion behavior remain intact.

## Saved binder viewer — 2026-10-13

src/viewer.html builds Pokedex-viewer.html through the shared page manifest. Workspace View binder links carry only a binder ID; viewer.js reads the latest saved document via BinderStore without writing or including inventory/overflow/private collection records. Sample entries without saved documents are explicitly labeled samples. Cover rendering and card/frame rendering are shared; binder-geometry.js extracts the editor pocket geometry for both editor and viewer, preserving concave merges/gutters and hit areas. Cover intro, page picker, previous/next and keyboard/swipe navigation, fit/zoom/pan, inspection and supported fullscreen are responsive. Storage events refresh saved versions; missing/deleted/unreadable binders show an actionable empty/error state. The editor still previews unsaved edits locally. Real unlisted access, revocation and remote sharing remain backend work.

## Visible binder destinations and tidy actions — 2026-10-13

Workspace binder cards expose View and Edit as equal-size visible links below metadata. View opens the separate saved-binder viewer page; Edit opens the editor. Customize and management actions remain in a secondary menu with consistent 44px flat rows, 4px gaps and a separated Delete action. Replaced the inconsistent nested outlined-button treatment.

## Viewer presentation and page spreads — 2026-10-13

The viewer offers explicit Single page/Two pages controls with pressed states. Spreads pair pages 1–2, 3–4, etc.; odd final pages show a blank facing sheet without inventing a saved page. Mixed layouts share a fit scale and preserve pocket/card proportions. Page picker, arrows, keyboard and swipe advance by the selected mode; zoom/pan/inspection work on both pages. Sheet surfaces, a subtle spine, page numbers, coordinated controls and 420ms cancellable page transitions provide a cleaner presentation. Live reduced-motion changes finish transitions. Cover size is calculated from viewport space so Open binder remains visible without inner scrolling. Keyboard focus returns to inspected pockets after resizing. Browser-local/manual-save scope is unchanged.

## Code vacuum — 2026-10-13

Removed the unreachable Workspace preview modal, renderer, duplicate pocket geometry and handlers after viewing moved to viewer.html. Editor Preview remains available for unsaved work. Removed obsolete preview styles and unused Workspace card-rendering/Workspace-Discover-Viewer upload script loads. Removed three unused collection label maps and ignored DemoMotion host/continuous options. Parsed every runtime script and stylesheet; deleted 42 empty CSS blocks and 24 obsolete preview rules. No additional exact duplicate declarations/rules remained. Removed the now-unused Arrange section alias. Preserved media-query/cascade overrides and browser fallbacks. No dependencies or storage schemas changed.

Cleanup verification: all five previews rebuilt; model and browser interaction checks passed. Computed-style comparison found zero differences across 20 desktop/phone and light/dark page snapshots. Final source audit found no empty CSS blocks or single-reference local declarations.

The bottom Coming soon roadmap is a native details/summary disclosure, collapsed by default. Links from individual sections open it before scrolling to the relevant group.

FAQ now precedes Coming soon; both use matching disclosures and are collapsed by default. Sharing future text sits below the viewer actions, away from the artwork.

Support sections use nested native disclosures: FAQ questions open individually; roadmap categories show outline icons and short previews with feature lists hidden until expanded. Section roadmap links reveal both the outer roadmap and matching category. Both main sections remain closed by default.

Support expand controls sit beside their titles. Summary toggles preserve scroll position and disable browser anchoring to downstream footer content; only revealed content receives a short reduced-motion-aware entrance.

Latest support redesign supersedes the outer FAQ/roadmap disclosures: FAQ is visible in two columns with its first answer open and animated question rows. Coming soon shows three surfaced cards with red Planned badges; all nine original feature groups remain expandable inside the cards. Support sections share padding, and the final CTA is centered.

Landing consistency pass: solid actions share one red background, 48px height and 10px corners; navigation CTAs use arrows. Status badges share styling, future-link rows wrap without indentation, readable demo captions use 12px, and collection cards align flat. Dark accent text remains lighter than action backgrounds for contrast. Demo panels, FAQ band, hero motion and task-specific heading layouts remain intentional.

FAQ and Coming soon now use natural height and consistent section padding, placing these text-focused sections closer together. Only the five visual feature chapters retain one-screen desktop isolation.

Customize now has four equal demo tracks: covers/layout, pocket merging, sleeves/toploaders, and custom cover artwork. The fourth supports a built-in sample, local JPG/PNG/WebP preview (5 MB max), title and text color. It has no persistence; user interaction pauses its independent visible-only loop. Desktop is four columns, tablet 2×2 and mobile one column with touch-size controls.

## Focused Customize lessons — 2026-10-14

The four lessons now share .panel, a fixed preview track, a compact controls area and a live-result caption. Binder uses cover choices and 1–6 row/column steppers; Merge combines one neighboring pair with an accent tint and Reset; Sleeve/Toploader share one theme selector; Artwork has title, inline color and Upload only. Local uploads validate JPG/PNG/WebP under 5 MB and never persist. Title badges choose black or white behind custom text for contrast.
customize-demos.js now owns all four builders and one timing controller; superseded custom-art-demo.js/css are removed. Each burst lasts about 3.6 seconds, followed by six seconds of rest, with 350ms staggered starts. Visual changes and cursor fades are 180ms. Hover, keyboard focus and interaction pause; idle resumes after 3.5 seconds; off-screen/document-hidden pauses retain timeline progress. Reduced motion shows a settled final state. User settings are restored after auto demonstration; uploaded artwork is retained. Customize entrances use a 180ms fade instead of the shared long reveal.
Removed the unrelated square/L-shape merge tour and texture from this simplified pair-merge lesson; the full editor still supports those shapes. Combined the two sleeve/toploader timelines and removed Try artwork, number-input controls and floating cover-name labels.

Verification for the focused lessons: 320/390/768/1032/1280/1440/1920px in light/dark; equal panel heights and 40px targets; native Space activation for steppers/merging; pair/reset/non-neighbor behavior; shared style updates; upload success/error; contrast minimum 6.14:1 light and 7.43:1 dark; normal burst/rest, hover/idle resume, off-screen freeze, cursor/caption separation, all measured effects <=180ms, live reduced-motion changes, and preservation of uploaded artwork/title/color/theme after replay. Existing model regressions passed. Binder controls use two compact lines within the common control track to keep all dots/steppers at 40px.

## Customize preview refinements — 2026-10-14

Supersedes the pair-only lesson and title-badge details above. The binder lesson separates a shared BinderCovers preset drawing from a neutral pocket page: cover changes preserve the grid DOM and layout changes preserve the cover DOM. Merge offers Strip and Square modes; Square selects two diagonally opposite corners of a 2×2 region and combines all four pockets. Reset preserves the chosen mode. The loop demonstrates a strip, then a square; reduced motion settles on a square. L shapes remain available in the full editor, outside this introductory demo.
Sleeve and Toploader now use BinderVisuals.append, the same SVG renderer as the editor/viewer, with the same card for a direct comparison. Toploader uses its larger rigid rim, translucent shell and inset highlight; sleeves use the narrower rim. All five gradients come from the shared renderer.
Artwork uses the unchanged official Grookey JPEG, cropped through CSS to keep Grookey visible. Titles have no background block. Original ocean-photo.jpg, its obsolete data module and CC0 credit are removed; the landing footer and assets/credits/pokemon-cover-art.txt identify the new official source. Other pages no longer credit unused sample artwork. Shared panel tracks, 4/2/1 columns, touch targets and motion/preservation rules remain unchanged.

Verification: responsive tracks and bounds at 320/390/768/1032/1280/1440/1920px, both themes, native keyboard activation, independent cover/grid DOM, all four 2×2 squares in both corner directions, invalid strip/square choices, Reset, all five shared SVG frames, uploads and label contrast; motion and preservation checks plus application model regressions passed.

## Explicit pocket merging and smooth demo — 2026-10-14

Supersedes the Strip/Square modes above. The only controls are Merge and Reset. Pocket buttons toggle selection; Merge enables for exactly two edge-adjacent pockets or four pockets filling a 2×2 square. Invalid/disconnected/L selections remain editable and cannot merge. The nine pocket buttons persist across selection/reset, retaining focus and avoiding layout redraws. The merged overlay expands from the first selected pocket while internal pocket boundaries fade over 180ms; selected pockets tint smoothly and Reset cross-fades back to the original grid. The animated cursor glides between existing targets instead of fading at each selection. The loop explicitly selects a pair and presses Merge, holds that result, resets, then selects four square pockets and presses Merge. Other boxes retain their timings. Reduced motion, hover/focus/idle pause, offscreen freeze and personal selection restoration remain supported.

Verified: all 12 adjacent pairs and four squares require explicit Merge; invalid shapes, toggling/deselection, native keyboard focus, stable DOM, interpolated cursor and shape animation, user selection restoration, reduced motion, hover/idle/offscreen behavior, and 320–1920px layout checks passed. Build/check passed.

Pocket demo pace: selection and Reset steps now wait 720ms, matching the sleeve-theme loop cadence instead of rushing at 300–420ms. The strip result still holds for 1.1 seconds and the completed square rests for six seconds. Short 180ms visual transitions match the other lessons.

All four Customize lessons now use a calm shared pace: 420ms cursor travel before each action, 1.4 seconds to read each change, a 2.8-second strip-result hold, nine seconds resting on final results, and 1.3-second staggered starts. Automatic visual changes take 420ms; direct user feedback remains 180ms. Idle resume waits six seconds. The previous controller accidentally discarded per-step delays after the first step; this is corrected. Pending actions freeze offscreen and are discarded on direct interaction/reduced-motion changes, preserving user input. These slower automatic timings supersede the earlier under-200ms animation limit and 3.5-second idle rule at the user’s request.

Customize cadence and cursor accuracy: all actions now occur 600ms apart, including the 420ms cursor travel; no extra travel delay or special strip hold is added. The nine-second end-of-loop result pause remains. Cursor SVG uses a 20×25 viewBox matching its 16×20 size; its actual tip (2,1) is placed at the target control/pocket center with panel borders accounted for. Before each action the target is measured again to stay aligned after scroll/resize. Captions remain clear; pause, reduced motion and manual input behavior are preserved.

Customize sequence update: the three animated lessons now perform actions one second apart, including cursor travel. Sleeve presets advance in order Poké → Great → Ultra → Master → Premier with no intermediate return to Poké. The Artwork lesson is static with its Grookey sample/title visible immediately; automatic upload/title/color playback, animated cursor and edit-triggered preview pulse are removed. Title, color and validated local uploads remain interactive. Removed its unused snapshot/playback methods and the now-unused upload-busy hook from the animation controller.

Shared Customize walkthrough: supersedes independent loops and the static-artwork exception. One host-level cursor demonstrates Design → Merge → Sleeve → Artwork in DOM/reading order, with 800ms action intervals including 420ms travel. It starts only once the first panel enters view, pauses when its current target is outside the viewport (no forced scrolling on small screens), and resumes at the same point. Only the active box animates; completed boxes hold their results. The whole sequence rests nine seconds before replay. Hover/focus/interaction pause the whole sequence, idle resumes after six seconds, uploads block playback until decoded, and personal edits/uploads are restored after that box’s demonstration. Reduced motion keeps settled states with no cursor.

Verified: one cursor and one active box; below-fold idle until section entry; complete desktop Design/Merge/Sleeve/Artwork order with roughly 800ms action gaps; exact click hotspots; whole-tour hover/focus pause, manual title preservation and reduced motion; phone wait/resume at each stacked box without automatic scrolling or overflow. Source/build checks passed.

## Codebase cleanup and three-box tour — 2026-10-14

The guided Customize cursor now visits Design → Merge → Sleeve, holds, then loops to Design. Artwork is manual; its tour steps, snapshot hooks and upload-busy playback plumbing are removed. Shared action timing remains 800ms and scroll/hover/focus/reduced-motion rules remain intact.
Removed 233 unused legacy Customize CSS rules/selector branches across six stylesheets. Active responsive and theme overrides remain in place. CollectionUI shares DOM creation, image fallback and select-option rendering between the gallery and picker; BinderSchema.connected shares edge-connectivity checks between imports and editor operations. Removed unreachable inventory-ID fallback and redundant viewer document revalidation. Malformed null page/region imports now give validation errors; saved binder metadata and collection revisions are bounded before use. Existing model regressions plus targeted malformed-data checks pass.

Final audit verification: all 36 source modules and 33 stylesheets parse; 55 catalogue identities are unique. All model suites, strengthened project checks, three-box loop/manual-artwork tests and current UI workflows pass. All five pages at 1440/768/390px in both themes have no errors, duplicate IDs or overflow; before/after computed styles match across all 30 combinations. See docs/CODEBASE-AUDIT.md for changes and deliberately retained code.

Cover band edge fix: removed the shared cover drawing’s outer CSS border, which inset the horizontal band and left exposed colored edge slivers at zoom. Existing inset shadows retain the cover depth; the band now reaches the full outer width consistently in Workspace, editor, viewer and landing presets.


## Collection card details refresh — 2026-10-14

Workspace single-record editing now uses a content-sized 860px dialog with a 240px artwork column, compact identity, a visible close control, and essential finish/quantity/status/condition fields. Grading fields appear alongside these when needed; notes and trade/chase details remain in the secondary disclosure. Ownership totals are shortened. Mobile uses a compact artwork/identity row and full-width update action. The batch picker keeps its separate layout and receives its fields back when reopened. Selected-card artwork loads eagerly. Explicit Save collection behavior is unchanged.

Validation: rebuilt all five previews; project source checks and collection model checks passed. Browser checks passed in both themes at 320/390/768/1440px for record layout, edit/Undo, close/cancel, Owned/Wanted, grading and batch restoration; existing bulk selection and picker-filter regression checks also passed.


## Collection purposes and bulk editing — 2026-10-14

Collection cards show readable Keep / For trade / For sale / Wanted / Chase card labels below their artwork. The Workspace record form exposes Card purpose directly. Bulk add review places Owned/Wanted and shared purpose above the rows, with per-card overrides, aligned removal controls, a concise shared-details disclosure and content-sized desktop dialog. Changing Owned/Wanted resets incompatible row purpose overrides; changing grading does not. Selecting existing collection records now offers Edit selected, applying only purpose (default Leave unchanged) as one atomic, undoable change, preserving quantity, finish and notes. Explicit collection Save remains required.

Validation: all previews rebuilt; source/reference checks and collection model checks passed. Browser tests cover gallery labels, shared/per-card purpose application, existing-record bulk edit/Undo, Wanted/chase, review alignment at 320/390/768/1440px, and prior bulk picker/record-detail regressions in both themes.



## My collection compact workspace and split add flows — 2026-10-14

The collection header now has workspace tabs plus separate Add card / Bulk add actions, visible owned total-card / unique-card / set statistics, compact save controls and an ordered browsing toolbar. The former totals were already calculated but hidden inside a closed details disclosure: a presentation issue, not a counting/data bug. Unique cards now count card IDs once across finishes. Tools retains Redo, JSON download/import, Reload saved collection and preview information.

Manual-save eligibility and beforeunload protection remain unchanged, including the first save of unsaved sample data. Disabled Save uses a neutral surface, Saved feedback lasts two seconds, and the helper is its browser-save tooltip. Collection messages are four-second status toasts with Redo when available.

Single Add card chooses one printing then exposes the full record form, including condition, grading, purpose and notes. Bulk add retains multi-selection/search/filters, then only Owned/Wanted, shared purpose, per-card copies/finish and Remove; shared grading/notes and per-row purpose overrides are removed from this flow. Existing-record Edit selected remains limited to purpose, with Leave unchanged and one-step Undo.

Gallery cards show no redundant Owned/Wanted badges, no ×1 badge, no default Keep chip, and non-default purpose/quantity labels below artwork. Static purpose labels stay informational; they do not show misleading menu chevrons or label Keep cards as For trade. Hover/focus quick controls support quantity +/−, move between Owned/Wanted and Details; touch devices keep them visible. Native checkbox selection uses a fixed bottom action bar with existing Select all matching results, Edit selected, Remove selected and Done actions. There is no bulk add-to-binder/move action in this page's existing selection API. A dashed Add card tile, actual-image loading skeletons, matching selected states, readable 14px minimum collection text, reduced-motion support and slim credited workspace footer complete the view.

Validation: rebuilt all five previews; all model suites and source/reference checks passed. Both themes at 320/390/768/1366/1920px checked without overflow; the full first row fits at 1366×768 and 1920×1080. Browser checks cover single add/reselect, Wanted/chase, minimal bulk review/add, selection, quantity, save/Undo/Redo/toast timing, focus, existing leave protection and reduced motion. Remote card art still requires network access; skeletons represent actual image loading, not a simulated catalogue request.


## Collection screenshot UI corrections — 2026-10-14

Collection tools now constrains all popup children to its width; Import JSON uses a full-width labelled native file input without exposed browser chooser text. Desktop menus anchor to the trigger; phone menus use a bounded bottom sheet. Escape returns focus to the trigger and outside pointer clicks dismiss the menu. Card quick actions now use evenly spaced minus/plus, Wanted-heart (Owned-bookmark in Wanted view) and Details-eye icons with accessible names and native tooltips. Hover no longer raises the card or paints the oversized background rectangle.

Single and bulk picker controls now occupy a fixed layout row inside the dialog; only card results scroll. This replaces the sticky search header that allowed earlier card rows above/behind it. Search/filter refreshes and reopening reset the result scroll position. Review and individual detail layouts retain their own scrolling behavior.

Validation: rebuilt all five previews and passed source/reference checks. Targeted UI checks passed in light/dark at 320/390/768/1366/1920px for popup bounds, action sizing, independent picker scrolling, fixed controls, footer clearance, search reset and keyboard dismissal. Existing collection upgrade flow checks passed, including save/Undo/Redo and single/bulk separation.



## Unified Add cards and tab-aware totals — 2026-10-14

Workspace header, content and slim footer now share a 1480px shell and responsive 64/32/16px gutters. Navigation uses the tabs' 16px horizontal padding. Statistics follow the selected Owned/Wanted tab across that tab's full inventory (not current search filters): total copies, unique card IDs and unique set IDs. Labels pluralize; the sample's Owned 151 + Sword & Shield records count as two sets.

Add cards (header or dashed tile) now opens one multi-select search → review → add flow. Bulk add was redundant and removed. A selection of one retains More details for condition, grading and notes; finish remains a review column. Direct Discover card links still open the detailed single-card form, with a Back to cards transition into unified selection. Copy is Find a card, Mark as, Add to Owned/Wanted, or Add N cards to Owned/Wanted; review N reflects copy quantities. Optional finish/condition choices retain the existing unknown sentinel; optional status stores the existing ungraded/null representation. Blank Mark as retains Keep for Owned or ordinary Wanted, with chase opt-in.

Search has compact labelled-for-screen-readers search, inline results/selection counts, conditional Clear selection, red selected rings and checks, named set labels, and three desktop rows at 1920×1080 / two at 1366×768. Review has 72px thumbnails, shared Add to / Mark as controls, one Copies/Finish header, editable 40px quantity steppers, row-remove icons and Back to cards. Modal close controls, native Escape/focus containment, opener restoration, scrollbar styling, shared sizing/footers and stable per-view height cover search, review and single details. Existing selected-record editing and removal confirmations also have close buttons.

Select mode uses corner checkboxes and whole-card toggling, plain N copies text, a destructive Remove selected control and an actual Undo toast action. A ResizeObserver reserves the bottom action bar's current height plus its inset, including mobile wrapping. Existing manual Save, browser leave guard, Undo/Redo, physical inventory/binder separation and validation are unchanged.

Validation: all five previews built and project checks passed. Browser tests passed in both themes at 320/390/768/1366/1920px for shared geometry, row targets, optional review values, stepper typing, stable Owned/Wanted and More details height, close/opener restoration, and corner selection. A separate isolated fixture verified two Owned sets versus one Wanted set, singular labels, native Escape, single-card grading/notes with unknown persistence, remove/Undo and direct card links. Collection/catalogue model checks passed.



## Card-focused single review and count-driven bulk review — 2026-10-14

Exactly one selected printing now uses the record-detail two-column canvas: large artwork, identity and Choose another card link on the left; labelled Add to toggle, editable quantity stepper, Mark as and collapsed collector details on the right. An owned-count status chip sits by the title. The primary action names the card and destination; Cancel remains the other footer action. Existing-record editing adopts the same cleaner disclosure/canvas while retaining Update record and Remove record semantics.

Two or more selected printings retain the larger-thumbnail list, single Copies/Finish headings, editable quantity steppers, row-removal icons and shared Add to / Mark as. Its footer is Back to cards plus the counted Add action. Removing down to one automatically switches to the focused view; returning to search keeps that card selected. Clear selection remains search-only.

Single-card optional metadata is captured per selected printing when returning to search, restored on re-entry and kept separate from the shared bulk defaults. Quantity, finish, grading and notes survive single/search/bulk transitions without leaking onto other cards. The filled More details highlight is replaced with a transparent, thin-divider disclosure and visible keyboard focus. Desktop card art fits within the fixed dialog when details are collapsed; opening details scrolls only the right disclosure area, while mobile stacks and scrolls naturally.

Validation: five previews rebuilt and project/collection-model checks passed. Browser tests passed in both themes at 320/390/768/1366/1920px for view switching, quantity and selection retention, destination labels, stable dialog height, clean disclosure backgrounds, bounds and artwork clearance. Separate save tests verified per-card metadata preservation/isolation, typed quantities, footer Back to cards, atomic Undo/Redo, explicit Save and Wanted/chase. Keyboard containment and opener restoration regressions passed.


## Binder editor workspace and preview refinement — 2026-10-14

The editor now fills the desktop window beneath navigation with independently bounded catalogue, canvas and tools areas. Fit page remains the default, with Undo/Redo beside Zoom. A three-column catalogue includes real sample-set filtering and one placement hint. Tools, collapsed Page settings, thumbnail navigation, draggable page reorder and keyboard move alternatives replace the scattered navigation. Overflow is a draggable strip beneath the page with a counted warning; layout inputs predict the real displaced-content count. Page deletion and Clear overflow retain confirmation and now expose working four-second Undo feedback.

Customization retains its staged transaction: live cover/style previews do not change the document until Apply; Cancel discards the preview, while Save persists the applied editing session only. This preserves per-selection/page/binder style scopes and separate cover/style actions. Save is never disabled while the applied session is labelled Unsaved changes; an unsaved starter binder remains eligible for its first save. Clean saved binders show All changes saved and neutral disabled Save; successful saves show a check for two seconds. Apply cover is disabled for an unchanged or invalid draft.

The cover/card preview stays visible while one settings body scrolls. Cover presets open initially; Text is grouped into Title, Position and Style, with Auto color. Artwork controls have no extra empty divider gap. Larger sleeve/toploader tiles include theme dots and temporary hover/focus previews, with explanatory tab copy and shared selected states. Cancel/Apply stay outside scrolling options and dock to the viewport on phones.

Binder preview remains one page at a time: its existing cover/page sequence has constant Previous/Next labels, plain empty slots, 180ms transitions, arrow-key navigation, explicit focus wrapping, native Escape and opener restoration. Cards fit the fixed modal without scrolling. Rendered thumbnail/preview SVG clip IDs are unique. Navigation uses Workspace and the editor adopts the slim disclaimer/image/artwork-credit/FAQ footer.

Validation: all five previews rebuilt and source/reference/syntax checks passed. Binder, catalogue, collection, cover, customization and studio model suites passed. Browser checks cover Apply/Cancel versus Save, dirty/clean/Saved feedback, Save during customization, click placement, merge/unmerge, Undo/Redo, filters, accurate layout impact, overflow recovery/clear/Undo, add/reorder/drop thumbnails, preview focus/arrows/Escape, live hover versus selected style, and actual artwork upload/crop/title/save/reload. Both themes pass horizontal bounds at 320/390/768/900/1366/1920px, desktop page-height bounds, modal sizing, 14px UI text, key hint/status contrast and reduced motion. Remote card images still depend on network loading. No two-page preview or live auto-commit was added.


## Compact binder editor follow-up — 2026-10-14

Editor notifications now live outside the tool/sidebar subtree, use a single non-wrapping row with a text Undo action, and sit above the measured footer height plus 16px. Toasts use fit-content with a 320px preferred minimum (bounded to 90vw on very small screens), avoid the desktop card picker, and hide after five unpaused seconds. Hover or keyboard focus pauses the remaining duration. Long messages keep their full status/tooltip text while visually truncating within available space.

The flexible Fit-page canvas has no scrollbar at 100% and still refits through its existing ResizeObserver. Layout summary and Editing tips moved into a slim toolbar row above the page. Page thumbnails are 56px tall with visible empty-slot outlines and a lighter surface. Overflow is hidden when empty and otherwise occupies one 90px strip. Manual Save is a sticky, direct inspector child; Move earlier, Move later and Duplicate page are equal icon controls with accessible names/tooltips, and confirmed Delete page remains separate. Card names use two lines with full-name tooltips.

Workspace and editor now load app-shell.css for identical header container, logo/navigation/control geometry at each breakpoint, including reserved scrollbar space so switching pages cannot shift the header. Editor content remains full width. Footer copy remains 14px and one row on desktop, wrapping naturally on smaller screens; very narrow phones may need more than two lines to preserve all disclaimer/credit text. No existing editing, customization or save behavior was removed.

Validation: rebuilt all five standalone previews; source/reference/JavaScript checks and all six model suites pass. Browser checks cover exact cross-page header geometry at 320/390/768/900/1366/1920px, both themes, desktop no page scrolling/Fit scrollbars, compact thumbnail/overflow dimensions, pinned Save, icon labels/sizes, card-name styling and toast bounds/Undo/footer clearance. Real pointer hover and keyboard focus each held the toast open past five seconds, then its countdown resumed. Existing placement, pages, reorder/drop, overflow/Undo, staged Apply/Cancel, manual Save and preview keyboard regressions pass.


## Larger binder canvas and absolute zoom — 2026-10-14

The editor now reserves one 64px toolbar and one 60px thumbnail rail, with 48px numbered thumbnails and an accessible Add page plus tile inside the horizontally scrolling rail. Binder identity, page/layout metadata and the conditional overflow chip share the toolbar; arrows, Fit page, absolute Zoom, Undo/Redo and a keyboard-accessible Editing tips question popover occupy its right side. The separate metadata/tips row is removed. Contextual pocket actions live in the right tools scroller on desktop, returning to the binder view on phones. At 1366×768 the catalogue uses two readable columns; wider desktop layouts retain three. Card names use one-line ellipsis and full tooltips, with set/number beneath.

Overflow is now a bottom section of the right inspector with its own scrolling card tray, clear/Undo behavior and No displaced cards empty line. It never reduces central stage height. Save stays above the independently scrolling tools/settings area. Header gutters follow each page's existing content shell: the editor keeps its full-width 1920px shell/24px gutters, and Workspace keeps its 1480px shell/responsive gutters. Logo/account edges align with panels/content on each page.

Fit uses 24px stage padding and reacts to stage ResizeObserver changes. Zoom is an absolute percentage of source card-image pixels rather than a multiplier of Fit. Natural image metadata is cached; the rendering scale is conservatively capped for every placed card (including merged regions) so no card image is enlarged beyond its source size. Empty pages fit their full available area without that unnecessary image cap. Fit has a visible active state; manual percentages turn it off, and scrolling is allowed only when the chosen scale exceeds the fitted scale. The stage uses the plain theme background and a soft page shadow.

Toasts remain independent from scrolling panels, but their fixed bounds now track the central stage: centered at its bottom, 16px above the thumbnail rail, capped to its width. The notification is pointer-transparent except Undo; geometry-based hover detection preserves five-second countdown pausing without blocking drag targets. Focus pausing/status announcements remain.

Validation: desktop stage height is 488px/75.5% of nav-to-footer space at 1366×768, 800px/83.5% at 1920×1080, and 1160px/88% at 2560×1440, without page scrolling. Checks cover both themes, toolbar/rail bounds, panel/header alignment, manual/Fit modes, resize fitting, scroll behavior, many-page rail, hover/focus toast countdown with pointer hit-through, actual overflow drag/drop and click placement, and a decoded 120×165 image fixture proving the natural-pixel cap. Existing staged cover/style Apply/Cancel, manual Save, Undo/Redo, catalogue filters, pocket placement, accurate layout displacement, page reorder/drag and preview focus regressions pass, as do all six model suites and source/preview checks.


## Calm binder editor redesign — 2026-10-14

This layout supersedes the earlier three-panel/toolbar/footer editor descriptions. The 64px desktop top bar contains the Workspace return/logo, editable binder name, page/layout summary, conditional Overflow chip, Preview, unchanged manual Save/status, and account. The 56px rail opens Cards, Cover, pocket selection, Card styles and More (Discover/return, theme, JSON download/import). Cards opens on first visit and remembers explicit open/close choices in localStorage; opening customization temporarily closes it, then restores it on desktop. Both drawers push the desktop canvas and overlay it at 1100px and below. Native dialogs remain separate.

The two-column Cards drawer keeps readable names, set names/numbers and full tooltips. Cover/card-style previews and Cancel/Apply remain fixed in the Customize drawer around one scrolling settings body. Staged designs still require Apply before manual Save. The binder page remains visible beside customization. Empty pockets are softly filled, with a plus only on hover/focus.

Zoom out/percentage/Fit/zoom in, Undo/Redo and Editing tips form one floating control pill. Absolute image-pixel zoom, natural-image size limits and Fit ResizeObserver behavior remain. Numbered 48px thumbnails, previous/next, Add page and a settings gear form a separate floating strip; reorder/duplicate/delete/layout impact are unchanged. Overflow moves to a counted topbar popover with Clear, drag and click placement. The tray stays open while a drag is active. The full footer is replaced with a Credits popover preserving all disclaimer, image/artwork credits and FAQ text. On narrow screens Credits has its own bottom clearance.

editor-calm.css owns the editor layout; editor-layout.js owns drawer preference, mutually exclusive bounded popovers, Escape/focus return, arrow-key rail navigation, narrow-drawer focus containment, inert placement during staged customization and responsive fitting offsets. Older layout/mobile/inspector/footer styles and editor-mobile.js are no longer loaded by editor.html; shared files remain available to other pages. The Tools heading, duplicate navigation/toolbar rows and permanent overflow/sidebar boxes are removed from this screen, with their functions relocated rather than deleted. The dark/light theme tokens are retained.

Validation: five preview builds and project checks pass, along with all six existing model suites. Isolated browser regression checks cover remembered drawers, responsive bounds at 1366×768, 1920×1080, 2560×1440, tablet and 320/390px, both themes, manual save states, Apply/Cancel isolation, temporary style previews, Preview keyboard/focus, all popover positions/Escape, drawer traps, card placement, Undo/Redo, overflow clear/recovery/drag, layout displacement and thumbnail add/reorder. Remote card artwork still needs network access; no backend, deployment or new feature was added.

Additional final checks passed: toast hit-through, hover/focus pause and five-second resume; decoded 120×165 natural-image cap; direct Discover placement on phones; actual artwork upload/crop/title/Apply/Save/reload; minimum 14px visible UI labels, selected label contrast in both themes and reduced motion. Preview Escape now leaves a staged Customize session open.


## Recording review fixes — 2026-10-14

Workspace card queries now reset their catalogue scroll only when the search/type/set signature changes; unrelated editing renders preserve the current browsing position. The binder editor shows a startup status rather than partially initialized controls; script failures during startup produce an explicit reload message.

Native dragging freezes the existing selection clearance instead of refitting moving targets. The overflow tray becomes pointer-transparent after the drag image is captured, with its source still mounted. Drop capture and drag end both clear transient styling, including when rendering replaces the original source. Real browser mouse drags from both catalogue and Overflow were verified against exact unchanged page rectangles.

Toast actions now belong to an actual committed document change and editing version. Informational/cancelled/error messages have no Undo; Undo offers Redo, Redo offers Undo. Layout feedback reports actual displaced items, including the no-displacement case. The stage viewport ends above a measured lower dock: zoom/history, notifications, thumbnails and Credits no longer obscure manually zoomed artwork. Toasts sit beside the zoom pill when there is room, otherwise in a reserved row, and Page settings/tips/context popovers stop above that region. Credits tracks the canvas corner, outside either drawer, with thumbnail clearance.

Fit page is exposed directly on the control pill (Fit on phones), uses the shared 14px control style, and retains its selected state. +/- zoom uses gentle proportional steps and a quarter-of-Fit minimum; absolute source-pixel caps remain. Empty/filled-page changes and image decoding preserve actual card size at manual zoom instead of switching reference sizes abruptly.

Customize keeps its real-card preview, a compact header and pinned Apply-to field. All sleeve presets are more compact, with distinct theme-color swatches and an unchanged full-color live preview. Title captions follow the entered title; changing a preset or text position corrects insufficient preset-background contrast, while direct color editing remains available. Other cover/artwork/style Apply/Cancel and manual Save behavior is preserved.

Validation: new recording-specific browser assertions pass for filter scroll, exact drag geometry, truthful toast actions/Undo/Redo, stable page zoom, proportional steps/minimum, actual displacement counts, non-overlapping settings/toast/artwork, transparent overflow drag targets, preset contrast, fixed scope and distinct dots. Six existing model suites pass. Existing browser checks pass for explicit Save/staging, placement/history, merge/page/overflow/reorder, Preview focus, all popovers, drawer preferences/keyboard traps, uploaded artwork/crop/title/save/reload, 14px UI text, key dark/light contrast and reduced motion. No page scrolling at 1366×768, 1920×1080 and 2560×1440; narrow layouts checked at 320/390/768/900px. Toast hover/focus timing and decoded-image size caps also pass. All five previews rebuilt; other page source was unchanged.


## Editor panel alignment — 2026-10-14

This supersedes the centered Overflow/Page settings popovers and the offset lower dock described above. Fit/zoom/history controls and page thumbnails now share the binder canvas center, including after drawers resize it. Toasts occupy a separate measured row above the controls. The More chevron sits beside the ellipsis inside the rail button.

Overflow and Page settings reserve a right-hand column on desktop/tablet, temporarily closing Cards without changing its saved preference; opening a different tool or closing the utility restores the appropriate drawer state. Their explicit close buttons and Escape restore trigger focus. Utilities stay open when users interact with the binder. On phones they occupy a reserved bottom region and temporarily replace the dock, leaving the fitted binder unobscured. Overflow stays visible during dragging; the obsolete drag-time tray fading/class was removed. Existing drop/click placement, Clear/Undo, layout impact and page actions remain.

Cover Text settings now pair Title/Show title, Position/Alignment and size/color controls, with compact gaps and no duplicated visible fieldset legends. Auto color is an independent button beside its swatch. Opening a settings disclosure resets its scroll position. Existing field IDs, staging, Apply/Cancel, artwork and manual Save remain unchanged.

Validation: project references and syntax, five preview builds, all six model suites, manual Save/staging, placement/history, overflow/layout/page actions/reordering, preview keyboard/focus, uploaded artwork/title/crop/save/reload, both-theme contrast/14px text and reduced motion pass. Quantitative geometry checks cover 320/390/768/900/1366/1920/2560px widths: centered dock, no utility/binder intersection, no page overflow, bounded utility content and close/focus behavior. Drawer/tool switching and native catalogue/overflow dragging are additionally checked.


## Pocket design and contextual tools — 2026-10-14

Merged/single pocket design now uses a bounded two-column dialog, a proportional preview, compact placeholder style choices and 36×50 target-card thumbnails. Only its content area scrolls; Cancel and Apply remain visible. Phone content stacks vertically. Existing target search, clear target, artwork/crop, placeholder Apply and overflow preservation remain unchanged.

Pending placement hides pocket editing actions and shows only the destination prompt and Cancel. Selected-pocket actions remain available in a compact wrapped bar with explicit borders/backgrounds. Cover and Card styles are adjacent in the rail, ahead of Select pockets. The More chevron is removed. Credits/disclaimer/attribution/FAQ moved into More rather than occupying the lower canvas corner; the lower dock no longer reserves that corner.

The centered question-mark control opens Editing tips in the same reserved utility region as page settings, with concise steps for placing cards, merging, moving/removing, Undo/Redo and manual Save. It has an explicit close action, Escape focus return and a reserved bottom region on phones. Utilities remain visible when the lower dock is temporarily hidden on phones.

Validation: rebuilt all five previews; project references/syntax and all six model suites pass. Browser tests cover actual merged-pocket placeholder selection/Apply, target thumbnail bounds, dialog/footer/scroll bounds, minimal pending placement, grouped tools, More arrow removal, Credits relocation and non-overlapping tips at 1920/1366/390/320 widths. Existing staging/manual Save/history/overflow/page reorder/preview regressions and six-width both-theme bounds pass. Drawer/utility switching remains functional.


## Editable facing pages — 2026-10-15

The page strip now offers 1 page / 2 pages. Facing-page mode displays fixed pairs (1–2, 3–4, etc.), fits the complete spread to the stage, highlights both visible thumbnails and identifies the active editing page in its label/topbar. Previous/Next turns by spreads. A missing final partner is a non-editable facing leaf with the existing Add page action; it does not silently create a page. The view is session-only and switching it does not dirty the binder. Switching view clears pending/selected pockets and restores Fit.

Both visible pages accept catalogue/overflow placement and native card drags, including moves between pages. Click or keyboard activation makes the destination page active. Pocket selection is scoped to one page and resets when selecting on the other; merging, page settings, styling and inspection retain their existing active-page context. Fit/absolute zoom use both page geometries and all visible card-image caps. Single-page rendering retains its original pocket structure. The whole-grid drop-shadow filter was removed, eliminating the hard shadow line beneath the binder. Facing pages use quiet outlines and a small center gap.

Validation: five previews rebuilt; source/reference/syntax checks and all six data/model suites pass. Existing one-page browser regressions pass for manual Save/staging, placement/history, overflow/layout/page reorder, Preview and six-width both-theme bounds. New browser checks verify view-only clean state, placement on either page, cross-page moves and Undo/Redo, page-local selection/merge/layout, spread navigation, final odd-page Add page and return to single page. Fit/no page overflow/shadow removal were checked at 320/390/768/1366/1920/2560 widths in both themes. Real mouse-initiated catalogue-to-right-page and right-to-left-page drags preserve exact target geometry.


## Ponytail audit fixes — 2026-10-15

Collection backup import now accepts bounded files up to 64 MiB, sufficient for supported 5,000-record exports including escaped notes; all record/field validation remains. Binder imports allow 8 MiB for supported artwork and metadata. Save indicator expiry changes only the indicator, preserving later editing history, toast actions and fitting bookkeeping. Escape dismisses a popup first, then clears placement/selection before closing Cards.

Consolidated 24 repeated editor-calm.css selector groups and 49 overwritten declarations while retaining required breakpoint overrides. Computed styles and geometry are unchanged across 144 viewport/theme/tool states. Removed confirmed unloaded editor-mobile.js, editor-responsive.css, editor-layout.css, editor-workspace.css and cover-studio-compact.css. References to those files in earlier milestone notes above are historical, not active runtime dependencies.

Regression entry points: npm test (model checks), npm run test:browser (isolated Python/Chromium source and preview checks), npm run check, npm run build. The browser runner uses a temporary profile and does not access personal browser data.

Validation completed: all five previews rebuilt and parsed; project reference/syntax/link checks and all six model suites pass, including large collection and binder backup regressions. The committed browser runner passes Save/Undo timer, Escape precedence, facing-page placement/history, actual >2 MiB collection export/restore/save and invalid-record rejection against both source and previews. A separate before/after matrix found zero computed-style/geometry differences in 144 states across 320/390/768/1366/1920/2560 widths, light/dark themes and editor tool states. Node CLI is absent from this machine PATH; build/check/model scripts were executed with the available Node runtime instead. Firefox/Safari were not tested.


## Review follow-up — 2026-10-15
Escape now exits selection mode as well as clearing selected pockets/pending placement, before closing Cards. The shared Clear selection action owns that reset; the keyboard handler reuses it. Empty selection mode also exits with Escape, including when a catalogue input has focus. Browser regressions assert both cases. Removed the fully superseded page-strip positioning block, retaining responsive rules and current positioning.

Validation: rebuilt all five previews; project checks, all six model suites and source/preview browser regressions pass. Across 144 viewport/theme/tool states, geometry and other styling are unchanged; the only visual difference is the intended inactive Select pockets button after Escape. No repeated top-level editor CSS selector blocks remain. Firefox/Safari were not tested.


## Compact editor dock and page summary — 2026-10-15
Fit uses a single measured dock instead of two floating bars and an always-empty notice row. Visible notifications reserve their actual height; native drags freeze dock/selection geometry until drop/end. Zoom/history, page navigation, view selector, horizontally scrolling/reorderable thumbnails, Add page, settings and tips keep their existing handlers. The dock wraps into compact rows as canvas width shrinks, stays outside the stage and shares its horizontal center. Its top is about 24px below the outer page surface when the page fills Fit; width/image-resolution limits can leave a larger gap.

Pages have a quiet surface, 8px outer padding and outline without a heavy shadow. Cards drawer is 300px on desktop (previously 320px), with 16px padding, 12px gaps and shorter instructions. Original stage/dock rules were replaced/consolidated rather than adding a competing layout layer. Image pixel limits are unchanged. Page summary counts each region once, counts every non-null card/artwork/placeholder as filled, and labels the active page in facing-page mode. Metadata sits below page information and wraps separately on phones so the binder title remains readable.

Validation: all five previews rebuilt; source/reference/syntax/link checks and six model suites pass. The committed browser suite checks 1366/1920/2560 desktop and 320/390 phone widths in both themes, one/two-page Fit, dock/stage clearance, drawer centering, minimum control height, no document/Fit scrolling, counts including artwork/placeholders/merged regions, and active-page switching on source and preview. Existing staging/Save/history/merge/overflow/page reorder/Preview tests and actual catalogue/overflow/cross-page mouse drags pass. Before/after screenshots compared at 1366×768, 1920×1080, 2560×1440 and 390×844. Captured 3×3 page height increased 392→478px, 704→838px and 1064→1198px respectively; outer page surface has about 24px dock clearance when height-limited. Browser test startup now retries the Chromium port file while Windows is still writing/locking it. Firefox/Safari were not tested; Node CLI is absent from PATH, so build/check/model entry points ran through the available Node runtime.


## Preset clarity and long-binder dock — 2026-10-15
Real pointer-click reproduction confirmed cover, sleeve and toploader choices apply and persist; no preset storage failure was reproduced. Cover preview is larger, its instruction explicitly names Apply cover and Save, and sleeve/toploader rims have more visible spacing/thickness. Shared BinderVisuals changes also reach the read-only viewer and pocket previews. The Poké Ball swatch now uses the red preset color. Apply/Cancel and manual Save behavior are unchanged.

Page information has a stronger heading, short page-range wording, a quiet separator from the binder title, and a second line identifying the active page with its filled/empty counts. A final single leaf is labeled Page rather than Pages. The single dock always uses two separated rows; the thumbnail viewport is bounded to 264px and scrolls horizontally rather than expanding as pages are added. Page reordering and Add page remain in the strip. Settings summary explicitly centers its SVG despite inherited disclosure alignment; the gear drawing is centered on the SVG coordinates too.

Validation: all five previews rebuilt; project checks and six model suites pass. Browser regressions pass on source/previews for real mouse preset selection/Apply/Save/reload, the 30-page dock, exact gear centering, responsive Fit/bounds in both themes, manual Save/Undo, Escape, cross-page editing and backup restoration. Firefox/Safari not tested.


## Main-canvas customization previews — 2026-10-15
This corrects the earlier interpretation of the preset issue: the requested change is a live preview on the main canvas, not just the sidebar miniature. Opening Cover now shows the actual cover on the main canvas; choosing a preset, title or artwork updates that cover immediately. Its Fit/zoom is temporary and separate from the page camera. Switching to Sleeves/Toploaders restores the editable-page presentation and renders draft styles on visible cards according to selection/page/binder scope, including facing pages. Hover is temporary; selection remains staged until Apply. Cancel restores existing document visuals without creating history or enabling Save. Apply and manual Save remain separate.

Sidebar preview art is reduced to 80px (64px on phones), with a bounded height and extra spacing between the heading, preview and tabs. Existing cover/page navigation, card-image scale cap and pocket/drop geometry are preserved.

Validation: all five previews rebuilt; source checks and six model suites pass. Source/preview browser regressions verify live main-canvas cover/title/zoom, scoped sleeve/toploader changes, unchanged saved data before Apply, Cancel rollback, sidebar clearance, real-click Apply/Save/reload and responsive layout/30-page dock. Visual screenshots confirm the large canvas cover and framed cards update while the smaller sidebar art clears its tabs. Firefox/Safari were not tested.

## Binder-first Pages sidebar

This supersedes the earlier bottom-dock layout. The left rail keeps its order and actions. Cards starts closed, using a new closed-by-default drawer preference version while remembering later explicit choices. The right Pages sidebar has a collapse/expand header, a vertically scrolling list of numbered real page previews, and the existing view/Fit/zoom/history/settings/tips controls in a pinned footer. The next uncreated page is a dashed plus tile; the existing limit remains 30 pages. Native page dragging preserves the existing undoable reorder action, supports edge scrolling, and Alt+Up/Down offers the same reorder action from a focused thumbnail. Navigation reveals the active thumbnail without snapping unrelated browsing back to it.

Previous/Next controls sit beside the binder (below it on phones); the forward control becomes Add page after the last page/spread, with the original limit and Undo behavior. Existing one/two-page choices, image-resolution limits, page-local selection, cross-page placement, merging, styling, overflow, covers and explicit Save are preserved. The stage uses the available height. Selection is a compact floating count/action overlay with labeled, tooltip-equipped icons and More. Notifications are lower-right overlays with Dismiss and the existing timed Undo/Redo behavior; selection and notification appearance never reserve a smaller Fit area.

The page surfaces, active-page outline and sidebar divider provide separation using existing theme variables. Phones begin with Pages collapsed; an expanded sidebar overlays rather than squeezes the stage. All five previews are rebuilt from source. Regression checks cover source/previews, unchanged left hierarchy, default drawer state, native and keyboard vertical reordering/Undo, sidebar collapse/footer, end-page plus/30-page cap, icon accessibility, and stable selection/toast geometry at 1366/1920/2560 desktop and 320/390 phone sizes. Existing Save/Escape, presets, preview scopes, page counts, history, cross-page editing and collection backup checks remain. Firefox/Safari were not tested.

## Approved layout: softer surfaces and movable floating tools

The user explicitly approved the binder-first Pages sidebar design above. Treat it as the visual baseline; retain the hierarchy and behavior when making future refinements. Pages now has a softer rounded surface, quieter inset dividers, less boxed thumbnails and a small active-page marker. The selection palette uses a rounded surface, quieter icon controls and a grip in its count row. Theme variables, readable text and 40px targets remain.

Navigation follows the actual rendered binder bounds, leaving 16px outside the 8px page surface in both one/two-page views. It follows Fit, manual zoom, image decoding, drawer/sidebar resizing and stage scrolling. Where the viewport cannot fit arrows beside the binder, they sit just below it within the stage bounds. Neither selection nor feedback changes the camera.

The floating left tool rail, selection/placement palette and existing nonmodal popovers share a drag handle. Pointer/touch capture preserves card/page drag targets; keyboard arrows move by 8px (Shift by 24px), Home restores the normal position, and Escape during a drag cancels that movement before normal Escape handling. Positions stay in the current session, clamp below navigation and inside the viewport, and do not affect the document, Undo/Redo or Save. Moving a parent palette preserves nested popover positioning. Docked Cards/Customize/Pages panels and notifications are not movable. Existing close/Escape behavior, tools and left toolbar order remain.

Regression coverage adds constant binder-relative navigation spacing, native pointer and touch movement, keyboard movement/reset, nested popovers, drag cancellation, viewport clamping, unchanged camera/history/Save and non-draggable notifications on source and generated previews. The existing browser/model checks remain in place. Firefox/Safari were not tested.


## Shared Pages and Overflow sidebar

The approved binder-first layout now shares the right sidebar between Pages and Overflow. View buttons keep a constant panel width and leave Fit/camera geometry unchanged. The collapsed rail retains both icons, a live nonempty Overflow count and the expand arrow. Pages retains its scrolling previews/reorder/Add page behavior; Overflow uses compact draggable thumbnails, existing click-to-place, confirmation before Clear and Undo. Empty Overflow says “No displaced cards.” Existing binder controls stay pinned below either view. The topbar overflow warning opens the same view rather than a separate popup. On phones, choosing an overflow item collapses the overlay so users can reach every pocket. No data schema, save or history behavior changes; the left tool hierarchy and movable floating tools remain.


## Editor icon and notification cleanup

The left tool rail is fixed again: its drag grip is removed, with tool order and actions unchanged. Selection tools and nonmodal popovers remain movable. Pages and Overflow use icon buttons in both sidebar states; Overflow uses a bin and a live count. The topbar warning is the same bin/count shortcut, and Clear overflow uses a separate bin-with-cross icon with its existing confirmation and Undo. All icon controls retain accessible names and tooltips. Notifications use regular 14px text, smaller spacing, a quiet outline/shadow and no minimum width; short messages fit a compact single row, while long/mobile messages wrap readably. Dismiss, five-second expiry, hover/focus pause, screen-reader status and drag-transparent behavior remain. The moved-item notice no longer repeats the Undo action in its text. Binder fitting and document data are unaffected.


## Minimal editor trial

The user authorized all eight decluttering suggestions. The header retains Workspace/name/Preview/Save/account and the existing home mark; page metadata is a quiet caption above the canvas, and save status is visible only while unsaved. The right sidebar has one icon row for Pages, Overflow, context-only Clear and Collapse, with a plain surface and one separating edge. Its footer exposes Fit, actual zoom percentage, Undo/Redo and one View/settings popover. That panel contains the original page-view selector, page actions/layout and an inline Editing tips disclosure. +/- zoom remain inside the zoom popover with the existing slider. All original handlers/IDs and the 30-page cap remain.

The fixed left rail has no surrounding pill/shadow; active/hover/focus states and tooltips remain. Single selection uses one movable icon row, a screen-reader-only count and a local thin selected outline. Multiple selections retain a visible count; placement keeps its destination prompt and cancel icon. Opening View/settings temporarily hides the selection toolbar without clearing selection or changing Fit, so floating tools do not cover each other. Routine selection/placement/drag-cancel messages no longer toast; completed editing actions retain Undo, and errors/warnings remain. Save confirmation stays in its explicit button/disabled state and helper tooltip rather than a long toast. Document saving, cross-page editing, drawers, covers/styles, reordering and notifications never reserve additional canvas space. Drawers/sidebar/navigation lose decorative shadows; actual floating popovers retain separation.


## Frontend MVP milestone — accepted 2026-10-16

The user designated the current implementation as the frontend MVP milestone after the final workshop refinements. This is the accepted baseline for Landing, Workspace, Discover, Binder editor and read-only Viewer. The milestone includes responsive layouts, explicit browser-local saving/backups, binder customization, merging, placement/push/swaps, page management, cross-binder copying, compact controls and Help.

All five previews were rebuilt; project/model checks and Brave/Edge browser regressions passed against source and previews, with phone-size emulation and visual review. Physical mobile devices, Safari and Firefox still need manual compatibility checks. Backend/authentication, cloud persistence, live catalogue/pricing, sharing and deployment remain outside this frontend milestone. Full details: [FRONTEND-MVP.md](FRONTEND-MVP.md).
