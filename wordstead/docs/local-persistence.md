# Local save and resume (Milestone 4B.1)

Daily Puzzle and Free Play each autosave one active attempt in `localStorage`.
After the pinned gameplay dictionary loads, both slots are validated and replayed
before the first board is rendered. Daily remains the initial visible mode; choose
Free Play to resume its independent run. No account, network service, analytics,
statistics, streaks, archive, cookies, IndexedDB or runtime dependency is added.

## Format and compatibility

Storage keys are `wordstead.save.daily.v1` and `wordstead.save.free.v1`. Each value
is JSON with exactly two fields: `{ revision, save }`. `revision` is a fresh opaque
write token (a browser-generated UUID); it is not a trusted timestamp or score.
The nested save uses **schemaVersion 1**:

```js
{
  schemaVersion: 1,
  mode: 'daily', // or 'free'
  identity: { /* bag, shuffle, rules, farm generator, vocabulary ID/checksum */ },
  daily: { date: '2026-10-23', formatVersion: 'wordstead-daily-v1' }, // null for Free Play
  configuration: {
    rows: 15, columns: 15, seed: 'wordstead-daily-v1:letters:2026-10-23',
    farmSeed: 'wordstead-daily-v1:farm:2026-10-23', farmDensity: 0.08,
    farmWeights: { crop: 4, livestock: 2, building: 2, fertile: 3 },
    target: 12,
    targetSelection: { /* original mode, resolvedTarget and estimator identities */ }
  },
  actions: [],
  draft: { tiles: [] }
}
```

`SAVE_IDENTITY` includes `wordstead-standard-100-v1`, starting rack 7,
`fnv1a-mulberry32-fisher-yates-v1`, `wordstead-farm-2d-v1`,
`wordstead-rules-2d-v1`, and the pinned ESDB ID and SHA-256. Automatic selection
also preserves `auto-target-v1`, `board-rectangles-v1`, `rack-lexical-v1` and
`rack-regression-v1`. Manual selection preserves its exact resolved integer and
null estimator method. Seed types are retained: numeric and textual seeds differ.

Daily recovery calls `createDailySession(savedDate)`. Its canonical configuration,
format, supported date, identities and expected integer target must match the save.
Free Play calls the unchanged integer `createSession()` with its original board,
letter/farm seeds, density, all four weights and target, then restores validated
target-selection metadata. An automatic Free Play target is **never re-estimated**
on resume. Restart keeps the existing deterministic reconstruction APIs.

There are no migrations in schema 1. Unsupported schemas or incompatible rules,
vocabulary, generators or target versions are rejected with an explanation, and
the original bytes are retained. Future incompatible releases must explicitly
retain the corresponding engines/data or introduce a reviewed migration and
new identities; relabeling an old action history is insufficient. Released Daily
v1 fixtures must not be regenerated to accommodate persistence.

## Action history and draft recovery

`src/persistence/history.js` is pure. It records only accepted transitions:

- `word`: the complete normalized `{ word, row, column, orientation }` proposal
  and exact `{ tileId, row, column, letter, assignedLetter }` allocations returned
  by the authoritative commitment. Repeated letters remain distinct; chosen blanks
  cannot be replaced by ordinary matching tiles during replay.
- `exchange`: the exact selected physical tile IDs.
- `end`: explicit ending of an unfinished run.

Recovery invokes `commitSessionWord`, `exchangeTiles` and `endSession` in order
with the same loaded gameplay dictionary as normal play. Each action must pass
current geometry, word membership, tile ownership, resources and terminal checks.
No partial session is published if any action or draft fails. Remaining bag order,
RNG state, committed letter provenance, claims, rewards, capacity, free/charged
exchanges, score, counters and status all derive from those transitions. The save
contains no board/claim snapshot, vocabulary, graphical copy, or separate result.
Won, exhausted and explicitly ended sessions retain their final boards and normal
result panels/Copy Results after reload; they cannot accept another action.

The draft array preserves placement/movement order for Undo, physical IDs, letters,
blank assignments and logical coordinates. Recovery checks rack ownership, unique
IDs/positions, bounds, empty cells, reserved features, native letters and blanks.
`DRAFT_GAP` remains valid unfinished intent after arbitrary returns; dictionary or
commit readiness is not required. Branches/diagonals, collisions, foreign tiles
and drafts in terminal sessions are rejected. Selection, gestures, pointer capture,
blank dialogs, exchange selections, hover, clipboard operations and view position
are reset. The first view uses the normal starting-square cursor without forcing
focus or scrolling.

Input is bounded before replay: at most **262,144 UTF-16 code units** for the entire
stored envelope, **1,000 accepted actions**, **256 code units per textual seed**,
1–30 rows/columns, word proposals of at most 30 letters, and at most nine draft,
allocation or exchange entries. Nested field shapes, types, finite weights/density,
positive safe-integer targets and known physical ID ranges are checked. These
limits bound work; they do not change the core's wider construction contracts.
Runs outside persistence limits remain playable and display the save warning.

Validation supports reliable recovery, **not competitive verification**. The player
controls localStorage, and can edit a legal history or repeat an attempt. A restored
share is not proof of a unique or legitimate competitive submission.

## Writes, replacement and failures

The controller saves synchronously after successful commitments, exchanges, explicit
ending, draft placements/moves/returns, Undo, Clear, blank reassignment and creation
or restart of a production attempt. Draft input publishes only successful model
changes; rejected drops, previews, selection, panning and cosmetic renders do not
write. There is no debounce or dependency on unload/pagehide. Save success is shown
only after `setItem()` succeeds.

One slot per mode means a new run replaces that mode's attempt. Progress (a word,
exchange, terminal status or draft) triggers a native semantic confirmation dialog
before restart/new-puzzle/date replacement. Untouched fresh attempts need no extra
confirmation. Cancel and Escape preserve progress. A Daily from an earlier UTC date
automatically resumes with its original date and an explicit explanation that
**Start today's challenge** discards the single Daily save. Midnight itself never
changes status or replaces progress. Failed daily generation preserves the active run.

Labs never enter persistence. Scripted rack/farm fixtures have no save history and
cannot replace the legitimate Free Play slot. The controller retains the production
Free Play session in memory too, with a Resume Free Play control while inspecting
a fixture (even if storage failed). A conflict instead offers Reload saved version.
Creating a production puzzle from a fixture still confirms replacement
when the retained production run has progress.

`src/persistence/storage.js` injects storage access and write tokens for testing.
Denied/unavailable storage, quota and serialization errors become accessible warnings;
gameplay continues, retaining its in-memory run. A later successful write clears the
warning. Failed writes leave the last saved version, which may be older than the
current run. Corrupt/incompatible data blocks writes for that slot until the player
explicitly discards it. Discard has its own confirmation and removes only that key,
then saves the playable current attempt. The other mode and unrelated origin data
are never cleared. Loading failure cannot partially replace either active session.

## Multiple tabs

Each slot remembers the exact storage bytes it observed. The controller listens
for `storage` changes (including removal/clear), and the adapter also re-reads the
slot immediately before every write to catch missed/delayed events. Different bytes
pause autosaving for that mode and show **Another tab changed this save**. The player
can continue in memory, resume the saved version (confirming loss of local progress),
or explicitly replace it with this run. Replacement/discard captures the current
bytes before confirmation and checks them again afterwards; an intervening change
cancels the operation and retains the conflict warning. A delayed event matching
already-observed bytes does not produce a false conflict.

This is conservative conflict detection, not synchronization or merging.
`localStorage` has **no atomic compare-and-swap**: two tabs can still race between
the final read and write. Write UUIDs reduce identical-value ambiguity but cannot
make this transactional. Use one active tab for reliable ordinary play.

## Privacy and reproducible QA

Saves remain in the current browser profile, origin and device. Another browser,
device, private session or origin does not share them. Clearing site data, browser
eviction or private-session closure can remove them. Offline reload still requires
the existing static resources/dictionary to be available; no offline cache is added.

Run `npm test`, including `tests/persistence.test.js` and the real-controller tests
in `tests/daily-ui.test.js`. Full session comparisons cover a completed released
Daily using a fixed known-word fence and ordinary exchanges, a seeded Free Play
victory, manual ending, controlled-dictionary exhaustion, all four generated farm
rewards, bag conservation/RNG, reused letters/cross-words, blanks, drafts, invalid
inputs, slot isolation, failures and stale/conflicting writes. Tests inject storage;
they do not require a browser or a new package.

Serve the repository root with `python -m http.server 8000 --bind 127.0.0.1`.
Use `/wordstead/` for normal refresh/reopen, terminal results, fixtures/labs and
two-tab checks. `/wordstead/scripts/daily-qa.html` reuses the real controller with
an explicit UTC clock and 390/1440px views. QA slots have the **`wordstead.qa.`**
prefix and cannot overwrite normal saves. Place a draft before midnight, advance
the clock, then load the next date: the old date/draft should resume until explicit
replacement. Storage options simulate denied access/quota; the corrupt-QA-save
button tests retained failure and explicit discard. These controls are absent from
ordinary play. Real-device touch and other browser engines require separate QA.

## Validation performed

`npm test` passed **284 tests** (263 previous cases plus 21 new cases, with the
existing controller cases updated for destructive confirmation). All six affected
JavaScript files and the QA page's inline module passed `node --check`.
`git diff --check` passed. The released seven-date fixture file has the same Git
blob hash as `origin/main`; no fixture, rule, scoring or target coefficient changed.

Local Chromium checks covered keyboard placement/commitment of NEW in the active
Daily, refresh with the same word/rack IDs/bag count, a saved pending Daily tile,
and independent 7×7 Free Play using `blank-qa-636`, density 0 and manual target 37.
A blank assigned O survived reload with no open dialog/selection; reassignment to
A, CAT commitment and a tile exchange survived the next reload. Explicit ending
restored the same final board, result text, disabled gameplay and Copy Results
success. Escape canceled restart; confirmed restart restored the original rack,
target and zero counters. Closing both test tabs and opening a new tab restored
progress. The browser process itself was not restarted.

Two live tabs detected a changed Free Play slot, paused writes during further
local draft edits, reloaded the saved version after confirmation and warned the
other tab after explicit replacement. The 390px controlled-clock view retained
the February 29 draft/target 11 on crossing midnight and reloading with March 1;
confirmed replacement started March 1/target 13. Simulated denied storage and
quota both allowed draft placement while warning; malformed data exposed explicit
discard, which restored saving. A 1440px QA view loaded restored progress, and the
1265px main page had matching document/client width with no horizontal overflow.
The narrow replacement dialog was visually inspected and its controls fit.

Both diagnostic labs remained usable. The scripted building fixture captured its
feature after CAR/CAB/RAT/BAT and used a free exchange (zero charged exchanges);
refresh returned the legitimate Free Play target/draft. The arcade return link
worked. Captured warning/error logs in the main and QA tabs were empty. Source
and import inspection found no new runtime service, external request or dependency.
There is still no Wordstead homepage card, so homepage-to-game navigation was not
available. Full victory/exhaustion and seeded farm reward restoration were tested
in Node; the browser terminal observation was an explicitly ended run. Physical
touch, other engines, screen-reader software and OS clipboard contents were not
independently tested.
