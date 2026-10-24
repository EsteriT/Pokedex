# Pokedex design specification

## Workshop visual finish - 22 October 2026

Approved items 1-5 are implemented locally on `feat/editor-card-drawer`: subtle dotted canvas/matte lighting; page-edge depth and a narrow spine with a restrained sheen behind the artwork; softer inset ordinary empty pockets with rounded clipping and stronger plus hover/focus affordances; three desktop toolbar groups without moving or wrapping their buttons; consistent bordered navigation and distinct dashed/tinted Add page buttons. Existing navigation positioning/fallbacks and merged-pocket shapes are preserved. No small page indicator was added. Card images, document geometry/data, covers and manual Save remain unchanged.

Verification: project build/reference checks pass. Brave visual review covered dark/light themes and one/two-page views, visible toolbar separation, matching arrow alignment, Add page/Undo and click-to-place/Undo on an empty pocket. No backend change, merge, push or deployment; full browser/backend suites were not rerun for this visual pass.

## Expanded binder card catalogue - 22 October 2026

Follow-up on `feat/editor-card-drawer`: **Expand now opens a centered modal**, superseding the earlier inline expansion below. The drawer keeps a bounded 24-card quick list and a compressed Type/Set popup with a visible Clear filters button. The modal offers search, Set, Type, Rarity, Available finish and Sort using the existing catalogue API/search helper. Select cards across filters and loaded batches, then explicitly Add to binder through the existing atomic batch insertion/history action. Cancel and Escape leave the binder unchanged; insertion still requires manual Save. Selection highlights/checks and bordered secondary/primary buttons match the editor. The modal uses 24-card Load more requests, lazy thumbnails, stale-response guards and retry without discarding existing results. No database, authentication or saved-format changes; no merge/push/deployment.

Source: `src/scripts/editor-card-browser.js`, editor HTML/scripts and `src/styles/editor-calm.css`; generated review: `preview/Pokedex-editor.html`.

## Editor Add cards drawer review - 22 October 2026

Local branch `feat/editor-card-drawer` targets the binder editor's left Add cards drawer shown by the owner, not the Workspace collection dialog. Compact heading/help/search controls move Type and Set into a bounded filter menu inside search, with an active-filter count and Clear filters. Cards have wider gutters and compact one-line captions. Expand replaces Previous/page number/Next and appends 24 more printings without remounting existing artwork. Search/filter changes reset the result batch; expanded results remain available during placement and Undo. Failed expansion preserves its current cards and retries the same batch. Escape closes filters before the drawer. The rail button's accessible name/tooltip is Add cards.

Editable files: `src/editor.html`, `src/styles/editor-calm.css`, `src/scripts/editor.js`, and `src/scripts/editor-layout.js`; generated review page: `preview/Pokedex-editor.html`. Collection, landing, backend settings, saved-data formats and manual Save are unchanged. No merge, push or deployment.

Working identity (22 October 2026): **Binder Minder**, with a neutral `?` placeholder in the website's brand positions. Preserve the approved layouts, colours, typography, card art and binder cover presets. Google OAuth's logo field remains empty; the website placeholder is not a Google logo upload. Prepared on `feat/binder-minder-branding`; the owner authorized website publication after local review. Google branding/configuration changes remain separate. Existing technical names, URLs, storage keys and backup formats remain compatible.

Catalogue trial (20 October 2026): preserve the approved app layouts. Connected Discover, Add cards and editor use 24-card pages, ten-set filter choices and lazy public metadata. Keep manual Save and ownership rules; retain the curated sample-only color matching. Generated unconfigured demos remain sample-based. No landing changes. See [CARD-CATALOGUE.md](CARD-CATALOGUE.md).

Desktop UI review (2026-10-19), local branch `feat/collection-ui-hierarchy`: Discover moves advanced color matching into a disclosure, keeps active color searches expanded, bounds filters, and groups collection backup/reload actions behind a menu. My binders exposes one Open binder action; read-only View moves into its existing management menu. The editor uses spacing between tool groups, consistent rail icons, and restrained borders distinguishing selection, merging and drawers. The viewer gives the binder more stage height and hides zoom controls behind View options, with a collapsed attribution footer. Manual Save, recovery, navigation and backend behavior remain intact. Landing source and generated output are unchanged. No merge, push or deployment authorized for this review.

Add cards follow-up (2026-10-19): artwork-first tiles replace heavy nested backgrounds, with larger artwork and single-line set/number captions. The counts and Discover link share one quiet row; zero selection is hidden. Catalogue filters use a bounded, scrollable dropdown; Escape closes it before the picker. Multi-card selection/review remains intact. Workspace and Discover now expose About & credits and Help & FAQ from the account menu, including after cloud account initialization. The full-width app footers are removed; attribution links remain in the accessible credits dialog. No backend or data changes.

Collection follow-up (2026-10-19): filters use a bounded popup anchored to their button rather than a full-width overlay. Card details keeps its image geometry; the editing side pairs Add to/Quantity and Finish/Card status, with compact grading and notes fields. Narrow layouts stack fields. The owner approved moving Workspace/Discover footer text into About & credits in the account menu, with Help & FAQ alongside it; the landing footer remains unchanged. Source changes are in `src/`, with rebuilt Workspace preview; this branch remains local and unmerged.

Current frontend behavior and file ownership are documented in [HANDOFF.md](HANDOFF.md). This document retains the product decisions and future integration plan; [HISTORY.md](HISTORY.md) records superseded prototype iterations.

## My collection hierarchy — 19 October 2026

The owner approved a frontend-only collection cleanup, explicitly retaining the card-shaped Add cards tile. Group Undo/Redo, Add cards, manual Save and the icon collection menu beside the heading. Add is primary while browsing; pending edits make Save primary. The Save button itself reports Save/Saving/Saved while its accessible status keeps detailed loading/error/save announcements. Display totals as a quiet `cards · unique · sets` line. Keep Owned/Wanted, search, Filters and the selected sort together; applied filters show a count and removable chips.

Each card has a selection checkbox outside its edit button: reveal it on desktop hover/keyboard focus, retain visibility during selection, and show it directly on touch/narrow screens. Selected cards get a stronger outline; batch Edit/Remove/Clear appear only for a nonempty selection. A normal card click opens its existing details form; during selection it toggles selection. Quantities above one use an artwork badge. Extra card edits remain in the details form. Backup, restore, explicit browser import, reload and help keep readable menu labels. Existing data, validators, manual saves, conflicts and backend contracts stay unchanged.

## Current editor baseline

Current editor layout: keep the approved left tool hierarchy and actions, with Cards closed by default. Give the binder the full available stage height, move page previews into a collapsible vertically scrolling right sidebar, and pin existing view/zoom/history/settings controls in its footer. Page navigation sits beside the binder, with a plus at the end. Selection actions use compact accessible icon overlays; dismissible notifications float without shrinking the binder. Preserve themes, native reorder/Undo and the existing 30-page limit.

**Explicitly approved binder-editor baseline:** the user approved this binder-first design and requested that it be remembered. Preserve the central binder, existing left tool hierarchy, collapsible Pages sidebar/footer and floating icon actions. Refinements soften the sidebar/selection surfaces and keep navigation arrows 16px from the outer page surface in either view. Only the selection toolbar has a bounded drag handle, keyboard movement and Home reset. Zoom, View and settings, More and account popovers remain anchored; docked drawers/sidebar stay attached and notifications remain fixed. Moving tools is session-only presentation state and never an edit or Save operation.

Pages and Overflow are separate right-sidebar views switched by their top icons. Never combine the overflow tray with the page list; the selected view uses the full available content height above the pinned controls. During sleeve/toploader customization the visible cards can be clicked to retarget the draft (modifier-click toggles multiple cards on the active page); the cover view still blocks canvas interaction. Narrow layouts offer Choose a card on binder and return to the drawer after targeting. Apply and manual Save remain separate.

## Existing landing-page design

Available binder tools now include an explicit two-card Swap in the selection More menu, same-tab copying into another binder with an explicit Paste/manual Save step, and multi-select in the Cards drawer. Batch insertion never replaces occupied content: it fills empty ordinary pockets from the active page, creates regular pages as needed up to 30, then keeps remaining cards in Overflow. One action is one Undo step. Whole-set insertion and automatic binder sorting remain labelled Coming soon; roadmap entries for picker multi-select and page thumbnails are removed. The Find what fits result grid is 640px maximum normally and 480px on short desktop windows, preserving the existing four/two-column responsive layout.

Approved directional insertion: Add cards edge drops push along the current row (left edge pushes right, right edge pushes left); centre drops keep replacement. Click/keyboard placement has explicit direction toggles. The first empty pocket absorbs the shift; otherwise the end card enters Overflow. Merged regions and non-card content block a push. A local outline/arrow and the existing floating placement status preview the action without changing Fit or reserving canvas space. Whole-row insertion is one undoable edit and still requires manual Save. This is an explicit exception to the ordinary replacement behavior described below; existing pocket moves and Overflow placement retain replacement semantics.

## Direction

Backend foundation integration keeps the approved workshop appearance. Configured builds replace the Sample account menu with Google sign-in, sign-out, explicit browser-binder import and old-unused-artwork cleanup. Cloud and browser workspaces remain separate. Save stays manual; async requests disable duplicate submission, and edits made during the request remain dirty. A compact accessible conflict dialog offers Keep editing, Reload saved version with discard confirmation, or Save as copy. Collection continues to say browser-local. Unconfigured builds retain the frontend prototype. See BACKEND-FOUNDATION.md for verification/deployment limits.

A premium collector's studio: personal, creative, quietly playful, and easy to understand. Avoid a finance/trading-dashboard aesthetic. Cards and binder pages are the visual focus; collection value is supporting information.

The earlier references were pkmnbindr.com and xbindr.com for clean explanations, restrained colors, and smooth feature previews. This design has its own section layouts and Ball themes.

## Palette

| Role               | Light                   | Dark                    |
| ------------------ | ----------------------- | ----------------------- |
| Page               | #F5F7FA cool porcelain  | #191A1F charcoal        |
| Surfaces           | #FFFFFF                 | #24262D                 |
| Main text          | #242833 graphite        | #ECEEF3 soft white      |
| Muted text         | #596273                 | #B0B6C4                 |
| Main action        | #C94B58 with white text | #C94B58 with white text |
| Theme accent token | #C94B58                 | #E27381                 |
| Secondary accent   | #B8AFE0 lavender        | #B8AFE0 lavender        |
| Divider            | #E2E6ED                 | #3A3E49                 |

Light is the default. A compact Light / Dark / System selector is in the header. Explicit choices persist locally; System follows the device. Card images are never recolored by theme selection. Dark mode is charcoal rather than navy/financial blue.

## Typography and spacing

System fonts: Segoe UI/Arial for body text, Trebuchet MS/Segoe UI for large headings. Friendly, clear headings; no pixel font for the main interface. Most microcopy is ordinary case, not tiny uppercase. Card names stay legible.

Use consistent even spacing, generally 8, 16, 24, 32, 48, and 64px. Small card grids may use 4px gaps. Desktop gutters are 64px, then 48/32/24px at smaller widths. Rounded cards use a shared 6px treatment, preserved aspect ratio 245:337, contained images, and soft shadows. Panels use restrained rounding and fewer outlines. Empty pockets use readable dashed borders.

## Section map

### Hero

“Your collection. Your way.” followed by “Build and personalize your Pokémon card binders online.” Primary action: Create your binder. Secondary link: Find your style. Sticky header navigation remains visible on desktop.

Six binders form a gradual rotating wheel. Users can drag freely and flick with momentum. Dots and arrows are minimalist. No slide names, subtitles, counter, extra scroll cue, or playback button. Binder examples: Eevee family, 151 starter evolutions, legendary cross, and three other card-art collections. Preserve the current card placements in the data file.

### Arrange: A place for every card

Split composition: four selectable explanations left, one boxed demonstration right. Place/swap is first, followed by making room, whole pages, copy/undo, and sorting. Cursor-led movement is slow enough to follow. Selecting an explanation changes the animation without scrolling.

### Customize: A collection with your signature

Three compact examples in one desktop row, two/one columns at smaller widths:

1. Design your binder: preview left, Cover themes and Rows/Columns controls right. Exactly five Ball covers: Poké, Great, Ultra, Master, Premier. Grid dimensions are independent, 1–6 each. Pockets preserve consistent proportions, and the cover matches their footprint. Master Ball uses a scalable SVG emblem above the seam.
2. Make a bigger pocket: horizontal, vertical, square, L, and reverse-L merges. Empty-pocket selections are shown before merging. Larger arbitrary connected shapes are the intended product behavior.
3. Sleeve it your way: five Ball themes for sleeves and five for toploaders. Two previews share one theme choice and use the workshop renderer. No sleeve-back artwork feature.

Align the three animation boxes regardless of different explanation lengths. No top step labels in these previews. Keep short explanatory captions at the bottom.

### Discover: Find what fits

One open studio preview with search, visible Set/Rarity filters, large card results, and a color picker plus hue slider. Three short selectable explanations: Find a card, Narrow it down, Match your style. No preset swatch row, visible hex output, reference-card button, scan panel, or language/catalogue panel. Color matches are explicitly sample-based.

### Collect: Know your collection

A collection dashboard distinct from the preceding layouts. Owned/missing/wanted cards are primary; completion is prominent; estimated value is smaller. Marking the sample missing card as owned updates card state, completion, and value. Currency/condition/import/backup inventories are not displayed here.

### Share: Made to be seen

One source binder on the left becomes a browser/public page, social post, and printable sheet on the right. The public-page example spans above social and print examples. Gentle output transitions and format changes. No rankings, badges, followers, membership, or referral promotion.

### Ending

Three short, always-visible FAQ answers. Closing statement: “Your next page starts with one card.” Button: Create your binder. Compact footer: brand/tagline, Explore, Help & information, image credits, fan-project notice. Do not invent contact/legal links that have no destinations.

## Motion

Independent looping examples while visible; stop off-screen or in hidden tabs. Input stops the relevant instructional animation and preserves state. The hero binder carousel is an exception: it resumes regular rotation after manual dragging or navigation, respecting reduced motion and visibility. No replay or pause/resume UI. One-time upward entrance (16px, approximately 650ms) uses stable layout positions and is separate from instructional timelines. No layout shifts or visibility oscillation. Respect reduced motion.

## Artwork

Card artwork comes from the external card-image URLs in the data files. The custom-cover demo uses an unchanged official Grookey virtual background; see assets/credits/pokemon-cover-art.txt. Merged-pocket demos use an accent tint. The old generated landscape/koi placeholders are not the active artwork.

## Accessibility and accuracy

Use clear keyboard focus, proper input labels, accessible names for Ball choices, and readable text/border contrast. Some light-theme text combinations have been checked against 4.5:1; a full audit remains necessary. Sample prices, limited color matching, and planned functions must remain honestly labeled.

Binder preview sizing: the preview uses a 264px board with space reserved for its title. Pockets, gaps, borders, and plus symbols scale uniformly to fit every 1–6 row/column combination. Cover buttons and the Master Ball emblem use the shorter cover dimension, preserving their proportions on tall and wide pages. The outer demo box remains 360px tall.

---

# Application design specification — working draft

Updated: 2026-10-12. Owner: the user. This section extends the landing-page specification above; it does not approve new pages or backend implementation.

## Decision labels and scope

**Confirmed** means explicitly requested or recorded in the existing project decisions. **Recommended** means a proposed default awaiting agreement. **Open** means an answer is required before the affected feature is designed or implemented. **Deferred** means intentionally outside the current implementation.

Confirmed: design the frontend pages first, plan the backend alongside them, connect them later, and prioritize usability. Preserve the existing landing-page appearance and interactions. Keep image-failure handling deferred for now. Do not deploy or implement authentication, a database, or production integrations during this documentation task.

Confirmed after Round 4: keep the current palette; consider visual refinements later. The warmer palette is an unselected proposal, not an approved change. The current palette above remains authoritative.

## Product and usability priorities

Recommended priority order: understandable actions, protection against losing work, accessible interactions, responsive layout, predictable performance, then visual polish. Advanced functions must not obscure creating, editing, saving, and reopening a binder.

Recommended primary flow: discover the product → create a binder → choose its layout → find a card → place it → save → reopen. Confirmed: require an account before binder creation. The public landing page remains accessible; shared viewing permissions will be defined separately. Preserve the intended creation destination through signup/sign-in. Do not design guest creation for this release.

Ownership is distinct from arranging a card: placing a card in a digital binder must not silently mark it physically owned. Confirm whether ownership is tracked globally, by printing, or by individual physical copy before designing this flow.

No requirement below implies that a sample landing-page demonstration is already real application functionality.

## Proposed page map

The exact number of pages is Open. A page may be a route or a panel; avoid separate pages merely to display a small setting.

| Destination              | Main job                                  | Primary action / reserved areas                                                                  | Access                                               |
| ------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Landing — existing       | Explain the product                       | Existing design; Create binder leads through Google sign-in when required                        | Public                                               |
| Workspace — proposed     | My binders and physical collection        | Distinct tabs; binder creation/list, inventory/wanted/checklists; account/settings panel         | Signed in                                            |
| Binder editor — proposed | Arrange/customize/save one binder         | Card picker, canvas, page navigation, overflow, Save/Undo; sharing/export panels                 | Owner only                                           |
| Discover — proposed      | Catalogue/color search and price checking | Search/filter/results; exact card/printing detail panel with raw/graded pricing; Add destination | Public browsing proposed; personal actions signed in |
| Shared viewer — proposed | Browse a saved unlisted binder            | Read-only pages/card details/artwork; Report artwork; no inventory disclosure                    | Valid link, no signup                                |

Recommended: embed card search in the editor even if a separate Discover page exists. Users should not lose their editing position to find a card. Sharing settings can be a panel inside the editor; a public viewer still needs its own URL if sharing is approved.

## Core page and function behavior

### Binder list

Recommended first-release functions: create, open, rename, duplicate, search, and delete with recovery. Show a meaningful empty state with one Create binder action. Duplicate makes a new independent binder. Deleting a binder must explain whether physical inventory remains intact; recommended default is that it does.

Creation should offer a safe default such as a named 3×3 binder without forcing users through every customization option. Rows and columns remain independent, 1–6, as confirmed in the landing demo. Confirmed: a new binder starts with one page; users add pages manually up to 30. Each page has its own independent layout. Number of binders per account remains Open.

### Binder editor

Reserve space for actual tasks: title and save status, page navigation, card search, current selection, and undo/redo. Do not reserve unspecified empty UI areas for possible future features.

Recommended: desktop uses an adjacent picker/inspector and central canvas. On phone, keep the canvas primary and use an accessible sheet or panel for search and editing tools. Final mobile editing scope is Open.

Every drag operation must have an equivalent click/tap action: select a card → select a destination → Move/Replace. Keyboard users must be able to choose a card and destination, reorder pages, and activate the same commands. Do not make precise drag targets the only route to completion.

Confirmed placement behavior: the new/moved card takes the target pocket; the previous content moves to the overflow tray, never automatically forward along other pockets. Show the displaced item and support Undo. Multi-select, copy/paste between binders, page reordering, and undo/redo are required. Do not assume automatic swap. Cut semantics and whole-set placement remain to be detailed.

Undo/redo should cover arrangement, page changes, merges, and customization, within a defined scope. A destructive bulk edit should have a preview or clear count. Confirmed: lowering grid dimensions or deleting a page moves affected content to overflow. Empty overflow tray must show the affected item count, require confirmation, and support Undo. These actions remove digital placements only; physical inventory is unaffected.

Merging should accept only supported connected pocket shapes; show selection and resulting footprint before commit. Unmerging must explain what happens to artwork and placed cards. Confirmed: both empty and occupied pockets may be merged; all contents of occupied pockets move to overflow and the merged region starts empty. Cards, uploaded artwork, and placeholder cards are supported; text pocket content is excluded.

Confirmed manual saving: a visible Save action and Saving / Saved / Changes not saved status; retry after failures without removing the draft. Only show Saved after storage confirms success. Warn on leaving if unsaved changes could be lost. Do not block every normal action with a confirmation.

### Discovery and card details

Search by name, collector number, and set. Use stable catalogue IDs for cards and printings; rarity must come from real metadata, not inferred number ranges. Decide languages, printings, and supported sets before integration.

Recommended basic filters: set and language, then rarity/type where available. Show active filters, result count, Clear filters, and a useful no-results state. Preserve query and scroll position when opening/closing card details. Large result sets need pagination or progressive loading with an explicit way to continue.

Card details should show artwork, name, set, number, language, printing/variant, and the available actions. Adding to a binder must identify the destination and confirm what was added. Keep adding and marking owned as separate actions.

Color matching is an enhancement, not a substitute for reliable search. Until actual image analysis is implemented and validated, label curated palette matches as samples. Pricing needs source, currency, printing/condition assumptions, and update time; unavailable prices must not appear as zero.

### Collection tracking

Recommended: display owned quantities, missing cards, wanted cards, and a clearly defined completion metric. Define the denominator: unique cards, exact printings, or physical copies. Avoid silently counting duplicates toward unique-card completion.

Decide whether Owned/Missing/Wanted are mutually exclusive states. Recommended data model permits wanting additional copies of a card already owned; the UI must express this clearly if supported.

Quantity must never become negative. Condition, grading, purchase cost, notes, location, and trade status are optional enhancements, not mandatory fields for every card. Start simple; expose details when users need them.

### Sharing, export, and printing

Recommended sharing defaults: private until explicitly published. Show exactly what a recipient sees before publishing. Explain whether a shared URL is public/searchable or unlisted; unlisted is not private. Provide revocation and a visible current sharing state.

Public viewers must not receive private notes, purchase costs, email addresses, or other excluded fields. Confirmed: an unlisted, read-only viewer shows the latest successfully saved binder automatically; unsaved edits remain private to the editor. No public gallery at launch. Export must be distinct from sharing access.

If included, image export should offer an explicit format and preview; report loading/processing/errors and preserve the binder on failure. Printing requires paper size, intended physical dimensions, margins, and a calibration/test page. Do not advertise a working print/PDF feature until sizing and remote-image export constraints are tested.

## Common states and interaction rules

| Situation                  | Required user experience when the related feature exists                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| First visit / empty list   | One clear next action; optional example; no unexplained blank panel                                 |
| Loading                    | Stable layout, understandable progress, no duplicate submissions                                    |
| No results                 | Explain active query/filters and offer a direct adjustment                                          |
| Validation failure         | Explain the problem beside the field; preserve entered values                                       |
| Network/provider failure   | Retain work, state what failed, offer retry and a usable fallback state                             |
| Unsaved / offline draft    | Label the storage state accurately; do not claim cloud saving                                       |
| Expired session            | Preserve recoverable edits; explain sign-in; resume without losing work                             |
| Save conflict              | Explain that another tab/device changed the binder; never silently overwrite                        |
| Destructive action         | Clear affected item/count; recovery where possible; stronger confirmation for irreversible deletion |
| Unauthorized/revoked share | Calm unavailable state that does not expose private data                                            |

Use plain-language labels, one primary action per task, visible selected states, and consistent navigation. Popups must not steal attention for routine successes. Important errors should remain visible until resolved. A notification should not be the only evidence that a save succeeded.

## Accessibility and responsive acceptance criteria

Recommended target: WCAG 2.2 AA, verified rather than claimed. Include keyboard access, logical focus order, visible and unobscured focus, labels, meaningful headings, status announcements, modal focus return, and alternatives to dragging. Do not communicate owned/wanted/error states with color alone.

Text contrast: at least 4.5:1 for normal text and 3:1 for qualifying large text. Essential control boundaries/states need appropriate non-text contrast. Pointer targets should meet the 24×24 CSS-pixel minimum or applicable spacing exceptions; prefer approximately 44×44 for important touch actions. A small visible icon can have a larger hit area.

Check page reflow and readable controls at narrow widths and increased zoom. A spatial binder canvas may retain two-dimensional navigation when essential, but surrounding navigation and controls must remain usable. Offer fit/zoom behavior rather than distorting card proportions. Respect live reduced-motion changes and keep user-controlled values intact.

### Task-based acceptance examples

| Task                  | Pass condition                                                                         |
| --------------------- | -------------------------------------------------------------------------------------- |
| Create first binder   | User reaches an editable, named binder without understanding technical terms           |
| Place a card          | Works by drag, click/tap, and keyboard; no card is lost                                |
| Change grid size      | Pockets retain proportions; affected cards are handled explicitly                      |
| Save and reopen       | Confirmed saved state reopens identically; failed save retains changes                 |
| Search exact printing | Name/set/number/language are enough to distinguish the result                          |
| Update ownership      | Quantity/completion reflect the chosen inventory rule; binder layout stays unchanged   |
| Publish/revoke        | Preview matches public output; revocation stops access under the chosen caching policy |

Before calling a page complete, run these tasks with realistic data and at least a desktop and phone viewport. Observe a new user completing the primary tasks without coaching where feasible; record confusion and errors rather than relying only on visual approval.

## Recommended implementation priorities

The user has confirmed the broad first-release scope below. Delivery order is a recommendation; it does not remove any requested feature. Do not call the release feature-complete until each selected capability passes its acceptance criteria.

| Priority                             | Functions                                                                                                                                                | Reason                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Core usable release                  | Create/open/save/reopen binders, find/place/move/swap/remove cards, add/navigate pages, undo, readable layout, keyboard/tap alternatives, clear failures | Completes the main job and protects work                    |
| Account launch requirements          | Sign-in/recovery, session handling, private access, account preferences, export/delete personal data flows                                               | Makes an account-based service usable and trustworthy       |
| Collection launch requirements       | Owned quantity, missing/wanted views, explicit completion rules                                                                                          | Prevents misleading inventory information                   |
| Confirmed creative scope             | Covers, sleeves, toploaders, merging, arrangement; bulk actions/reordering rules to be answered                                                          | Central collector customization experience                  |
| Confirmed first-release integrations | Catalogue search, ownership, color matching, public sharing, image export, printing/PDF, live prices with condition-aware checking                       | Needs provider, output, accuracy, and permissions decisions |
| Not requested for first release      | Image scanning, collaborative editing, full offline synchronization unless later chosen                                                                  | Keep separate from confirmed scope                          |

## Design interview and decisions still needed

Round 1 has been answered. Rounds 1 and 2 are recorded. Round 3 and its follow-ups are confirmed. Round 4 is recorded; Q18 is pinned for export/printing design and partial answers remain explicitly Open. Proceed with backend foundations. Later rounds are recorded here so nothing is lost; they do not all need answering at once. Technical implementation choices can be recommended by the assistant once the product requirements are known.

### Round 1 — audience and first release (answered)

| ID  | Question                                                                                                   | Why it matters / suggested starting point                                                                                                                                                            | Status                              |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Q01 | Who is the first version for, and is its main job attractive digital layouts, physical inventory, or both? | Pokémon collectors; creative digital binders and physical inventory both matter. Custom binders, sleeves, and toploaders; condition-aware value checking.                                            | Confirmed                           |
| Q02 | Which devices need full editing at launch: desktop, phone, tablet?                                         | Desktop editing first. Mobile editing later; public/landing viewing should remain responsive.                                                                                                        | Confirmed                           |
| Q03 | Can someone try a binder without signing up?                                                               | Account required before creating a binder. No guest creation flow for first release.                                                                                                                 | Confirmed                           |
| Q04 | Which features are essential for the first usable release, and what pages have you already planned?        | First release includes arrangement, covers/merging, catalogue search, ownership, color matching, public sharing, image export, printing/PDF, and live prices. Remaining page names not yet supplied. | Scope confirmed; page list Open     |
| Q05 | Is this personal or public initially; what monthly operating budget or technology constraints exist?       | Zero monthly budget for initial testing with friends. Supabase selected for database. Vercel is a candidate; backend design guidance requested.                                                      | Confirmed constraints; hosting Open |

### Round 2 — binder and editor rules (answered)

| ID  | Question                                                                                                                             | Consequence                                                                                                                                                                             | Status    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Q06 | One layout for an entire binder, or different row/column layouts on each page? How many pages/cards should a typical binder contain? | Start with one page. User adds pages manually up to 30 per binder. Each page has its own editable row/column layout.                                                                    | Confirmed |
| Q07 | What happens when a smaller grid no longer fits its cards, or a page is deleted?                                                     | Displaced cards/artwork go to a binder overflow tray. Empty tray confirms affected count and supports Undo; physical ownership is unchanged.                                            | Confirmed |
| Q08 | On an occupied pocket, should placement swap, push, ask, or refuse? Which bulk actions are essential?                                | Replace the occupied pocket; previous content goes to overflow. No push behavior. Multi-select, copy/paste between binders, page reordering, and undo/redo required.                    | Confirmed |
| Q09 | What content can occupy a pocket: card, image/artwork, text, placeholder? Can occupied pockets be merged?                            | Cards, uploaded artwork, and placeholder cards; no text content. Empty and occupied merges supported. Occupied merge moves all contents to overflow and creates an empty merged pocket. | Confirmed |
| Q10 | Should saving be automatic, manual, or automatic plus an explicit Save action? Do you need offline editing?                          | Manual Save with unsaved-change warnings. Automatic cloud saving is not selected. Offline synchronization remains unspecified.                                                          | Confirmed |

### Round 3 — catalogue and collection (answered)

| ID  | Question                                                                                                                                   | Consequence                                                                                                                                                                             | Status    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Q11 | Pokémon only at launch? Which card languages, sets, promos, and printing variants must search include?                                     | English printings released from 2010 onward, including promos and variants. Use actual printing release date; add future English releases automatically when available. Japanese later. | Confirmed |
| Q12 | Is ownership shared across all binders, and do you count quantities by printing or track each physical copy separately?                    | One physical collection shared across binders; quantities grouped by exact printing and condition.                                                                                      | Confirmed |
| Q13 | How should completion count cards: one of each card, one of each exact printing, or a custom checklist? Can owned cards also be wanted?    | Editable presets (one per card number or every printing), with individually editable targets. Extra Wanted copies permitted even when already owned.                                    | Confirmed |
| Q14 | Which details matter: condition, grading, notes, purchase cost, wishlist priority, trade status? Which should be optional?                 | Condition, grading, notes, chase-card wishlist, and trade status supported. Quick add with Unknown condition; extra details optional. Purchase price not selected.                      | Confirmed |
| Q15 | Live prices and color matching are confirmed essentials. Which currency/market, condition categories, and matching behavior do you expect? | Default USD, graded prices included; currency conversion later. Chosen-color artwork matching at launch; reference cards and uploaded-image matching later.                             | Confirmed |

### Round 4 — sharing, exports, and visual decisions (recorded; pinned/partial decisions noted)

| ID  | Question                                                                                                                            | Consequence                                                                                                                                                                                   | Status                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Q16 | Will binders stay private, have unlisted links, or appear publicly/searchably? Is sharing view-only or editable?                    | Private or unlisted link only; view-only; viewers do not need accounts. No searchable public gallery at launch.                                                                               | Confirmed                         |
| Q17 | Should shared pages update live or remain snapshots, and which fields must be hidden?                                               | Shared link displays latest saved binder automatically. Visual layout and card details only; no private inventory/status/value/notes/trade information.                                       | Confirmed                         |
| Q18 | What outputs are essential: social images, downloadable collection data, physical artwork inserts, whole binder pages, PDF?         | User requests returning to this question when designing exports/printing. These features remain first-release requirements; output types, paper sizes, and physical dimensions are undecided. | Pinned for export/printing design |
| Q19 | May users upload their own images? What file sizes and content expectations are reasonable?                                         | JPG/PNG/WebP accepted as suggested. Size limits and exact cropping/positioning/color/customization controls still need answers; format approval does not approve every control.               | Formats confirmed; controls Open  |
| Q20 | Keep the approved palette or try the warmer proposal? Any page references or visual preferences beyond the existing landing design? | Keep current palette; visual refinements later. Remaining page list not yet provided.                                                                                                         | Palette confirmed; page list Open |

Backend-specific questions Q21–Q30 are in ARCHITECTURE.md. Q22 authentication method remains unanswered even though an account is required. Q26 specific provider access remains unanswered; the user has identified free APIs as the intended starting point, not selected a verified provider.

## Reference guidance

These sources inform the recommended baseline; they do not decide product features for the user.

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — accessibility target and criteria.
- [W3C: Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) — pointer alternative and separate keyboard requirements.
- [W3C: Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) — minimum targets and spacing exceptions.

## Confirmed first-release direction — Round 1, 2026-10-12

Target users: Pokémon collectors who want customizable digital binders, sleeves, and toploaders, alongside tracking physical cards and checking condition-dependent values. Both creative presentation and ownership are primary jobs.

Desktop editing comes first; mobile editing is a later milestone. Account creation/sign-in is required before binder creation. Design a clear sign-in route and return users to their intended creation action. Public viewer login rules still need answering.

The requested first release includes all listed functions: binder creation/arrangement, covers and pocket merging, catalogue search, physical ownership, color matching, public sharing, image exports, printing/PDF, and live prices. This is a broad release scope. Recommend implementing and testing it in internal stages—editor/save foundations, catalogue/inventory, creative tools, then sharing/outputs/pricing—without silently reducing the final scope.

Pricing acceptance gate: select and verify a source that supports the promised condition/printing coverage. The initial screen must distinguish a source-backed price from an estimated adjustment and from unavailable data. Never invent a condition multiplier to make a generic market price look condition-specific. Condition is normally user-entered unless a separate assessment feature is explicitly requested. Do not imply that the website can grade a card from an image.

Initial testing is with a small group of friends, with a zero monthly operating budget. Exact participant counts, page limits, and hosting are still Open. Supabase is the selected database; the rest of the backend is to be guided and decided step by step.

## Confirmed editor behavior — Round 2, 2026-10-12

Creation starts with one page. Add page is a deliberate user action, limited to 30 pages per binder. Rows and columns can be edited independently per page within the existing 1–6 range. Disable Add page at the limit with an explanation. Page deletion at the one-page minimum remains an edge case to resolve; recommend retaining one empty page rather than leaving an unusable editor.

Overflow is a visible, binder-level list of displaced placements, not a second physical inventory. It should show its count, preview items, permit placing an item back on a page, and have Empty tray. Removing multiple pages must preserve all displaced items until a deliberate clear. Empty tray states exactly how many items will be removed, requires confirmation, and supports Undo. This operation does not delete owned-card records or globally delete an uploaded asset used elsewhere.

Moving card A onto occupied pocket B puts A in that pocket and moves B to overflow. If A was moved from another pocket, its original pocket becomes empty. If A was added/copied from catalogue/another binder, its source remains unchanged. No automatic swapping or pushing. Any future separate Swap command must be distinguished from replacement and confirmed before inclusion.

Merging either empty or occupied connected pockets is allowed. Before commit, preview the selected footprint and count of contents moving to overflow. Move every selected content item to overflow, then create one empty merged region, as one undoable operation. Pocket content types are cards, user-uploaded artwork, and placeholders; no text panels.

Manual Save is authoritative. Editing, page changes, overflow changes, merges, and customization mark the binder as unsaved. Show Saving only while a requested save is pending, Saved only on confirmed success, and preserve the draft on failure. Saving must include overflow and current page configurations together. Internal navigation with unsaved changes should offer Save and leave / Discard changes / Cancel; failed saving must keep the user in the editor. Browser/tab close warnings use the browser's native prompt and cannot be treated as a guaranteed recovery mechanism. Device-local crash recovery is a separate recommendation still to be decided; it is not automatic cloud saving. Printing/export/sharing should identify whether they use the current draft or the saved/published version; those semantics will be settled in the sharing round.

Desktop-first acceptance checks: move into occupied pocket → inspect overflow → Undo; shrink layout → restore an item; delete several pages → clear overflow with count confirmation → Undo; merge occupied regions → inspect empty merged region and overflow → Undo; edit two independently configured pages → Save → reopen with identical layouts and overflow. Test creation at 30 pages and rejection of page 31. Physical ownership must remain unchanged in every placement/overflow operation.

## Catalogue, collection, and pricing decisions — Round 3

Confirmed initial catalogue: English Pokémon cards from 2010 through 2026, including eligible sets, promos, and printing variants. Japanese support is a later milestone. Confirmed: use the actual set/promo printing release date and automatically add future eligible English releases when available. The lower boundary is 2010; 2026 is the current year, not a permanent upper cutoff. Do not interpret the year restriction as Pokémon species age, silently include pre-2010 printings, or claim complete variant coverage until the chosen provider is checked.

Physical ownership is one user-level inventory shared by all binders. Quantities are grouped by exact printing and condition, allowing, for example, two Near Mint copies and one Lightly Played copy. Arranging/removing/replacing cards or clearing overflow does not change these owned quantities. Prevent accidental duplication when the same printing appears in several digital binders.

Completion uses a checklist chosen by the user. Its selected targets determine the denominator; owned quantities determine which targets are satisfied under the matching rule. Confirmed: offer editable presets for one per card number and every printing, plus individual target edits; permit extra Wanted copies even when owned. Exact target-quantity and Unknown-condition matching rules still need specification. Show the checklist name/definition beside completion so the percentage is understandable. Do not change checklist targets silently when a catalogue expands.

Quick add should require only identifying the printing and quantity (default one). Condition defaults to Unknown, never Near Mint. Supported optional details: condition, grading company/grade, notes, wishlist/chase-card designation, and trade status. Purchase price and sale status were not selected and must not be added as required fields. Exact condition categories, grading choices, and trade-state names remain Open. Notes/trade status associated with only some copies must not silently apply to every copy of a printing.

Pricing defaults to USD. Other currencies and currency conversion are deferred. Graded-card coverage is part of the requested first release: identify grading company and grade, not just raw-card condition. Show the selected printing/variant, relevant condition or grade, source, price basis, and retrieval/update time. User intent is current market information, with eBay and TCG marketplaces as candidate sources—not a confirmed provider selection. Do not promise today's completed-sale rates if only stale aggregate prices or asking prices are available. Distinguish asking listings, sold transactions, and provider market estimates. Unknown condition or absent grade data must not be assigned an invented condition-specific value.

Color matching means searching artwork by visual palette. Possible inputs are a chosen color, an existing reference card, or an uploaded reference image. Results should explain whether they match a dominant color, similar palette, or another selected method. It is separate from card identification, Pokémon type/color, ownership, and valuation. Confirmed launch input: chosen color only. Reference-card and uploaded-image matching are later milestones. Palette extraction and ranking details remain an implementation decision to explain and validate. The landing page's three sample palettes remain a demonstration, not the full feature.

## Round 3 follow-up decisions

Chosen-color matching is the first release: user selects a color and gets artwork-based results. Reference cards and reference images are deferred; this does not defer artwork uploads for binder content, which are a separate confirmed feature.

Completion starts from editable presets (one per card number or every eligible printing) and supports individual target changes. Users may own a printing and want additional copies simultaneously. Keep owned quantities and wanted quantities independent; an extra Wanted copy must not reduce completion already achieved.

Catalogue eligibility uses printing release dates from 2010 onward. New eligible English releases are added automatically when available from the provider. Saved user-edited checklist targets remain stable; offer a visible update to include new variants instead of silently changing their denominator.

## Sharing and visual decisions — Round 4

Sharing supports Private and Unlisted only. Recommend Private as the initial state; the user has confirmed the available modes, not separately selected an initial default. Unlisted means anyone holding the link can view, without signup; do not call this owner-private or offer gallery/search discovery. Viewers cannot edit. Provide a deliberate sharing action, visible mode, Copy link, and revoke/return-to-private behavior.

The unlisted viewer reflects the latest successful Manual Save. Unsaved changes, including unpublished local replacements or page edits, are not visible there. Allow only visual layout, approved artwork, and catalogue card details. Exclude physical owned/wanted states, quantities, condition/grade, private values, notes, and trade status. If ownership highlighting is shown inside the editor, it must not leak into the public viewer's artwork or controls. Define precisely which catalogue details are shown when designing the viewer.

Q18 is pinned: return to exact image/PDF output types, A4/Letter, physical insert/cover/sleeve/toploader dimensions, and print calibration when designing that section. Export and printing remain requested first-release features. Do not silently defer the features or select measurement defaults because the question was postponed. The export scope decision is a prerequisite to completing those features.

Accepted upload formats: JPG, PNG, WebP. Exact upload size/dimension limits, transparency handling, crops/positioning, custom colors, and applicability to covers/sleeves/toploaders remain Open. Uploaded binder artwork is already confirmed; accepting formats alone does not authorize all suggested customization controls.

Keep the current cool light palette and existing dark theme. Do not implement the warmer comparison or change colors during this specification phase. User requested a proposed minimal map; five destinations are accepted as the current working map, subject to changes during frontend design.

## Backend-related UX decisions — Round 5

Initial testing is 5–10 friends. The beta allows three binders per account and 30 pages per binder. Show count/limit near creation, duplication, and Save as a copy; explain a full quota without losing the current draft. No Trash is selected; a successfully permanently deleted binder releases its slot.

Google sign-in first; email/password later. Preserve the intended creation destination after sign-in. Do not show a functioning email/password route until implemented.

On a conflicting Manual Save, preserve edits and offer Reload saved version or Save as a copy. Warn before Reload discards local changes; copying is subject to quota. Do not silently overwrite or discard the draft. Confirmed follow-ups: no automatic local recovery draft; immediate permanent binder deletion after confirmation; structured data download and permanent account deletion. Backend backup targets and detailed retention/export formats remain Open.

## Confirmed saving and data-management follow-ups

Keep editing drafts in memory only until Manual Save. No automatic device-local recovery. Display a clear unsaved indicator and leave warnings; explain that reloads/crashes can lose unsaved work. Automatic theme preferences are unrelated and may remain.

Delete binder requires explicit permanent-deletion confirmation naming the binder and affected pages. No Trash, Restore, or post-deletion Undo. Physical ownership remains intact. This whole-binder rule does not change undoable page deletion, card replacement, occupied merges, or overflow clearing.

Account/settings must provide structured Download my data and permanent Delete account with reauthentication and confirmation. Explain that account deletion removes both binders and physical inventory. Pinned image/PDF/printing decisions remain separate. Exact data-download format and backend backup/deletion retention remain Open.

## Round 6 and proposed minimal navigation

English interface for adult collectors around 20–30; test geography is unspecified. User maintains alone with assistant guidance. No existing domain/provider/hosting accounts. Beta is free, with payments/subscriptions intended later. Do not place inactive payment/subscription UI in the initial beta.

Five proposed destinations: Landing, Workspace (My binders/My collection tabs), Binder editor, Discover (including card detail/price checking), and Unlisted viewer. Keep account settings/data management, editor sharing/export, and card details as contextual panels. The user accepts this map as the current working plan, with revisions allowed during frontend design. The editor also embeds search so users can add cards without navigating away from unsaved work.

Uploaded artwork is included in unlisted viewing; provide a simple private reporting route to the sole maintainer. Exact form fields/contact handling are proposed, not an invented live email destination. Keep ownership, condition/grade, value, notes, quantities, and trade status excluded from shared views.

Provider recommendation from documentation research: TCGdex catalogue/images plus a validation trial of PokemonPriceTracker for raw-condition/graded prices. Pricing refresh must display source and update time, and quota/coverage failures remain explicit. No provider account has been created and no API key has been collected.

Pinned Q18 remains for export/printing design. Further questions about cropping, positioning, color controls, upload limits, and exact condition/grade categories will be asked in the editor/data design rather than inferred from the accepted image formats.

## Current page-map agreement — 2026-10-12

The user accepts the five-destination map for now: Landing; Workspace with My binders/My collection tabs; Binder editor; Discover with card-detail price checking; Unlisted binder viewer. Account/settings, sharing, and exports are contextual panels under the current plan. This is a working map, not a permanent restriction on page count or navigation.

Frontend design comes first. Choose and refine layouts, spacing, controls, and visual treatment while building each page. Preserve confirmed behavior and data/privacy requirements unless the user changes them. A visual revision does not by itself authorize backend implementation or production deployment. Update this specification when a page/function location changes so architecture follows the final user flow.

The current landing palette remains unchanged until a specific refinement is requested. Use realistic sample data and loading/empty/error/unsaved states while designing; actual accounts, persistence, provider integration, and deployment are later work. Q18 export/printing details remain pinned for that section. Other detailed decisions should be asked when designing their relevant feature, not guessed or presented as settled.

## Current frontend implementation

See [HANDOFF.md](HANDOFF.md) for the current page behavior and file map, and [HISTORY.md](HISTORY.md) for implementation milestones. Shared typography and spacing live in site-system.css; page-specific layouts remain separate.

## Deferred backlog

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

## Calm editor layout — 2026-10-14

The binder editor now uses a plain full-window canvas, a slim top bar and floating tools, replacing its previous three-panel framing. One surface token, 12px floating radius, soft shadow, 8/16/24/32/48px spacing and 14/16/20px typography keep tools quiet. Accent is reserved for Save, selected indicators and focus. Cards/Customize are drawers; layout, overflow, tips, theme/import/export and credits are contextual. Desktop drawers push the canvas; narrow drawers overlay it. Soft filled empty slots replace editor-only dashed pockets. The landing demos and other pages are unchanged. The complete control map and validation are in HANDOFF.md.

## Editor interaction stability — 2026-10-14

Drag targets must remain fixed during native dragging. Overflow tray content stays mounted while temporarily clearing the pointer path. A measured lower dock separates scrolling artwork from tools, notifications and Credits; popovers must not cover toast actions. Toast Undo/Redo describes a committed editing action, never a cancelled or informational operation. Exposed Fit, proportional zoom steps, a usable minimum and stable card pixels across empty/filled pages keep zoom predictable. Style scope remains visible while presets scroll, and preset title colors adapt to known cover backgrounds. Manual colors, Apply/Cancel and manual Save remain separate.

## Editor utility panes and centered controls — 2026-10-14

Fit controls and page thumbnails share the fitted binder center. Overflow and Page settings reserve space beside the canvas, rather than obscuring pockets. Phones reserve a bottom region for these utilities, temporarily replacing lower controls. Utility dismissal has explicit close/Escape focus return; binder clicks do not dismiss an open pane. Overflow no longer fades while dragging because its targets remain unobstructed. Cover Text fields use compact paired rows while retaining labels, keyboard controls and staging. See HANDOFF.md for implementation and validation.

## Pocket design and useful editing help — 2026-10-14

Pocket design uses small card thumbnails and a bounded proportional preview with fixed visible actions. Pending placement exposes only its prompt and Cancel; selected-pocket editing uses distinct compact buttons. Appearance tools are adjacent in the rail. More has no chevron; Credits lives within More. Editing tips is a short task-based guide in reserved utility space rather than a paragraph over the binder.

## Editable opened-book view — 2026-10-15

Editor page view offers 1 page / 2 pages in the thumbnail strip. Both facing pages are editable, while page-local selection/merge/settings retain one active page. Spreads use consecutive fixed pairs, full-spread Fit, shared image-pixel zoom and page labels. A final missing leaf offers Add page without changing saved data until clicked. Changing view is a display-only session choice. The whole-grid shadow has been removed; subtle leaf outlines define the opened binder.

## Audit maintenance — 2026-10-15

Approved appearance and responsive behavior retained. Backup file allowances cover supported exports while schema, record, field and artwork limits remain enforced. Save-status expiry must not reset subsequent history/toast state; Escape clears active placement/selection before closing Cards. editor-calm.css is the current layout layer; earlier unused editor layout/mobile sheets are removed.

## Editor spacing refinement — 2026-10-15

Use one adaptive bottom dock outside the fitted stage, compact Cards drawer and subtle page surfaces. Keep original drag/pocket geometry and image-resolution caps. Page information includes actual filled/empty region counts; facing-page counts explicitly refer to the active page. No additional collection tools or product features were introduced.

## Live customization on the canvas — 2026-10-15

Cover editing temporarily shows the complete selected cover on the main canvas. Card-style drafts preview on the visible target cards in selection/page/binder scope. Preview does not change stored data, undo history or Save status; Apply commits and Cancel restores. Sidebar preview remains compact with clearance above tabs.

## Shared Pages and Overflow sidebar

The approved binder-first layout now shares the right sidebar between Pages and Overflow. View buttons keep a constant panel width and leave Fit/camera geometry unchanged. The collapsed rail retains both icons, a live nonempty Overflow count and the expand arrow. Pages retains its scrolling previews/reorder/Add page behavior; Overflow uses compact draggable thumbnails, existing click-to-place, confirmation before Clear and Undo. Empty Overflow says “No displaced cards.” Existing binder controls stay pinned below either view. The topbar overflow warning opens the same view rather than a separate popup. On phones, choosing an overflow item collapses the overlay so users can reach every pocket. No data schema, save or history behavior changes; the left tool hierarchy and movable floating tools remain.

## Editor icon and notification cleanup

The left tool rail is fixed again: its drag grip is removed, with tool order and actions unchanged. Selection tools and nonmodal popovers remain movable. Pages and Overflow use icon buttons in both sidebar states; Overflow uses a bin and a live count. The topbar warning is the same bin/count shortcut, and Clear overflow uses a separate bin-with-cross icon with its existing confirmation and Undo. All icon controls retain accessible names and tooltips. Notifications use regular 14px text, smaller spacing, a quiet outline/shadow and no minimum width; short messages fit a compact single row, while long/mobile messages wrap readably. Dismiss, five-second expiry, hover/focus pause, screen-reader status and drag-transparent behavior remain. The moved-item notice no longer repeats the Undo action in its text. Binder fitting and document data are unaffected.

## Discover and Workspace consistency

Discover and Workspace share the navigation container, gutters, 28px page titles, 14px captions, selected tabs, neutral secondary actions and slim disclaimer/credits/FAQ footer. The landing page retains its full footer. Discover uses unboxed artwork tiles with restrained hover/focus, a full-width search toolbar, a bounded filter disclosure and visible color shortcuts. Color matching uses curated sample palettes, not image analysis; sets and fictional prices remain explicitly samples. Set previews use the existing sample artwork and palette tint. Details place collection/binder actions ahead of the collapsed fictional-price controls. My binders keeps the approved covers and all saved-binder actions while matching shared spacing and primary-action placement. Editor appearance is unchanged by this pass.

## Minimal editor trial

The user authorized all eight decluttering suggestions. The header retains Workspace/name/Preview/Save/account and the existing home mark; page metadata is a quiet caption above the canvas, and save status is visible only while unsaved. The right sidebar has one icon row for Pages, Overflow, context-only Clear and Collapse, with a plain surface and one separating edge. Its footer exposes Fit, actual zoom percentage, Undo/Redo and one View/settings popover. That panel contains the original page-view selector, page actions/layout and an inline Editing tips disclosure. +/- zoom remain inside the zoom popover with the existing slider. All original handlers/IDs and the 30-page cap remain.

The fixed left rail has no surrounding pill/shadow; active/hover/focus states and tooltips remain. Single selection uses one movable icon row, a screen-reader-only count and a local thin selected outline. Multiple selections retain a visible count; placement keeps its destination prompt and cancel icon. Opening View/settings temporarily hides the selection toolbar without clearing selection or changing Fit, so floating tools do not cover each other. Routine selection/placement/drag-cancel messages no longer toast; completed editing actions retain Undo, and errors/warnings remain. Save confirmation stays in its explicit button/disabled state and helper tooltip rather than a long toast. Document saving, cross-page editing, drawers, covers/styles, reordering and notifications never reserve additional canvas space. Drawers/sidebar/navigation lose decorative shadows; actual floating popovers retain separation.

Phone editor layout (700px and below): the binder uses the full canvas width, with a 56px header and a labeled bottom dock using the existing tool order plus Pages. Cards, customization and Pages/Overflow open as mutually exclusive full-width bottom sheets; Pages and Overflow remain distinct views. The existing Pages toggle moves into the phone dock and returns to its desktop header above the breakpoint. Phone Cards uses tap-to-place instructions, side-by-side filters and 16px inputs; short landscape Cards separates filters from artwork. Escape dismisses the Pages sheet and restores its dock trigger. Desktop layout and editing behavior remain unchanged.

## Icon workshop revision — 2026-10-16 (supersedes older editor control maps)

The binder remains the focus. Remove the global/contextual More menus, page metadata caption and manual workshop zoom/Fit. Fit is automatic. Use direct, visibly bounded icon buttons with tooltips/accessibility labels for left-rail backup/restore, Preview, View/settings and Undo/Redo. The header holds the theme switch and Save. Keep Pages and Overflow separate in the collapsible right sidebar; put searchable Help in its footer. On phones use a scrollable icon dock with a pinned Pages trigger.

Ordinary clicks accumulate card selection on the active page; clicking a selected card deselects it. A thick outline and check badge identify selected cards while others dim. Drag moves cards, including touch hold-and-drag; the Move icon retains a click/keyboard alternative. Select pockets to merge is an explicit separate mode. Contextual icon actions remain on a movable floating bar. Routine notifications compress to status/Undo/dismiss icons, retaining accessible details; errors stay readable. Page navigation/add buttons have visible boundaries and hover/focus states. No controls or notifications reduce the fitted canvas.

While styling sleeves/toploaders, page-turn buttons remain available and preserve the unapplied draft; cards can be targeted without closing customization. Transparent cover renders the actual first page, including merged shapes and artwork, in editor/Workspace/viewers. Apply creates a draft edit; Save persists it. Image inspection/crop zoom is independent of the removed canvas zoom.

## Workshop refinement — 2026-10-16 (current)

Tool panes opened from the left rail reserve a left column for Cards, customization and settings on desktop/tablet. The one- or two-page binder is centered and automatically fitted between that pane and the right sidebar. Phone sheets preserve preview space. Sleeve/toploader tabs refresh page navigation after leaving Cover; card targeting and unapplied styling survive page turns.

Placed-card drops onto another card swap entire contents in one undoable edit; catalogue edge insertion still pushes, catalogue centre drops still replace, and non-card displacement still uses Overflow. Floating toolbars shrink to their available actions, including after dragging. Icons are smaller and heavier within bounded centered buttons. Notifications show short visible action text for three seconds, with Close and Undo; focus/hover pauses expiry. Empty pockets show plus signs. No selected-page outline is shown without a pocket selection, and collapsed sidebar view icons have no selected styling. Artwork disclosures use one chevron and padded, wrapping headings. These decisions supersede earlier icon-only feedback and replacement-on-every-drop descriptions.


Discover image scheduling (20 October 2026): artwork requests begin for visible or nearby tiles, with the first visible thumbnail prioritized. Hidden Cards/Sets views do not initiate artwork requests. Large card details retain full-quality images; appearance and interactions are unchanged. TCGdex remains the image host.


## Separate binder and card customization ? 2026-10-22

The editor's binder icon opens Customize binder with compact Cover presets, Text,
Your artwork, Page appearance and Reusable design sections. The shared three-tab
switch is removed from this view. The stacked-card icon opens Customize cards
with only the existing Sleeves / Toploaders tabs; presets, scope, card targeting,
page navigation and manual Apply/Save behavior are retained.

Binder text adds an optional subtitle alongside the existing title size, color,
alignment, position and visibility controls. Page appearance applies one color
and None/Subtle/Defined pocket borders throughout the binder. Opening that section
previews the actual page; closing it returns to the cover. Page geometry and card
artwork are unchanged. Optional cover.subtitle and cover.pageStyle fields are
validated and retained in normal saves, backups, transparent covers, thumbnails
and viewers; legacy binders keep their original appearance. No production schema
or configuration changes are made.

Reusable designs download as versioned JSON files containing cover artwork/text
and page appearance, without binder cards or inventory. Loading validates a bounded
file, previews it, and requires Apply then manual Save. These are portable files,
not an account design library. Invalid imports preserve the current draft; Cancel
discards preview changes. Design files containing private artwork should be kept
private. Automated cover checks cover optional fields, legacy compatibility,
round-trip preservation, rejection/rollback and Undo/Redo. Local browser checks
cover panel separation, title/subtitle preview, page appearance, valid/invalid
file loading, Cancel, existing card styling and narrow layout bounds. Hosted
saving and other browser engines have not been exercised for these new controls.

The browser download handler ran without errors, but its completed file could not
be independently verified through the browser automation download event. Manual
download completion and hosted Save checks remain before release.


Binder customization navigation refinement ? 2026-10-22: Cover, Text, Artwork,
Pages and Designs are five compact icon-and-label buttons in the panel, replacing
all five accordions. Exactly one labelled settings region is visible, the active
button is highlighted, and the button row stays reachable while controls scroll.
Opening binder customization starts on Cover. Pages previews the binder page;
other buttons restore the cover preview. Card customization is unchanged.


Workshop correction ? 2026-10-22: Customizer inputs/selects use full bordered
fields with inset red focus rings, avoiding clipping at scroll edges. Add cards
and customization Close share the same bordered button treatment. The Pages
section shows the actual current-page thumbnail instead of the cover and permits
turning existing pages with the design draft intact. Shared page thumbnails and
binder preview render empty pockets in a contrasting surface with plus signs,
even when the page background is colored and optional borders are disabled.
Local browser checks confirmed nine visible pockets/pluses on an empty page,
six matching card images on a populated page, preserved drafts during page turns,
and consistent close-button borders. Production remains unchanged.


Workshop visual consistency ? 2026-10-23: Removed the binder-only heading size
and footer-control override. Binder, card styling, Add cards and View/settings
panel headings share 18px/600 typography. Both customization panels share 16px
preview names, 14px preset labels/form text, 12px supporting copy, and 44-by-40px
footer icon buttons (44px tall on touch layouts). Form text has consistent leading
padding. Workshop Close controls share a 40px bordered button and the expanded
catalogue uses the same SVG close icon instead of a text multiplication glyph.
Distinct cover/card artwork dimensions and section navigation remain intentional.
No saved-data behavior, backend configuration, merge or deployment changes.


Per-page appearance ? 2026-10-23: Pages defaults to This page and offers All pages. Individual pageStyle overrides persist through normal saves/backups. All pages updates the binder default and clears overrides; new pages inherit that default. Reset uses Use binder default or Reset all pages. Draft page edits survive page turns and Apply remains atomic/undoable. Existing records remain compatible. Hosted acceptance has not been run.


Consistent framed-card sizing ? 2026-10-23: The shared card renderer reserves a fixed 2.5% allowance per side for all cards. Sleeves and toploaders use thinner nested rims; applying either or both no longer changes card image dimensions. Existing stored styles and artwork remain untouched. Geometry regression checks cover ordinary, thumbnail and merged proportions; browser comparison confirmed identical card width before/after combined styles. No production changes.


Frame visibility refinement ? 2026-10-23: Kept the same fixed card image dimensions and rim allowance. Sleeves now have a thicker colored band, with toploaders occupying a distinct outer rim and stronger translucent case/highlight contrast. Combined frames still fit inside the pocket without changing artwork size.


Case depth refinement ? 2026-10-23: Cards use a uniform 3.5% per-side allowance (two percentage points less image width than the preceding version). Sleeve/case bodies extend around the card; a transparent retaining edge and opening lip render in front, giving an inserted-card appearance without tinting the artwork. Frame choices still share identical card dimensions.


Holder spacing adjustment ? 2026-10-23: Increased both rim strokes to 1.8% of pocket width and moved their bodies outward to leave a visible inner gap. A uniform 4.5% allowance keeps card dimensions identical across all styles; image width is two percentage points smaller than the preceding version.


Unframed sizing exception ? 2026-10-23: At owner request, cards without sleeves or toploaders use the full available pocket bounds while preserving aspect ratio. Only framed cards reserve the holder/gap allowance. Sleeve-only, toploader-only and combined styles retain consistent artwork sizes. This supersedes the earlier uniform bare/framed size rule.


Pocket-filling holders ? 2026-10-23: Following the owner-provided PkmnBindr reference, the outermost sleeve/toploader now fills the pocket bounds, including its stroke. With both present the sleeve nests inside the toploader. Card artwork stays inset with its existing framed dimensions; bare cards fit the available bounds while retaining aspect ratio. Geometry tests assert exact outer-holder coverage and containment, including merged proportions.


Rectangular merges ? 2026-10-23: New merges must form a solid rectangle, including horizontal/vertical strips and squares. L-shapes and shapes with holes are rejected before content moves; the UI uses the same eligibility rule. Saved connected legacy shapes remain loadable. Plus markers in rectangular merged regions use the exact bounding-box center, including even-width/even-height merges; legacy irregular shapes retain an interior marker position. Model checks cover rejection rollback and valid rectangles; browser measurement confirmed a merged-strip marker centered within 0.01px.


Merged empty-pocket contrast fix ? 2026-10-23: The shared page appearance helper now keeps empty-pocket fill independent of custom page background color. Rectangular merged empties remain visible against colored pages while retaining their centered plus markers. Saved layouts and page colors are unchanged.


Unified empty-pocket styling ? 2026-10-23: Removed the merged-pocket exclusion from empty-pocket background, fill transparency and hover rules. Both ordinary and merged empties now share the same gradient, rounded corners, inset border and hover treatment rather than flat merged fills. Centered markers and saved layouts remain unchanged.


Selection toolbar hierarchy ? 2026-10-23: Primary Customize/Design pocket/Merge actions use icon-plus-label treatment; supporting Inspect/Move actions remain neutral. Secondary swap, unmerge, copy/paste styles, cross-binder copy and selected-card pocket design are in More. Multiple selections say N selected. Remove is separated and red on hover; Clear selection is quiet at the far end. Removed the selection drag grip, retained existing action handlers, and bounded the More popup with outside-click/Escape dismissal. Existing single-card-only movement is retained, without inventing multi-card movement. Local branch only.


Toolbar spacing/movement ? 2026-10-23: Restored a narrow visible drag grip using existing bounded pointer dragging, arrow-key movement, Home reset and Escape cancellation. Main action hit areas share 36px height, 6px gaps and consistent corner radii. Primary action keeps its label; remove/dismiss retain separate spacing. More menu rows have consistent padding and hover surfaces. No editing/data behavior changes.

Card customization clarity - 2026-10-23: Sleeves and Toploaders now have visible icon-and-text tabs, a compact preview with separate current-style rows, and an explicit target count/scope note. Equal preset tiles isolate each holder, with a complete selected border and checkmark. Pending edits are described separately from current styles; Cancel/Apply are labeled in card mode while binder controls retain their existing treatment. Desktop spacing uses 10px section gaps, 8px tile gaps and 16px preview spacing; six sleeve presets fit the checked laptop panel. On phones only presets scroll, with scope and footer in separate grid rows. Short landscape hides supporting copy and uses smaller samples to preserve usable controls. Applying styles still requires manual Save; no saved-data format changes.

Sidebar hierarchy - 2026-10-23: Pages and Overflow share a bordered control group with 40px controls, 6px internal gaps and 12px separation from the collapse toggle. Expanded controls show icon-and-text labels; collapsed controls retain tooltips. Overflow uses a tray icon and a nonzero count badge (99+ cap, exact count in accessible name/tooltip). Clear overflow lives inside its view, away from navigation. Removed the full-height desktop divider, aligned Help/collapse controls and exposed the Add page caption. Existing page thumbnails continue to render actual content and appearance. Phone tabs retain 44px targets.

Help quick reference - 2026-10-23: Basics uses compact Cards, Selection, Pockets, Appearance, Pages, Overflow and Saving accordions with short action rows and optional details. Shortcuts is a separate searchable list of existing commands with keycaps. Panel padding is 16px, section gaps 12px, accordion gaps 8px and headers at least 44px. Search and navigation stay fixed while content scrolls. Credits is a quiet footer. Hosted-account saving and browser-local demo saving are described separately.

Page settings clarity - 2026-10-23: View uses Single/Spread segments and applies immediately. Layout shows the active page, Rows/Columns and the number of grid spaces, with a separate labeled Apply layout action. Quiet unchanged state; warnings describe displaced items and affected merged pockets. Duplicate page and Delete form a separated footer. Uses 16px padding, 12px section spacing, 8px field spacing and 40px controls; phone panels can scroll. Saved-data and confirmation behavior are preserved.

Layout confirmation consistency - 2026-10-23: Show old/new dimensions for every valid layout change, with separate short lines only for affected items or merged pockets. Omit zero-effect counts, per-item lists and redundant Undo explanations. Both increases and decreases require Apply layout; Cancel preserves the draft and existing page.

Binder/card panel parity - 2026-10-23: Binder and card customization share preview dimensions, section spacing, preset tile styling, checkmark selection and labeled footer actions. Binder's five section controls remain outside the scrolling settings. Only affected placed content triggers a layout confirmation; growth and changes over empty pockets apply directly with success feedback. This supersedes the previous always-confirm layout rule. Existing saved-data and manual Save behavior are preserved.

Centered customization previews - 2026-10-23: Center the combined thumbnail/caption group in both binder and card panels. Use a shared bordered strip with 12px padding, 12px image/text spacing and a 62px square contain box. Preserve the artwork ratio and permit the caption to wrap within the strip. Page captions show the actual rows x columns rather than repeating Page appearance. Existing phone preview behavior is retained.

Appearance consistency audit fixes - 2026-10-23: Portable design exports and transparent previews use the resolved appearance draft. Viewer page overrides now control their own borders and inspection rendering. Empty pockets keep the same contrasting fill in the editor, viewer and transparent covers. Regression fixtures match rectangular-only merging and distinguish icon-only from labeled controls.

Discover set logos - 2026-10-23: Set tiles center one official TCGdex logo in a fixed-height contained artwork area (184px desktop, 140px phone), with a name fallback. Names and printing counts remain below the artwork. WebP assets load directly from assets.tcgdex.net through the existing deferred image scheduler. Avoid database migration and extra API reads by deriving the canonical logo directory from current set preview metadata; validate any explicit logo URL before use. Missing images do not block opening a set.

Discover set browsing first pass - 2026-10-23: Compact equal-height logo tiles use 144px desktop/120px phone artwork areas, 16px grid gaps and a quieter name/count caption. Local data explicitly says sample printings; repeated provider badges are removed. Search and Name A-Z/Name Z-A/Most printings sorting share a compact control row with 44px targets. Release dates and series are not available in current catalogue metadata, so date sorting/grouping are deferred. Opening or filtering to a set shows its logo/name/available count above card search, with Back to sets; clearing the set filter clears the header. Existing deferred loading, card filters and printing-number order are retained.

Compact active-set logo - 2026-10-23: At owner request, removed the wide selected-set banner. The existing removable set-filter chip below search now contains the corresponding contained TCGdex logo in an 88x32px artwork box, with set-name fallback while loading/on error and an accessible Remove filter name. Other filter chips remain text. Back to sets, filtering and sorting are preserved. This supersedes the selected-set header from the preceding first pass.

Discover navigation simplification - 2026-10-23: Removed Back to sets and its associated state/handler. Cards/Sets tabs are the single view navigation. Opening a set focuses the Cards tab, preserving keyboard access and the compact removable set-logo filter.

Discover expanded filters - 2026-10-23: Searchable Set/Type/Rarity checklists sit in a compact quick-filter row and use OR within each group, AND between groups. More filters contains category, illustrator, HP range, finish and sample-only color matching; a result-count action closes the panel. Each selected value has its own removable chip, preserving set logos. Reset/Clear all preserve form consistency; repeated URL parameters restore multi-selection. Mobile quick pickers span their row and More filters becomes a bounded bottom sheet with 44px controls. Added descending name/number and ascending/descending HP sorts. Public search migration extends the existing bounded RPC without changing private data/access permissions. Metadata searchVersion=2 gates multi-select/advanced fields for older backends. Main text search includes illustrator when supported. All changes are local; hosted migration/application deployment remain pending.

Discover visual hierarchy - 2026-10-24: Search occupies its own full row. Quiet Set/Type/Rarity and More filters controls use counts only when selected. Type choices pair small SVG symbols with names in a two-column picker; selected rows receive subtle accent tint. Active chips and conditional Clear all sit together above a separated result-count/Sort row. More filters pairs Category/Finish, then Illustrator and HP ranges, retaining its footer and mobile sheet. Desktop height is bounded by available viewport space. Uses 8px control gaps, 12px form gaps and 24px before artwork. Existing filters, logo chips and URL state are preserved; no backend changes in this refinement.

Discover depth pass - 2026-10-24: Search and quick filters share a compact raised surface with 16px desktop/12px phone padding and a soft edge highlight. A faint top-of-page accent glow fades to the neutral canvas. Gallery images gain soft external shadows, a 3px pointer-hover lift and stronger keyboard-focus shadow; image filters, blending and artwork remain unchanged. Captions use stronger names, quieter set/number text and compact neutral rarity badges. Selected quick filters gain restrained accent tint. A brief opacity arrival animation respects reduced motion. The introductory line now shows only available printing/set counts, explicitly labeling sample data. No backend or saved-data change.

Discover multi-select/search modes - 2026-10-24: Set, Type, Rarity, Category, Finish and Illustrator now use the same searchable multi-select controls. More filters contains inline Category/Finish/Illustrator checklists and HP range. Types offer Any/All matching to find dual types. Search has an inline All/Name/Number/Set/Illustrator selector with mode-specific hints and URL state. Color is a separate quick-filter button with sample-only explanation, independent dismissal and viewport-bounded popup. HP remains a numeric range and color matching retains its existing single target. Extended the still-unpublished catalogue migration to searchVersion=3 with illustrator options, validated array filters and whitelisted query scopes/type matching; existing scalar calls remain supported. No production schema/data changes.


Full English catalogue preparation - 2026-10-24: Discover supports a bounded 500-group directory using compact metadata without eager card previews; result pages remain 24 cards and hidden images remain deferred. Counts reflect available provider records, partial groups show missing-record badges, and missing artwork shows a placeholder with unavailable zoom. Old sample IDs and the two punctuation Unown printings retain stable identities. More English coming-later copy is hidden for the expanded connected catalogue. Color matching remains sample-only. Local snapshot: 21,256 cards / 201 groups, with 228 upstream missing records documented in FULL-ENGLISH-CATALOGUE.md; production remains the ten-set trial.
