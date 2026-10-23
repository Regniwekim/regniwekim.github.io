import { getRackCapacity } from '../core/session.js';

/** Keep physical slot buttons persistent while the available capacity changes. */
export function renderRackSlots(element, buttons, { state, draft, selectedTileId, exchanging, exchangeIds }) {
  const capacity = getRackCapacity(state);
  element.setAttribute('aria-label', `${capacity} rack slots`);
  element.style.setProperty('--rack-capacity', capacity);
  buttons.forEach((button, slot) => {
    const tile = state.rack[slot];
    const selected = tile && (exchanging ? exchangeIds.includes(tile.id) : selectedTileId === tile.id);
    const drafted = draft.tiles.find((item) => item.tileId === tile?.id);
    button.hidden = slot >= capacity;
    button.textContent = tile ? tile.letter ?? (drafted ? `◇${drafted.letter}` : '◇') : '–';
    button.disabled = !tile || state.status !== 'playing';
    button.setAttribute('aria-pressed', String(Boolean(selected)));
    button.setAttribute('aria-label', `Slot ${slot + 1}: ${tile ? `${tile.letter ?? '◇ (blank)'}, physical tile ${tile.id}` : 'empty'}${selected ? exchanging ? ', selected for exchange' : ', selected for placement' : ''}${drafted ? `, provisionally at row ${drafted.row + 1}, column ${drafted.column + 1}${drafted.assignedLetter ? `, assigned ${drafted.letter}` : ''}` : ''}`);
    button.dataset.used = String(Boolean(drafted));
    button.dataset.empty = String(!tile);
    button.dataset.tileId = tile?.id ?? '';
  });
}
