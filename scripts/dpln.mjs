// Associe chaque donjon à sa page sur Dofus pour les Noobs (DPLN), à partir de la
// page qui les liste tous. Exécuté par le script Node : le site n'autorise pas sa
// lecture depuis une page web (CORS).

const SITE = 'https://www.dofuspourlesnoobs.com';
const DUNGEONS_PAGE = `${SITE}/donjons.html`;

const ENTITIES = { amp: '&', nbsp: ' ', apos: "'", quot: '"', oelig: 'œ' };

// "Ch&acirc;teau" -> "Château"
function decodeEntities(text) {
  return text.replace(/&(#\d+|[a-z]+);/gi, (m, code) => {
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    if (ENTITIES[code]) return ENTITIES[code];
    // &eacute; &agrave; &icirc; &iuml;… : la lettre suivie de son accent
    const accent = { acute: '́', grave: '̀', circ: '̂', uml: '̈', cedil: '̧' };
    const [, letter, kind] = code.match(/^([a-z])(acute|grave|circ|uml|cedil)$/i) ?? [];
    return letter ? (letter + accent[kind]).normalize('NFC') : m;
  });
}

// Comparaison tolérante : sans accents, sans ponctuation, "œ" = "oe"
function normalize(text) {
  return text
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Renvoie une Map id de donjon -> URL de sa page DPLN.
 * Les donjons introuvables n'y figurent pas.
 */
export async function fetchGuideLinks(dungeons) {
  const res = await fetch(DUNGEONS_PAGE, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Dofus pour les Noobs a répondu ${res.status}`);
  const html = await res.text();

  const links = new Map(); // texte normalisé -> URL
  for (const [, href, inner] of html.matchAll(/<a[^>]+href="(\/[^"#?]+\.html)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const text = normalize(decodeEntities(inner.replace(/<[^>]+>/g, '')));
    if (text && !links.has(text)) links.set(text, SITE + href);
  }

  const result = new Map();
  const remaining = [];
  // 1. Nom identique
  for (const d of dungeons) {
    const url = links.get(normalize(d.name));
    if (url) result.set(d.id, url);
    else remaining.push(d);
  }
  // 2. Intitulé abrégé contenu dans le nom ("Bworks" -> "Donjon des Bworks"), le plus long
  //    d'abord, en ignorant les pages déjà attribuées ("Nowel" ne doit pas reprendre
  //    "Caverne de Nowel")
  const used = new Set(result.values());
  const candidates = [...links].filter(([, url]) => !used.has(url)).sort((a, b) => b[0].length - a[0].length);
  for (const d of remaining) {
    const name = ` ${normalize(d.name)} `;
    const match = candidates.find(([text]) => text.length >= 4 && name.includes(` ${text} `));
    if (match) result.set(d.id, match[1]);
  }
  return result;
}
