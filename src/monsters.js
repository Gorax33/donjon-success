// Onglet Monstres : succès de la catégorie « Monstres » du jeu, rangés comme dans le jeu.
// Fenêtre large : catégories à gauche, succès à droite. Fenêtre étroite : la liste des
// catégories, puis le panneau de la catégorie choisie à la place (bouton ← pour revenir).
import { escapeHtml } from './data.js';
import { isDone, setDone, setManyDone, countDone } from './progress.js';
import { travelCommand, copyText, flashCopied, normalize } from './travel.js';

const SELECTED_KEY = 'monsters-category';
const WIDE_LAYOUT = 560; // px : au-delà, catégories et succès côte à côte

// Clés de progression (dans la même sauvegarde que les donjons, par personnage)
const monsterKey = (achievementId, monsterId) => `m:${achievementId}:${monsterId}`;
const manualKey = (achievementId) => `a:${achievementId}`;

const percent = (done, total) => (total ? Math.floor((done / total) * 100) : 0);

function loadSelected() {
  try {
    return Number(localStorage.getItem(SELECTED_KEY)) || null;
  } catch {
    return null;
  }
}

function saveSelected(id) {
  try {
    localStorage.setItem(SELECTED_KEY, String(id));
  } catch {
    // Stockage indisponible : on repartira sur la première catégorie
  }
}

// Bloc d'explication d'accès : { summary, steps, source, unknown }
function accessBlock(title, info) {
  if (!info) return '';
  return `
    <div class="m-access-block">
      <strong>${title}</strong>
      <p>${escapeHtml(info.summary)}${info.unknown ? ' <em>(à vérifier)</em>' : ''}</p>
      ${info.steps?.length ? `<ol>${info.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` : ''}
      ${info.source ? `<a href="${escapeHtml(info.source)}" target="_blank" rel="noopener">Source</a>` : ''}
    </div>`;
}

/**
 * Affiche l'onglet Monstres dans `viewEl` à partir de `data` (public/data/monsters.json)
 * et des explications d'accès `access` (public/data/access.json : areas, zones, dopeuls).
 * Renvoie { refreshProgress } à appeler après un changement de personnage.
 */
export function renderMonsters(viewEl, data, access = {}) {
  const { categories, monsters, zones } = data;
  const achievementById = new Map(categories.flatMap((c) => c.achievements.map((a) => [a.id, a])));
  const categoryOf = new Map(categories.flatMap((c) => c.achievements.map((a) => [a.id, c])));

  // ---- Progression ----

  // Cases à cocher d'un succès : une par monstre, ou une seule pour un succès sans monstre
  // (Dopeul, nombre de challenges). Un méta-succès (« Obtenir les succès suivants ») n'en a
  // pas : il se valide quand ses succès le sont.
  const keysOf = (a) =>
    a.monsters.length ? a.monsters.map((m) => monsterKey(a.id, m)) : a.requires.length ? [] : [manualKey(a.id)];

  // `path` : succès en cours de vérification, pour ne pas tourner en rond si deux
  // méta-succès se référençaient l'un l'autre
  function isComplete(a, path = new Set()) {
    const keys = keysOf(a);
    if (countDone(keys) < keys.length) return false;
    if (path.has(a.id)) return false;
    path.add(a.id);
    const ok = a.requires.every((id) => achievementById.has(id) && isComplete(achievementById.get(id), path));
    path.delete(a.id);
    return ok;
  }

  // Avancement d'un succès : cases cochées, ou succès requis obtenus pour un méta-succès
  function progressOf(a) {
    const keys = keysOf(a);
    if (keys.length) return { done: countDone(keys), total: keys.length };
    return {
      done: a.requires.filter((id) => achievementById.has(id) && isComplete(achievementById.get(id))).length,
      total: a.requires.length,
    };
  }

  // Avancement d'une catégorie : toutes ses cases à cocher
  function categoryProgress(c) {
    const keys = c.achievements.flatMap(keysOf);
    return { done: countDone(keys), total: keys.length };
  }

  // ---- Rendu ----

  function zoneLine(zoneId) {
    const z = zones[zoneId];
    const isDungeon = !!z.dungeon;
    // Souterrain hors donjon : /travel ne mène pas à l'intérieur, pas de commande
    const command = z.indoor && !isDungeon ? null : travelCommand({ entrance: { x: z.x, y: z.y } });
    const badges = [
      // Nom du donjon seulement s'il diffère du nom de la zone (sinon simple « Donjon »)
      isDungeon
        ? `<span class="badge-zone dungeon" title="Dans le donjon ${escapeHtml(z.dungeon.name)} (commande : jusqu'à l'entrée)">🏰 ${
            z.dungeon.name === z.name ? 'Donjon' : escapeHtml(z.dungeon.name)
          }</span>`
        : '',
      z.indoor && !isDungeon ? '<span class="badge-zone indoor" title="Zone en intérieur ou en souterrain : /travel ne mène pas à l\'intérieur">🕳 Souterrain</span>' : '',
    ].join('');
    const coords = `[${z.x},${z.y}]`;
    // Explications d'accès (hors donjon : l'onglet Donjons s'en charge)
    const zoneAccess = isDungeon ? null : access.zones?.[zoneId];
    const areaAccess = isDungeon ? null : access.areas?.[z.area];
    const accessDetails = zoneAccess || areaAccess
      ? `<details class="m-access"><summary>ℹ️ Accès</summary>
           ${accessBlock('Cette zone', zoneAccess)}
           ${accessBlock(`Rejoindre ${escapeHtml(z.area)}`, areaAccess)}
         </details>`
      : '';
    // Zaap le plus proche (associé à la zone par le jeu, sinon le plus proche accessible à pied)
    const distance = z.zaap ? Math.abs(z.zaap.x - z.x) + Math.abs(z.zaap.y - z.y) : 0;
    const zaapLine = z.zaap
      ? `<div class="m-zaap">🌀 Zaap : ${escapeHtml(z.zaap.name || 'zaap')}
           <span class="zone-coords">[${z.zaap.x},${z.zaap.y}]</span>
           <small>${distance ? `à ${distance} carte${distance > 1 ? 's' : ''}` : 'sur place'}</small>
         </div>`
      : `<div class="m-zaap none">🌀 Pas de zaap proche${zoneAccess || areaAccess ? ' : voir ℹ️ Accès' : ''}</div>`;
    return `
      <div class="m-zone">
        <span class="m-zone-name">📍 ${escapeHtml(z.name)} <small>${escapeHtml(z.area)}</small></span>
        ${command
          ? `<button type="button" class="zone-copy" data-command="${escapeHtml(command)}" title="Copier : ${escapeHtml(command)}">${coords} 📋</button>`
          : `<span class="zone-coords">${coords}</span>`}
        ${badges}
        ${zaapLine}
        ${accessDetails}
      </div>`;
  }

  // Monstre sans zone dans les données : les Dopeuls, expliqués à part
  function noZoneLine(monster) {
    if (monster.name.startsWith('Dopeul') && access.dopeuls) {
      return `
        <div class="m-zone">
          <span class="m-zone-name">📍 Temples de classe</span>
          <details class="m-access"><summary>ℹ️ Accès</summary>${accessBlock('Combattre un Dopeul', access.dopeuls)}</details>
        </div>`;
    }
    return '<div class="m-zone"><span class="m-zone-name">📍 Zone non renseignée</span></div>';
  }

  function monsterRow(a, monsterId) {
    const m = monsters[monsterId];
    const key = monsterKey(a.id, monsterId);
    const [first, ...others] = m.zones;
    const dungeonOnly = m.zones.length > 0 && m.zones.every((id) => zones[id].dungeon);
    const levels = m.levels ? `niv. ${m.levels[0] === m.levels[1] ? m.levels[0] : `${m.levels[0]}–${m.levels[1]}`}` : '';
    return `
      <li class="m-monster">
        <label class="m-monster-main">
          <input type="checkbox" data-key="${key}" ${isDone(key) ? 'checked' : ''} />
          ${m.img ? `<img src="${escapeHtml(m.img)}" alt="" loading="lazy" />` : '<span class="m-noimg"></span>'}
          <span class="m-name">${escapeHtml(m.name)} <small>${levels}</small></span>
          ${dungeonOnly ? '<span class="badge-zone dungeon-only" title="Ce monstre ne se trouve qu\'en donjon">Donjon uniquement</span>' : ''}
        </label>
        ${first ? zoneLine(first) : noZoneLine(m)}
        ${others.length
          ? `<details class="m-more"><summary>+ ${others.length} autre${others.length > 1 ? 's' : ''} zone${others.length > 1 ? 's' : ''}</summary>${others.map(zoneLine).join('')}</details>`
          : ''}
      </li>`;
  }

  function achievementCard(a, showCategory = false) {
    const keys = keysOf(a);
    let body;
    if (a.monsters.length) {
      body = `<ul class="m-monsters">${a.monsters.map((id) => monsterRow(a, id)).join('')}</ul>`;
    } else if (a.requires.length) {
      body = `<ul class="m-requires">${a.requires
        .map((id) => `<li data-requires="${id}">${escapeHtml(achievementById.get(id)?.name ?? `Succès ${id}`)}</li>`)
        .join('')}</ul>`;
    } else {
      body = `<p class="m-desc">${escapeHtml(a.description)}</p>`;
      if (a.name.startsWith('Dopeul') && access.dopeuls) {
        body += `<details class="m-access"><summary>ℹ️ Où le combattre</summary>${accessBlock('Combattre un Dopeul', access.dopeuls)}</details>`;
      }
    }
    const check = keys.length
      ? `<input type="checkbox" class="m-ach-check" title="Valider tout le succès (ou Ctrl+clic sur la carte)" />`
      : '<span class="m-auto" title="Se valide tout seul quand les succès listés sont obtenus">auto</span>';
    return `
      <article class="m-ach" data-ach-id="${a.id}">
        <header>
          <span class="m-ach-name">${escapeHtml(a.name)}
            ${showCategory ? `<small>${escapeHtml(categoryOf.get(a.id).name)}</small>` : ''}</span>
          ${a.level ? `<span class="tag" title="Niveau requis">niv. ${a.level}+</span>` : ''}
          <span class="points">${a.points} pts</span>
          <span class="m-ach-progress"></span>
          ${check}
        </header>
        ${body}
      </article>`;
  }

  viewEl.innerHTML = `
    <div class="searchbar">
      <input type="search" class="m-search" placeholder="Rechercher un monstre, un succès, une zone…" autocomplete="off" />
      <div class="global-stats m-global"></div>
    </div>
    <div class="m-body">
      <nav class="m-cats">
        ${categories
          .map(
            (c) => `
          <button type="button" class="m-cat" data-cat-id="${c.id}" title="Ctrl+clic : valider toute la catégorie">
            <span class="m-cat-name">${escapeHtml(c.name)}</span>
            <span class="m-cat-pct"></span>
            <span class="bar"><span></span></span>
          </button>`,
          )
          .join('')}
      </nav>
      <section class="m-panel"></section>
    </div>`;

  const bodyEl = viewEl.querySelector('.m-body');
  const panelEl = viewEl.querySelector('.m-panel');
  const searchInput = viewEl.querySelector('.m-search');
  const globalEl = viewEl.querySelector('.m-global');

  let selectedId = loadSelected() ?? categories[0].id;
  if (!categories.some((c) => c.id === selectedId)) selectedId = categories[0].id;
  let panelOpen = false; // En disposition étroite : le panneau remplace la liste

  function showCategory(id) {
    selectedId = id;
    saveSelected(id);
    const c = categories.find((cat) => cat.id === id);
    panelEl.innerHTML = `
      <div class="m-panel-head">
        <button type="button" class="icon-btn secondary m-back" title="Retour aux catégories">←</button>
        <h3>${escapeHtml(c.name)}</h3>
      </div>
      ${c.achievements.map((a) => achievementCard(a)).join('')}`;
    panelEl.scrollTop = 0;
    updateStates();
  }

  function showSearchResults(query) {
    const q = normalize(query);
    const matches = categories
      .flatMap((c) => c.achievements)
      .filter((a) => {
        const text = [
          a.name,
          ...a.monsters.map((id) => monsters[id].name),
          ...a.monsters.flatMap((id) => monsters[id].zones.map((z) => zones[z].name)),
        ].join(' ');
        return normalize(text).includes(q);
      });
    panelEl.innerHTML = `
      <div class="m-panel-head">
        <button type="button" class="icon-btn secondary m-back" title="Retour aux catégories">←</button>
        <h3>Recherche : ${matches.length} succès</h3>
      </div>
      ${matches.length ? matches.map((a) => achievementCard(a, true)).join('') : '<p class="no-result">Aucun résultat.</p>'}`;
    panelEl.scrollTop = 0;
    updateStates();
  }

  // Met à jour compteurs, cases globales et états terminés (sans reconstruire la page)
  function updateStates() {
    for (const card of panelEl.querySelectorAll('.m-ach')) {
      const a = achievementById.get(Number(card.dataset.achId));
      const { done, total } = progressOf(a);
      const complete = isComplete(a);
      card.querySelector('.m-ach-progress').textContent = `${done}/${total}`;
      card.classList.toggle('complete', complete);
      const check = card.querySelector('.m-ach-check');
      if (check) {
        check.checked = done === total;
        check.indeterminate = done > 0 && done < total;
      }
      for (const li of card.querySelectorAll('[data-requires]')) {
        const required = achievementById.get(Number(li.dataset.requires));
        li.classList.toggle('done', !!required && isComplete(required));
      }
    }

    let allDone = 0;
    let allTotal = 0;
    for (const btn of viewEl.querySelectorAll('.m-cat')) {
      const c = categories.find((cat) => cat.id === Number(btn.dataset.catId));
      const { done, total } = categoryProgress(c);
      allDone += done;
      allTotal += total;
      const pct = percent(done, total);
      btn.querySelector('.m-cat-pct').textContent = `${pct} %`;
      btn.querySelector('.bar > span').style.width = `${pct}%`;
      btn.classList.toggle('complete', done === total);
      btn.classList.toggle('selected', !searchInput.value.trim() && c.id === selectedId);
    }
    const completeAchievements = [...achievementById.values()].filter((a) => isComplete(a)).length;
    globalEl.innerHTML = `
      <div class="stats-line">
        <strong>${percent(allDone, allTotal)} %</strong>
        <span>${allDone} / ${allTotal} objectifs</span>
        <span>${completeAchievements} / ${achievementById.size} succès</span>
      </div>
      <span class="bar"><span style="width:${allTotal ? (allDone / allTotal) * 100 : 0}%"></span></span>`;
  }

  // Disposition adaptative selon la largeur de l'onglet
  function applyLayout() {
    const wide = viewEl.clientWidth >= WIDE_LAYOUT;
    bodyEl.classList.toggle('wide', wide);
    bodyEl.classList.toggle('panel-open', !wide && panelOpen);
  }
  new ResizeObserver(applyLayout).observe(viewEl);

  // ---- Interactions ----

  // Valide tout le succès d'une carte, ou décoche tout s'il était complet
  // (case globale ou Ctrl+clic). Sans effet sur un méta-succès, qui se valide seul.
  function toggleWholeCard(card) {
    const a = achievementById.get(Number(card.dataset.achId));
    const keys = keysOf(a);
    if (!keys.length) return;
    const done = countDone(keys) < keys.length;
    setManyDone(keys, done);
    for (const input of card.querySelectorAll('[data-key]')) input.checked = done;
  }

  // Valide toute une catégorie, ou décoche tout si elle était à 100 %. Les cases du
  // panneau affiché sont remises à jour (qu'il montre cette catégorie ou une recherche).
  function toggleWholeCategory(categoryId) {
    const c = categories.find((cat) => cat.id === categoryId);
    const keys = c.achievements.flatMap(keysOf);
    const done = countDone(keys) < keys.length;
    setManyDone(keys, done);
    for (const input of panelEl.querySelectorAll('[data-key]')) input.checked = isDone(input.dataset.key);
  }

  viewEl.addEventListener('click', async (e) => {
    // Ctrl+clic (Cmd+clic sur Mac) n'importe où sur une carte : tout le succès d'un coup ;
    // sur une catégorie de gauche : toute la catégorie. Les liens, boutons de copie et
    // volets gardent leur comportement normal.
    if ((e.ctrlKey || e.metaKey) && !e.target.closest('a, .zone-copy, summary')) {
      const card = e.target.closest('.m-ach');
      const catBtn = e.target.closest('.m-cat');
      if (card || catBtn) {
        e.preventDefault();
        if (card) toggleWholeCard(card);
        else toggleWholeCategory(Number(catBtn.dataset.catId));
        updateStates();
        return;
      }
    }
    const cat = e.target.closest('.m-cat');
    if (cat) {
      searchInput.value = '';
      showCategory(Number(cat.dataset.catId));
      panelOpen = true;
      applyLayout();
      return;
    }
    if (e.target.closest('.m-back')) {
      panelOpen = false;
      if (searchInput.value.trim()) {
        searchInput.value = '';
        showCategory(selectedId);
      }
      applyLayout();
      return;
    }
    const copyBtn = e.target.closest('.zone-copy');
    if (copyBtn) {
      e.preventDefault();
      await copyText(copyBtn.dataset.command, copyBtn);
      flashCopied(copyBtn);
    }
  });

  viewEl.addEventListener('change', (e) => {
    if (e.target.dataset.key) {
      setDone(e.target.dataset.key, e.target.checked);
    } else if (e.target.classList.contains('m-ach-check')) {
      toggleWholeCard(e.target.closest('.m-ach'));
    } else {
      return;
    }
    updateStates();
  });

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query.length >= 2) {
      showSearchResults(query);
      panelOpen = true;
    } else if (!query) {
      showCategory(selectedId);
    }
    applyLayout();
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      showCategory(selectedId);
      applyLayout();
    }
  });

  showCategory(selectedId);
  applyLayout();

  return {
    // Après un changement de personnage : recoche les cases et recalcule tout
    refreshProgress() {
      for (const input of panelEl.querySelectorAll('[data-key]')) input.checked = isDone(input.dataset.key);
      updateStates();
    },
  };
}
