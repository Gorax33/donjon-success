// Récupération des donjons et de leurs succès depuis l'API publique DofusDB.
// Utilisé par le script Node (scripts/fetch-data.mjs) et, plus tard, par le
// bouton de mise à jour dans le navigateur : n'utiliser que `fetch`, pas d'API Node.

const API = 'https://api.dofusdb.fr';
const PAGE_SIZE = 50; // Maximum accepté par l'API

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DofusDB a répondu ${res.status} pour ${url}`);
  return res.json();
}

// Récupère toutes les pages d'un endpoint (`filter` : critères en plus, ex. "categoryId=9")
export async function fetchAll(endpoint, select, filter = '') {
  const fields = select.map((f) => `$select[]=${f}`).join('&');
  const items = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await getJson(
      `${API}/${endpoint}?$limit=${PAGE_SIZE}&$skip=${skip}&${fields}${filter && `&${filter}`}`,
    );
    items.push(...page.data);
    if (skip + PAGE_SIZE >= page.total) return items;
  }
}

// Récupère des éléments par identifiant, par lots
export async function fetchByIds(endpoint, ids, select) {
  const fields = select.map((f) => `$select[]=${f}`).join('&');
  const items = [];
  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const batch = ids.slice(i, i + PAGE_SIZE);
    const filter = batch.map((id) => `id[$in][]=${id}`).join('&');
    const page = await getJson(`${API}/${endpoint}?$limit=${PAGE_SIZE}&${filter}&${fields}`);
    items.push(...page.data);
  }
  return items;
}

// Remplit les variables des descriptions de challenge :
// - {0} : le monstre ciblé ("{0} doit être achevé en premier")
// - {1} : la valeur du critère ("en moins de {1} tours" avec "ST<20")
function challengeDescription(challenge, monsterNameById) {
  let text = challenge.description.fr;
  const monster = monsterNameById.get(challenge.targetMonsterId);
  if (monster) text = text.replaceAll('{0}', monster);
  const value = challenge.completionCriterion?.match(/\d+/)?.[0];
  if (value) text = text.replaceAll('{1}', value);
  return text;
}

// Zones du continent, reliées à pied : Amakna, Sufokia, Abraknydes, Bonta, Cania, Brâkmar,
// Sidimote, Foire du Trool, Astrub, Koalaks, Forêt Maléfique. Les îles (Otomaï, Frigost,
// Pandala…) et les dimensions sont chacune isolées : l'autopilote ne traverse pas la mer.
const CONTINENT_AREAS = new Set([0, 5, 6, 7, 8, 11, 12, 15, 18, 28, 92]);

// Groupe de zones accessible à pied depuis une zone
const regionOf = (areaId) => (CONTINENT_AREAS.has(areaId) ? 'continent' : areaId);

// Zaap le plus proche de l'entrée d'un donjon (distance en cartes, déplacements en croix),
// parmi ceux de la même région. Aucun (île sans zaap, dimension…) : null, seul /travel
// sera proposé. `entrance` et chaque zaap ont { x, y, areaId }.
export function nearestZaap(entrance, zaaps) {
  const region = regionOf(entrance.areaId);
  const distance = (z) => Math.abs(z.x - entrance.x) + Math.abs(z.y - entrance.y);
  return zaaps
    .filter((z) => regionOf(z.areaId) === region)
    .reduce((best, z) => (!best || distance(z) < distance(best) ? z : best), null);
}

/** Liste des classes jouables : [{ id, name, img }] */
export async function fetchClasses() {
  const breeds = await fetchAll('breeds', ['id', 'shortName', 'img', 'sortIndex']);
  return breeds
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((b) => ({ id: b.id, name: b.shortName.fr, img: b.img }));
}

/**
 * Construit la liste des donjons avec leurs succès.
 * `onProgress(message)` permet d'afficher l'avancement.
 */
export async function fetchDungeonData(onProgress = () => {}) {
  onProgress('Récupération des donjons…');
  const rawDungeons = (
    await fetchAll('dungeons', [
      'id', 'name', 'optimalPlayerLevel', 'achievements', 'entranceMapId', 'bosses',
    ])
  ).filter((d) => d.achievements?.length > 0); // Exclut les Expéditions, sans succès

  // Un donjon dont tous les succès appartiennent déjà à des donjons plus petits est
  // un regroupement (ex. Tempête de l'Eliocalypse = les 4 Cavaliers) : on l'ignore
  const isAggregate = (d) =>
    d.achievements.every((id) =>
      rawDungeons.some(
        (other) => other.achievements.length < d.achievements.length && other.achievements.includes(id),
      ),
    );
  const dungeons = rawDungeons.filter((d) => !isAggregate(d));

  const achievementIds = [...new Set(dungeons.flatMap((d) => d.achievements))];
  onProgress(`Récupération de ${achievementIds.length} succès…`);
  const achievements = await fetchByIds('achievements', achievementIds, [
    'id', 'name', 'description', 'points', 'level', 'order',
  ]);
  const achievementById = new Map(achievements.map((a) => [a.id, a]));

  // Les succès de challenge citent leur challenge : "[challenge,52]"
  const challengeIdOf = (a) => Number(a.description.fr.match(/\[challenge,(\d+)\]/)?.[1]) || null;
  const challengeIds = [...new Set(achievements.map(challengeIdOf).filter(Boolean))];
  onProgress(`Récupération de ${challengeIds.length} challenges…`);
  const challenges = await fetchByIds('challenges', challengeIds, [
    'id', 'name', 'description', 'completionCriterion', 'targetMonsterId',
  ]);
  const challengeById = new Map(challenges.map((c) => [c.id, c]));

  // Monstres ciblés par les challenges + boss principal de chaque donjon
  const bossIdOf = (d) => d.bosses?.[0];
  const monsterIds = [
    ...new Set([
      ...challenges.map((c) => c.targetMonsterId).filter((id) => id > 0),
      ...dungeons.map(bossIdOf).filter(Boolean),
    ]),
  ];
  onProgress(`Récupération de ${monsterIds.length} monstres…`);
  const monsters = await fetchByIds('monsters', monsterIds, ['id', 'name', 'gfxId', 'img']);
  const monsterById = new Map(monsters.map((m) => [m.id, m]));
  const monsterNameById = new Map(monsters.map((m) => [m.id, m.name.fr]));

  onProgress('Récupération des entrées et des zaaps…');
  const positions = await fetchByIds(
    'map-positions',
    [...new Set(dungeons.map((d) => d.entranceMapId))],
    ['id', 'posX', 'posY', 'subAreaId'],
  );
  const zaapHints = await fetchAll('hints', ['x', 'y', 'subareaId'], 'categoryId=9&gfx=410');

  // Zone (Amakna, Frigost, Srambad…) de chaque entrée et de chaque zaap, via leur sous-zone
  const subareas = await fetchByIds(
    'subareas',
    [...new Set([...positions.map((p) => p.subAreaId), ...zaapHints.map((z) => z.subareaId)])],
    ['id', 'areaId'],
  );
  const areaIdOfSubarea = new Map(subareas.map((s) => [s.id, s.areaId]));
  const locate = (x, y, subareaId) => ({ x, y, areaId: areaIdOfSubarea.get(subareaId) });

  const entranceByMapId = new Map(
    positions.map((p) => [p.id, locate(p.posX, p.posY, p.subAreaId)]),
  );
  const zaaps = zaapHints.map((z) => locate(z.x, z.y, z.subareaId));

  const result = dungeons.map((d) => {
    const boss = monsterById.get(bossIdOf(d));
    const entrance = entranceByMapId.get(d.entranceMapId);
    const zaap = entrance && nearestZaap(entrance, zaaps);
    return {
      id: d.id,
      name: d.name.fr,
      level: d.optimalPlayerLevel,
      boss: boss ? { id: boss.id, name: boss.name.fr, img: boss.img } : null,
      entrance: entrance ? { x: entrance.x, y: entrance.y } : null,
      zaap: zaap ? { x: zaap.x, y: zaap.y } : null,
      achievements: d.achievements
        .map((id) => achievementById.get(id))
        .filter(Boolean)
        .map((a) => {
          const challenge = challengeById.get(challengeIdOf(a));
          return {
            id: a.id,
            name: a.name.fr,
            level: a.level,
            points: a.points,
            order: a.order,
            challenge: challenge
              ? {
                  id: challenge.id,
                  name: challenge.name.fr,
                  description: challengeDescription(challenge, monsterNameById),
                }
              : null,
          };
        })
        // Par boss (niveau, pour les donjons à plusieurs boss), puis la victoire
        // simple d'abord, puis l'ordre du jeu
        .sort(
          (x, y) =>
            x.level - y.level ||
            Number(!!x.challenge) - Number(!!y.challenge) ||
            x.order - y.order,
        )
        .map(({ order, ...a }) => a),
    };
  });

  result.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'fr'));

  return {
    generatedAt: new Date().toISOString(),
    source: API,
    dungeons: result,
  };
}
