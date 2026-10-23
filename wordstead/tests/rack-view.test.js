import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRackSlots } from '../src/ui/rack.js';
import { createSession } from '../src/core/session.js';
import { placeFeature } from '../src/core/features.js';
import { replenishRack } from '../src/core/bag.js';

function element() {
  return { dataset: {}, attributes: {}, style: { setProperty(name, value) { this[name] = value; } },
    setAttribute(name, value) { this.attributes[name] = value; } };
}

test('rack UI exposes seven, eight or nine persistent slots with physical labels and correct focus/empty states', () => {
  const buttons = Array.from({ length: 9 }, element);
  const group = element();
  for (const capacity of [7, 8, 9, 7]) {
    let state = createSession();
    for (let n = 0; n < capacity - 7; n += 1) {
      state.puzzle.board = placeFeature(state.puzzle.board, 1, n + 1, 'livestock');
      state.puzzle.territory.claimed[16 + n] = true;
    }
    state = { ...state, ...replenishRack(state.rack, state.bag, capacity) };
    const tile = state.rack.at(-1);
    renderRackSlots(group, buttons, { state, draft: { tiles: [{ tileId: tile.id, row: 3, column: 4 }] },
      selectedTileId: tile.id, exchanging: false, exchangeIds: [] });
    assert.equal(buttons.filter((button) => !button.hidden).length, capacity);
    assert.equal(group.attributes['aria-label'], `${capacity} rack slots`);
    assert.equal(group.style['--rack-capacity'], capacity);
    assert.equal(buttons[capacity - 1].disabled, false);
    assert.match(buttons[capacity - 1].attributes['aria-label'], new RegExp(`physical tile ${tile.id}.*row 4, column 5`));
    assert.equal(buttons[capacity - 1].attributes['aria-pressed'], 'true');
    state = { ...state, rack: state.rack.slice(0, 2) };
    renderRackSlots(group, buttons, { state, draft: { tiles: [] }, exchanging: false, exchangeIds: [] });
    assert.equal(buttons[2].disabled, true);
    assert.equal(buttons[2].textContent, '–');
    assert.equal(buttons.filter((button) => !button.hidden).length, capacity);
  }
});
