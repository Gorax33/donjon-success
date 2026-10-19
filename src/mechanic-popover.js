// Pop-up d'explication des mécaniques de boss.
// - Survol du ⚙️ : la pop-up s'affiche, et disparaît quand la souris s'en va
//   (on peut passer la souris dessus pour la lire).
// - Clic sur le ⚙️ : la pop-up reste ouverte ; nouveau clic, Échap ou clic ailleurs pour la fermer.
// La pop-up est placée dans l'app pour suivre celle-ci dans la fenêtre flottante.
import { escapeHtml } from './data.js';

const HIDE_DELAY = 150; // ms : le temps de passer du ⚙️ à la pop-up
const MAX_WIDTH = 320;
const MARGIN = 8;

/** Accepte l'ancien format (texte seul) et le nouveau ({ summary, details }) */
export function normalizeMechanic(value) {
  if (!value) return null;
  if (typeof value === 'string') return { summary: value, details: [] };
  return { summary: value.summary, details: value.details ?? [] };
}

/**
 * Active les pop-ups pour les ⚙️ de `container`. `appEl` reçoit la pop-up.
 * `dungeonById` : Map id (texte) -> donjon (avec `mechanic` et `guide`).
 */
export function setupMechanicPopover(container, appEl, dungeonById) {
  const popover = document.createElement('div');
  popover.className = 'mechanic-popover';
  popover.hidden = true;
  appEl.append(popover);

  let currentFlag = null;
  let pinned = false;
  let hideTimer = null;

  function render(dungeon) {
    const { summary, details } = dungeon.mechanic;
    popover.innerHTML = `
      <div class="popover-head">
        <span class="popover-title">⚙️ ${escapeHtml(dungeon.boss?.name ?? dungeon.name)}</span>
        <button type="button" class="popover-close" title="Fermer" ${pinned ? '' : 'hidden'}>✕</button>
      </div>
      <p class="popover-summary">${escapeHtml(summary)}</p>
      ${details.length ? `<ul>${details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
      <div class="popover-foot">
        ${dungeon.guide ? `<a href="${escapeHtml(dungeon.guide)}" target="_blank" rel="noopener">📖 Guide complet</a>` : '<span></span>'}
        <span class="popover-hint">${pinned ? 'Épinglée' : 'Clic sur ⚙️ pour épingler'}</span>
      </div>`;
    popover.querySelector('.popover-close').addEventListener('click', hide);
  }

  // Sous le ⚙️ si la place le permet, sinon au-dessus ; jamais hors de la fenêtre
  function position() {
    const win = currentFlag.ownerDocument.defaultView;
    const rect = currentFlag.getBoundingClientRect();
    const width = Math.min(MAX_WIDTH, win.innerWidth - 2 * MARGIN);
    popover.style.width = `${width}px`;
    const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), win.innerWidth - width - MARGIN);
    popover.style.left = `${left}px`;
    const height = popover.offsetHeight;
    const below = rect.bottom + 6;
    const top = below + height <= win.innerHeight - MARGIN ? below : Math.max(MARGIN, rect.top - 6 - height);
    popover.style.top = `${top}px`;
  }

  // Échap : écouté sur le document du ⚙️ (page ou fenêtre flottante), où que soit le focus
  const listenedDocs = new WeakSet();
  const onKeyDown = (e) => {
    if (e.key === 'Escape' && !popover.hidden) hide();
  };

  function show(flag) {
    clearTimeout(hideTimer);
    if (!listenedDocs.has(flag.ownerDocument)) {
      flag.ownerDocument.addEventListener('keydown', onKeyDown);
      listenedDocs.add(flag.ownerDocument);
    }
    currentFlag?.classList.remove('active');
    currentFlag = flag;
    flag.classList.add('active');
    render(dungeonById.get(flag.dataset.mechanicFor));
    popover.hidden = false;
    position();
  }

  function hide() {
    clearTimeout(hideTimer);
    pinned = false;
    popover.hidden = true;
    currentFlag?.classList.remove('active');
    currentFlag = null;
  }

  function scheduleHide() {
    if (pinned) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY);
  }

  // Survol (mouseover/mouseout remontent, contrairement à mouseenter/mouseleave)
  container.addEventListener('mouseover', (e) => {
    const flag = e.target.closest('.mechanic-flag');
    if (!flag || pinned) return;
    if (flag !== currentFlag) show(flag);
    else clearTimeout(hideTimer);
  });
  container.addEventListener('mouseout', (e) => {
    if (e.target.closest('.mechanic-flag') && !popover.contains(e.relatedTarget)) scheduleHide();
  });
  popover.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  popover.addEventListener('mouseleave', scheduleHide);

  // Clic sur le ⚙️ : épingle / désépingle (sans plier/déplier le donjon)
  container.addEventListener('click', (e) => {
    const flag = e.target.closest('.mechanic-flag');
    if (!flag) return;
    e.preventDefault();
    if (pinned && flag === currentFlag) {
      hide();
      return;
    }
    pinned = true;
    show(flag);
  });

  // Fermeture : clic ailleurs dans l'app
  appEl.addEventListener('click', (e) => {
    if (pinned && !popover.contains(e.target) && !e.target.closest('.mechanic-flag')) hide();
  });

  // Défilement : une pop-up épinglée suit son ⚙️, une pop-up de survol disparaît
  appEl.addEventListener(
    'scroll',
    () => {
      if (popover.hidden) return;
      if (pinned) position();
      else hide();
    },
    true,
  );
}
