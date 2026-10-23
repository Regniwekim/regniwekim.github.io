# Milestone 3A validation

Executed October 23, 2026, for vocabulary `esdb-en-us-60-1e5b7d3-ws1`.

## Automated and source checks

- `npm test`: **167 passed, 0 failed**, including all existing Milestone 1–2D
  cases and 16 new vocabulary/loading/gameplay cases. No test dependencies added.
- `node --check` on affected JavaScript, including generator, benchmark, parser,
  loader, manifest, startup, controller and new tests: passed.
- Pinned upstream README, Copyright, CLI/filter code and database builder reviewed.
  The explicit generated-word-list permission, applicable notice scope and full
  retained text are documented in [vocabulary policy](vocabulary.md).
- Regenerated from the pinned clean ESDB checkout, then independently ran
  `node scripts/generate-vocabulary.js --source <checkout> --check`: all four
  generated outputs matched byte for byte.
- Node independently verified accepted count **78,626**, artifact size **750,727
  bytes**, manifest/report agreement, notice hash and artifact SHA-256:
  `724ed98404895a23d5c3db1c205aae3369c6a66f9b34b46cadb4b91f068f4532`.
- `git diff --check`: passed. Changes are limited to `wordstead/`; no unapproved
  art, private originals, source database, build dependencies or hosting changes.

## Browser checks

Served the repository root with `python -m http.server 8000 --bind 127.0.0.1` and
loaded `/wordstead/` directly in headless Microsoft Edge **155.0.4283.62**, using
an already available development Playwright installation outside this repository.
No browser framework, packages or generated QA screenshots were added to the game.

Checked **1440×1000 desktop** and **390×844 touch viewport**:

- Artificially delayed the vocabulary response: loading status remained visible,
  game stayed inert, Canvas could not receive focus, and no rack or blank controls
  were created until successful preparation.
- Exactly one successful vocabulary request per page, one prepared dictionary
  object/promise, nine physical rack buttons (only capacity visible) and 26 blank
  choices. Mode changes, previews, commits, restarts and new puzzles did not fetch
  or parse the list again.
- Normal word lab accepted APPLE, GARDEN and HARVEST, all absent from the old demo
  list. Repeated previews left count unchanged. HARVEST committed with the browser
  context offline after loading. Normal physical rack play accepted CHAT using
  the repeatable `blank-qa-636` rack; restart restored its original rack.
- QZX rejected; valid BAR with invalid complete perpendicular words rejected as
  a whole; the CAT → AT → TO sequence checked both separate TO cross-word
  occurrences and counted the last move once.
- Specific blank selection, O assignment, A reassignment and CAT commitment kept
  the ordinary A in the rack and retained permanent blank provenance on the board.
- Scripted rack CAR/CAB/RAT/BAT produced four words, one territory point and
  victory. All crop/fertile/livestock/building fixtures completed through the UI:
  scores 4/2/1/1, livestock capacity eight, building credit spent without a stroke.
- Independent freeform edit and mode restoration; explicit QA vocabulary labels;
  creating a fresh puzzle restored ESDB. The original unrestricted word-lab QA
  CAR/CAB/RAT/BAT example also produced four words and one point.
- Keyboard tile placement, native mouse drag/clear and native touch tap placement
  worked. Layout had no document-level horizontal overflow. Inspected desktop
  and narrow screenshots; readable loading/version text and existing rack layout
  were preserved.
- Credits page, full license notice, return link to `/index.html`, direct game
  loading and refresh worked; crawler metadata remained `noindex, nofollow`.
- No browser page errors or console/network errors during ordinary successful runs.
  Separate deliberate HTTP 503, network abort and incorrect-integrity responses
  displayed failure feedback with an inert/uninitialized game. Each successful
  retry created one set of controls, with two attempts total. Those intentional
  request failures are excluded from the ordinary-run error check.

## Measurements

Three fresh browser contexts per configuration, same local HTTP server, no response
interception or network throttling for these measurements. Mobile is desktop-hosted
touch/viewport emulation with **4× CPU throttling**, not physical phone hardware.
Timings are observations, not performance guarantees.

| Measurement | Desktop median (range) | Phone viewport, 4× CPU median (range) |
| --- | ---: | ---: |
| Parse/validation + private Set preparation | 36.5 ms (33.3–39.0) | 148.3 ms (139.4–149.9) |
| Fetch through prepared dictionary | 51.4 ms (45.3–139.9) | 264.6 ms (249.4–272.4) |
| 100,000 representative synchronous lookups | 8.5 ms (8.3–8.6) | 34.9 ms (34.7–37.5) |
| Mean per lookup, from median batch | 0.085 µs | 0.349 µs |

Lookup samples cycle through `garden`, `HARVESTING`, `ox`, `APPLES`, `QZX`, `CAT!`,
`WALKED`, `CHILDREN`; each batch returned **75,000 true** and 25,000 false results.
This includes normalization, valid words and invalid strings, rather than timing
only direct uppercase Set access. Reproduce Node timing with
`node scripts/benchmark-vocabulary.js`: one observed run prepared in 33.85 ms
and completed 100,000 lookups in 10.33 ms (0.103 µs/lookup).

The artifact is **750,727 bytes / 733.13 KiB**, including notices.
`PerformanceResourceTiming` reported **750,727 encoded-body bytes**, **750,727
decoded-body bytes**, and **751,027 transfer bytes** in every fresh context. The
browser transfer figure includes its reported 300-byte response overhead. Python's
server did not compress the body. GitHub Pages production transfer/compression
was not measured because this branch has not been deployed. No custom compression,
cache layer or service worker was introduced.

## Limits

Physical-device scrolling, touch drag negotiation, iOS/Safari and other browser
engines were not tested. Existing Pointer Events Node regressions passed, but
emulation does not replace real-device QA. Offline page reload is not implemented;
only an already loaded page was tested offline. No production deployment, puzzle
solver, solvability guarantee or game rebalance was performed.
