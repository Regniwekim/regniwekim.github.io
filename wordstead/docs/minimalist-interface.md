# Minimalist interface — Milestone 6A

## Rationale and scope

The farm is the puzzle, and the rack is its input. The interface now gives those
two objects one centered column at every width. A compact nonsticky header and a
small score row replace the old navigation/progress dashboard. Original meadow
art, wooden tiles, system glyphs, warm surfaces and restrained effects retain
Wordstead's identity. No dark theme, new art dependency or framework is introduced.

All changes are inside Wordstead. Core rules, vocabulary, seed generation, target
calibration, released Daily v1 definitions/fixtures, results/share calculations,
active-save/history schemas and sound preference schema remain unchanged. There is
no extra persisted onboarding, UI state, service or runtime dependency. The existing
asset audits, organization records and license documents are unchanged; header
icons are locally authored inline SVG geometry, with no imported artwork.

## Information hierarchy

The ordinary fresh Daily screen contains:

1. Menu button, Wordstead title, History button and Help button.
2. Canonical UTC challenge date and farm points / resolved target.
3. The original internally scrollable Canvas farm.
4. The semantic physical letter rack directly below it.
5. Commit Word, Exchange and Undo.
6. One brief starting hint, plus a subordinate Board options button.

After input, contextual draft controls and a short preview/outcome appear as
needed. Recovery notices are additional only when there is a real problem. There
are no permanently visible settings, technical disclosures, sidebar, tagline,
rack heading, coordinate paragraph or save-success box surrounding play.

The pre-change screenshot showed separate mode/navigation controls, sound, a
progress/word-count panel, starting coordinates, size selector, rack instructions,
seven editing/exchange actions, selected-cell and action paragraphs, surrounding
utility disclosures and footer navigation. The new fresh view has fourteen visible
semantic controls including its seven tiles (three header, three primary actions,
one board-options button). The board itself remains a keyboard focus target.
This compares ordinary fresh play, not warning, selected-tile or terminal views.

## Header, menu and destinations

The header uses three named semantic icon buttons and a centered native heading.
It has a thin divider and stays in normal document flow. Buttons remain disabled
until vocabulary preparation and controller initialization finish successfully.
They have visible focus, 44px targets and dialog relationships. Large text can
wrap the title within its grid track without covering icons.

The main menu resumes Daily or Free Play through the existing controller. Pressed
state identifies the active production mode; neither button is pressed in a lab.
It contains restart, explicit end-run, the newer Daily action when available, Free
Play setup, sound, details, credits and Main Arcade navigation. Advanced is initially
collapsed and leads to the existing development controls, also initially collapsed.
All standalone QA pages are linked there. Successful mode/fixture navigation closes
the destination. Opening or closing a menu never generates a puzzle or saves UI state.

Help explains connected words, the starting square, fences/enclosure, captured
features and the target. Deeper disclosures retain blanks, return/movement, reuse,
exchanges, feature rewards, zoom/pan, keyboard/coordinate inspection, automatic
estimates, local saves and History. Help makes no solvability guarantee.

History reuses the existing calendar/controller/storage: UTC month navigation,
selected dates, completions and unfinished results, personal totals/averages,
reloading, conflict handling and confirmed clearing. Opening and browsing it never
change the active farm. It is a focused dialog rather than a collapsed page panel.

Game details contains accepted word count, all score and supply values, seeds,
board dimensions, latest detailed action, formed words, draft geometry, allocations,
reused/missing letters and vocabulary descriptions. About retains the tagline,
identity, original artwork/audio description and accessible word-list credit,
license and acceptance-policy link.

## Board, rack and contextual actions

The page is capped at 46rem, with a 36rem rack/action region. The actual DOM order
is board then rack and actions, without a desktop alternate column. Phones use the
available width with a small margin. The native board viewport is bounded at
58svh / 42rem; users scroll it internally and scroll the page normally to actions.
Short screens are allowed to scroll. Nothing is pinned over the farm or rack.

Board options reuses the 44/56/72px selector. Cell geometry, coordinate gutter,
Canvas backing scale, hit testing, cursor reveal, pointer capture/drop transactions,
logical selection and feedback origins are untouched. Coordinates and the exact
starting-square explanation move to Help. The marker stays visible on the board.

Rack containers below 28rem wrap deliberately at four columns; wider containers
use one row sized to actual capacity. Seven, eight and nine slots retain physical
IDs, blank assignments, selected/drafted/empty states and accessible labels.
Minimum button height is 56px; no tile shrinks below 44px. The shallow wooden tray
is simplified without changing faces or input ownership.

Commit is the primary action; Exchange and Undo are secondary. Clear appears for
a draft, Cancel for selection, Return for a selected drafted tile, and Change blank
for a selected blank. Native hidden state removes inactive controls from keyboard
order. Disabled rules still come from existing gameplay state. Exchange replaces
the normal strip with Confirm/Cancel and the existing explicit credit/stroke cost.
Hover redraws never rebuild/rearrange controls during a pointer gesture.

Previews retain complete words, prospective points and dictionary rejection
reasons. A short acceptance line reports the words and points. Exchange reports
returned/drawn letters and cost. Detailed physical/coordinate/reward text stays
in existing live regions and the details destination. Routine successful saves,
initialization, selection and navigation have no visible status block.

## Setup, results and recovery

Selecting Free Play resumes its existing session, including its draft. New Free
Play puzzle / settings is a separate action. Opening setup, inspecting fields or
calculating a target does not replace progress. The original form preserves both
seeds, density, dimensions, automatic estimate/unavailable states, manual targets
and validation. Meaningful replacement still requires the original confirmation.
Cancel returns to the edited form and existing draft; successful creation closes
setup. Lab board settings use the same form when a lab is active.

Terminal results retain the native collapsible window over the final board.
Challenge identity, score/target, words and Copy lead; history and farm/exchange
breakdowns are secondary. Manual copy is still available, and clipboard failure
opens its exact existing share text. Collapsing results keeps its summary anchored
over the board, without shifting the board or rack. Unfinished/exhausted
results remain neutral, without judgments or new end conditions.

Normal save success is absent from play. Unavailable, invalid and multi-tab-conflict
save states retain visible recovery controls outside every dialog. History failures
and terminal results requiring explicit archival also retain an external notice.
Collapsing Results or closing History cannot conceal these warnings. Failed
vocabulary loading retains the startup alert and Retry, with inert gameplay.
No duplicate storage state is introduced, and failures cannot report successful saving.

## Focus and accessibility decisions

`src/ui/interface.js` owns one native destination at a time. Native dialogs provide
background inertness, keyboard traversal and Escape. Every dialog initially focuses
its labeled Close control. Closing returns focus to its opener. A destination
opened from the menu inherits the visible menu opener, avoiding focus return into
a closed menu. Opening another destination closes the previous one first.

Destructive confirmation suspends its source dialog before showing the existing
confirmation. Cancel/Escape reopens the source and focuses its original action.
Successful puzzle replacement returns to the board; History clearing returns to
History. Recovery actions that disappear after success transfer focus to the board,
results window or History Close control. Queued native close events cannot close
a destination that has already reopened during a transition.

Coordinate submission closes Help and focuses the selected Canvas cell without
placing a tile. Closing a destination with Escape does not cancel tile selection.
Commit, last Undo, Clear, End and exchanges preserve the release focus behavior.
Contextual Cancel now returns to the board; return restores the original rack slot,
including a focused draft handle dragged back to that slot. Passive rendering,
restoration, resize and warning changes never initiate focus/scroll navigation.

Canvas/rack names, ID-referenced descriptions, detailed live statuses, color-
independent symbols, visible focus, skip navigation, 44px targets, muted default
and reduced motion remain. Audio uses the original independent version-1 key and
trusted activation; no context is created merely by opening the menu. Effects use
the same inert board surface and cancel through the existing lifecycle.

## Validation performed

Local desktop Chromium observations on October 26, 2026 used HTTP preview and the
existing isolated Daily QA page. These are scripted checks, not human playtesting.

| Area | Executed result |
| --- | --- |
| Fresh Daily, direct loading and refresh | Canonical date, target and physical rack loaded; draft/blank and accepted-word restoration retained their identities. |
| Responsive play | 320/360/390/768/1024/1440px: no document overflow; board centered; rack below it; header fit; internal board scrolling at narrow widths. Client/scroll pairs were 305/305, 345/345, 375/375, 753/753, 1009/1009 and 1425/1425 with desktop scrollbars. |
| Rack capacities | Original production-rendered 7/8/9-slot samples fit all six widths. Minimum measured tile width across samples was 53.875px; height 56px. Actual livestock play produced eight slots. |
| Short screens | 390×520 and 768×390 allowed normal scrolling to rack/actions; landscape board viewport measured 224px high. No sticky layer obscured play. |
| Large text | Injected 200% root text at 320px retained document 305/305 and History dialog 256/256 internal widths. Header title wraps within its track. This is not native browser zoom. |
| Menu/destinations | Mouse/keyboard opening, Close/Escape, header Help/History and menu→details/About/development/setup transitions and return focus were checked. Tab traversed visible menu controls; native browser focus boundary was observed without focusing hidden gameplay controls. |
| Confirmations | Restart cancellation returned focus to Restart inside the reopened menu. Free Play replacement cancellation kept edited setup; acceptance closed setup. History clear cancellation returned to History. |
| Tile input | Keyboard selection/coordinates/placement, invalid first word, Clear, blank 98 O→A reassignment, refresh, CAT commitment and exchanges passed. Native mouse drag placed/moved/returned physical tile 11. |
| Farm rewards | CAR/CAB/RAT/BAT: crop 4/4, fertile 2/2, livestock capacity eight, building credit. Building exchanges retained strokes four for the free exchange, then five for the charged exchange. |
| Daily terminal/history | Fixed February 29, 2024 completion: 13/11, four words, 28 strokes. History-only quota failure stayed visible with Results collapsed; normal storage plus explicit save recovered one completion. Calendar month navigation and clear cancellation worked. |
| UTC rollover | Advancing the QA clock retained February 29, labeled previous challenge. Menu offered March 1; canceled replacement kept the completed run. |
| Setup / terminal Free Play | 1×1 automatic estimate unavailable without replacement. A reviewed 30×30 automatic puzzle resolved target 11, required replacement confirmation, and ended neutrally at 0/11. Copy reported success. |
| Saving/recovery | Corrupt active save remained after canceled discard, then recovered on explicit confirmation. Corrupt History warning/recovery and denied storage were exercised. Node tests also cover multi-tab conflict/reload/replacement. |
| Vocabulary / optional APIs | Injected first-request 404 showed alert and Retry with inert play/disabled header; retry succeeded. Completion with missing animation/audio/clipboard APIs worked; manual-copy fallback opened without false success. |
| Sound / reduced motion | Menu sound On/Off worked; preference restoration/schema are tested. Existing feedback QA with injected reduced motion created zero overlay nodes. No subjective listening or OS setting test is claimed. |
| Diagnostics / navigation | Both labs, all farm/rack fixture controls and standalone QA pages remain accessible. Word lab CAR and freeform toggle/inspect/claim worked. Return to Main Arcade and its Wordstead link were checked. Ordinary inspected game console logs had no warnings/errors. |

Automated validation: `npm.cmd test` passed **346/346** tests, with no failures,
skips or cancellations (336 release cases plus ten destination/context/focus/audio
regressions). Existing renderer, physical input, results/share, vocabulary, save,
history and Daily fixture expectations still pass. Affected JavaScript syntax,
entry markup/IDs/references, exact-case static paths and `git diff --check` were
checked. The released Daily fixture and core/Daily/persistence/audio/analysis/
vocabulary sources have no changes from the latest-main base. The explicit Daily,
save/history, sound and results compatibility run passed **63/63** tests; the Daily
fixture blob remains `e11660cf0203bcf7038d656713990dc48055a6cb`. Eight changed JS
files and the rack QA inline module passed syntax checks. No fixture was
regenerated and no new runtime dependency or storage key was added.

## Reproduction and known limitations

Results-collapse follow-up: removed the collapsed state's normal-flow override.
Browser measurements at 320, 768 and 1440px confirmed zero board/rack displacement
on collapse, with the summary anchored 12px inside the board. Pointer and keyboard
collapse/reopen, View Results and 72px cells were checked; share text stayed
unchanged and no page overflow appeared. The full 346-test suite and
`git diff --check` passed again.

Serve the repository root over HTTP; open `/wordstead/` directly. Menu → Advanced
links the existing `daily-qa.html`, `rack-layout-qa.html`, `board-art-qa.html`,
`feedback-qa.html` and target benchmark. Daily QA uses its existing isolated
`wordstead.qa.` save/history prefix; production paths import none of its injections.
Use a fresh local origin or hard reload to avoid stale native-module/CSS caches.

Physical phones, touch scroll negotiation, real on-screen keyboards, native browser
zoom, screen-reader software, Firefox/Safari/WebKit and physical high-DPI memory
behavior were not tested. Keyboard checks used native control activation and locator
focus plus a menu Tab traversal, not an independent human keyboard usability study.
Nine-slot browser checks used the synthetic layout samples; actual nine-slot reward
and conservation remain model tests. OS clipboard contents were not independently
verified. Audio/reduced-motion observations were controlled fallback/presentation
checks, not listening or physical accessibility sign-off.

Existing limits remain: no drag edge auto-scroll, no complete legal-move solver,
experimental targets, localStorage's conservative but non-atomic conflict handling,
local-only saves/history and substantial backing memory for large high-DPI boards.
The PR is for review and is not merged or deployed by this milestone.
