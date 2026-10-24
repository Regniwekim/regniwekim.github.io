/** A native modal keeps destructive choices keyboard accessible and returns focus on close. */
export function initializeSaveControls({ find }) {
  const dialog = find('save-confirm');
  let pending = null;
  function finish(accepted) {
    const callback = pending;
    pending = null;
    dialog.close();
    callback?.(accepted);
  }
  find('save-confirm-yes').addEventListener('click', () => finish(true));
  find('save-confirm-no').addEventListener('click', () => finish(false));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
  return {
    confirm(message, label, action) {
      if (pending) return;
      find('save-confirm-message').textContent = message;
      find('save-confirm-yes').textContent = label;
      pending = (accepted) => { if (accepted) action(); };
      dialog.showModal();
    },
    render(slot, diagnostic = false) {
      find('save-context').hidden = !slot;
      if (!slot) return;
      const { kind, message } = slot.info;
      const status = find('save-status');
      status.textContent = diagnostic ? 'QA fixture only. This fixture is not saved; your Free Play save is kept.' : message;
      status.setAttribute('role', ['invalid', 'unavailable', 'conflict'].includes(kind) && !diagnostic ? 'alert' : 'status');
      find('discard-save').hidden = diagnostic || kind !== 'invalid';
      find('reload-save').hidden = !diagnostic && kind !== 'conflict';
      find('reload-save').textContent = diagnostic && kind !== 'conflict' ? 'Resume Free Play' : 'Reload saved version';
      find('replace-save').hidden = diagnostic || kind !== 'conflict';
    },
  };
}
