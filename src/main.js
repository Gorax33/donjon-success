import './style.css';
import { isPipSupported, openPip, closePip } from './pip.js';
import { loadDungeonData, loadClasses, loadMechanics } from './data.js';
import { renderSummary } from './summary.js';
import { renderAvatarButton, createCharactersView } from './characters.js';
import { isTauri, setupPinButton } from './desktop.js';
import { normalizeMechanic } from './mechanic-popover.js';

const appEl = document.getElementById('app');
const pipBtn = appEl.querySelector('#pip-btn');
const detachedNotice = document.getElementById('detached-notice');
const pipError = appEl.querySelector('#pip-error');

if (isTauri()) {
  // App de bureau : la fenêtre est native, le bouton sert d'épingle "toujours au premier plan"
  setupPinButton(appEl.querySelector('#pin-btn'));
  pipBtn.hidden = true;
} else if (isPipSupported()) {
  pipBtn.addEventListener('click', async () => {
    pipError.hidden = true;
    try {
      await openPip(appEl, {
        onOpen: () => (detachedNotice.hidden = false),
        onClose: () => (detachedNotice.hidden = true),
      });
    } catch (err) {
      pipError.textContent = `Impossible d'ouvrir la fenêtre flottante : ${err.message}`;
      pipError.hidden = false;
    }
  });
  document.getElementById('reattach-btn').addEventListener('click', closePip);
} else {
  pipBtn.hidden = true;
  appEl.querySelector('#pip-unsupported').hidden = false;
}

const summaryEl = appEl.querySelector('#summary');
const mainView = appEl.querySelector('#main-view');
const charactersViewEl = appEl.querySelector('#characters-view');
const avatarBtn = appEl.querySelector('#avatar-btn');

try {
  const [{ dungeons }, classes, mechanics] = await Promise.all([
    loadDungeonData(),
    loadClasses(),
    loadMechanics(),
  ]);
  for (const d of dungeons) d.mechanic = normalizeMechanic(mechanics[d.id]);
  const classById = new Map(classes.map((c) => [c.id, c]));

  const { refreshProgress } = renderSummary(
    summaryEl,
    appEl.querySelector('#search'),
    appEl.querySelector('#global-stats'),
    dungeons,
  );

  // Changement de personnage actif ou de ses infos
  const onCharacterChange = () => {
    renderAvatarButton(avatarBtn, classById);
    refreshProgress();
  };

  // L'écran des personnages remplace la vue principale tant qu'il est ouvert
  const showCharacters = (visible) => {
    mainView.hidden = visible;
    charactersViewEl.hidden = !visible;
  };
  const charactersView = createCharactersView(charactersViewEl, {
    classes,
    onChange: onCharacterChange,
    onClose: () => showCharacters(false),
  });

  avatarBtn.addEventListener('click', () => {
    if (!charactersViewEl.hidden) return showCharacters(false);
    charactersView.open();
    showCharacters(true);
  });
  renderAvatarButton(avatarBtn, classById);
} catch (err) {
  summaryEl.innerHTML = '<p class="warning"></p>';
  summaryEl.firstChild.textContent = err.message;
}
