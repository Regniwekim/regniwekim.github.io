# Wordstead

**Build a farm, one word at a time.** Wordstead is a single-player spatial word
puzzle and cozy farm builder. The [design skeleton](docs/design-skeleton.md) is
the authoritative description of the planned game.

## Current status: Milestone 1

The application is a deliberately minimal development page, **not yet a playable
game**. A native ES module creates an empty 15×15 logical board and displays its
dimensions and initialization status. The page has its own responsive CSS,
semantic HTML, keyboard focus styles, and an arcade return link. It uses system
fonts and CSS shapes; no third-party artwork is loaded.

The core supports configurable rectangular boards, row-major cell indexing,
coordinate reads, and invalid-dimension/coordinate checks. There is no placement,
dictionary, scoring, territory capture, tile bag, puzzle generation, or victory
logic. Canvas rendering and gameplay input are deferred.

## Structure

```text
wordstead/
├── AGENTS.md                  # Game-specific development guidance
├── index.html                 # Independent static entry page
├── package.json               # ES module mode and Node test command only
├── src/
│   ├── main.js                # Browser bootstrap and DOM status
│   └── core/board.js          # Pure logical board model
├── styles/main.css            # Independent, mobile-first presentation
├── tests/board.test.js         # Browser-free model tests
├── docs/
│   ├── architecture.md        # Implemented boundaries and planned flow
│   ├── design-skeleton.md     # Authoritative gameplay design
│   └── license.md             # Existing third-party license scope
├── asset-audit/               # Existing audit metadata and tools
├── asset-organization/        # Existing organization records and tools
└── licenses/                  # Preserved third-party notices and credits
```

The existing root-level asset audit, catalog, and organization plan are retained.
No empty rendering or input directories are created; add them with their first
working feature. See [architecture](docs/architecture.md) for their boundaries.

## Run locally

From the **repository root** (the parent of `wordstead/`), run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Visit <http://localhost:8000/wordstead/>. Load that URL directly or refresh it;
no arcade session is required. **Back to Main Arcade** goes to `../index.html`.
The arcade homepage does not list Wordstead yet; adding a card is outside this
milestone. Stop the server with Ctrl+C. Another static HTTP server is fine.

Use HTTP for this game: native ES modules are subject to browser origin rules
and may fail when opening `index.html` using `file://`. No package installation,
build command, backend, or Node.js browser runtime is needed.

## Run tests

Use Node.js 22 or newer. From `wordstead/`, run:

```sh
npm test
```

This invokes `node --test`, using only built-in `node:test` and
`node:assert/strict`. No `npm install` is needed. On PowerShell hosts where the
`npm.ps1` wrapper is restricted, use `npm.cmd test`.

Tests exercise board initialization, rectangular and single-cell boards,
coordinate/index access, independent deterministic initialization, and invalid
dimensions/coordinates without any browser APIs. Check runtime syntax with:

```sh
node --check src/core/board.js
node --check src/main.js
```

For page changes, also preview at phone and desktop widths, use keyboard and
pointer navigation, check direct loading/refresh and the return link, inspect
console/network errors, and run `git diff --check`.

## Static hosting

The existing GitHub Pages configuration publishes the repository's `main`
branch from `/`, at `games.regniwekim.com`. Once merged through the existing
process, this entry page is served at `/wordstead/`. Its stylesheet and module
paths are relative to that directory, and JavaScript imports include `.js`
extensions. No rewrites, Node server, deployment workflow, or Pages settings
changes are required. The page retains `noindex, nofollow`; root `robots.txt`
also disallows crawling.

## Contributing gameplay

Read [AGENTS.md](AGENTS.md), the design skeleton, and architecture first. Add
one small rule module under `src/core/` with explicit inputs and outputs and
focused tests in `tests/`. Keep it independent of DOM, Canvas, screen dimensions,
storage, and ambient randomness. Future seeded generation must be reproducible.

Application/input code will translate user actions into logical coordinates,
ask core rules to produce the next state, then update the DOM and future Canvas
view. Renderers consume state; they do not decide legality or scoring. Extend
the board/game schema only as implemented rules require. A useful first
Milestone 2 task is pure word-placement geometry and legality, with focused
tests for the starting square, board bounds, connectivity, and cross-words,
using explicit word-validation inputs.

## Limitations and deferred work

- No gameplay controls, board renderer, coordinate-to-screen transforms, or
  interactive board accessibility yet. The current placeholder is a DOM section.
- No persistence, daily puzzle integration, seeded generation, audio, or motion.
- Dense board allocation is constrained by JavaScript array length and available
  memory; normal game sizes are expected. Pixel dimensions are never model state.
- Third-party artwork is not integrated. Existing asset/license records remain
  authoritative for asset provenance and distribution boundaries. The private
  starter export is not a public runtime asset set; UI public delivery remains
  unresolved. See [asset organization](asset-organization/README.md) and
  [license scope](docs/license.md). No private store is needed to run or test
  this milestone.
