# Pokedex architecture — working draft

The 2026-10-18 account collection implementation on `feat/collection-cloud` is documented in [COLLECTION-CLOUD.md](COLLECTION-CLOUD.md). It adds a shared collection adapter, owner-scoped snapshot/revision storage and explicit browser import. It is tested locally; its approved hosted migration and website update are live, with actual hosted collection UI acceptance pending. The accepted hosted binder rollout remains recorded in [HOSTED-ROLLOUT.md](HOSTED-ROLLOUT.md). Older browser-local-only collection descriptions below describe the prototype baseline.

Current frontend behavior and file ownership are documented in [HANDOFF.md](HANDOFF.md). The 2026-10-17 binder backend implementation is documented in [BACKEND-FOUNDATION.md](BACKEND-FOUNDATION.md), including passing local service/browser tests and the remaining hosted deployment gates. Older proposals below are historical where they conflict with that contract. [HISTORY.md](HISTORY.md) records superseded prototype iterations.

Updated: 2026-10-12. Companion: [DESIGN.md](DESIGN.md). This document plans responsibilities, data, and integration. It is not permission to build a backend or deploy.

## Plain-language overview

The **frontend** is the interface in the browser. The **backend** is the service that checks permissions, validates changes, stores data, and accesses providers when server credentials are needed. The **database** stores structured records. **Object storage** stores uploaded/exported files. An **API contract** specifies messages passed between frontend and backend. **Authentication** identifies someone; **authorization** determines what they may access.

Current implementation: five plain HTML/CSS/JavaScript pages with a working binder editor, browser-local collection, sample catalogue, and an optional private binder backend. Google sign-in, PostgreSQL document storage and private artwork Storage are implemented and tested locally. Hosted cloud rollout is pending approval. The preview build bundles the pinned browser SDK; unconfigured builds preserve browser-local saving. Existing landing demos remain separate from the persistent editor model.

## Decision status and guardrails

Confirmed: frontend designs come first; backend planning occurs alongside them; real integration comes later. Confirmed Round 1: Supabase database; account required before binder creation; desktop-first editing; small friends-testing group; zero monthly budget; broad first-release scope recorded in DESIGN.md. Backend language/framework, final hosting, authentication methods, limits, and detailed domain rules remain Open. Do not introduce a framework, provider account, production key, deployment, or new infrastructure under this specification task.

Recommended initial architecture: a small modular application with one backend and one database if cloud saving is approved. Separate responsibilities within that application; do not start with microservices. This is a recommendation conditional on expected users and operating budget, not a universal standard.

Preserve the current frontend stack during design. Later evaluate whether plain JavaScript modules remain manageable for the real editor before choosing a framework. Every framework choice should solve a demonstrated development need.

## Proposed responsibility map

| Component                 | Owns                                                                                                  | Must not own                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Frontend shell/pages      | Navigation, layouts, accessible controls, theme, state rendering                                      | Secrets or authoritative authorization                        |
| Editor state and commands | Draft document, selections, move/swap/merge rules, undo history, dirty state                          | Treating rendered HTML as the binder's saved format           |
| Data adapter              | Catalogue/binder/inventory requests through a stable interface                                        | Provider-specific logic spread across UI widgets              |
| Backend/API               | Validation, access checks, saving, revisions, public projections, provider requests requiring secrets | Trusting client ownership/user IDs without verification       |
| Database                  | Users, binders, page/pocket data, inventory, sharing metadata                                         | Uploaded binary images inside normal record fields by default |
| File storage, if needed   | User images and export artifacts with controlled access                                               | Public exposure of private assets by default                  |
| External providers        | Catalogue metadata, image URLs, optional price data                                                   | Serving as the only copy of the user's binder/ownership data  |

Proposed flow: Browser → application API → database/storage and external-provider adapters. Public card images may load directly from an approved image host. Public catalogue calls may be browser-direct if provider terms, CORS, quotas, and caching support it; secret-bearing calls must be server-side. Choosing TCGdex does not by itself mean an API key is required. Verify each chosen provider's current documentation before implementation.

## Frontend integration boundary

Define data-shaped interfaces before wiring real services, for example listBinders, getBinder, createBinder, saveBinder, searchCards, getCardDetails, getInventory, updateInventory, and publish/revoke operations if selected for launch.

During design, use a mock adapter with the same responses and failure states that the real API will produce. Mark mock persistence and sample prices honestly. Switching to the real adapter should not require rewriting page layouts.

Separate editor commands from rendering. A command changes the draft model, validates its effect, and contributes to undo history; rendering reflects the model. Timers and autoplay from the landing page are not production editing commands.

## Proposed data model

Exact schemas remain Open until inventory, layout, and sharing rules are answered. Use stable opaque IDs; collector numbers and names alone are not globally unique.

| Entity               | Proposed fields/relationships                                                                                   | Design question                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| User                 | ID, auth-provider reference, display preferences, timestamps                                                    | Account/guest model                                                                                          |
| Binder               | ID, owner ID, name, default layout, customization, revision, timestamps                                         | Layout per binder or per page; limits                                                                        |
| Page                 | ID, binder ID, explicit order, independent rows/columns and customization                                       | One starting page; user adds manually; maximum 30 per binder                                                 |
| Pocket region        | Stable ID, page ID, selected connected cell coordinates, content reference/style                                | Occupied merging moves all content to overflow; merged region starts empty                                   |
| Card reference       | Provider, provider ID, set ID, collector number, language, printing/variant identity                            | Catalogue and variant coverage                                                                               |
| Placement            | Stable placement ID, typed card/artwork/placeholder content, region reference                                   | Replacement sends prior content to overflow; no text content or automatic push/swap                          |
| Overflow entry       | Binder ID, placement ID/content and style, display order, optional source-page label                            | Saved as binder state; clearing removes placements only, with count confirmation and Undo                    |
| Inventory entry      | Owner ID, exact printing identity, condition (including Unknown), quantity; optional grading/notes/trade detail | Confirmed shared inventory grouped by printing and condition; graded groups also need company/grade identity |
| Wanted entry         | Owner ID, card/printing identity, chase-card designation; optional desired quantity                             | Extra Wanted copies may coexist with owned quantities; chase designation supported                           |
| Completion checklist | Owner ID, name, explicitly selected targets, target matching rules                                              | Editable card-number/printing presets and individual targets; detailed quantity matching still Open          |
| Share publication    | Binder ID, private/unlisted mode, opaque public token, revocation state                                         | View-only without account; latest saved layout/card details only; no searchable gallery                      |
| Asset                | Owner ID, storage reference, media type/size, dimensions                                                        | User-upload approval and limits                                                                              |

Binder layout and physical inventory must be independent records. Removing a digital placement should not silently delete physical ownership. Duplicate/reused card references should remain stable if a provider changes a name or URL.

Validate row/column range 1–6, page order, region boundaries, overlap, connectivity for merges, content types, string limits, and quantity rules. A merge occupies each covered cell exactly once. Layout reduction must resolve displaced content explicitly, according to the user's selected rule.

## Suggested API contract — illustrative, not implemented

| Operation        | Example                                                | Important behavior                                          |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| List binders     | GET /api/binders?cursor=…                              | Returns only accessible summaries; pagination               |
| Create binder    | POST /api/binders                                      | Validated layout and name; safe retry handling              |
| Read binder      | GET /api/binders/{id}                                  | Permission check; document and current revision             |
| Save draft       | PUT /api/binders/{id}                                  | Validate complete document; require expected revision       |
| Search catalogue | GET /api/cards?query=…&set=…&language=…                | Stable IDs, explicit filters, pagination, result limits     |
| Update inventory | PATCH /api/inventory/{id}                              | Permission and quantity validation; defined retry semantics |
| Publish/revoke   | POST /api/binders/{id}/publication; DELETE publication | Explicit access change; public field allowlist              |
| Read publication | GET /api/public/binders/{publicId}                     | Read-only sanitized response; revoked/unavailable state     |

The complete-document save is a simpler starting option. Evaluate command/delta saving only if payload size, concurrent editing, or scale requires it. Decide which API changes are atomic and how undo interacts with already-saved changes.

Contract should specify request/response examples, nullable fields, time formats, versioning, validation errors, pagination, caching, and permissions before integration. A structured error should include a stable code, safe message, optional field errors, and whether retry is appropriate. Avoid leaking internal traces or secrets.

## Saving, reliability, and conflicts

Confirmed: edits update an in-memory draft immediately, but cloud persistence occurs only when the user requests Manual Save. Dirty-state and leave warnings are required. Do not introduce cloud autosave or save on pointer movements. A successful response includes the new revision. Reload confirms persisted data, not just the local draft.

Protect against delayed responses overwriting newer state. Each save carries its expected revision; reject stale revisions and offer reload, duplicate, or merge behavior rather than silently replacing newer work. Full collaborative editing is Deferred unless requested.

Retries must not duplicate binders, increments, or exports. Use idempotency keys or absolute-value writes where appropriate; define the contract rather than assuming every request is safe to repeat.

Device-local recovery, if selected, should use suitable browser storage for structured drafts and show its limitations. Full offline synchronization includes queued edits, reconnect, conflicts, limits, and recovery; it is a separate feature. Never describe localStorage as a secure secret store or a durable cloud backup.

Database backups, restore testing, retention, and acceptable loss/outage targets must be chosen before public launch. Undo is not a backup. Saving from a second tab/device needs a conflict test even without collaboration.

## Accounts, privacy, and security baseline

An account-based service is confirmed for first release:

- Recommend established authentication/session tooling rather than custom password storage. Choose sign-in and recovery flows based on user needs. Sessions need secure handling, expiry, and logout; cookie-based writes need an appropriate CSRF defense. Verify provider-specific details at implementation time.
- Every resource operation must check authorization server-side, including binders, pages, inventory, uploads, exports, and sharing. Hiding a button is not access control. User-supplied owner IDs are not proof of ownership.
- Keep private collections private by default as a proposed product rule. Separate authenticated owner responses from public responses using an explicit permitted-field list. Unguessable identifiers supplement, not replace, permission checks.
- Keep secret API credentials on the server in environment/secret management; never in HTML, browser JavaScript, source control, or URL query strings. Browser-visible keys may be used only when the provider explicitly designs them as public and restrictions fit their purpose.
- Validate inputs, parameterize database operations, encode untrusted text, restrict supported uploads, and serve uploaded content safely. If a feature fetches arbitrary URLs on the server, enforce destination restrictions to avoid server-side request forgery.
- Apply reasonable request/upload/export limits and abuse controls. Sanitize logs; record operational errors and relevant access changes without unnecessarily collecting private binder content or credentials.
- Provide understandable data export and account/data deletion if accounts launch. Confirm retention and deletion expectations, including assets, published content, and backups, before promising immediate removal everywhere.

These are design/implementation baselines, not a completed security or legal compliance audit. Policy and legal requirements depend on actual audience and jurisdiction and must be assessed when those details are known.

## Provider integrations, artwork, and pricing

Before choosing a provider, verify supported languages/sets/variants, attribution and permitted usage, authentication needs, CORS, quotas, rate limits, service availability, and caching rights. Avoid embedding assumed limits or prices in this document.

Catalogue adapter should map provider records into the application's stable card references. Cache permitted metadata appropriately, bound search requests, and handle unavailable records without corrupting binder references. Remote image failures remain Deferred by the user's current instruction; this does not remove the eventual need to handle provider/network failures before launch.

User images and canvas exports have different requirements from simply displaying remote cards. Verify image-host CORS and reuse rights before promising downloadable renders. API keys alone do not resolve browser canvas restrictions. Printing requires accurate output dimensions and calibration, not just a screenshot.

If live values launch: store/show provider, currency, relevant printing/condition, retrieval timestamp, and unavailable/stale state. Do not equate missing price to zero; do not present illustrative totals as real market values. Currency conversion needs a dated source if offered.

## Environments and development workflow

Current design workflow: edit src/index.html/styles/scripts; use VS Code Live Server on src/index.html for direct source updates; run the build to regenerate preview/Pokedex-landing-page.html. The generated preview is never edited directly. Opening the preview file directly is also supported.

When application pages are approved, document actual routes/build entry points. Do not assume the current single-entry preview builder automatically supports several independently built pages.

Later backend integration should separate local development, a test/staging environment, and production. Use test data and separate credentials. Production deployment still requires an explicit request under project instructions. Database migrations need a rollback/recovery plan and should not run casually against production.

Supabase is selected for the database. No final hosting vendor or backend runtime is selected yet; Vercel is the user's candidate. Decide within the user's budget, expected traffic, need for uploaded images/exports, operational experience, and region requirements. Prefer the smallest service set that meets those needs.

## Verification and release gates

| Area            | Required evidence before related feature launches                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Design baseline | Primary task flows work at target viewports; keyboard/tap alternatives; errors and loading states; accessibility review        |
| Editor          | Moves/swaps/merges/undo preserve data; all grid sizes; layout overflow rules; realistic large binders                          |
| Persistence     | Save/reopen equality; failed save recovery; retry without duplication; two-tab/device conflict handling                        |
| Authorization   | Another user cannot read/change owner-only data by changing IDs; public response excludes private fields; revocation works     |
| Catalogue       | Exact-printing identity, pagination, provider failure, search cancellation/race handling, representative languages             |
| Inventory       | No negative quantities; duplicates/completion match approved rules; binder edits do not change physical ownership              |
| Upload/export   | Accepted/rejected file limits, restricted access, supported image hosts, export failure recovery, print dimensions if included |
| Operations      | Backup restore demonstrated; safe logs; basic error monitoring; chosen limits/budget; deletion/export behavior documented      |

Set measurable performance budgets after Q06/Q21: expected binder size, search latency, image loading behavior, target devices, and acceptable save delay. Do not invent capacity guarantees before measuring realistic scenarios.

## Backend interview — answers required before affected decisions

Round 1 Q01–Q05 has been answered and recorded in DESIGN.md. These later questions can be answered gradually; they do not require the user to choose technologies without explanation.

### Round 5 — accounts, operating expectations, and recovery (answered; backup targets remain Open)

| ID  | Question in plain language                                                                                                       | Why it matters / starting recommendation                                                                                                                                                                               | Status                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Q21 | Approximately how many users and how many large binders do you expect initially? What should an unusually large binder support?  | Initial testing: approximately 5–10 friends. Each account may have three binders initially; each binder has at most 30 pages. No Trash: confirmed permanent deletion releases a binder slot after successful deletion. | Confirmed                                              |
| Q22 | If accounts are included, which sign-in methods feel appropriate: email/password, email sign-in link, Google, or something else? | Google sign-in first. Email/password later. Supabase Auth remains recommended tooling, not yet provisioned.                                                                                                            | Confirmed                                              |
| Q23 | Should changes sync across devices immediately? Can two devices edit the same binder, or is simple conflict detection enough?    | Detect conflicting Manual Saves; offer Reload or Save as a copy. Never silently overwrite another saved revision. Protect unsaved draft before Reload; copy must respect binder quota.                                 | Confirmed                                              |
| Q24 | If something goes wrong, how much recently saved work could you accept losing, and how long could the service be unavailable?    | Manual Save only. No automatic device-local recovery drafts. Unsaved changes can be lost on reload/crash; warn appropriately. Backup cadence and acceptable saved-data loss/outage remain undecided.                   | Saving/recovery confirmed; backend backup targets Open |
| Q25 | What data should users be able to export or delete, and do you need a reversible trash/recovery period?                          | Immediate permanent binder deletion after confirmation; no Trash. Provide structured data download and permanent account deletion with reauthentication/confirmation. Backup/file-retention policy still to define.    | Confirmed; deletion-retention details Open             |

### Round 6 — providers, files, public content, and operations (answered; research recorded)

| ID  | Question in plain language                                                                                               | Why it matters                                                                                                                                                                   | Status                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Q26 | Do you already have provider access or accounts for card data, images, or prices? Name them without sending secret keys. | No providers/accounts selected. User requests research of free options. TCGdex catalogue plus PokemonPriceTracker pricing is proposed, not connected or tested with credentials. | Research authorized; providers proposed     |
| Q27 | Will users upload artwork and make it public? If so, should there be reporting/removal tools?                            | Included uploaded artwork appears in unlisted views; provide a simple reporting route so owner/maintainer can investigate and revoke inappropriate sharing.                      | Confirmed                                   |
| Q28 | What country/region is the main audience, what interface languages are needed, and is the service intended for children? | English interface. Intended users approximately ages 20–30. Tester countries/regions not provided.                                                                               | Language/audience confirmed; geography Open |
| Q29 | Is the service free initially, or are subscriptions/payments planned? Is community discovery part of the first release?  | Free beta; subscriptions/payments intended later. No billing implementation or searchable community gallery in current beta scope.                                               | Confirmed                                   |
| Q30 | Who will maintain the service and respond to failures, and are there existing hosting/domain/provider commitments?       | User maintains alone with assistant guidance. No domain, Supabase account, or Vercel account. User requests a minimal page map.                                                  | Confirmed; map proposed                     |

## Decision log

| Decision                                      | Status              | Record                                                                                                              |
| --------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Design frontend before backend implementation | Confirmed           | User's chosen workflow; plan interfaces concurrently                                                                |
| Usability and user experience first           | Confirmed           | User instruction on 2026-10-12                                                                                      |
| Preserve current landing-page design          | Confirmed           | Existing project instructions                                                                                       |
| Image-failure handling                        | Deferred            | User postpones item 4; eventual data/image provider to be chosen                                                    |
| Launch audience/features/devices              | Confirmed           | Pokémon collectors; creative layouts plus physical inventory; desktop-first; all Q04 features included              |
| Current page map                              | Accepted, revisable | Landing, Workspace tabs, Binder editor, Discover with price details, Unlisted viewer; refine during frontend design |
| Account before creation                       | Confirmed           | No guest creation; sign-in method remains Open                                                                      |
| Save trigger                                  | Confirmed           | Manual Save; unsaved-change warnings; no cloud autosave                                                             |
| Sign-in                                       | Confirmed           | Google first; email/password later                                                                                  |
| Local recovery                                | Confirmed excluded  | No automatic device-local recovery drafts; Manual Save only                                                         |
| Binder deletion                               | Confirmed           | Immediate permanent deletion after confirmation; no Trash                                                           |
| Data portability/account deletion             | Confirmed           | Structured download and reauthenticated permanent account deletion                                                  |
| Backend backup/retention targets              | Open                | Cadence, restore process, and acceptable saved-data loss/outage still undecided                                     |
| Page limits/layouts                           | Confirmed           | One starting page; up to 30 manually added pages; independent layouts                                               |
| Replacement/merge/overflow                    | Confirmed           | No push; replacement/occupied merging displaces content to overflow; clear confirms count and supports Undo         |
| Database                                      | Confirmed           | Supabase; no project provisioned by this planning task                                                              |
| Budget and early rollout                      | Confirmed           | $0 monthly target; friends testing first                                                                            |
| Backend, hosting, and frontend framework      | Open                | Vercel candidate; explain tradeoffs and verify budget/terms before choosing                                         |
| Light palette                                 | Confirmed unchanged | Keep current cool palette; visual refinements later                                                                 |
| Production integration/deployment             | Not authorized      | Documentation task only                                                                                             |

## Reference guidance

- [OWASP API1:2023 — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) — check permissions for each resource operation.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) — transport, access control, validation, credentials, and safe errors.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — frontend accessibility requirements supporting the user flows.
- [TCGdex](https://tcgdex.dev/) — potential catalogue provider; verify current implementation requirements before integration.

## Supabase and zero-budget testing plan — recommendation after Round 1

Confirmed: use Supabase as the database. Recommend evaluating Supabase Auth for sign-in and Storage only if uploads require it; these additional components are not yet chosen. Browser access to Supabase should use its public/publishable client configuration and a user session, protected by Row Level Security (RLS: database rules that constrain which user's rows a request can access). Secret/service-role keys must never enter the browser. Test policies as different users, not just with administrator access.

The earlier custom API routes are illustrative contracts, not a requirement to implement a separate server for every database operation. Supabase's APIs and database policies can provide ordinary private reads/writes. Atomic editor operations, privileged tasks, provider credentials, and heavier integrations may need database functions or server/edge functions. Choose one clear place per responsibility; avoid duplicating the same backend across platforms without a need.

Proposed flows: browser → Supabase Auth and RLS-protected database APIs for owner data; browser → validated application/edge endpoint for secret-bearing provider requests and approved public projections; card images → approved provider host. Public catalogue requests may be direct only if current provider usage/CORS rules permit. Saving public data still needs explicit field and access rules.

As checked on 2026-10-12, Supabase Free lists 500 MB database storage, 1 GB file storage, and 5 GB egress; free projects may pause after one week of inactivity and automatic database backups are not included. These are current plan facts, not lifetime guarantees. Start with references to provider card IDs/image URLs rather than uploading the catalogue's artwork to Supabase. Limit user uploads, cache permitted metadata/pricing conservatively, generate exports locally where feasible, monitor quotas, and define manual backup/restore during the beta.

Account-email dependency: Supabase's default email sender is restricted to project-team addresses and is not suitable for arbitrary friends signing up. If email confirmation/recovery is selected, configure a suitable custom SMTP sender within budget, or evaluate an approved OAuth sign-in path. Choose the method before invitations; do not silently disable account security to work around email limits.

Vercel Hobby is a candidate for qualifying personal/non-commercial testing, subject to its current usage limits and terms. Final eligibility and hosting remain Open, especially if monetization is planned. Do not treat a small user count alone as proof that a project qualifies or stays free.

Price data feasibility: catalogue/image APIs and market-price APIs have different coverage. The Pokémon TCG API documents printing-specific market/low/high price fields; that alone does not establish a condition-specific market feed. TCGdex exposes pricing data as well, but confirm exact condition/variant coverage and source mapping before selecting it. Preserve the user's condition-aware price-checker requirement as a release gate, not an assumed provider feature. If coverage is missing, surface unavailable data or an explicitly agreed estimate—never silently fabricate a price. Currency/market/condition categories are questions for Round 3.

### Current verification sources

- [Supabase pricing](https://supabase.com/pricing) — free-plan limits, inactivity pausing, and backup limitations.
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — safe database access policies.
- [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp) — restrictions on the default sender and custom SMTP.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) — plan eligibility and limitations.
- [Pokémon TCG API card object](https://docs.pokemontcg.io/api-reference/cards/card-object/) — documented pricing fields.
- [TCGdex card reference](https://tcgdex.dev/reference/card) — catalogue and price field coverage to evaluate.

## Editor data and persistence decisions — Round 2

Manual Save must commit the complete binder draft consistently: page order and independent layouts, pocket/merge geometry, content references/styles, and overflow entries. Local unsaved operations are not individually persisted to the cloud. Define atomic saving and expected revision handling before integration. Pending save responses must not mark newer, subsequently edited content as saved; track the saved draft revision separately from current edits.

Enforce the 30-page maximum server-side/database-side as well as in the UI. Creating a binder atomically creates one initial page. Parallel Add page requests must not bypass the cap. Confirm final-page deletion behavior before schema constraints are finalized.

Define Replace and Merge as editor commands with inverse operations for Undo. Replace preserves the displaced placement in overflow and removes the moving placement from its original region when applicable. Copy creates a new independent placement. Merge transfers every affected placement to overflow and records previous geometry/content for Undo. No pushing. Stable placement IDs and content/style references avoid losing artwork or printing choices while moving between a page and overflow.

Empty overflow is one undoable command over a known set of entries, with affected-count confirmation in the UI. Avoid a silent FIFO cap that drops older entries. An overflow capacity/performance limit has not been chosen; preserve content and warn if an explicit future limit is reached. Because clearing supports Undo, do not immediately destroy underlying files; any unreferenced-asset cleanup must respect remaining references, recovery policy, and ownership permissions.

Undo/redo session persistence and history limits remain Open. The minimum usability requirement is that the promised Undo works during the editor session, including clear overflow, occupied merge, and page deletion. Saving does not silently erase a currently promised Undo capability. The user's physical ownership records are independent of binder placements and overflow changes.

Acceptance tests should include page-cap races, full save/reopen equivalence, a failed manual save, editing again during an in-flight save, and authorization over overflow artwork references. Add integration tests when these real functions are implemented; none are implemented by this documentation update.

## Catalogue and inventory model constraints — Round 3

Selected scope is English cards in the 2010–2026 range, including variants and promos. Store structured language, printing/variant identity, set/promo release metadata, and stable provider references. Filter eligible English records by actual printing release date, with 2010 as inclusive lower year; future releases are automatically eligible when provider records become available. Filtering records does not require downloading every full-resolution image. Cache permitted metadata; load images as needed. Japanese and currency conversion are later milestones, not hidden launch requirements.

Inventory groups belong to a user, not a binder. Use an explicit Unknown condition; do not treat missing condition as Near Mint or price-zero. Graded copies require grading-company and grade fields. Separate groups when copies have distinct grading or applicable details, while preserving the user's quantity-grouped model. Final uniqueness/grouping rules must avoid combining copies with different valuation-relevant attributes. Optional notes/trade status must have a defined scope (whole group vs selected quantity) before editing is implemented.

A completion checklist owns its target list; avoid deriving its denominator from whichever catalogue results happened to load. Define target identity, required quantity, and variant/condition matching separately. A future new set or provider change must not silently rewrite saved checklists. Wanted/chase status is an independent intention, not evidence of physical ownership; extra wanted copies may coexist with owned copies, as confirmed.

Pricing adapter must accept exact printing/variant and a valuation context: raw condition or grading company/grade, plus USD market/source selection. Return amount/currency, source, market, value basis (asking/sold/aggregate), relevant condition/grade, provider update time, retrieval time, and missing/stale/coverage status. A failed lookup is not a zero-dollar card. Currency conversion is not required initially.

eBay and TCG marketplaces are candidate price sources. Their access, permitted usage, historical/completed-sales availability, quotas, and condition/grade coverage must be verified before selection. A free catalogue API does not establish a free, reliable feed for all raw conditions and graded sales. Treat complete requested pricing coverage as a feasibility gate, not an implemented fact. No scraping, paid subscription, credential provisioning, or pricing inference is authorized by this documentation update.

Chosen-color matching is confirmed for launch; reference-card and uploaded-reference-image matching are deferred. If full-catalog palette analysis is chosen, store derived color/palette metadata separately from raw card records and evaluate a bounded, cacheable approach within the zero-budget target. Reference-card palette matching and uploaded-image analysis introduce different data/image requirements; do not implement all three inputs by assumption. No implementation or provider choice is made here; chosen-color input is now confirmed.

## Confirmed Round 3 follow-ups

Colour search accepts a chosen color at launch; reference-card and uploaded-reference-image inputs are deferred. Binder artwork uploads remain a different confirmed requirement. Do not assume these two upload uses have the same pipeline or permissions.

Checklist presets expand to a saved target list that the user can edit. New provider catalogue records must not silently alter that list. Owned and wanted quantities are separate fields/records; satisfying ownership does not forbid wanting additional copies.

Automatically make future eligible English printings discoverable using their set/promo printing release dates, from 2010 onward. Define provider refresh cadence, date-missing handling, deduplication, and validation before integration. Unknown release dates must be handled explicitly instead of guessed. Automatic catalogue updates do not authorize changing saved binder references or custom checklist targets.

## Sharing and uploads constraints — Round 4

Only Private and Unlisted access are selected. A signed-in owner controls the mode; an unauthenticated viewer may use an unlisted token. Do not grant unauthenticated access to the full owner binder/inventory tables. Expose a narrowly scoped, validated read-only projection of the latest saved binder. Allowlist layout and catalogue details; explicitly exclude all inventory and private fields. Editing and saves require owner authorization regardless of knowledge of the share token.

Manual Save changes the visible shared projection after successful persistence. Unsaved changes are not shared. Define revocation and cache expiry/invalidation so returning to Private stops further viewer access under the agreed policy. Possession of an unlisted link grants viewing and is not proof of ownership; it cannot grant update/upload/delete permissions. No public listing/gallery or collaborative editing is in selected launch scope.

Shared user artwork requires a distinct authorized delivery path. Prefer an approved public projection or controlled URLs rather than publishing the owner's entire storage bucket. Ensure files used by a private binder cannot be fetched by arbitrary viewers just by guessing paths. Decide delivery/cache behavior and reference cleanup during implementation; do not imply revocation can erase screenshots or files viewers already downloaded.

JPG/PNG/WebP are accepted upload formats; size/resolution limits and transformation controls remain Open. Validate actual file contents/media type on upload instead of trusting extensions. No SVG, PDF, animated, or other file format is approved by this answer. Keep client and backend validation consistent.

Export/printing question Q18 is explicitly pinned until that design section. Output semantics, physical dimensions, paper options, and generation pipeline remain unresolved. Do not provision an export service or invent print sizes from the placeholder landing demo.

## Backend foundation decisions — Round 5

Initial beta: approximately 5–10 testers. Each account may have three binders; each binder at most 30 manually added pages. Enforce quotas consistently during create, duplicate, conflict-copy, and restore operations, including concurrent requests. No Trash is selected. A binder slot is released only after permanent deletion succeeds. Do not promise successful Save as a copy when all three slots are occupied: retain the conflicting draft and explain the available next step.

Google sign-in is the initial method; email/password is deferred. Supabase Auth is the recommended integration given the selected database, but provider configuration is not performed in this documentation task. Google sign-in authenticates the user; it does not authorize accessing their Google Drive or other unrelated account data.

Conflicting Manual Saves must compare an expected revision against the stored revision atomically. On mismatch, preserve the current unsaved draft and offer Reload saved version or Save as a copy; do not apply last-write-wins silently. Reload requires a warning before discarding current changes and a way to preserve/download them if the user needs them. Copy is independent, subject to the three-binder limit, and private by default as a proposed safety rule; never inherit an unlisted publication token by accident.

Q24–Q25 follow-ups are answered: no automatic local recovery drafts, immediate confirmed permanent binder deletion, structured data download, and permanent account deletion. Backend backup cadence, export format, and detailed retention policy remain Open.

Recovery distinctions: editor Undo reverses recent commands; device-local recovery retains an unsaved draft on that browser/device; cloud Manual Save stores an explicit committed version; database backups recover persisted data after a backend failure. These are separate layers. Local recovery is not cross-device sync, cloud saving, or guaranteed protection against cleared browser storage. Account-scoped recovery must not offer one user's draft to another signed-in account on the same browser. Retention/logout handling require a defined policy.

Data-management distinctions: binder Trash makes an application record recoverable until a chosen retention period; permanent binder deletion removes that binder's saved document/placements, not the separate physical inventory; a data download is a portable export of owned records and layouts, distinct from printable/social artwork; account deletion removes account-associated data under an explicit policy. Backups and already-downloaded shares require separately explained retention behavior. Shared links should become unavailable when a binder enters Trash or its account is deleted, under the chosen cache policy. All these flow recommendations await approval.

## Confirmed Round 5 follow-ups

Manual Save only: do not automatically persist unsaved binder documents into localStorage, IndexedDB, files, or the cloud. In-memory draft state and session Undo remain available while editing. This choice does not prohibit saving theme preferences or normal authentication session handling. Reload, tab closure, or a crash can lose unsaved edits; the UI must communicate that accurately. Leave warnings are required but cannot guarantee recovery. Background writes of editor drafts must not be introduced under the label of analytics, caching, or crash recovery.

Binder deletion is permanent after explicit confirmation, with no Trash/restore period. Identify the binder by name, show affected page count, state that layout/overflow contents will be removed, and distinguish this from physical inventory deletion. Revoke its share link as part of deletion. Do not offer an Undo/Restore control for confirmed permanent binder deletion. This specific choice overrides the earlier recommendation/test example for undoable whole-binder deletion; page deletion, merges, replacement, and clearing overflow remain session-undoable as previously agreed.

Provide structured binder/inventory data download and permanent account deletion with reauthentication and explicit confirmation. Account deletion covers user binders, overflow, physical inventory, shares, and user-owned files under the final retention policy. Backend backups and files referenced elsewhere need defined cleanup semantics; do not claim instantaneous erasure from every backup. Downloads should not contain passwords, authentication credentials, or internal service secrets. Portable data download is distinct from pinned visual export/printing question Q18.

Backend backup cadence, storage location, restore verification, retention after deletion, and acceptable saved-data loss/outage remain Open. No backup schedule was approved by selecting Manual Save. Backup copies contain committed data only and are not a substitute for unsaved drafts.

## Round 6 decisions and operating context

The user is the sole maintainer, with assistant guidance. No domain or Supabase/Vercel/provider accounts exist yet. Interface language is English; intended audience is adults around 20–30. Tester geography remains unspecified. Beta is free; subscriptions/payments are intended later, not implemented now. Recheck hosting/data commercial-use terms before monetization. Do not create accounts, issue keys, subscribe, or deploy under the documentation/research task.

Unlisted sharing includes uploaded artwork and a simple Report artwork route. Recommend a short report form tied to the public binder/asset identifier, a reason field, optional reply address, submission acknowledgment, and rate limits; details are proposed. Reports should be stored privately for the sole maintainer to review, not made visible in shared binders. A minimal owner-only review surface can support revoking a share/removing access; administrator capabilities require explicit server-side authorization. Do not publish a guessed personal email or imply an unconnected contact destination works.

## Provider research — 2026-10-12, documentation assessment only

These are candidates, not provisioned services. Provider availability, usage permissions, quotas, and exact returned fields must be checked again before integration. No authenticated price query has been made and no complete-coverage guarantee is established.

| Candidate                                                       | Findings and beta fit                                                                                                                                                                                                                                                                                                                                | Source                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TCGdex — recommended catalogue candidate                        | Free; no API key required. Images/variant metadata available. FAQ acknowledges missing prices/images and variant-to-marketplace mapping problems; validate exact identities before using prices. Cache considerately.                                                                                                                                | [FAQ](https://tcgdex.dev/faq), [card reference](https://tcgdex.dev/reference/card)                                                                                                                                          |
| Pokémon TCG API — catalogue alternative                         | Free keys; documented default 20,000 requests/day with a key, lower unauthenticated limits. Card object includes image and market/printing fields; not evidence of full graded/condition coverage. Maintain explicit ID mapping if combined with another provider.                                                                                   | [authentication](https://docs.pokemontcg.io/getting-started/authentication/), [limits](https://docs.pokemontcg.io/getting-started/rate-limits/), [card object](https://docs.pokemontcg.io/api-reference/cards/card-object/) |
| PokemonPriceTracker — recommended pricing candidate to validate | Documents 100 free credits/day, charges by returned card and optional data, daily-updated prices, condition and multi-grader data. Free non-revenue use and in-app caching permitted under its licensing; monetized apps require Business. Verify exact free response fields, matching, sparsity, and timestamps with sample cards before selecting. | [API reference](https://www.pokemonpricetracker.com/api-reference), [licensing](https://www.pokemonpricetracker.com/licensing)                                                                                              |
| PokeTrace — pricing alternative                                 | Documents 250/day Free for US raw data; graded coverage is not established as free by that plan description. Less aligned with zero-cost graded requirement without further verification.                                                                                                                                                            | [docs](https://poketrace.com/docs)                                                                                                                                                                                          |
| Direct marketplace feeds / PriceCharting                        | TCGplayer currently states it is not granting new API access. eBay's partner questionnaire states Marketplace Insights access cannot be granted upon request. PriceCharting describes price API data as purchased with a subscription. Do not make these mandatory free-beta dependencies.                                                           | [TCGplayer](https://docs.tcgplayer.com/docs/getting-started), [eBay access](https://partnernetwork.ebay.com/page/developer-questionnaire), [PriceCharting](https://www.pricecharting.com/api-documentation)                 |

Proposed split: catalogue browsing uses TCGdex, while backend price lookups use a separately keyed PokemonPriceTracker adapter. Map catalogue printings to provider product/printing IDs and return Unavailable when an exact safe match is missing. Never join by Pokémon name alone. Capture conditionUsed where a provider's generic value falls back to another condition; do not relabel that as the user's selected condition. Grader/company/grade must match explicitly.

The free allowance is shared by the application's key, not automatically granted to each signed-in collector. Refresh prices on demand, cache permitted responses with timestamps, budget per returned card/add-on, and stop requests gracefully at quota exhaustion. A whole-set request may consume credits per card even if it is one HTTP request. Do not promise daily fresh values for every stored card within 100 credits/day.

Provider data portability constraint: export the user's layouts/inventory/checklists, not bulk cached price datasets from a source whose license forbids redistribution. User-data downloads do not justify exporting licensed provider data. Future monetization must recheck commercial plans before charging users or adding ads/affiliate revenue.

Validation sample plan: cover English 2010-era and recent sets, promos, normal/reverse/holo, NM/LP/Unknown cases, and different grading companies/grades. Compare a few displayed records against their stated source/printing; inspect missing fields, timestamp, credit charge, and match confidence. Docs research alone does not replace this test. Graded/condition pricing remains a required feature with coverage states, not an assertion that every card will have a price.

## Current five-destination map — accepted, revisable

| Proposed route | Responsibility                                                                                                                 | Access                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| /              | Existing landing page                                                                                                          | Public                                                                                       |
| /workspace     | My binders and My collection as separate tabs; manual inventory updates/checklists; account/settings/data controls via a panel | Signed in                                                                                    |
| /binder/{id}   | Full editor, page navigation, card picker, customization, overflow, Save/Undo; sharing and exports as panels                   | Owner only                                                                                   |
| /discover      | Catalogue search, chosen-color search, card details and raw/graded price checker in a detail panel; target binder for Add      | Recommend catalogue public; personal actions signed in; price-access quota policy to confirm |
| /share/{token} | Latest saved, read-only visual binder/card details and included artwork; simple report action                                  | Anyone with valid unlisted link                                                              |

Google sign-in can use a small sign-in screen/modal and provider callback route. It need not become another complex product page. An owner-only report review/settings view may be operationally necessary, but not a public navigation destination. The actual framework and route paths remain proposed; the current single-file landing builder does not implement this map. The five destinations are accepted as the current working map; exact route paths and layouts remain proposed and revisable.

## Remaining decisions before related implementation

Pinned: Q18 export/printing scope, paper and physical sizes. Open: exact customization controls/upload limits; condition/grade categories and trade detail scope; checklist matching rules; last-page deletion behavior; backup/restore/retention targets; detailed data-download format; geography and price-refresh policy. These should be resolved at the relevant design section instead of reopening all foundational questions at once.

## Current page-map agreement — 2026-10-12

The user accepts the five-destination map for now: Landing; Workspace with My binders/My collection tabs; Binder editor; Discover with card-detail price checking; Unlisted binder viewer. Account/settings, sharing, and exports are contextual panels under the current plan. This is a working map, not a permanent restriction on page count or navigation.

Frontend design comes first. Choose and refine layouts, spacing, controls, and visual treatment while building each page. Preserve confirmed behavior and data/privacy requirements unless the user changes them. A visual revision does not by itself authorize backend implementation or production deployment. Update this specification when a page/function location changes so architecture follows the final user flow.

The current landing palette remains unchanged until a specific refinement is requested. Use realistic sample data and loading/empty/error/unsaved states while designing; actual accounts, persistence, provider integration, and deployment are later work. Q18 export/printing details remain pinned for that section. Other detailed decisions should be asked when designing their relevant feature, not guessed or presented as settled.

## Current frontend module boundaries

See [HANDOFF.md](HANDOFF.md) for the authoritative runtime map. BinderSchema is pure validation/constants; BinderMedia decodes/optimizes images; BinderState owns undoable document edits; BinderStore owns explicit persistence and import validation. Rendering and UI remain in BinderVisuals, BinderCovers, editor and studio modules. Inventory uses its own independent state/store. Build embeds fonts and artwork into generated previews from the original binary assets. No backend is connected.

## Deferred resource controls

The existing rate-limit, catalogue-loading, cloud-conflict and export backlog remains deferred; see DESIGN.md and HANDOFF.md.

### Shared frontend helpers

CollectionUI (src/scripts/collection-ui.js) provides collection-gallery/picker DOM, select-option and image-fallback helpers. It loads before CollectionForm/Collection. BinderSchema.connected centralizes edge-connected pocket validation for BinderStore imports and editor merge eligibility. Generated previews stay build artifacts; responsive and theme styles remain intentionally layered.
