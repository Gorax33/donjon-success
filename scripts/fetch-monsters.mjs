// Génère public/data/monsters.json depuis DofusDB : npm run fetch-monsters
// Succès de la catégorie « Monstres » (mêmes sous-catégories que dans le jeu), les monstres à
// vaincre et leurs zones : coordonnées, intérieur/souterrain, donjon, zaap le plus pratique.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchAll, fetchByIds, nearestZaap } from '../src/dofusdb.js';

const OUTPUT = new URL('../public/data/monsters.json', import.meta.url);
const MONSTERS_CATEGORY = 25; // Catégorie « Monstres » du jeu

const log = (msg) => console.log(msg);

// ---- Succès ----

log('Récupération des catégories et des succès…');
const categories = (await fetchAll('achievement-categories', ['id', 'parentId', 'name', 'order', 'achievementIds']))
  .filter((c) => c.parentId === MONSTERS_CATEGORY)
  .sort((a, b) => a.order - b.order);

const achievements = await fetchByIds(
  'achievements',
  categories.flatMap((c) => c.achievementIds),
  ['id', 'name', 'description', 'objectiveIds', 'points', 'order', 'categoryId'],
);
const objectives = await fetchByIds(
  'achievement-objectives',
  achievements.flatMap((a) => a.objectiveIds),
  ['id', 'achievementId', 'order', 'criterion'],
);

// Critères des objectifs : (Ef>id,0) vaincre un monstre, (OA=id) obtenir un autre succès,
// PL>n niveau requis, (EA>n) nombre de challenges réussis (pas suivi en détail)
const parsedByAchievement = new Map();
for (const o of objectives.sort((a, b) => a.order - b.order)) {
  const p = parsedByAchievement.get(o.achievementId) ?? { monsters: [], requires: [], level: null };
  let m;
  if ((m = o.criterion.match(/Ef>(\d+)/))) p.monsters.push(Number(m[1]));
  else if ((m = o.criterion.match(/OA=(\d+)/))) p.requires.push(Number(m[1]));
  else if ((m = o.criterion.match(/PL>(\d+)/))) p.level = Number(m[1]) + 1;
  parsedByAchievement.set(o.achievementId, p);
}

// ---- Monstres ----

const monsterIds = [...new Set([...parsedByAchievement.values()].flatMap((p) => p.monsters))];
log(`Récupération de ${monsterIds.length} monstres…`);
const monsters = await fetchByIds('monsters', monsterIds, [
  'id', 'name', 'gfxId', 'img', 'subareas', 'grades', 'isBoss', 'isMiniBoss',
]);

// ---- Zones ----

const zoneIds = [...new Set(monsters.flatMap((m) => m.subareas ?? []))];
log(`Récupération de ${zoneIds.length} zones…`);
const subareas = await fetchByIds('subareas', zoneIds, [
  'id', 'name', 'areaId', 'mapIds', 'dungeonId', 'associatedZaapMapId',
]);

const zaapHints = await fetchAll('hints', ['x', 'y', 'subareaId', 'mapId'], 'categoryId=9&gfx=410');
// Sous-zones des zaaps, pour connaître leur zone (Amakna, Frigost…)
const zaapSubareas = await fetchByIds(
  'subareas',
  [...new Set(zaapHints.map((z) => z.subareaId))].filter((id) => !zoneIds.includes(id)),
  ['id', 'areaId'],
);
const areaIdOfSubarea = new Map([...subareas, ...zaapSubareas].map((s) => [s.id, s.areaId]));
const zaaps = zaapHints.map((z) => ({ x: z.x, y: z.y, mapId: z.mapId, areaId: areaIdOfSubarea.get(z.subareaId) }));
const zaapByMapId = new Map(zaaps.map((z) => [z.mapId, z]));

const areas = await fetchByIds('areas', [...new Set(subareas.map((s) => s.areaId))], ['id', 'name']);
const areaName = new Map(areas.map((a) => [a.id, a.name.fr]));

const dungeonIds = [...new Set(subareas.map((s) => s.dungeonId).filter((id) => id > 0))];
const dungeons = await fetchByIds('dungeons', dungeonIds, ['id', 'name']);
const dungeonName = new Map(dungeons.map((d) => [d.id, d.name.fr]));

const mapIds = [...new Set(subareas.flatMap((s) => s.mapIds ?? []))];
log(`Récupération de ${mapIds.length} cartes (coordonnées)…`);
const positions = await fetchByIds('map-positions', mapIds, ['id', 'posX', 'posY', 'outdoor']);
const positionById = new Map(positions.map((p) => [p.id, p]));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// Donjons déjà connus (onglet Donjons) : on reprend leur entrée et leur zaap, car les cartes
// intérieures d'un donjon ont des coordonnées sans rapport avec sa position dans le monde
const { dungeons: knownDungeons } = JSON.parse(
  await readFile(new URL('../public/data/dungeons.json', import.meta.url), 'utf8'),
);
const knownDungeonById = new Map(knownDungeons.map((d) => [d.id, d]));

const zones = {};
for (const s of subareas) {
  const dungeon = knownDungeonById.get(s.dungeonId);
  if (dungeon?.entrance) {
    zones[s.id] = {
      name: s.name.fr,
      area: areaName.get(s.areaId) ?? '',
      x: dungeon.entrance.x,
      y: dungeon.entrance.y,
      indoor: true,
      dungeon: { id: dungeon.id, name: dungeon.name },
      zaap: dungeon.zaap,
    };
    continue;
  }

  // Cartes en [0,0] : coordonnées non renseignées (fréquent pour les intérieurs), écartées
  const allMaps = (s.mapIds ?? []).map((id) => positionById.get(id)).filter(Boolean);
  // Aucune carte placée (instances d'événement…) : zone ignorée
  const maps = allMaps.filter((p) => p.posX !== 0 || p.posY !== 0);
  if (!maps.length) continue;
  // Intérieur/souterrain : aucune carte en extérieur (égouts, grottes, laboratoires…)
  const outdoorMaps = maps.filter((p) => p.outdoor);
  const indoor = outdoorMaps.length === 0;
  // Coordonnées représentatives : la carte la plus proche du centre de la zone
  const candidates = indoor ? maps : outdoorMaps;
  const cx = median(candidates.map((p) => p.posX));
  const cy = median(candidates.map((p) => p.posY));
  const center = candidates.reduce((best, p) =>
    Math.abs(p.posX - cx) + Math.abs(p.posY - cy) < Math.abs(best.posX - cx) + Math.abs(best.posY - cy) ? p : best,
  );
  const coords = { x: center.posX, y: center.posY, areaId: s.areaId };
  // Zaap : celui que le jeu associe à la zone, sinon le plus proche accessible à pied
  const zaap = zaapByMapId.get(s.associatedZaapMapId) ?? (indoor ? null : nearestZaap(coords, zaaps));
  zones[s.id] = {
    name: s.name.fr,
    area: areaName.get(s.areaId) ?? '',
    x: center.posX,
    y: center.posY,
    indoor,
    dungeon: s.dungeonId > 0 ? { id: s.dungeonId, name: dungeonName.get(s.dungeonId) ?? '' } : null,
    zaap: zaap ? { x: zaap.x, y: zaap.y } : null,
  };
}

// Zone la plus pratique d'abord : en surface hors donjon, puis zaap le plus proche
const zoneScore = (id) => {
  const z = zones[id];
  const zaapDistance = z.zaap ? Math.abs(z.zaap.x - z.x) + Math.abs(z.zaap.y - z.y) : 50;
  return (z.dungeon ? 1000 : 0) + (z.indoor ? 100 : 0) + zaapDistance;
};

const monstersOut = {};
for (const m of monsters) {
  const levels = (m.grades ?? []).map((g) => g.level);
  monstersOut[m.id] = {
    name: m.name.fr,
    img: m.img ?? null,
    levels: levels.length ? [Math.min(...levels), Math.max(...levels)] : null,
    boss: !!(m.isBoss || m.isMiniBoss),
    zones: (m.subareas ?? []).filter((id) => zones[id]).sort((a, b) => zoneScore(a) - zoneScore(b)),
  };
}

// ---- Résultat ----

const achievementById = new Map(achievements.map((a) => [a.id, a]));
const data = {
  generatedAt: new Date().toISOString(),
  source: 'https://api.dofusdb.fr',
  categories: categories.map((c) => ({
    id: c.id,
    name: c.name.fr,
    achievements: c.achievementIds
      .map((id) => achievementById.get(id))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order)
      .map((a) => {
        const p = parsedByAchievement.get(a.id) ?? { monsters: [], requires: [], level: null };
        return {
          id: a.id,
          name: a.name.fr,
          description: a.description.fr,
          points: a.points,
          level: p.level,
          monsters: p.monsters.filter((id) => monstersOut[id]),
          requires: p.requires,
        };
      }),
  })),
  monsters: monstersOut,
  zones,
};

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(data) + '\n');

const achievementCount = data.categories.reduce((n, c) => n + c.achievements.length, 0);
log(
  `OK : ${data.categories.length} catégories, ${achievementCount} succès, ` +
    `${Object.keys(monstersOut).length} monstres, ${Object.keys(zones).length} zones`,
);
