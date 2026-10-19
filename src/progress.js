// Sauvegarde de la progression dans le navigateur (localStorage).
// Structure prévue pour plusieurs personnages (étape 5) :
// { version, activeCharacterId, characters: [{ id, name }], done: { [characterId]: { [achievementId]: true } } }

const STORAGE_KEY = 'dofus-success-state';
const VERSION = 1;

function defaultState() {
  return {
    version: VERSION,
    activeCharacterId: 'c1',
    characters: [{ id: 'c1', name: 'Personnage 1' }],
    done: { c1: {} },
  };
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === VERSION) return saved;
  } catch {
    // Sauvegarde illisible : on repart de zéro
  }
  return defaultState();
}

const state = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée…) : la progression reste en mémoire
  }
}

function activeDone() {
  return (state.done[state.activeCharacterId] ??= {});
}

export function isDone(achievementId) {
  return !!activeDone()[achievementId];
}

export function setDone(achievementId, done) {
  const map = activeDone();
  if (done) map[achievementId] = true;
  else delete map[achievementId];
  save();
}

export function countDone(achievementIds) {
  const map = activeDone();
  return achievementIds.filter((id) => map[id]).length;
}
