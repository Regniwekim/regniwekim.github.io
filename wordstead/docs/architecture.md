# Wordstead architecture

Milestone 2D adds reserved farm cells, derived capture rewards, independent seeded
layouts, expandable racks and free exchange credits to the atomic rack transition.
Milestone 2C.1 adds reversible physical tile drafts to rack play. Milestone 2C wraps
the existing word/claim transition with a finite physical tile
bag, seven-tile rack, seeded exchanges, and puzzle progression. Milestone 2B's
placement engine and Milestone 1/2A board, enclosure and claim contracts remain.
The [design skeleton](design-skeleton.md)
governs gameplay; the [visual guide](visual-guide-v0.1.md) supplies exploratory
presentation direction. The browser offers rack-limited play and two independent
labs, sharing the existing renderer and enclosure engine.

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
  feature-free sandbox. Legal placement never calls this unrestricted editor;
  farm metadata occupies reserved cells and cannot be overwritten by legal words.

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
in puzzle state: `getTerritoryScore(state.territory)` is the base territory total. Latest
award/claim highlights are ephemeral UI data. Preview uses `evaluatePlacement` plus
`evaluateTerritory` on a legal candidate; neither invokes a claim transition.

### Letter bag: `bag.js`

`createStandardTiles()` creates 100 separate `{ id, letter }` resources. Stable
IDs 0–97 enumerate A–Z in the standard English Scrabble multiplicities; 98/99
are blanks with `letter: null`. `LETTER_DISTRIBUTION` records counts, including
`'?': 2`; there are no Scrabble letter values. Duplicate letters have distinct IDs.

`seedToState(seed)` accepts a finite number or a string containing non-whitespace.
It hashes `${typeof seed}:${seed}` with FNV-1a (offset 2166136261, multiplier
16777619), XORing each UTF-16 code unit and using `Math.imul`/unsigned 32-bit
arithmetic. Text is preserved, not trimmed. Numbers and strings are distinct;
numeric -0 follows JavaScript stringification and equals 0 for this policy.
No locale, encoding service, current time, or ambient `Math.random()` is used.

`nextRandom(state)` implements Mulberry32: increment by 0x6d2b79f5 modulo 2³²,
then the standard xor/shift/imul output mixer. `shuffleTiles(tiles, rngState)`
copies the input and runs descending Fisher–Yates. For each bound `i + 1`, it
rejects unsigned outputs at/above `floor(2³² / bound) * bound`, then takes modulo
bound. This avoids modulo bias and returns `{ bag, rngState }`. Determinism is
identical in Node and supported ES-module browsers; it is not cryptographic RNG.

`createBag(seed, bagOrder?)` shuffles standard tiles normally. QA may explicitly
supply an array containing each physical ID exactly once; malformed/incomplete
orders throw TypeError. A scripted order preserves the complete distribution and
initializes exchange RNG from the seed without performing an initial shuffle.
`replenishRack(rack, bag, capacity = 7)` copies arrays and draws from the **front**
until the supplied capacity or no bag remains, without changing RNG. Capacity
must be an integer from seven through nine; overflow throws RangeError.
Model data comes from constructors/transitions and is treated as immutable.

### Rack-aware play: `session.js`

`createSession({ rows, columns, seed, target, bagOrder?, farmSeed?, farmDensity?, farmWeights? })` returns:

```js
{
  puzzle: { board, territory, wordCount }, // Existing createPuzzle contract
  rack: [/* up to derived seven–nine capacity */],
  bag: [/* ordered remaining physical tiles */],
  seed, rngState, target, exchangeCount: 0, freeExchangesUsed: 0,
  farm: null, // or { seed, density, weights }, copied generation settings
  status: 'playing', source: 'seeded', // source is 'scripted' for an ordered bag
}
```

Target must be a positive safe integer (RangeError otherwise). Seed validation
comes from `bag.js` (TypeError). Defaults are 15×15, string seed `wordstead-2c`,
and a temporary **unbalanced target 1** practical for the provisional vocabulary.
`wordCount` stays in the existing puzzle only; `getPuzzleScore(puzzle)` derives
total score from claims plus captured feature definitions. `getStrokes(state)`
derives words + exchanges − freeExchangesUsed. `getChargedExchanges` returns
exchanges − freeExchangesUsed. Seed governs letter order independently of farms.

`evaluateSessionPlacement(state, proposal, dictionary, assignments?)` calls `evaluatePlacement`
and preserves its fields, complete-word feedback, and geometry/dictionary rejection
precedence. It adds `rack: { allocations, missingLetters }`. Allocations contain
position/letter, the physical tile and `blank` flag. New positions are allocated
in word order: the first unused exact rack match, otherwise the first unused blank.
Missing letters are `{ letter, count }` entries. An otherwise legal placement with
missing resources becomes `MISSING_RACK_LETTERS`, with the same entries in its
structured reason. Preview never consumes resources, shuffles, claims or counts.
When `assignments` is supplied, automatic allocation is bypassed. Each assignment
is `{ tileId, row, column, letter, assignedLetter }`. Every new position must have
exactly one supplied current rack tile, each ID is used once, native letters must
match, and only blanks may represent a different letter. Blanks require
`assignedLetter === letter`; ordinary tiles require null/absent assignment.
Missing, extra, stale, duplicate, foreign or mismatched supplies reject the whole
transaction as `INVALID_TILE_ALLOCATION`. No alternative tile is substituted.
Geometry/dictionary rejection precedence remains unchanged; invalid resources
cannot enable commitment. Omitted assignments retain the original automatic path.

`commitSessionWord(state, proposal, dictionary, assignments?)` evaluates again at commit time,
rejects missing resources, and delegates to **existing `commitWord()`**. It adds
`tileId` and boolean `blank` to newly committed compatible `{ kind: 'letter',
letter }` cells. Assigned blanks retain their letter forever, are reusable without
spending a tile, and participate in dictionary/enclosure rules normally. Reused
cell objects retain identity. The wrapper removes allocated IDs, replenishes to
the **post-capture** capacity, then derives status against total score. It returns
the existing commit result plus rack evaluation, `consumedTiles`, `basePoints`,
and `farmRewards`; `points` is the total new award including crop/fertility
bonuses. No caller-provided cached preview is trusted.

All work completes before replacement state is returned. Rejection returns the
**exact original state**, zero points and no new claims. Even thrown dictionary
or claim errors cannot partially change board, territory, rack, bag order, RNG,
word/exchange counters or status. Frozen-state tests pin this boundary. The
browser's rack mode calls `commitSessionDraft`, which delegates to `commitSessionWord`;
`commitWord` remains available
to the unrestricted word lab and its existing callers/tests. Both allocation paths
share this same commit/claim/replenish implementation.

`evaluateExchange(state, tileIds)` returns legality/reason. Reasons include
`EMPTY_EXCHANGE`, `INVALID_EXCHANGE_TILES` (foreign/duplicate IDs), and
`INSUFFICIENT_BAG`. A nonempty subset needs at least that many tiles in the bag.
`exchangeTiles(state, tileIds)` revalidates, draws replacements from the ordered
bag **before returns**, replaces selected rack slots in rack order, appends returned
tiles in rack order to the undrawn bag, and shuffles that pool using session RNG.
Caller selection order cannot change results. It increments exchangeCount once
and returns `returned`/`replacements` for feedback. Puzzle/claims/wordCount remain
identical; rack length and total physical tile count are conserved. Failed exchanges
preserve the original state and randomness. A successful exchange automatically
uses an available building credit, increments `freeExchangesUsed` if free, and
reports `freeExchange`. It always increments `exchangeCount`. Otherwise one
exchange is one provisional stroke, regardless of tile count. Credit availability
never bypasses bag/selection/status checks; final penalty and grading need playtesting.

After an accepted word, reaching/exceeding the target changes status to `won`.
Otherwise an empty rack **and** empty bag produce `exhausted`. Empty bag alone
leaves the run `playing`. `endSession(state)` explicitly changes an unfinished run
to `ended` without spending resources or changing counters. Every gameplay
transition rejects non-playing status with `RUN_FINISHED`. Reset/new creation are
separate constructors. There is no exhaustive legal-move solver: some blocked runs
must be ended by the player, and some seeds/configurations may be unwinnable.

`session-fixture.js` supplies a distribution-preserving scripted 100-ID order with
`CARABTAA` at the front, remaining IDs in canonical order. Its independent 7×7
session uses target 1 and `enclosure-qa` exchange seed, marked `source: 'scripted'`.
`ENCLOSURE_MOVES` pins CAR/CAB/RAT/BAT. Actual rack commits consume 3/2/2/1 tiles,
leave bag counts 90/88/86/85 and award index 32 only on the fourth word. This gives
4 words, 0 exchanges, 4 strokes, 1 point and victory. Restarts reconstruct the
same complete fixture. It is explicitly labeled QA, never presented as a random
seeded puzzle. The original unrestricted 2B regression remains untouched.

### Farm features, scoring and utility: `features.js`

`FEATURE_TYPES` centralizes four types, labels, textual effects, display letters
and provisional point bonuses. `createFeatureCell(type)` creates
`{ kind: 'feature', type }`, rejecting unknown types. `isFeatureCell` recognizes
only that discriminator and a supported type. `placeFeature(board, row, column,
type)` is an immutable authoring helper that validates coordinates and requires
a null cell. A feature occupies exactly one cell and stays intact after capture.

Features are **reserved land**, not letters. Existing placement/draft occupancy
checks reject overwriting them, whether captured or uncaptured. Existing
`isLetterCell` remains the only fence discriminator: features never block the
sole flood fill or form words. This provisional reservation policy is an open
playtest question. The freeform lab stays feature-free.

The existing boolean territory mask is the authoritative permanent capture
record. There is no captured flag, stored score, stored capacity, or credit tally.
`summarizeFeatures(board, indices)` deduplicates indices and describes feature
types, crop/fertility bonus points and livestock/building counts.
`getCapturedFeatures(puzzle)` applies it to the authoritative historical claims.
`getPuzzleScore(puzzle)` returns `{ basePoints, cropPoints, fertilityPoints,
bonusPoints, totalPoints }`: base still comes from unchanged `getTerritoryScore`;
crop adds three and fertile adds one per captured feature. Fertility is a bonus
to its cell only. Three ordinary cells plus crop and fertile total 5 + 3 + 1 = 9.

`getRackCapacity(state)` is min(9, 7 + captured livestock). Refilling never creates
tiles, even when capacity rises with a low/empty bag. Additional livestock past
the cap still score base territory. `getExchangeCredits(state)` is captured
buildings − freeExchangesUsed. Only successful free exchanges increment the
latter; failed/canceled selections cannot spend it. These functions live in the
session layer where rack resources and exchange history meet farm capture.

Word commitment performs complete draft/allocation revalidation, existing word
and claim commitment, physical letter provenance, post-capture refill and
total-score victory before publishing one replacement state. `farmRewards`
contains newly captured `{ index, type }` entries, `cropPoints`, `fertilityPoints`,
`bonusPoints`, `livestock`, `buildings` and the actual capped `rackCapacityGained`
delta. Repeated claims have no new indices and therefore no repeat rewards.
Preview only evaluates prospective points; it never changes claims, capacity,
credits, tiles, RNG, counters or status.

### Independent layout generation: `farm-layout.js`

`generateFarm(board, { seed, density, weights })` copies board cells and uses an
independent explicit RNG initialized from its farm seed. It reuses the existing
deterministic shuffle/PRNG functions without accessing or advancing the session's
letter RNG. It shuffles eligible empty interior indices, selects
`floor(eligibleCount × density)`, and draws each type by cumulative weight.
No overlaps or out-of-bounds features occur. Existing occupancy, all perimeter
cells, the starting square and its immediate orthogonal neighbors are excluded.
Rectangular and small boards use the same rules; zero eligible cells is valid.

Defaults: `wordstead-farm-2d`, density 0.08 of eligible cells, and weights
`{ crop: 4, livestock: 2, building: 2, fertile: 3 }`. Density accepts 0–1 in core
and 0–0.25 in browser setup; zero disables placement. Every type needs a finite,
nonnegative weight, the total must be positive/finite, and unknown keys reject.
All values are provisional; each particular board need not contain every type.
There is no solution solver, difficulty equalization or reachable-target guarantee.

The core constructor only generates farms with an explicit non-null `farmSeed`;
legacy callers and old fixtures remain feature-free. Browser default play opts
in. Sessions copy settings for reproducible restart; a different letter seed
changes the bag but not the farm. A different farm seed/settings cannot change
letter order or exchange randomness.

`farm-fixture.js` adds `createFarmSession(type)` without modifying the original
session fixture. Each uses the full original controlled bag and four moves, with
the feature at index 32, UI (5, 5). Crop/fertile targets 4/2 exercise bonus victory;
livestock/building targets 20 permit subsequent turns and exchanges. A
`farmFixture` type identifies restart configuration, not gameplay reward state.
See README for repeatable browser steps.

### Reversible drafts: `draft.js`

Draft state is separate from the committed session:

```js
const draft = {
  tiles: [{ tileId: 98, letter: 'A', assignedLetter: 'A', row: 3, column: 4 }],
};
```

Ordinary tiles have `assignedLetter: null`. The stable physical ID identifies the
original rack slot, because rack contents/order never change while drafting.
There is no duplicated rack, candidate session, RNG state, score, or word count.
Drafts and core results are treated as immutable.

- `createDraft()` returns an empty draft (also used for clearing).
- `placeDraftTile(state, draft, { tileId, row, column, assignedLetter? })` places
  or moves one current rack tile. It rejects closed runs, invalid blank assignments,
  occupied/outside cells, duplicate positions and incompatible geometry. Successful
  moves retain ID/assignment and append to edit order. Failed attempts return the
  exact original draft; the session never changes.
- `returnDraftTile(draft, tileId)` removes an arbitrary tile. `undoDraft(draft)`
  returns the most recently placed/moved tile. Undo removes that tile rather than
  restoring its previous location. Both operations leave physical rack slots intact.
- `assignDraftBlank(state, draft, tileId, letter)` changes only a current drafted
  blank's A–Z assignment; movement also preserves it.
- `inspectDraft(board, draft)` returns `{ coherent, orientation, reason }`.
  Zero tiles produce `EMPTY_DRAFT`; one tile is coherent with orientation null.
  Two or more tiles must share one row/column, with every cell between their
  extrema occupied by draft or committed letters. It rejects `DRAFT_AXIS`,
  `DRAFT_GAP`, or malformed/colliding `INVALID_DRAFT` inputs. It never checks a
  dictionary, the starting square or connection to the old network.
- `evaluateDraft(state, draft, dictionary)` checks structural coherence, overlays
  temporary letter occupancy, and uses existing `extractAffectedWords` to infer
  a proposal containing the full contiguous run. Multiple tiles supply the axis.
  A singleton uses its first affected run (horizontal before vertical), or a
  one-letter horizontal proposal if isolated. This is only a deterministic proposal
  representation: `evaluatePlacement` still checks **both** affected axes, so one
  tile forming two words counts once. Preview returns the existing session evaluation
  plus `structural`, passing the exact draft tiles as explicit allocations.
- `commitSessionDraft(state, draft, dictionary)` reconstructs and revalidates the
  current draft, then delegates to `commitSessionWord` with those explicit IDs.
  On acceptance it returns the new session and an empty draft; on failure it
  preserves the exact session and draft, zero points and no claims. No cached
  preview is accepted. Dictionary/claim exceptions cannot mutate either input.

Arbitrary removal can leave a split. The remaining tiles remain visible/editable;
preview reports `DRAFT_GAP` and blocks commitment. Filling the gap, removing an
endpoint, undo or clear can repair it. No pending tile is silently deleted. When
one tile remains the axis is undecided again. This is an editing policy, not a
change to committed word placement rules. First-tile freedom and temporary
nonwords never relax the final starting-square, connection or dictionary checks.

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
Non-letter metadata stays passable; the higher farm layer derives bonuses.

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

`main.js` bootstraps `ui/sandbox.js`. The controller owns three separate in-memory
sessions: `rack` (default), `words` and `freeform`. Rack owns a core session and
physical draft; labs own the original puzzle state. Each has independent board
selection, latest award and recent claim indices. The word lab retains typed
word/orientation input. Mode switching preserves each session, clears transient
input, and reconstructs the rack preview on return. Resets/dimension changes affect only the
active session; refresh clears all three. There is no path to import lab edits into play.
It translates intent, calls pure transitions, then refreshes DOM and Canvas.
There is no duplicate flood fill, framework, game loop, event bus, storage,
browser random generator, or animation loop.

The rack has nine persistent semantic DOM buttons with 44px minimum targets,
visible focus and physical ID/slot labels. Only derived capacity (7–9) is visible;
the grid and accessible name track capacity. Narrow screens wrap at four slots;
empty slots and finished-run tiles are disabled. Dashed insets and ↗ mark draft
use, outlines/checkmarks mark selection, and ◇ identifies blanks. Buttons retain
focus across rerenders. A native modal dialog offers 26 A–Z buttons with keyboard
focus containment and cancellation. The selected blank may be reassigned before
commitment, including when an ordinary matching tile exists.

`ui/tile-input.js` owns transient selection, the blank dialog, ghost/drop feedback
and Pointer Events transactions. Click/Enter/Space on a rack tile selects it and
focuses the Canvas. Board arrows move the cursor; Enter/Space places the selected
tile or picks up the draft at that cursor. Selecting another rack tile switches
selection. Escape/Cancel clears selection without editing the draft. A selected
draft can move or return via a semantic button, another activation of its original
rack slot, or a drag to that slot. Commit, Undo and Clear are immediately below the
rack. Formed words, draft direction, legality, prospective points and coordinates
are available as text; live statuses announce actions and selected identity.

Rack and draft drag sources use pointer capture and `touch-action: none`. Movement
must exceed 8 CSS pixels; a tap remains a native button activation. During dragging,
the ghost and +/× destination overlay are presentation only: `placeDraftTile`
previews structural eligibility without publishing a replacement draft. The
underlying cell comes from `pointerToCell`, clipped to the visible scroll pane.
Pointer movement redraws the cached board view and changes drop text only when
the destination feedback changes; it does not rebuild controls or check dictionary
membership on every pointer event.
Only an eligible pointer release publishes a draft; invalid/outside drops,
pointercancel, lost capture, window blur, Escape and mode/reset changes cancel.
Compatibility clicks after a drag/cancellation are consumed once. Text selection
and native browser dragging are suppressed on drag sources. Persistent transparent
DOM input handles over Canvas draft tiles provide touch drag ownership and visible
keyboard focus, positioned by `cellToView`; they do not determine game legality.
Empty/committed Canvas cells retain `touch-action: pan-x pan-y` and native scrolling.
Board taps track maximum movement, so panning out and back cannot place a tile.
There is no drag edge auto-scroll: users pan first, tap or use the keyboard.

Exchange uses a separate mutually exclusive selection. It requires an empty draft;
its disabled control and explanation ask the player to return or clear tiles first.
Starting exchange clears tile selection and pauses placement; confirm revalidates
IDs and bag size. Cancel/switching modes clears exchange selection without a
transition. Each mode keeps its draft independently; switching clears the active
pointer/selection/blank dialog and restores only that mode's preview. End-run
clears pending rack input. Victory/exhaustion disable further input, retain the
completed board and present word/exchange/stroke results. Restart reconstructs
the original seed/configuration or scripted fixture, with an empty draft.

`rendering/board.js` draws an orthographic Canvas 2D grid using system text and
primitives. The render inputs include the precomputed core evaluation and claim
mask. Exterior is meadow, unclaimed enclosure has a dashed inset, new claims
show + on pale harvest, previous claims show ✓ on sage, and letters have oat
faces/wood rims. Selection has a dark outline. No animation or third-party
assets are loaded; symbols and textual statuses supplement color.

Features use original Canvas sprout/animal/roof/furrow silhouettes plus C/L/B/F
labels, drawn over their land state. A corner badge shows prospective ?, new +
or historical ✓ without obscuring type. Selected-cell and Canvas accessible text
report the type, capture/activation status, effect and reservation. Capture action
text reports types, total award, crop/fertility points, actual capacity gain and
building credits. No effects are applied in the renderer or event handlers.

Rack statistics display total score/target, base territory, farm bonus, accepted
placements, exchange actions, charged exchanges, credits, strokes, rack/capacity
and bag count. `ui/rack.js` maintains the persistent physical buttons as capacity
changes, including empty/disabled states. Setup adds independent farm seed and
density fields; restart reconstructs the original farm/settings or QA fixture.

Canvas backing dimensions scale with device pixel ratio; the drawing transform
maps back to CSS view units. `pointerToCell` inverts the actual displayed bounding
rectangle and the 28px label gutter to find logical coordinates, independent of
backing pixels. Core coordinate helpers still validate selection. Keyboard/coordinate
selection uses `revealSelection` to scroll the logical cell into view.

The view keeps cells at 44, 56, or 72 CSS pixels inside a native scrollable pane.
Narrow screens pan rather than squeeze 15 cells into tiny targets. Rack-mode taps
place a selected tile; movement over 8 CSS pixels or pointer cancellation suppresses
actions so scrolling never places. Semantic row/column controls move only the rack
cursor and never translate a draft. Only the Commit button accepts a word.

The word lab retains typed word/orientation entry, automatic preview and its
existing commit path. Arrows select a start; Enter/Space previews. Editing lab
coordinates clears the old preview until Select cell applies them. Clear preview
changes no puzzle state. Freeform keeps its original toggle/inspect/manual-claim
controls, guarded by mode in their handlers. No tiles or lab edits cross sessions.

Canvas draws all draft tiles (including unresolved splits) with dashed rims and p, matching reuse with =, and
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

Bag/session tests additionally pin the distribution, two blanks, PRNG/hash vectors,
seeded replay, physical tile conservation across every transition, multiplicities,
exact-before-blank allocation, permanent blank reuse, partial refills/exhaustion,
single/multi/invalid exchanges, draw-before-return order, frozen-state atomicity,
dictionary/claim exceptions, stale previews, target/win locks, and explicit endings.
Controlled resource tests consume a full real bag on a long board using an injected
test dictionary; the browser always uses the unchanged provisional vocabulary.

Draft tests additionally pin incremental geometry without premature dictionary checks,
committed bridges and endpoint reuse, singleton two-axis words, every perpendicular
cross-word, arbitrary removals/gap repair, duplicate physical IDs, blank assignment
and reassignment, explicit-blank preference, stale/invalid explicit allocations,
exception/rejection atomicity, deterministic replenishment, conservation and the
same tile-only enclosure victory. Browser-independent event-surface doubles test
selection/cancellation, mouse and touch Pointer Events thresholds, drop feedback,
click suppression, outside release, pointercancel/lost capture/blur, original-slot
returns and blank dialog interactions. They do not emulate a real browser's native
touch scroll negotiation; real-device touch QA remains necessary.

Use `node --check` on affected JavaScript files. Preview from a static HTTP server
at `/wordstead/` (see [README](../README.md)), test pointer and keyboard paths,
known shapes/repeated claims, cell enlargement/panning, narrow/wide layouts,
direct loading/refresh, return navigation, and console/network errors. Run
`git diff --check`; there is no install/build step or automated browser framework.

Farm tests additionally cover every feature, reserved placement, passable flood
fill, frozen four-word draft captures, preview/rejection isolation, mixed and
independent enclosures, retained capture history, bonus victory, simultaneous
utility rewards, capacity cap/partial draws, full physical tile conservation,
credit accumulation/use/rejection, stroke derivation, seeded rectangular/small
layouts, density/weights/protected cells, and independence from letter RNG.
Rack view tests check seven/eight/nine visible physical slots and empty states.
Existing regression fixtures and expected results remain unchanged.

## Limits and deferred work

Only English A–Z assignments and standard blanks are modeled. The unrestricted
word lab uses the same provisional dictionary; freeform toggles A and allows removal.
Full saved-state validation/persistence, official dictionary, exhaustive move
solver, final grades, daily/campaign,
leaderboards, final sprites, decorative animation, and sound are deferred.

Future work can inject a licensed membership source without changing the session
wrapper. Farm bonuses extend the atomic transition after territory claiming;
future final grading can consume word/exchange counters and target.
Layout randomness stays explicit and separate from letter-order seeds;
extend state only alongside tested requirements. Enclosure/claims need no rewrite.

Open playtest questions include the reserved-cell policy, density/weights, point
values, automatic credit consumption, rack cap and useful targets with the small
vocabulary. Multi-cell structures, animated livestock, crop timers/harvesting,
seasons, upgrades and advanced interactions remain deferred with final artwork.

All runtime files remain relative under `wordstead/`, directly loadable and
refreshable on GitHub Pages without server rewrites or Node runtime. Existing
crawler restrictions remain. This change leaves the root arcade, shared assets,
other games, hosting configuration, asset audits, notices, design skeleton, and
visual guide unchanged.
