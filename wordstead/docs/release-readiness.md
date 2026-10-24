# Release readiness — Milestone 5D

Assessment date: October 24, 2026. Base: `main` at `756e00d`.
This is a release-candidate assessment, not accessibility certification or a
claim of universal browser support. Historical milestone reports remain intact.

## Scope and recommendation

**Conditional GO for the release candidate.** No reproduced release-blocking
software defect remains in the tested Chromium environment. Final mobile and
cross-browser sign-off is **incomplete**: physical Android/iPhone touch, Firefox,
Safari/WebKit and actual screen-reader operation still require the checks below.
Do not describe those environments as validated. If they reveal an essential
input, data-loss, Canvas failure or inaccessible gameplay issue, hold release.

The candidate includes the existing complete Daily/Free Play loop: deterministic
farms and physical letters, reversible drafts/blanks, connected-word validation,
enclosures/rewards, fixed targets, exchanges, terminal results, spoiler-free
sharing, independent local saves and personal Daily history. It adds release
presentation and narrowly scoped reliability fixes, without new gameplay systems.

The PR must remain unmerged pending owner review. No Pages, DNS, CNAME, robots,
deployment workflow, branch protection or hosting change is part of this work.

## Audit findings and disposition

The initial source/player audit covered loading, ordinary Daily NEW placement and
resume, the CAR/CAB/RAT/BAT enclosure, invalid-draft repair, results/copy, controls,
renderer, input, audio, save/history adapters and existing QA tools. Baseline:
331 passing Node tests on the latest-main source.

| Finding | Classification | Evidence and disposition |
| --- | --- | --- |
| Wordstead absent from the arcade listing | Release blocker for arcade discovery | Only Target Tap and an offline placeholder were listed. Replaced the placeholder with a working, accessible Wordstead card; count is two. Both navigation directions passed. |
| Explicit commitment disables its focused button and drops keyboard focus to the page body | Important improvement | Reproduced after CAR. Focus now returns to the board after explicit acceptance, Clear, last Undo and End Run. Exchange start/cancel/confirmation focus the relevant rack/action. Invalid commits retain focus and drafts. Passive render/restore never takes focus. |
| Every drag sample reevaluates/redraws even inside one destination cell | Important improvement | Source/event-surface reproduction; large-board redraw stalls measured below. Ghost movement remains continuous; only cell changes repeat structural evaluation/redraw. Release revalidates independently. A 101-sample same-cell regression now draws once. |
| 200% text overflows the 320px toolbar and open History month header; blank choices scroll sideways | Important accessibility improvement | Before fixes: document 317px versus 305px client width (355px with History open); blank dialog 303px scroll versus 216px client width. Toolbar wraps, month controls use a bounded grid, and rack/blank grids reflow while keeping 44px minima. After: document 305/305, dialog 216/216; rack minimum 63.1px and blank minimum 69.6px in the large-text sample. |
| Empty favicon and development footer | Important improvement | Replaced `data:,` with original SVG W tile, added theme/Open Graph metadata, removed “In development,” clarified Daily/Free Play and automatic-target caveats. |
| Occasional 30×30 redraw stalls and large high-DPI backing store | Deferred performance work / device sign-off item | No default-Daily failure reproduced. Targeted redundant-drag fix only; no renderer rewrite or reduced resolution. Maximum-size physical-device memory reliability is unverified. |
| Physical touch, assistive technology and other engines | Verification gaps | Not evidence of a defect or a pass. Require manual sign-off below. |

## Browser assumptions and actual environments

Runtime assumptions: current browsers providing native ES modules, Fetch with
integrity checking, Canvas 2D, Pointer Events, `inert`, native `dialog` and `details`,
and modern CSS grid/flex sizing. These essential APIs have no legacy-browser
polyfill. Web Animations and Web Audio are optional; clipboard and storage can
fail with recovery/fallback. OffscreenCanvas motifs already have primitive fallbacks.

| Environment | Actual coverage |
| --- | --- |
| Windows desktop, Codex in-app Chromium, local Python HTTP server at `127.0.0.1:8015` | Gameplay, keyboard, native mouse drag, loading/failure injection, responsive emulation, storage, navigation and main-thread measurements. Engine version was not recorded. Development model checks used Node v24.14.1. |
| Desktop Firefox | Installed application was discovered, but native automation app access timed out awaiting permission. No Firefox gameplay or performance pass is claimed. |
| Safari/WebKit | No controllable environment was available; not tested. |
| Physical Android Chrome / iPhone or iPad Safari | No physical device was controlled; not tested. Desktop viewport and DPR overrides are simulations. |
| Screen reader / OS reduced-motion settings / subjective audio listening | Not exercised. Accessibility-tree/source inspection, injected reduced motion and synthesized-audio measurements provide narrower evidence. |

## Accessibility review

Review priorities follow WCAG 2.2 AA functional areas: keyboard operation
(2.1.1/2.1.2), logical focus/visibility (2.4.3/2.4.7/2.4.11), reflow/text sizing
(1.4.4/1.4.10), color-independent information (1.4.1), contrast (1.4.3), target
size (2.5.8), names/roles and status information (4.1.2/4.1.3).

Keyboard browser checks used semantic control activation, board arrows/Enter,
coordinate selection, blank A–Z dialog/cancellation/reassignment, commit/rejection,
Clear, exchanges, replacement confirmation/cancellation, results, manual sharing,
History and navigation. Direct locator focus was used for some controls; this is
not an uninterrupted human Tab-only or screen-reader usability session. Node
controller tests additionally pin focus transfers, saved-session recovery and
passive-render focus preservation. No essential action requires dragging.

The Canvas remains a named group with an updated selected-cell description.
Semantic row/column fields can inspect every cell. Text reports rack/draft physical
IDs, blank assignments, committed letters, feature type/effect/capture state,
legality, formed words, awarded points, captures and terminal status. Selected
rack controls expose pressed state; live status text accompanies actions.
This strategy was inspected through the accessibility tree; its announcement
ordering and practical nonvisual board exploration still need real AT testing.

Selection uses outlines/checkmarks; draft/reuse/conflict/blank/claim states have
`p`, `=`, `×`, `◇`, `?`, `+` and `✓`, with text explanations. Calendar completions
and unfinished results have symbols and different borders. Feature type labels
remain above the art. Focus outlines and dialogs were visually inspected.
Sample palette calculations: dark ink on cream/oat/meadow is approximately
7.62/6.64/5.60:1; primary light-on-fern text is 6.38:1. This samples key
pairs rather than certifying every antialiased glyph or platform rendering.

Large-text testing doubles the root font through the isolated QA checkbox; it
is not native browser zoom or an on-screen keyboard test. The fixed rack/blank
column minima were made responsive after actual overflow was found. Board and
calendar retain intentional internal two-dimensional scrolling and 44px targets.
Native browser zoom, color-vision simulation and a human focus-order review remain
manual checks.

Reduced-motion injection creates no feedback overlays; final state remains
immediate. Sound initially defaults off and can be toggled by keyboard. Restored
On remains the existing independent preference, without autoplay. A fixed Daily
completion succeeded with animation/audio/clipboard APIs removed in the QA iframe;
copy opened the manual fallback. No effect intercepts pointer input or takes focus.

## Mobile and responsive observations

Normal-size real-controller iframe checks passed at requested CSS viewport widths
320, 360, 390, 768, 1024 and 1440. Help, History and coordinate panels were opened.
On this desktop scrollbar configuration, document client/scroll widths matched
at 305, 345, 375, 753, 1009 and 1425 respectively. The ordinary 320px rack's smallest
tile was 49.95px. Seven/eight/nine-slot production-rendered samples also fit all
six widths (minimum 56.05px before the large-text-only wrapping adjustment).
An actual scripted livestock capture produced eight usable slots; nine-slot
capture/conservation remains covered by model tests and presentation samples.

390×520 portrait and 768×390 landscape desktop overrides allowed rack selection,
placement and Clear through normal page scrolling, with no page overflow or
sticky control covering play. Cells stay 44/56/72px and pan inside their viewport.
Native mouse dragging placed, moved and returned physical tile 38 to its original
slot. Touch cancellation/lost capture/scroll-threshold transactions are covered by
the existing event tests; they are not proof of native smartphone gesture behavior.
Physical edge gestures, partially visible touch targets, OS keyboard changes and
touch scrolling while selected remain required manual checks.

## Loading, network, caching and recovery

The unchanged pinned dictionary is 750,727 bytes with 78,626 words. Successful
preparation is memoized for the page lifetime. The initial game stays inert/busy
with zero rack buttons until dictionary validation and UI initialization succeed.
Slow QA loading recorded that initial gate, then enabled exactly one initialized
game. One normal local sample measured 52ms from startup invocation through ready,
39ms vocabulary load and 29ms parser/Set preparation. A three-second injected delay
measured 3060.8ms total / 3048.3ms vocabulary / 39.3ms preparation. These omit initial
HTML/module fetching and are desktop/local samples, not internet load guarantees.

The QA page's first-request real 404 and aborted fetch left gameplay inert, showed
a useful message and offered Retry. Retry loaded the same pinned vocabulary and
enabled play. Unit tests additionally cover malformed/truncated/body failures and
initialization errors without a second handler set. The injected delay and abort
are controlled failure simulations, not a throttled physical network test.

After all resources load, play/word checks need no further service. Refresh or
reopen requires the HTML, modules, CSS, favicon and vocabulary to be available.
Ordinary HTTP/browser caching may help but provides no offline guarantee. There is
no service worker, PWA installation, background sync, notification or analytics.
Mixed/stale cached modules are possible during updates; use an actual hard reload
when validating deployment. Daily/save identities are not cache-busting controls.
The QA iframe gives its stylesheet a temporary query to reliably inspect saved
CSS edits; ordinary runtime paths and cache behavior are unchanged. Offline/PWA
support needs a separate engine/dictionary update-compatibility design.

## Performance and resource observations

Existing `scripts/feedback-qa.html` warms each case ten times and takes sixty
synchronous samples, then checks cleanup after 650ms. The fixture is a synthetic
30×30 completed farm with 784 claims, all four feature types and letter joins.
5D also measures the actual released 2026-10-24 Daily opening on a detached Canvas,
then releases that temporary backing store. This measures main-thread Canvas command
submission/setup, excluding GPU completion, compositing and physical frame timings.

Initial nine-case 30×30 sweep, sound off (median / p95 ms):

| Cell size | DPR 1 | Emulated DPR 2 | Emulated DPR 3 |
| --- | --- | --- | --- |
| 44 | 2.3 / 7.0 | 2.5 / 32.3 | 2.4 / 34.2 |
| 56 | 2.3 / 34.0 | 2.4 / 27.5 | 2.4 / 24.7 |
| 72 | 2.3 / 33.1 | 2.4 / 32.9 | 2.4 / 32.9 |

Final representative measurements after adding the Daily/memory probe:

| Size / DPR | Daily redraw | 30×30 redraw | Combined harvest setup | Daily / 30×30 RGBA bytes |
| --- | --- | --- | --- | --- |
| 44 / 1 | 0.2 / 0.5ms | 2.3 / 33.2ms | 1.7 / 2.3ms | 1,893,376 / 7,268,416 |
| 56 / 2 | 0.2 / 0.5ms | 2.5 / 32.0ms | 1.4 / 3.1ms | 12,054,784 / 46,676,224 |
| 72 / 3 | 0.2 / 0.5ms | 2.4 / 33.4ms | 1.0 / 1.6ms | 44,195,904 / 172,344,384 |

These byte counts are width × height × 4 for one bitmap, not measured browser heap
or total GPU memory. The maximum 30×30 example is about 164.4MiB before browser
overhead. No resolution is reduced to disguise this cost. Physical-device memory
limits and restart/mode-switch heap retention have not been profiled.

Overlays added zero board redraws, peaked at 10–14 nodes, and returned to zero nodes
and animations. Repeated same-cell pointer samples now avoid redundant board work;
continuous cross-cell drag/frame latency still needs device profiling. Audio-On
72/DPR3 measured 2.5/29.0ms redraw, 0.2/0.7ms Daily and 1.1/1.3ms combined setup.
With reduced motion and audio still On, there were zero overlay nodes; combined
setup was 0.1/0.2ms. The offline completion synthesis peaked at 0.022115, RMS
0.003921, with exact silence after 550ms. This verifies envelope termination,
not perceived volume or subjective listening quality. Node tests bound four voices.

No production idle render loop was introduced. Cleanup observations and source
inspection do not establish measured idle CPU usage, memory-leak freedom or 60 FPS.
Node vocabulary benchmark: 38.2ms preparation, 100,000 lookups in 10.7ms on this host.

## Saves, results and compatibility

The released seven-date fixture file, core, Daily generation, vocabulary, target
coefficients and both persistence implementations have no source diff from the
base. Daily v1 seeds/settings, bag distribution, farms, scores, targets, UTC date
policy, retries, share formatter, schema versions, keys and audio preference
behavior are unchanged. Fixtures were not regenerated.

Browser observations included independent Daily/Free Play resumes; Daily NEW;
7×7 Free Play seed `blank-qa-636`, density 0, manual target 37; blank 98 assigned O,
refresh, reassigned A, committed CAT while preserving the ordinary A, charged
exchange and refresh. Crop/fertile fixtures finished 4/4 and 2/2 in four words;
livestock yielded capacity eight; building exchanges had strokes four then five.

Fixed real-Daily QA completions produced February 29, 2024 at 13/11, four words,
28 strokes and October 23, 2026 at 15/12, four words, 37 strokes. History recovery
retained both: eight words and 65 strokes. These fixtures are scripted legal
observations, not human playtests or difficulty evidence. Copy used the existing
formatter; optional-clipboard failure opened manual text with no false success.
OS clipboard contents were not independently verified.

Denied/quota active storage allowed draft play with warnings. History-only denied
access left active saving usable. A new completion under history quota failed
visibly and succeeded after normal access/reload and explicit Save to Daily History.
Corrupt active data remained after canceled discard and recovered only after
confirmation. Two actual browser tabs detected changed Daily progress, preserved
the conflict on canceled reload and restored only after confirmed reload.
The injected midnight kept February 29 until canceled/confirmed March 1 replacement.

Saves/history remain browser-profile/origin/device local, without backup/sync.
Clearing site data, eviction or private-session closure may remove them. Failed
writes may leave an older saved version; warnings must be heeded. LocalStorage
comparison is conservative conflict detection with an unavoidable read/write race,
not atomic multi-tab synchronization. Use one active tab. Existing regression tests
cover replay, all rewards, terminal locks, history retry retention/clear recovery,
corrupt history and conflict safety beyond the individual browser observations.

## Static resources, metadata and provenance

Production references/imports are relative and checked for exact filename case,
including the Wordstead and arcade entry pages. No runtime imports a QA script,
private local path, machine-local binding, service worker or Node dependency.
Gameplay requests remain ordinary same-origin static resources. Expected 404/abort
QA failures are deliberate; ordinary inspected game logs had no warnings/errors.

The new favicon and arcade-card SVGs are locally authored geometry with no source
sprites, samples, embedded fonts or remote references. Existing Canvas/CSS art and
procedural oscillator audio remain original. System fonts supply game text.
The root arcade's existing local font files and their licenses are unchanged.
No private Sprout Lands original/export/preview was accessed or copied. UI Basic
public redistribution remains unresolved and excluded. Historical asset records
and vendor notices remain unchanged; this report grants no third-party rights.

The ESDB list retains its pinned hash, embedded notice, complete upstream notice
and accessible vocabulary credits/license/acceptance-policy link. Tests verified
the existing artifact and derived profile/coefficient checks. A full upstream
vocabulary rebuild was not performed because the vocabulary is unchanged.

Metadata retains the existing descriptive title, adds fern theme color and factual
Open Graph title/description/type/canonical public URL, and preserves `noindex,
nofollow` and root crawler restrictions. No social raster image is claimed; a
dedicated share-preview image remains optional future polish. Root changes are
limited to its Wordstead card/count and necessary README description/HTTP guidance.
Shared arcade CSS and Target Tap source are unchanged.

## Reproducible QA matrix

Serve the repository root with `python -m http.server 8000 --bind 127.0.0.1`.
Use a disposable origin/profile for ordinary save tests; `daily-qa.html` uses only
its existing `wordstead.qa.` game/history keys. Its sound preference remains the
existing optional same-origin sound preference. Do not run corrupt/clear tests
against personal production data.

Status abbreviations: **Pass C** = observed in desktop Chromium; **Pass N** = Node
tests/source/static checks; **NT** = not tested here. Expected and actual are kept
separate; simulation is explicitly labeled.

| Area / environment | Reproduction and expected result | Actual result / status |
| --- | --- | --- |
| Daily startup / C | Open `/wordstead/` directly; ready farm, no partial input; refresh | Daily ready and saved word resumed. **Pass C** |
| Slow vocabulary / C, injected | Daily QA → Slow (3 seconds) → Load; inert/busy, no rack before ready | Gate true/true/zero; ready after 3060.8ms. **Pass C** |
| Failed vocabulary / C, injected | First request 404 and interrupted; Retry; no partial game | Visible error, inert retained, successful retry. **Pass C** |
| Missing optional APIs / C, injected | Check optional-API disable; prepare Feb 29 completion; commit/copy | 13/11; manual-copy fallback; board remains usable. **Pass C** |
| Responsive / C emulation | Six listed widths; open Help/History/coordinates; page fits | Matching client/scroll widths; ≥49.95px game rack. **Pass C** |
| Short portrait/landscape / C emulation | 390×520 and 768×390; scroll to rack, place/clear | Controls reachable; page width fits. **Pass C** |
| 200% text / C, injected | Daily QA large-text checkbox, width 320; History and blank dialog | Fixed overflow; document 305/305, dialog 216/216. **Pass C** |
| Native browser high zoom | OS/browser zoom to 200–400%; inspect dialogs, controls and scrolling | No native browser zoom pass. **NT** |
| Keyboard / C + N | Select rack; arrows/coordinates + Enter; commit, edit, blank, exchange, confirmation | NEW/CAT and fixtures accepted; focus corrections passed; no drag needed. **Pass C/N**, human Tab-order/AT sign-off pending |
| Invalid draft / C + N | Submit unknown/misaligned draft, then repair | Rejection retained tiles; repaired enclosure completed. **Pass C/N** |
| Mouse drag / C | Rack → board → another cell → original slot | Same tile 38 placed/moved/returned. **Pass C** |
| Cancellation / N | Existing pointercancel, lost capture, outside drop, blur and movement-threshold tests | Transactional input tests pass. **Pass N**; physical touch **NT** |
| Captures / C + N | README CAR/CAB/RAT/BAT for all feature types | Crop 4/4; fertile 2/2; livestock eight; free/charged strokes 4/5. **Pass C/N** |
| Rack 7/8/9 / C emulation + N | `/scripts/rack-layout-qa.html`, six widths | All samples fit; nine-slot reward invariants in model tests. **Pass C/N** |
| Free Play / C + N | 7×7 custom seed/density/manual target; blank, word, exchange, refresh; create 30×30 automatic puzzle | CAT, target 37 and exchange resumed. Maximum board created at 72px/target 10, saved, ended and restored. Restart pinned by tests. **Pass C/N** |
| Terminal results / C + N | Finish crop/fertile and dated fixtures; inspect/collapse/copy | Scores, words and captures agree; manual fallback tested. **Pass C/N** |
| Ending / C + N | End unfinished run; refresh, results and terminal locks | 30×30 Free Play ended at 0/10, copied and restored as Farm Unfinished; focus remained on board. **Pass C/N** |
| History / C + N | Prepare two dated completions; save/reload; inspect calendar/details | Two completions, eight words, 65 strokes. **Pass C/N** |
| History month navigation / N | Gregorian/month/day model and controller tests | Leap day/alignment/bounds preserved. **Pass N**; broader human calendar review pending |
| History clear/retry / C + N | Corrupt QA history, cancel then confirm Clear; reload; existing retry-retention tests | Warning/bytes retained on cancel; confirmed clear stayed empty after reload while Free Play terminal save survived. **Pass C/N** |
| Storage denial/quota / C, injected + N | QA storage modes; place tiles; finish with history quota, retry | Gameplay continues; no false save success; explicit history recovery. **Pass C/N** |
| Corrupt data / C + N | QA corrupt active save/history; cancel/confirm discard/clear | Original warnings retained on cancel; saving/history recovered only after explicit confirmation. **Pass C/N** |
| Two tabs / C + N | Edit one Daily; other resumes only after explicit confirmation | Conflict warning, cancel retained, confirmed reload succeeded. **Pass C/N** |
| UTC rollover / C, injected + N | Feb 29 → QA advance → cancel/confirm newest date | Old challenge retained until March 1 confirmation. **Pass C/N** |
| Audio/reduced motion / C, injected + N | Feedback QA toggle On/reduced, measure, missing APIs | Zero settled effects; synthesis silent after 550ms. **Pass C/N**; OS settings/listening **NT** |
| Performance / C emulation | Feedback QA at 44/56/72 and DPR1/2/3, Measure | Tables above; no FPS/physical-memory claim. **Pass C** for measured cases |
| Arcade navigation / C + N | Homepage Wordstead card → refresh → Back; Target Tap card → play → return | Both games load, URLs/IDs/count correct. **Pass C/N** |
| Target Tap / C | Start, click target, wait 30s, Play again, return | Score 1; time 0 with ending; replay score 0/time 30. **Pass C** |
| Assets/static integrity / N + C | Run static tests; inspect loaded resources/credits and logs | Exact local paths; new SVG loads; ordinary logs clean. **Pass N/C** |
| Firefox / WebKit / physical phones / screen readers | Repeat ordinary Daily, blank, pan/drag, resume, results/history and cancellation | Firefox access timed out; other environments unavailable. **NT** |

## Final validation and remaining sign-off

Run from `wordstead/`:

```sh
npm test
node --test tests/daily.test.js tests/persistence.test.js tests/personal-history.test.js
node scripts/fit-target-lexicon.js --check
node scripts/analyze-letters.js generate --check
node scripts/benchmark-vocabulary.js
```

Also run `node --check` on changed JS and extracted inline QA modules, and
`git diff --check`. Static tests cover imports/entry paths, case, metadata,
arcade IDs/destinations/count and crawler policy. New controller tests pin explicit
focus transfers without passive focus stealing; the pointer regression pins
same-cell redraw elimination and independent release coordinates.

Final execution: **336/336 tests passed**, with zero failed, skipped or canceled.
The additional explicit compatibility run passed **36/36**, including all seven
released Daily initialization fixtures, active-save replay and personal history.
The released fixture blob matches the base exactly:
`e11660cf0203bcf7038d656713990dc48055a6cb`. Target lexicon and letter-profile
byte checks passed. Six affected JS files and the inline Daily QA module passed
syntax checks. `git diff --check` passed. The vocabulary benchmark and source-diff
checks described above were also executed; the full upstream vocabulary rebuild
was not run. Expected injected-resource failures are not ordinary browser errors.

Release sign-off still needs physical touch/OS keyboard/edge gestures,
Firefox and Safari/WebKit, actual screen-reader gameplay, browser zoom and device
high-DPI memory/long-session retention checks. These gaps remain visible even when
the automated suite passes. There are no known unresolved reproduced release
blockers at the time of this assessment. Future offline/PWA support, social raster
art, broad renderer optimization and additional cosmetic polish are deferred.
