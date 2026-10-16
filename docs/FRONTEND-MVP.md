# Frontend MVP milestone

**Milestone:** `frontend-mvp-2026-10-16`  
**Status:** Accepted by the user  
**Date:** 2026-10-16

The user confirmed the current website as the frontend MVP milestone. This document records the accepted frontend baseline; future changes should preserve its appearance and behavior unless explicitly requested.

## Accepted scope

- Landing page with interactive feature demonstrations and accurate available/planned feature copy.
- Workspace My binders and My collection, with browser-local records and explicit saving.
- Discover with sample-catalogue search, filters, color matching and binder/collection handoffs.
- Binder workshop with one/two-page views, page navigation/addition/reordering, separate collapsible Pages/Overflow views, card selection, connected-pocket merging, artwork/placeholders, directional insertion, placed-card swaps, batch insertion and copying between binders.
- Covers (including transparent), title/artwork customization, sleeves and toploaders with in-context card targeting and page turning.
- Compact icon controls, fitted side-pane layouts, visible selection, empty-pocket plus signs, searchable Help, Undo/Redo and dismissible three-second action notifications.
- Explicit local Save, validated Download backup/Restore backup, and a read-only binder viewer.
- Responsive desktop/tablet/phone layouts, keyboard controls, accessible icon names and reduced-motion support.

## Verification at acceptance

- All five standalone previews rebuilt from source.
- `npm run build`, `npm run check` and `npm test` passed.
- Browser regressions passed in Brave and Microsoft Edge against source and generated previews.
- Checks included native mouse/touch movement, styling page turns, both page views and sidebar combinations, swaps/history, copying, backups, notification timing/dismissal, icon alignment and responsive bounds.
- Desktop and phone-size screenshots were visually reviewed.

## Remaining release and integration work

Physical mobile devices, Safari and Firefox still need manual compatibility testing. This frontend milestone does not certify those environments.

The catalogue contains 55 sample printings; displayed prices are fictional interface examples. Saves are explicit and browser-local, with no automatic recovery draft or cloud synchronization.

Authentication/backend integration, cloud storage, live catalogue/pricing, public sharing, print/image export and deployment remain separate work. Nothing was deployed as part of accepting this milestone.

## Version-control status

The project was not a Git repository at acceptance. This milestone is recorded in documentation; no Git commit or tag was created. When Git is initialized, this identifier can be used to label the accepted baseline.
