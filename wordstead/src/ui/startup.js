/** Keep the complete game inert until one successful vocabulary preparation. */
export function createGameStartup({ container, status, retry, load, start }) {
  let pending = null;
  let ready = false;
  let starting = false;
  container.inert = true;
  container.setAttribute('aria-busy', 'true');
  function begin() {
    if (pending) return pending;
    status.textContent = 'Loading English vocabulary… Gameplay will be ready shortly.';
    status.setAttribute('role', 'status');
    retry.hidden = true;
    pending = Promise.resolve().then(load).then((result) => {
      starting = true;
      start(result);
      ready = true;
      container.inert = false;
      container.setAttribute('aria-busy', 'false');
      status.textContent = `${result.vocabulary.name} · ${result.vocabulary.count.toLocaleString('en-US')} words ready.`;
      return result;
    }).catch(() => {
      status.textContent = starting
        ? 'The game could not initialize. Reload this page to try again.'
        : 'English vocabulary could not be loaded. Check your connection and retry. Gameplay has not started.';
      status.setAttribute('role', 'alert');
      retry.hidden = starting;
      return null;
    }).finally(() => { if (!ready && !starting) pending = null; });
    return pending;
  }
  retry.addEventListener('click', begin);
  return Object.freeze({ start: begin });
}
