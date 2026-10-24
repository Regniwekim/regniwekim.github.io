# Shared daily puzzles (Milestone 4A)

Daily Puzzle is the default mode. Every player using the same game revision and
UTC date receives the same fresh farm, physical letter order, opening rack and
resolved target. Free Play retains its customizable seeds, dimensions, density,
and manual/automatic targets. The two diagnostic labs remain separate.

## Calendar and clock

Daily dates are Gregorian `YYYY-MM-DD`, years 0001–9999. Validation checks exact
spelling, month lengths and leap centuries, without parsing a date string.
`utcDailyDate(epochMilliseconds)` uses only numeric timestamps and UTC getters.
The browser supplies `Date.now()` at the UI boundary. Rollover is **00:00 UTC**,
independent of the player's locale, timezone and daylight saving rules.

There is no network time service. An incorrect device clock can select the wrong
challenge. Two devices must agree on the UTC date as well as game revision.

The page checks its clock when rendering and when explicitly entering Daily.
There are no rollover timers or notifications. An active run retains its original
date, farm, bag, drafts and target across midnight. The Daily panel shows that a
new date is available; **Start today's challenge** explicitly replaces that daily
run. Returning from Free Play resumes the older run until this action is chosen.
If the new challenge is unavailable, the older run remains intact.

## Released v1 contract

Format identifier: **`wordstead-daily-v1`**. One date has exactly one candidate;
there is no search, retry-seed sequence or selected candidate index.

| Setting | v1 |
| --- | --- |
| Board | 15 rows × 15 columns |
| Farm density | 0.08 of eligible interior cells |
| Farm weights | crop 4, livestock 2, building 2, fertile 3 |
| Letter bag | existing `wordstead-standard-100-v1` physical tiles |
| Opening rack | seven physical tiles |
| Vocabulary | `esdb-en-us-60-1e5b7d3-ws1` |
| Vocabulary SHA-256 | `724ed98404895a23d5c3db1c205aae3369c6a66f9b34b46cadb4b91f068f4532` |
| Target estimator | existing `auto-target-v1` |
| Gameplay/scoring identity | `wordstead-rules-2d-v1` |
| Farm generation identity | `wordstead-farm-2d-v1` |

The last two identifiers name the unchanged 2D rules and farm implementation for
daily compatibility; they introduce no new mechanic. These are provisional balance
settings. Daily defines literal frozen settings so changing Free Play defaults
cannot silently change daily definitions. No Daily form exposes overrides.

Seeds are the exact strings below, including punctuation and canonical date:

```text
wordstead-daily-v1:letters:YYYY-MM-DD
wordstead-daily-v1:farm:YYYY-MM-DD
```

They enter the existing type-sensitive FNV-1a/Mulberry32 shuffle contracts.
Letters and farms use independent streams, without ambient randomness or player
state. The original physical IDs, blanks and complete standard distribution remain.

## Factory and structural acceptance

`src/daily/challenge.js` provides pure APIs:

- `defineDailyChallenge(date)` validates the date and returns frozen date, format,
  seeds, configuration, estimator/vocabulary identities and rules metadata.
- `createDailySession(date, analysisOptions?)` delegates to `createTargetSession()`:
  the existing estimator resolves the target and the existing session constructor
  creates the playable rack-limited session. The returned resolved definition adds
  `resolvedTarget`; the session adds compact frozen `daily` identity metadata.
- `restartDailySession(session)` delegates to `restartTargetSession()` with the
  original resolved settings and preserves daily identity. It never reads a clock
  or re-estimates the target.

`analysisOptions` is the existing estimator's model-validation seam, used to test
unavailability. It cannot customize daily board, seeds, weights or manual targets.
All gameplay transitions, word membership, scoring, farm rewards, drafts and
exchanges still use their existing APIs. Nothing in the core reads time or DOM.

An available daily needs an available automatic estimate, positive collectible
bound, an eligible geometric scoring fence and a positive safe integer target
within the theoretical scoring bound. The existing estimator validates board and
farm configuration. Vocabulary checksum/ID and estimator method must match v1.
Failure returns `available: false`, `session: null`, a definition with
`resolvedTarget: null`, reason and readable message. The UI explains unavailability
and leaves Free Play/labs accessible. There is **no target-1 fallback**.

These checks reject obvious structural failures, not impossible word puzzles.
The rectangle model does not solve words, connections, physical draws or player
choices. Targets are analytically calibrated, without human completion-rate data;
actual difficulty varies and solvability is not guaranteed. No solver is added.

## Sessions, retries and results

`ui/daily-mode.js` owns only clock selection and available daily creation. Calling
`today()` cannot change its current definition. Only `startToday()` creates a new
date, retaining the previous definition if generation is unavailable.

`ui/sandbox.js` owns four distinct in-memory sessions: `daily`, `rack` (Free Play),
`words`, `freeform`. Daily and Free Play each own committed board, bag, rack, RNG,
target, draft, dictionary and view selection. Switching cancels transient gestures
and reconstructs the active preview, without transferring draft tiles or mutating
the other run. Diagnostic fixtures reset Free Play only; they cannot replace Daily.
Display cell size is shared presentation and cannot affect any rules or generation.

Restart is a fresh attempt at the **active date**, even after UTC midnight. It
restores the same ordered tiles, farm and target and clears all commitments,
claims, exchanges and drafts. Reloading instead starts the device's current UTC
date. Unlimited retries are allowed; results are never verified first attempts.

`getSessionResults()` includes only date/format identity in addition to the existing
terminal snapshot. `formatResultsShare()` adds `Daily Puzzle · YYYY-MM-DD · v1`
after WORDSTEAD for every Daily result, distinguishing incompatible revisions
without long checksums. The UI and Copy Results use this one formatter. Actual
points, words and free/charged exchanges retain the original calculations. Shares
contain no played words, positions, future tiles, seeds or solutions. Free Play
share text remains byte-for-byte unchanged and makes no same-challenge claim.

There is no localStorage, IndexedDB, cookie, account, save, streak or attempt history.
**Refresh loses unfinished progress.** Reproducible initialization is not progress
persistence. All requests are ordinary same-origin static resources; GitHub Pages
is sufficient. Local progress and history remain outside 4A.

## Compatibility and released-definition policy

A format label is a contract, not an engine archive. Arbitrary dictionary, bag,
shuffle, farm, acceptance, scoring or estimator updates can change old puzzles,
targets or the words a player may use. Current source cannot promise that every
old date remains identical after arbitrary future engine updates.

Before changing any dependency of a released daily:

1. Run the complete tests and compare the released calendar fixtures. Investigate
   differences; never regenerate fixtures merely to make a failure disappear.
2. Keep v1 generation and gameplay behavior unchanged for compatible releases.
   Cosmetic/documentation edits may retain the identity when behavior is unchanged.
3. For incompatible behavior, introduce a new daily format and appropriate rules,
   vocabulary/generator/model identities, with separate fixtures. Never reuse v1
   share IDs for changed challenges. Reject unsupported revisions explicitly.
4. If older challenges must remain playable, retain their compatible engines,
   vocabulary and target data, or serve a separately frozen static release. A date
   and seed alone cannot reconstruct removed engine versions. Historical engine
   dispatch and an archive browser are not implemented in this milestone.

`tests/fixtures/daily-v1.json` pins seven dates across year/month boundaries and
leap day: 2023-12-31, 2024-01-01, 2024-02-28/29, 2024-03-01, 2026-10-23/24.
Each records both seeds, physical opening IDs, row-major feature signature, target,
format and SHA-256 of the full initial session (including the entire remaining bag
and RNG). These regression fixtures protect released initialization; existing
gameplay/dictionary tests protect rules and scoring. They are development records,
not downloaded archive data or a human difficulty guarantee.

## Reproduction and QA

From `wordstead/`, Node 22+:

```sh
npm test
node --test tests/daily.test.js tests/daily-ui.test.js
node --input-type=module -e "import {createDailySession} from './src/daily/challenge.js'; console.log(createDailySession('2024-02-29'));"
```

The last command is development-only explicit-date access; the ordinary UI offers
no date picker or future-date control. For browser QA, use the README's static
server and open `/wordstead/scripts/daily-qa.html`. Supply a canonical date, choose
390 or 1440 CSS pixels and load the challenge. The separate page injects a clock
at 23:59:59.999 UTC into the real controller, loading the same markup, vocabulary
and runtime modules. The QA advance button moves that clock by one day.

Place a draft or commit a word, advance the QA clock, switch modes, and verify the
active date/target/progress remain until Start today's challenge is activated.
Restart before starting the newest date must repeat the older puzzle. Repeat at
both widths; inspect direct load/refresh, custom-setting isolation, both labs,
keyboard and pointer placement, results/copy and browser console/network behavior.
Real-device touch and other browser engines require separate manual QA.

## Validation performed for 4A

`npm test` passed **263 tests** (252 existing plus 11 daily cases). Affected JS
and the QA page's module passed `node --check`; target coefficients and letter
analysis artifacts passed their existing byte-for-byte `--check` commands.
`git diff --check` passed.

Local Chromium checks covered direct `/wordstead/` loading and refresh, identical
opening IDs/target after restart and reload, keyboard commitment of NEW on the
device-selected 2026-10-24 daily, mode switching with that word retained, custom
7×9 Free Play with manual target 37, word-lab commitment, freeform editing and the
arcade return link. The QA page reproduced the 2024-02-29 opening IDs and target
11 at both 390/1440 widths, without document horizontal overflow. Advancing its
clock to March 1 retained a physical draft and target 11; restart kept February 29,
and explicit Start today's challenge selected March 1/target 13. Both pages'
captured warning/error logs were empty.

Ended-run results showed the correct date/revision and spoiler-free totals at
desktop and narrow widths. Copy Results resolved and displayed success; the
in-app browser's separate clipboard inspection returned empty text, so OS-level
clipboard contents were not independently verified. Automated controller tests
did verify the exact text passed to the Clipboard API, and existing tests cover
denial/unavailable fallback. No complete canonical daily was played to victory in
the browser; daily-tagged wins use unchanged farm fixtures in automated tests.
Physical touch and cross-engine testing were not performed. The unchanged arcade
homepage has no Wordstead card, so homepage-to-game navigation remains unavailable.
