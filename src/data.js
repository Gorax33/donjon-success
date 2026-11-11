// Chargement des données (générées par `npm run fetch-data`, ou mises à jour depuis l'app)
// et petits utilitaires d'affichage

async function loadJson(path) {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
  return res.json();
}

// ---- Données des donjons, et leur mise à jour depuis DofusDB ----

// Données téléchargées par le bouton de mise à jour, gardées dans le navigateur
const UPDATE_KEY = 'dungeon-data-update';

function readUpdate() {
  try {
    return JSON.parse(localStorage.getItem(UPDATE_KEY));
  } catch {
    return null;
  }
}

const loadBundledData = () => loadJson('data/dungeons.json');

/**
 * Données des donjons : la mise à jour téléchargée si elle est plus récente que
 * celle livrée avec l'app, sinon celle de l'app. `source` vaut 'update' ou 'bundled'.
 */
export async function loadDungeonData() {
  const bundled = await loadBundledData();
  const update = readUpdate();
  if (update && update.generatedAt > bundled.generatedAt) return { ...update, source: 'update' };
  return { ...bundled, source: 'bundled' };
}

/**
 * Télécharge les données depuis DofusDB et les garde dans le navigateur.
 * Les liens Dofus pour les Noobs et les images de boss locales sont repris des données
 * actuelles (le navigateur ne peut pas les récupérer lui-même).
 * Renvoie ce qui a changé : { dungeons, achievements, addedDungeons, addedAchievements }.
 */
export async function updateDungeonData(current, onProgress) {
  const { fetchDungeonData } = await import('./dofusdb.js');
  const fresh = await fetchDungeonData(onProgress);

  const currentById = new Map(current.dungeons.map((d) => [d.id, d]));
  for (const d of fresh.dungeons) {
    const known = currentById.get(d.id);
    d.guide = known?.guide ?? null;
    if (known?.boss && d.boss?.id === known.boss.id) d.boss.img = known.boss.img;
  }

  const knownAchievements = new Set(current.dungeons.flatMap((d) => d.achievements.map((a) => a.id)));
  const freshAchievements = fresh.dungeons.flatMap((d) => d.achievements);
  const changes = {
    dungeons: fresh.dungeons.length,
    achievements: freshAchievements.length,
    addedDungeons: fresh.dungeons.filter((d) => !currentById.has(d.id)).map((d) => d.name),
    addedAchievements: freshAchievements.filter((a) => !knownAchievements.has(a.id)).length,
  };

  try {
    localStorage.setItem(UPDATE_KEY, JSON.stringify(fresh));
  } catch {
    throw new Error("Impossible d'enregistrer les nouvelles données dans le navigateur.");
  }
  return changes;
}

/** Oublie la mise à jour téléchargée : l'app reprend les données livrées avec elle */
export function resetDungeonData() {
  try {
    localStorage.removeItem(UPDATE_KEY);
  } catch {
    // Rien à effacer
  }
}
export const loadClasses = () => loadJson('data/classes.json');
export const loadMonsterData = () => loadJson('data/monsters.json');

// Donjons dont le boss a une mécanique à connaître : { [dungeonId]: { summary, details: [] } }.
// Fichier rédigé à la main (d'après les guides Dofus pour les Noobs), non régénéré.
export const loadMechanics = () => loadJson('data/mechanics.json').catch(() => ({}));

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
