# Board art — Milestone 5B

For the later 5C action overlay, original procedural sounds and performance results,
see [interaction feedback](interaction-feedback.md). The static renderer and
artwork contracts documented here remain intact; no vendor asset is added.

Wordstead's first implemented farm vocabulary uses quiet pixel shapes and physical
wooden letters. **Build a farm, one word at a time.** Letter glyphs and interaction
feedback lead; scenery stays behind the puzzle. This is static presentation only.

## Provenance and distribution boundary

All artwork in `src/rendering/artwork.js`, its rectangle lists and local CSS
decoration were authored specifically for Wordstead in this milestone. They use
the project's proposed palette and simple original geometric shapes. No vendor
sprite was opened, traced, sampled, extracted, copied or imported. System fonts
render letters and symbols; there are no new images, fonts, audio or libraries.

The Sprout Lands private starter is **not** runtime artwork. Its preparation
approval does not authorize public integration. Sprites Basic and UI Basic have
different recorded terms; the UI pack's public redistribution scope remains
unresolved. Future art needs a separately approved minimal runtime subset and
applicable notices. The existing [audit](../ASSET-AUDIT.md),
[organization](../asset-organization/README.md), [license scope](license.md) and
credits remain unchanged. This document makes no blanket license grant.

## Ground and feature vocabulary

| State | Static treatment |
| --- | --- |
| Unclaimed exterior | Meadow squares, occasional tiny grass blades/light patch; subdued grid |
| Enclosed but unclaimed (diagnostics) | Cream ground and dashed inset; no claim badge |
| Previously claimed | Warm cultivated ground, three furrows and ✓ |
| Recently claimed | Pale harvest furrows and +; retains the controller's existing recent-claim lifetime |
| Prospective capture | Dotted outline and cream-backed ? above original ground; no permanent fill or reward |

| Feature | Original 16×16 motif | Text clue |
| --- | --- | --- |
| Crop | Two growing stems with golden produce in a small raised plot | C |
| Livestock | Cream hen with comb, beak and two feet | L |
| Building | Wooden shed with muted rose roof, window and door | B |
| Fertile ground | Dark enriched furrows, seed flecks, seedling and small bloom | F |

Available features retain meadow ground. Captured/recently captured features keep
the same identity on cultivated/harvest ground and receive ✓/+. Prospective ? is
an outline/badge above that same artwork. No opaque capture overlay replaces a
feature. All four motifs fit one cell, with no implied multi-cell footprint.
Existing selected-cell descriptions announce type, reservation, capture and effect.

## Letters, fences and interaction states

Committed tiles have a darker wooden rim, oat face, cream top bevel, lower wooden
edge and restrained offset shadow. Large dark system glyphs remain independent
of pixel motifs. Blank provenance is a small cream-backed ◇ in the upper-left,
including after commitment. There are no letter point values.

Rack buttons use matching oat faces/bevels in a shallow wooden tray. Persistent
physical identities, 7/8/9-slot capacity, dashed empty slots, selected outline/✓,
drafted pale/dashed slots and ↗ return indicators remain intact. Drag ghosts use
the same wood language. Touch targets remain at least 44px.

Draft board tiles use paler faces with dashed rims and p; an invalid preview also
shows ×. Reuse receives =. Conflicts show × and the attempted letter, preserving
the committed glyph/feature. Selected draft tiles get an inner outline; the board
cursor has a dark outer outline with a cream halo. Drop targets render last, with
solid + for eligible and dashed × for rejected destinations. Existing textual
legality/action feedback supplements these shapes. No essential rule depends on
color or art alone.

`connectionMask(board, row, column)` returns N=1, E=2, S=4, W=8. Only explicit
committed letter cells and their orthogonal committed neighbors contribute. Each
bit draws two short half-rails beneath the tile, meeting the neighboring half at
the shared cell edge. The same four pieces cover all 16 masks: isolated, straight,
corner, T and four-way. Board edges, diagonal contact, features, empty cells and
draft/preview letters add no joins. The mask neither validates words nor detects
enclosures. Core occupancy and flood fill remain authoritative.

## Layering and artwork substitution

`board.js` retains the existing `drawBoard(canvas, view)` contract and composes:

1. `drawGround(...)`, terrain symbols, diagnostic enclosure and starting square.
2. `drawFence(..., connectionMask(...))` from the committed board only.
3. `drawFarmFeature(...)`, type/capture badges and `drawLetterTile(...)`.
4. Prospective outlines, draft faces, legality/reuse/blank badges, selected tiles,
   board cursor and drop feedback.

The artwork functions take a 2D context, cell rectangle and visual type/state;
they never modify model objects or call gameplay transitions. A future licensed
atlas can replace `drawGround`, `drawFarmFeature`, `drawFence` or tile-face drawing
at these boundaries. It must keep text and final interaction overlays separate,
preserve logical one-cell footprints, load asynchronously outside pointer input,
and retain the original primitives as a fallback. No loader/registry/plugin
framework or speculative gameplay API was added for that future work.

## Scaling, caching and determinism

Cells remain orthographic squares of **44, 56 or 72 CSS pixels** with the original
28px coordinate gutter. `cellToView`, `pointerToCell` and selection scrolling keep
their geometry. Small viewports pan inside the board; cells never shrink to fit.
Canvas backing dimensions scale by DPR; the transform uses the actual rounded
backing/CSS ratios. Ordinary redraws reuse the backing store; resize/zoom/DPR
changes allocate only when dimensions differ.

Four optional 16×16 OffscreenCanvas surfaces cache the original motifs once.
Integer 2×/3×/4× CSS scaling and disabled image smoothing keep pixels crisp;
glyphs render at native backing resolution. Unsupported/failed optional surfaces
fall back to the same rectangle commands, with textual feature clues retained.
No image decoding, per-redraw network request or continuous loop is involved.

`decorationVariant(row, column)` mixes the coordinates with fixed integer
multipliers. Repeated redraws, zoom, pan and DPR changes never rearrange details.
It reads no seed, clock, storage or `Math.random()` and cannot advance gameplay RNG.

## Validation and measurements (October 24, 2026)

The reproducible gallery is `/wordstead/scripts/board-art-qa.html`. It uses the
production renderer, existing seeded farms and CAR/CAB/RAT/BAT feature fixtures,
plus explicitly synthetic presentation states. It writes no saves. Cell-size and
backing-density controls allow inspection; density overrides emulate Canvas
backing size in this QA page only, not physical mobile/high-density hardware.
`rack-layout-qa.html` provides 7/8/9-slot samples; `daily-qa.html` retains isolated
full-controller saves and six-width controls. These pages are development tools,
not production navigation or gameplay shortcuts.

The fixed mixed 30×30 benchmark warms up 10 times then records 60 synchronous
draws with precomputed view inputs. Local preview Chromium observations:

| Cell size | DPR 1 median / p95 | Emulated DPR 2 median / p95 | Emulated DPR 3 median / p95 |
| --- | --- | --- | --- |
| 44px | 1.70 / 19.50 ms | 1.80 / 16.30 ms | 1.80 / 21.10 ms |
| 56px | 1.70 / 17.50 ms | 1.80 / 5.00 ms | 1.80 / 5.10 ms |
| 72px | 1.60 / 6.80 ms | 1.80 / 19.40 ms | 1.70 / 22.60 ms |

Before the art change, the same 44px/DPR-1 fixture measured 0.90ms median,
1.10ms p95 and 0.93ms mean. The final 44px/DPR-1 mean was 3.45ms; across all
nine cases means were 3.25–5.35ms. These are command-submission/main-thread times,
including backing-store checks, not GPU completion or frame-rate guarantees.
Synchronous batches show variable stalls; large-board p95 sometimes exceeds
16ms. Four tiny motif caches reduced the initial uncached 44px/DPR-1 observation
from 2.00ms median/4.51ms mean to 1.70ms/3.45ms. No continuous redraw was added.

Runtime HTML/CSS/renderer changes add **7,515 uncompressed bytes**, approximately
**3,105 bytes** when those resources are individually gzip-compressed locally,
and one native module request. This is a source comparison with the branch's
`origin/main`, not measured production HTTP compression. The 750,727-byte
vocabulary is unchanged. QA/docs/tests are not imported by ordinary play.

Automated renderer tests cover geometry/hit testing, every mask, diagonal/edge/
feature exclusion, preview isolation, frozen-state immutability, decoration,
all motifs and states, optional-cache fallback/reuse, backing reuse at DPR
1/1.25/2/3, blanks and overlay ordering. The full regression suite retains its
original Daily v1, save/history, vocabulary, scoring, physical tiles and rewards
expectations. `npm test` passed **317 tests** (307 existing, 10 added). Changed
JavaScript passed `node --check`; `git diff --check` passed. Core, analysis,
vocabulary, Daily v1 definitions/fixtures, active-save/history code and schemas,
input/rack controllers, asset records/notices and dependencies have no diff.

Desktop Chromium inspection covered 320/360/390/768/1024/1440px layouts without
document horizontal overflow. The game rack's minimum measured width at 320px
was 49.95px; the isolated 7/8/9-slot samples also fit every width. The gallery
showed all 26 glyphs, all feature types and capture variants, ground states,
selection, drafts, blank/reuse/conflict/drop symbols at 44/56/72px, with backing
density 1 and emulated 2/3. Features remained visible after capture.

Real-controller/browser checks exercised keyboard selection/cursor/commitment,
native pointer rack dragging, draft movement and return to its original slot,
Clear and Undo, reserved-cell rules via the fixtures, exchanges, results collapse
and completed-farm panning at 72px. CAR/CAB/RAT/BAT produced crop 4/4, fertile 2/2,
livestock capacity 8, and a building credit used by an exchange with strokes
remaining 4. Nine-slot browser QA used the isolated layout sample; actual nine-slot
reward conservation remains covered by the existing model tests.

The isolated `blank-qa-636` run assigned O, reassigned A, refreshed/restored the
three-tile CAT draft with the same blank ID 98, and committed with permanent ◇
while retaining its ordinary A in the rack. Direct `/wordstead/` loading, refresh,
the arcade return link and local resource loading were checked; inspected browser
logs contained no warnings/errors. The homepage still has no Wordstead card;
adding one remains outside this scope. Physical-device touch and assistive-tech
coverage are not claimed.

## Limits and deferred work

This is a first art pass using small geometric motifs and system-dependent glyphs.
It adds no capture timers, movement, particles, sound, audio, achievements or
animated branding. Milestone 5C owns motion work. Physical phones, actual touch
scroll negotiation, real high-density hardware, screen-reader software and other
browser engines still need separate QA. Large Canvas backing stores retain the
existing high-DPI memory cost; the tiny motif cache does not duplicate whole boards.
