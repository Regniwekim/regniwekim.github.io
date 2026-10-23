# Vocabulary and seeded letter analysis (Milestone 3C.1)

This development model measures **rack-only word constructibility**: accepted
spellings that physical tiles can supply, compared with sampled standard racks.
It supplies one analytical input for later board-opportunity and target-calibration
work. Gameplay remains at Milestone 3B, including the temporary target of 1.
No analysis is shown to players or imported by the browser game.

## Source, identity and redistribution

Input: the committed ESDB American English size-60 vocabulary, version
`esdb-en-us-60-1e5b7d3-ws1`, **78,626 words**, **750,727 bytes**, SHA-256:

```text
724ed98404895a23d5c3db1c205aae3369c6a66f9b34b46cadb4b91f068f4532
```

`scripts/letter-analysis-source.js` reads the existing manifest, verifies original
byte length, SHA-256 and integrity, then uses the game's existing `parseVocabulary`.
It never downloads, exports or modifies a dictionary. Injected sources normalize
through `normalizeWord`, require lengths 2–30, deduplicate and ASCII-sort; empty
sources are allowed. Their sorted newline-separated words receive an FNV-1a
fingerprint, which is not cryptographic. Pinned files additionally retain SHA-256.

The profile is **derived from ESDB**, Copyright 2000-2026 by Kevin Atkinson.
Generated [NOTICE](../data/letter-analysis/NOTICE.txt) preserves the applicable
copyright, permission, disclaimer and source acknowledgments from the first
section of the existing [full notice](../licenses/esdb/Copyright). Keep the notice
with redistributed profiles and supporting documentation. [Vocabulary policy](vocabulary.md)
explains the American size-60 scope and Alan Beale's contributions. No existing
dictionary, notice, asset record or third-party artwork is changed.

## Vocabulary measurements

Every supported length **2–30** remains in the profile, including zero-count
lengths 24–30. Longer-than-rack words matter when reusing committed letters.
These are **dictionary spelling counts, not corpus usage frequencies**, player
familiarity or likely choices.

For each length: word count, percentage, cumulative count, total letter occurrences,
26 occurrence counts, relative frequencies, word-presence counts and repeated-letter
word counts. Arrays use the explicit `alphabet` field, `ABCDEFGHIJKLMNOPQRSTUVWXYZ`.
Three E letters in one word contribute three occurrences, one presence and one
repeated-E-word count. Combined profiles cover all lengths, 2–3, 4–5, 6–7 and 8–9.

Also included: first/final letter counts, an AEIOU-count histogram (Y excluded),
maximum single-letter multiplicity histogram, words with any repeated letter and
words with adjacent identical letters. Histogram indices represent counts, including
zero. Ordered adjacent pairs/triples count overlapping occurrences: AAA contributes
two AA pairs; TH and HT remain separate. The artifact retains the top **32** pairs
and triples plus total distinct counts. `analyzeVocabulary(words, { combinationLimit })`
can change this report limit. Rank by descending count, then ASCII spelling.

Measured October 23, 2026:

| Length | Words | Length | Words |
| ---: | ---: | ---: | ---: |
| 2 | 65 | 13 | 2,638 |
| 3 | 682 | 14 | 1,315 |
| 4 | 2,605 | 15 | 678 |
| 5 | 5,109 | 16 | 286 |
| 6 | 8,290 | 17 | 139 |
| 7 | 11,587 | 18 | 46 |
| 8 | 12,680 | 19 | 22 |
| 9 | 11,614 | 20 | 7 |
| 10 | 9,526 | 21 | 2 |
| 11 | 6,839 | 22 | 3 |
| 12 | 4,492 | 23 | 1 |

Lengths 2–7 account for **28,338 (36.0415%)**, 8–9 for **24,294 (30.8982%)**,
and beyond nine for **25,994 (33.0603%)**. There are **670,679 letter occurrences**.
E occurs 77,601 times in 54,133 words; 19,142 words repeat E. 59,960 words repeat
a letter; 18,679 have an adjacent repeat. Leading pairs are IN (15,681), ER
(14,404), ES (13,648); leading triples ING (8,602), ERS (3,453), ION (3,418).
Morphological forms influence these counts.

## Bag comparison

`src/analysis/bag.js` imports **`LETTER_DISTRIBUTION` from the unchanged core**;
there is no second distribution table. Identity is `wordstead-standard-100-v1`
plus a canonical `letter:count` signature including `?`. The profile derives
100 tiles, 98 natural letters and two blanks (2%). Expected counts in a uniform
rack of capacity `c` are `c * physicalCount / 100`: E expects 0.84/0.96/1.08 at
capacities 7/8/9, and blanks 0.14/0.16/0.18. These marginal expectations are exact;
constructibility baselines are sampled estimates.

With `d(letter) = dictionaryOccurrences(letter) / allDictionaryOccurrences`:

```text
physicalAvailabilityRatio = (physicalCount / 100) / d(letter)
availabilityRatio         = (physicalCount / 98)  / d(letter)
```

The second divides out the bag's 0.98 natural-letter fraction. When the vocabulary
contains all 26 letters, its dictionary-occurrence-weighted mean is 1. Blanks have
no dictionary share or ratio; unobserved dictionary letters also have `null` ratios,
not invented values or division by zero. Blank availability is reported separately.

Example normalized ratios: S 0.4574, C 0.5013, E 1.0583, Q 5.6653. A high ratio
describes relative physical abundance against dictionary appearances. It does not
make Q useful: companion letters, multiplicity, board reuse, length, cross-words,
fence geometry and farm positions matter. This ratio is not a gameplay score.

## Rack algorithm and API

`prepareRackVocabulary(words, { id, sha256 })` groups **52,632** length-2–9 words
into **47,282** sorted-letter signatures. Anagrams share an unordered signature
but remain separate accepted spellings. A trie of these multisets is compacted
into child/sibling `Uint32Array`s and a letter `Uint8Array`; word terminals stay
private in a WeakMap. Its frozen public handle exposes identity and size information.

`analyzeRack(physicalTiles, preparedOrWords, { allowShort = false })` returns
distinct word count, counts for lengths 2–9, longest spelling/length, sorted
initial/final letters and counts, covered lengths, and distinct ordered pairs and
triples occurring in constructible words. `combinations.total` adds distinct pair
and triple counts. It counts observed combinations without claiming strategic
value. Longest-word ties select the ASCII-first spelling.

Physical inputs use `{ id, letter }`: distinct nonnegative safe integer IDs and
uppercase A–Z or `letter: null`. Seven through nine tiles are normal; explicit
`allowShort` enables zero through six for diagnostics. At most two blanks are
allowed. `parseRack('AEIRST?')` allocates unique diagnostic IDs. Diagnostic strings
are not a bag-distribution proof; seed/baseline samples always use the core bag.

Traversal consumes available natural counts first; each deficit consumes one
remaining blank. Stop branches exceeding rack depth or blank supply. This matches:

```text
sum(max(0, required(letter) - held(letter))) <= blanks
```

Each terminal is visited once, so duplicate physical letters and alternative blank
assignments never multiply word counts. Blanks retain their physical IDs and null
letters. No input, session, bag order or RNG state is mutated.

Preparation processes source characters and constructs signatures; queries visit
compatible trie branches instead of scanning every word or generating permutations.
Two blanks widen the search. There are **92,076 nodes** and **828,684 bytes** of
typed arrays, excluding words, array/object overhead and temporary construction Maps.
Development processes use more memory than the compact arrays alone. Nothing loads
this second vocabulary/index in normal gameplay.

## Provisional normalized metrics

Fit separate references for capacities 7, 8 and 9. For each eligible length `l`
from 2 through capacity and baseline racks `r`:

```text
reference[l] = mean(log1p(constructibleCount[r,l]))
signal[l] = log1p(constructibleCount[rack,l])
normalized[l] = signal[l] / (signal[l] + reference[l])
```

Zero signal maps to zero, including a zero reference. Positive signal against zero
reference maps to one, indicating an opportunity absent from the reference sample.
Equal signal/reference maps to 0.5. Saturation reduces heavy-tail influence.
Every eligible length receives equal weight within its group:

| Rack-only metric | Calculation | Provisional overall weight |
| --- | --- | ---: |
| `short` | Mean normalized lengths 2–3 | 0.25 |
| `medium` | Mean normalized lengths 4–5 | 0.30 |
| `long` | Mean normalized lengths 6–capacity | 0.30 |
| `lengthDiversity` | Covered lengths / (capacity − 1) | 0.15 |
| `overall` | Weighted sum of the four metrics | — |

These weights were selected before inspecting example-rack rankings and remain
provisional. Metrics lie in 0–1. Compare overall to the same capacity's sampled
distribution; its baseline mean is not necessarily 0.5 because of zero counts,
saturation and diversity. Results serialize to 12 decimal places, preserving
numeric seed identity exactly. Empty baselines and uncalibrated short racks return
`null` flexibility. Empty distributions have count 0 and null estimates.

These metrics do not measure legal placements, future playable sequences,
territory, feature value, solvability, optimal strokes or final difficulty. Twice
a metric is not twice as easy. No target multiplier or 0.85–1.15 adjustment exists.

## Baseline sampling and distributions

Defaults: **1,000 independent bags**, seed **`wordstead-3c1-baseline-v1`**. Bag `i`
uses string `JSON.stringify([samplingSeed, i])`, for `i = 0..999`, passed to the
existing FNV-1a/Mulberry32/rejection-sampled Fisher–Yates `createBag`. Take its
first 7, 8 and 9 physical tiles. Indices use separate fresh bags; capacities at
the same index share nested prefixes and are correlated. This is reproducible
pseudorandom sampling, not exact probabilities or cryptographic independence.
No active session's RNG is accessed.

Store mean, population standard deviation and quantiles p0, p01, p05, p25, p50,
p75, p95, p99 and p100 for word totals, every eligible length and every flexibility
metric. Median is p50. Quantiles linearly interpolate at `(n − 1) * p` (type 7),
without rounding to integer counts. Baselines normalize their own samples; the
separately prefixed batch below is a held-out descriptive check.

| Capacity | Mean words | Median words | Mean overall | SD overall | p05 overall | p95 overall |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7 | 73.374 | 31 | 0.3955 | 0.1621 | 0.1606 | 0.7261 |
| 8 | 127.166 | 54 | 0.4145 | 0.1419 | 0.2028 | 0.6543 |
| 9 | 205.601 | 86 | 0.4284 | 0.1259 | 0.2205 | 0.6537 |

Mean/median word counts by length:

| Capacity | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7 | 10.195/6 | 26.110/13 | 25.572/9 | 9.186/2 | 2.125/0 | 0.186/0 | — | — |
| 8 | 12.666/8 | 38.351/19 | 45.802/18 | 21.696/6 | 7.274/1 | 1.291/0 | 0.086/0 | — |
| 9 | 15.242/10 | 53.071/27 | 73.112/30.5 | 41.392/12 | 17.549/4 | 4.520/0 | 0.675/0 | 0.040/0 |

Long full-rack words are sparse. Blank-rich racks create strong tails; means far
exceed medians. At 1,000 samples the outer 1% contains about ten samples, so extreme
quantiles and rare-length references are uncertain. Increase sampling before
gameplay calibration. There are no confidence or solvability guarantees.

## Seeds and hypothetical potential draws

`analyzeSeed(seed, prepared, baseline, options)` creates the exact core bag and
analyzes its first seven tiles. Numeric and string seeds retain their distinction.
It reports IDs, letters, blanks, rack metrics and comparisons to baseline mean,
p05 and p95 boundaries.

Actual future racks depend on commitments and exchanges. **Potential draws** are
hypothetical seven-tile windows of the untouched initial shuffle, not predicted
player racks. No tile duplicates within a sample, reshuffle or draw occurs. The
opening seven tiles are excluded. Nine default starts are:

```text
7, 17, 28, 39, 50, 60, 71, 82, 93
```

For `n > 1`, start `i` is `7 + floor(i * 86 / (n - 1))`. One sample starts at 7;
zero yields empty/unknown summaries. There are 87 distinct valid starts in a
100-tile bag; larger counts are rejected for this physical reason. Explicit
`positions` must be unique integer starts wholly within indices 7–99 and are
sorted numerically. `(start − 7) / 86` defines early (<1/3), mid (<2/3) or late
potential; unsampled phases stay empty. Defaults give three windows per phase.
Custom overlapping windows are correlated alternatives, never a sequence that
spends/reuses the same physical tiles.

`analyzeBatch` defaults to seeds `wordstead-3c1-batch:0` through `:999`. Prefix,
numeric sequence, start, count and windows are configurable. It reports opening
and pooled/phase potential distributions, per-seed mean potential distribution,
and five low/high overall outliers in each category. Ties use ASCII seed then
position. No large per-seed reports or word lists enter committed assets.

## Measured examples

Exact counts, default baseline, provisional capacity-relative metrics:

| Rack | Words | Short | Medium | Long | Overall | Longest ASCII-first spelling |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| AEIRSTN | 161 | 0.5511 | 0.6888 | 0.8985 | 0.7640 | ANTSIER |
| BCDFGHT | 0 | 0 | 0 | 0 | 0 | — |
| AAEELLS | 23 | 0.3962 | 0.4850 | 0 | 0.3445 | EASEL |
| JQXZKUV | 0 | 0 | 0 | 0 | 0 | — |
| AEIRST? | 1,214 | 0.6528 | 0.7689 | 0.9437 | 0.8270 | AIRIEST |
| AEIRS?? | 3,832 | 0.6820 | 0.7980 | 0.9559 | 0.8467 | ADMIRES |
| AEIRSTNL | 296 | 0.5338 | 0.6505 | 0.8838 | 0.7437 | ENTRAILS |
| AEIRSTNLO | 490 | 0.5416 | 0.6214 | 0.8609 | 0.7301 | ORIENTALS |

Adding tiles increases exact constructibility but can lower a score relative to a
stronger capacity baseline. Saturation compresses differences between rich racks.
Neither effect is corrected to force an intuitive ranking.

| String seed | Opening | Words | Opening overall | Mean potential overall (9 windows) |
| --- | --- | ---: | ---: | ---: |
| wordstead-2c | ELSYNME | 29 | 0.4735 | 0.3463 |
| blank-qa-636 | NATNH?C | 255 | 0.7657 | 0.4076 |
| wordstead-3c1-batch:0 | TASNSTI | 51 | 0.7054 | 0.3577 |
| wordstead-3c1-batch:1 | PTIOOTD | 24 | 0.3255 | 0.3753 |

Held-out batch openings: mean **72.937** words, median **32**, range **0–828**;
overall mean **0.4004**, SD **0.1650**, p05 **0.1625**, p95 **0.7323**. Its 9,000
potential windows: mean **75.4974** words, median **31**, range **0–3,260**;
overall mean **0.3963**, SD **0.1670**. Early/mid/late overall means are
**0.3969/0.3965/0.3955**. These small differences are observations, not evidence of
a systematic phase advantage.

Opening outliers include suffix `:177` (GQVRJDT, zero words), `:686` (AEEEAAE,
zero words despite all vowels), and `:568` (N?SRIAT, 828 words, overall 0.8185).
The highest potential sample is `:497`, start 82 (?SEDAI?, 3,260 words, overall
0.8449). All suffixes use prefix `wordstead-3c1-batch`. Blanks and accepted short
spellings matter more than a naive vowel count. Weights were not tuned after
seeing these outliers. Zero rack-only words does not prove an existing board has
no moves. These distinctions are useful enough to carry forward as separate
lexical features in 3C.2, pending board-aware validation and calibration.

## Commands and artifacts

Run from `wordstead/` with Node 22+ and no installation:

```sh
node scripts/analyze-letters.js --help
node scripts/analyze-letters.js vocabulary
node scripts/analyze-letters.js rack AEIRSTN
node scripts/analyze-letters.js rack 'AEIRST?'
node scripts/analyze-letters.js rack 'AEIRS??' --json
node scripts/analyze-letters.js rack AT --allow-short
node scripts/analyze-letters.js seed wordstead-2c
node scripts/analyze-letters.js seed 42 --numeric --positions 7,50,93 --json
node scripts/analyze-letters.js batch --count 1000 --json --output .analysis-output/batch.json
node scripts/analyze-letters.js batch --numeric --start 100 --count 25 --windows 5
node scripts/analyze-letters.js baseline --samples 10000 --baseline-seed experiment --json --output .analysis-output/baseline.json
node scripts/analyze-letters.js generate
node scripts/analyze-letters.js generate --check
npm test
```

Rack/seed/batch normally load the compatible committed baseline. `--samples`
and/or `--baseline-seed` fit a temporary replacement; unspecified settings use
fixed defaults. `baseline` always samples. `generate` rebuilds profile and notice;
`--check` compares UTF-8/LF bytes without writing. Preserve default generation
settings for committed artifacts; use `baseline --output` for experiments.
`--windows`/`--positions` and batch `--numeric`/`--prefix` are mutually exclusive.
Unknown, duplicated, missing or command-inapplicable arguments fail explicitly.
JSON has stable fields/order, versions and finite numbers, without timestamps.
Normal diagnostics do not dump word lists.

Generated [profile-v1.json](../data/letter-analysis/profile-v1.json): schema **1**,
method **`rack-lexical-v1`**, vocabulary fingerprint, bag ID/signature, vocabulary
profiles, normalization and baseline summaries; **146,863 bytes**, SHA-256:

```text
49ce77d4259056ee0b68031c2ee97b041ac8ee8be8063d8617333ee8e02ebc65
```

It contains neither the trie nor per-seed reports. `.gitattributes` preserves LF
for generated files on Windows. `.analysis-output/` contents other than its
ignore rule are local, ignored diagnostics and must stay out of public commits.

## Validation, performance and limitations

On Windows with Node **24.14.1**, `npm test` passed **208 tests**, including all
preexisting Milestone 1–3B regressions and 21 new analysis cases. They check exact
fixture statistics, multiplicity/blanks, independent full-scan agreement on nine
real racks, quantiles, finite/empty cases, immutable bags/sessions/RNG, compatibility,
CLI validation and byte-for-byte profile/notice regeneration. JavaScript syntax
and `git diff --check` passed before the PR.

Repeated generation/check and rack/seed/batch JSON matched byte for byte. Fresh
CLI observations: generation/check about **0.8 seconds**, the default 1,000-seed
batch (10,000 rack queries) about **1.3 seconds**, and a two-blank rack about
**0.2 seconds**, including preparation. A prepared-process run loaded/indexed in
**0.16 seconds**, generated the profile in **0.47 seconds** and evaluated the batch
in **1.08 seconds**. `process.resourceUsage().maxRSS` reported about **153 MiB**
for generation and **218 MiB** for the batch. These are process peak resident-memory
observations, not index-only sizes or cross-machine guarantees. Measurement timings
and memory stay outside deterministic outputs. Other Node versions were not measured.

Local browser smoke checks covered direct `/wordstead/` load/refresh, the original
78,626-word loading gate and ELSYNME opening, keyboard physical placement and
commitment of ELM (one placement, seven held tiles, 90 remaining), return navigation
to the arcade, and local startup console/resources. Embedded 390/1440 CSS-pixel
viewports check narrow/wide layout without modifying the game. These checks do not
replace physical touch, cross-engine or exhaustive gameplay QA. Homepage-to-Wordstead
navigation is unavailable because the existing homepage does not list it. No
homepage, browser runtime, score target, gameplay network dependency or rules change.

Both embedded viewports loaded seven rack slots without document-level horizontal
overflow. Their observed resources were all same-origin, with zero analysis
resources; browser console warning/error logs were empty. Narrow keyboard placement
and wide selection/cancellation also worked. The viewport harness and measurement
reports remained in the ignored local output directory.

The model ignores committed letters, cross-word restrictions, geometry, feature
positions, player vocabulary, retention/exchange choices, future sequences and
optimal play. There is no solver, board-opportunity analysis, target generation,
telemetry, persistent storage, backend or daily behavior. Counts are tied to this
dictionary; the browser still keeps its dictionary immutable during each session.

## Interface for later milestones

3C.2 can import pure `src/analysis/` APIs into development tools or consume versioned
JSON. `loadAnalysisSource()` is the Node-only verified-file boundary. Prepare once,
call `analyzeRack`/`analyzeSeed`, and use `measureFlexibility` with a baseline matching
schema, method, vocabulary and bag signature. Unsupported short calibration and
empty samples remain explicit nulls. Retain raw counts, blanks and group metrics
alongside overall so later work can inspect saturation and outliers. Version
changes to these contracts/methods.

3C.3 may combine independently measured board opportunity, lexical flexibility and
calibration parameters. This milestone adds only the lexical measurements, without
coupling them to board rules or targets.
