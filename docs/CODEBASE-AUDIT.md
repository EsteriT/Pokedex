# Codebase cleanup — 2026-10-15

Scope: all five frontend entry points, every source JavaScript module and stylesheet, assets/references, build/check scripts, model tests and browser regressions. The expected workload is one browser-local prototype with up to three binders, 30 pages per binder and the existing collection limits. Generated previews were excluded from duplication findings and rebuilt from source.

## Confirmed bugs fixed

1. **Malformed editor link IDs could corrupt saved workspace metadata.** `binder-schema.js` now shares identifier validation with document/metadata reading, `binder-store.js` rejects invalid save IDs before writing, and `editor.js` replaces an invalid link ID with a fresh identifier. Existing saved data is unchanged.
2. **Overflow could grow beyond the existing 2,000-item save limit.** `editor-state.js` now rolls back an edit that exceeds the limit, including the displaced item and history. Moving from a full tray into an occupied pocket remains possible because the item count does not grow.
3. **Clearing browser storage in another tab left stale pages and revisions.** Workspace, collection and Discover handlers now recognize the `key=null` storage-clear event. Clean views reload; dirty collection edits remain available with a conflict warning.
4. **Stale rename could claim success after a binder was deleted elsewhere.** Workspace now reports that the binder is unavailable and retains the open form rather than announcing a successful rename.
5. **Escape from record-removal confirmation also closed its parent editor.** Nested-dialog Escape handling now lives in `ui-controls.js`, dispatches the focused dialog's cancellable close request and leaves its parent open. The Discover-specific workaround was removed; image/inventory dismissal and focus return remain covered.

## Cleanup

- Removed 324 retired selector branches and 84 repeated or conclusively overridden declarations. Retained live responsive/theme rules, dynamically assembled class families and compatibility fallbacks.
- Removed undefined CSS-variable references; used the existing ink token where the collection close control needed an explicit text color.
- Reused `BinderSchema.connected` for merge execution as well as eligibility/import checks, and `DemoMotion.top` for landing-demo visibility geometry.
- Removed unused demo playback-button machinery and labels, unused local state/parameters, unreachable popover-position branches, a superseded cover-disclosure assignment and an always-hidden duplicate Back to cards control. The actual review-step Back to cards action remains.
- Reduced source by approximately 32 KB / 1,610 lines. No dependencies or active features were removed.
- Shortened HANDOFF.md to current behavior and ownership; preserved superseded chronological notes in HISTORY.md.

## Verification

- All five preview builds, project checks and model suites pass.
- Added model regressions for invalid save IDs, full-Overflow rollback/swapping and disconnected merge rejection.
- Extended browser checks for storage clear with clean/dirty state, stale rename, malformed editor links, nested confirmation Escape, viewer inspection/navigation/storage updates and landing demo lifecycle. Unhandled promise rejections now fail browser checks alongside runtime errors. The shared browser-test wait helper waits for document completion, preventing null-element reads during large preview reloads.
- Complete browser regressions run against source and generated previews, preserving the existing editor, customization, collection, Discover and Workspace checks.
- Compared 64 computed-style snapshots across Landing, My binders, My collection, editor/drawer, Discover Cards/Sets and Viewer, at 1366, 1920, 2560 and 390px in both themes. No computed-style differences remained; the removed hidden duplicate button is the only DOM difference.
- Static inspection reports no unresolved local names, unused locals/parameters, unreferenced source files or unused keyframes. All remaining source modules and assets are referenced or required licenses/provenance.

## Limits

This is evidence for the inspected code and tested flows, not a claim that every possible bug is eliminated. Chromium was tested; Firefox/Safari were not. Live catalogue/prices, authentication, cloud storage and simultaneous cross-tab write transactions remain outside this frontend prototype. No deployment was performed.
