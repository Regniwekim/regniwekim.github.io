# Personal Daily history (Milestone 4B.2)

History is a private, browser-local archive of terminal Daily Puzzle summaries.
It observes play without controlling it. Unlimited retries, targets, bag order,
points, strokes, dictionary, Copy Results and active-save schema 1 are unchanged.
Free Play, both labs and scripted fixtures do not enter this archive. There are
no accounts, network services, telemetry, rankings, grades, percentages or streaks.

## Schema, identity and compatibility

The independent key is **`wordstead.history.daily.v1`**. It stores exactly
`{ schemaVersion: 1, records: [...] }`. Each record has exactly these fields:

```js
{
  schemaVersion: 1,
  date: '2024-02-29',
  formatVersion: 'wordstead-daily-v1',
  rulesVersion: 'wordstead-rules-2d-v1',
  status: 'won', // or 'ended', 'exhausted'
  totalPoints: 13, target: 11,
  basePoints: 12, cropPoints: 0, fertilityPoints: 1,
  wordCount: 4, exchangeCount: 24, freeExchangesUsed: 0,
  chargedExchanges: 24, strokes: 28,
  captured: { crops: 0, fertile: 1, livestock: 0, buildings: 0 }
}
```

`persistence/daily-history.js` is pure. `createHistoryRecord()` derives these
fields from the authoritative terminal session, `getSessionResults()` and the
existing `getStrokes()`. Records contain no words, placements, tile IDs, board,
bag, seeds, draft, action history, dictionary, identifiers or mutable lifetime totals.
The archive is a summary, never a second active save or a replay format.

Identity is **canonical UTC date + Daily format version**. The same date in two
formats has separate records, shown together when selecting that date. There is
at most one primary record per identity. A recorded `won` always keeps its original
statistics, including after another completion or an unsuccessful retry. Without
a recorded completion, a later terminal result replaces the earlier result; a win
upgrades it. The preserved completion is not evidence of a first attempt, a best
score, or competitive verification. Players control their browser data.

Dates use existing Gregorian validation, years 0001–9999. Record and archive
schemas must be 1, statuses must be terminal, fields must have exact shapes and
all metrics must be nonnegative bounded safe integers. Validation checks score
components against captures, captured totals against base territory, free credits
against buildings/exchanges, charged exchanges and **strokes = words + charged
exchanges**, and win status against target. Bounds allow at most 900 territory
cells/features, 4,500 points/target, 100 accepted placements, 1,000,000 exchanges
and 1,000,100 strokes. These are summary validation limits, not new game rules.

Only `wordstead-rules-2d-v1` scoring summaries are supported. Bounded format labels
`wordstead-daily-v1` through `wordstead-daily-v9999` are retained separately when
they use these same scoring rules; this does not enable generation or replay of
other formats. Production capture still accepts only the currently released Daily
format. Unknown scoring rules or schema versions make the archive unusable until
explicit recovery; no migration or silent relabeling occurs. Incompatible future
rules need reviewed summary compatibility/migration. Engine removal need not erase
compatible summaries because viewing them does not load a challenge or dictionary.

Records serialize in ascending date/format identity order. Duplicate identities,
unknown fields and malformed values are rejected before publishing any records.
No stored string is interpreted as HTML or executable code; the UI uses text nodes.

## Recording, restoration and clearing

The controller observes accepted Daily word, exchange and explicit end actions.
Only the resulting terminal session is recorded: `won`, explicit `ended`, or
empty-rack-and-empty-bag `exhausted`. Drafts, previews, rendering, clock rollover,
abandoned pages, restart and replacing yesterday's unfinished save do not record
anything. No failure is fabricated for an old unfinished attempt.

History capture and active-save writes are independent. A failure in one leaves
the other operational and cannot reject an already accepted gameplay action.
Saving the same summary again is idempotent; unchanged data does not call
`setItem()`. A terminal panel acknowledges success only when history storage has
succeeded or the compatible stored record is already present. A preserved earlier
completion is described explicitly, without claiming to store the replay's totals.
Write failures warn in the panel and History, with an explicit save retry while
that terminal session remains available. Reload history first for access denial
or conflicts; quota failures can also be retried directly after capacity recovers.

**Restoring a terminal active save never automatically writes history.** Existing
records remain visible. A terminal run missing from history, including a pre-4B.2
run or a previously failed write, offers **Save to Daily History**. This is an
explicit opt-in recovery action. It also prevents cleared results from immediately
returning on render, refresh, active-save reload or mode switching.

**Clear Daily History** uses the native confirmation dialog. The message explains
that deletion cannot be undone through Wordstead, leaves active Daily/Free Play
saves intact, and keeps the current board. Cancel/Escape keeps history. Confirmation
removes only the history key, including unusable bytes; it never calls
`localStorage.clear()`. A new qualifying terminal event or explicit Save to Daily
History is required to add a result again. Clearing a corrupt archive does not
silently restore old records from active saves.

## Size, corruption and storage failures

The archive is limited to **4,096 distinct challenge identities** (over eleven
years at one format/day) and **2,097,152 UTF-16 code units** of serialized JSON.
Typical records are roughly 400 characters. This keeps growth modest while
leaving room for the two active saves within common browser quotas; actual browser
limits vary. Duplicate retries cannot grow the archive. No old results are pruned
automatically. At the record/payload limit or a browser quota failure, the existing
stored bytes remain and the new result is reported unsaved. Existing completions
can still be acknowledged without a write when an archive is full.

`persistence/history-storage.js` injects storage access and has no import-time
browser access. Missing storage is empty history. Invalid JSON, unsupported versions,
incompatible rules, malformed records and oversized payloads show a warning and
block writes. Original bytes are retained until the player explicitly clears them.
Denied access and quota errors leave play and active-save restoration available.
History warnings hide calendar/totals that cannot be represented as current stored
data. **Reload stored history** safely rereads only history and never replaces a
game session. After recovery, retry the terminal result explicitly.

## Statistics and calendar

Statistics are recalculated from validated primary records. The completed count
uses `won`; the unfinished/exhausted count uses `ended` and `exhausted`. Total words,
strokes, points and captured features use completed records only. Captured features
sum crops + fertile cells + livestock + buildings. Word/stroke averages divide those
totals by completed record count. With no completions the model returns `null` and
the UI displays **—**, with a neutral explanation. Display averages round to one
decimal; model averages retain their numeric precision. No independent totals persist.

A missing date means **no recorded result**, not an attempt or failure. It supplies
no denominator, completion percentage or streak. Distinct formats count as distinct
recorded challenges. All totals describe local records only.

History is a collapsible section above play, accessible in every mode; the board
remains the primary experience. The Sunday-first month uses Gregorian UTC dates,
leap-century rules and correct weekday alignment, including years 0001–0099.
Previous/next browse within years 0001–9999 without creating or loading sessions.
Completed days show **✓**, unfinished/exhausted days **◦** and a dashed border;
unmarked dates are neutral. Every date is a labeled native button supporting
Tab and Enter/Space, with a visible selected state and focus outline. Month controls
also have explicit accessible names. Targets are at least 44 CSS pixels; very narrow
calendars scroll internally instead of shrinking targets or widening the page.

Selecting a date shows each format's status, achieved points/target, accepted word
placements, strokes, free/charged/total exchanges, score components and feature
counts. It does not contain played words or reconstruct a farm. Results' View Daily
History opens this section explicitly, moves focus to its summary and scrolls there.
Ordinary completion never moves focus or opens History automatically.

## Multiple tabs

The adapter retains exact observed bytes. A relevant `storage` event (including
removal/clear) checks the key, and every write checks it again immediately before
serializing/writing. Changed bytes pause history writes and offer Reload stored
history. Nothing is merged silently, and reloading does not automatically submit
the current terminal result. Delayed events matching observed bytes are harmless.

Clear captures bytes before confirmation and rechecks them afterwards. An intervening
change cancels deletion and exposes the conflict. Active-save conflict handling stays
separate. This is conservative detection, not synchronization: localStorage has no
atomic compare-and-swap. Two writers can still race between the final read and write,
and identical bytes can conceal an intervening change. Use one tab for reliable play.

## Privacy and limitations

History stays on the current origin, browser/profile and device. It is not synchronized,
permanent or backed up. Clearing website data, browser eviction or closing a private
session can remove it. No export/cloud backup is added. Static resources still need
to be available for page loading; this milestone adds no offline cache. An incorrect
device clock can select the wrong challenge. Historical boards/replays, past challenge
picking and historical Free Play are outside scope. Browser data is editable and
does not prove first attempts or authentic competitive submissions.

## Reproduction and QA

Run from `wordstead/`:

```sh
npm test
node --test tests/personal-history.test.js tests/daily-ui.test.js
```

Model/storage tests cover schema, accounting, retries, dates/formats, sorting,
serialization, statistics, Gregorian months, limits, failure recovery, isolated
deletion and conflicting writers. Real-controller tests restore a legal production
Daily with a prepared final draft, accept its last word, and verify archive capture,
Copy Results, refresh, retry/upgrade, another date, independent failures, clearing,
and exclusion of Free Play, fixtures, labs and abandoned unfinished saves. A controlled
full-bag fixture with an injected dictionary tests exhaustion summaries/storage;
it is not an ordinary canonical Daily or human playtest.

Serve the repository root with `python -m http.server 8000 --bind 127.0.0.1`.
Use `/wordstead/` for direct load/refresh and `/wordstead/scripts/daily-qa.html`
for reproducible 390/1440px and UTC-clock checks. All QA saves/history use the
**`wordstead.qa.`** prefix. Choose **2024-02-29** or **2026-10-23**, then **Prepare
fixed completion draft for chosen date**. This explicitly replaces only the QA
Daily save with fixed known-word/exchange observations from persistence QA. The
fixture remains playable until **Commit word** accepts the last draft, giving a
normal terminal event through the real controller. It is not a solver or ordinary
human completion. Finish both dates to inspect cumulative totals and month browsing.

Check refresh, restart/replay ending, newest-date replacement, keyboard date selection,
Copy Results and both widths. **History access denied** and **History quota exceeded**
simulate history-only failures while saves work. **Corrupt QA Daily history and
reload** tests retained bytes, warning and confirmed clearing. Open two copies of
the QA page, write/end in one, and check the other's conflict/reload/retry. Clear
history with a terminal run loaded, refresh, and check it stays empty until explicit
save. Active saves and the board must remain intact. Test all diagnostic modes,
browser logs, same-origin resources and the arcade return link. Physical touch,
other browser engines, assistive technology and OS clipboard contents require
separate manual checks; automated fixtures do not establish human difficulty.

## Validation performed for 4B.2

`npm test` passed **302 tests** (284 existing and 18 new history/controller cases).
All nine affected JavaScript files and the QA page's inline module passed syntax
checks. `git diff --check` passed. The released seven-date Daily v1 fixture blob
matches `origin/main`; core rules, result/share formatter, active-save schema and
active-save adapter are unchanged. Source/import review found no new runtime
service, external request or dependency.

Local Chromium checks completed both automated fixed Daily observations through
the actual Commit button: February 29 scored 13/11 with 4 words and 28 strokes;
October 23 scored 15/12 with 4 words and 37 strokes. History showed 2 completed
challenges, 8 words and 65 strokes. Refresh retained the record; a confirmed restart
and explicit unsuccessful replay retained the original completion. Explicit newer-date
replacement kept the older record. These are controlled fixtures, not human playtests.

The browser checks also covered neutral empty history, selected-date detail, UTC
leap-February/month navigation, Enter selection and Tab focus, Copy Results success,
two live tabs detecting/reloading changed history, history-only denied access/quota,
corrupt-data warning/recovery, and cancel/Escape/confirmed clearing. Results and
active saves remained usable throughout; clearing followed by reload stayed empty
until explicit saving. Both 390px and 1440px iframe views were inspected with no
document horizontal overflow. The final narrow calendar fit all seven columns,
with 45×44px date buttons. Direct `/wordstead/` loading, refresh and arcade return
navigation worked. Both labs and scripted rack/crop modes remained accessible;
the automated suite covers all farm fixtures and history exclusions. Captured
browser warning/error logs were empty.

An independent fresh browser profile, physical touch, other engines, screen-reader
software and OS clipboard contents were not tested. The existing arcade homepage
still has no Wordstead card, so homepage-to-game navigation was unavailable.
The multi-tab read/write race described above remains a localStorage limitation.
