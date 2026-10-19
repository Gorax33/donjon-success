// Fenêtre flottante "toujours au premier plan" via l'API Document Picture-in-Picture
// (Chrome / Edge 116+). L'élément de l'app est déplacé dans la fenêtre flottante,
// puis remis à sa place à la fermeture : les écouteurs d'événements sont conservés.
//
// Important pour la suite du dev : une fois détachée, l'app vit dans un autre
// `document`. Toujours chercher les éléments depuis la racine de l'app
// (appEl.querySelector) plutôt que via `document.querySelector`.

const SIZE_KEY = 'pip-size';
const DEFAULT_SIZE = { width: 360, height: 600 };

export function isPipSupported() {
  return 'documentPictureInPicture' in window;
}

function loadSize() {
  try {
    return { ...DEFAULT_SIZE, ...JSON.parse(localStorage.getItem(SIZE_KEY)) };
  } catch {
    return DEFAULT_SIZE;
  }
}

function saveSize(width, height) {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify({ width, height }));
  } catch {
    // Stockage indisponible : on garde simplement la taille par défaut
  }
}

// Recopie les feuilles de style de la page dans la fenêtre flottante
function copyStyles(targetDoc) {
  for (const sheet of document.styleSheets) {
    try {
      const style = targetDoc.createElement('style');
      style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
      targetDoc.head.append(style);
    } catch {
      // Feuille externe dont les règles ne sont pas lisibles : on la relie directement
      const link = targetDoc.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet.href;
      targetDoc.head.append(link);
    }
  }
}

/**
 * Détache `appEl` dans une fenêtre flottante.
 * `onClose` est appelé quand la fenêtre est fermée (l'app est alors déjà remise en place).
 */
export async function openPip(appEl, { onOpen, onClose } = {}) {
  const existing = window.documentPictureInPicture.window;
  if (existing) {
    existing.focus();
    return;
  }

  const { width, height } = loadSize();
  const pipWindow = await window.documentPictureInPicture.requestWindow({ width, height });

  pipWindow.document.title = document.title;
  copyStyles(pipWindow.document);

  // Repère pour remettre l'app exactement à sa place
  const anchor = document.createComment('app-anchor');
  appEl.before(anchor);
  pipWindow.document.body.append(appEl);
  pipWindow.document.documentElement.classList.add('in-pip');

  pipWindow.addEventListener('resize', () => {
    saveSize(pipWindow.innerWidth, pipWindow.innerHeight);
  });

  pipWindow.addEventListener('pagehide', () => {
    anchor.replaceWith(appEl);
    onClose?.();
  });

  onOpen?.();
}

export function closePip() {
  window.documentPictureInPicture?.window?.close();
}
