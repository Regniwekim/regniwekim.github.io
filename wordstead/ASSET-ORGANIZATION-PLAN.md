# Wordstead asset organization plan

Proposed October 22, 2026. **No existing asset is moved, renamed, deleted, overwritten, untracked or integrated by this plan.** The [audit](ASSET-AUDIT.md) and [catalog](ASSET-CATALOG.md) describe the current snapshot.

Implementation began later on October 22 with explicit owner approvals. The [progress record](asset-organization/README.md) is the current state: private originals are verified, the full working-tree pack folders are removed, original notices are retained, and an approved private starter export exists. Public release, history cleanup, logical feature footprints and UI delivery permission remain unresolved. The proposal below is retained as the design rationale.

## Preserve originals privately; ship a selected game subset

Keep original extracted pack directories and any retained downloaded archives in a private location **outside every public repository and Pages publish root**. Preserve spelling, directory structure, readmes, palette/editor sources and all alternatives there. A private backup should retain original archive/asset hashes, download date, receipts or written permissions and pack source links. Do not move anything until the location and copy verification are approved.

Example private layout (location to be chosen by the owner):

```text
<private-wordstead-art>/
  cup-nooble/
    originals/
      Sprout Lands - Sprites - Basic pack/  # exact extracted originals + read_me.txt
      Sprout Lands - UI Pack - Basic pack/
      Sprout Sorry pack/
    downloads/                            # original archives, if retained
    entitlement/                          # receipts and permission correspondence
    provenance/                           # hashes, dated source/license records
    previews/                             # audit contact sheets, never public
    exports/                              # selected delivery artifacts for review
```

The public Wordstead tree should contain gameplay code, text provenance, applicable notices and **only approved assets used by the game**. A directory named `private` inside a public repository is not a privacy boundary. Git LFS also exposes downloadable objects. A private source repository does not make a publicly deployed Pages site private.

Keep original spritesheets intact in private storage. For runtime, prefer intact *selected small sheets* when the license and amount of unused art make that appropriate. If a large mixed sheet would publish substantial unused artwork, make one curated atlas containing only selected regions after approval. Record every original path/hash/rectangle and the new atlas rectangle. This balances provenance, browser request count and limited distribution without exporting hundreds of individual files. An atlas is a performance choice, not a substitute for permission.

## Proposed runtime directories

This is an illustrative target structure, not a list of files approved for shipping:

```text
wordstead/
  index.html
  assets/
    sprites/
      registry.json                       # only runtime-approved mappings
    vendor/
      cup-nooble/
        sprout-sprites-basic/
          terrain/                        # selected Grass / one soil family
          crops/                          # selected Basic_Plants.png or curated crop atlas
          animals/                        # selected chicken/cow sheets
          buildings/                      # selected coop or building regions
          props/                          # only selected decorations
        sprout-ui-basic/
          ui/                             # selected slot/button/icon sheets or atlas
          fonts/                          # only if embedding is approved and needed
        sprout-sorry/
          environment/                    # selected additions; not all Early Access
          buildings/
          effects/
          audio/                          # selected, reviewed delivery encodings
    wordstead/                            # original Wordstead art/CSS assets
  licenses/
    cup-nooble/
      sprout-sprites-basic/read_me.txt
      sprout-ui-basic/read_me.txt
      sprout-sorry/read_me.txt
    ASSET-CREDITS.md                       # artist, source links, license scope/exclusions
  asset-audit/                            # text/metadata only; previews remain private
```

Use the pack as the first provenance boundary and category inside it. Do not flatten all three packs into generic `sprites/` directories with ambiguous filenames. Runtime identifiers such as `animal.chicken.pose-0` provide consistent names independently of historical file spelling.

Files remain relative to Wordstead. Resolve image paths against the Wordstead entry URL, support direct `/wordstead/` loading and refresh, and retain root crawler restrictions and `noindex, nofollow` when an entry page is eventually built. This plan does not create an entry page or edit arcade navigation. Do not require a production server, framework or build service for asset lookup.

## Filename and duplicate rules

1. Preserve original basenames for intact selected sheets. Spaces, capitalization and the author's spelling are acceptable; browser URL construction must encode paths correctly. Do not rename files merely to correct `Charakter`, `Biom`, `Tilset`, `Herat`, `meterials`, `smal`, `snomwflakes`, or other historical spellings.
2. Use lowercase kebab-case for **new** Wordstead exports and directories. Give a derived atlas a purpose name such as `farm-features.png`, scoped under its originating pack. If an atlas combines packs, preserve per-region pack/source metadata; a single directory label is insufficient.
3. Never merge by normalized filename, visual resemblance, version suffix, file size or a matching dimension. Require a full hash match for exact file aliasing. Keep every original in private storage.
4. A future selected export can reference one of each exact duplicate pair. Prefer A011, A012, A013, A014, A017, A021, A023 and A190 as canonical copies. Keep an alias table with both original paths and SHA-256. Do not delete current aliases during this pass.
5. Keep v2/wide, watered/unwatered, tinted, door/grass/shadow and palette variants separate until art selection. `Tilled Dirt.png` and `Tilled_Dirt.png` are different images. Basic chests and Sorry chests require different frame rectangles.
6. Keep the font PNG reference and large 4× preview private; neither is required to use a font. Keep `.aseprite`, demo GIFs, reference diagrams, screenshots, unused audio, archives and test characters out of routine runtime exports.

## Registry and integration strategy

Use a plain JSON registry with explicit pixel rectangles, source dimensions/hashes and pack attribution. See [schema](asset-audit/sprite-manifest.schema.json), [sample](asset-audit/sprite-manifest.sample.json) and [guide](asset-audit/SPRITE-REGISTRY.md). The audit sample references current original paths to make verification possible; it is explicitly unsuitable as a production asset allowlist.

Do not generate the registry by globally slicing at 16×16. Uniform sheets can generate rectangles from an individually verified frame pitch; irregular sheets require explicit complete regions. Record `null` for unknown coordinates/timing, and exclude unresolved entries from runtime data. Only the three verified winter exports currently have source-backed per-frame timing; they demonstrate the format without expanding MVP scope.

Retain full source frames and transparent padding initially, so animation anchors do not shift between poses. If trimming later saves a meaningful amount, extend each entry with original canvas size and trim offset; do not silently change anchors. Derive render scale from view layout rather than source size. Choose pivots, overhangs, 9-slice insets and button state semantics in a visual integration review; the audit does not assert those values.

For a future curated atlas, keep a private provenance map of `{originalPack, originalPath, originalSha256, originalRect, exportPath, exportRect}`. Browser runtime needs only selected source metadata/attribution, not editor files, receipts or the full inventory. Add real atlas gutters/extrusion only if the renderer's scaling/filtering needs them, and record new coordinates explicitly. Never reinterpret an original rectangle as an exported one.

## Wordstead rendering and responsive UI

The design's configurable rectangle and initial 15×15 board should be represented entirely in logical `{row, column}` coordinates. Store terrain, a feature ID and letter/claim state in the game model. Resolve feature IDs into art only in the renderer. Territory scoring, word placement, flood fill, adjacency and seeded generation must never depend on image width/height or opaque pixels.

For a viewport cell size `s`, board origin `(ox, oy)` and pan `(px, py)`, the cell origin is `(ox + px + column*s, oy + py + row*s)`. Canvas rendering can draw any verified source rectangle into an independently calculated destination rectangle. Convert pointer coordinates using the inverse view transform; account for CSS-to-canvas/device-pixel scaling separately. Clamp logical indexes to the configured row/column counts. Changing the view scale must not change a saved puzzle or score.

Artwork units and occupancy are separate. The 48×48 coop spans 3×3 source-art units of 16, but could represent a one-cell bonus with overhang, a compact scaled icon, or an explicitly modeled multi-cell feature. The design owner must choose. The manifest's `artTileSpan` records the first fact; `logicalFootprint` stays null until a game design decision exists. Multi-cell game features must reserve their cells explicitly, independently of shadows and canopy dimensions.

Recommended presentation order: terrain → claim/fertility overlay → feature/decorations → fence/letter tiles → focus/selection and placement feedback. Keep letter glyphs and selection boundaries readable above art. Use one low-contrast terrain family, a small set of crops, chickens/cows and a coop for the first visual prototype. Decorative trees, bridges and large houses can sit outside playable cells or use approved overhang rules. Dungeon, ocean and seasonal sets are optional expansions, not requirements for Wordstead.

The seven-letter rack should be seven semantic DOM controls with live letter text, selected/disabled states, visible focus and accessible labels. A044 slot shapes or A064/A067 buttons can decorate them. A047/A052 contain seven painted slots, while A048/A053 have six; do not use a fixed inventory PNG as the rack layout. At very narrow widths, use two rows or accessible horizontal scrolling instead of shrinking all seven hit targets below a comfortable size. Aim for at least 44×44 CSS-pixel controls. Use tap-select/tap-place and keyboard support alongside drag interactions.

A 15-column board fitted onto a small phone cannot give every cell a large touch target. Provide zoom/pan or another clear focused placement interaction, rather than reducing source sprites to make the logic grid smaller. Use crisp nearest-neighbor scaling for pixel art, favor integer display scales where feasible, and verify letter legibility at all zoom levels. Account for device-pixel ratio in the renderer; do not ship duplicate 2×/4× source art merely to support high-density displays.

Menus should use real HTML text on blank panel/button art. Do not stretch embedded PLAY/SETTINGS labels or assume UI state colors convey meaning alone. Score/target progress must remain numeric and programmatically available; stars/hearts can supplement it. Use a readable fallback font and verify contrast/focus states. Desktop layouts can place information beside the board; mobile layouts can place compact progress above it and a stable rack below it without imposing a square board.

Start with static feature art and short state transitions. When motion is introduced, use event-driven one-shot feedback and pause offscreen/hidden animations. Respect `prefers-reduced-motion` with a static fallback and avoid constant movement behind letter tiles. Do not invent timing to make an unverified strip playable; record a deliberate design timing separately from source metadata if later approved. Audio should be optional, start only after user interaction, and have a mute control; select and audition before trimming/mono encoding/compression. None of those derivatives is made in this audit.

## Public repository and deployment boundary

The current repository is public and already contains all three extracted packs on `main`. Three original ZIPs survive in history. `.gitignore` cannot untrack them or remove historical blobs. The audit's private previews are outside Git precisely because they reproduce the artwork for browsing.

Before a public integration, obtain an applicable license basis for each selected asset, especially UI/font browser delivery and the Sorry pack's conflicting commercial wording. Keep credits/notices with the exported subset and exclude vendor art from the project's code-license grant. Browser-delivered art is necessarily downloadable; a minified atlas, private storage bucket with public URLs or encrypted bundle is not a legal or technical substitute for permission. If suitable rights cannot be confirmed, use original Wordstead art or assets with explicitly compatible terms for public delivery.

Repository remediation needs separate approval because it can affect public URLs, other games, branch history and collaborators. First make verified private backups. Then review current tracked originals, every branch/ref, historical ZIPs and possible release/CI/Pages artifacts or caches. Agree on a coordinated cleanup before any untracking/history rewrite or hosting change. This pass does not claim that a later deletion can retract copies already downloaded.

Do not change Pages, `CNAME`, workflows, domain/DNS settings, root arcade assets or other games during this work. If a future export workflow is desired, propose an explicit file allowlist and validate the artifact contents before publishing; introducing a workflow or changing publication source requires its own authorization.

## Decisions requiring approval before reorganization

| Decision | Recommended starting choice | Why it needs an owner decision |
| --- | --- | --- |
| Private originals location/backup | Outside the public repository and publish root; verify copied hashes | Chooses storage and moves ownership of the master copies |
| Public exposure remediation | Coordinated plan covering tracked copies and historical ZIPs | Untracking/history/hosting changes exceed this audit and can affect collaborators/URLs |
| Applicable licensing | Preserve supplied terms; confirm UI/font public delivery and Sorry commercial scope | Existing evidence is incomplete or conflicting; no purchase entitlement was supplied |
| Runtime subset and aliases | Basic grass, one soil style, small crop set, chicken/cow/coop; eight exact alias choices above | Determines which art is used and distributed |
| Board-feature footprint | Prefer compact one-cell bonuses initially; explicitly approve any multi-cell logic/overhang | Artwork dimensions do not determine Wordstead rules |
| UI family and text | A044 modular slots, blank buttons, real text and readable fallback font | Palette, scale, accessibility and font choice need visual review |
| Motion/audio | Static MVP; verify semantics, audition sounds, then approve selected effects | Most strips lack source timing; audio has quiet tails and is deferred by the design |

After those approvals: copy/verify private originals, review repository remediation independently, prepare a small local selected export and provenance map, update the registry against those export paths, preview a rectangular board/rack at narrow and wide sizes, verify direct loading/input/console errors, and only then consider any separately authorized commit or deployment. This audit performs none of those reorganization or release steps.
