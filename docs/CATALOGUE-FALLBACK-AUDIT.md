# Catalogue fallback audit

24 October 2026. Read-only local investigation on `feat/binder-set-insertion`.
No provider data has been added to the application or database, and no production change is included.

**Latest evidence:** [Image verification](CATALOGUE-IMAGE-VERIFICATION.md) supersedes the early pilot counts below. Of 1,590 original image-gap entries, 1,430 have downloaded product-image candidates; Pokewallet supplied 66 additional pictures. All 30 recent Classic Collection and 25 Celebrations Classic Collection pictures were visually checked. Of the other 94 entries, 92 Pokewallet images remain untested and My First Battle Potion (Bulbasaur) and Switch (Squirtle) returned 404. No enrichment is installed.

**Coverage correction:** [Full gap details](CATALOGUE-GAP-DETAILS.md) supersede an interpretation of the raw 228 count as unique missing cards. RC1–RC25 already exist with image URLs under Legendary Treasures. Also, all 34 initially unmatched cards in the four Pokewallet-tested groups have unique set/number counterparts with differently written names. The 314 strict image-URL candidates remain unchanged; the additional 34 need printing/image review. No provider-wide absence claim or enrichment import is established.

## Current gaps

The prepared TCGdex snapshot has 21,256 records across 201 populated English groups:

| Gap | Count |
| --- | ---: |
| Records without an image URL | 1,590 |
| Populated groups containing those records | 65 |
| Populated groups without a logo URL | 55 |
| Listed records not supplied by the provider | 228 |

These are missing URL/record fields, not a claim that every possible provider asset was checked over HTTP. Absent record counts do not tell us the exact missing identities. See [the catalogue record](FULL-ENGLISH-CATALOGUE.md) for empty and partial groups.

## Completed key-free pilot

Downloaded the public TCGCSV Pokemon group directory and eight group product files. Requests use a custom application User-Agent, run sequentially, and reuse a 24-hour disk cache, following [TCGCSV's guidelines](https://tcgcsv.com/docs).

Groups are selected only when their names match uniquely after punctuation/spacing and known era-prefix normalization. Cards require matching names and collector numbers within that group. The script preserves number prefixes and does not merge Unown punctuation names. Multiple candidates remain ambiguous; no candidate is automatically approved.

| Local group | Missing image URLs | Cards with candidate image URLs |
| --- | ---: | ---: |
| Shining Fates Shiny Vault | 122 | 122 |
| Shining Legends | 78 | 70 |
| Dragon Majesty | 78 | 56 |
| Crown Zenith Galarian Gallery | 70 | 66 |
| Aquapolis | 40 | 0 |
| My First Battle | 34 | 0 |
| Skyridge | 32 | 0 |
| Celebrations Classic Collection | 25 | 0 |
| **Total** | **479** | **314** |

Zero means this conservative pilot found no exact candidates, not that the provider lacks those cards. Different naming/numbering may need a reviewed mapping.

The 314 candidates include HTTPS TCGplayer image URLs; this is not an independent archive of image bytes. Downloaded three samples: Rowlet SV001, Bulbasaur 1 and Charmander 1. All returned HTTP 200 JPEG, and visual inspection confirmed English names and collector numbers. They are approximately 200px-wide thumbnails. High-resolution suitability, all remaining images and exact printing/finish equivalence are not verified.

No conclusion about filling missing card records or logos follows from this image-only pilot.

## Pokewallet access and first authenticated result

[Official documentation](https://pokewallet.io/api-docs) requires an API key for card, set and image endpoints and warns against exposing keys in browser code. [The free plan](https://pokewallet.io/pricing) currently allows 100 requests/hour and 1,000/day. The owner ran the hidden-key prompt locally and reported success; the generated report was independently read afterward. The key was not supplied in chat or saved by the audit.

The authenticated pilot used **five new requests**, retrieved an English directory of **331 provider groups**, and found **314 unambiguous metadata candidates** across Shining Fates Shiny Vault (122), Shining Legends (70), Dragon Majesty (56) and Crown Zenith Galarian Gallery (66). All 314 overlap the TCGCSV candidates: this is **314 unique local cards, not 628**. No Pokewallet image endpoint was called and no catalogue record was changed. This establishes successful authenticated catalogue access for this run, not an assurance that every candidate image exists or is suitable.

Directory-only follow-up found one exact English name match for 10 of the 55 local missing-logo groups, but no logo was downloaded. Missing-record groups need explicit review: Jumbo Cards is a broad 345-product group; Radiant Collection has separate Generations (32) and Legendary Treasures (25) groups; the Lycanroc trainer kit is combined with Alolan Raichu (60); and My First Battle has separate 40- and 48-card groups. Provider counts are not interchangeable with our source counts. W Promotional has no simple name match. No missing-record identities have been established by these directory suggestions.

Prepared a separate operator-only pilot. It reads only `POKEWALLET_API_KEY`, retrieves an English set directory, and examines up to four uniquely name-matched English groups. It consumes at most ten new requests, stops on authentication/rate-limit failures without automatic retries, uses a 24-hour cache, and rejects inconsistent or duplicate pagination. It excludes sealed products and preserves multiple printing candidates for review. No image calls or database writes are made.

Run this from the repository in PowerShell once the key is generated:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\enter-pokewallet-pilot.ps1
```

The prompt hides the key, passes it to the child process for the audit, and clears/restores that process environment value afterward. It does not save the key to disk or print it. Do not paste a key into chat, a command argument, frontend source or a report. The process-only ExecutionPolicy argument resolves the owner's local script restriction without permanently changing policy; it does not override centrally enforced Group Policy. Prompt syntax, fixture behavior and the first authenticated metadata run passed.

The first authenticated pilot checks metadata candidates only. Follow it with bounded image/logo requests and manual review of set/language/collector number/printing. Explicitly inspect the four empty and two partial source groups to assess missing records, not just the image groups.

## Reproduce and artifacts

```sh
node scripts/check-catalogue-coverage.cjs
node scripts/catalogue-coverage.cjs
node scripts/catalogue-coverage.cjs --tcgcsv-pilot
```

The default audit is offline and needs the existing prepared snapshot. The optional TCGCSV pilot makes at most nine new requests per run (one directory, eight product files) before cache reuse. Results stay under ignored `.scratch/catalogue/provider-audit/`:

- `coverage-gaps.json`: complete affected local IDs, missing-logo groups and record-gap counts.
- `tcgcsv-pilot.json`: 314 candidate matches and exact provider product URLs.
- `sample-image-checks.json` and `sample-*.jpg`: three sampled downloads.
- `pokewallet-pilot.json`: successful first authenticated metadata pilot, five new requests and 314 candidates.

Checks cover number/name matching, ambiguous variants, disallowed image hosts, absent record/image accounting, response byte limits, two-page provider pagination, duplicate/count rejection, rate-limit stop and exclusion of keys from saved fixture reports. The live result establishes the limited metadata coverage above, not image coverage or image rights.

## Next decisions

1. First authenticated metadata pilot passed; preserve its cached report and compare exact candidate IDs rather than adding provider totals.
2. Assess image quality, logo coverage and the missing-record groups with bounded additional requests.
3. Review cross-provider language/set/printing mappings and intended caching/redistribution permissions before an import. API access alone does not establish permission for every artwork use; [Pokewallet's terms](https://pokewallet.io/terms-conditions) distinguish service access and underlying artwork.
4. Preserve existing internal IDs and keep the enrichment separate until validated. The current importer/frontend trust only existing canonical asset hosts; adding a provider will require deliberate validation and compatibility changes.
5. Continue set-to-binder creation against the validated catalogue. Fallback investigation is a pre-release workstream; comprehensive automated multi-provider ingestion remains deferred.
