# Wordstead architecture

Milestone 1 establishes a static browser bootstrap and a small pure board model.
The [design skeleton](design-skeleton.md) defines gameplay requirements; this
document describes technical responsibilities, not new game rules.

## Implemented

### Core: `src/core/board.js`

The core has no DOM, Canvas, storage, network, or Node-specific imports. The same
module runs in the browser and in Node's built-in test runner. Its current API:

- `createBoard({ rows = 15, columns = 15 } = {})` returns an independent empty
  board. Either dimension can be supplied separately.
- `getCellIndex(board, row, column)` converts zero-based coordinates into a
  row-major index and throws `RangeError` for invalid or out-of-bounds positions.
- `getCell(board, row, column)` returns the value at validated coordinates.

The entire current state shape is:

```js
{
  rows: 15,
  columns: 15,
  cells: [null, /* ...225 entries total... */]
}
```

`rows` and `columns` are positive safe integers. `cells.length` equals
`rows * columns`, and every cell starts as `null` (empty). Indexing uses
`row * columns + column`; rows increase downward and columns increase rightward.
Dimensions are logical cell counts. They carry no sprite, viewport, or pixel
measurements. Invalid dimensions and a cell count beyond JavaScript's array
length limit (2³² − 1) throw `RangeError` before allocation. Available memory
still limits practical board sizes.

Each initialization allocates its own array and is deterministic. Boards are
plain data, not frozen objects; callers are responsible for retaining these
invariants. Access helpers expect a board from `createBoard`, not arbitrary or
unvalidated saved data. There is no mutation/placement API or full game-state
schema yet. Cell contents will evolve when letters, features, and claims are
implemented; do not add those fields speculatively.

### Application: `src/main.js` and `index.html`

`index.html` loads `main.js` as a native ES module. Browser module scripts run
after HTML parsing; the bootstrap creates the default board and writes a
text-only initialization summary into a semantic DOM placeholder. The model
does not know about that DOM element. A pending summary and a `noscript` message
avoid presenting a successful initialization before JavaScript runs.

There is no game loop, renderer, input controller, storage adapter, or random
generator. The current interactive elements are ordinary skip/return links.
Local CSS supplies responsive layout and focus styles without importing the
arcade theme, third-party artwork, or external fonts.

### Development tests: `tests/`

`npm test` runs `node --test`; tests import the same core module as the browser.
They assert state shape, default/custom dimensions, coordinate access, storage
independence, deterministic initialization, and rejected inputs. `package.json`
enables ES modules and supplies development commands only; Pages does not run it.
There is no package installation, bundler, or build output.

## Planned subsystem boundaries

Create these modules only when their first working feature needs them.

### Rules and game state: `src/core/`

Placement, word validation coordination, scoring, enclosure, and victory belong
here. Use explicit inputs and deterministic transitions that return the next
state without mutating input state. New rules need focused browser-independent
tests. Future letter draws and generation must take reproducible seed/random
inputs rather than calling ambient randomness. Puzzle configuration and game
state should grow with implemented behavior; persistence/daily schemas are not
fixed by this milestone.

### Presentation: `src/rendering/`

The [visual identity guide (v0.1)](visual-guide-v0.1.md) supplies exploratory
pixel-art, UI layering, readability, interaction, and motion direction. Treat
its asset suggestions as proposals subject to verified license boundaries.

Use Canvas 2D for the future board. Render state and selection feedback; do not
calculate placement legality, territory, scores, or victory. Keep view geometry
(cell size in CSS pixels, origin, pan, zoom, and device-pixel ratio) outside core
state. A cell's view origin will be derived from its logical column/row and the
current view transform. Inverse transforms will convert pointer positions to
candidate logical coordinates; core rules still validate actions.

Sprite source rectangles, scaling, and feature overhang are presentation data.
They must never define board dimensions or logical feature occupancy. Add assets
only within approved licensing/distribution scope, with attribution and notices;
never load the private audit registry or machine-local filesystem bindings in
runtime code. No transforms, sprites, or Canvas module are implemented yet.

### DOM and input: `src/ui/`, coordinated by the application

Keep menus, buttons, and the letter rack in semantic DOM controls with real text,
programmatic state, visible focus, and readable status feedback. Future board
input must support mouse, touch, and keyboard, including a non-drag placement
path and an accessible alternative to a visual Canvas interaction. Use mobile
targets of at least 44 CSS pixels and respect reduced-motion preferences.

Input translates events into user intent (for example, a logical row/column and
chosen letters). The application passes that intent and current state to the
core, retains the resulting state, and refreshes Canvas and DOM from it. Neither
input nor rendering duplicates game rules. Future persistence and daily-puzzle
integration sit at the application boundary and supply validated core inputs.

## Expected flow once gameplay exists

1. Browser bootstrap creates a logical state from explicit configuration.
2. Input translates an action into intent, resolving screen coordinates through
   the renderer's view transform when necessary.
3. The application asks a pure core rule to validate/transition the current state.
4. The application retains accepted state or presents rejected-action feedback.
5. Canvas renders state, while DOM controls and accessible status reflect it.

Only initialization and DOM status presentation exist today. No polling,
animation loop, event bus, framework, or dependency injection layer is needed.

## Hosting boundary

All runtime files are local relative resources under `wordstead/`. They work
when the directory URL is loaded directly or refreshed on a static HTTP server.
GitHub Pages serves these files without executing Node. Existing crawler
restrictions apply. This milestone leaves the root arcade homepage, shared
resources, other games, and hosting configuration unchanged.
