# Website idea, goals and functions

## Purpose
Pokedex helps Pokémon collectors arrange attractive digital binders, customize covers and card protection, discover printings, and track physical cards. The product should feel personal and creative, with clear card information rather than a financial dashboard.

## Priorities
1. Make binder design visually appealing and easy to understand.
2. Preserve artwork proportions, even spacing and clear interaction states.
3. Keep physical ownership separate from digital arrangements.
4. Make Save, destructive actions, scope and sample/live data distinctions explicit.
5. Finish frontend flows before integrating accounts, providers and cloud storage.

## Current frontend
| Area | Implemented prototype behavior |
| --- | --- |
| Binder management | Create, rename, duplicate and delete; explicit browser-local persistence |
| Arrangement | Per-page grids, drag/click placement, connected merges, overflow, page order/duplication, Undo/Redo |
| Customization | Ball presets/custom cover artwork and titles; sleeves/toploaders with independent scopes; pocket artwork/placeholders |
| Viewing | Clean cover/page preview and pocket inspection/zoom |
| Discover | 55 English sample printings across six sets; search/filters, curated color ranking, image zoom, related printings |
| Inventory | Shared physical collection with Owned/Wanted, quantities, condition, grades, notes, chase and trade status |
| Prices | Labeled fictional raw/graded USD interface examples; no live provider |
| Portability | Validated binder/inventory JSON download/import |
| Theme | Light/Dark/System preference |

The Landing illustrates intended outcomes; its creation links connect to Workspace. Editor changes save only when the user clicks Save. There is no automatic draft recovery or cloud account. Replacing/merging/removing pockets preserves displaced items in Overflow; ownership records are unaffected. Cards are not automatically pushed along.

## Future product work
Real authentication and cloud persistence, full catalogue/provider integrations, condition/graded market pricing, set-completion checklists, unlisted view-only sharing, reporting, image/PDF/physical-print exports, mobile editing refinements and operational controls remain future work. Sharing is private by default with optional unlisted links under the confirmed plan; no searchable public gallery is required for beta.

## Product tone
Minimal, polished and approachable. Keep card artwork prominent, controls recognizable and secondary options contextual. Use Manrope and the shared design system across pages. Larger landing display headings serve marketing; equivalent app titles, panels, labels and controls share sizes.

## Where to find details
[DESIGN.md](DESIGN.md) contains accepted product decisions and deferred questions. [ARCHITECTURE.md](ARCHITECTURE.md) describes future backend responsibilities. [HANDOFF.md](HANDOFF.md) is the current code/behavior reference; [HISTORY.md](HISTORY.md) preserves previous implementation milestones.
