// Outils partagés par les onglets Donjons et Monstres : commande de trajet, copie, recherche.

// Commande à coller dans le chat du jeu : autopilote jusqu'à la destination.
// (Le zaap le plus proche est seulement affiché à titre indicatif, sans commande /zaap.)
export function travelCommand({ entrance }) {
  if (!entrance) return null;
  return `/travel ${entrance.x},${entrance.y}`;
}

// Copie dans le presse-papiers du document de l'élément (la fenêtre flottante en est un autre)
export async function copyText(text, fromEl) {
  const win = fromEl.ownerDocument.defaultView;
  try {
    await win.navigator.clipboard.writeText(text);
  } catch {
    // Repli si l'API presse-papiers est refusée
    const area = fromEl.ownerDocument.createElement('textarea');
    area.value = text;
    fromEl.ownerDocument.body.append(area);
    area.select();
    fromEl.ownerDocument.execCommand('copy');
    area.remove();
  }
}

// Retour visuel ✓ sur un bouton après une copie
export function flashCopied(btn, label = btn.textContent) {
  btn.textContent = '✓';
  btn.classList.add('copied');
  setTimeout(() => {
    btn.textContent = label;
    btn.classList.remove('copied');
  }, 1200);
}

// Minuscules et sans accents : "Épave" trouve "epave"
export function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
