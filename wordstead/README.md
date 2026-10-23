# Wordstead

**Build a farm, one word at a time.** Wordstead is a single-player spatial word
puzzle and cozy farm builder. The [design skeleton](docs/design-skeleton.md)
defines the planned game; [architecture](docs/architecture.md) documents the
implemented contracts.

## Current status: Milestone 2A

The development sandbox lets you construct arbitrary letter fences, inspect
orthogonally enclosed land, and claim each empty cell for one territory point
exactly once. It is **not the final game**: sandbox letter placement and removal
are unrestricted and do not implement legal Wordstead word placements.

Milestone 1's configurable board model remains intact. The new pure core uses
explicit `{ kind: 'letter', letter: 'A' }` cells as barriers and a separate boolean
claim mask. A nonrecursive flood fill from all four board edges identifies
exterior non-letter land; the remaining non-letter cells are enclosed. Metadata
alone does not block land or award bonuses. See the architecture for API details.

The Canvas board uses readable system-font letters and primitive shapes, with
no third-party art, fonts, audio, or runtime dependencies. The
[visual guide (v0.1)](docs/visual-guide-v0.1.md) remains exploratory. Existing
[asset audit](ASSET-AUDIT.md), [organization records](asset-organization/README.md),
and [license scope](docs/license.md) continue to govern asset permission.

## Run locally

From the **repository root** (the parent of `wordstead/`):

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Visit <http://localhost:8000/wordstead/> directly or refresh it. Native ES modules
require HTTP; `file://` is not supported. No package installation, build command,
backend, or Node browser runtime is needed. Stop the server with Ctrl+C.
**Back to Main Arcade** points to `../index.html`. The homepage does not list
Wordstead yet; adding its card is outside this milestone.

## Sandbox controls

- Tap/click a cell to toggle a temporary A tile. Detection updates immediately.
- Focus the board and use arrow keys to select; Enter or Space toggles the letter.
  Selection stays visible as you move. Alternatively, enter **Row** and **Column**,
  choose **Select cell**, then **Toggle selected letter**. UI coordinates start
  at 1; core coordinates start at 0.
- **Inspect enclosure** reports enclosed cells and available points without
  claiming. **Claim enclosed land** awards one point per unclaimed enclosed cell.
  Repeating a claim awards zero. The score is historical; opening a fence or
  covering a claimed cell with a letter never erases claims or enables rescoring.
- Exterior is meadow green. Enclosed unclaimed land has a dashed inset. Newly
  claimed land uses pale harvest and **+**; older claims use sage and **✓**.
  The latest claim stays marked until another claim or letter edit.
  Textual selection/status messages supplement the color and symbols.
- Pan with native touch scrolling, scrollbars, or a trackpad. The board never
  shrinks below 44 CSS pixels per cell. **Cell display size** enlarges cells to
  56 or 72 pixels. Pointer mapping accounts for CSS scaling and device pixel ratio.
- **Create empty board** accepts 1–30 rows and columns independently and clears
  letters, claims, and points. **Reset board & claims** clears the current size.
  Refresh also clears everything; there is no persistence.

For a one-cell enclosure, place letters in rows 2 and 4, columns 2–4, and in row 3,
columns 2 and 4. The center (3, 3) should be enclosed. Claim it twice: +1 then +0.
Remove the letter at (3, 4): the center becomes exterior but remains claimed.

All four edges supply outside access, rather than free fences. Diagonal land
connections do not supply passage: removing only a ring's corner does not release
its center, while removing a side letter does. This follows the requested
orthogonal flood-fill definition; no diagonal letter connectors are added.

## Structure

```text
wordstead/
├── index.html                 # Independent sandbox entry
├── package.json               # ES modules and built-in Node test command
├── src/
│   ├── main.js                # Browser bootstrap
│   ├── core/
│   │   ├── board.js           # Dimensions, storage, validated coordinates
│   │   ├── letters.js         # Explicit occupancy and immutable letter writes
│   │   ├── enclosure.js       # Iterative exterior flood fill
│   │   └── territory.js       # Claim preview, immutable claims, scoring
│   ├── rendering/board.js     # Canvas view and coordinate transforms
│   └── ui/sandbox.js          # DOM controls, pointer/keyboard input, session state
├── styles/main.css            # Local responsive presentation
├── tests/                     # Node model tests and explicit shape fixtures
└── docs/                      # Architecture, design, visual, and license guides
```

Existing audit/organization files and license notices are preserved.

## Run tests

Use Node.js 22 or newer. From `wordstead/`:

```sh
npm test
```

This runs `node --test` with built-in `node:test` and `node:assert/strict` only;
no `npm install` is needed. If PowerShell restricts `npm.ps1`, use `npm.cmd test`.
Tests preserve the foundation checks and exercise exact enclosure coordinates,
all edges, diagonal topology, irregular/multiple regions, occupied interiors,
rectangular/degenerate boards, claim history, point awards, immutability, and
invalid inputs. A large exterior fixture checks the nonrecursive approach.

Check affected JavaScript files with `node --check path/to/file.js`. For page
changes, also preview desktop and phone layouts, pointer/keyboard input,
panning and enlarged cells, direct loading/refresh, the return link, and browser
console/network errors. Run `git diff --check` before committing.

## Limits and next milestone

This is an in-memory mechanics sandbox. It always places A, permits removal,
limits the development UI to 30×30, and uses no animation. The core supports
configurable rectangular boards within the original JavaScript array and
available-memory limits; core APIs expect valid boards/claims they produce,
not unvalidated saved data. Letter creation currently supports uppercase A–Z.

Milestone 2B should add pure placement geometry/validation and call territory
claims only after an accepted committed placement, preserving this enclosure
implementation. Dictionary coordination, rack/bag, seeded puzzles, farm features
and bonuses, victory, daily/campaign modes, leaderboards, persistence, and final
sprites remain deferred. No complete game-state schema is introduced here.

## Static hosting

Runtime paths are relative under `wordstead/` and work directly at `/wordstead/`
on static hosting. The existing GitHub Pages source remains `main`, folder `/`,
with custom domain `games.regniwekim.com`. No rewrites or deployment changes are
needed. The entry retains `noindex, nofollow`; root `robots.txt` disallows crawling.
The root homepage, shared assets, other games, hosting, asset records, design
skeleton, and visual guide are outside this change.
