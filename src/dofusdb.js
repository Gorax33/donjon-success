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

// Récupère toutes les pages d'un endpoint
async function fetchAll(endpoint, select) {
  const fields = select.map((f) => `$select[]=${f}`).join('&');
  const items = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await getJson(`${API}/${endpoint}?$limit=${PAGE_SIZE}&$skip=${skip}&${fields}`);
    items.push(...page.data);
    if (skip + PAGE_SIZE >= page.total) return items;
  }
}

// Récupère des éléments par identifiant, par lots
async function fetchByIds(endpoint, ids, select) {
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

/**
 * Construit la liste des donjons avec leurs succès.
 * `onProgress(message)` permet d'afficher l'avancement.
 */
export async function fetchDungeonData(onProgress = () => {}) {
  onProgress('Récupération des donjons…');
  const rawDungeons = (
    await fetchAll('dungeons', ['id', 'name', 'optimalPlayerLevel', 'achievements'])
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

  const monsterIds = [...new Set(challenges.map((c) => c.targetMonsterId).filter((id) => id > 0))];
  onProgress(`Récupération de ${monsterIds.length} monstres ciblés…`);
  const monsters = await fetchByIds('monsters', monsterIds, ['id', 'name']);
  const monsterNameById = new Map(monsters.map((m) => [m.id, m.name.fr]));

  const result = dungeons.map((d) => ({
    id: d.id,
    name: d.name.fr,
    level: d.optimalPlayerLevel,
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
  }));

  result.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'fr'));

  return {
    generatedAt: new Date().toISOString(),
    source: API,
    dungeons: result,
  };
}
