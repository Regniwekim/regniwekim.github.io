import { estimateAutomaticTarget } from '../analysis/automatic-target.js';

/** Setup-only calculation. Editing fields invalidates the preview, never the active run. */
export function initializeTargetSetup({ find, isRackMode, estimate = estimateAutomaticTarget }) {
  const form = find('dimensions'), mode = find('target-mode'), manual = find('target');
  let current = null;
  const configuration = () => ({ rows: Number(find('rows').value), columns: Number(find('columns').value),
    seed: find('seed').value, farmSeed: find('farm-seed').value, farmDensity: Number(find('farm-density').value) });
  function invalidate() {
    current = null;
    const automatic = mode.value === 'automatic';
    manual.disabled = !isRackMode() || automatic;
    manual.required = isRackMode() && !automatic;
    find('manual-target').hidden = automatic;
    find('automatic-target').hidden = !automatic;
    find('target-preview').textContent = 'Calculate an estimated target for the current settings before starting.';
  }
  function calculate() {
    if (!form.reportValidity()) return null;
    const settings = configuration();
    const report = estimate(settings);
    current = { key: JSON.stringify(settings), report };
    find('target-preview').textContent = report.available
      ? `Estimated target: ${report.target} farm points. Based on the generated board and letter distribution. Experimental; some puzzles may be more difficult than others. Reachability is not guaranteed.`
      : `Automatic target unavailable. ${report.message}`;
    return report;
  }
  form.addEventListener('input', invalidate);
  mode.addEventListener('change', invalidate);
  find('calculate-target').addEventListener('click', calculate);
  invalidate();
  return { configuration, invalidate, calculate,
    resolve() {
      if (mode.value === 'manual') return { ...configuration(), targetMode: 'manual', target: Number(manual.value) };
      const key = JSON.stringify(configuration());
      // A changed or uncalculated setup must expose its estimate before any puzzle starts.
      if (current?.key !== key) { calculate(); return null; }
      return current.report.available ? { ...configuration(), targetMode: 'automatic' } : null;
    } };
}
