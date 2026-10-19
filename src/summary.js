// Sommaire : volets dépliables par tranche de niveau, donjons et leurs succès, recherche.
import { bracketOf } from './data.js';
import { isDone, setDone, countDone } from './progress.js';

const OPEN_KEY = 'open-brackets';

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Minuscules et sans accents : "Épave" trouve "epave"
function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function loadOpenBrackets() {
  try {
    return new Set(JSON.parse(localStorage.getItem(OPEN_KEY)) ?? []);
  } catch {
    return new Set();
  }
}

function saveOpenBrackets(set) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...set]));
  } catch {
    // Stockage indisponible : les volets repartent fermés
  }
}

function dungeonCount(n) {
  return `${n} donjon${n > 1 ? 's' : ''}`;
}

function renderAchievement(achievement, dungeon) {
  const { challenge } = achievement;
  const label = challenge ? challenge.name : 'Victoire';
  const detail = challenge
    ? challenge.description
    : achievement.name !== dungeon.name
      ? achievement.name
      : '';
  const levelTag =
    achievement.level !== dungeon.level ? `<span class="tag">niv. ${achievement.level}</span>` : '';
  return `
    <li>
      <label class="achievement">
        <input type="checkbox" data-achievement-id="${achievement.id}" ${isDone(achievement.id) ? 'checked' : ''} />
        <div class="achievement-body">
          <div class="achievement-head">
            <span class="achievement-name">${escapeHtml(label)}</span>
            ${levelTag}
            <span class="points">${achievement.points} pts</span>
          </div>
          ${detail ? `<div class="achievement-desc">${escapeHtml(detail)}</div>` : ''}
        </div>
      </label>
    </li>`;
}

function renderDungeon(dungeon) {
  return `
    <details class="dungeon" data-dungeon-id="${dungeon.id}">
      <summary>
        <span class="dungeon-name">${escapeHtml(dungeon.name)}</span>
        <span class="tag">niv. ${dungeon.level}</span>
        <span class="dungeon-progress"></span>
      </summary>
      <ul class="achievements">
        ${dungeon.achievements.map((a) => renderAchievement(a, dungeon)).join('')}
      </ul>
    </details>`;
}

/**
 * Affiche le sommaire dans `container` et branche la recherche sur `searchInput`.
 */
export function renderSummary(container, searchInput, dungeons) {
  const brackets = new Map();
  for (const dungeon of dungeons) {
    const { start, end } = bracketOf(dungeon.level);
    if (!brackets.has(start)) brackets.set(start, { start, end, dungeons: [] });
    brackets.get(start).dungeons.push(dungeon);
  }

  const openBrackets = loadOpenBrackets();

  container.innerHTML = `
    ${[...brackets.values()]
      .map(
        (b) => `
      <details class="bracket" data-bracket="${b.start}" ${openBrackets.has(b.start) ? 'open' : ''}>
        <summary>
          <span>Niveaux ${b.start} – ${b.end}</span>
          <span class="count">${dungeonCount(b.dungeons.length)}</span>
        </summary>
        <div class="bracket-body">${b.dungeons.map(renderDungeon).join('')}</div>
      </details>`,
      )
      .join('')}
    <p class="no-result" hidden>Aucun donjon trouvé.</p>`;

  const bracketEls = [...container.querySelectorAll('.bracket')];
  const noResult = container.querySelector('.no-result');

  // Compteur "3/5" et état terminé de chaque donjon
  const dungeonById = new Map(dungeons.map((d) => [String(d.id), d]));
  function updateDungeonProgress(dungeonEl) {
    const dungeon = dungeonById.get(dungeonEl.dataset.dungeonId);
    const total = dungeon.achievements.length;
    const done = countDone(dungeon.achievements.map((a) => a.id));
    dungeonEl.querySelector('.dungeon-progress').textContent = `${done}/${total}`;
    dungeonEl.classList.toggle('complete', done === total);
  }
  container.querySelectorAll('.dungeon').forEach(updateDungeonProgress);

  container.addEventListener('change', (e) => {
    const id = e.target.dataset.achievementId;
    if (!id) return;
    setDone(Number(id), e.target.checked);
    updateDungeonProgress(e.target.closest('.dungeon'));
  });

  // Texte indexé par donjon : son nom + les noms de ses succès (qui contiennent les boss)
  const searchIndex = new Map(
    dungeons.map((d) => [
      String(d.id),
      normalize([d.name, ...d.achievements.map((a) => a.name)].join(' ')),
    ]),
  );

  // Mémorise les volets ouverts à la main (pas pendant une recherche)
  let searching = false;
  for (const el of bracketEls) {
    el.addEventListener('toggle', () => {
      if (searching) return;
      const start = Number(el.dataset.bracket);
      if (el.open) openBrackets.add(start);
      else openBrackets.delete(start);
      saveOpenBrackets(openBrackets);
    });
  }

  function applySearch() {
    const query = normalize(searchInput.value.trim());
    searching = query !== '';
    let total = 0;

    for (const bracketEl of bracketEls) {
      const dungeonEls = bracketEl.querySelectorAll('.dungeon');
      let matches = 0;
      for (const dungeonEl of dungeonEls) {
        const visible = !searching || searchIndex.get(dungeonEl.dataset.dungeonId).includes(query);
        dungeonEl.hidden = !visible;
        if (visible) matches++;
      }
      bracketEl.hidden = matches === 0;
      bracketEl.querySelector('.count').textContent = searching
        ? `${matches} / ${dungeonCount(dungeonEls.length)}`
        : dungeonCount(dungeonEls.length);
      // Pendant une recherche, on ouvre les tranches qui ont des résultats ;
      // ensuite on revient aux volets choisis par l'utilisateur
      bracketEl.open = searching ? matches > 0 : openBrackets.has(Number(bracketEl.dataset.bracket));
      total += matches;
    }
    noResult.hidden = total > 0;
  }

  searchInput.addEventListener('input', applySearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      applySearch();
    }
  });
}
