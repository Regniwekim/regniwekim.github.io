import { createHistoryRecord, getHistoryStatistics, historyIdentity } from '../persistence/daily-history.js';
import { createHistoryStorage } from '../persistence/history-storage.js';
import { createHistoryMonth, historyDateRecords, shiftHistoryMonth } from '../daily/calendar.js';
import { RESULT_HEADINGS } from '../core/results.js';

const stateLabels = { completed: 'Completed', unfinished: 'Recorded unfinished or exhausted result', empty: 'No recorded result' };

/** Read-only calendar and derived totals. No gameplay or active-save operations. */
export function initializeHistory({ find, getStorage, keyPrefix, today, confirm }) {
  const storage = createHistoryStorage({ getStorage, keyPrefix });
  storage.load();
  let month = today().slice(0, 7), selected = null, current = null;
  let shownArchive = null, shownInfo = null;
  let lastAttempt = null;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function statistics() {
    const stats = getHistoryStatistics(storage.archive);
    const average = (n) => n === null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
    const values = { 'history-completed': stats.completed, 'history-unfinished': stats.unfinished,
      'history-words': stats.words, 'history-average-words': average(stats.averageWords),
      'history-strokes': stats.strokes, 'history-average-strokes': average(stats.averageStrokes),
      'history-points': stats.points, 'history-features': stats.features };
    for (const [id, value] of Object.entries(values)) find(id).textContent = value;
    find('history-empty').hidden = storage.archive.records.length > 0;
  }
  function details() {
    const panel = find('history-details');
    const records = selected ? historyDateRecords(storage.archive.records, selected) : [];
    panel.replaceChildren();
    panel.append(element('h4', selected ? `${selected} · UTC` : 'Recorded result details'));
    if (!records.length) {
      panel.append(element('p', selected ? 'No recorded result for this date.' : 'Select a recorded date to see its summary.'));
      return;
    }
    for (const record of records) {
      panel.append(element('p', `${record.formatVersion} · ${RESULT_HEADINGS[record.status]}`));
      const list = element('dl', undefined, 'results-statistics');
      const fields = {
        'Farm points / target': `${record.totalPoints} / ${record.target}`,
        'Accepted word placements': record.wordCount, 'Total strokes': record.strokes,
        'Total exchanges': record.exchangeCount, 'Free exchanges used': record.freeExchangesUsed,
        'Charged exchanges': record.chargedExchanges, 'Base territory points': record.basePoints,
        'Crop bonus points': record.cropPoints, 'Fertility bonus points': record.fertilityPoints,
        'Captured crops': record.captured.crops, 'Captured fertile cells': record.captured.fertile,
        'Captured livestock': record.captured.livestock, 'Captured buildings': record.captured.buildings,
      };
      for (const [label, value] of Object.entries(fields)) {
        const row = element('div');
        row.append(element('dt', label)); row.append(element('dd', value)); list.append(row);
      }
      panel.append(list);
      panel.append(element('p', `Scoring rules: ${record.rulesVersion}`, 'hint'));
    }
  }
  function calendar() {
    const model = createHistoryMonth(month, storage.archive.records);
    find('history-month').textContent = model.label;
    find('history-previous').disabled = shiftHistoryMonth(month, -1) === null;
    find('history-next').disabled = shiftHistoryMonth(month, 1) === null;
    const days = model.cells.map((cell) => {
      if (!cell) return element('span');
      const button = element('button', `${cell.day}${cell.state === 'completed' ? ' ✓' : cell.state === 'unfinished' ? ' ◦' : ''}`, `history-day ${cell.state}`);
      button.type = 'button';
      button.dataset.date = cell.date;
      button.setAttribute('aria-label', `${cell.date} UTC: ${stateLabels[cell.state]}`);
      button.setAttribute('aria-pressed', String(cell.date === selected));
      button.addEventListener('click', () => {
        selected = cell.date;
        // Keep date controls mounted so native Tab/Enter/Space focus is stable.
        for (const day of days) if (day.dataset.date) day.setAttribute('aria-pressed', String(day.dataset.date === selected));
        details();
      });
      return button;
    });
    find('history-days').replaceChildren(...days);
    details();
  }
  function resultNotice() {
    let record = null;
    try { record = current ? createHistoryRecord(current) : null; } catch { /* Capture reports validation errors; rendering must remain available. */ }
    find('history-result-status').hidden = !record;
    find('save-history-result').hidden = !record;
    if (!record) return;
    const previous = storage.archive.records.find((r) => historyIdentity(r) === historyIdentity(record));
    const stored = previous?.status === 'won' || (previous && JSON.stringify(previous) === JSON.stringify(record));
    const failed = lastAttempt?.session === current && !lastAttempt.ok;
    const blocked = ['invalid', 'conflict', 'unavailable', 'full'].includes(storage.info.kind);
    find('history-result-status').textContent = failed
      ? 'This result could not be saved to Daily History. Open History for recovery options, then retry while this terminal run is available.'
      : stored && !blocked ? previous.status === 'won'
        ? 'A completion is saved in Daily History. Its original recorded statistics are preserved.'
        : 'This result is saved in Daily History on this browser.'
      : 'This terminal result can be saved to Daily History. Open History to check storage, then use Save to Daily History.';
    find('save-history-result').textContent = failed ? 'Retry Save to Daily History' : 'Save to Daily History';
    find('save-history-result').hidden = Boolean(stored && !failed && !blocked);
  }
  function render(session = current) {
    current = session;
    const { kind, message } = storage.info;
    const warning = ['invalid', 'unavailable', 'conflict', 'full'].includes(kind);
    find('history-status').textContent = message;
    find('history-status').setAttribute('role', warning ? 'alert' : 'status');
    find('history-reload').hidden = !warning;
    // Retained data in memory is not presented as the current stored archive after failure/conflict.
    find('history-content').hidden = warning;
    if (!warning && storage.archive !== shownArchive) { statistics(); calendar(); }
    if (storage.info !== shownInfo || storage.archive !== shownArchive) {
      shownInfo = storage.info; shownArchive = storage.archive;
    }
    resultNotice();
  }
  function capture(session) {
    try {
      const record = createHistoryRecord(session);
      if (!record) return;
      lastAttempt = { session, ok: storage.write(record) };
    } catch {
      lastAttempt = { session, ok: false };
    }
    render(current);
  }
  for (const [id, offset] of [['history-previous', -1], ['history-next', 1]]) {
    find(id).addEventListener('click', () => {
      const next = shiftHistoryMonth(month, offset);
      if (!next) return;
      month = next; selected = null; calendar();
    });
  }
  find('history-reload').addEventListener('click', () => { storage.load(); shownArchive = null; render(); });
  find('history-link').addEventListener('click', (event) => {
    event.preventDefault();
    find('history').open = true;
    find('history-summary').focus();
    find('history').scrollIntoView({ block: 'start' });
  });
  find('save-history-result').addEventListener('click', () => { if (current) capture(current); });
  find('history-clear').addEventListener('click', () => {
    const approval = storage.deletionToken();
    if (!approval) { render(); return; }
    confirm('Clear locally recorded Daily Puzzle history? This cannot be undone through Wordstead. It does not delete the active Daily or Free Play saves and does not reset the current game board.',
      'Clear Daily History', () => {
        if (storage.clear(approval)) { selected = null; lastAttempt = null; }
        render();
      }, 'Clear Daily History?', 'Keep Daily History');
  });
  return { render, capture, changed(event) {
    if (event.key === null || event.key === storage.key) { storage.changed(); render(); }
  } };
}
