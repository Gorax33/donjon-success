// Chargement des données (générées par `npm run fetch-data`) et petits utilitaires d'affichage

async function loadJson(path) {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
  return res.json();
}

export const loadDungeonData = () => loadJson('data/dungeons.json');
export const loadClasses = () => loadJson('data/classes.json');

// URL absolue d'un fichier de public/ (ou d'une image distante). Absolue pour rester
// valable une fois l'app déplacée dans la fenêtre flottante, qui a un autre document.
export function assetUrl(path) {
  return new URL(path, new URL(import.meta.env.BASE_URL, window.location.href)).href;
}

// Tranche de 10 niveaux : 1-10, 11-20, …, 191-200
export function bracketOf(level) {
  const start = Math.floor((Math.max(level, 1) - 1) / 10) * 10 + 1;
  return { start, end: start + 9 };
}

export function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}
