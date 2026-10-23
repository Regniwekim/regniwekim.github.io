# Wordstead

**Build a farm, one word at a time.** Wordstead is a single-player spatial word
puzzle and cozy farm builder. The [design skeleton](docs/design-skeleton.md)
defines the planned game; [architecture](docs/architecture.md) documents the
implemented contracts.

## Current status: Milestone 2B

The browser prototype accepts connected horizontal/vertical words, reuses matching
committed letters, validates every affected complete word, and automatically claims
newly enclosed empty land. Each accepted placement counts once, even if it forms
several words. Letters are permanent during legal play. Territory earns one point
per newly claimed cell, with total score derived from the existing claim mask.

This is **not the full game**. Word entry is unrestricted by a rack; membership uses
a hand-selected, provisional, incomplete local vocabulary, **not an official
Scrabble dictionary**. No external word service or third-party dictionary is used.
The complete demonstration list is available in the page's expandable word list.

Milestone 1's configurable board and Milestone 2A's enclosure/territory modules
remain unchanged. A separate **Freeform enclosure lab** retains arbitrary A-tile
editing/removal and manual claims. Each mode has its own state; lab edits cannot
enter legal play. Switching modes preserves their separate sessions; refresh clears
both. Canvas primitives and system fonts require no third-party assets. Existing
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

## Legal word placement controls

1. Enter a word (ASCII lowercase normalizes to uppercase) and select horizontal or
   vertical orientation. No punctuation, spaces inside words, blanks, or diagonals.
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
   **Reset puzzle** clears the current mode. **Create empty board** accepts
   independent 1–30 dimensions and resets that mode. Default size remains 15×15.

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

Choose **Legal word placement**, then **Set up 7×7 example**. This resets that
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

### Cross-words, invalid moves, and input

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
  rendering/board.js        Shared Canvas view and coordinate transforms
  ui/sandbox.js             DOM/input controller and isolated development sessions
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

Run `node --check` on affected JavaScript and `git diff --check`. For browser
validation use the manual examples above; inspect console/network errors and test
both modes, direct loading/refresh, return navigation, narrow/wide layouts, pointer,
keyboard, and touch behavior. No automated browser framework is installed.

## Limits and Milestone 2C integration points

Replace the injected synchronous `has(uppercaseWord) -> boolean` dependency with a
properly licensed dictionary without rewriting placement rules. A future rack/bag
layer can consume `evaluation.newPositions` for tile accounting and delegate legal
commits to `commitWord`; matching reused tiles do not consume new letters. Keep
randomness explicit and seeded in future work. Neither tiles nor words directly
score points, and no second score field is needed.

Rack/draws/exchanges, official dictionary, blanks, farm bonuses, seeds/generated
puzzles, targets/grades, campaign/daily modes, persistence, leaderboards, final
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
