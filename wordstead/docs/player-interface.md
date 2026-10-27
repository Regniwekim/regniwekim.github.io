# Player interface — Milestone 6A

Wordstead presents a centered daily puzzle, using the same dependency-free
controllers, original farm art, wooden tiles and procedural sounds from 5B–5D.
The complete rationale, information map and current validation are in
[minimalist interface](minimalist-interface.md). Historical art/sound/release
records describe their original milestones and are not current layout guides.

## Ordinary play

The compact, nonsticky header contains Menu, Wordstead, Daily History and Help.
The canonical challenge date and score/target sit just above the board. An older
Daily explicitly says “previous challenge”; the menu describes the newer UTC date
and offers the existing confirmed replacement. No automatic rollover replaces play.

The board, rack, action strip and brief feedback form one column, including desktop.
The page is capped at 46rem; the rack/actions at 36rem. Cells remain 44/56/72 CSS
pixels, with native internal board scrolling and unchanged high-DPI rendering,
coordinate transforms, selection reveal, hit testing, draft handles and effects.
Board options opens the original size selector. No toolbar overlays play.

The semantic rack group retains physical IDs, capacity-aware labels, wooden tiles,
selected checkmarks, drafted return indicators, blank assignments and empty slots.
It wraps at four slots below 28rem of container width and uses one capacity-aware
row above that threshold. Seven, eight and nine slots remain supported. Targets
remain at least 44 CSS pixels; tiles are at least 56px tall.

Commit Word leads the compact action strip, followed by Exchange and Undo.
Clear appears for a draft, Cancel for selection, Return for a selected draft tile,
and Change blank for a selected blank. Existing disabled rules remain authoritative.
Exchange temporarily replaces primary actions with Confirm/Cancel and its explicit
credit/stroke cost. The hover/drag redraw path does not rearrange controls.

A fresh farm gets one short starting hint. Valid/invalid previews retain words,
prospective awards and exact rejection reasons. Acceptance and exchanges show a
short outcome; detailed physical IDs, geometry, resources and capture rewards
remain available in live descriptions and Game details. Routine selection, mode
navigation, successful saving and dictionary initialization do not add visible boxes.

## Secondary destinations

| Entry | Destination |
| --- | --- |
| Menu → Daily Puzzle / Free Play | Resume the existing independent session/draft; close menu |
| Menu → Restart / End current run | Existing restart confirmation and explicit end semantics |
| Menu → Start today's challenge | Only for a newer UTC date; existing replacement confirmation |
| Menu → New Free Play puzzle / settings | Original dimension/seed/density/automatic/manual target form |
| Menu → Sound | Existing independent optional preference, default muted |
| Menu → Farm points & game details | Word count, score/supplies, seeds, selected placement diagnostics |
| Menu → About & credits | Tagline, identity, original art/audio and ESDB policy/license link |
| Menu → Advanced → Development Tools | Initially collapsed labs, all scripted fixtures and standalone QA links |
| Header History / results / recovery | Same monthly calendar, statistics, selected dates and storage recovery |
| Header Help | Concise loop; deeper tile/exchange/save help, board key and coordinate inspection |
| Board options | Original 44/56/72 selector |

Free Play mode navigation never creates another puzzle. Opening/closing setup
never replaces its session. Unreviewed automatic settings first show the estimate;
unavailable estimates and canceled replacement preserve the run. Lab settings use
this same form when a lab is active. Credits and the return to Main Arcade are in
the menu, with no permanent legal/navigation panel surrounding play.

## Focus, dialogs and warnings

Native `dialog.showModal()` contains focus and makes the background inert. Every
destination has a labeled Close button with initial focus and supports Escape.
The interface controller opens one destination at a time. Menu-launched destinations
inherit the visible menu opener; close returns there. A destructive confirmation
suspends the originating dialog. Cancel/Escape reopens it with its action focused;
accepted puzzle replacement focuses the board. History clearing returns to History.
Coordinate submission closes Help and focuses the selected board square without
placing a tile. Escape from a destination does not cancel a pending tile selection.

Commit, last Undo, Clear and End retain the 5D focus transfers. Cancel Selection
now focuses the board when its contextual button disappears; return focuses the
physical rack slot. Successful save/history recovery moves focus to a visible board,
results window or History Close control when the recovery action disappears.
Passive render/restore/resizing and warning changes do not take focus.

Save unavailable/invalid/conflict messages and controls stay in the ordinary view.
History storage problems and terminal results needing explicit archiving also have
an external notice; closing History or collapsing Results cannot hide it. No second
storage model is introduced. Failed vocabulary loading remains an actionable startup
alert and Retry; the entire game stays inert and header buttons stay disabled.

Terminal results keep their native collapsible window, authoritative values/share
text and manual clipboard fallback. Points, words and Copy lead; History and score/
capture details are subordinate. Collapsing keeps the summary over the board at
the same position without shifting the board or rack. No result grades or extra judgments are added.

Semantic controls, visible focus, live regions, the skip link, color-independent
symbols, reduced motion and silent play remain. Closed dialogs remove their controls
from keyboard order; accessibility descriptions for the Canvas and rack remain
explicit ID references. Nonvisual announcement quality still needs real AT review.

## Validation

See [current 6A QA](minimalist-interface.md#validation-performed) for executed tests,
viewport measurements, browser scenarios and known gaps. Run `npm test`, affected
`node --check` commands and `git diff --check` from Wordstead. The test suite checks
markup/IDs/labels, destinations, contextual actions, focus restoration, independent
sessions, save/history/audio compatibility and all previous gameplay contracts.
Serve the repository root over HTTP and open `/wordstead/` directly. Standalone
QA pages remain available through Advanced, with isolated Daily QA storage.

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
