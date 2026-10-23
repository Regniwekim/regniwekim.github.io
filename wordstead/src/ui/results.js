import { getSessionResults, formatResultsShare, RESULT_HEADINGS } from '../core/results.js';

/** Presentation only: no session transitions, focus changes or scrolling on reveal. */
export function initializeResults({ find, writeClipboard = (text) => {
  if (!globalThis.navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
  return navigator.clipboard.writeText(text);
} }) {
  let currentSession = null;
  let shareText = '';
  let revision = 0;

  find('copy-results').addEventListener('click', async () => {
    if (!shareText || find('copy-results').disabled) return;
    const attempt = revision;
    find('copy-results').disabled = true;
    find('copy-status').textContent = 'Copying results…';
    try {
      await writeClipboard(shareText);
      if (attempt === revision) find('copy-status').textContent = 'Results copied. Ready to share!';
    } catch {
      if (attempt === revision) {
        find('manual-copy').open = true;
        find('copy-status').textContent = 'Could not access the clipboard. Select the share text below and copy it manually.';
      }
    } finally {
      if (attempt === revision) find('copy-results').disabled = false;
    }
  });
  find('select-results').addEventListener('click', () => {
    if (!shareText) return;
    find('share-text').focus();
    find('share-text').select();
  });

  function render(session) {
    if (session === currentSession) return;
    currentSession = session;
    revision += 1; // Ignore clipboard completions belonging to a previous run/mode.
    const results = session ? getSessionResults(session) : null;
    find('results').hidden = !results;
    find('results-link').hidden = !results;
    find('new-puzzle-link').hidden = !results;
    find('copy-status').textContent = '';
    find('copy-results').disabled = !results;
    find('results-breakdown').open = false;
    find('manual-copy').open = false;
    shareText = results ? formatResultsShare(results) : '';
    find('share-text').value = shareText;
    // Clear the old presentation as well as hiding it on restart/mode changes.
    const fields = {
      'results-title': results ? RESULT_HEADINGS[results.status] : '',
      'results-context': results ? `${session.source === 'scripted' ? 'Scripted QA' : 'Free Play'} · ${results.board.rows} × ${results.board.columns} farm` : '',
      'results-points': results ? `${results.totalPoints} / ${results.target}` : '',
      'results-words': results?.wordCount ?? '',
      'results-strokes': results?.strokes ?? '',
      'results-territory': results?.basePoints ?? '',
      'results-bonus': results ? `+${results.bonusPoints}` : '',
      'results-crop-bonus': results ? `+${results.cropPoints}` : '',
      'results-fertility-bonus': results ? `+${results.fertilityPoints}` : '',
      'results-exchanges': results?.exchangeCount ?? '',
      'results-free-exchanges': results?.freeExchangesUsed ?? '',
      'results-charged-exchanges': results?.chargedExchanges ?? '',
      'results-crops': results?.captured.crops ?? '',
      'results-fertile': results?.captured.fertile ?? '',
      'results-livestock': results?.captured.livestock ?? '',
      'results-buildings': results?.captured.buildings ?? '',
    };
    for (const [id, value] of Object.entries(fields)) find(id).textContent = value;
  }
  return Object.freeze({ render });
}
