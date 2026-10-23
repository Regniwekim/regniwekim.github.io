# Board opportunity analysis (Milestone 3C.2)

Method **`board-rectangles-v1`**, report schema **1**. Development tools measure
**geometric scoring opportunities**, independently of the 3C.1 letter model.
They never set a target, assign difficulty, solve word placements, or guarantee
that a puzzle can be completed. The browser imports none of these modules.

## Model and authority

A candidate enclosure is an axis-aligned rectangle with at least three rows and
three columns, including its hypothetical letter fence. This understandable
first approximation permits exhaustive inspection of UI board sizes (1–30 on
each axis). It deliberately omits irregular and incomplete-corner fences.

`src/core/enclosure.js` remains the only gameplay enclosure engine. Its exterior
flood fill uses orthogonal land connectivity from every passable board edge.
Only committed letters obstruct it; farm features remain passable. A complete
rectangle is sufficient to enclose its interior. The actual engine can also
enclose a cell with diagonal corner gaps, or just its four cardinal neighbors
occupied. No rule is changed to make gameplay match rectangles.

Rectangle coordinates are inclusive and zero-based: `top`, `left`, `bottom`,
`right`. Width and height include fences. Gross area is `width * height`;
interior area is `(width - 2) * (height - 2)`. The complete fence has
`2 * width + 2 * height - 4` distinct positions, counting corners once.
All positions must lie on the board. Boundary rows/columns may hold **real
hypothetical letters**; the board edge itself never supplies a fence.

Fence positions must currently be null or letter cells. Existing letters can
be reused geometrically, without assuming the resulting runs are valid words.
Every other occupied cell blocks a proposed fence. Known farm obstructions are
classified by type, and other reserved metadata is counted separately.
Rejected fences never enter rankings, the Pareto front or a portfolio.
Reports retain bounded examples of otherwise promising obstructed rectangles.

Tests overlay temporary A occupancy on representative valid rectangle perimeters
and compare their complete predicted interiors with actual `analyzeEnclosure()`
results. These are geometry experiments, not legal moves. The original
CAR/CAB/RAT/BAT fixture still takes four gameplay moves. Its rectangle
`(3,3)–(5,5)` has eight fence positions and one center territory point at `(4,4)`.

## Composition, score and utility

`analyzeBoardComposition(board, { territory? })` accepts the existing dense
`{ rows, columns, cells }` board. Optional territory is the existing matching
`{ rows, columns, claimed }` boolean mask. Inputs are treated as immutable.

Composition includes dimensions, total/interior/perimeter/empty/letter/reserved
cell counts, starting square, claim count and feature counts. Feature distribution
includes per-row, per-column and four center-split quadrant counts, density,
largest quadrant share, mean Manhattan distance from the starting square and
distance divided by `rows + columns - 2`.

`quadrantConcentration` is the sum of squared quadrant feature shares (HHI).
It is null without features; otherwise it ranges from 0.25 to 1. Quadrants split
at the core's lower/right starting-square coordinates; odd or thin boards have
unequal bin areas. This is a descriptive **count concentration**, not an
area-adjusted clustering statistic. Small feature counts naturally raise it.

The **optimistic theoretical scoring upper bound** sums eligible interior land,
excluding the starting square, committed letters and prior claims. Perimeter
land cannot be claimed. The first word must occupy the starting square, so an
empty starting cell is not eventual collectible territory. Even a feature
authored at that cell contributes no potential capture. A structurally valid
board can have a positive bound and still be impossible to score on.

Candidate points use the same eligible mask, restricted to the rectangle's
interior. Non-letter cells contribute one base point. Crop and fertile bonuses
come directly from `FEATURE_TYPES` in `src/core/features.js` (currently +3/+1).
Livestock and buildings contribute one base point and **zero** bonus points.
Unknown non-letter metadata remains land for scoring, as in the existing core,
while reserving its cell against placement. The analyzer creates no new reward
or capture rule. Cells/bonuses already claimed never contribute again.

Utility is separate: livestock capture reward counts and building free exchange
credits. Composition reports total features and eligible potential rewards,
plus potential additional rack slots capped using the core's seven/nine capacity
constants and the existing claimed livestock count. More livestock than remaining
capacity still represents capture rewards but cannot create additional slots or
tiles. Candidate and portfolio utility fields are feature counts; they are not
point equivalents or promises of successful draws/exchanges.

## Effort, ranking and diversity

`analyzeRectangle()` describes each candidate's coordinates, area, points, crop/
fertile/livestock/building counts, obstructions, starting relationship and effort.
The raw effort constituents are:

- Full perimeter demand: all distinct fence positions, including existing letters.
- New letter positions: full demand minus currently committed perimeter letters.
- Horizontal spans: `[width, width]`; vertical spans: `[height, height]`.
  Corners belong to both spans but only once to perimeter demand.
- Longest uninterrupted geometric span.
- Whether the starting square is on the fence, inside, or outside, and its exact
  Manhattan distance to the nearest fence position.

`estimatedFenceEffort` equals full perimeter demand in v1. No weighted effort
index or invented word count is used. `opportunityEfficiency` is
`potentialPoints / fullPerimeterDemand`. It is theoretical points per geometric
letter position, not achievable score per word. A fence near the start is not
necessarily a legal opening; a distant fence is not necessarily unreachable.

Six views rank positive-score candidates that pass `minPoints`:

| View | Primary comparison |
| --- | --- |
| Highest points | Descending potential points |
| Highest efficiency | Descending points / full perimeter |
| Farm bonuses | Descending crop + fertility points, then efficiency |
| Low effort | Ascending full perimeter |
| Livestock | Descending capturable livestock, then efficiency |
| Buildings | Descending capturable buildings, then efficiency |

Point ties prefer smaller perimeter, smaller starting distance, then ascending
`top`, `left`, `bottom`, `right`. Efficiency comparisons use integer cross-products
before those point ties. Low-effort ties prefer points. Utility views do not
convert utility to points. Zero-point candidates never enter attractive views,
even with `minPoints: 0`.

Pareto dominance: A dominates B when A has **at least as many points** and **no
greater full perimeter demand**, with at least one strict improvement. Equal
point/effort pairs do not dominate one another. An effort-tier scan counts the
exact nondominated candidates after the score filter, retaining bounded examples.
The count includes geometrically similar rectangles, not independent strategies.

Each ranking and each Pareto effort tier retains the exact first `poolLimit`
candidates under its deterministic order (default 128). Displayed views then
reject interior intersection-over-union **greater than** `diversitySimilarity`
(default 0.8), stopping at `outputLimit` (default 5). A value of 1 disables this
display deduplication. Results can contain fewer than the requested limit.
`rankingCoverage` discloses eligible/retained counts and truncation. A distinct
candidate farther down a truncated pool can be absent; these are bounded reports,
not a claim to enumerate independent player choices.

## Greedy geometric portfolio estimate

`selectGeometricPortfolio()` greedily selects up to `maxSelected` candidates
(board report option `portfolioSize`, default 3). The report's search pool is the
deduplicated union of six retained ranking pools and retained Pareto-tier pools.
It is bounded and can omit useful spatial alternatives.

At each step, maximize **marginal eligible points / incremental distinct full
fence positions**. Ties prefer marginal points, smaller incremental demand,
then ascending rectangle coordinates. No starting-distance or word assumption is
added. Stop when there is no compatible positive marginal capture.

Compatibility is conservative: neither rectangle's strict interior may intersect
any part of the other rectangle, including its boundary. This rejects overlapping
interiors, nested captures, and a fence crossing another capture. Boundary-only
overlap is allowed: both hypothetical fences can use the same letter position.
This does not establish valid word connectivity or word acceptance.

The selector explicitly unions eligible interior indices and computes marginal
feature rewards with the existing `summarizeFeatures()` helper. It reports each
rectangle's individual and marginal points, combined nonduplicated points,
distinct collectible covered cells and feature coverage. It distinguishes raw
summed perimeter demand from the distinct union, shared positions saved, and
distinct new letter positions. No territory cell or feature bonus is counted
twice. For two adjacent 3×3 fences, summed demand can be 16 and union demand 13.

This is a **greedy geometric portfolio estimate**, not a globally optimal set,
feasible word sequence or target. Increasing a pool limit or changing a greedy
choice can materially change the estimate; it need not improve monotonically.

## Compact report, normalization and scope

`analyzeBoardOpportunities(board, options)` returns schema/method identity,
composition, search policy/counts, six rankings, Pareto data, obstruction data,
feature coverage, portfolio and normalized measurements. Counts by full perimeter
demand and interior area retain exact frequencies. Distributions describe every
valid rectangle's potential points, perimeter, interior area and starting distance,
including zero-point geometry. They use population SD and type-7 quantiles, as
in 3C.1. Zero-area sample sets have null estimates.

`search` distinguishes all board rectangles, considered rectangles, search-skipped
rectangles, valid geometric fences, positive-score fences, score-filtered fences
and ranked candidates. Obstruction incidences count how often features occur on
rejected fences: they are **not distinct feature counts**. The considered-rectangle
obstruction fraction and valid fraction use the same denominator.

Scale-aware fields retain raw values alongside best single and portfolio points
divided by eligible upper-bound value, portfolio and geometrically capturable
bonus fractions, portfolio feature capture fraction, and per-type feature capture
fractions. Exact unique feature opportunity coverage uses all considered valid
positive candidates passing `minPoints`, independently of ranking retention.
Missing denominators return **null**, including no features, no bonuses, no
eligible territory or no considered rectangles. No final composite score exists.

Raw diagnostics: `enumerateRectangleCandidates(board, options)` returns all
measured valid rectangles passing `minPoints` (default 1). Set `minPoints: 0` to
inspect zero-value geometry and `includeObstructed: true` for rejected rectangles.
`analyzeBoardOpportunities(..., { includeCandidates: true })` adds all valid
score-filtered measurements to the compact report, including zeros if requested.
Neither API stores redundant per-cell arrays in individual candidate objects;
`rectanglePerimeter()` derives logical indices when needed. Standalone portfolio
callers must supply candidates measured against that same board and claim mask.

## Generation and CLI

`analyzeFarmBoard(configuration, options)` creates a fresh core board and calls
the unchanged `generateFarm()`. Defaults match gameplay: 15×15, farm seed
`wordstead-farm-2d`, density 0.08, weights crop 4 / livestock 2 / building 2 /
fertile 3. Numeric and string seeds remain distinct. Returned layout positions
are row-major. No session, letter bag, vocabulary or analysis profile is loaded.
The API accepts density 0–1, including zero; the existing browser UI still limits
density to 0–0.25. Features and generation settings are never mutated.

`analyzeBoardBatch(configuration, options)` defaults to 1,000 string seeds
`wordstead-3c2-batch:0` through `:999`. `prefix`, integer `start` and `count`
configure this sequence. `numeric: true` uses numeric `start + index` instead.
`sampling.indexRange` is zero-based, end-exclusive. An empty batch validates
configuration but returns empty distributions and outliers. The batch retains
compact scalar observations, not full per-seed reports or candidate arrays.

Run from `wordstead/`, Node 22+; no install/build required:

```sh
node scripts/analyze-board.js --help
node scripts/analyze-board.js
node scripts/analyze-board.js board --rows 7 --columns 7 --seed wordstead-3c2-batch:0
node scripts/analyze-board.js board --rows 8 --columns 12 --seed 42 --numeric --density 0 --json
node scripts/analyze-board.js board --weights crop:1,livestock:0,building:0,fertile:0
node scripts/analyze-board.js batch --rows 15 --columns 15 --density 0.20 --count 1000 --json --output .analysis-output/board-batch.json
node scripts/analyze-board.js batch --rows 20 --columns 20 --density 0.20 --max-perimeter 28 --count 1000
node scripts/analyze-board.js batch --numeric --start -10 --count 25 --json
node scripts/analyze-board.js board --rows 7 --columns 9 --raw --json --output .analysis-output/board-raw.json
```

`--max-width`, `--max-height` and `--max-perimeter` restrict gross rectangle
search; all skipped counts remain visible. `--min-points` filters rankings,
feature coverage and portfolios, while valid-geometry distributions remain
unfiltered. `--pool-limit`, `--limit`, `--diversity` and `--portfolio-size` bound
retention/display/selection. Unknown, missing, duplicate or command-inapplicable
options fail explicitly. `--numeric` requires an explicit single-board seed;
batch numeric mode cannot also use `--prefix`. CLI dimensions are 1–30.

Human output is concise. `--json` uses stable field ordering, finite numbers,
12 decimal places and exact numeric seed identity, without timestamps, timing or
memory data. `--output` writes instead of printing. Raw candidate output requires
JSON and a destination inside the existing ignored `.analysis-output/` directory.
Keep large diagnostic and per-seed reports out of public commits. No aggregate
statistical artifact is committed; schema 1 applies to reproducible CLI JSON.

Example excerpt, 7×7 seed `wordstead-3c2-batch:0`, default density 0.08:

```text
Cells: 49; interior 25; perimeter 24; one crop; start (3,3)
Upper bound: 27 = 24 base + 3 bonus
Rectangles: 225 considered; 169 valid; 168 positive; 56 obstructed
Highest points: (0,0)–(6,6), points 27, full fence 24, efficiency 1.125
Low effort: (0,0)–(2,2), points 4, full fence 8, efficiency 0.5
Greedy geometric portfolio estimate: 1 rectangle, 27 points, 24 collectible cells
```

## Performance and measured batches

Measurements on Windows, Node **24.14.1**, October 23, 2026. All default searches
are exhaustive. A 30×30 board has **164,836** rectangles, not a sampled subset.
Prefix sums query scores, letters and obstructions in constant time. A difference
grid computes exact feature coverage without rescanning candidate interiors.
Bounded worst-first heaps retain top candidates; an effort-tier scan computes
the Pareto front. Enumeration is O(rows² × columns²), with bounded heap work;
prefix data is O(rows × columns). Portfolios scan only their retained pool and
materialize per-cell sets for the small selected combination.

Single-board observations, seed `wordstead-3c2-measure-v1`, density 0.08, defaults:

| Board | Considered | Valid | Analysis time | Process peak RSS |
| --- | ---: | ---: | ---: | ---: |
| 7×7 | 225 | 145 | 8.66 ms | 37.2 MiB |
| 15×15 | 8,281 | 1,778 | 20.42 ms | 47.0 MiB |
| 30×30 | 164,836 | 13,351 | 103.33 ms | 50.7 MiB |

These are one sequential process's observations, including cold/warm differences,
not latency guarantees. The batch run evaluated **14 configurations × 1,000
seeds**, plus a repeated 1,000-seed batch that matched byte for byte. Every batch
used default prefix/start/weights/pool/display/portfolio settings; dimensions,
density and the stated perimeter limit were its only configuration changes.
Timings below surround the pure batch call, excluding report file writes. Peak
RSS across this sequential measurement process reached **185.9 MiB**, including
temporary objects, distributions, GC and outlier records, not just board masks.

Exhaustive means (best single and greedy portfolio both reached the optimistic
bound in these generated-board samples):

| Board | Density | Valid candidates | Upper / best / portfolio points | Best efficiency | Obstructed fraction | Quadrant HHI | Seconds / 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7×7 | .04 | 225.00 | 24.00 | 1.000 | .000 | unavailable | .71 |
| 7×7 | .20 | 56.56 | 29.52 | 1.230 | .749 | .407 | .41 |
| 10×10 | .04 | 843.12 | 65.62 | 1.823 | .349 | .615 | 1.84 |
| 10×10 | .20 | 145.06 | 77.87 | 2.163 | .888 | .309 | 1.17 |
| 15×15 | .04 | 3,982.85 | 176.16 | 3.146 | .519 | .368 | 7.18 |
| 15×15 | .20 | 310.03 | 211.55 | 3.778 | .963 | .271 | 4.97 |
| 20×20 | .04 | 11,010.65 | 339.56 | 4.468 | .623 | .311 | 20.43 |
| 20×20 | .20 | 549.49 | 408.91 | 5.380 | .981 | .259 | 14.35 |
| 8×12 | .04 | 739.88 | 61.76 | 1.716 | .359 | .626 | 1.71 |
| 8×12 | .20 | 123.73 | 73.92 | 2.053 | .893 | .309 | 1.05 |

The generator protects the perimeter. Consequently a fence around the entire
board is geometrically valid and contains every eligible cell. Exhaustive
best-point value is therefore structurally equal to the upper bound, without
establishing word/rack/bag feasibility. The 30×30 outer fence alone has 116 letter
positions. Using exhaustive best points alone would miss important board variation.

Additional batches capped **each candidate** at 28 full fence positions (this is
a geometric diagnostic, not a calibrated rack/word budget). Portfolio size stayed
three; its combined demand can exceed 28. Counts considered per farm: 5,929 for
15×15 and 13,959 for 20×20.

| Board | Density | Valid candidates | Best points | Best efficiency | Portfolio points | Portfolio / upper | Obstructed fraction | Seconds / 1,000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 15×15 | .04 | 3,159.92 | 41.18 | 1.471 | 104.77 | .595 | .467 | 5.61 |
| 15×15 | .20 | 293.40 | 46.32 | 1.679 | 108.68 | .514 | .951 | 3.84 |
| 20×20 | .04 | 6,973.05 | 43.07 | 1.538 | 118.28 | .348 | .500 | 11.30 |
| 20×20 | .20 | 518.39 | 48.26 | 1.742 | 119.35 | .292 | .963 | 8.06 |

Higher density increases mean bonus value here, but removes many fence choices
and reduces the fraction captured by the bounded portfolio. Absolute portfolio
value barely changes between the two 20×20 densities despite a larger bound.
This does **not** establish that higher density is easier or harder. Lower HHI
at higher density partly reflects having many more sampled features. On 7×7,
`floor(20 * .04)` is zero features, so the sparse batch is deliberately identical
across farm seeds, with unavailable feature concentration.

Inspected outliers, all using prefix `wordstead-3c2-batch` and perimeter cap 28:

- 15×15 density .20, seed suffix **554**: upper bound 221 but best candidate only
  22; portfolio 42. **941** has best 64 and portfolio 151 despite a similar upper
  bound 220. Replaying the former with a 1,024-candidate pool leaves 42 unchanged.
- 20×20 density .20, suffix **624**: upper 398, best 26, portfolio 64; raising
  the pool to 1,024 leaves 64 unchanged. Its rejected-fence fraction is .9702.
  Best-value suffix **378** offers 69 points in one candidate, upper 426.
- 15×15 density .04, suffix **17**: the default pool yields only 43 portfolio
  points although the bound is 175. Raising `poolLimit` from 128 to 1,024 gives
  97 with the same first rectangle, exposing important **pool truncation bias**.
  This is not an exact estimate of all multiple-enclosure potential.

Reproduce table data by running the batch command above for each listed dimension
and density, with `--max-perimeter 28` only for the constrained table. Keep the
default seed sequence and weights. Single-board timings can be reproduced with
`performance.now()` around `analyzeFarmBoard()` calls in order 7, 15, 30, and
`process.resourceUsage().maxRSS / 1024` for process peak MiB on this platform.
Timing/memory will vary by machine, Node version, JIT and GC. No implicit search
cutoff is needed for boards up to 30; explicit limits are available for larger
repeated experiments. Raw all-candidate JSON is intentionally much larger.

## Validation and limitations

The full `npm test` suite passed **235 tests** (208 existing + 27 added). New
tests compare rectangle flood fill, all feature rewards, starting-square and
prior-claim exclusions, unique boundaries, non-square/tiny boards, obstruction,
spans/distances, independent exhaustive ranking/Pareto checks, exact feature
coverage despite pool truncation, search limits, shared/conflicting fences,
portfolio score/union invariants, seed/weight extremes, numeric/string identity,
CLI validation and unchanged session/exchange randomness. Existing 3C.1 profile
and notice regenerated byte for byte with `analyze-letters.js generate --check`.
JavaScript syntax checks and the complete staged `git diff --check` also passed.

Local browser smoke checks confirmed direct `/wordstead/` load/refresh, the
78,626-word loading gate and unchanged seven-tile opening/target, keyboard ELM
placement/commitment (one word, 90 tiles remaining), and return navigation to the
arcade. Embedded 390/1440 CSS-pixel viewports loaded seven rack slots without
document horizontal overflow, with same-origin resources and zero analysis
resources. Browser warning/error logs were empty. The existing homepage has no
Wordstead card, so homepage-to-Wordstead navigation remains unavailable. Physical
touch and cross-engine QA were not performed for this development-only change.

Rectangles ignore word membership, legal opening/connectivity/cross-words,
physical letter supply, rack size, exchanges, word familiarity and player choices.
They miss irregular/corner-gap opportunities. Full perimeter effort charges reused
positions in its baseline, while reporting new demand separately. Shared-fence
portfolio selection is greedy and pool-limited; it may miss better combinations
and cannot prove a combined word layout. Density and seed observations describe
these samples and settings, not a difficulty ordering or confidence guarantee.
Scoring values and capacities remain provisional core playtest definitions.

## Milestone 3C.3 consumption contract

Keep these inputs independently versioned and preserve all search settings:

```text
Board (schema 1, board-rectangles-v1):
  eligible upper bound, candidate points/bonuses, raw effort/spans,
  starting distances, obstruction and feature coverage,
  candidate distributions, Pareto views, bounded portfolio and pool policy

Letters (schema 1, rack-lexical-v1):
  opening-rack flexibility, hypothetical future-draw flexibility,
  seven/eight/nine-tile baseline comparisons and vocabulary/bag identity

Calibration (3C.3, not implemented):
  combine measured inputs, propose targets, validate against tested play
```

This board analyzer never reads the 3C.1 artifact. Future consumers that do must
use its existing `assertBaselineCompatible()`/`loadBaseline()` boundary to check
schema, method, vocabulary ID/checksum/fingerprint and bag signature. There are
no final coefficients or automatic targets here. Pin both method versions, farm
settings, vocabulary identity and search/retention policy before comparing data.
