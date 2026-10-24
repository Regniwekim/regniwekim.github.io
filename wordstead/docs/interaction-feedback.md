# Interaction feedback — Milestone 5C

Important player actions get brief, quiet acknowledgment. Permanent state is
readable immediately; cosmetics never accept a move, award points, spend tiles,
advance RNG, delay controls or write a gameplay save. There is no idle animation,
music, ambient audio, particle system or animation framework.

## Events and authoritative boundaries

`ui/feedback.js` accepts one event or a coordinated batch through `emit()`.
`cancel()` clears transient overlays/animations and scheduled sounds. No effects
are triggered from `render()`, preview evaluation, storage replay or results rendering.

| Event | Source and supplied data | Treatment |
| --- | --- | --- |
| `tile-selected` | Tile input's explicit completed selection | Existing 2px rack lift, eased over 90ms; very soft pickup |
| `tile-placed`, `tile-moved` | Accepted `placeDraftTile` after draft publication and refresh; destination cell | Dashed settle rim, 130ms, 2px emphasis; muted wooden tap |
| `tile-returned` | Actual return, Undo or Clear; original physical slots | Rack settle, 130ms; soft return tap |
| `placement-rejected` | Explicit failed placement/drop, never drag hover | 180ms warning rim on placement text; no failure sound |
| `word-accepted` | Accepted commit; `evaluation.newPositions` only | Solid settle rim, 130ms; warm confirmation |
| `word-rejected` | Explicit rejected commit | 180ms warning rim and muted correction; draft/selection/blanks stay intact |
| `territory-captured` | Accepted commit's exact `newlyClaimed` indices | Three harvest-wash groups, starting at 100/125/150ms, each lasting 280ms |
| `feature-captured` | Accepted commit's exact `farmRewards.features` | Coordinated 220ms response starting at 170ms |
| `points-earned` | Positive authoritative commit award | 260ms honey inset on the already-updated score label, starting at 100ms |
| `tiles-exchanged` | Accepted exchange; replaced physical slots | Actual replacement letters settle for 130ms; one shuffle cue |
| `run-completed` | Accepted transition into `won` | Warm 320ms results rim from 180ms, plus brief completion cue |
| `run-ended` | Accepted explicit ending or exhausted commitment | Neutral 150ms results rim, without a defeat cue |

`commitmentFeedback()` maps returned deltas into this vocabulary; it does not
recalculate enclosures or inspect historical results. A commit batch selects one
audio cue with completion → features → territory → word priority. Three captured
features produce one bonus cue. Repeated input replaces active effects rather
than growing a queue. Same-cell drops, cancellation and ordinary redraws do not
replay a placement. Exchange text still distinguishes credits and charged strokes.

Commit is available for a nonempty editable draft, including invalid previews, so
a player can explicitly request validation and receive its reason. Empty/finished
runs and exchange mode disable it. Preview text remains current; the unchanged
atomic core revalidates every commitment. This does not permit invalid words.

## Board effects and farm rewards

An inert, `aria-hidden`, pointer-ignoring `#board-feedback` shares the exact
`.board-surface` coordinate origin with the Canvas and draft handles. SVG paths
use `cellToView()` and CSS coordinates; scroll/pan moves both surfaces together.
The existing renderer, artwork cache, high-DPI backing, hit testing, touch scroll
negotiation, direct drag ghost, glyphs, fence connections and badges are preserved.
Each SVG is bounded to its affected cells, so a one-tile highlight does not allocate
a board-sized element. Large grouped paths can span the captured region.

Captures emphasize final cultivated ground through a translucent harvest wash.
All and only new indices enter three paths; hundreds of cells still finish by
430ms. Crops receive a dotted honey shimmer, fertile ground a subtle soil glow,
buildings a warm rim, and livestock a cream outline plus a briefly raised hen.
At most 24 visible hens get small local DPR-aware Canvas copies, using the existing
original drawing functions and capture/type badges. Offscreen/additional animals
still receive the grouped outline. The original hen remains underneath; its local
copy is painted 2px higher and crossfades over 220ms. No animal runs continuously.

The combined effect finishes by 500ms. Results are revealed immediately by the
existing results view; Copy Results, History, inspection, collapse and restart
remain available throughout. The final score never counts through intermediate
values. Existing action text retains base points, crop/fertility bonuses, capacity
and building credits; no additional HUD counter or grading is added.

## Original procedural audio

`audio/sounds.js` synthesizes every new sound from original sine/triangle
oscillators and short gain envelopes. It imports no samples, private pack audio,
audio library or external media. Tile taps use soft descending triangle tones;
words use a warm two-note confirmation; harvest/bonuses use a short rising accent;
completion uses a four-note flourish ending within 490ms. Correction is quiet and
low. There are no long jingles, background music or continuous sounds.

A shared gain of 0.12 and note peaks of at most 0.18 keep output quiet. There are
at most four connected/scheduled voices; each new cue stops/disconnects old voices.
Handling taps are limited to one per 45ms. Combined transition batches choose
one cue, never one sound per captured cell/feature. Actual listening levels still
depend on the device and system volume.

**Sound: Off** is the first-visit default. The semantic toggle exposes
`aria-pressed` and supports pointer/keyboard activation. Its independent optional
key is `wordstead.preferences.sound.v1`, containing `{ version: 1, enabled }`.
Only this preference is saved; Daily/Free Play/history keys and schemas are unchanged.
Malformed/unknown preferences default off and storage exceptions are ignored.

The AudioContext is lazy. Only a trusted user event while enabled can initialize
or resume it. Restoring On does not autoplay or create a context. Suspended audio
skips cues rather than queuing stale sounds behind a resume promise. Unsupported,
denied or failed Web Audio remains silent without interrupting gameplay. Muting,
page hiding, context suspension and lifecycle cancellation stop scheduled voices.
There is no volume control in this compact first pass.

## Accessibility and cancellation

All essential information remains in existing text/live statuses, glyphs and
semantic controls. Decorative overlays have no pointer targets, focus, live region
or accessible content. Selection outlines/checkmarks stay visible. No effect moves
focus, scrolls the page, changes layout or delays a state transition.

`prefers-reduced-motion` disables nonessential rack movement/transitions and all
controller effects; final board/results/score are immediately visible. Runtime
media changes cancel active effects without touching the puzzle or audio preference.
Audio remains independently enabled or disabled. Missing Web Animations support
simply skips cosmetic effects. Active effects use native one-shot animations and
their settled promises for cleanup; there is no production rAF loop or timer.

Effects cancel on mode/lab changes, restart/new puzzle, newest Daily, saved-session
reload, window resize, cell-size change, pagehide/visibility hiding, and motion
preference changes. Canceled old promises cannot remove a newer effect. Panning
needs no cancellation because the overlay is inside the same scroll surface.
No animation callback drives gameplay, persistence or a later render.

## Measurements — October 24, 2026

Serve the repository and open `scripts/feedback-qa.html`. The synthetic 30×30
completed-farm fixture includes 784 captured cells and all four feature types.
Measure feedback warms up 10 times, then records 60 synchronous samples per case.
The sound remains off during measurements. A 650ms bounded observation then checks
settled idle state. The QA page writes no saves or preferences.

Local desktop Chromium measurements, in milliseconds (median / p95):

| Cells | Emulated DPR | Full redraw | Capture setup | Feature setup | Combined setup |
| --- | --- | --- | --- | --- | --- |
| 44px | 1 | 2.30 / 32.30 | 0.70 / 0.80 | 1.20 / 1.90 | 2.10 / 3.10 |
| 44px | 2 | 2.50 / 32.50 | 0.60 / 0.90 | 1.10 / 1.20 | 2.10 / 2.80 |
| 44px | 3 | 2.40 / 35.10 | 0.60 / 0.90 | 0.90 / 1.00 | 2.00 / 2.70 |
| 56px | 1 | 2.30 / 24.60 | 0.60 / 0.80 | 0.90 / 1.00 | 1.80 / 2.40 |
| 56px | 2 | 2.40 / 45.60 | 0.60 / 0.90 | 1.00 / 1.20 | 2.00 / 2.70 |
| 56px | 3 | 2.40 / 14.60 | 0.60 / 0.80 | 0.80 / 0.90 | 1.90 / 2.80 |
| 72px | 1 | 2.30 / 34.80 | 0.60 / 0.80 | 0.60 / 0.70 | 1.40 / 1.60 |
| 72px | 2 | 2.40 / 34.90 | 0.60 / 0.70 | 0.60 / 0.70 | 1.40 / 1.50 |
| 72px | 3 | 2.40 / 24.30 | 0.60 / 0.70 | 0.60 / 1.10 | 1.40 / 1.50 |

Selection dispatch rounded to 0.00ms; placement and ordinary word setup medians
were 0.00–0.10ms with p95 0.10–0.20ms at the browser clock's resolution. These exclude
the existing gameplay transition/preview/render and do not claim zero actual cost.
All feedback batches added **zero board redraws**. Peak overlay counts were 10–14
in the measured viewport, returning to **zero nodes and zero animations** while
idle. At 72px/DPR3 with injected reduced motion, effects created zero nodes and
all setup samples rounded to 0.00ms. Existing redraw p95 stalls remain; this
milestone avoids repeating them for animation rather than solving all redraw cost.

These are synchronous setup/Canvas command-submission measurements, including
cancellation and local motif copies. They exclude GPU completion, compositor
frame timing and physical phone behavior. SVG paths avoid duplicating a full
high-DPI board bitmap; their geometry scales with capture area. Only local hens
need extra backing stores, capped at 24. Native animation/compositing still has
a cost that these setup timings do not establish.

The same browser rendered the actual completion synthesis in OfflineAudioContext:
peak **0.022115**, one-second RMS **0.003921**, and exact silence after **550ms**.
This verifies headroom/envelope termination for the combined completion cue; it is
not a subjective listening review or a device-volume guarantee.

## Validation and reproducible QA

The Node suite covers actual input/controller events, rejection atomicity, exact
claims/rewards, completion once, silent render/restore/restart, bounded cleanup,
motion changes, inert overlays, default/muted audio, trusted activation, suspended
and unsupported contexts, storage failures and connected-voice limits. All older
Daily v1, blanks, scoring, sharing, persistence/history and fixture tests remain.
`npm test` passed **331 tests** (317 prior tests plus 14 focused feedback/audio
tests). All nine affected JavaScript files passed `node --check` and
`git diff --check` passed. Core, Daily fixtures, vocabulary, analysis, active-save
and history code/schemas have no diff from the latest-main branch base.

Desktop Chromium ordinary-interface checks exercised keyboard CAR/CAB/RAT/BAT,
ordinary enclosure victory, each farm type, immediate results, eight-slot livestock
growth and free then charged building exchanges (strokes 4 then 5). Six-width
controlled-game iframe checks at 320/360/390/768/1024/1440px showed no internal
document overflow; the smallest rack width was 49.95px and Sound remained 44px high.
Production-rendered 7/8/9-slot samples also fit all six widths (minimum 56.05px).
Native pointer dragging placed, moved and returned a tile to its physical slot.
Explicit invalid commitment preserved its draft and another selected tile; Move,
Return, Undo and Clear worked through keyboard/semantic controls. Neutral ending,
terminal refresh, Copy Results, collapse/reopen, History access, 56/72px cursor
scrolling, direct loading and the arcade return link were checked. Controlled
UTC rollover retained February 29 until explicitly starting March 1.
Injected runtime reduced-motion cancellation and the synthetic multiple-feature
harvest were checked. Inspected console logs contained no warnings/errors.

For further QA:

1. Serve the repository root; open `/wordstead/` directly and refresh. Verify the
   arcade return link and no audio/context creation on initial load or restored On.
2. Tap/select, keyboard-place, drag, move, return, Undo and Clear; explicitly commit
   an invalid draft. Check its text, assigned blanks and physical tiles survive.
   Invalid drag hover, keyboard movement and previews must stay quiet.
3. Use existing CAR/CAB/RAT/BAT and farm fixtures, then the fixed Daily completion
   in `scripts/daily-qa.html`. Inspect feature art, score, terminal results, Copy,
   History, collapse and completed-board scrolling at 44/56/72px.
4. Toggle sound, rapidly repeat actions, hide/return, change modes during effects,
   restart/new/load, resize and switch motion preference. No old sound/effect
   should leak into another session. Test unavailable Web Audio and blocked storage.
5. Use all six widths and `scripts/rack-layout-qa.html` for seven/eight/nine slots.
   Check actual touch scrolling/drag negotiation on phones, keyboard/focus, real
   reduced-motion settings, screen readers, clipboard permissions and other engines.

Physical touch, screen readers, Firefox/Safari Web Audio differences, real high-DPI
hardware, system reduced-motion switching and subjective listening were not tested
in this milestone's browser pass. Existing Node tests cover gesture transactions
and save/date/blank regressions; they cannot establish native touch negotiation.
Nine-slot rendering and those broader lifecycle paths remain available in the
existing QA tools. No private/vendor assets or third-party audio were introduced.
