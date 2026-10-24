import { cellToView } from '../rendering/board.js';
import { drawGround, drawFarmFeature, drawBadge } from '../rendering/artwork.js';
import { createSounds } from '../audio/sounds.js';

/** Read the accepted transition's deltas, never reconstruct claims or rewards. */
export function commitmentFeedback(result, previousStatus) {
  if (!result.accepted) return [{ type: 'word-rejected' }];
  const events = [{ type: 'word-accepted', cells: result.evaluation.newPositions }];
  if (result.newlyClaimed.length) events.push({ type: 'territory-captured', indices: result.newlyClaimed });
  if (result.farmRewards?.features.length) events.push({ type: 'feature-captured', features: result.farmRewards.features });
  if (result.points > 0) events.push({ type: 'points-earned' });
  if (result.state.status === 'won' && previousStatus !== 'won') events.push({ type: 'run-completed' });
  else if (result.state.status === 'exhausted') events.push({ type: 'run-ended' });
  return events;
}

/** Cosmetic effects live outside the board renderer, model and save lifecycle.
 * SVG paths group any capture into three opacity animations, not N timers.
 * Only visible livestock receive small motif surfaces (at most 24).
 */
export function initializeFeedback({ find, getView, rackButtons, getStorage,
  sounds = createSounds({ getStorage }), motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  doc = document, host = window } = {}) {
  const layer = find('board-feedback');
  const animations = new Set();
  let revision = 0;
  function cancel() {
    revision += 1;
    for (const animation of animations) animation.cancel();
    animations.clear();
    layer.replaceChildren();
    sounds.stop();
  }
  function animate(element, frames, duration, delay = 0, remove = false) {
    if (!element?.animate) { if (remove) element?.remove(); return; }
    const token = revision;
    try {
      const animation = element.animate(frames, { duration, delay, easing: 'ease-out', fill: 'backwards' });
      animations.add(animation);
      const finish = () => {
        animations.delete(animation);
        if (remove && token === revision) element.remove();
      };
      animation.finished.then(finish, finish);
    } catch { if (remove) element.remove(); }
  }
  const flash = (element, color, duration = 180, delay = 0) => animate(element,
    [{ boxShadow: `inset 0 0 0 3px ${color}`, offset: 0 }, { boxShadow: 'inset 0 0 0 0px transparent', offset: 1 }], duration, delay);
  function path(cells, className, delay, duration = 280) {
    if (!cells.length) return;
    const { cellSize } = getView();
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const shape = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('class', `feedback-path ${className}`);
    // Local bounds keep a one-tile effect from becoming a board-sized surface.
    let minRow = Infinity, minColumn = Infinity, maxRow = -1, maxColumn = -1;
    for (const { row, column } of cells) {
      minRow = Math.min(minRow, row); minColumn = Math.min(minColumn, column);
      maxRow = Math.max(maxRow, row); maxColumn = Math.max(maxColumn, column);
    }
    const origin = cellToView({ row: minRow, column: minColumn }, cellSize);
    Object.assign(svg.style, { left: `${origin.x}px`, top: `${origin.y}px`, right: 'auto', bottom: 'auto',
      width: `${(maxColumn - minColumn + 1) * cellSize}px`, height: `${(maxRow - minRow + 1) * cellSize}px` });
    // Same cellToView origin as the scrolling board; no screen-space tracking.
    shape.setAttribute('d', cells.map((cell) => {
      const { x, y } = cellToView(cell, cellSize), size = cellSize - 8;
      return `M${x - origin.x + 4} ${y - origin.y + 4}h${size}v${size}h-${size}z`;
    }).join(''));
    svg.append(shape);
    layer.append(svg);
    const settle = className === 'feedback-settle' || className === 'feedback-word';
    animate(svg, [{ opacity: 0, transform: settle ? 'translateY(-2px)' : 'none' },
      { opacity: 0.7, offset: 0.3 }, { opacity: 0, transform: 'none' }], duration, delay, true);
  }
  function livestockBob(features) {
    const { cellSize, board } = getView();
    const viewport = find('board-viewport');
    const canvasRect = find('board').getBoundingClientRect(), rect = viewport.getBoundingClientRect();
    let count = 0;
    for (const { index, type } of features) {
      if (type !== 'livestock' || count >= 24) continue;
      const row = Math.floor(index / board.columns), column = index % board.columns;
      const { x, y } = cellToView({ row, column }, cellSize);
      if (canvasRect.left + x + cellSize < rect.left || canvasRect.left + x > rect.right
        || canvasRect.top + y + cellSize < rect.top || canvasRect.top + y > rect.bottom) continue;
      const canvas = doc.createElement('canvas');
      canvas.className = 'feedback-animal';
      Object.assign(canvas.style, { left: `${x}px`, top: `${y}px`, width: `${cellSize}px`, height: `${cellSize}px` });
      const dpr = host.devicePixelRatio || 1;
      canvas.width = Math.round(cellSize * dpr); canvas.height = Math.round(cellSize * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.setTransform(canvas.width / cellSize, 0, 0, canvas.height / cellSize, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // A static ground patch covers the original hen; only its local copy bobs.
      drawGround(ctx, 0, 0, cellSize, row, column, { claimed: true, recent: true });
      drawFarmFeature(ctx, type, 0, -2, cellSize);
      drawBadge(ctx, 'L', 8, cellSize - 8, 10); drawBadge(ctx, '+', cellSize - 9, 9);
      layer.append(canvas);
      animate(canvas, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], 220, 160, true);
      count += 1;
    }
  }
  function emit(input) {
    const events = Array.isArray(input) ? input : [input];
    // Repeated actions replace effects, bounding lifetime and node/voice counts.
    cancel();
    if (doc.hidden) return;
    sounds.play(events);
    if (motion?.matches || !layer.animate) return;
    const view = getView();
    if (!view) return;
    const coordinates = (indices) => indices.map((index) => ({ row: Math.floor(index / view.board.columns), column: index % view.board.columns }));
    for (const event of events) {
      switch (event.type) {
        case 'tile-selected': break; // Persistent CSS lift follows aria-pressed.
        case 'tile-placed': case 'tile-moved':
          path(event.cells, 'feedback-settle', 0, 130); break;
        case 'tile-returned': case 'tiles-exchanged':
          for (const slot of event.slots) animate(rackButtons[slot],
            [{ transform: 'translateY(-2px)', opacity: 0.75 }, { transform: 'translateY(0)', opacity: 1 }], 130);
          break;
        case 'word-accepted': path(event.cells, 'feedback-word', 0, 130); break;
        case 'word-rejected': case 'placement-rejected': flash(find('placement-feedback'), '#b65e58', 180); break;
        case 'territory-captured':
          // Three bounded groups, all and only authoritative new cells.
          for (let group = 0; group < 3; group += 1) path(coordinates(event.indices.filter((_, i) => i % 3 === group)), 'feedback-harvest', 100 + group * 25, 280);
          break;
        case 'feature-captured':
          for (const type of ['crop', 'fertile', 'livestock', 'building']) {
            path(coordinates(event.features.filter((feature) => feature.type === type).map((feature) => feature.index)), `feedback-${type}`, 170, 220);
          }
          livestockBob(event.features); break;
        case 'points-earned': flash(find('goal-label'), '#e9c06d', 260, 100); break;
        case 'run-completed': flash(find('results'), '#e9c06d', 320, 180); break;
        case 'run-ended': flash(find('results'), '#91aa85', 150); break;
      }
    }
  }
  const control = find('sound-toggle');
  function renderSound() {
    control.textContent = sounds.enabled ? 'Sound: On' : 'Sound: Off';
    control.setAttribute('aria-pressed', String(sounds.enabled));
  }
  control.addEventListener('click', (event) => {
    sounds.setEnabled(!sounds.enabled); sounds.activate(event); renderSound();
  });
  const activate = (event) => { if (!event.repeat) sounds.activate(event); };
  host.addEventListener('pointerdown', activate, { capture: true });
  host.addEventListener('keydown', activate, { capture: true });
  host.addEventListener('pagehide', cancel);
  doc.addEventListener?.('visibilitychange', () => { if (doc.hidden) cancel(); });
  motion?.addEventListener('change', cancel);
  renderSound();
  return { emit, cancel };
}
