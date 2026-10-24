# Full English catalogue preparation - 24 October 2026

Coverage interpretation follow-up: [the detailed audit](CATALOGUE-GAP-DETAILS.md) establishes that the raw 228 group-record discrepancy below is not a verified count of unique missing cards. The empty Radiant Collection group duplicates RC1–RC25 already supplied under Legendary Treasures with image URLs. Other source/provider group and count differences still require reconciliation before claiming complete coverage.

Prepared and tested locally on `feat/binder-set-insertion`. Production still contains the ten-set trial: **1,291 cards / 10 sets**. No production migration, data import, push, merge or deployment was performed.

## Verified coverage

The public [TCGdex English set directory](https://api.tcgdex.net/v2/en/sets) lists 220 groups. Excluding the 15 groups in its [Pocket series](https://api.tcgdex.net/v2/en/series/tcgp) leaves 205 physical-card catalogue groups, including promos, kits and galleries. These are provider printing records, not an inventory of every physical variation.

The downloaded snapshot contains **21,256 records across 201 groups**. The directory's stated total is 21,484; the remaining **228 records are absent from the supplied card data**:

| Group | ID | Available / listed |
| --- | --- | ---: |
| W Promotional | wp | 0 / 7 |
| Jumbo cards | jumbo | 0 / 160 |
| Sample | sp | 0 / 10 |
| Radiant Collection | rc | 0 / 25 |
| SM trainer Kit (Lycanroc) | tk-sm-l | 18 / 30 |
| My First Battle | mfb | 34 / 48 |

The four empty groups are recorded under `unavailableSets` in the snapshot and are not imported as empty browse tiles. The two partially populated groups retain their actual available counts and show the missing-record count in Discover. No cards, images or printings are invented to fill gaps. **1,590 available records have no image URL**; Discover shows an explicit placeholder and disables image zoom for those cards. Failed remote images retain their existing fallback.

## Implementation

- The original ten-set commands remain available. Explicit `--all-english` selects the public English directory and excludes Pocket by series membership.
- Set listings come from REST. Complete card metadata is requested in four concurrent, bounded set batches through the official [GraphQL API](https://tcgdex.dev/graphql). Exact set membership is checked after prefix filtering, so `30th-c` records cannot leak into `30th`.
- Downloads retain the one-day ignored response cache, timeouts, response-size bounds, limited retries and trusted asset hosts. Every listed available ID must have one metadata record. Unexpected errors prevent snapshot publication and database import; known upstream coverage gaps are recorded explicitly.
- Snapshot checks bound the import to 500 groups / 50,000 records and reject duplicate identities, mismatched providers, missing set membership and incorrect available counts. These are validation ceilings, not a performance promise. Current search pagination remains 24 records / page, at most 1,000 pages, sufficient for this snapshot.
- Existing sample IDs and accepted finishes stay valid. Two punctuation-named Unown printings use stable internal IDs (`exu-unown-exclamation`, `exu-unown-question`) while preserving the original provider IDs; the question-mark collector number is displayed as `?`.
- Imports upsert only public catalogue metadata in an atomic local transaction. They preserve existing finishes and never delete cards, binders, collections or artwork. The importer still has no hosted mode.
- Pending migration `20261023184001_full_english_catalogue.sql` returns a compact set directory, explicit logos, authoritative finish options and `metadataVersion=2`. Empty `preview` arrays retain the response shape without loading hundreds of cards at startup. `searchVersion=3` comes from the preceding filter migration. Direct table grants, row-level security, empty function search paths and three-second SQL timeouts remain unchanged.
- The frontend accepts the larger bounded directory, keeps 24-card result pages and deferred images, removes the obsolete English-coming-later message for expanded catalogues, and retains sample-only color matching. Operator recovery accepts up to 50,000 metadata records; archive byte limits are unchanged.

## Reproduce locally

Use the existing Docker development stack. Do not reset it or use `--linked`.

```sh
npx supabase db push --local --skip-vault
npm run catalogue:download:english
npm run test:catalogue:full
```

`test:catalogue:full` **imports the snapshot twice into the local Docker database** and verifies account-data fingerprints before/after. It refuses non-loopback API targets. The separate `catalogue:import:english:local` command downloads/validates and imports once. No hosted command is provided.

Snapshot and detailed measurements stay under ignored `.scratch/catalogue/`: `tcgdex-en-full.json` and `full-test-report.json`. Raw downloaded metadata is not bundled into the website. A future fresh download can change counts; review its coverage before release.

## Acceptance

The final sequential local HTTP sample used 13 search/filter combinations, each repeated three times:

| Measurement | Result |
| --- | ---: |
| Import / repeat import | 4,465 / 4,094 ms |
| Search median / p95 / maximum | 34 / 170 / 184 ms |
| Startup metadata JSON | 41,104 bytes; existing limit 262,144 |
| Largest sampled search JSON | 9,897 bytes; existing limit 65,536 |
| Encrypted catalogue recovery fixture | 606,612 bytes |

An intermediate run overlapping other regression jobs exceeded the 3,000 ms local HTTP test threshold. The sequential rerun passed. These measurements establish local single-user behavior, not hosted speed or load capacity; the existing broader load-calibration limits still apply. Existing search indexes were retained because the sequential full-size checks passed without new ones.

Passed: repeat-import identity/counts and private-data preservation; anonymous HTTP reads; name/number/set/illustrator search; array filters and Any/All types; numeric/HP bounds; distinct result pages for every sort, including the final page; legacy and punctuation printing lookups; bounded startup loading; private-table write denial; full-size encrypted recovery; embedded PostgreSQL permissions and validation; model/operator regressions; and real local Auth/Storage/RLS, concurrent saves, backup/restore and account-isolation acceptance.

Focused Brave acceptance covers the 201-set directory, real Water + Darkness All matching, illustrator mode and reload, multiple set selection on a 320px viewport, deferred hidden-tab images, missing-artwork details/disabled zoom and partial-set coverage labels. Full automated browser, physical-device and hosted acceptance remain separate.

## Release boundary

Review and deploy the frontend supporting both old and compact metadata before increasing the hosted set count: older clients reject more than ten sets. Apply both pending catalogue migrations and import only the reviewed public snapshot after a fresh verified production backup and explicit release authorization. Refresh old open tabs and check catalogue search, private Save/reopen and recovery through the deployed request gateway. Production rollout and filling upstream gaps are not part of this local preparation.
