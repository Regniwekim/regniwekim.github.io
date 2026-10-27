/** Presentation destinations share one native modal layer. No gameplay or saved UI state. */
export function initializeInterface({ find }) {
  const destinations = ['game-menu', 'how-to-play', 'history', 'setup-panel',
    'game-details', 'board-options', 'about', 'developer-panel'];
  let active = null;
  let returnTo = null;

  function focus(node) { node?.focus({ preventScroll: true }); }
  function close(restore = true) {
    if (!active) return;
    const dialog = find(active), opener = returnTo;
    active = null;
    returnTo = null;
    dialog.close();
    if (restore) focus(opener);
  }
  function open(id, opener = document.activeElement) {
    // A destination launched from the menu inherits its visible header opener.
    const origin = active ? returnTo : opener;
    close(false);
    active = id;
    returnTo = origin;
    find(id).showModal();
  }
  for (const id of destinations) {
    find(`close-${id}`).addEventListener('click', () => close());
    find(id).addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    find(id).addEventListener('close', () => {
      // Ignore queued close events from a transition, including a reopened dialog.
      if (active === id && !find(id).open) {
        const opener = returnTo;
        active = null; returnTo = null;
        focus(opener);
      }
    });
  }
  const links = { 'open-menu': 'game-menu', 'open-help': 'how-to-play',
    'open-history': 'history', 'open-details': 'game-details',
    'open-about': 'about', 'open-development': 'developer-panel',
    'open-board-options': 'board-options' };
  for (const [id, destination] of Object.entries(links)) {
    // History also has result/recovery entry points, bound by its existing view.
    if (id !== 'open-history') find(id).addEventListener('click', () => open(destination, find(id)));
  }
  return { open, close, ready() {
    for (const id of Object.keys(links)) find(id).disabled = false;
  }, get isOpen() { return active !== null; },
    suspendForConfirmation() {
      const previous = active, opener = returnTo, control = document.activeElement;
      close(false);
      return (accepted) => {
        if (previous && (!accepted || previous === 'history')) {
          open(previous, opener);
          if (!control?.disabled && !control?.hidden) focus(control);
        } else if (previous || control?.hidden || control?.disabled) focus(find('board'));
      };
    },
  };
}
