# Wordstead agent instructions

These instructions extend the repository root `AGENTS.md` within `wordstead/`.

- Wordstead is an independent, mobile-first spatial word puzzle and cozy farm
  builder. Use vanilla JavaScript native ES modules, HTML, and CSS. Keep the
  browser runtime dependency-free and directly servable by GitHub Pages, with
  no mandatory build step. Node.js is development tooling only.
- Read [README.md](README.md), [the design skeleton](docs/design-skeleton.md),
  and [architecture](docs/architecture.md) before changing functionality. The
  design skeleton is authoritative for rules; do not infer rules from artwork.
- Before changing visual presentation, read the [visual identity guide (v0.1)](docs/visual-guide-v0.1.md).
  Prioritize readable letter glyphs, clear placement and enclosure feedback,
  mobile usability, semantic controls, and restrained motion. Palette, logo,
  typography, and art production choices remain exploratory proposals. Do not
  treat this guide as permission to publish assets; current audit, organization,
  and license records determine verified asset and distribution boundaries.
- `src/core/` owns browser-independent state and rules. `src/main.js` currently
  owns browser initialization and DOM status. Future Canvas rendering belongs
  in `src/rendering/`; DOM controls and input belong in `src/ui/` when needed.
  `styles/` is local presentation; `tests/` is Node-based model testing.
- The implemented board is `{ rows, columns, cells }`: positive safe integer
  dimensions, a dense row-major array of exactly `rows * columns` cells, and
  `null` for empty cells. Coordinates are zero-based `{ row, column }`, with
  index `row * columns + column`. Coordinate access rejects invalid positions.
  Keep this schema small and extend it alongside tested gameplay requirements.
- Rules must run without DOM, Canvas, storage, or other browser APIs. Keep
  state transitions deterministic and avoid mutating their input state. Future
  seeded gameplay must accept explicit randomness/seed inputs for reproducible
  results; do not introduce ambient randomness into the core.
- Logical geometry must never depend on sprite dimensions, CSS pixels, device
  pixel ratio, zoom, or pan. Renderers present state and transform coordinates;
  they never determine placement legality, scoring, or victory. Input translates
  user intent and delegates decisions to the core.
- Keep menus, buttons, and the future letter rack as semantic DOM elements;
  use Canvas 2D for the future board. Support touch, mouse, and keyboard without
  requiring drag-and-drop. Preserve visible focus, readable contrast, touch
  targets of at least 44 CSS pixels, and reduced-motion preferences.
- Add focused `node:test` / `node:assert/strict` tests for new gameplay behavior,
  including boundaries and invariants. Run `npm test` from this directory and
  check affected JavaScript syntax. Do not add a framework or bundler.
- Preview with a simple static HTTP server; native module imports need HTTP,
  rather than `file://`. Check direct `/wordstead/` loading and refresh, the
  return link, narrow/wide layouts, keyboard behavior, and browser errors.
  Run `git diff --check` and report only validation actually performed.
- Keep runtime paths relative and include `noindex, nofollow` on entry pages.
  Public runtime code must never reference private local filesystem paths or
  the audit's machine-local storage binding.
- Preserve existing asset audits, organization records/tools, and license
  documents unless a task explicitly requests changes to them. Read
  [asset organization](asset-organization/README.md) and
  [license scope](docs/license.md) before asset work. No unapproved assets,
  private originals, backups, previews, or exports may enter the public tree.
  Preserve required attribution/notices with any approved future art; code
  licensing must not grant rights to third-party assets.
- Keep tasks incremental and within their requested milestone. Do not add
  speculative state, empty modules, or reserved gameplay systems. Distinguish
  implemented behavior from plans in documentation and completion reports.
