// Génère public/data/dungeons.json depuis DofusDB : npm run fetch-data
import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDungeonData } from '../src/dofusdb.js';

const OUTPUT = new URL('../public/data/dungeons.json', import.meta.url);

const data = await fetchDungeonData((msg) => console.log(msg));

await mkdir(new URL('.', OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(data, null, 2) + '\n');

const achievementCount = data.dungeons.reduce((n, d) => n + d.achievements.length, 0);
console.log(`OK : ${data.dungeons.length} donjons, ${achievementCount} succès -> public/data/dungeons.json`);
