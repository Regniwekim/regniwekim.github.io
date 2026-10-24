# Player interface — Milestone 5A

Wordstead uses a mobile-first, dependency-free presentation of the existing game.
This milestone changes HTML, CSS and browser presentation/controller bindings.
It adds no gameplay rules, target calibration, generation, vocabulary, scoring,
result/share calculations, persistence schema or history policy. The exploratory
[v0.1 visual guide](visual-guide-v0.1.md) remains a historical reference; its old
grade/achievement/art proposals are not part of this interface.

## Information hierarchy and navigation

The compact Wordstead heading retains **Build a farm, one word at a time.**
Two semantic, visibly selected buttons offer **Daily Puzzle** and **Free Play**.
They call the existing mode controller and preserve independent sessions and
drafts. The Daily challenge date, farm points/target and accepted word count lead
into the board. The page then presents the physical rack, placement feedback,
**Commit Word**, Undo and Clear. Valid previews name all formed words and the
prospective farm-point award. Invalid drafts explain what needs attention in text.
Detailed word geometry, allocations, reused/missing letters and diagnostic codes
remain in **Word & tile details**.

The ordinary Daily date is concise. A resumed earlier date visibly explains the
new challenge's availability and save replacement. **Start today's challenge**
appears only when it can select another date; the existing replacement confirmation
and UTC semantics remain authoritative. Midnight, resizing and mode switching
cannot replace an active run. Daily never exposes Free Play configuration fields.

**Farm points & supplies** retains territory/farm bonuses, latest award, rack/bag,
exchanges, charged exchanges, credits, strokes, seeds, density and technical puzzle
identity. **Board key & keyboard controls** holds the full legend and coordinate
form. Tile-size selection remains beside the board. **Run options** holds the
subordinate, dashed-border Restart and End Run actions. Existing confirmation
behavior is retained; this milestone does not add a new ending policy.

**Free Play settings** contains the original dimensions, separate seeds, density,
automatic-target preview, manual target and New Puzzle form. Automatic settings
still require a reviewed current estimate before creation. Restart still uses the
active puzzle's original settings. Labs use the same form as **Lab board settings**.

## Responsive layout

The actual DOM order is board, rack and word actions, then supporting panels.
This order also provides a predictable reading and keyboard sequence.

| Available CSS width | Behavior |
| --- | --- |
| Below 640px | Single column; four rack slots per row, including a third row for nine tiles. Utilities follow play. |
| 640–1023px | Single play column, one rack row sized to capacity, two supporting columns. |
| From 1024px | Board is the main column; a 20–23rem second column holds rack/actions and feedback. Rack wraps at four slots. Supporting panels use three columns. |

The page has no sticky rack, toolbar or action layer. There is no fixed element
covering playable cells. The board uses native internal scrolling, a maximum
height of 46svh on single-column layouts and 68svh in the two-column layout,
capped at 44rem. Its Canvas and cells retain their existing dimensions and
orthographic geometry. A smaller viewport pans instead of shrinking letters.
The Canvas centers in surplus horizontal room; hit testing still uses its actual
bounding rectangle. Initial load, reset, display-size changes and resize reveal
the selected cell inside the board pane without scrolling the document or taking
focus. Resizing never writes a save.

The rack and drafted handles retain their existing touch-action behavior and
Pointer Events transactions. Empty and committed board cells retain native touch
scrolling. There is no new drag implementation or edge auto-scroll. Tap and
keyboard placement remain complete alternatives to dragging.

## Control hierarchy and help

Commit Word spans the rack panel and enables only through the existing legal-draft
evaluation. Undo/Clear follow it, with selection/return/blank controls and exchanges
below. A blank still opens the native A–Z dialog. Selected tiles use an outline and
checkmark; drafted slots use a dashed inset and return arrow. The placement status
uses words such as **Valid preview** and **Draft not ready**, alongside the existing
Canvas symbols, so color is supplementary.

**How to Play** is a short six-step explanation of connected words, the starting
square, letter fences, territory, captured features and the target. Further native
disclosures explain draft editing, blanks, exchanging, reuse, feature rewards and
local saving. Feature cells are explicitly described as unavailable for letters.
Word-list credits, licenses and acceptance policy remain linked in the footer,
alongside the return to the main arcade. Successful dictionary preparation is
visually quiet but remains an accessible status; loading/error/retry stays visible.

**Development Tools** contains the original four-mode selector, unrestricted word
lab, freeform enclosure lab and all rack/farm/enclosure examples. Selecting a lab
opens this disclosure and labels the active board clearly; neither ordinary mode
button is selected. Diagnostic fixtures continue to label themselves as QA and
retain Resume Free Play. No fixture or QA page is removed.

## Results, History and saving

Terminal results retain their native disclosure over the completed board, with
internal scrolling, the same calculated values, score/capture breakdown, clipboard
workflow and manual-copy fallback. Collapsing results puts the header in normal
flow above the pane, so all board cells remain reachable. **View Results** reopens
and focuses this same window. **New Puzzle** in Free Play results opens the existing
settings disclosure; it cannot create or replace a run itself. Daily History is
available from navigation and results. The calendar is below gameplay and closed
by default; explicit opening focuses its summary. Calendar dates, statistics,
record details, previous/next month, clear and storage recovery retain their
original behavior. Very narrow calendars scroll internally with 44px dates.

Normal local-save status uses a small unboxed line. Slot invalid/unavailable/conflict
states use a bordered, visible notice and the original recovery buttons. History
corruption, storage failures, conflicts and capacity warnings have a visible notice
outside the closed History panel. A terminal Daily result needing an explicit save
or retry also exposes that notice, with links to History and the result/save action.
Collapsing results cannot hide the need for recovery. Notices derive directly from
the existing slot/archive/result view; there is no duplicate save status model,
second archive, new key or new localStorage record.

Internal Help, History, Results and New Puzzle links handle disclosure and explicit
navigation themselves. They prevent default fragment navigation so a `base` URL in
the controlled-clock QA iframe cannot leave the injected session. Rendering,
completion, warnings and mode switching never automatically focus/scroll the page.

## Accessibility and tokens

Controls remain semantic buttons, inputs, selects, links and native disclosures.
Closed disclosures exclude their contents from sequential focus. Mode buttons use
`aria-pressed`; board coordinates and physical tile IDs retain accessible labels.
Live status/alert roles, the skip link, visible focus, blank and replacement dialog
focus behavior, 44px targets and reduced-motion preference support are retained.
Only explicitly activated panel navigation moves focus. The board model and
logical coordinate system never depend on these presentation choices.

The local stylesheet consolidates reusable presentation tokens:

| Token | Value / role |
| --- | --- |
| `--ink`, `--fern` | `#354c43`, `#4a6452`: dark text and primary controls |
| `--meadow`, `--sage`, `--harvest` | `#bdd27e`, `#91aa85`, `#dce9b6`: farm/claim states |
| `--cream`, `--oat`, `--wood` | `#f5e8c8`, `#f0d7af`, `#a67c61`: results and tactile tiles |
| `--page`, `--surface`, `--support` | `#f4f5eb`, `#fffdf6`, `#edf1e6`: calm page/panel layers |
| `--border`, `--warning` | `#c6d3bf`, `#8c3936`: separation and actionable warning rim |
| `--radius`, `--space` | 0.75rem panel radius; 1rem spacing, 1.25rem at wider widths |

System fonts render essential text and letter glyphs; Georgia supplies the native
brand heading. No external font service, art, audio, runtime dependency or elaborate
animation is added. Existing Canvas primitives and palette remain unchanged.

## Reproducible QA

From `wordstead/`, run `npm test`, `node --check` on changed JavaScript and inline
QA modules, and `git diff --check`. `tests/player-interface.test.js` validates
balanced entry markup, unique IDs, controller targets, label/anchor references,
native disclosures, play order and warning placement. Real-controller tests cover
new navigation, retained sessions, disclosure access, warning visibility and
explicit results focus. All prior gameplay/save/history/input tests still run.

Serve the repository root with `python -m http.server 8000 --bind 127.0.0.1`.
Use a fresh local origin/profile or hard reload after editing native modules to
avoid cached dependencies. Open `/wordstead/` directly, refresh, and follow the
arcade return link. There is still no Wordstead homepage card.

1. Inspect fresh and partly played puzzles at **320, 360, 390, 768, 1024 and 1440px**.
   Verify document scroll width does not exceed viewport width. Open each secondary
   panel too. Check that the rack follows the board and Commit is reachable by
   ordinary page scrolling, including with a short viewport.
2. Switch Daily/Free Play with drafts and accepted words present; return and refresh.
   Check settings only in Free Play, original restart settings, and canceled/accepted
   replacement confirmations. Use keyboard navigation and visible focus throughout.
3. Select, tap-place, move, return, undo and clear physical tiles. Drag from both
   rack and draft; test outside drops/cancellation. At 44/56/72px cells, pan and use
   arrows/coordinates; board scrolling must not place tiles. Exercise reserved
   features, dictionary rejection and incomplete drafts.
4. Use the README's CAR/CAB/RAT/BAT fixtures and all four farm types. Check the
   expanded eight-tile rack and free then charged exchanges. For reproducible
   visual seven/eight/nine-slot samples, open `/wordstead/scripts/rack-layout-qa.html`.
   It uses the production renderer/CSS and controlled derived-capacity state,
   without changing saves or providing gameplay. For actual nine-tile play, use
   a suitable captured-livestock run; model tests pin capacity and rack invariants.
5. Create the README's `blank-qa-636` puzzle, assign/reassign its blank, commit CAT,
   exchange, refresh and inspect provenance. Test both diagnostic labs and manual
   freeform claims. End a run; inspect results, copy/manual text, collapse, pan the
   completed board and use New Puzzle to reach settings.
6. `/wordstead/scripts/daily-qa.html` offers all six widths, injected UTC rollover,
   fixed Daily completion drafts and isolated `wordstead.qa.` storage. Exercise
   denied/quota/corrupt active saves, history-only failure/retry, corrupt history,
   clear confirmations and missing historical results. Keep History/results closed
   while verifying attention notices. Advance the date and verify explicit
   replacement, including cancellation. Test two tabs for conflicts and safe reload.
7. Inspect browser logs and static resource paths. On real phones, test touch
   scrolling/drag negotiation and actual on-screen keyboard behavior. Use assistive
   technology and other engines for checks that desktop emulation cannot establish.

## Validation performed for 5A

The automated suite passed **307 tests**. Changed JavaScript and the two QA pages'
inline modules passed syntax checks; `git diff --check` passed. The released Daily
v1 fixture and all core/daily/persistence/analysis/vocabulary code and schemas are
unchanged from the branch's `origin/main` base. No public art, external service or
runtime dependency was added.

Local Chromium inspection covered all six requested widths with fresh/active
puzzles and no document horizontal overflow. At 320px, the game rack's smallest
measured tile was about 55px. Production-rendered seven/eight/nine-slot samples
also fit all six widths. An actual livestock capture produced eight usable tiles.
Keyboard Daily NEW commitment, separate Free Play CAT with a reassigned blank,
exchanges, refresh/resume, native pointer dragging/movement/return and all four
farm captures were exercised. Crop/fertile results were 4/4 and 2/2 with four words;
a building exchange used its credit without charging a stroke. At 320px, collapsed
results stayed above the scroll pane while 72px cells remained inspectable.

The isolated 2024-02-29 fixed completion produced 13/11 with four words. History
quota failure stayed visible after collapsing results; reload and explicit save
recovered it. Its narrow calendar used 44px dates and internal scrolling, with no
document overflow. UTC rollover retained February 29 until canceled/confirmed
March 1 replacement. Denied saving allowed drafts; malformed saves/history
exposed explicit recovery. Two local tabs detected changed progress and required
explicit reload. These fixtures are regression observations, not human playtests.

Physical-device touch, real on-screen keyboards, screen-reader software, other
browser engines and independent OS clipboard contents were not tested. Copy's
browser success/manual-copy interface and automated exact-text/failure tests were
checked. Nine-tile browser inspection used the isolated layout samples; actual
nine-tile capture/rack invariants remain covered by Node tests.
