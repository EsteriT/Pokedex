# Catalogue image verification - 24 October 2026

Local read-only investigation. No catalogue import, hosted migration, deployment or user-binder change. This supersedes the earlier limited-pilot matching counts.

## Results in plain English

- Found at least one potential product/picture reference for every one of the 1,590 original image-gap entries. This establishes candidate identities, not that all pictures exist or are the correct variant.
- Downloaded and decoded at least one candidate JPEG for 1,430 card entries. No JPEG decode failures among the 1,463 downloaded files.
- 160 card entries had no downloaded picture from the product-image source. The unavailable products have imageCount 0; the generated URLs returned HTTP 403. Pokewallet subsequently supplied 66 pictures across the pilot and first remaining-card run, bringing combined downloaded-candidate coverage to 1,496 entries. There are 92 untested Pokewallet pictures and two failed requests; 94 entries still have no downloaded candidate.
- Visually checked all 30 cards in the 30th Classic Collection and all 25 cards in Celebrations Classic Collection. Their 55 matching English anniversary images are recorded separately with file hashes.
- Original missing image URLs in the application snapshot remain unchanged. No replacement is installed.

## Why the first counts were too pessimistic

The initial matcher required essentially identical set names and card numbers. This missed promo labels, zero padding, names with Full Art/Secret/Prism Star suffixes, deck-specific trainer names, different provider groupings, and reprints that retain their original printed number. The extended pass checks each local printing in its reviewed group and preserves ambiguous versions instead of importing guesses.

## 30th Classic Collection: confirmed pictures

- TCGdex local ID 30th-c; Pokewallet/TCGplayer numeric group 24837. Provider names differ (30th Classic Collection versus 30th Celebration - Classic Collection).
- A fresh TCGdex set response contained all 30 entries but zero image fields; a fresh first-card response also omitted its image. Three documented canonical asset paths returned 404. This does not prove that every possible asset path was checked.
- TCGdex sequences 001?030 do not match the retained original printed numbers. Charizard is local 001 but prints 4/102; Magikarp is local 030 but prints 203/193.
- All 30 candidate image downloads were decoded and visually reviewed for English identity, printed number and anniversary mark. Darkrai & Cresselia LEGEND top/bottom were mapped separately. All have at least 600 pixels on their short side.
- Artwork came from public product metadata/image delivery, not from a new authenticated Pokewallet image call. The cached Pokewallet directory confirms the matching set and group ID.

## Scope and quality limits

The expanded matching report contains 1,488 unique potential matches, 56 single-version review cases, 36 multiple-version cases and ten data conflicts. No automatic import follows from any of these categories.

The image pass considered 1,641 distinct product image files because some cards have alternate versions. It downloaded 1,463 files (about 147.5 MB) and recorded 178 unavailable image references. Those 178 references correspond to 160 card entries without any downloaded candidate; other failures are alternate versions of cards that do have another candidate. Four bounded workers, per-file byte limits, caching and a 512 MiB ceiling were used. Authentication/rate-limit responses stop the batch; known denied product URLs are not retried.

All 178 failed product entries report imageCount 0. The exact supplied thumbnails were also tested once for two Staff versions and four representative trainer/MFB entries; all six returned 403. Do not infer that every possible external source lacks the image.

Decoded short-side dimensions: 997 files at least 600px, 173 at 300?599px, and 293 below 300px. A large-image URL can still return a small original image. Small files need quality review. The Terapagos & Friends file has a prominent OVERSIZE CARD banner and is explicitly excluded from approved enrichment. Pikachu at the Museum was visually located as a jumbo promo; its native picture is small.

## Product-image source gaps before the Pokewallet samples

| Group | Entries |
| --- | ---: |
| My First Battle | 2 |
| HS trainer Kit (Gyarados) | 2 |
| XY trainer Kit (Bisharp) | 29 |
| XY trainer Kit (Wigglytuff) | 29 |
| XY trainer Kit (Latios) | 28 |
| XY trainer Kit (Latias) | 27 |
| SM trainer Kit (Alolan Raichu) | 27 |
| SM trainer Kit (Lycanroc) | 16 |
| **Total** | **160** |

## Data conflicts that must not be silently overwritten

Eight trainer-kit #30 cards are marked normal-only in the source but described as holo by the alternative provider: Noivern, Sylveon, Bisharp, Wigglytuff, Latios, Latias, Pikachu Libre and Suicune. Their finish metadata needs reconciliation before any change that could affect saved records.

Two numbered entries have provider field inconsistencies: Noivern-deck Switch (source #29, provider field 4/30) and Alolan Raichu-deck Lightning Energy (source #3, provider title #3 but field 2/30). The Switch thumbnail was inspected and its small printed footer is consistent with source 29/30; retain the conflict for a better-resolution/independent check. The Lightning Energy image was not available in the tested source.

## Authenticated Pokewallet sample result

The owner ran the hidden-key image pilot: 160/160 metadata mappings in five English groups, seven of eight sample pictures downloaded, 13 new requests. Images were decoded and visually checked for English name and printed number. They are small scans, not high-resolution replacements despite requesting size=high.

| Local card | Picture result | Dimensions |
| --- | --- | --- |
| My First Battle: Potion (Bulbasaur), mfb-33 | Image endpoint HTTP 404; metadata exists | None |
| HS Gyarados: Pokemon Communication #22 | Name and 22/30 match | 251 x 345 |
| XY Bisharp: Fletchling #1 | Name and 1/30 match | 255 x 361 |
| XY Wigglytuff: Swirlix #1 | Name and 1/30 match | 255 x 361 |
| XY Latios: Skitty #1 | Name and 1/30 match | 255 x 361 |
| XY Latias: Grass Energy #1 | Energy type and 1/30 match | 255 x 361 |
| SM Alolan Raichu: Lightning Energy #1 | Energy type and 1/30 match | 255 x 361 |
| SM Lycanroc: Caterpie #1 | Name and 1/30 match | 255 x 361 |

The 404 means this particular image request returned no picture; it does not establish absence from every provider. At the pilot stage, 152 pictures remained untested. The subsequent run below supersedes that count.

## First remaining-card run

The owner successfully ran `-RemainingImages` after the wrapper correction: 60 new requests, 68 cumulative checked card entries, 66 downloaded pictures, two HTTP 404 responses and 92 entries still untested. This added 59 files beyond the seven pilot pictures. The stop was the tool's 60-request allowance, not a reported provider 429 response. Since earlier pilot requests also consume the hourly allowance, wait at least one hour after this run before starting the next batch, unless the provider dashboard confirms sufficient renewed allowance.

Failed picture endpoints: Potion (Bulbasaur), local mfb-33/product 524026, and Switch (Squirtle), local mfb-34/product 524034. Both are My First Battle cards with metadata but no picture returned by the tested Pokewallet endpoint.

All 66 saved files passed byte-size/hash checks and decoded. Two are 251 x 345 and 64 are 255 x 361. Six contact sheets were visually checked for English identity, card/energy type and printed collector number; no mismatch was found at this thumbnail level. Holo/finish conflicts remain unresolved by a small flat scan. Combined downloaded-candidate coverage is 1,496/1,590, not an imported or fully approved high-quality image count. The two 404s and 92 untested entries are still open.

## Next bounded check

The key is intentionally not retained. The operator can continue through the hidden local prompt:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\thukh\OneDrive\Desktop\Pokedex\scripts\enter-pokewallet-pilot.ps1" -RemainingImages
```

This uses the five cached English metadata groups (refetching after 24 hours), matches exact product IDs and skips every previously checked local ID, including the two 404s. It caps each run at 60 total new requests, respects remaining-hour/day headers, saves each completed picture and stops on authentication or rate-limit errors. Subsequent runs resume from pokewallet-image-check.json. It never saves the key or imports records. Check results before rerunning; the 60-request cap does not replace the provider's hourly/daily limit. The first remaining-card batch is complete; 92 more pictures still need requests.

Wrapper correction: the owner supplied the correct `-RemainingImages` command, but PowerShell unwrapped a one-element array returned from an `if` expression into a string. Native argument splatting then passed separate characters instead of `--remaining`, causing another eight-picture pilot. The wrapper now assigns an array directly. `scripts/check-pokewallet-wrapper.ps1` runs the real wrapper against local Node fixtures in all three modes, verifying the intact native argument and temporary-key restoration without network requests or a real key. The subsequent real remaining-card batch confirms the corrected mode works. Repeated earlier pilots did not increase distinct image coverage.

## Evidence and reproduction

Validation passed: catalogue coverage and 30th mapping fixtures, authenticated-image fixtures (including resume, 60-request cap and exhausted allowance), existing catalogue validation, PowerShell wrapper parsing and actual native-argument regression checks, all five preview builds and 199 references/50 JavaScript modules. No hosted test or full provider-image import was performed.

- [Complete local card review](../.scratch/catalogue/provider-audit/complete-image-review.html): all 1,590 names/numbers, candidate versions, available local pictures and file dimensions.
- [30th Classic Collection gallery](../.scratch/catalogue/provider-audit/30th-classic-review.html): all 30 reviewed pictures.
- pokewallet-image-pilot.json and pokewallet-sample-dimensions.json record the eight sample outcomes and seven decoded sizes; pokewallet-sample-visual-review.json records the limited visual check.
- pokewallet-image-check.json, pokewallet-image-dimensions.json, pokewallet-batch-visual-review.json and combined-image-coverage.json record the first remaining-card batch, all 66 saved file sizes/hashes and the current 92 untested/two failed entries.
- approved-anniversary-artwork.json: 55 visually reviewed mappings and SHA-256 hashes; ignored local evidence.
- extended-printing-review.json, downloaded-image-checks.json, decoded-image-checks.json and image-card-coverage.json contain detailed local results under .scratch/catalogue/provider-audit/.
- Experimental expanded group/name passes are in ignored .scratch/scripts/extend-image-check.cjs and finalize-image-candidates.cjs; they are diagnostic, not production import logic.
- Reusable narrow mapping and checks: scripts/catalogue-30th-mapping.json, catalogue-review-images.cjs and check-catalogue-review-images.cjs. The no-download command writes a separate plan, preserving the visual receipt.
- The API image diagnostic is scripts/catalogue-pokewallet-images.cjs; request/language/failure/key-handling fixtures pass in scripts/check-pokewallet-images.cjs.

## Every affected group: latest available-file counts

Counts below refer to at least one downloaded candidate, not visual approval or installed replacements.

| Group | Original missing images | Entries with a downloaded candidate | Still without a downloaded picture |
| --- | ---: | ---: | ---: |
| Shining Fates Shiny Vault | 122 | 122 | 0 |
| MEP Black Star Promos | 89 | 89 | 0 |
| Shining Legends | 78 | 78 | 0 |
| Dragon Majesty | 78 | 78 | 0 |
| Crown Zenith Galarian Gallery | 70 | 70 | 0 |
| SM Black Star Promos | 67 | 67 | 0 |
| Aquapolis | 40 | 40 | 0 |
| SVP Black Star Promos | 34 | 34 | 0 |
| My First Battle | 34 | 32 | 2 |
| Skyridge | 32 | 32 | 0 |
| HS trainer Kit (Raichu) | 30 | 30 | 0 |
| HS trainer Kit (Gyarados) | 30 | 28 | 2 |
| BW trainer Kit (Excadrill) | 30 | 30 | 0 |
| BW trainer Kit (Zoroark) | 30 | 30 | 0 |
| XY trainer Kit (Noivern) | 30 | 30 | 0 |
| XY trainer Kit (Sylveon) | 30 | 30 | 0 |
| XY trainer Kit (Bisharp) | 30 | 1 | 29 |
| XY trainer Kit (Wigglytuff) | 30 | 1 | 29 |
| XY trainer Kit (Latios) | 30 | 2 | 28 |
| XY trainer Kit (Latias) | 30 | 3 | 27 |
| XY trainer Kit (Pikachu Libre) | 30 | 30 | 0 |
| XY trainer Kit (Suicune) | 30 | 30 | 0 |
| SM trainer Kit (Alolan Raichu) | 30 | 3 | 27 |
| Brilliant Stars Trainer Gallery | 30 | 30 | 0 |
| Astral Radiance Trainer Gallery | 30 | 30 | 0 |
| Lost Origin Trainer Gallery | 30 | 30 | 0 |
| Silver Tempest Trainer Gallery | 30 | 30 | 0 |
| 30th Classic Collection | 30 | 30 | 0 |
| Unseen Forces Unown Collection | 28 | 28 | 0 |
| McDonald's Collection 2021 | 25 | 25 | 0 |
| Celebrations Classic Collection | 25 | 25 | 0 |
| Scarlet & Violet Energy | 24 | 24 | 0 |
| SWSH Black Star Promos | 22 | 22 | 0 |
| SM trainer Kit (Lycanroc) | 18 | 2 | 16 |
| McDonald's Collection 2022 | 15 | 15 | 0 |
| McDonald's Collection 2023 | 15 | 15 | 0 |
| McDonald's Collection 2024 | 15 | 15 | 0 |
| EX trainer Kit 2 (Minun) | 12 | 12 | 0 |
| EX trainer Kit 2 (Plusle) | 12 | 12 | 0 |
| DP trainer Kit (Manaphy) | 12 | 12 | 0 |
| McDonald's Collection 2011 | 12 | 12 | 0 |
| McDonald's Collection 2012 | 12 | 12 | 0 |
| McDonald's Collection 2014 | 12 | 12 | 0 |
| McDonald's Collection 2015 | 12 | 12 | 0 |
| McDonald's Collection 2016 | 12 | 12 | 0 |
| McDonald's Collection 2017 | 12 | 12 | 0 |
| McDonald's Collection 2018 | 12 | 12 | 0 |
| McDonald's Collection 2019 | 12 | 12 | 0 |
| DP trainer Kit (Lucario) | 11 | 11 | 0 |
| EX trainer Kit (Latias) | 10 | 10 | 0 |
| EX trainer Kit (Latios) | 10 | 10 | 0 |
| Best of game | 9 | 9 | 0 |
| HGSS Black Star Promos | 9 | 9 | 0 |
| Mega Evolution Energy | 8 | 8 | 0 |
| Yellow A Alternate | 6 | 6 | 0 |
| Forbidden Light | 6 | 6 | 0 |
| Poké Card Creator Pack | 5 | 5 | 0 |
| BW Black Star Promos | 3 | 3 | 0 |
| XY Black Star Promos | 3 | 3 | 0 |
| POP Series 6 | 2 | 2 | 0 |
| Miscellaneous Promos | 1 | 1 | 0 |
| Rising Rivals | 1 | 1 | 0 |
| BREAKthrough | 1 | 1 | 0 |
| Guardians Rising | 1 | 1 | 0 |
| Celebrations | 1 | 1 | 0 |
| **Total** | **1,590** | **1,430** | **160** |

[Earlier gap/record-count investigation](CATALOGUE-GAP-DETAILS.md) explains why the raw 228 group discrepancy is not 228 verified unique missing cards.
