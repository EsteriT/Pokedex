# Binder Minder: Monday beta roadmap

Planned 24 October 2026. Target: Monday 26 October 2026, Asia/Saigon.
This is a proposed delivery plan, not a completion report or authorization to deploy.

## Release promise

Build a personalized Pokemon binder from an English set, arrange its pages, save it privately, and return to it later.

Monday is a focused public beta if the release checks pass. It is not a full marketplace, a master-set completeness claim, or evidence of commercial demand. Start with a small collector group and expand after observing real use.

## Verified starting point

- Existing product: Google sign-in, private cloud binders and Owned/Wanted collections, manual Save, portable backups/recovery, editing/customization, and an owner-only read-only viewer.
- Production baseline recorded in the project: ten English catalogue groups / 1,291 printings. This roadmap does not freshly verify the deployed service.
- Current uncommitted branch: `feat/binder-set-insertion`; expanded Discover controls and full-English preparation are local.
- Local catalogue: 201 populated English physical-TCG groups / 21,256 printings. Provider gaps include 228 unavailable records, 1,590 missing image URLs and 55 missing group logos. Groups include promos/kits/galleries; they are not all regular expansions.
- Whole-set binder insertion, integrated set-progress views, public binder links, and image/PDF export are not implemented.
- Existing binder limit is 30 pages. A 3 x 3 binder holds at most 270 ordinary pockets; set generation must check the actual layout and capacity.
- Local search/recovery/security checks passed within their documented boundaries. Hosted full-catalogue acceptance, physical-device checks and broader load acceptance remain outstanding.
- Landing copy still says account saves come later and contains planned/demo features. This must match the actual release before promotion.

## Priority 0: required for this release

| Order | Work | Completion condition |
| --- | --- | --- |
| 1 | Fix the exact release scope and record a baseline; investigate fallback coverage | Preserve existing uncommitted work; identify the reviewed code, catalogue snapshot, migrations and rollback. Inventory missing records/images/logos and run a bounded fallback pilot before making completeness claims. No new framework or infrastructure rewrite. |
| 2 | Complete set-to-binder creation | Choose an English set, review available cards and coverage, pick a supported layout, preview card/page counts, create a new binder and open it in the editor. |
| 3 | Finish the first-use journey | Landing -> Discover a set -> create binder -> edit -> Save -> Workspace -> reopen works without instructions. Empty states offer one clear next action. |
| 4 | Make saving dependable and clear | Visible unsaved/saving/saved/failed states, duplicate-submit protection, existing conflict recovery, navigation warnings, retry and portable backup. Do not label manual saving as autosave. |
| 5 | Ship the catalogue and existing search work safely | Compatibility frontend precedes hosted catalogue expansion; approved migrations/import and deployed gateway checks pass. Missing records/images remain explicit. |
| 6 | Polish all five pages consistently | Shared controls, spacing, typography, loading/error/empty states, keyboard focus, mobile bounds and truthful action labels. Preserve the approved design. |
| 7 | Make the public presentation accurate | Working CTAs, current screenshots, honest supported/unsupported feature claims, factual privacy/terms and contact/feedback route. Hide fictional prices from the real collecting workflow. |
| 8 | Pass release acceptance | Save/reopen/recovery and account isolation pass; no known data-loss or core-path blockers; actual phone and bounded hosted checks are recorded. |

### New function: Create binder from set

- Discover Sets: reveal **Create binder** on the selected set/detail surface; keep ordinary set browsing uncluttered. Provide the same action beside the active single-set result heading.
- One compact dialog: set identity, available-card count, layout and a preview such as **207 cards / 23 pages**. The numbers must be computed, not hardcoded.
- Monday scope: one catalogue printing per slot, collector-number order, including supplied secret-number cards. Do not call this a master set; reverse/holo/edition duplication is deferred.
- Default creates a new binder. Existing binder replacement, inserting into occupied pockets and automatic multi-binder splitting are deferred.
- Fetch the entire selected set through bounded existing search pages. Validate exact set membership, distinct IDs, expected count and stable order before committing anything. A failure offers retry and creates no partial binder.
- Keep valid card records without artwork as labeled card slots. Report absent provider records separately; do not invent their identities or empty placeholder numbers.
- Check 30-page capacity and account binder quota before commit. If needed, offer a supported larger grid; if none fits, explain the limit and stop without silently discarding cards or sending a partial set to Overflow.
- Preserve catalogue language, printing IDs and supported finishes. Placing a card never marks it Owned or Wanted.
- Reuse the existing binder creation/repository, validation, customization and manual-Save conventions. Make the first Save requirement explicit; do not imply an unsaved draft is stored in the account. Repeated clicks cannot create duplicate binders.
- Acceptance: small set, set spanning search pages, secret/punctuation numbers, missing artwork, partial provider coverage, quota/capacity failure, request failure/retry, cancellation, double click, Save/reopen and backup/restore.

### Polish by surface

| Surface | Changes to prioritize |
| --- | --- |
| Landing | One direct explanation and Create binder CTA; working product screenshots; supported catalogue/language scope; remove stale cloud-save wording and misleading demo-price/value claims; keep future features out of the main sales pitch. |
| Discover Cards | Retain approved combined search and multi-select controls; consistent selected states, counts and Clear all; no unresponsive controls without explanation; stable loading layout; useful no-results/retry states; card details have clear collection/binder actions. Color remains explicitly sample-only. |
| Discover Sets | Consistent logo containment/name fallbacks, available counts and partial-data notes; set browsing and create action are distinct; generated binder preview is easy to understand. |
| Workspace | Clear New binder and existing binder actions; distinguish samples from personal binders; concise empty state; visible save/storage context; reliable rename/delete/backup flows and return from editor. |
| Editor | Find Add cards, Customize, Pages, Undo and Save without opening Help; check menus/panels/toolbars at small sizes; preserve drag-and-drop and provide tap-to-place; content-affecting layout changes stay clear and undoable. |
| Collection | Keep existing Owned/Wanted records and quantity/finish editing coherent; clarify Save collection; adding a planned binder never changes collection ownership; no false set-completion totals. |
| Viewer | Call the existing feature Preview/View; verify saved layout, artwork and page navigation; do not present an owner-only URL as a public share link. |
| Shared | Use existing spacing tokens and a consistent 8/12/16/24px rhythm where appropriate, consistent headings/buttons/radii, 44px primary touch targets, labeled icon tooltips, visible focus, contrast and reduced motion. Keep artwork untinted. |

### Saving and failure handling

- Distinguish browser-local drafts from cloud account saves wherever relevant.
- Check leaving/back/reload with unsaved changes, failed saves, lost connection, expired sign-in and a second tab changing the same binder.
- Preserve edits during a failed save; retry must not duplicate content. No silent conflict overwrite.
- Keep binder and collection save contexts unambiguous; do not introduce account-wide autosave this weekend.
- Existing backups must still restore the newly generated set binder, including custom styles/artwork when added later.

## Priority 1: only after Priority 0 passes

These are ordered options, not all promised for Monday. Freeze new feature work Sunday afternoon.

1. **Set progress connected to the saved collection.** Derive Owned/Missing from exact printing identity and the selected scope, counting unique printings rather than copies. Show a small count/progress indicator, Owned/Missing filters and reuse existing collection editing. Placement is not ownership; missing catalogue records are not a complete checklist. Defer this if finish rules or saving behavior cannot be made unambiguous.
2. **Append a set to a binder.** Reuse set planning but add fresh pages only, confirm page/capacity effects and make the whole action undoable. Never overwrite existing content. This comes after reliable new-binder generation.
3. **One-page image export.** Only if artwork origin/CORS and downloadable output can be verified in real browsers. No dead Download buttons; full PDF/printing stays later.

If Priority 0 slips, cut all Priority 1 work first. Do not compress data-preservation or hosted acceptance to meet a feature count.

## Deferred until after launch

- Marketplace listings, affiliate integrations, live prices and payments/subscriptions.
- Additional languages, Pocket, and a claim to every historical printing.
- Comprehensive automated multi-provider image/logo ingestion. The bounded coverage investigation happens now; see [the audit](CATALOGUE-FALLBACK-AUDIT.md). Integrate a limited fallback before Monday only if mapping, image quality, permissions and compatibility are verified; otherwise keep clear placeholders and coverage notices.
- Full master-set variants, customizable reserved missing-card slots and automatic set-refresh reconciliation.
- Public sharing, profiles, social feeds, likes, template marketplace and collaborative editing.
- Full PDF/print output, scanning/OCR, advanced analytics, automatic cloud saving/realtime collaboration, new customization systems and broad backend rewrites.

## Work sequence and calendar

| Date | Focus | Exit condition |
| --- | --- | --- |
| Saturday 24 October | Preserve/review the current branch; implement set generation, preview, capacity handling and repository integration; test the complete creation path. | A supported set becomes a complete editable binder and survives Save/reopen without changing collection ownership. |
| Sunday 25 October, morning | First-use journey; saving/error states; mobile controls; landing accuracy; release copy and factual policy/contact content. | A new collector can complete the primary journey without coaching. |
| Sunday, afternoon | Feature freeze; model/database checks and focused browser acceptance; actual phone check; prepare reviewed deployment package and fresh backup/rollback plan. | No new functionality; fix release blockers. Priority 1 only if it was already complete and tested before freeze. |
| Monday 26 October, morning | After explicit release authorization, staged publication/catalogue rollout and fresh hosted acceptance. | Verify the actual public routes, catalogue, sign-in, private Save/reopen and recovery. |
| Monday, after acceptance | Invite 5-10 collectors through owner-approved channels, provide a short demo and feedback route; watch for blockers. | Record real task outcomes and failures. Broaden promotion only after first users succeed. |

Dates are targets, not a guarantee. If the primary path or hosted saving fails, keep the release private and fix it rather than advertise a broken beta. If Google publication or policy setup blocks new-account access, Monday remains an invited test until that dependency is resolved.

## Release acceptance checklist

- [ ] New visitor can understand the product and create a set binder without coaching.
- [ ] Multi-page set creation preserves exact printing IDs, stable collector order, actual available counts and save/backup compatibility.
- [ ] Quota, capacity and provider failures leave existing binders/collections untouched; retry and cancellation are safe.
- [ ] Hosted search/filter controls match the deployed capabilities and full catalogue; no first-page-only insertion.
- [ ] Google sign-in, Save/reopen, sign-out, expired session, two-tab conflict and private-data isolation pass using disposable test accounts.
- [ ] Binder/account backup and restore pass; fresh operator backup is verified before hosted data changes.
- [ ] Desktop Chromium, actual phone and keyboard checks pass; target Safari/iOS or Firefox where available and record any untested browser honestly.
- [ ] 320/375/390px phone layouts, desktop, zoom, short landscape, themes and reduced motion keep controls reachable.
- [ ] A defined small hosted test, initially up to ten concurrent test sessions with bounded actions, checks search and saving through the real gateway. It is a beta-capacity check, not an unlimited-user claim. Set timing/error expectations before the run and stop if throttling or data integrity is wrong.
- [ ] No known core-path data-loss/security issue, unhandled runtime exception, stuck dialog or horizontal scrolling.
- [ ] No fictional live prices, unsupported full-catalogue color claim, public-sharing claim or inaccurate cloud-storage statement in release marketing.
- [ ] Privacy/terms/contact are published and factual; Google new-account access/publication state is checked. Real owner/contact details must be supplied by the owner, never invented.
- [ ] Reviewed build, migrations, catalogue snapshot, compatibility order, rollback and owner release authorization are recorded.

## Marketing and evidence after release

- Working positioning: **Plan your Pokemon binder, your way.** Show set -> generated pages -> customization -> Save in a short real demo.
- Monday marketing package: current desktop/mobile screenshots, a 20-30 second demonstration, short feature list, beta limitations and a clear feedback link. Do not claim superior speed or completeness without evidence.
- Keep Binder Minder's working identity for this release; no disruptive rebrand/domain migration before sign-in redirects are verified.
- Start free beta access. Monetization and affiliate work wait until the core workflow earns repeat use.
- For the first 5-10 collectors, record whether they finish creation, save successfully, understand ownership versus placement, encounter errors and return to update their binder. Use consented feedback and aggregate operational data; never log binder contents, email addresses, tokens or search text as generic telemetry.
- First week: repair observed blockers and missing-data priorities. Next: validate collection-linked progress and export/sharing demand with returning users. Then choose one proven differentiator and evaluate monetization.
- Do not call a signup count product-market fit. Returning use and willingness to recommend/pay require separate evidence.

## References

- [Current catalogue evidence and release boundary](FULL-ENGLISH-CATALOGUE.md)
- [Design decisions](DESIGN.md)
- [Current implementation handoff](HANDOFF.md)
- [Load-calibration limitations](USAGE-LOAD-ACCEPTANCE.md)
- [Capacity and cost model](CAPACITY-AND-COST.md)
- [Hosted rollout](HOSTED-ROLLOUT.md)
- [Account data and recovery](ACCOUNT-DATA-AND-RECOVERY.md)
