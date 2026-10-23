# Wordstead asset audit

Audit date: October 22, 2026. Scope: `wordstead/assets/`, Wordstead's design and license documents, and repository metadata needed to assess exposure. This is an audit and proposal, not an integration or license clearance.

> Historical audit snapshot. The subsequent [organization work](asset-organization/README.md) copied and verified the originals privately, removed their working-tree folders with owner approval, and preserved notices under `licenses/`. Inventory paths below retain their original identities; the tools resolve them through a local private-store binding. Public GitHub copies and history have not been remediated.

**The three complete extracted packs are already in a public GitHub repository.** All 220 current files are tracked; the live `main` tree also contains 220 files under `wordstead/assets/`. Three original pack ZIPs remain in reachable local Git history. No assets, tracking rules, branches, history, deployment settings, or existing documents were changed during this audit. Nothing was committed, pushed, uploaded, or published.

## Deliverables and evidence

- [Human catalog](ASSET-CATALOG.md): every file, dimensions/duration, size, classification, and layout notes; includes Wordstead shortlist.
- [Organization plan](ASSET-ORGANIZATION-PLAN.md): private originals, curated runtime assets, canonical aliases, and approval decisions.
- [Full inventory JSON](asset-audit/inventory.json) and [CSV](asset-audit/inventory.csv): per-file paths, formats, dimensions where applicable, byte sizes, SHA-256, provenance, and tracking status. JSON also includes image bounds, animation durations, font/editor metadata, duplicate groups, and near-image candidates.
- [Per-file content/layout notes](asset-audit/catalog-notes.json), [detailed measurements](asset-audit/detail-measurements.json), and [repository safety snapshot](asset-audit/repository-safety.json).
- [Proposed JSON Schema](asset-audit/sprite-manifest.schema.json), [sample registry](asset-audit/sprite-manifest.sample.json), and [registry guide](asset-audit/SPRITE-REGISTRY.md).
- Private artwork previews: [local gallery](<C:/Users/regni/.codex/visualizations/2026/10/22/01a165e9-850b-7453-a406-01ef0fb62971/wordstead-asset-previews/index.html>). There are 19 labeled contact sheets covering all 190 PNG/GIF files, 18 coordinate overlays, and three decoded Aseprite first-frame previews. The gallery and all raster derivatives are outside the repository. Do not publish them as an asset browser.

The preview links are machine-local and must be regenerated on another machine. Audit IDs A001–A220 identify this snapshot; they are not proposed gameplay identifiers. Full original paths and hashes are the durable evidence.

## Repository and method

Read the root `AGENTS.md` and `README.md`, `docs/design-skeleton.md`, `docs/license.md`, and all three original `read_me.txt` notices. No nested `AGENTS.md`, Wordstead README, package manifest, runtime game, build command, or test suite exists in the inspected Wordstead tree.

Recursively enumerated every file, decoded all PNGs/GIFs using bundled Pillow 12.3.0, and calculated SHA-256 over original bytes. All GIF frames were decoded. WAV headers and PCM samples, TTF tables/name records, and Aseprite headers/frames/layers/tags were inspected with Python's standard library. No dependency was installed. The original image assets were not edited; contact sheets and overlays are separate analytical derivatives.

All 19 contact sheets and 18 coordinate overlays were visually inspected. Catalog descriptions distinguish recognizable families from uncertain identities. A filename is evidence of the author's label, not proof of undocumented gameplay semantics. Dimensions alone are never proof of a uniform sprite grid.

For Aseprite decoding, used the [official file format specification](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md). The three RGBA winter files use normal opaque visible image layers; a narrowly scoped decoder rejected unsupported constructs and matched all 34 exported frames. The indexed palette file was inspected as metadata, not rendered by that decoder.

## Inventory totals

| Original pack / provenance key | Files | Worktree bytes | Supplied edition |
| --- | ---: | ---: | --- |
| Sprout Lands - Sprites - Basic pack / `sprout-sprites-basic` | 43 | 454,664 | Basic |
| Sprout Lands - UI Pack - Basic pack / `sprout-ui-basic` | 47 | 247,280 | Basic |
| Sprout Sorry pack / `sprout-sorry` | 130 | 19,135,120 | Sorry/Early Access; bundled notice says Basic |
| **Total** | **220** | **19,837,064** | **18.92 MiB** |

Provenance is verified from the enclosing extracted directories and original readmes. No download receipts, archive checksums from the publisher, or Premium entitlements were supplied; directory membership is not independent download authenticity verification.

| Format | Count | Bytes | Findings |
| --- | ---: | ---: | --- |
| PNG | 185 | 789,454 | Pixel-art sheets, standalone sprites, references, palette and font images |
| GIF | 5 | 439,023 | Animated references/demo scenes; not all are ready-to-use sprite animations |
| WAV | 22 | 18,459,080 | All stereo 22,050 Hz, 16-bit PCM; identical left/right sample streams |
| Aseprite | 4 | 25,098 | One indexed palette, three RGBA animation sources |
| TTF | 1 | 118,342 | Cup Nooble pixel font, version 1.0 |
| TXT | 3 | 6,067 | Original readme/license notices |

There are 217 non-readme assets plus three notices. No current ZIP, SVG, JPEG, WebP, MP3, OGG, video, separate animation JSON, tile-map file, or engine project was found. Missing formats are findings about this snapshot, not claims about what the creator sells.

The worktree byte count includes local line endings. The live GitHub tree totals 19,836,905 bytes for the same 220 paths; the 159-byte difference is consistent with Git text normalization. Current local `origin/main` and HEAD have no asset content diff. Byte comparisons and preservation checks in this audit use the worktree snapshot, not normalized Git blobs.

## Exact and visual duplicates

Eight SHA-256 groups contain two files each: 16 files, eight redundant copies, and **16,202 bytes** potentially avoidable in a future curated export. There are 212 unique byte sequences across all file types. No duplicate was removed.

| IDs | Identical original names | Proposed future canonical basename |
| --- | --- | --- |
| A007 / A011 | `Basic Furniture.png` / `Basic_Furniture.png` | `Basic_Furniture.png` |
| A008 / A012 | `Basic Grass Biom things 1.png` / `Basic_Grass_Biom_things.png` | `Basic_Grass_Biom_things.png` |
| A009 / A013 | `Basic Plants.png` / `Basic_Plants.png` | `Basic_Plants.png` |
| A010 / A014 | `Basic tools and meterials.png` / `Basic_tools_and_meterials.png` | `Basic_tools_and_meterials.png` |
| A016 / A017 | `Egg item.png` / `Egg_item.png` | `Egg_item.png` |
| A020 / A021 | `Simple Milk and grass item.png` / `Simple_Milk_and_grass_item.png` | `Simple_Milk_and_grass_item.png` |
| A022 / A023 | `Wood Bridge.png` / `Wood_Bridge.png` | `Wood_Bridge.png` |
| A185 / A190 | `present animation aseprite file.png` / `present red.png` | `present red.png` |

The first seven pairs are in Sprites Basic; the last is in Sorry/winter. Full hashes are recorded in the inventory. The canonical choices are proposals only; samples may deliberately reference the other verified alias.

Decoded visual hashing normalizes RGB only where alpha is zero, retains dimensions and visible RGBA pixels, and compares every image frame in order. It found the same eight duplicate groups, with no additional same-dimension pixel-identical files. It does not compare animation durations; those are separately recorded. A060 is additionally an **exact nearest-neighbor 4× enlargement** of A061, verified pixel-for-pixel after scaling. Retain the smaller glyph reference privately; the large preview need not ship.

The same-size near-image scan found 59 candidate pairs (mean RGB difference below 12/255 and fewer than 35% changed pixels after compositing onto a neutral background). These thresholds are triage aids, especially unreliable for sparse transparent sheets. They do not establish duplication. All pairs and metrics are in `inventory.json`; visual review identified the following meaningful families:

| Family | Finding / disposition |
| --- | --- |
| Soil A035–A039 | A035 is 128×128; others are 176×112. Narrow/wide and v2 edge layouts visibly differ. Do not collapse by normalized filename. |
| Crop A151/A152 | Same canvas, different watering/ground treatment; 10.38% of pixels differ under the scan. Keep both originals; choose one runtime treatment. |
| Grass A163–A170, snow A192/A193 | Numbered/color/texture alternatives. A168 is 160 pixels wide; most counterparts are 176. Do not assume positional compatibility. |
| Buildings A197–A214 | Door, grass, wall brightness and roof-color variants; separate shadows A196/A206/A210. Small changes are meaningful compositing choices. |
| Chests A015 vs A155–A162 | Similar subject; Basic frame pitch is 48×48, Sorry is 32×32, with different palettes. Not aliases. |
| Frogs A153/A154; bees A141/A144; bats A114/A116 | Color/size variants; not duplicate sheets. |
| Fishing A132–A134; fish A130/A138/A139 | Facing/size alternatives; sparse sheets can score deceptively similar. |
| UI A088 vs dedicated component sheets | Composite atlas repeats subject matter from component sheets. No exhaustive subrectangle equivalence established; choose dedicated sheets where useful. |
| UI inventory A049/A054/A055 and examples | Overlapping components, palettes and assembled examples; six-slot and seven-slot bars are distinct. |
| Cursor A084–A086 | Similar triangles with different visible outline/shadow pixels. |
| Gift A185–A190 | Color/pattern alternatives; only A185/A190 are exact duplicates. Do not inherit timing for all recolors without verification. |

No exhaustive scale-invariant, cropped-region or perceptual duplicate proof is claimed. Preserve alternate versions until visual selection is approved.

## Geometry, packing and animation findings

Coordinates are top-left source pixels; rectangles use `x, y, w, h`. Bounds reported as `[left, top, right, bottom]` in raw measurement files have exclusive right/bottom. Transparent padding inside a frame differs from a packing gutter between frames.

| Family | Observed layout and limits |
| --- | --- |
| Terrain | Grass A033 is 11×7 base units of 16×16; Hills A034 is 11×9. Soil A036–A039 is 11×7. These modular layouts include empty regions and components; a grid cell is not automatically a distinct sprite. |
| Basic character | A002: 48×48 frames, 4×4. A001 actions: 48×48, 2×12. Repeated facing/action rows; timing and exact playback grouping absent. |
| Animals | A004 chicken: 16×16, 4×2 canvas, six populated cells. A005 cow: 32×32, 3×2, five populated cells. |
| Crop sheets | Basic A009/A013 is 6×2 cells of 16×16. Sorry A151/A152 is 112×528 on 16-pixel alignment, with mixed-height growth stages. Top tall crop stages span 32 pixels; cutting every 16 pixels clips artwork. |
| Slime | A117 is 456×304; visually consistent candidate pitch 38×38, 12×8 with variable populated row lengths. Action group boundaries/timing remain unverified. |
| UI slots | A044 uses 48×48 pitch, 3×3; visible sprite extents vary. First visible shape is 30×32 at (9,9); larger lower-row shape is 42×44 at (3,98). |
| UI buttons | A065 filename `19x26`: actual observed pitch 32×48, 4×2; first visible extent 18×30 at (7,9). A066 `26x19`: pitch 48×32, 2×4. A067 `26x26`: pitch 48×48, 2×4; first shape including shadow is 26×28. Filename dimensions are not authoritative crop dimensions. |
| Large UI button | A089 uses 96×32 cells, 2×2. Blank vs PLAY rows; partner columns differ in shading/vertical extent. First visible shape 90×27 at (3,2), partner 90×25 at (99,4). |
| Emotes | A073: 32×32 pitch, 5×15 canvas, variable populated row lengths. Timing/expression labels absent. |
| Houses | Small houses/huts: 64×64 composition cells, 3×3. Brick houses: 96×80, three across. Door strip A215: 48×48 pitch, eight across. These are not uniformly 16×16 sprites. |
| Fishing/swimming | 48×48 observed/candidate frame pitch; fishing has varying row lengths, swimming 8×8. Rod/splash overlays need separate mapping. |

The measured regular frame/cell families have zero outer *packing* margin and zero inter-cell gutter; many contain large transparent padding and blank cells. That statement does not extend to irregular UI atlases, terrain component groups, screenshots or every crop region. No universal 9-slice insets, cursor hotspots, collisions, sprite pivots, terrain bitmask numbering, or per-species growth map was supplied. The catalog records a layout note for every source file.

Verified animation metadata:

| Resource | Canvas / layout | Frames | Embedded timing | Other metadata |
| --- | --- | ---: | --- | --- |
| A030 bitmask reference GIF | 540×540 full demo scene | 183 | 100 ms/frame | GIF loop 0 (indefinite) |
| A113/A115 bat GIFs | 64×64 full previews | 16 each | 100 ms/frame | Loop 0; no verified PNG frame correspondence |
| A218 Teemo / A220 test GIFs | 800×608 / 432×400 labeled demos | 8 each | 100 ms/frame | Loop 0; not direct production sprite strips |
| A179 → A180 Christmas tree | 48×64 source; 384×64 PNG | 8 | 100 ms/frame | All eight export crops matched; no tags |
| A182 → A181 fire | 16×16 source; 256×16 PNG | 16 | 100 ms/frame | All 16 export crops matched; no tags |
| A184 → A185 present | 16×16 source; 160×16 PNG | 10 | 100 ms/frame | All ten export crops matched; A190 exact alias; no tags |
| A026 palette | 16×7 editor canvas | 1 | 100 ms stored | Static palette, not an animation |

For the three winter PNGs, horizontal left-to-right order and per-frame durations are verified independently from the editor source. Absence of tags leaves intended looping/one-shot behavior unknown. Aseprite's editor grid is 16×16 in all four files; it does **not** make the Christmas-tree frames 16×16.

Other motion-bearing PNGs include character/tool actions, chicken/cow poses, chest states, continue indicator, emotes, bats/slime, fish/fishing/swimming, bees/frogs, campfire, gift recolors, village doors and test characters. These have no embedded playback timing. Crop growth, heart fills, button states, roof colors and terrain alternatives should be treated as static variants unless a deliberate game interaction changes them.

## Audio and font findings

Audio accounts for **93.05%** of current asset bytes. Twenty WAVs are 7.967347 seconds and 702,764 bytes each; `phone_1.wav` and `phone_2.wav` are 24.964354 seconds and 2,201,900 bytes each. All are 22,050 Hz stereo 16-bit PCM; left/right channels are sample-identical, so mono encoding could avoid redundant channels in approved derivatives. No byte-identical WAVs were found.

An amplitude scan used 100 ms windows and an approximate −40 dBFS threshold. Above-threshold activity ends around 0.1–1.6 seconds for most non-phone effects and around 6.3 seconds for phone effects, with long quiet tails. These are **not safe trim boundaries**: low-amplitude decay can remain. Audio was not auditioned; the catalog keeps original labels (`bing`, `bip`, `blup`, `boo`, `flute`, `phone`, `punch`, `squick`) without inventing event meanings. Review by ear before selecting effects, trimming, normalizing, or encoding browser delivery formats. Sound and animation are deferred in the current design skeleton.

The TTF reports `pixelFont-7-8x14-sproutLands Regular`, version 1.0, designer Cup Nooble, 82 glyph records, 2304 units/em. It has no copyright/license-description/license-URL name records (0/13/14), and no separate font license file was supplied. Its glyph preview is a reference image, not a documented atlas map. Full Unicode coverage, rendering at small CSS sizes, browser embedding rights, and accessibility suitability remain to be reviewed. Use readable real text and an existing system-font fallback in the first prototype; do not require this font for letters or score comprehension.

## Licensing and repository exposure

Original notices are preserved at their existing paths and already transcribed in [docs/license.md](docs/license.md). They are custom terms, not a general open-source asset license. Attribution recommendation: **“Sprout Lands assets by Cup Nooble”**, linked to [the creator](https://cupnooble.itch.io/) and each used pack. Keep all applicable notices with selected runtime assets and keep art out of any blanket code-license grant.

| Pack | Supplied notice | Upstream verification / unresolved issue |
| --- | --- | --- |
| Sprites Basic | Allows modification and non-commercial projects; forbids pack redistribution/resale, NFTs and AI training; explicitly allows redistribution of created projects, including open-source projects, with credit and terms. | [Asset Pack page](https://cupnooble.itch.io/sprout-lands-asset-pack) distinguishes Basic/non-commercial and Premium/commercial use. Its shorter redistribution wording is broader than the bundled project exception. Confirm selected public-web/source scope if needed; do not treat complete pack copies as a game. |
| UI Basic | Allows modification and non-commercial use; forbids redistribution/resale even modified; directs commercial users to contact the artist or get Premium. No explicit project/open-source exception. | [UI Pack page](https://cupnooble.itch.io/sprout-lands-ui-pack) also restricts redistribution and asks for credit. Obtain clarity on public browser delivery, public source and font embedding. Purchasing Premium does not itself remove the redistribution restriction. |
| Sorry | Bundled “Basic Pack” terms match Sprites Basic license section after whitespace normalization. | [Sorry Pack page](https://cupnooble.itch.io/sorry-package#comments) has creator replies allowing commercial games, which conflict with the bundled non-commercial restriction. Preserve both pieces of evidence; confirm applicable terms rather than silently overriding the supplied notice. |

Upstream pages were read October 22, 2026. Edition names are not proof of payment/entitlement. No commercial approval was found among local files. `docs/license.md` says all three packs require attribution; the UI readme has no explicit credit clause, while its page requests credit. Retaining credit for all three is the recommended policy, not an assertion that the UI readme contains the same clause as the other two.

Read-only GitHub metadata confirms [Regniwekim/regniwekim.github.io](https://github.com/Regniwekim/regniwekim.github.io) is **public**, default branch `main`. Its live recursive tree (`0c05705da9712bad45eac68a9f863e358cd744c4`, not truncated) lists all 220 current asset paths, including art, audio, font, editor files and readmes. No binary asset was downloaded through GitHub during the check.

Local HEAD at inspection: `82ac1ce707e78176da5236fe2436ffbdd08cfbdd`, branch `codex/wordstead-license-without-zips`. Commit `f2425eb` added three ZIPs:

| Historical archive | Bytes |
| --- | ---: |
| `wordstead/assets/Sprout Lands - Sprites - Basic pack.zip` | 306,593 |
| `wordstead/assets/Sprout Lands - UI Pack - Basic pack.zip` | 143,623 |
| `wordstead/assets/Sprout Sorry pack.zip` | 1,104,091 |

Commit `13e40ad` removed ZIPs from the then-current tree. The adding commit remains reachable from local `main`, `origin/main` and both Wordstead branches/remote-tracking refs. Removal from a later commit does not remove earlier blobs or copies in clones. No remote fetch, history rewrite, deletion or force-push was performed.

**Risk:** the repository exposes substantially complete standalone packs, beyond the selected art needed by a developed game. The supplied notices prohibit redistribution of the pack itself. This is an exposure requiring review, not a legal determination about infringement or a claim that all game-embedded assets are forbidden.

The root instructions identify Pages publishing from `main` `/`. That makes tracked source assets candidates for web exposure, even without a Wordstead homepage link or an `index.html`. Current production URLs/deployment status were not probed; Pages settings were not changed or reconfigured. `robots.txt`, `noindex`, hidden links, Git ignore rules and Git LFS do not provide access control or erase history. Asset-packing or obfuscation cannot prevent browser users extracting shipped art.

Recommended response: retain private originals outside the repository, review permissible selected game use, and separately approve a repository remediation plan. That plan may include untracking excluded sources, history/branch/archive cleanup and GitHub-hosted artifact/cache review; it must consider collaborators and other games. Do not rewrite history or change Pages configuration as an incidental asset cleanup. See the organization plan for the proposed boundary.

## Validation and remaining limits

Executed source-file decode/header checks for all 220 files, full worktree SHA-256 inventory, byte/visual duplicate scans, 59 near-match comparisons, all GIF-frame decodes, all WAV sample/channel scans, TTF metadata parsing, Aseprite metadata parsing, and 34 Aseprite-to-PNG frame comparisons. All source reads completed without decode errors.

The companion validator passed 661 data-integrity checks: source paths/counts/hashes against the snapshot, catalog coverage, rectangle bounds/nonempty pixels, source and pack references, animation timing correspondence, local schema references, preview coverage and existence, and generated JSON parsing. All 220 source files retained their original worktree hashes. `git diff --check` passed; all 16 new audit text/data files also passed individual Git whitespace checks with CRLF recognized as line endings. The [validation report](asset-audit/validation-report.json) records the results. Full standards-engine JSON Schema validation is not claimed; no JSON Schema library was installed.

No game/page behavior changed, so homepage navigation, touch/keyboard interaction, 30-second Target Tap rounds and runtime browser console tests were outside this audit. No audio listening, device performance profiling, exhaustive crop/species labeling, complete atlas extraction, full subimage duplicate search, browser font test, artist contact, purchase verification, live Pages URL check, history remediation or legal clearance was performed.

The remaining integration decisions are intentional: license/public-source scope, private source location, approved runtime subset, canonical terrain style, feature footprints/overhang, UI palette and scaling, unknown animation semantics/timing, and audio/font use. The plan makes those decisions concrete without reorganizing assets.
