# Wordstead architecture

Milestone 2B adds pure word placement, dictionary validation, and atomic word/claim
transitions to the Milestone 1 board and Milestone 2A enclosure/claim rules.
The [design skeleton](design-skeleton.md)
governs gameplay; the [visual guide](visual-guide-v0.1.md) supplies exploratory
presentation direction. The browser offers legal placement and a separate
unrestricted diagnostic lab, sharing the existing renderer and enclosure engine.

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

### Word membership: `dictionary.js` and `demo-vocabulary.js`

`normalizeWord(text)` trims outer whitespace, accepts only ASCII A–Z/a–z and
returns uppercase, or `null` for unsupported input. Validation precedes uppercase
conversion so Unicode expansions such as ß cannot become multiple letter tiles.
`createDictionary(iterable)` copies normalized entries into a private Set and
returns a frozen `{ has(word) }` membership object. Invalid entries throw TypeError.

Placement receives an explicit dependency exposing `has(uppercaseWord)` returning
a synchronous boolean. Native Set also works if its entries are uppercase. Missing
or asynchronous/nonboolean membership is a programming error and throws TypeError;
unknown words are ordinary structured placement rejections. No core fetch, DOM,
storage, or network access occurs. Tests supply controlled dictionaries.

`DEMO_WORDS` is a frozen, hand-selected local demonstration list; `demoDictionary`
wraps it. This provisional incomplete vocabulary is **not an official Scrabble
dictionary**. It contains CAR/CAB/RAT/BAT, single-letter extensions, and ordinary
cross-words, and is displayed in the UI. A properly licensed future list replaces
this dependency without changing placement rules. No third-party list is bundled.

### Placement evaluation: `placement.js`

`getStartingSquare(board)` returns zero-based `{ row: floor(rows / 2), column:
floor(columns / 2) }`. Even axes choose the lower/right center; 7×7 uses (3, 3),
4×6 uses (2, 3). This core policy is independent of rendering. A 1×1 board cannot
accept its mandatory two-letter first word.

`evaluatePlacement(board, { word, row, column, orientation }, dictionary)` is pure
and deterministic. Input text normalizes through `normalizeWord`; orientation is
exactly `horizontal` or `vertical`. Coordinates are zero-based safe integers.
The result contains:

- `legal`: boolean; `reason`: null on success or `{ code, message, ...details }`.
- `proposal`: normalized input, or null when word text is unsupported.
- `positions`: proposed `{ row, column, letter, index?, status }` in entered order.
  Status is `new`, `reused`, `conflict`, `blocked` (metadata), or `outside`.
- `newPositions`, `reusedPositions`, `conflictPositions`: corresponding logical
  positions with row-major indices and proposed letters. Conflicts include blocked
  metadata. Early geometry errors may have no candidate board or complete words.
- `words`: all affected `{ text, orientation, positions, valid }` runs, where each
  position has `{ row, column, index }`. Unknown-word reasons also contain the
  rejected occurrences in `reason.words`.
- `proposedBoard`: an immutable candidate copy after geometry/connectivity pass,
  including dictionary-rejected candidates for inspection, otherwise null. It is
  **not committed state**. Only a legal candidate is eligible for claiming.

Rejection precedence/codes: `INVALID_WORD`, `INVALID_ORIENTATION`,
`INVALID_COORDINATES`, `OUT_OF_BOUNDS`, `CELL_OCCUPIED`, `LETTER_CONFLICT`,
`NO_NEW_LETTERS`, `FIRST_WORD_TOO_SHORT`, `START_SQUARE_REQUIRED`, `DISCONNECTED`,
`NO_WORD_FORMED`, `UNKNOWN_WORD`. UI presents these codes with readable reasons.

Only null cells receive new letters. Matching letter objects are reused by identity;
different letters and all non-null non-letter metadata are protected. Neither
evaluation nor legal commitment calls the unrestricted `setLetter` editor. A first
move (no existing letter occupancy) needs two letters, center coverage, and valid
membership. Later moves need matching overlap or orthogonal contact with old
letters, at least one new tile, and at least one resulting multi-letter word.
Diagonal-only contact fails. A one-letter input is allowed when a full word forms.

`extractAffectedWords(candidateBoard, newPositions)` scans both axes through each
new tile. It walks backward to the beginning and forward to the end of every
contiguous letter run, including existing letters beyond the supplied span.
Singletons are omitted. Direction plus start position deduplicates the same run;
identical text at different locations remains separate. Unchanged runs through
reused tiles alone are not revalidated. Every changed word necessarily contains a
new tile. All extracted occurrences are checked, including perpendicular words;
one unknown word rejects the entire move. Raw entered text is not independently
required to be a dictionary word when the complete resulting run is different.

### Atomic legal play: `puzzle.js`

`createPuzzle(dimensions)` returns only `{ board, territory, wordCount: 0 }`.
`commitWord(state, proposal, dictionary)` re-evaluates against the **current** board
and dictionary; it never accepts a cached or caller-edited preview result.

On rejection it returns `{ accepted: false, state, evaluation, newlyClaimed: [],
points: 0 }` with the exact original state reference. No territory claim runs.
On acceptance it builds the candidate board, calls existing
`claimTerritory(candidateBoard, state.territory)`, and returns `{ accepted: true,
state: { board, territory: claim.territory, wordCount: previous + 1 }, evaluation,
newlyClaimed, points }`. All calculations finish before the caller replaces state,
so a failure cannot partially update letters, claims, or count. Frozen input tests
pin this contract. Treat outputs as immutable, as with the existing board API.

One accepted placement counts once regardless of resulting word count. Existing
letter objects remain untouched and cannot be removed/replaced. No score is stored
in puzzle state: `getTerritoryScore(state.territory)` is the single total. Latest
award/claim highlights are ephemeral UI data. Preview uses `evaluatePlacement` plus
`evaluateTerritory` on a legal candidate; neither invokes a claim transition.

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

The accepted-word transition calls `claimTerritory(nextBoard, previousTerritory)`
once after validation. Enclosure and territory modules remain unchanged; neither
needs word, dictionary, or rack knowledge.

## Browser boundary

`main.js` bootstraps `ui/sandbox.js`. The controller owns two separate in-memory
sessions: `words` (default) and `freeform`. Each has independent puzzle state,
selection, latest point award, and recent claim indices. Mode switching preserves
each session but clears the preview. Resets/dimension changes affect only the
active session; refresh clears both. There is no path to import lab edits into play.
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
backing pixels. Core coordinate helpers still validate selection. Keyboard/coordinate
selection uses `revealSelection` to scroll the logical cell into view.

The view keeps cells at 44, 56, or 72 CSS pixels inside a native scrollable pane.
Narrow screens pan rather than squeeze 15 cells into tiny targets. Primary
pointer taps select a starting cell in legal mode, and toggle A only in freeform;
movement over 8 CSS pixels or pointer cancellation suppresses actions so touch
scrolling does not place letters. DOM buttons/inputs
are at least 44px tall with visible focus. The focused Canvas supports arrows,
Enter, and Space. In legal mode arrows select, Enter/Space only preview; only the
separate Commit word button accepts. Semantic row/column inputs with Select cell
provide an alternative. Editing coordinates immediately clears the old preview
and disables commit until the selection is applied. Word/orientation edits update
previews. Clear preview never changes committed state. Freeform alone exposes
toggle/inspect/manual-claim controls, also guarded in their handlers.

Canvas draws proposed tiles with dashed rims and p, matching reuse with =, and
conflicts with × plus the attempted letter, preserving the committed glyph.
Core-computed prospective claims show ? without changing the mask. Validity has
textual feedback as well as color, and formed words list their location and
membership result. The ☆ starting-square marker is supplied by the core policy.
Latest accepted awards and total derived score are distinct from prospective
points. Live status reports claims, edits, and selected cell state. UI coordinates
are 1-based labels; core coordinates remain zero-based.

The default board is 15×15. Creating dimensions from 1–30 on either axis or
resetting clears that mode's letters/claims/points/count. Detection updates on edits; inspect
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
Placement tests cover edges/rectangles/centers, ASCII normalization, overlap,
metadata protection, connectivity, full extensions, multiple cross-words and
separate identical occurrences. Puzzle tests cover frozen-state commits/rejections,
stale-preview revalidation, one count per move, prospective claim isolation, and
the exact 7×7 CAR/CAB/RAT/BAT enclosure sequence. The first three moves score zero;
the fourth claims index 32 for +1, preserving shared letter identity. Subsequent
valid extensions do not rescore it. Invalid closing words cannot claim territory.

Use `node --check` on affected JavaScript files. Preview from a static HTTP server
at `/wordstead/` (see [README](../README.md)), test pointer and keyboard paths,
known shapes/repeated claims, cell enlargement/panning, narrow/wide layouts,
direct loading/refresh, return navigation, and console/network errors. Run
`git diff --check`; there is no install/build step or automated browser framework.

## Limits and deferred work

Only uppercase English A–Z tiles are modeled. Legal entry has no rack limit and
uses a provisional dictionary; freeform still toggles A and allows removal.
Full saved-state validation/persistence, official dictionary, rack/bag/exchanges,
blanks, seeded generation, farm features/bonuses, targets/grades, daily/campaign,
leaderboards, final sprites, decorative animation, and sound are deferred.

Milestone 2C can inject a licensed membership source and use `newPositions` for
rack consumption before delegating commits to `commitWord`. Reused positions
consume no new tiles. Keep future randomness explicit and extend the small state
only alongside implemented requirements. Enclosure/claim logic needs no rewrite.

All runtime files remain relative under `wordstead/`, directly loadable and
refreshable on GitHub Pages without server rewrites or Node runtime. Existing
crawler restrictions remain. This change leaves the root arcade, shared assets,
other games, hosting configuration, asset audits, notices, design skeleton, and
visual guide unchanged.
