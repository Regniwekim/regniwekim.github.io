# Wordstead

**Build a farm, one word at a time.** Wordstead is a single-player spatial word
puzzle and cozy farm builder. The [design skeleton](docs/design-skeleton.md)
defines the planned game; [architecture](docs/architecture.md) documents the
implemented contracts.

## Current status: Milestone 5D release candidate

Wordstead is listed on the main arcade with its own original W-tile favicon.
The release pass improves keyboard focus after draft/exchange actions and avoids
redundant board redraws during dragging. Daily v1, gameplay, vocabulary, targets,
save/history formats and sound preferences retain their existing contracts.
See [release readiness](docs/release-readiness.md) for prioritized findings,
reproducible QA, measured performance, browser/device gaps and release sign-off.

### Interaction feedback (5C)

Player actions now receive short tile-settle, word, harvest, feature, score and
results feedback. A pointer-ignoring overlay animates exact accepted deltas without
redrawing the board each frame. Sound defaults off; **Sound: On/Off** enables quiet,
original procedural Web Audio cues with a separate optional preference. Reduced
motion skips cosmetics, and interrupted effects cancel safely. Core rules, Daily
v1, active saves, history and sharing formats remain unchanged. See
[interaction feedback](docs/interaction-feedback.md) for events, timings, audio,
performance measurements, tests, QA and limitations.

The board now uses original Wordstead pixel motifs: quiet meadow grass, cultivated
claimed plots, growing crops, a hen, a shed and enriched soil. Wooden letter tiles
match the semantic rack buttons; short cardinal rails join committed letters.
Drafts retain pale faces, dashed rims and **p**; previews use **?** outlines without
painting permanent claims. Capture badges, blank **◇**, selection and explicit
invalid **×** clues remain readable above the art. Milestone 5C adds cosmetic feedback
above this permanent presentation.

[Board art](docs/board-art.md) records provenance, layering, substitution boundaries,
browser QA, load-size and redraw measurements. All runtime artwork is newly
authored code/CSS. The private Sprout Lands starter remains private and requires
separate authorization and license review before any future integration.

The Milestone 5A player-first layout remains in place:

**Daily Puzzle** and **Free Play** are the primary navigation. Challenge identity,
farm points/target and accepted words lead directly into the board and physical
rack. Phones use board → rack → Commit Word and draft actions; at 1024px and above,
the rack sits beside the board. Tiles retain their logical sizes and the board
scrolls internally. Nothing is sticky over play.

**How to Play**, **Daily History**, **Farm points & supplies**, **Board key & keyboard
controls**, **Free Play settings** and **Run options** use native disclosures.
The settings panel is absent in Daily mode. Labs and all existing scripted fixtures
are under **Development Tools**. Normal saves are quiet; actionable save/history
notices remain outside closed panels, including unsaved terminal Daily results.
Results retain their collapsible window, copying and completed-farm inspection.
Gameplay, generation, scoring, released Daily fixtures and persistence formats are
unchanged. The interface uses local CSS, system fonts and original Canvas artwork.
See [player interface](docs/player-interface.md) for layout, tokens,
accessibility, reproducible QA and testing limitations.

### Personal Daily history (4B.2)

**History · Daily Puzzle** keeps compact terminal results in a separate browser-local
archive. Browse UTC months, select recorded dates, and see factual totals/averages
for completed challenges. A recorded completion keeps its original statistics across
unlimited retries; unsuccessful results can be upgraded by a completion. Missing
dates do not imply attempts. Free Play and diagnostics are excluded.

History failures leave gameplay and active saves available. Reload/retry controls
recover storage access or conflicts; unusable data stays until explicitly cleared.
**Clear Daily History** requires confirmation and keeps active saves and the board.
Restored terminal runs offer an explicit save when missing from history, so clearing
does not recreate records on refresh. Data stays in this browser/profile and device,
without synchronization or backup, and can disappear with website-data clearing or
browser eviction. See [personal history](docs/personal-history.md) for the schema,
limits, statistics, compatibility, privacy and reproducible QA.

Daily Puzzle and Free Play automatically save independent attempts on the current
browser and device, including uncommitted drafts and assigned blanks. Refresh or
return later to resume the original puzzle, resources, target and terminal results.
Restoration validates versioned action histories through the existing rules and
dictionary. Storage failures leave play available with a warning; incompatible
saves remain until explicitly discarded. See [local persistence](docs/local-persistence.md)
for schema, limits, privacy, compatibility, conflict handling and reproducible QA.

**Daily Puzzle** is the default: the same UTC date and game revision produce the
same 15×15 farm, 100-tile bag order, seven-tile opening rack and automatic target.
Daily v1 fixes density at 0.08 and the existing standard feature weights, ESDB
vocabulary and `auto-target-v1` model. **Free Play** keeps the customizable seeded
puzzle and manual/automatic targets. Both labs remain independent. See
[daily rules, compatibility, reproducibility and QA](docs/daily-puzzles.md).

Dates roll over at **00:00 UTC**, using the device clock. An active run keeps its
date and target; **Start today's challenge** explicitly starts the newest date.
Restart repeats the active challenge, including after midnight. Unlimited retries
are allowed. Daily shares include the date and concise revision. A saved previous
Daily resumes with its original date. Starting today's challenge replaces its
single save; meaningful progress requires confirmation before replacement/restart.
Incorrect device clocks can select the wrong date. Experimental targets are not
guaranteed reachable, and different days may vary in actual difficulty.

The game accepts connected horizontal/vertical words, reuses matching
committed letters, validates every affected complete word, and automatically claims
newly enclosed empty land. Each accepted placement counts once, even if it forms
several words. Letters are permanent during legal play. Territory earns one point
per newly claimed cell. Total puzzle score adds captured crop and fertile bonuses,
derived from that same claim mask. Farm cells remain passable land for flood fill
but are reserved against letter placement.

**Daily Puzzle** and **Free Play** draw seven physical tiles from a seeded
100-tile bag, replenishes after accepted words, permits exchanges, and finishes
when the total score target is reached. Captured livestock adds rack slots (up to
nine); buildings grant free exchange credits. The page tracks accepted words;
each charged exchange adds one stroke. Build words directly from physical
rack tiles using click/tap, Pointer Events dragging, or keyboard controls. Both old
labs remain available.

Finished rack runs now show actual results and offer **Copy Results** with a
manual-copy fallback. Wordstead remains entirely static and client-side: no
grading, rankings, analytics, accounts, or backend services.
Daily results also acknowledge history saving and offer **View Daily History**.
On a history-write failure, keep the terminal run available and retry saving it.
Milestone 3B deliberately supersedes the planned efficiency grading in the
design skeleton and grade/share-art references in the exploratory visual guide
for the current implementation; neither source document is rewritten.

Normal play uses **78,626 words** from the licensed
**ESDB American English size-60** list, version `esdb-en-us-60-1e5b7d3-ws1`,
**not an official Scrabble dictionary**. A local 750,727-byte static file loads
once before gameplay; failure keeps play disabled and offers retry. Words validate
synchronously without network requests after loading. Refresh/reopen requires the
static game resources and dictionary to be available; offline reload is not
supported or guaranteed by ordinary browser caching. No external word service or per-word
requests are used. See [source, policy and regeneration](docs/vocabulary.md),
[browser credits](vocabulary/index.html), [upstream notice](licenses/esdb/Copyright)
and [measured validation](docs/vocabulary-validation.md).

Milestone **3C.1** adds development-only vocabulary statistics, physical-rack
constructibility, sampled 7/8/9-tile baselines and deterministic letter-seed reports.
Run `node scripts/analyze-letters.js --help`; see [methods and measured results](docs/letter-analysis.md).
Its authoritative trie, measurements and sampled baselines remain development tools.

Milestone **3C.2** adds independent geometric board-opportunity estimates:
eligible scoring upper bounds, rectangular candidate fences, feature obstruction,
effort/spans, ranked/Pareto views and bounded greedy portfolios. Run
`node scripts/analyze-board.js --help`; see [methods, CLI and measured batches](docs/board-analysis.md).
These are geometric opportunities, without claims about playable word sequences
or solvability. Both original analysis methods and their artifacts are unchanged.

Milestone **3C.3** combines bounded board opportunities with a compact approximation
of seeded rack flexibility to propose **Automatic — Experimental** score targets.
The initial Free Play puzzle resolves to **12 farm points**. Manual targets remain available in Free Play;
the integer core constructor and every scripted fixture retain their original behavior.
Run `node scripts/analyze-targets.js --help`; see [formula, calibration, held-out
findings, browser measurements and limitations](docs/automatic-targets.md).
Analytical calibration does not establish human difficulty or guaranteed solvability.

Milestone 1's configurable board and Milestone 2A's enclosure/territory modules
remain unchanged. **Legal word placement lab** keeps unrestricted word entry and
automatic claims. **Freeform enclosure lab** retains arbitrary A-tile
editing/removal and manual claims. Each mode has its own state; lab edits cannot
enter legal play. Switching modes preserves their separate sessions; refresh clears
only the labs and diagnostic fixtures. Scripted fixtures never overwrite the Free
Play save. Original Canvas art and system fonts require no third-party assets. Existing
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
**Back to Main Arcade** points to `../index.html`. The homepage lists Wordstead
at `./wordstead/` alongside Target Tap. Direct loading needs no homepage session.

## Rack-limited puzzle controls

Choose **Free Play** for customization. **Free Play settings** provides separate letter
and farm seeds, farm density, independent 1–30 board dimensions, and target mode.
**Automatic — Experimental** is the normal default. **Calculate Target** previews
the current setup before **New Puzzle** starts it. Editing settings invalidates the
preview; submitting an uncalculated automatic setup first displays its estimate
without replacing the active puzzle. An unavailable estimate asks you to change
settings or choose **Manual**, which exposes the existing positive integer control.
**New puzzle** applies these settings to a fresh seeded run. **Restart puzzle**
repeats the active run's original settings and tile order (including the scripted
fixture), regardless of edits in the setup form. The initial board is 15×15,
automatically targeting **12**. Targets stay fixed through words, previews,
exchanges and farm captures. The legacy `createSession()` default remains 1 for
API compatibility. Different seeds are not guaranteed equally difficult or solvable.

Seven to nine persistent DOM rack buttons show letters or **◇** for blanks; empty slots
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
On phones the rack wraps at four slots per row immediately below the board; Commit,
Undo and Clear follow the rack. Tablets use one rack row when space allows; the
desktop side column uses four slots per row, including nine-slot racks. No native
HTML drag-and-drop is required.

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

**Commit word** enables for a nonempty editable draft, including an invalid preview
that the player explicitly wants to check. Commitment reconstructs and revalidates
the current draft, consumes
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
pool is deterministically shuffled. Each completed exchange automatically uses one
available free credit, otherwise it costs one provisional stroke. Failed exchanges
and cancellation cost nothing. Credits never bypass the bag-size requirement.

The page shows rack/capacity and bag counts, total score/target, base territory and
farm bonus points, accepted word placements, exchanges, charged exchanges, free
credits, and derived **strokes = wordCount + exchangeCount − freeExchangesUsed**. Victory
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
**letter order only**. Farm layout uses its own explicit seed and PRNG stream;
changing farms cannot change the letter bag or exchange randomness.

Rack-aware commitment revalidates geometry/dictionary, allocates physical tiles
for `newPositions`, delegates to existing `commitWord`, adds provenance, consumes
and replenishes to post-capture capacity, and derives status from total score.
Rejections return the exact input state;
board, claims, rack, bag order, RNG, counters and progress all remain unchanged.

### Farm features and provisional rewards

Every feature is one `{ kind: 'feature', type }` board cell. Type definitions and
reward values are centralized in `src/core/features.js`. Only actual letters form
fences. A feature is traversable land for enclosure detection, yet both draft and
committed word placement reject overwriting it. This reserved-cell policy is
provisional and subject to playtesting. Claiming preserves the feature object.

| Capture | Base territory | Farm points | Utility |
|---|---:|---:|---|
| Crop | 1 | +3 | None |
| Fertile ground | 1 | +1 | This cell only; no future multiplier |
| Livestock | 1 | 0 | +1 rack capacity, starting at 7 and capped at 9 |
| Building | 1 | 0 | +1 free exchange credit |

A feature activates only when its cell enters a new territory claim. The claim
mask is its permanent capture status; there is no mutable captured flag or score
tally. `getTerritoryScore()` still counts base claims. `getPuzzleScore()` derives
base, crop, fertility, combined farm bonus and total points. Three ordinary land
cells plus a crop and fertile cell give 5 + 3 + 1 = **9 points**. Re-evaluation
awards nothing again. Victory checks the total only after an accepted word.

Rack capacity is derived from captured livestock. Additional captures past nine
still earn their base point. Refills use existing physical tiles from the finite
bag, including on the capture turn; insufficient/empty bags cannot create tiles.
Credits are captured buildings minus successfully used free exchanges. Credits
accumulate, and the next successful exchange consumes one automatically. Total
exchange count stays visible independently of charged exchanges and strokes.

Canvas uses original growing-plot, hen, shed and enriched-soil pixel motifs with
**C/L/B/F** labels. Farm motifs retain their land background and show **?** in preview, **+**
on a new capture and **✓** on older captures. Select a feature with a tap, board
arrows, or coordinates to read its type, capture status and effect. Capture status
and each earned point/utility reward are also announced in action text.

The browser defaults to farm seed `wordstead-farm-2d`, density **0.08**, and weights
**crop 4, livestock 2, building 2, fertile 3**. Generation shuffles eligible empty
interior cells, reserves `floor(eligibleCount × density)` cells, then selects
weighted types. The perimeter, starting square and its orthogonal neighbors are
protected. Small boards may have no eligible features. Browser density is 0–0.25;
the pure generator supports 0–1 for controlled tests. Density 0 disables features.
The core session API opts into generation via `farmSeed`; omission keeps the
legacy feature-free behavior and original fixtures. Restart preserves the active
farm seed/settings as well as letter order. Layouts have no solver or difficulty
guarantee; some may have no reachable solution.

## Results and sharing

Only terminal rack sessions produce results. An accepted word reaching the target
shows **Harvest Complete!**; **End unfinished run** shows **Farm Unfinished**;
the existing empty-rack-and-empty-bag condition shows **Out of Tiles**. A preview
never finishes a run. There is still no exhaustive no-legal-moves solver.

The cream results window opens over the board. Activate its **Collapse results**
header to move it above the board's scroll area and reveal the entire farm,
including the first row. **Show results** expands it over the board again. It
prominently displays actual farm points versus target and accepted word placements. Expand **Score,
exchanges & farm captured** for base territory, crop/fertility/combined farm bonus
points, total/free/charged exchanges, and counts of captured crops, fertile cells,
livestock and buildings. Its context identifies Free Play (or scripted QA) and
board dimensions. The target is a victory requirement, with no performance grade
or implied ranking. **View Results** near the run status reopens the window and
jumps to it;
finishing never automatically moves focus or scrolls the page.

The final board and captured features remain visible, pannable and inspectable by
pointer, arrows or coordinates; gameplay mutations stay disabled. The existing
**Restart Puzzle** control is in Run options and repeats the original active
configuration, independent of setup edits. **New Puzzle** opens Free Play settings;
review/edit the settings there and use its submit button to create a fresh run.
Restart/new runs clear the old results, text and clipboard feedback. The two
diagnostic labs keep separate sessions and do not display rack results; returning
to a finished rack run restores its own summary.

`src/core/results.js` derives a frozen terminal summary via `getSessionResults()`
using the existing scoring, capture and charged-exchange helpers. It stores
no additional score or capture history. `formatResultsShare()` produces fixed
plain-text newlines: WORDSTEAD, the correct finish heading, score/target, words,
exchanges, territory plus total farm bonus, tagline and
`https://games.regniwekim.com/wordstead/`. The default text excludes played words,
letters, positions, board layout, unrevealed tiles and seeds/settings. It makes no
identical-puzzle claim for Free Play and encodes no session in the URL. Daily adds
its date and concise revision after WORDSTEAD; all other result fields are shared.

**Copy Results** requests the browser Clipboard API only on activation. Success
appears after the write completes. If unavailable or denied, a useful status opens
**Share text / manual copy** with the same result in a labeled read-only textarea.
That disclosure is also available before copying. **Select share text** selects
it on explicit activation; use the device’s Copy command or Ctrl+C/Command+C.
Copying, inspecting and opening disclosures never change the run. Results and
share text omit strokes; the gameplay accounting remains unchanged.
**More Games (new tab)** opens `https://games.regniwekim.com/` in a separate tab
only when activated, keeping the completed farm available. Production terminal
runs also resume with the same board, summary and Copy Results after refresh.

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
as a whole. Non-letter metadata, including farm features, cannot be overwritten.

Committed letters have solid wood rims. Proposed letters have dashed rims and a
small **p**; **=** marks matching reuse, **×** marks conflict (with the proposed
letter). Text labels valid/invalid previews so color is not the only signal.
**?** marks prospective claims without awarding them. **+** marks the latest actual
claim and **✓** marks older claims. ☆ marks the starting square while empty.

Pan with native touch scrolling, scrollbars, or a trackpad; cells never shrink
below 44 CSS pixels. **Cell display size** offers 44, 56, or 72 pixels. All primary
controls are semantic DOM inputs/buttons; dragging is not required. Board keys
never commit a legal word. Daily and Free Play save locally; labs remain transient.
Short interaction effects and optional original procedural sounds are documented
in [interaction feedback](docs/interaction-feedback.md).

## Manual playtesting

### Four words enclose one cell

Open **Development Tools**, choose **Legal word placement lab**, then **Set up 7×7 example**. This resets that
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

Under **Development Tools**, expand **Development diagnostics: four words, one enclosure** and choose **Load
scripted rack QA example**. It switches to rack mode and resets only its session.
This is a **scripted QA fixture**, not ordinary seeded generation. It uses every
standard physical tile exactly once, with `CARABTAA` moved to the front and all
other tiles in canonical alphabetical/ID order. First rack: C A R A B T A;
the next draw is A. Seed label `enclosure-qa` initializes exchange randomness only
for this controlled initial order.

All scripted rack/farm examples and the word lab's **Set up 7×7 example** use the
preserved hand-selected demo vocabulary, labeled **QA fixture only** below formed
words. Restart and mode switching retain each run's dictionary. **New puzzle** or
**Create empty board** starts a fresh run with ESDB. The demo list remains available
to diagnostic imports in `src/core/demo-vocabulary.js`; no word suggestions or
expandable full list appear during ordinary play.

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

### Results QA

- Complete the unchanged rack fixture above. Before BAT commits, no results appear;
  after commitment expect **Harvest Complete!**, **1 / 1**, **4 words** and **0 exchanges**.
  Copy and paste into a text editor; all those numbers must match, with no strokes.
- Collapse and expand the window by pointer and keyboard; inspect and pan the farm
  while collapsed. **View Results** must reopen it. **More Games** must open the
  arcade in a separate tab while the finished farm remains in the original tab.
- At a narrow width, collapse results and pan to the top-left and top-right board
  corners at both 44px and 72px cell sizes. Tap the first-row cells and confirm
  their coordinates are selected. The header must sit entirely above the scroll
  area; keyboard selection must also reveal these cells without covering them.
- Open the manual-copy disclosure and select/copy its text with the keyboard. Test
  with clipboard access unavailable/denied: failure must expand that same text,
  explain manual copying and never claim success.
- Repeat the crop/fertile fixtures below: expect **4 / 4** (1 base +3 crop) and
  **2 / 2** (1 base +1 fertility), four words and one captured feature each.
- In the building fixture, complete a free exchange and a charged exchange, then
  end the run. Expect **Farm Unfinished**, **1 / 20**, four words, two exchanges,
  one free exchange used, one charged exchange and one building.
  The share text must agree. End a fresh run too: all counters/points are zero.
- Inspect the finished farm, pan/enlarge it, and move the cursor with arrows.
  Verify no letters or totals change. Tab through Copy, manual selection, Restart
  and New Puzzle; use Enter/Space to activate controls and check visible focus.
- Edit the setup fields before Restart: the active original fixture/configuration
  must repeat. **Run options** contains Restart. **New Puzzle** in Free Play results
  opens Free Play settings and removes old results only after a new run starts. Switch to
  both labs and back: only the rack's own finished results may reappear.
- Check narrow/wide layouts, direct loading/refresh, return navigation and browser
  errors. Exhaustion is tested in Node by consuming a full real bag on a long test
  board with an injected dictionary; no browser no-moves solver or exhaustion
  shortcut is added.

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
  with a draft and after clearing. End/restart and switch all four modes.
- On a phone, pan empty/committed cells while a tile is selected: no letter should
  be placed by scrolling. Test a rack-origin touch drag and a drafted tile drag,
  as well as tap placement. Real-device behavior remains a manual QA requirement.

### Farm capture QA fixtures

Expand **Development diagnostics: farm capture fixtures**, select a type, then
**Load scripted farm QA example**. These dedicated fixtures leave the old rack
and lab examples unchanged. Each reserves (5, 5), uses the original complete
100-tile CARABTAA bag order, and accepts the same four rack-only moves above.

- **Crop:** preview BAT: base 0, bonus 0, total 0. Commit: base 1, crop bonus 3,
  total 4, victory at target 4. Select (5, 5) to read captured/activated status.
- **Fertile ground:** commit BAT: base 1, fertility bonus 1, total 2, victory at 2.
- **Livestock:** target 20 keeps playing. BAT gives base/total 1, capacity 8,
  eight rack tiles and bag 84 (one extra real draw). Try a later word or exchange;
  capacity stays eight.
- **Building:** target 20 keeps playing. BAT gives base/total 1 and one credit.
  Cancel an exchange: nothing changes. Complete one: exchanges 1, credits 0,
  charged exchanges 0, strokes 4. Complete another: exchanges 2, charged 1,
  strokes 5. An empty selection or insufficient bag cannot consume credit.

Before the fourth commit, repeated previews, selection, invalid words or failed
tile allocations must not claim the feature or grant utility. A feature cannot be
overwritten before or after capture. Later accepted words must retain capture and
never repeat its reward. Restart reconstructs the same fixture. **New puzzle**
creates an ordinary farm from setup settings. Automated mixed-enclosure fixtures
add multiple features and independent regions without altering the four original moves.

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
    demo-vocabulary.js      Preserved hand-selected QA fixture only
    placement.js            Geometry, connectivity and affected complete words
    puzzle.js               Minimal state and atomic accepted-word transition
    bag.js                  Standard physical tiles, explicit seeded shuffle/draw
    session.js              Automatic/explicit rack commits, exchanges and status
    results.js              Immutable terminal summary and spoiler-free share text
    draft.js                Reversible physical drafts, continuity and run inference
    session-fixture.js      Complete scripted bag and four enclosure QA moves
  daily/                    Pure UTC dates, v1 definitions, session creation/restart
  persistence/              Versioned action history, validated replay and storage adapter
  rendering/board.js        Shared Canvas view and coordinate transforms
  ui/sandbox.js             DOM controller and four isolated mode sessions
  ui/daily-mode.js          Explicit browser clock boundary and daily availability
  ui/save-controls.js       Local status, recovery controls and replacement dialog
  ui/tile-input.js          Selection, blank dialog and transactional pointer input
  ui/startup.js             Loading/error/retry gate before gameplay initialization
  ui/results.js             Result presentation, clipboard feedback and manual copy
  vocabulary/               Static parser, memoized loader and generated manifest
  analysis/                 Pure analysis, compact automatic targets and session wrapper
styles/main.css             Local responsive presentation
vocabulary/                 Committed word list, generation report and browser credits
data/letter-analysis/       Versioned generated profile, baselines and ESDB notice
scripts/                    Development-only vocabulary, letter, board and target tools
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

Farm tests add four exact rack-draft capture fixtures, mixed/independent regions,
bonus victory, permanent capture without double rewards, frozen atomic rejection,
capacity cap and partial refills, physical conservation, accumulated free credits,
charged strokes, deterministic layouts, protected cells, rectangular/small boards,
seed independence and seven/eight/nine-slot presentation checks.

Results tests cover actual victory/ending/exhaustion transitions, preview isolation,
all score components, multiple/zero feature captures, livestock/buildings, free and
charged exchanges, immutability, terminal mutation locks, deterministic spoiler-free
text and the static URL. Event-surface tests cover clipboard success timing,
unavailable/denied fallback, selection, restart/new/mode clearing and stale async
copy completions. They do not substitute for browser or real-device touch QA.

Vocabulary tests cover deterministic transforms, metadata export settings, character,
case and length filtering, malformed input, committed checksums/counts, synchronous
membership, inflections/two-letter words, memoized loading, failure/retry and an
inert startup gate. Expanded-list regressions cover physical drafts, blank provenance,
cross-words, repeated previews, atomic commitments, farm fixtures and seeded
exchanges. Run `node scripts/benchmark-vocabulary.js` for preparation/lookup timing.
Generation and a byte-for-byte `--check` are documented in
[the vocabulary guide](docs/vocabulary.md#reproduce-and-verify).

Automatic-target tests cover bounded geometry and an independent candidate scan,
all source identities, byte-for-byte coefficient regeneration, held-out lexical
error, seed sensitivity, integer bounds, structured unavailable results, real
seeded victory, fixed targets through transitions, restart, manual bypass, current
setup previews, results/copy compatibility and the complete browser import graph.
The two earlier development-only import assertions now permit the compact target
path while continuing to exclude trie construction, baseline sampling and full
development reports. See [target validation commands](docs/automatic-targets.md#reproduce).

Daily tests pin strict Gregorian/UTC dates, timezone independence, month/year/leap
boundaries, seven full initialization fixtures, restart, unavailable models,
dated spoiler-free sharing and the real controller's four-mode isolation,
custom-setting isolation, Copy Results and controlled midnight navigation.
The [separate browser QA page](scripts/daily-qa.html) supports explicit dates,
390/1440px previews, isolated QA saves and simulated storage failures without
adding date controls to ordinary play. Persistence tests compare complete replayed
sessions, drafts, terminal results, targets, captures, bag order and RNG; real
controller tests cover autosaving, refresh, rollover, replacement, fixture isolation,
corruption, unavailable storage and two-tab conflicts.

Run `node --check` on affected JavaScript and `git diff --check`. For browser
validation use the manual examples above; inspect console/network errors and test
all four modes, direct loading/refresh, return navigation, narrow/wide layouts, pointer,
keyboard, and touch behavior. No automated browser framework is installed.

## Limits and future integration points

The injected synchronous `has(uppercaseWord) -> boolean` dependency now uses the
licensed ESDB list in normal play, without rewriting placement rules. The implemented
session wrapper consumes `evaluation.newPositions` and delegates to `commitWord`;
matching reused tiles cost nothing. Farm rewards extend that same atomic
transition after territory claiming. Results report actual accepted words,
exchange accounting and target without grading or comparison.
Feature-layout randomness is explicit and separate from letter seeds.

Tournament dictionary compatibility, complete no-legal-move detection,
campaign mode, leaderboards, final
Sprout Lands integration and continuous decorative animation remain deferred. The
core expects valid in-memory boards/territory from its constructors; the persistence
boundary reconstructs them through validated action replay. Practical board sizes depend
on memory; UI dimensions are capped at 30. No complete game schema is claimed.

Open playtest questions include reserved-cell placement policy, feature density
and weights, point values, the nine-slot cap, automatic free-credit use, and useful
targets with the expanded vocabulary. Multi-cell buildings, animated animals,
growing/harvesting timers, upgrades and advanced feature interactions are deferred.

Vocabulary updates can change word acceptance and whether old puzzles are solvable.
Daily v1 pins its dictionary version/checksum and target method. Incompatible future
updates require a new daily revision; retaining old play requires a compatible
engine and vocabulary. See the [released-definition policy](docs/daily-puzzles.md#compatibility-and-released-definition-policy).

## Static hosting

Runtime paths stay relative under `wordstead/`, directly loadable/refreshable on
GitHub Pages without rewrites. The existing publishing source remains `main`, `/`,
with custom domain `games.regniwekim.com`. Entry metadata remains `noindex, nofollow`;
root `robots.txt` disallows crawling. Milestone 5D adds only Wordstead's card and
game count to the root arcade. Other games, shared CSS, hosting settings, asset
records, design skeleton and visual guide are unchanged. No service worker or
PWA cache is installed. Use a hard reload after deployment if native modules are
stale; automatic offline updates require a separately designed compatibility policy.
