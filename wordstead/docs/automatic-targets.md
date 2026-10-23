# Experimental automatic score targets (3C.3)

Free Play normally proposes a fixed score objective from the generated farm and
seeded letter order. It estimates a reasonable objective; it does not solve the
puzzle, search optimal scores, predict player choices or establish reachability.
All automatic targets remain **experimental**. Calibration below is analytical
plausibility over synthetic boards/racks, without measured human completion rates.

Wordstead deliberately abandoned golf-style grading in 3B. The completion window
and spoiler-free sharing report actual points, target, words and exchanges;
there is no par, grade, ranking or claim that different seeds are equally difficult.
The historical design skeleton and exploratory visual guide are unchanged.

## Identities and stages

The pure estimator `estimateAutomaticTarget(configuration, { model? })` returns
schema **1**, method **`auto-target-v1`**, `available`, integer `target` or null,
inputs, structured board/letter measurements, calibration parameters and warnings.
No timestamp, ambient randomness, browser measurements or hidden session state
enters that result. Numeric and string seeds retain the core's distinct identities.

Sources remain unchanged:

| Input | Identity |
| --- | --- |
| Geometry and scoring | schema 1 / `board-rectangles-v1` |
| Reference rack analysis and baseline | schema 1 / `rack-lexical-v1` |
| Vocabulary | `esdb-en-us-60-1e5b7d3-ws1`, 78,626 words |
| Vocabulary SHA-256 | `724ed98404895a23d5c3db1c205aae3369c6a66f9b34b46cadb4b91f068f4532` |
| Existing profile SHA-256 | `49ce77d4259056ee0b68031c2ee97b041ac8ee8be8063d8617333ee8e02ebc65` |
| Compact lexical approximation | schema 1 / `rack-regression-v1` |
| Composition features | `rack-composition-v1` |
| Physical bag | `wordstead-standard-100-v1`, unchanged signature |

The compact table also pins the vocabulary fingerprint, metric weights, bag
signature and capacity-seven baseline mean. Compatibility checks reject mismatches.
The original authoritative development trie, full metrics, sampler and profile
remain available; coefficient fitting does not replace them. Changes to these
frozen coefficients or target rules require distinct versions and renewed
calibration. Vocabulary/baseline changes require compatible new fitted data and
must not silently change old puzzle identities.

The three stages are `estimateBoardOpportunity()`, `estimateLetterFlexibility()`
and `selectConservativeTarget()`. All are independent of DOM, Canvas and storage.
Only the composition/search portion of 3C.2 is used at runtime, not its expensive
multi-ranking report or its pool-limited portfolio selector.

## Board formula

For a fresh board, consider all complete rectangular fences with nonempty
interiors meeting these explicit limits:

| Parameter | v1 |
| --- | ---: |
| Gross width and height | at most 7 each, also bounded by dimensions |
| Distinct fence positions per candidate | at most 24 |
| Manhattan distance from start to nearest fence | at most 7 |
| Minimum eligible scoring points | 1 |
| Selected compatible enclosures | at most 2 |
| Combined distinct fence positions plus primary starting distance | at most 40 |
| Reference fence demand for discount | 16 |
| Secondary contribution | 0.25 |
| Utility point adjustment | 0 |

Seven is the **initial** rack capacity, not a promise that a span is constructible.
The largest permitted complete 7×7 fence demands 24 tiles. The combined budget is
`floor(100 × 0.4) = 40`, using the existing finite bag size, reserving 60 tiles for
connections, word extensions, awkward letters and other play. Rack expansion is
conditional on captures and does not enlarge these initial limits. Small boards
use their actual dimensions; they do not receive an automatic ease bonus. Larger
boards cannot inflate limits simply by supplying more space.

3C.2 measures candidate `P` points, `F` full fence demand and `D` starting distance.
The target policy values that candidate as:

```text
V = P × (16 / F) / (1 + D / 7)
```

Points exclude perimeter land, the mandatory starting square, letters and prior
claims. Crop/fertile bonuses come from the unchanged core definitions. Features
and other metadata obstruct fences. Livestock/buildings retain base territory
value and zero bonus; no conditional utility is converted into invented points.

The primary candidate maximizes V; ties prefer smaller F, smaller D, then
ascending top/left/bottom/right coordinates. A second complete pass chooses the
highest-V compatible candidate meeting the combined budget. Interior/fence
conflicts are rejected using 3C.2's conservative compatibility rule; boundaries
may share positions. The union counts shared fence letters once. Matching actual
word letters on shared positions is **not** established. Primary starting
distance is charged once to the budget; the separate connection between two
fences is not solved. The large reserve and small secondary contribution account
provisionally for this missing information, without guaranteeing enough resources.

```text
boardOpportunity = primary.V + 0.25 × secondary.V
```

Both passes inspect every candidate within the published bounds. There is no
retained candidate pool, display limit or pool truncation. Reports disclose all
rectangle counts, considered/skipped counts, distance/obstruction exclusions,
eligible count and the two selected measurements. `truncated: false` refers to
candidate-pool retention; `exhaustiveGeometry` is false when search bounds skip
larger rectangles. Compatibility provides spatial diversity, not a count of
independent playable strategies. This remains a two-choice greedy heuristic,
not an optimal portfolio. In particular, the best primary can foreclose a better
pair. Irregular and incomplete-corner enclosures are omitted.

## Letter formula and compact approximation

The seeded **opening seven tiles** and nine untouched-bag windows beginning at
`7,17,28,39,50,60,71,82,93` are inspected independently. These are hypothetical
alternatives from the initial shuffle, not forecasts of future gameplay racks;
commits/exchanges determine those actual racks. They never advance session RNG.

The original 3C.1 model supplies normalized short (lengths 2–3), medium (4–5),
long (6–7) and length-diversity measurements. Runtime estimates these four and
uses the original overall weights **0.25 / 0.30 / 0.30 / 0.15**. Reports keep the
groups separate for inspection. Adding raw word counts, blank counts, diversity
and all groups again as independent target coefficients would double-count
correlated signals. Blank and repeated-letter effects already enter the fit.

The coefficient table has 107 features in this exact order:

1. Intercept.
2. A–Z physical counts (26).
3. A–Z excess duplicates `max(0, count − 1)` (26).
4. Blank count and its square (2).
5. A–Z physical counts times blank count (26).
6. A–Z physical counts times total AEIOU count (26; Y excluded).

Fit four separate ridge regressions to exact 3C.1 outputs for the first seven
tiles of **6,000 real standard bags**, seeds `wordstead-3c3-fit-v1:0..5999`.
Unscaled normal equations use penalty **2** on all coefficients except the
intercept, solved by deterministic Cholesky decomposition. Coefficients serialize
to nine decimal places. Each predicted component is clamped to 0–1 before
applying the existing overall weights. No exact word count is inferred from this
regression, and it cannot recognize every zero-word rack.

With O = estimated opening overall, H = mean estimated hypothetical-window
overall and B = unchanged capacity-seven baseline mean **0.395548004266**:

```text
signal = 0.35 × (O − B) + 0.65 × (H − B)
letterMultiplier = clamp(1 + 0.4 × signal, 0.90, 1.10)
```

The opening contributes only 35% of this modest adjustment; later-bag potential
can offset an unhelpful opening. The entire effect is bounded even for exceptional
blanks, all-vowel/consonant or duplicate-heavy racks. A zero-word rack is not an
unavailability or unsolvability test. The ±10% ceiling is narrower than the
exploratory ±15% suggestion: observed typical adjustments were only a few percent,
so a larger ceiling had no analytical justification. The exact future mean is
also an exploratory rack-only measurement, not a known attainable resource pool.

## Conservative selection and unavailability

```text
raw = floor(boardOpportunity × 0.55 × letterMultiplier)
target = min(theoreticalCollectibleUpperBound, max(1, raw))
```

The minimum is applied **only after finding a positive eligible candidate** and
a positive collectible bound. It never invents a target for a board without those
conditions. The theoretical bound is necessary, not sufficient for reachability.
Session construction still receives an actual positive safe integer.

| Unavailable reason | Meaning |
| --- | --- |
| `NO_COLLECTIBLE_TERRITORY` | Eligible interior score bound is zero; there is no collectible territory |
| `NO_ELIGIBLE_CANDIDATES` | Positive bound, but no scoring fence meets the bounded policy; does not prove unsolvability |
| `INCOMPATIBLE_ANALYSIS` | Unsupported model/baseline/vocabulary identity or malformed coefficients |
| `UNSUPPORTED_CONFIGURATION` | Outside the 1–30 UI dimensions or a scripted bag order |
| `INVALID_CONFIGURATION` | Invalid dimensions, seeds, farm density/weights or configuration shape |

Unavailable results have `available: false`, `target: null` and a readable message.
The UI preserves the active puzzle and offers settings changes or Manual. A 1×1,
2×N or ordinary 3×3 has no eligible territory. A fully dense 30×30 farm has a
positive bound but no eligible local rectangles under this policy; it receives
the second reason. Its remote full-boundary rectangle is deliberately excluded.
Density above .25 is development-only; browser density remains 0–.25.

## Investigation and coefficient rationale

Before finalizing coefficients, the reproducible `investigate` workflow compared
unrestricted best points, perimeter 28, span limits 5/7/9, 128/1,024 retained
portfolio pools, obstruction, starting distance and compact opportunity. It used
16 farm seeds at each of 7×7, 15×15 and 30×30 with densities .04/.20.

Selected means:

| Board / density | Unrestricted best | Best, perimeter ≤28 | Best, span ≤5 | Best, span ≤7 | Compact opportunity |
| --- | ---: | ---: | ---: | ---: | ---: |
| 7×7 / .04 | 24.00 | 24.00 | 8.00 | 24.00 | 11.20 |
| 7×7 / .20 | 29.50 | 29.50 | 11.06 | 29.50 | 14.16 |
| 15×15 / .04 | 176.31 | 41.13 | 12.88 | 29.56 | 22.47 |
| 15×15 / .20 | 211.69 | 47.00 | 14.19 | 33.06 | 23.28 |
| 30×30 / .04 | 826.38 | 45.00 | 14.88 | 32.75 | 22.62 |
| 30×30 / .20 | 995.94 | 51.06 | 18.50 | 35.63 | 21.96 |

Span columns also use perimeter ≤28 but omit the production starting-distance
and combined-budget limits. Span nine largely recovered the perimeter-28 best
value; it presumes longer words than the opening rack supports. Span five erased
many medium opportunities. Seven/24 was chosen as a restrained middle policy
linked to actual initial resources, not a universal calibrated word-length law.
Full-board bounds are clearly scale-dominated and are used only as final bounds.

The known 3C.2 outlier, `wordstead-3c2-batch:17`, 15×15/.04/perimeter28, reproduced
**43 vs 97** portfolio points for pool 128 vs 1,024. Across the new samples, larger
pools could also lower greedy totals (30×30/.20 mean difference −3.31). Therefore
the production path avoids retention pools completely; it does not simply assume
that a larger pool makes a greedy portfolio correct. Exact bounded streaming is
fast enough. Utility-point bonuses and an additional density multiplier were
rejected: existing score and obstruction already reflect the farm, and utility
requires future captures. Starting proximity and actual shared-position demand
remain explicit, limited geometric evidence.

Discount candidates .40/.55/.70 were compared on the calibration matrix:

| Discount | Mean target | p95 | Maximum |
| --- | ---: | ---: | ---: |
| .40 | 7.62 | 10 | 14 |
| .55 | 10.63 | 14 | 19 |
| .70 | 13.61 | 18 | 24 |

The chosen .55 leaves substantial slack below even the effort-discounted
opportunity, while preserving useful board differences. The secondary contributes
at most 25% of a primary-sized value and is further discounted in selection. These
are provisional design coefficients chosen for restrained analytical objectives,
not fitted win-rate thresholds. No available human score data justifies a precise
optimal value. The lower .40 remains a plausible future alternative if playtests
show that the initial targets demand unreasonable construction.

## Calibration and held-out findings

Two disjoint full factorials use prefixes `wordstead-3c3-calibration-v1` and
`wordstead-3c3-validation-v1`. Each uses **32 farm seeds × 16 independent letter
seeds × 6 sizes × 3 densities = 9,216 configurations**. Seed templates are
`<prefix>:farms:<index>` and `<prefix>:letters:<index>`, indices starting at zero.
Sizes are 7×7, 10×10, 15×15, 20×20, 8×12 and 30×30; densities are 0/.08/.20.
Default feature weights remain crop4/livestock2/building2/fertile3. Holding one
seed fixed while varying the other isolates their effects; boards/letters are
cached only within the Node reporting workflow, never via hidden runtime state.

Calibration: mean **10.629**, median **11**, p05/p95 **6/14**, range **5–19**.
Held-out: mean **10.566**, median **11**, p05/p95 **6/14**, range **5–17**.
Neither matrix had unavailable estimates; targeted tiny/fully obstructed cases
exercise unavailability separately. Every available result was a positive integer
within its bound. Held-out target/bound ratios averaged **.113**, maximum **.3125**.

Held-out means by size and density:

| Board | Density 0 | Density .08 | Density .20 |
| --- | ---: | ---: | ---: |
| 7×7 | 5.94 | 6.15 | 7.72 |
| 10×10 | 9.00 | 10.65 | 11.55 |
| 15×15 | 10.81 | 12.72 | 12.43 |
| 20×20 | 10.81 | 12.67 | 11.21 |
| 8×12 | 10.81 | 11.33 | 11.93 |
| 30×30 | 10.81 | 12.64 | 11.00 |

Higher density does not imply greater ease or a larger target. On large boards,
obstruction can outweigh bonus growth. Feature-free boards ≥15 have the same
target range because the local opportunity/budget caps do not grow with dimensions.
Within a fixed farm, changing held-out letter seeds changed targets by **0–1**
points (mean range .658); calibration ranges were 0–2. Changing farm seeds at a
fixed letter seed had mean held-out range **3.962**, including identical zero-density
farms. These observations support a moderate letter contribution rather than a
rack-dominated objective. Rounding intentionally makes some setups insensitive
to a small letter change.

Notable inspected outliers:

- Calibration 20×20/.20, farm suffix13 / letter suffix15: target **19**, bound424,
  opportunity34.479, multiplier1.01193, 338 eligible fences, obstruction fraction
  .9244. The optimistic bound alone would conceal that obstruction.
- Held-out 30×30/.20, farm suffix4 / letter suffix15: target **17**, bound981,
  opportunity31.556, multiplier.98430, 257 eligible fences, obstruction .9492.
- Held-out feature-free 7×7, letter suffix1: target **5**, bound24, opportunity11.2,
  multiplier.97190. Sparse small boards are not assumed easy.

The CLI retains five low/high configurations and aggregate distributions. Farm
outliers are inspected with individual reports; the tail arrays may contain
several letter variants of the same farm. No enormous per-seed report is committed.

### Approximation error on separate real racks

The held-out lexical set uses **2,000 seeds**, prefix
`wordstead-3c3-lexical-validation-v1`, and ten racks per seed (opening plus nine
windows): **20,000 actual physical racks**. It shares no fitting seed prefix.

| Measurement, 0–1 scale | Mean absolute error | p95 absolute error |
| --- | ---: | ---: |
| Short | .02876 | .08086 |
| Medium | .07526 | .19169 |
| Long | .11902 | .32001 |
| Length diversity | .08293 | .20769 |
| Overall | .05811 | .14707 |
| Mean future-window overall, per seed | .01986 | .05056 |
| Final letter multiplier | .00961 | .02317 |

Overall bias was **+.00494**. Long words are sparse and poorly predicted; the
largest observed long-metric error was **.7694**, so detailed long predictions
must not be read as exact lexical analysis. Across 196 zero-word examples, overall
MAE was **.12335**, entirely overprediction. Across 84 two-blank racks, MAE was
**.04899**; across 714 racks with at least three duplicate excess letters, **.05594**.
On the default farm, the approximation changed the target versus exact 3C.1 in
**275/2,000** seeds, always by **one point**. Maximum multiplier error was .04016.
That comparison holds the default board fixed; it is not an all-board error bound.

The original measured examples were reproduced: AEIRSTN has 161 words, BCDFGHT and
JQXZKUV have 0, AAEELLS has 23, AEIRST? has 1,214 and AEIRS?? has 3,832. Runtime overall
predictions for BCDFGHT/JQXZKUV are .1648/.0699 rather than zero; AEIRSTN is .6815
vs exact .7640. These limitations motivate the bounded final multiplier and keeping
the exact development model. They do not establish that a zero-word opening can
or cannot eventually produce a fence.

## Browser path, performance and footprint

The static game imports a **6,671-byte** fitted JS table with existing ESDB
[derived-data notice](../data/letter-analysis/NOTICE.txt). No words, full profile
or extra trie enter that table. Its source is the existing verified vocabulary;
all existing license and asset records remain unchanged.

The full additional browser module graph (including reused geometry/statistics
source that was previously development-only and the setup wrapper) is **55,797
source bytes** before compression, across 13 modules. The existing dictionary is
still fetched once, 750,727 bytes; its parser/Set is reused without modifications.
The compact static coefficient artifact is necessary to approximate lexical
analysis without loading/building another dictionary index. Native ES imports
add same-origin initial module requests, with ordinary browser caching; there
are **no extra fetches on Calculate, New Puzzle, Restart, moves or exchanges**.
No full baseline sampling or large batches run in normal browser creation.

Measured October 23, 2026, Windows Chromium 155 in the in-app browser. The public
development harness runs 50 estimator calls per configuration and 200 complete
`createTargetSession()` calls. Measurements use `performance.now()` and are not
included in deterministic estimator JSON.

| Configuration | Desktop median / p95 | 390px viewport median / p95 |
| --- | ---: | ---: |
| 15×15, density .08 | 1.5 / 2.9 ms | 1.4 / 1.8 ms |
| 7×7, density .08 | .2 / .3 ms | .2 / .3 ms |
| 15×15, density .25 | 1.3 / 1.4 ms | 1.2 / 1.5 ms |
| 30×30, density .08 | 6.6 / 7.1 ms | 6.5 / 7.2 ms |

The first cold default call was 10.8 ms. Two hundred complete session creations
took 290.8 ms desktop and 282.2 ms in the narrow viewport. These batch totals
deliberately run in one development action; ordinary creation runs only one
estimator. Coarse Chromium heap observations across the full benchmark were
12.43→17.55 MB and 17.66→24.25 MB. They include temporary allocations and uncontrolled
GC and are **not retained-memory estimates**. The active session adds only compact
target metadata (<400 JSON characters), not candidate arrays/reports. Exact
per-estimator retained memory was not measured.

A narrow viewport uses the same desktop engine/CPU. **Physical mobile hardware,
CPU throttling and other engines were unavailable**, so these are responsive
layout measurements, not mobile-device performance claims. Larger devices and
slower processors still need QA. Current low-millisecond desktop timings did not
justify a worker, async loading, a second trie or another runtime dependency.

## Sessions, UI and results

`createSession()` remains unchanged and accepts integer targets; its default 1 and
all scripted QA targets remain exact. `createTargetSession()` returns
`{ available, session, estimate }`. Manual mode bypasses the estimator entirely,
including compatibility checks. Automatic mode resolves an integer first, then
calls the original constructor. `state.targetSelection` stores mode, resolved
target and versions; existing state stores original generation settings.

`restartTargetSession()` reconstructs the original board/order and reuses the
original integer and metadata, ignoring edited controls and never recalculating.
Words, draft edits/previews, invalid moves, exchanges, farm captures and livestock
capacity changes cannot alter it. Results and sharing still derive the actual
target from session state, without analytical details or spoilers.

Setup defaults to Automatic — Experimental, with Calculate Target and a live
readable preview. Editing any setup setting clears the old estimate. Submitting
an uncalculated setup first displays the estimate without creating a new run;
submit again after reviewing it. Manual exposes the numeric control and disables
the unused automatic pathway. Unavailable calculations preserve the active run.
The HUD stays limited to actual progress and a concise experimental mode label.
Controls keep visible focus, ≥44px targets and the existing responsive layout.

## Browser observations and limits

Browser checks exercised the default 12, 7×7 automatic 6, 8×12 automatic 12, density
.25 automatic 9, density 0 automatic 11, zero-word opening seed
`wordstead-3c1-batch:177` automatic 12, and two-blank opening
`wordstead-3c3-browser:160` (IW?NZ?U) automatic 13. These were setup/input smoke
checks, **not completed playtests**. Unavailable 1×1 preserved the previous 7×7 run.
Manual 8×12 target 17 restarted at 17 after editing the field to 99 and changing the
seed. Direct load/refresh, return navigation and mode/fixture checks are recorded
with final validation below.

One complete **deliberately selected seeded observation** used 3×4, density 0,
letter seed `wordstead-3c3-play:4222`, automatic 1, opening RAOA?OE. In the 390px
browser, keyboard placement and explicit blank→T committed RAT at (1,3) vertical,
CAR at (1,1) horizontal, CAB at (1,1) vertical and BAT at (3,1) horizontal (1-based).
Before BAT commitment the preview showed +1 while state stayed 0/1 and results were
hidden. Commitment won 1/1 after 4 words; Copy Results reported the same score and
zero exchanges without words/positions/draws. This seed was found by trying that
fixed known four-word sequence against real bags; it is not a random human trial,
generated solution, completion-rate estimate or evidence for 15×15 reachability.

An ordinary default 15×15 run also accepted keyboard-placed ELM, then was explicitly
ended at 0/12 after one word. That short unfinished attempt does not assess whether
12 is reachable. The word lab's CAR preview, freeform letter edit, return to the
rack's own results and all four farm fixture targets were checked in the browser.

Automatic restart after editing the completed run's dimensions and seed restored
the original 3×4 board, RAOA?OE order and target 1. Direct `/wordstead/` load and
refresh restored the default 12; the return link reached the arcade homepage.
The unchanged homepage still has no Wordstead card. At 390px and 1440px there was
no document horizontal overflow; visible setup controls measured at least 44px
high. Both browser tabs had no captured warning/error logs. Physical touch/drag,
other browsers and screen-reader software were not exercised.

Tests independently reproduce that seeded win and all earlier fixture outcomes.
No sufficiently broad manual-play sample exists to measure human solvability,
average scores or subjective difficulty. In particular, larger default targets
still need real repeated attempts. Final art, persistence, telemetry, accounts,
backends, daily scheduling and all scope-excluded systems remain absent.

## Reproduce

From `wordstead/`, Node22+; no installation/build:

```sh
node scripts/analyze-targets.js --help
node scripts/analyze-targets.js target
node scripts/analyze-targets.js target --rows 8 --columns 12 --seed 42 --numeric --json
node scripts/analyze-targets.js target --rows 30 --columns 30 --density 1 --json
node scripts/analyze-targets.js target --weights crop:1,livestock:0,building:0,fertile:0
node scripts/analyze-targets.js investigate --count 16 --json --output .analysis-output/target-investigation.json --timing
node scripts/analyze-targets.js batch --count 32 --letter-count 16 --prefix wordstead-3c3-calibration-v1 --json --output .analysis-output/target-calibration.json --timing
node scripts/analyze-targets.js batch --count 32 --letter-count 16 --prefix wordstead-3c3-validation-v1 --json --output .analysis-output/target-validation.json --timing
node scripts/analyze-targets.js lexical --count 2000 --json --output .analysis-output/target-lexical-validation.json --timing
node scripts/fit-target-lexicon.js --check
node scripts/analyze-letters.js generate --check
npm test
git diff --check
```

`--start` and explicit prefixes/sample counts make independent repeats possible.
Target CLI accepts independent letter/farm seeds and full feature weights. Stable
JSON excludes timestamps/performance/memory; `--timing` writes those observations
to stderr. Single reports include versions, selected measurements, bounds and all
coefficients. Batch summaries include size/density distributions, farm/letter
variation, unavailable percentage, upper-bound ratios and outliers. Unknown,
duplicate, missing or command-inapplicable flags fail explicitly. Large reports
belong only in ignored `.analysis-output/`. Regenerate coefficients only
intentionally with `node scripts/fit-target-lexicon.js`.

The two 9,216-case Node matrix runs took 1.52/1.55 s (peak RSS 82.9/82.6 MiB). The
20,000-rack reference comparison took 2.32 s (peak 161.3 MiB); the geometric input
investigation took 7.58 s (peak 216.0 MiB). These process-level observations include
reporting/temporary objects and depend on machine/JIT/GC; they are not browser
or per-puzzle memory costs.

For browser measurements, start the README's static server and open
`http://localhost:8000/wordstead/scripts/benchmark-targets.html`. Activate Run
production benchmark; repeat at desired viewport/device sizes. This harness
is development-only and is never imported by gameplay. All runtime paths stay
relative and work directly at `/wordstead/` on static hosting.

Final automated validation passed **252 tests** (235 previous + 17 added), all
affected JavaScript syntax checks including the browser harness, both artifact
regeneration checks and `git diff --check`. Separate Node processes produced
identical full single-configuration reports, and the complete calibration matrix
was repeated independently with byte-for-byte identical JSON. Tests include
tiny/non-square/large/dense/obstructed boards, source compatibility, an independent
full bounded candidate scan, no pool truncation, lexical edge/error bounds,
integer score bounds, fixed session targets and results/copy regression paths.

Future tuning should collect separately labeled play observations across many
seeds and board shapes, revisit zero-word/long-word approximation errors and
connectivity costs, and version coefficients rather than silently altering
reproducibility. A future solver or guaranteed-solvable generator is a separate
milestone and is not implied by any metric here.
