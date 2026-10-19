// Chargement des données des donjons (générées par `npm run fetch-data`)

export async function loadDungeonData() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/dungeons.json`);
  if (!res.ok) throw new Error(`Impossible de charger les donjons (${res.status})`);
  return res.json();
}

// Tranche de 10 niveaux : 1-10, 11-20, …, 191-200
export function bracketOf(level) {
  const start = Math.floor((Math.max(level, 1) - 1) / 10) * 10 + 1;
  return { start, end: start + 9 };
}
