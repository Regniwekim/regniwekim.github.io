# Wordstead — Visual Identity & Asset Production Guide
**Status:** Exploration / v0.1 · October 22, 2026  
**Design anchor:** “Build a farm, one word at a time.”  
**Reference:** [Sprout Lands — Asset Pack](https://cupnooble.itch.io/sprout-lands-asset-pack) by Cup Nooble; complementary [Sprout Lands — UI Pack](https://cupnooble.itch.io/sprout-lands-ui-pack).

> **North star:** The world should feel like a tiny, peaceful farm. The mechanics should read as clearly as a great word puzzle. The interface should never make the player choose between atmosphere and legibility.

## 1. Art direction

- **Tone:** cozy, playful, tactile, patient, welcoming; modestly whimsical, not infantile.
- **Visual medium:** soft 2D top-down pixel art in harmony with Sprout Lands; clean responsive web UI on top.
- **Hierarchy:** letter glyphs → legal/illegal placement → enclosure boundary and captured features → score/word count → environmental decoration.
- **Density:** detail lives in the environment, not on letter faces or inside compact controls.
- **Interaction:** subtle physical response (lift, settle, tiny bounce) rather than particles, screen shake, or strong blur.
- **3/4/diorama feeling:** may be suggested by a raised board frame or shadows. Keep the actual 15×15 word grid orthographic to preserve read speed and touch targeting. Reserve any tilt-shift-style effect for nonessential out-of-focus scenery, never the board or letters.

## 2. Working palette

These are **Wordstead proposals inspired by** the pack's visual character, **not exact sampled Sprout Lands swatches**. Confirm against the actual downloaded assets before lock.

| Role | Name | Hex | Use |
|---|---|---|---|
| Grass primary | Meadow | `#BDD27E` | Gameplay field and decorative greens |
| Primary dark | Fern | `#4A6452` | Brand, headings, UI controls |
| Supporting green | Sage | `#91AA85` | Secondary panels, vegetation accents |
| Warm light | Cream | `#F5E8C8` | UI background and card surfaces |
| Tile face | Oat Tile | `#F0D7AF` | Rack and placed letter tile faces |
| Wood | Fencewood | `#A67C61` | Tile rims, fence posts, borders |
| Water | Pond | `#92CFC4` | Water features and minor accents |
| Warm accent | Berry | `#C98189` | Flowers, playful highlights, feedback (not sole state marker) |
| Text | Dark Ink | `#354C43` | Core UI and letter glyphs |
| Claim feedback | Pale Harvest | `#DCE9B6` | Newly claimed cells, highlight flash |
| Reward accent | Honey | `#E9C06D` | Bonuses, earned points, harvest sparkle |
| Warning | Clay Red | `#B65E58` | Invalid placement + icon/text label |

**Contrast sample (WCAG calculation):** Dark Ink on Cream ~7.62:1, on Meadow ~5.60:1, on Oat Tile ~6.64:1. Don't set small cream/white text against meadow; it is too low-contrast.

**Ratio guideline:** 60% green & grass, 25% cream / oat / wood, 10% dark ink, 5% accents. On screens dominated by a 15×15 grid, reduce background saturation behind glyphs.

## 3. Identity / logo explorations

**Preferred direction — Letterpress Farm:** “WORD” set as individual soft wooden letter tiles, “STEAD” as a friendly custom pixel wordmark. A small sprout and a few fence posts unite language and landscape. Must still be recognizable with embellishments removed.

Other directions to test:
- **Meadow Sign:** single friendly wordmark over a subtle fence rail or wood sign (more farm-like, less puzzle-specific).
- **Country Puzzle Club:** restrained single-line identity on deep fern, cream typography (excellent small-screen utility, less memorable).

### Logo package to produce

1. **Primary** horizontal `WORDSTEAD` logo, transparent background; with and without tagline.
2. **Stacked** lockup for splash/landing display.
3. **One-color** dark and light marks for accessibility and inexpensive rendering.
4. **Small icon** that combines a W or letter tile with a tiny fenced square / sprout; test at 16, 32, 48, 192 and 512px.
5. **Safe space** and minimum-size rules; prohibit micro-details inside tiny favicons.

### Typography

- **Custom display:** chunky, friendly pixel-style lettering; little to no distressed texture. Test against **Pixelify Sans** as a working placeholder (check font license before distribution).
- **Functional UI:** highly legible web font such as **Nunito Sans** or **Atkinson Hyperlegible**; prioritize numerals and distinct I/l/1, O/0. Avoid tiny all-pixel text in the HUD.
- **Letter tiles:** rendered as **text glyphs** using CSS/canvas atop pixel-art frames, not necessarily 26 tiny baked bitmap glyphs. Gives crisp letters on responsive 15×15 boards and makes localization easier.
- **Sentence case** for most controls; reserve all-caps for rack letters, labels, and the wordmark.

## 4. Interface behavior and art usage

**Game screen priority (mobile):** compact score/progress and words-used at top → main navigable board → fixed seven-letter rack → exchange / submit / undo / options. The board is the hero; the full logo belongs to launch/menus, not the gameplay HUD.

**Two visual layers:**
- **World layer:** pixel-art grass, plants, animals, buildings, occasional pebbles/flowers, claimed land tint, subtle fence connections.
- **Puzzle layer:** precise grid, placed letters, ghost letter previews, selected rack tile, legal/illegal feedback, zoom controls, readable score. Puzzle layer may be rendered at device resolution while sprites scale with nearest-neighbor filtering.

**Letter tile states** (all must be visually distinct): in rack, hovered/focused, selected, ghost preview, valid preview, invalid preview, committed. Mark invalid with an icon/outline and textual status, not red alone. Avoid a prominent point value on letter faces: the current design scores territory, not Scrabble letter points.

**Enclosure reveal:** highlight claimed cells in a short staggered wash, show a modest harvest sparkle around captured feature(s), then increment target progress. Previously claimed land remains distinguishable without continual animation.

**Grid clarity:** fences/connection rails should frame or underlay tiles without crossing glyph strokes. Since each orthogonally connected letter contributes to a fence, consider a procedural cardinal-neighbor connector system (4-bit/16 masks); an atlas is an alternative. This is a presentation choice, not a change to the territory rules.

## 5. Asset inventory / production backlog

Legend: **Reuse** = evaluate Sprout Lands art; **Adapt** = modify a fitting licensed UI/world asset; **Create** = Wordstead-specific. Actual pack coverage must be audited from the ZIP; promotional screenshots are not a complete inventory.

| Priority | Asset family | Deliverables / states | Source approach |
|---|---|---|---|
| P0 | Core word tiles | Face, rim/shadow, hover/focus, selected, ghost/valid/invalid, committed | Create; CSS/canvas glyphs |
| P0 | Board ground | Base grass/soil, seams or subtle grid lines, claimed-land overlays | Reuse + Adapt |
| P0 | Fence connection treatment | Horizontal/vertical/corner/junction options, or procedurally drawn connectors | Create |
| P0 | Farm gameplay symbols | Crop, livestock, building, fertile land; uncaptured/captured emphasis | Reuse + Adapt |
| P0 | HUD surfaces | Progress/goal, words-used counter, rack tray, tile bag/exchange, menu, dialog | Adapt UI pack + Create |
| P0 | Feedback indicators | Legal/illegal word, not-in-dictionary, placement focus, achievement, exhausted moves | Create |
| P1 | Logo system | Primary, stacked, monochrome, short emblem, favicon, open-graph art | Create |
| P1 | Puzzle intro / result | Mode selector, seed/date label, win/lose results, grade and share graphic | Create |
| P1 | Decorative environment | Trees, water, rocks, wildflowers, paths, fences, buildings | Reuse pack where included |
| P1 | Farm reactions | Crop sway, livestock blink/bob, capture sparkle, number pop, tile place/remove | Adapt + Create |
| P1 | Audio identity | Tile pickup/settle, word accepted/rejected, land claimed, bonus harvested, menu clicks | Create/license separately |
| P2 | Daily/campaign art | Daily marker, challenge card, stage/chapter maps, achievement graphics | Create |
| P2 | Seasonal looks | Alternate meadow accents / decor with unchanged game readability | Adapt + Create |

### Recommended first custom-art production batch

1. **Logo exploration:** three sketches; select one and validate at favicon size.
2. **Word tile system:** a single tile family with seven gameplay states plus text-glyph rendering.
3. **One complete farm cell set:** ordinary grass, occupied letter, captured land, crop feature, building feature, fertile patch.
4. **Fence connection test:** clear on 15×15 desktop *and* 390px phone viewport.
5. **HUD sample:** seven-letter rack, goal progress, word count, exchange, settings.
6. **One micro-interaction each:** tile settle, successful enclosure, feature harvest.

## 6. Deliverable format and style rules

- Export source sprites as editable native pixel-art files (e.g. `.aseprite`) plus transparent PNG atlases/sheets. Preserve the originals separately from Wordstead modifications.
- **Do not assume all spritesheets must be physically split:** use atlas rectangles or texture coordinates when your renderer supports them; keep metadata for each frame and animation. Generate trimmed standalones only where UI tooling benefits from them.
- Verify **actual sprite cell size**, transparent margins, frame order, anchors, animation timings, and palette using the downloaded archive. The author describes the style as “16-bit”; this is not necessarily a claim that all tile cells are 16×16 pixels.
- Prefer integer scaling and nearest-neighbor sampling for actual pixel sprites; use native-resolution text for glyph clarity.
- Keep animation short and calm; respect the operating system's reduced-motion preference.
- Check all important states without color (shapes, outlines, icons, labels) and under color-vision deficiency simulation.
- Provide sprite attribution and track each reused/modified asset's source. **Sprout Lands free pack is noncommercial-only**; the premium license permits commercial use but forbids asset redistribution/resale. The separate UI pack has its own similar free/premium distinction. Budget for the appropriate versions if the game might be monetized.

## 7. Visual sign-off tests

- Can players read a dense 15×15 board at minimum-supported mobile width using zoom/pan and focus controls?
- Can players tell newly claimed from previously claimed land without relying on color alone?
- Can players spot a crop, animal, building, and fertile cell at typical gameplay scale?
- Does the logo remain identifiable at 32px favicon scale?
- Are tile connections and the word glyph both legible, even at intersections?
- Is feedback gentle enough that repeated placements stay satisfying rather than tiring?

## 8. Decisions still open

- Final wordmark direction and custom logo artist workflow.
- Whether background board art uses grass-only, grassy plots with occasional soil, or a patchwork of both.
- Whether Sprout Lands UI Pack is purchased/adapted versus drawing matching UI from scratch.
- Exact native sprite sizes and exported source format, to be determined from the owned pack archives.
- Final grade names and share-card layout after scoring/efficiency thresholds are balanced.