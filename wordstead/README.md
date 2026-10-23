# Wordstead

**Build a farm, one word at a time.** Wordstead is a single-player spatial word
puzzle and cozy farm builder. The [design skeleton](docs/design-skeleton.md)
defines the planned game; [architecture](docs/architecture.md) documents the
implemented contracts.

## Current status: Milestone 2C.1

The browser prototype accepts connected horizontal/vertical words, reuses matching
committed letters, validates every affected complete word, and automatically claims
newly enclosed empty land. Each accepted placement counts once, even if it forms
several words. Letters are permanent during legal play. Territory earns one point
per newly claimed cell, with total score derived from the existing claim mask.

The default **Rack-limited puzzle** draws seven physical tiles from a seeded
100-tile bag, replenishes after accepted words, permits exchanges, and finishes
when the territory target is reached. Word count is the primary efficiency
measure; each exchange adds one provisional stroke. Build words directly from physical
rack tiles using click/tap, Pointer Events dragging, or keyboard controls. Both old
labs remain available.

This is **not the full game**. Membership uses
a hand-selected, provisional, incomplete local vocabulary, **not an official
Scrabble dictionary**. No external word service or third-party dictionary is used.
The complete demonstration list is available in the page's expandable word list.

Milestone 1's configurable board and Milestone 2A's enclosure/territory modules
remain unchanged. **Legal word placement lab** keeps unrestricted word entry and
automatic claims. **Freeform enclosure lab** retains arbitrary A-tile
editing/removal and manual claims. Each mode has its own state; lab edits cannot
enter legal play. Switching modes preserves their separate sessions; refresh clears
all three. Canvas primitives and system fonts require no third-party assets. Existing
[asset audit](ASSET-AUDIT.md), [organization records](asset-organization/README.md),
[license scope](docs/license.md), and exploratory [visual guide](docs/visual-guide-v0.1.md)
continue to govern future art.

## Run locally

From the **repository root** (the parent of `wordstead/`):

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Visit <http://localhost:8000/wordstead/> directly or refresh it. Native ES modules
require HTTP; `file://` is not supported. No installation, build command, backend,
or Node browser runtime is needed. Stop the server with Ctrl+C.
**Back to Main Arcade** points to `../index.html`. The homepage does not list
Wordstead yet; adding its card is outside this milestone.

## Rack-limited puzzle controls

The default mode is **Rack-limited puzzle**. **Board setup** provides a letter
seed, independent 1–30 board dimensions, and a positive integer territory target.
**New puzzle** applies these settings to a fresh seeded run. **Restart puzzle**
repeats the active run's original settings and tile order (including the scripted
fixture), regardless of edits in the setup form. The initial board is 15×15;
the temporary default target is **1**, explicitly unbalanced for the limited
vocabulary. Different seeds are not guaranteed equally difficult or solvable.

Seven persistent DOM rack buttons show letters or **◇** for blanks; empty slots
show a dash. Duplicate letters have independent physical IDs and slot labels.
Select a tile, then click/tap an empty board cell. The tile appears as a dashed
**p** draft, and its original rack slot shows a dashed inset and **↗**. The rack
still owns the tile until commitment. Select another tile to continue; selection
alone never changes the draft. Activate an already-selected available tile or
**Cancel selection** / Escape to deselect it.

You can also drag from a rack button or a drafted board tile. Movement must exceed
8 CSS pixels to become a drag. A lightweight tile ghost follows the pointer;
**+** / **×** outlines and text identify eligible/rejected drop cells. Release on
an eligible cell to place or move. Release outside the visible board to cancel;
release on that tile's original rack slot to return it. Invalid drops, pointer
cancellation, lost capture, blur and Escape preserve the draft exactly. There is
no edge auto-scroll during dragging: pan to the destination first, or use tapping
or keyboard controls.

The scrollable board keeps cells at 44, 56 or 72 CSS pixels. Empty and committed
cells retain native touch scrolling, including while a rack tile is selected.
Movement beyond the tap threshold or pointer cancellation suppresses board taps.
Only rack buttons and drafted tile handles reserve touch gestures for dragging.
On phones the rack wraps four/three slots immediately below the board; Commit,
Undo and Clear follow the rack. No native HTML drag-and-drop is required.

**Construction and legality are separate.** The first draft tile can occupy any
available cell, with direction undecided. A second tile establishes a row or
column; additions must keep a single contiguous run. Existing committed letters
can bridge draft tiles. Empty gaps, diagonal additions, branches, occupied cells
and out-of-bounds positions are rejected without losing selection or resources.
Temporary text such as C or CA remains editable. Only the completed move must
cross the starting square (first word), connect to existing letters (later turns)
and pass the existing vocabulary and cross-word checks.

Words and direction are inferred from the complete contiguous board/draft run;
no word entry or orientation picker appears in rack mode. Old letters at either
end or between tiles are reused for free. One new tile can extend CAT into CATS,
form a vertical word, or change words in both axes. All affected words are listed
and checked; an accepted placement still counts once.

Tap a drafted tile to pick it up, then tap another cell to move it. **Return
selected tile**, a second activation of its selected original rack slot, or a drag
back to that slot returns it without an exchange. **Undo last placement** returns
the most recently placed or moved tile (it does not rewind a move to its old cell).
**Clear draft** returns all pending tiles. An arbitrary return may leave a gap;
remaining tiles stay visible and editable, with commitment disabled until repaired.
If only one tile remains, direction becomes undecided again. No other tile is
silently removed.

Selecting a blank opens an A–Z button dialog usable with touch, Tab and Enter/Space.
Assign it before dragging; no letter is guessed. The draft displays its chosen
letter plus **◇**. Select the drafted blank and use **Change blank letter** to
reassign it. Movement retains the assignment and physical ID. A specifically
chosen blank is consumed even when the rack contains an ordinary matching letter.
Its blank provenance is permanent after commitment.

**Commit word** enables only for a complete legal draft with valid physical tile
allocations. Commitment reconstructs and revalidates the current draft, consumes
those exact IDs, places letters with provenance, claims land, refills and advances
the word count once. Failure preserves both the entire session and draft. Previews,
selection, edits and cancellation never draw, shuffle, claim or count.

**Keyboard:** Tab to a rack tile, then Enter/Space selects it and focuses the board.
Arrow keys move the board cursor; Enter/Space places the selected tile or picks up
a draft tile at the cursor. Repeat with another rack tile. Board keys never commit;
use the semantic Commit button. Undo, Clear, Return, Cancel and blank assignment
are also semantic controls. Row/Column plus **Select cell** moves only the cursor,
so coordinate edits do not move an assembled draft. Live text announces logical
coordinates, physical identity, assignment, direction, legality, words and points.

**Exchange tiles** uses a separate selection mode. Return or clear all draft tiles
first; the exchange action is disabled and explains this policy while a draft
exists. Entering exchange cancels placement selection. Select one or more rack
buttons, then **Confirm exchange** or **Cancel exchange**. The bag must have at
least the selected count. Replacements are drawn before returns, then the remaining
pool is deterministically shuffled. Each completed exchange costs one provisional
stroke. Cancellation costs nothing.

The page shows rack/bag counts, territory points/target, progress, accepted word
placements, exchanges, and derived **strokes = wordCount + exchangeCount**. Victory
occurs immediately after an accepted word reaches the target. No further word,
exchange, or end-run transition is accepted. Restart or create a new puzzle to play.
**End unfinished run** explicitly forfeits without spending resources. Only empty
rack **and** empty bag prove resource exhaustion here. An empty bag with useful
rack tiles is playable; there is no exhaustive no-legal-moves solver, so blocked
runs can require the player to end them. No golf grades or individualized pars exist.

### Letter economy and reproducibility

The bag uses the standard 100-tile English Scrabble distribution, with no letter
point values:

| Tile | Count | Tile | Count | Tile | Count |
|---|---:|---|---:|---|---:|
| A | 9 | J | 1 | S | 4 |
| B | 2 | K | 1 | T | 6 |
| C | 2 | L | 4 | U | 4 |
| D | 4 | M | 2 | V | 2 |
| E | 12 | N | 6 | W | 2 |
| F | 2 | O | 8 | X | 1 |
| G | 3 | P | 2 | Y | 2 |
| H | 2 | Q | 1 | Z | 1 |
| I | 9 | R | 6 | Blank | 2 |

Each tile has a stable ID separate from its letter; duplicates are distinct
resources. Blanks have `letter: null` in the rack/bag. Enter their desired A–Z
letter in the assignment dialog. Normal play allocates the explicitly selected
physical tiles; the legacy automatic API still prefers exact matches before blanks
in word/rack order for diagnostic callers and regression tests.
Committed cells retain `tileId` and `blank` alongside compatible letter occupancy;
an assigned blank is permanent and behaves as its letter in later words/fences.
Canvas marks it **◇**; selected-cell text also identifies it.

Core seeds accept finite numbers or nonempty strings; the browser field supplies
strings. Type-tagged UTF-16 FNV-1a initializes Mulberry32. Fisher–Yates uses unsigned
rejection sampling to avoid modulo bias. State stores ordered remaining tiles and
the PRNG state; draws take from the front without advancing randomness. Only
initial shuffle and successful exchanges shuffle. Same seed, configuration, and
actions reproduce draws across Node and supported browsers. This seed controls
**letter order only**, not future farm layouts or complete puzzle difficulty.

Rack-aware commitment revalidates geometry/dictionary, allocates physical tiles
for `newPositions`, delegates to existing `commitWord`, adds provenance, consumes
and replenishes, and derives status. Rejections return the exact input state;
board, claims, rack, bag order, RNG, counters and progress all remain unchanged.

## Typed-word controls (Legal word placement lab only)

1. Enter a word (ASCII lowercase normalizes to uppercase) and select horizontal or
   vertical orientation. No punctuation, spaces inside words, blank symbols, or
   diagonals; enter a blank's assigned letter as ordinary A–Z.
2. Tap/click the starting cell, use arrow keys on the focused board, or enter
   **Row** and **Column** and press **Select cell**. UI coordinates start at 1;
   core coordinates start at 0. Editing coordinates clears the old preview until
   you apply them. The initial selection is the designated starting square.
3. Preview updates as you edit the word, orientation, or selection. **Preview word**
   and Enter/Space on the board also preview. Text lists legality, complete formed
   words with locations, new/reused tile counts, and prospective claims.
4. Only **Commit word** accepts a legal preview. It revalidates against current
   state, commits letters, claims land, and increments accepted placements once.
   Rejections leave letters, claims, count, score, and latest award unchanged.
5. **Clear preview** removes the proposal without changing committed state.
   **Restart puzzle** resets only the current mode. Labs offer **Create empty
   board**; rack mode offers **New puzzle**. Default size remains 15×15.

The first word needs at least two letters and must cross ☆. The deterministic
starting cell is `(floor(rows / 2), floor(columns / 2))`, zero-based: the lower/right
middle on even axes. A 7×7 board starts at (4, 4) in UI coordinates; 4×6 starts at
(3, 4). A 1×1 board cannot accept a first word. Subsequent placements must overlap
matching letters or touch them orthogonally. At least one new tile and one formed
word of length two or more are required. A single new letter can be legal.

Validation checks **complete contiguous runs through every new tile in both axes**,
including old letters before/after the entered span. Entering `S` next to `CAT`
validates `CATS`, not `S`. A valid main word with any unknown cross-word is rejected
as a whole. Non-letter metadata cannot be overwritten; farm features are deferred.

Committed letters have solid wood rims. Proposed letters have dashed rims and a
small **p**; **=** marks matching reuse, **×** marks conflict (with the proposed
letter). Text labels valid/invalid previews so color is not the only signal.
**?** marks prospective claims without awarding them. **+** marks the latest actual
claim and **✓** marks older claims. ☆ marks the starting square while empty.

Pan with native touch scrolling, scrollbars, or a trackpad; cells never shrink
below 44 CSS pixels. **Cell display size** offers 44, 56, or 72 pixels. All primary
controls are semantic DOM inputs/buttons; dragging is not required. Board keys
never commit a legal word. There is no persistence, animation, or audio.

## Manual playtesting

### Four words enclose one cell

Choose **Legal word placement lab**, then **Set up 7×7 example**. This resets that
mode and previews CAR only. Apply these starts with **Select cell**, then preview
and commit each move:

| Move | Word | Start (row, column), 1-based | Direction | New / reused | Award |
|---|---|---|---|---|---|
| 1 | CAR | (4, 4) | Horizontal | 3 / 0 | +0 |
| 2 | CAB | (4, 4) | Vertical | 2 / 1 | +0 |
| 3 | RAT | (4, 6) | Vertical | 2 / 1 | +0 |
| 4 | BAT | (6, 4) | Horizontal | 1 / 2 | +1 |

```text
C A R
A . A
B A T
```

The center (5, 5) stays unclaimed through move 3. Previewing BAT shows **?** with
count 3 and score 0, including repeated Enter/Space previews. Clear/recreate the
preview to verify no state changes. Commit BAT: count 4, latest award +1, total
score 1, center empty and marked +. Preview CAR again: `NO_NEW_LETTERS`. Try CAT
at (4, 4): `LETTER_CONFLICT`. Enter X at (4, 7): the full CARX is unknown. These
attempts must leave the result unchanged. Enter S there: CARS is valid, increments
to 5 placements, awards +0, and retains score 1.

### Rack-limited enclosure QA fixture

Expand **Development diagnostics: four words, one enclosure** and choose **Load
scripted rack QA example**. It switches to rack mode and resets only its session.
This is a **scripted QA fixture**, not ordinary seeded generation. It uses every
standard physical tile exactly once, with `CARABTAA` moved to the front and all
other tiles in canonical alphabetical/ID order. First rack: C A R A B T A;
the next draw is A. Seed label `enclosure-qa` initializes exchange randomness only
for this controlled initial order.

Without typing or choosing orientation:

1. Place C, A, R at (4, 4), (4, 5), (4, 6); commit CAR.
2. Place A, B at (5, 4), (6, 4); commit CAB, reusing C.
3. Place A, T at (5, 6), (6, 6); commit RAT, reusing R.
4. Place A at (6, 5); commit BAT, reusing B and T.

Choose specific rack buttons for every new cell; duplicate A buttons are distinct.
These moves consume **3, 2, 2, 1** tiles,
respectively; shared corners are free. Refills leave seven tiles each time and bag
counts **90, 88, 86, 85**. BAT claims exactly (5, 5), index 32, and wins at target 1:
4 words, 0 exchanges, 4 strokes, score 1. Before committing BAT, repeated selection/cancellation and rerenders
must leave count 3, score 0, and bag 86. After victory commitment/exchanges are
blocked, including the lab's optional CARS extension. Restart repeats this fixture.

### Draft editing, blanks and gesture QA

- Load the rack fixture, place C then A, and try R on a diagonal, across a gap,
  onto another draft, or on a committed cell. Useful feedback appears; neither the
  draft nor the bag changes. CA can remain pending until R completes CAR.
- Return A from the middle of CAR; C and R remain visible with a gap warning.
  Replace that same A to repair it. Move/return a tile by both tapping and dragging;
  undo and clear must restore the correct original rack slots.
- For a reproducible blank test, create a 7×7 puzzle with seed **blank-qa-636**.
  The rack is N A T N H ◇ C. Assign the blank O, place it at (4, 4), reassign A,
  then place C at (4, 3) and T at (4, 5). Commit CAT. The ordinary A must remain
  in the rack, and the committed A must display ◇ and report assigned blank.
- Try outside releases, returning to a different slot, Escape, pointer cancellation
  and losing focus mid-drag; pending tiles must be restored exactly. Try exchanges
  with a draft and after clearing. End/restart and switch all three modes.
- On a phone, pan empty/committed cells while a tile is selected: no letter should
  be placed by scrolling. Test a rack-origin touch drag and a drafted tile drag,
  as well as tap placement. Real-device behavior remains a manual QA requirement.

### Cross-words, invalid moves, and input (unrestricted word lab)

- Reset a 7×7 board; CAT at (4, 4) horizontal is valid. Preview BAR at (5, 4)
  horizontal: BAR is known but cross-words CB and AA are unknown (TR is also
  unknown). The whole move must be rejected. No tile or count may change.
- After CAT, commit AT at (4, 5) vertical, reusing A. Then preview/commit TO at
  (5, 5) horizontal, reusing the new T. The single new O forms **two separate TO
  occurrences**, horizontal and vertical. Both must be listed and accepted; the
  counter increases only once for this move.
- Preview BAT at (4, 4) vertical: it conflicts with C. Preview BAT at (1, 1):
  disconnected. Preview CAT at (7, 6): outside the board. Try ZZZ through the
  starting square on a fresh board: unknown. Rejections must disable commitment.
- Focus the board, move with arrows and preview with Enter/Space. Pointer taps
  select starts without placing letters. Test coordinate edits, preview clearing,
  orientation changes, enlarged cells, narrow/wide layouts, and touch panning.
- Switch to the freeform lab, edit a cell, and switch back: legal state is intact.
  Reset and direct refresh clear state as described; follow the arcade return link.

### Milestone 2A freeform diagnostics

Choose **Freeform enclosure lab**. Tap to toggle A; arrow keys select, Enter/Space
or **Toggle selected letter** edits. **Inspect enclosure** reports without claiming;
**Claim enclosed land** awards new cells. Reset affects this mode alone.

Place letters in rows 2 and 4, columns 2–4, plus row 3, columns 2 and 4. Center
(3, 3) is enclosed. Claim twice: +1 then +0. Remove (3, 4): it becomes exterior
but stays historically claimed. Covering a claim with a letter cannot rescore it.
All four edges supply outside access; diagonal land gaps do not provide passage.
Removing only a ring corner leaves its center enclosed under the preserved
orthogonal flood-fill definition. Only explicit letter cells block movement.

## Structure and core integration

```text
src/
  main.js                   Browser bootstrap
  core/
    board.js                Validated dimensions, storage and coordinates (M1)
    letters.js              Explicit occupancy; unrestricted writes for lab (2A)
    enclosure.js            Existing iterative exterior flood fill (2A)
    territory.js            Preview, immutable claims and derived score (2A)
    dictionary.js           ASCII normalization and replaceable has(word) boundary
    demo-vocabulary.js      Provisional local word list
    placement.js            Geometry, connectivity and affected complete words
    puzzle.js               Minimal state and atomic accepted-word transition
    bag.js                  Standard physical tiles, explicit seeded shuffle/draw
    session.js              Automatic/explicit rack commits, exchanges and status
    draft.js                Reversible physical drafts, continuity and run inference
    session-fixture.js      Complete scripted bag and four enclosure QA moves
  rendering/board.js        Shared Canvas view and coordinate transforms
  ui/sandbox.js             DOM controller and isolated development sessions
  ui/tile-input.js          Selection, blank dialog and transactional pointer input
styles/main.css             Local responsive presentation
tests/                      Built-in Node model tests and explicit fixtures
```

`evaluatePlacement(board, { word, row, column, orientation }, dictionary)` returns
legality, structured rejection, proposed positions, new/reused/conflicting tiles,
complete words and candidate board. It never changes state. `commitWord(state,
proposal, dictionary)` re-evaluates and returns the original state on rejection,
or a new `{ board, territory, wordCount }` plus point award and new claims on
success. It calls existing `claimTerritory()` only after full validation. See
[architecture](docs/architecture.md) for result fields and invariants.

## Validation

Use Node.js 22 or newer. From `wordstead/`:

```sh
npm test
```

This runs `node --test` using `node:test` and `node:assert/strict`; no installation
is needed. Use `npm.cmd test` if PowerShell restricts `npm.ps1`. Tests retain all
Milestone 1/2A fixtures and add geometry, centers, normalization, connectivity,
complete/cross-word validation, metadata protection, immutable atomic commits,
preview isolation, counters, claim history, and the four-word integration example.
Milestone 2C tests cover the exact distribution/identity conservation, deterministic
shuffle, repeated-letter allocation, blanks, immutable rejection, stale previews,
low/empty bag draws and exchanges, status locks, forfeits, reproducible restarts,
and the rack-limited four-word victory fixture. Draft tests cover both axes,
committed bridges, temporary gaps/repair, complete-run inference, multiple cross-words,
exact IDs, explicit blank preference, stale/invalid allocations, atomic failures
and the four-word tile-only fixture. Event-surface tests exercise mouse/touch pointer
thresholds, compatibility-click suppression, invalid drops, cancellation/lost capture,
blank dialogs, selection, movement and returns without adding a DOM dependency.

Run `node --check` on affected JavaScript and `git diff --check`. For browser
validation use the manual examples above; inspect console/network errors and test
all three modes, direct loading/refresh, return navigation, narrow/wide layouts, pointer,
keyboard, and touch behavior. No automated browser framework is installed.

## Limits and future integration points

Replace the injected synchronous `has(uppercaseWord) -> boolean` dependency with a
properly licensed dictionary without rewriting placement rules. The implemented
session wrapper consumes `evaluation.newPositions` and delegates to `commitWord`;
matching reused tiles cost nothing. Future farm bonus rules can extend that atomic
transition after territory claiming. Future final grading can consume accepted
word count, exchange count and target; its rubric and exchange cost need playtesting.
Keep future feature-layout randomness explicit and separate from letter seeds.

Official dictionary, complete no-legal-move detection,
farm bonuses, final grades, campaign/daily modes, persistence, leaderboards, final
Sprout Lands integration, decorative animation, and sound remain deferred. The
core expects valid in-memory boards/territory from its constructors; saved-state
validation/deserialization is outside this milestone. Practical board sizes depend
on memory; UI dimensions are capped at 30. No complete game schema is claimed.

## Static hosting

Runtime paths stay relative under `wordstead/`, directly loadable/refreshable on
GitHub Pages without rewrites. The existing publishing source remains `main`, `/`,
with custom domain `games.regniwekim.com`. Entry metadata remains `noindex, nofollow`;
root `robots.txt` disallows crawling. Root arcade, other games, shared assets,
hosting settings, asset records, design skeleton, and visual guide are unchanged.
