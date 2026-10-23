# Wordstead architecture

Milestone 2A extends the Milestone 1 board with pure enclosure/claim rules and
an interactive development sandbox. The [design skeleton](design-skeleton.md)
governs gameplay; the [visual guide](visual-guide-v0.1.md) supplies exploratory
presentation direction. The sandbox is an arbitrary occupancy editor, not a
word-placement implementation.

## Pure core: `src/core/`

All core modules use explicit inputs/outputs with no DOM, Canvas, storage,
network, Node-specific imports, or ambient randomness. Transitions never mutate
their inputs. Logical positions never depend on pixels, DPR, scroll, or zoom.

### Board and letter occupancy

The Milestone 1 API in `board.js` is preserved:

- `createBoard({ rows = 15, columns = 15 } = {})` creates an independent dense
  row-major `cells` array filled with `null`.
- `getCellIndex(board, row, column)` validates zero-based coordinates, returning
  `row * columns + column`. Invalid coordinates throw `RangeError`.
- `getCell(board, row, column)` reads through the validated index.

Dimensions must be positive safe integers and the product must fit JavaScript's
array-length limit (2³² − 1); invalid dimensions throw `RangeError` before
allocation. Available memory limits practical sizes. Rows increase downward;
columns increase rightward. The default is still 15×15.

```js
const board = {
  rows: 3,
  columns: 3,
  cells: [null, /* ...exactly 9 cells... */],
};
const letterCell = { kind: 'letter', letter: 'A' };
```

`letters.js` adds:

- `createLetterCell(letter)` returns explicit committed letter occupancy. It
  accepts a single uppercase A–Z string; unsupported glyphs throw `TypeError`.
- `isLetterCell(cell)` recognizes the explicit `kind: 'letter'` discriminator.
  A non-null object, a `letter` property alone, or future feature metadata does
  not become a fence accidentally. Valid letter cells come from the constructor.
- `setLetter(board, row, column, letter)` returns a new board/cells array after
  replacing the chosen cell with a letter, or `null` to clear it. Coordinate and
  letter validation happen before writing. Unchanged cell objects may be shared;
  treat returned model data as immutable. This function does not validate words,
  adjacency, permanence, or legal moves. Replacing contents is intended for the
  sandbox; future feature data should live separately rather than be overwritten.

### Enclosure: `enclosure.js`

`analyzeEnclosure(board)` returns `{ exterior, enclosed }`. Each array holds
unique logical indices in ascending row-major order; letter cells are omitted
from both. Every non-letter cell belongs to exactly one result.

1. Enqueue all non-letter cells on all four perimeter edges, marking them once.
2. Process a queue with a moving head index, visiting valid up/down/left/right
   neighbors that are not letter cells.
3. Scan row-major: visited non-letter cells are exterior, unvisited ones enclosed.

Time and auxiliary memory are O(rows × columns). There is no recursion, repeated
queue shifting, word membership requirement, or dependence on presentation.
Explicit row/column bounds prevent accidental row wrapping. Perimeter land
always remains exterior; single-row/column boards cannot enclose land. Letters
at an edge may still form a real closed ring, but an open U cannot borrow an
edge as a fence.

Only orthogonal land paths exist. A diagonal gap is not outside access, and no
diagonal letter connector is inferred. Consequently a ring missing only a corner
still encloses its center; even four letters in the center's cardinal neighbors
isolate it under this discrete rule. Tests pin these cases to the milestone's
explicit flood-fill definition. A missing side letter opens a real path.
Non-letter metadata stays passable and receives no special bonus behavior.

### Territory: `territory.js`

Claims live outside board occupancy and outside rendering data:

```js
const territory = {
  rows: 3,
  columns: 3,
  claimed: [false, /* ...exactly 9 boolean entries... */],
};
```

- `createTerritory(board)` creates an independent all-false claim mask.
- `evaluateTerritory(board, territory)` previews `{ exterior, enclosed,
  newlyClaimed, points }`. It calls the sole enclosure algorithm, then filters
  enclosed indices against the existing claim mask. Neither input changes.
- `calculateTerritoryPoints(newlyClaimed)` counts unique newly claimed indices
  produced by the evaluator: exactly one point per cell, no bonuses. It is a
  counting helper, not independent eligibility validation; use the evaluator
  to determine which cells may score.
- `claimTerritory(board, territory)` evaluates the current occupancy, copies the
  mask, and marks newly claimed indices true. Returns `{ ...evaluation,
  territory: nextTerritory, totalPoints }`, including an independent mask even
  for a zero-point claim. There is no stale-preview commit API.
- `getTerritoryScore(territory)` counts historical claims; no redundant mutable
  score field can drift away from claim history.

Evaluation and claiming reject mismatched dimensions or mask length with
`RangeError`, including equal-area boards with different shapes. As in the
original board model, APIs expect valid state produced by these functions, not
arbitrary saved data. Boolean masks must remain dense and booleans. No storage
schema or deserializer is part of this milestone.

The evaluator and mask together distinguish exterior, enclosed unclaimed,
newly claimed, previously claimed, and letter-occupied cells. Previously claimed
cells remain claimed even after sandbox fence removal or letter overlay; these
historical points are retained and can never be earned again. An occupied cell
never earns a new territory point. The claim result identifies the latest newly
claimed cells for presentation without permanently storing an animation state.

Future placement integration can create a board with accepted committed letters
and call `claimTerritory(nextBoard, previousTerritory)` once. The placement system
must decide legality before that call; enclosure needs no word or rack knowledge.

## Browser boundary

`main.js` bootstraps `ui/sandbox.js`. The controller owns ephemeral board/claim
state, selected logical coordinates, recent claim indices, and view cell size.
It translates intent, calls pure transitions, then refreshes DOM and Canvas.
There is no duplicate flood fill, framework, game loop, event bus, storage,
random generator, or animation loop.

`rendering/board.js` draws an orthographic Canvas 2D grid using system text and
primitives. The render inputs include the precomputed core evaluation and claim
mask. Exterior is meadow, unclaimed enclosure has a dashed inset, new claims
show + on pale harvest, previous claims show ✓ on sage, and letters have oat
faces/wood rims. Selection has a dark outline. No animation or third-party
assets are loaded; symbols and textual statuses supplement color.

Canvas backing dimensions scale with device pixel ratio; the drawing transform
maps back to CSS view units. `pointerToCell` inverts the actual displayed bounding
rectangle and the 28px label gutter to find logical coordinates, independent of
backing pixels. Core coordinate helpers still validate edits. Keyboard/coordinate
selection uses `revealSelection` to scroll the logical cell into view.

The view keeps cells at 44, 56, or 72 CSS pixels inside a native scrollable pane.
Narrow screens pan rather than squeeze 15 cells into tiny targets. Primary
pointer taps toggle one cell; movement over 8 CSS pixels or pointer cancellation
suppresses edits so touch scrolling does not place letters. DOM buttons/inputs
are at least 44px tall with visible focus. The focused Canvas supports arrows,
Enter, and Space; semantic row/column inputs plus select/toggle buttons provide
an alternative to Canvas interaction and describe the selected cell in text.
Live status reports claims, edits, and selected cell state. UI coordinates are
1-based labels; core coordinates remain zero-based.

The default board is 15×15. Creating dimensions from 1–30 on either axis or
resetting clears all letters/claims/points. Detection updates on edits; inspect
reports without claiming. Latest new claims remain highlighted until the next
claim or letter edit. Neither refresh nor navigation preserves state.

## Development and validation

`npm test` invokes `node --test` using only Node built-ins. Existing board tests
remain unchanged. New diagram fixtures assert exact enclosed coordinates and
partition invariants across open/closed shapes, all edges, diagonal topology,
irregular/multiple regions, internal letters, rectangular and degenerate boards,
and a large iterative fill. Claim tests cover incremental/repeated scoring,
non-letter metadata, history, shape mismatch, and frozen input immutability.
Letter tests cover explicit discrimination, immutable writes, and invalid inputs.

Use `node --check` on affected JavaScript files. Preview from a static HTTP server
at `/wordstead/` (see [README](../README.md)), test pointer and keyboard paths,
known shapes/repeated claims, cell enlargement/panning, narrow/wide layouts,
direct loading/refresh, return navigation, and console/network errors. Run
`git diff --check`; there is no install/build step or automated browser framework.

## Limits and deferred work

Only uppercase A–Z occupancy is modeled; the sandbox always toggles A and allows
removal. Full state validation/persistence, dictionary rules, Scrabble placement,
rack/bag, seeded generation, farm features/bonuses, targets/victory, daily and
campaign modes, leaderboards, final sprites, and sound are deferred.

Milestone 2B should introduce pure placement geometry and validation with focused
tests and an accepted-placement path that calls the existing claim transition.
A full permanent game-state architecture should grow only with implemented rules.

All runtime files remain relative under `wordstead/`, directly loadable and
refreshable on GitHub Pages without server rewrites or Node runtime. Existing
crawler restrictions remain. This change leaves the root arcade, shared assets,
other games, hosting configuration, asset audits, notices, design skeleton, and
visual guide unchanged.
