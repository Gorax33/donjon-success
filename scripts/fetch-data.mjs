// Génère les données depuis DofusDB : npm run fetch-data
// - public/data/dungeons.json et public/data/classes.json
// - les images (boss, emblèmes de classe) dans public/img/, pour fonctionner hors ligne
// - le lien de chaque donjon vers sa page Dofus pour les Noobs
import { access, mkdir, writeFile } from 'node:fs/promises';
import { fetchDungeonData, fetchClasses } from '../src/dofusdb.js';
import { fetchGuideLinks } from './dpln.mjs';

const PUBLIC = new URL('../public/', import.meta.url);

async function writeJson(path, data) {
  const url = new URL(path, PUBLIC);
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, JSON.stringify(data, null, 2) + '\n');
}

// Télécharge l'image dans public/<folder>/ (si absente) et renvoie son chemin local
async function downloadImage(remoteUrl, folder) {
  const path = `${folder}/${remoteUrl.split('/').pop()}`;
  const target = new URL(path, PUBLIC);
  try {
    await access(target);
    return path;
  } catch {
    // Pas encore téléchargée
  }
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    console.warn(`Image introuvable (${res.status}) : ${remoteUrl}`);
    return remoteUrl;
  }
  await mkdir(new URL('.', target), { recursive: true });
  await writeFile(target, Buffer.from(await res.arrayBuffer()));
  return path;
}

// Exécute `task` sur chaque élément, quelques-uns à la fois
async function forEachLimited(items, limit, task) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length) await task(queue.shift());
  });
  await Promise.all(workers);
}

const data = await fetchDungeonData((msg) => console.log(msg));
const classes = await fetchClasses();

console.log('Téléchargement des images…');
const bosses = data.dungeons.map((d) => d.boss).filter((b) => b?.img);
await forEachLimited(bosses, 8, async (boss) => {
  boss.img = await downloadImage(boss.img, 'img/bosses');
});
await forEachLimited(classes, 8, async (c) => {
  c.img = await downloadImage(c.img, 'img/classes');
});

console.log('Recherche des pages Dofus pour les Noobs…');
try {
  const guides = await fetchGuideLinks(data.dungeons);
  for (const d of data.dungeons) d.guide = guides.get(d.id) ?? null;
  const missing = data.dungeons.filter((d) => !d.guide).map((d) => d.name);
  if (missing.length) console.warn(`Sans page DPLN : ${missing.join(', ')}`);
} catch (err) {
  // Le site est indisponible : on génère quand même les données, sans les liens
  console.warn(`Liens Dofus pour les Noobs ignorés : ${err.message}`);
}

await writeJson('data/dungeons.json', data);
await writeJson('data/classes.json', classes);

const achievementCount = data.dungeons.reduce((n, d) => n + d.achievements.length, 0);
const withZaap = data.dungeons.filter((d) => d.zaap).length;
console.log(
  `OK : ${data.dungeons.length} donjons (${withZaap} avec zaap), ${achievementCount} succès, ` +
    `${classes.length} classes`,
);
