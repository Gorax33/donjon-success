import './style.css';
import { isPipSupported, openPip, closePip } from './pip.js';
import { loadDungeonData, loadClasses, loadMechanics } from './data.js';
import { renderSummary } from './summary.js';
import { renderAvatarButton, createCharactersView } from './characters.js';
import { isTauri, setupPinButton } from './desktop.js';
import { normalizeMechanic } from './mechanic-popover.js';
import { createSettingsView } from './settings.js';

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
const views = {
  main: appEl.querySelector('#main-view'),
  characters: appEl.querySelector('#characters-view'),
  settings: appEl.querySelector('#settings-view'),
};
const avatarBtn = appEl.querySelector('#avatar-btn');

// Un seul écran visible à la fois : le sommaire, les personnages ou les paramètres
let currentView = 'main';
function showView(name) {
  currentView = name;
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
}

try {
  const [data, classes, mechanics] = await Promise.all([
    loadDungeonData(),
    loadClasses(),
    loadMechanics(),
  ]);
  const { dungeons } = data;
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

  const charactersView = createCharactersView(views.characters, {
    classes,
    onChange: onCharacterChange,
    onClose: () => showView('main'),
  });
  const settingsView = createSettingsView(views.settings, { data, onClose: () => showView('main') });

  // Les boutons du haut ouvrent leur écran, ou ramènent au sommaire s'il est déjà ouvert
  const toggle = (name, view) => {
    if (currentView === name) return showView('main');
    view.open();
    showView(name);
  };
  avatarBtn.addEventListener('click', () => toggle('characters', charactersView));
  appEl.querySelector('#settings-btn').addEventListener('click', () => toggle('settings', settingsView));
  renderAvatarButton(avatarBtn, classById);
} catch (err) {
  summaryEl.innerHTML = '<p class="warning"></p>';
  summaryEl.firstChild.textContent = err.message;
}
