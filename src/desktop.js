// Spécificités de l'app de bureau (Tauri). Dans le navigateur, rien de tout ça ne s'exécute.

const PIN_KEY = 'always-on-top';

export function isTauri() {
  return '__TAURI_INTERNALS__' in window;
}

function loadPinned() {
  try {
    return localStorage.getItem(PIN_KEY) !== 'false';
  } catch {
    return true;
  }
}

function savePinned(pinned) {
  try {
    localStorage.setItem(PIN_KEY, String(pinned));
  } catch {
    // Stockage indisponible : la fenêtre repartira épinglée
  }
}

/** Bouton 📌 qui active ou désactive "toujours au premier plan" (actif par défaut) */
export async function setupPinButton(buttonEl) {
  // Import à la demande : le module n'a de sens que dans Tauri
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const win = getCurrentWindow();

  async function apply(pinned) {
    await win.setAlwaysOnTop(pinned);
    buttonEl.classList.toggle('pinned', pinned);
    buttonEl.title = pinned
      ? 'Toujours au premier plan (cliquer pour désactiver)'
      : 'Cliquer pour garder la fenêtre au premier plan';
    savePinned(pinned);
  }

  let pinned = loadPinned();
  buttonEl.hidden = false;
  buttonEl.addEventListener('click', () => {
    pinned = !pinned;
    apply(pinned);
  });
  await apply(pinned);
}
