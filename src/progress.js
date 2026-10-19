// Sauvegarde de la progression dans le navigateur (localStorage).
// {
//   version, activeCharacterId,
//   characters: [{ id, name, classId, color }],
//   done: { [characterId]: { [achievementId]: true } },
//   notes: { [dungeonId]: "texte" },   // communes à tous les personnages
// }

const STORAGE_KEY = 'dofus-success-state';
const VERSION = 1;

export const DEFAULT_COLOR = '#d9a441';

function defaultState() {
  return {
    version: VERSION,
    activeCharacterId: 'c1',
    characters: [{ id: 'c1', name: 'Personnage 1', classId: null, color: DEFAULT_COLOR }],
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

// Valide (ou dévalide) plusieurs succès d'un coup, avec une seule sauvegarde
export function setManyDone(achievementIds, done) {
  const map = activeDone();
  for (const id of achievementIds) {
    if (done) map[id] = true;
    else delete map[id];
  }
  save();
}

export function countDone(achievementIds) {
  const map = activeDone();
  return achievementIds.filter((id) => map[id]).length;
}

// ---- Notes par donjon ----

export function getNote(dungeonId) {
  return state.notes?.[dungeonId] ?? '';
}

export function setNote(dungeonId, text) {
  state.notes ??= {};
  if (text.trim()) state.notes[dungeonId] = text;
  else delete state.notes[dungeonId];
  save();
}

// ---- Personnages ----

export function getCharacters() {
  return state.characters;
}

export function getActiveCharacterId() {
  return state.activeCharacterId;
}

export function getActiveCharacter() {
  return state.characters.find((c) => c.id === state.activeCharacterId);
}

export function setActiveCharacter(id) {
  if (!state.characters.some((c) => c.id === id)) return;
  state.activeCharacterId = id;
  save();
}

// Crée un personnage { name, classId, color } et le rend actif ; renvoie son id
export function addCharacter({ name, classId, color }) {
  const id = `c${Date.now().toString(36)}`;
  state.characters.push({ id, name, classId, color });
  state.done[id] = {};
  state.activeCharacterId = id;
  save();
  return id;
}

export function updateCharacter(id, { name, classId, color }) {
  const character = state.characters.find((c) => c.id === id);
  if (!character) return;
  Object.assign(character, { name, classId, color });
  save();
}

// Supprime un personnage et sa progression (on en garde toujours au moins un)
export function deleteCharacter(id) {
  if (state.characters.length <= 1) return;
  state.characters = state.characters.filter((c) => c.id !== id);
  delete state.done[id];
  if (state.activeCharacterId === id) state.activeCharacterId = state.characters[0].id;
  save();
}
