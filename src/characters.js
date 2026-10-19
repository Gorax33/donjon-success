// Personnages : avatar rond (en haut à droite) et écran séparé de gestion
// (choisir, créer, modifier, supprimer).
// Tout se fait dans l'app (pas de prompt()/confirm()) : dans la fenêtre flottante,
// ces boîtes de dialogue s'afficheraient dans l'onglet d'origine.
import { assetUrl, escapeHtml } from './data.js';
import {
  DEFAULT_COLOR,
  getCharacters,
  getActiveCharacter,
  getActiveCharacterId,
  setActiveCharacter,
  addCharacter,
  updateCharacter,
  deleteCharacter,
} from './progress.js';

const COLORS = [
  '#d9a441', '#e06c5a', '#e98ab5', '#a77de0', '#5a8de0',
  '#4fb8c9', '#6cc070', '#9aa83a', '#b07a4f', '#7d8590',
];

/** Contenu HTML d'un avatar : emblème de la classe (ou initiale) sur la couleur choisie */
function avatarHtml(character, classById, size = '') {
  const cls = classById.get(character.classId);
  const content = cls
    ? `<img src="${assetUrl(cls.img)}" alt="${escapeHtml(cls.name)}" />`
    : `<span>${escapeHtml(character.name.charAt(0).toUpperCase() || '?')}</span>`;
  return `<span class="avatar ${size}" style="background:${escapeHtml(character.color ?? DEFAULT_COLOR)}">${content}</span>`;
}

/** Met à jour le bouton avatar de la barre du haut avec le personnage actif */
export function renderAvatarButton(buttonEl, classById) {
  const character = getActiveCharacter();
  const cls = classById.get(character.classId);
  buttonEl.innerHTML = avatarHtml(character, classById);
  buttonEl.title = `${character.name}${cls ? ` (${cls.name})` : ''} — changer de personnage`;
}

/**
 * Écran de gestion des personnages dans `viewEl`.
 * `onChange` : le personnage actif ou ses infos ont changé. `onClose` : retour au sommaire.
 */
export function createCharactersView(viewEl, { classes, onChange, onClose }) {
  const classById = new Map(classes.map((c) => [c.id, c]));

  function shell(title, body) {
    viewEl.innerHTML = `
      <header class="view-header">
        <button type="button" class="icon-btn secondary" data-action="back" title="Retour">←</button>
        <h2>${title}</h2>
      </header>
      <div class="view-body">${body}</div>`;
  }

  function showList() {
    const characters = getCharacters();
    shell(
      'Personnages',
      `
      <ul class="character-list">
        ${characters
          .map(
            (c) => `
          <li class="character-card ${c.id === getActiveCharacterId() ? 'active' : ''}" data-id="${c.id}">
            <button type="button" class="character-pick" data-action="pick" title="Choisir ce personnage">
              ${avatarHtml(c, classById, 'large')}
              <span class="character-info">
                <span class="character-name">${escapeHtml(c.name)}</span>
                <span class="character-class">${escapeHtml(classById.get(c.classId)?.name ?? 'Classe non choisie')}</span>
              </span>
              ${c.id === getActiveCharacterId() ? '<span class="badge">Actif</span>' : ''}
            </button>
            <button type="button" class="icon-btn secondary" data-action="edit" title="Modifier">✎</button>
            <button type="button" class="icon-btn secondary" data-action="delete" title="Supprimer"
              ${characters.length <= 1 ? 'disabled' : ''}>🗑</button>
          </li>`,
          )
          .join('')}
      </ul>
      <button type="button" class="add-character" data-action="add">＋ Nouveau personnage</button>`,
    );

    viewEl.querySelector('[data-action="back"]').addEventListener('click', onClose);
    viewEl.querySelector('[data-action="add"]').addEventListener('click', () => showForm(null));
    for (const card of viewEl.querySelectorAll('.character-card')) {
      const id = card.dataset.id;
      card.querySelector('[data-action="pick"]').addEventListener('click', () => {
        setActiveCharacter(id);
        onChange();
        onClose();
      });
      card.querySelector('[data-action="edit"]').addEventListener('click', () =>
        showForm(getCharacters().find((c) => c.id === id)),
      );
      card.querySelector('[data-action="delete"]').addEventListener('click', () =>
        showDeleteConfirm(card, id),
      );
    }
  }

  function showDeleteConfirm(card, id) {
    const character = getCharacters().find((c) => c.id === id);
    card.innerHTML = `
      <span class="confirm-text"></span>
      <button type="button" class="icon-btn danger" data-action="confirm">Oui</button>
      <button type="button" class="icon-btn secondary" data-action="cancel">Non</button>`;
    card.querySelector('.confirm-text').textContent =
      `Supprimer « ${character.name} » et sa progression ?`;
    card.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      deleteCharacter(id);
      onChange();
      showList();
    });
    card.querySelector('[data-action="cancel"]').addEventListener('click', showList);
  }

  // Création (character = null) ou modification
  function showForm(character) {
    const draft = character
      ? { ...character }
      : { name: '', classId: null, color: COLORS[getCharacters().length % COLORS.length] };

    shell(
      character ? 'Modifier le personnage' : 'Nouveau personnage',
      `
      <form class="character-form">
        <div class="form-preview">
          <span class="preview-avatar"></span>
          <input type="text" name="name" maxlength="40" placeholder="Nom du personnage" required />
        </div>

        <h3>Classe</h3>
        <div class="class-grid">
          ${classes
            .map(
              (c) => `
            <button type="button" class="class-option" data-class-id="${c.id}" title="${escapeHtml(c.name)}">
              <img src="${assetUrl(c.img)}" alt="" />
              <span>${escapeHtml(c.name)}</span>
            </button>`,
            )
            .join('')}
        </div>

        <h3>Couleur de fond</h3>
        <div class="color-row">
          ${COLORS.map(
            (color) =>
              `<button type="button" class="color-swatch" data-color="${color}" style="background:${color}" title="${color}"></button>`,
          ).join('')}
          <label class="color-custom" title="Autre couleur">
            <input type="color" />
            <span>Autre</span>
          </label>
        </div>

        <div class="form-actions">
          <button type="button" class="icon-btn secondary" data-action="cancel">Annuler</button>
          <button type="submit" class="icon-btn" data-action="save">Enregistrer</button>
        </div>
      </form>`,
    );

    const form = viewEl.querySelector('form');
    const nameInput = form.elements.name;
    const colorInput = form.querySelector('input[type="color"]');
    const saveBtn = form.querySelector('[data-action="save"]');
    nameInput.value = draft.name;
    colorInput.value = draft.color;

    function refresh() {
      form.querySelector('.preview-avatar').innerHTML = avatarHtml(
        { ...draft, name: nameInput.value || '?' },
        classById,
        'large',
      );
      for (const btn of form.querySelectorAll('.class-option')) {
        btn.classList.toggle('selected', Number(btn.dataset.classId) === draft.classId);
      }
      for (const btn of form.querySelectorAll('.color-swatch')) {
        btn.classList.toggle('selected', btn.dataset.color === draft.color);
      }
      saveBtn.disabled = !nameInput.value.trim() || !draft.classId;
    }

    nameInput.addEventListener('input', refresh);
    form.querySelector('.class-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.class-option');
      if (!btn) return;
      draft.classId = Number(btn.dataset.classId);
      refresh();
    });
    form.querySelector('.color-row').addEventListener('click', (e) => {
      const btn = e.target.closest('.color-swatch');
      if (!btn) return;
      draft.color = btn.dataset.color;
      colorInput.value = draft.color;
      refresh();
    });
    colorInput.addEventListener('input', () => {
      draft.color = colorInput.value;
      refresh();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const values = { name: nameInput.value.trim(), classId: draft.classId, color: draft.color };
      if (!values.name || !values.classId) return;
      if (character) {
        updateCharacter(character.id, values);
        onChange();
        showList();
      } else {
        addCharacter(values);
        onChange();
        onClose();
      }
    });
    form.querySelector('[data-action="cancel"]').addEventListener('click', showList);
    viewEl.querySelector('[data-action="back"]').addEventListener('click', showList);

    refresh();
    nameInput.focus();
  }

  return { open: showList };
}
