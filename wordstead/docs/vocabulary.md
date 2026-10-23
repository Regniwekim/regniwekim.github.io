# Gameplay vocabulary: Milestone 3A

Normal rack play and the unrestricted word lab use **ESDB American English 60**,
version **`esdb-en-us-60-1e5b7d3-ws1`**, containing **78,626 entries**. This is a
spell-checking English word list, **not an official Scrabble dictionary**.
The core placement, draft, rack, farm, territory and scoring rules are unchanged.

## Source and redistribution

- Upstream: [English Speller Database, formerly SCOWL](https://github.com/en-wl/wordlist).
- Pinned commit: [`1e5b7d3a72f47a71da5d28686c1dd4b397178485`](https://github.com/en-wl/wordlist/tree/1e5b7d3a72f47a71da5d28686c1dd4b397178485).
- Reviewed the pinned `README.md`, `Copyright`, extraction CLI help, query/filter
  implementation and `Makefile`/`combine.py` before extraction.
- [Full upstream Copyright](../licenses/esdb/Copyright) is preserved with LF line
  endings, including the copyright, permission, disclaimer and acknowledgments.
- The MIT-like notice explicitly permits use, copying, modification, distribution
  and sale of generated word lists without fee. Copyright must appear in copies;
  copyright and permission must appear in supporting documentation. The served
  text file embeds the full first section as comments. The browser's
  [credits page](../vocabulary/index.html) links the full notice and reproduces
  the copyright and permission. Keep these together when redistributing.
- Upstream says the first section suffices for non-Australian speller exports.
  Its additional Australian notice applies to `D` spelling / `AU` region exports,
  UKACD to generated lists larger than size 80, and possible WordNet obligations
  to other database results. This is an `A`/neutral, `US`/neutral, size-60 generated
  word list; those additional scopes are not used. The entire notice is retained
  for clarity, without claiming their terms govern Wordstead code or private art.
- Kevin Atkinson and contributors maintain ESDB. Alan Beale deserves special
  credit for public-domain 12dicts, contributions to ENABLE2K and feedback.
  ESDB's notice also explains its permitted use of COCA-derived data. We distribute
  the permitted generated list, not raw COCA data or the SQLite/source database.

No proprietary tournament list, commercial word-game scrape or unlicensed mirror
is used. Existing Sprout Lands notices and private asset boundaries are unchanged.

## Extraction and acceptance policy

The exact arguments are tracked in `scripts/vocabulary-source.js` and
[`generation.json`](../vocabulary/generation.json):

```sh
python -X utf8 scowl --db <temporary-db> word-list 60 A 1 --categories= --wo-poses=abbr --wo-pos-classes=person,surname,place,name,name?,upper,upper?,demonym,trademark,abbr,abbr? --wo-pos-categories=nonword,special,wordpart --no-word-filter
```

`A` includes American and neutral spellings, with American/neutral regions.
Size 60 and variant level 1 follow upstream's default American spell-checking
recommendation. `--categories=` retains the ordinary empty category, excluding
special lists such as Roman numerals and programmer slang. POS/category filters
remove tagged abbreviations, names (including tentative tags), demonyms,
trademarks, nonwords and word parts. No usage-note/censorship filter is applied.

`--no-word-filter` deliberately preserves exact source spelling: upstream's
default filter can strip abbreviation dots. Wordstead instead excludes unsupported
entries rather than turning them into other words. No deaccent option is used.
The deterministic transformation then:

1. Requires nonempty, newline-terminated one-entry-per-line source output. Rejects
   malformed records, control characters, blank records, leading/trailing spaces
   and characters outside the upstream spelling alphabet. CRLF is normalized.
2. Excludes entries not made solely of ASCII A–Z/a–z (spaces, punctuation, digits,
   apostrophes, hyphens, accented letters and other glyphs are never transliterated).
3. Excludes spellings containing source capitals, supplementing incomplete name
   and abbreviation metadata. This can also omit otherwise ordinary words only
   supplied with capitals. A lowercase ordinary sense sharing a name still counts.
4. Keeps lengths **2–30 inclusive**, the current browser's maximum board axis.
   This filters the vocabulary, without changing core geometry. No selected
   entries exceeded 30; this release's longest accepted entry has 23 letters.
5. Uppercases, deduplicates and sorts with deterministic ASCII ordering. Writes
   UTF-8/LF, one word per line, after the embedded version and notice comments.

Normal user input remains case-insensitive with outer whitespace trimmed by the
existing `normalizeWord`. Interior whitespace/punctuation fails. Every affected
complete main word and perpendicular cross-word must be present. Blanks keep their
assigned A–Z letter and provenance; they cannot bypass membership. Ordinary plurals,
comparatives and verb forms are preserved; no stemming or automatic acceptance of
unlisted inflections is used. There are **no supplemental additions or exclusions**.

Metadata tagging is incomplete upstream, particularly for names and abbreviations.
Obscure, regional, offensive, vulgar, slang or dated entries may remain. Some words
accepted by tournament dictionaries are missing. No assurance of family-safe
content or tournament compatibility is made. Future exceptions must be separate,
reviewable files with a documented policy; never hand-edit the generated list.

## Counts, bytes and integrity

| Stage | Entries |
| --- | ---: |
| Upstream metadata-filtered export | 98,267 |
| Excluded unsupported spellings | 19,260 |
| Excluded capitalized spellings | 355 |
| Excluded shorter than two | 26 |
| Excluded longer than thirty | 0 |
| Duplicates removed | 0 |
| Accepted | **78,626** |

Counts use mutually exclusive filters in the order above. The runtime artifact
[`esdb-en-us-60-1e5b7d3-ws1.txt`](../vocabulary/esdb-en-us-60-1e5b7d3-ws1.txt)
is **750,727 bytes** (733.13 KiB), including notices. SHA-256:

```text
724ed98404895a23d5c3db1c205aae3369c6a66f9b34b46cadb4b91f068f4532
```

`generation.json` records these counts, the canonical source export checksum
(sorted case-preserving records with LF), notice checksum, output checksum and
exact extraction settings. Generated `src/vocabulary/manifest.js` supplies the
same immutable version/count/size/hash and Fetch integrity value to the browser.
Scoped Git attributes preserve LF bytes across checkouts. The complete upstream
notice retains its original trailing whitespace; its attribute permits that.

See [measured validation](vocabulary-validation.md) for actual HTTP transfer,
desktop/mobile viewport preparation and lookup measurements. No custom compression,
service worker or persistent cache is needed for this milestone.

## Reproduce and verify

Development tools: Node.js 22+, Git, Python 3.7+ with SQLite 3.33+ (per upstream).
No Python packages or npm installs are required. Use a temporary checkout outside
the public tree. For example:

```sh
git clone --branch v2 https://github.com/en-wl/wordlist.git <temporary-esdb-directory>
git -C <temporary-esdb-directory> checkout --detach 1e5b7d3a72f47a71da5d28686c1dd4b397178485
node scripts/generate-vocabulary.js --source <temporary-esdb-directory>
node scripts/generate-vocabulary.js --source <temporary-esdb-directory> --check
npm test
node scripts/benchmark-vocabulary.js
```

Pass `--python <executable>` when Python's executable is named differently.
The generator rejects a wrong commit or tracked source modifications, invokes the
upstream database builder in its source directory with a temporary database, then
exports and filters it. Python UTF-8 mode is explicit for Windows portability;
ambient SCOWL cache/debug/build overrides are cleared. Temporary database files
are cleaned up. No upstream source or database is copied into the public tree.
The pinned upstream builder prints warnings about unmatched compound adjustments;
generation uses its unchanged documented behavior and checks exit status.

The normal command writes the committed artifact, manifest, report and full notice.
`--check` rebuilds from scratch and compares all four files byte for byte without
writing them. It fails on malformed output, unexpected license text, a failed
upstream command, absent artifact or any mismatch. Tests independently check the
committed count/hash, boundary filters, parser, loading lifecycle and membership.
The generated file is already committed for GitHub Pages; **normal play requires
none of these tools and no build step**.

## Browser lifecycle and QA

The HTML game container starts `inert` with `aria-busy=true`; the visible loading
status, credits and retry control are outside it. No sessions, rack buttons or game
listeners are initialized before success. A same-origin, relative static Fetch
loads the versioned text with its pinned SHA-256 integrity value. The parser
validates version, line format, lengths, count, ordering and uniqueness, then calls
the unchanged `createDictionary()` once. Synchronous `has(word)` uses a private Set.

Concurrent/repeated loads reuse the same promise and prepared object. A successful
page session never reloads or reparses for previews, commits, exchanges, restarts
or mode changes. Rejected network/HTTP/integrity/body/parse attempts keep the game
inert and expose retry; only a subsequent successful attempt can start it. Nothing
falls back to the demo dictionary. The loaded list supports offline play for the
rest of that page session; offline reload is not promised. There are no per-word
network requests, external runtime services or vocabulary selectors.

Every browser session owns a fixed dictionary reference and name used by both
preview and commit. Normal rack and word-lab runs use ESDB. **Set up 7×7 example**,
**Load scripted rack QA example** and farm QA fixtures reset their respective run
to the preserved demo dictionary, with an on-screen QA label. Restart repeats that
fixture and vocabulary; mode switching retains each run's dictionary. **New puzzle**
or **Create empty board** resets the active mode to ESDB. The demo list stays in
`src/core/demo-vocabulary.js` for diagnostic imports and all old tests, but the
enormous expanded word list is not displayed and no autocomplete is added.

## Updating later

Review the new upstream documentation, filters and notices again. Change the pinned
commit, distinct dictionary ID/file and display name in `scripts/vocabulary-source.js`,
then regenerate all four outputs. Review count/size changes, acceptance differences,
credits and any separately recorded exceptions. Run full tests, regeneration check,
syntax checks and browser QA; update this policy, credits and measured results.
Never change the active run's dictionary during play.

Vocabulary changes can change whether an old seeded puzzle is solvable, even when
tile and farm seeds are identical. Future daily definitions must associate each
puzzle with a stable dictionary version. Daily infrastructure is not implemented.
