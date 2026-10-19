// Écran Paramètres : mise à jour des données des donjons, export/import de la sauvegarde.
import { escapeHtml, updateDungeonData, resetDungeonData } from './data.js';
import { exportState, describeImport, importState } from './progress.js';

const formatDate = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

/**
 * Écran dans `viewEl`. `data` : les données des donjons affichées (avec `source`).
 * `onClose` : retour au sommaire. Après une mise à jour ou un import, la page se recharge.
 */
export function createSettingsView(viewEl, { data, onClose }) {
  // Recharge la page principale (et pas la fenêtre flottante, qui n'a pas d'adresse)
  const reload = () => window.location.reload();

  function render() {
    viewEl.innerHTML = `
      <header class="view-header">
        <button type="button" class="icon-btn secondary" data-action="back" title="Retour">←</button>
        <h2>Paramètres</h2>
      </header>
      <div class="view-body settings">
        <section>
          <h3>Données des donjons</h3>
          <p class="settings-info">
            ${data.dungeons.length} donjons, données du ${escapeHtml(formatDate(data.generatedAt))}
            ${data.source === 'update' ? '<br />(mises à jour depuis l\'app)' : ''}
          </p>
          <button type="button" data-action="update">⟳ Mettre à jour depuis DofusDB</button>
          ${data.source === 'update'
            ? '<button type="button" class="secondary" data-action="reset">Revenir aux données d\'origine</button>'
            : ''}
          <p class="settings-status" data-status="data" hidden></p>
        </section>

        <section>
          <h3>Sauvegarde</h3>
          <p class="settings-info">Personnages, succès cochés et notes. Pratique pour changer de PC
            ou passer d'une version de l'app à l'autre.</p>
          <button type="button" data-action="export">⭳ Exporter ma progression</button>
          <button type="button" class="secondary" data-action="import">⭱ Importer une sauvegarde</button>
          <input type="file" accept=".json,application/json" hidden />
          <div class="settings-status" data-status="save" hidden></div>
        </section>
      </div>`;

    viewEl.querySelector('[data-action="back"]').addEventListener('click', onClose);
    viewEl.querySelector('[data-action="update"]').addEventListener('click', runUpdate);
    viewEl.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      resetDungeonData();
      reload();
    });
    viewEl.querySelector('[data-action="export"]').addEventListener('click', exportSave);
    const fileInput = viewEl.querySelector('input[type="file"]');
    viewEl.querySelector('[data-action="import"]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => readImport(fileInput.files[0]));
  }

  function status(name, html, kind = '') {
    const el = viewEl.querySelector(`[data-status="${name}"]`);
    el.className = `settings-status ${kind}`;
    el.innerHTML = html;
    el.hidden = false;
    return el;
  }

  async function runUpdate(e) {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const changes = await updateDungeonData(data, (msg) => status('data', escapeHtml(msg)));
      const added = changes.addedDungeons.length
        ? `Nouveaux donjons : ${escapeHtml(changes.addedDungeons.join(', '))}.`
        : 'Aucun nouveau donjon.';
      const el = status(
        'data',
        `Terminé : ${changes.dungeons} donjons, ${changes.achievements} succès
         (${changes.addedAchievements} nouveau${changes.addedAchievements > 1 ? 'x' : ''}). ${added}
         <br /><button type="button" data-action="reload">Recharger pour afficher</button>`,
        'ok',
      );
      el.querySelector('[data-action="reload"]').addEventListener('click', reload);
    } catch (err) {
      status('data', `Échec de la mise à jour : ${escapeHtml(err.message)}`, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  function exportSave(e) {
    const doc = e.currentTarget.ownerDocument;
    const blob = new Blob([JSON.stringify(exportState(), null, 2)], { type: 'application/json' });
    const link = doc.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `succes-donjons-${new Date().toISOString().slice(0, 10)}.json`;
    doc.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    status('save', 'Fichier de sauvegarde téléchargé.', 'ok');
  }

  async function readImport(file) {
    if (!file) return;
    let data;
    let info;
    try {
      data = JSON.parse(await file.text());
      info = describeImport(data);
    } catch (err) {
      status('save', escapeHtml(err instanceof SyntaxError ? "Ce fichier n'est pas lisible." : err.message), 'error');
      return;
    }
    // Confirmation avant d'écraser la progression actuelle
    const el = status(
      'save',
      `<strong>Remplacer toute la progression actuelle ?</strong><br />
       Fichier ${info.exportedAt ? `du ${escapeHtml(formatDate(info.exportedAt))}` : ''} :
       ${escapeHtml(info.characters.join(', '))} — ${info.doneCount} succès coché${info.doneCount > 1 ? 's' : ''},
       ${info.notesCount} note${info.notesCount > 1 ? 's' : ''}.
       <div class="settings-actions">
         <button type="button" class="danger" data-action="confirm">Remplacer</button>
         <button type="button" class="secondary" data-action="cancel">Annuler</button>
       </div>`,
      'warning',
    );
    el.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      try {
        importState(data);
        reload();
      } catch (err) {
        status('save', escapeHtml(err.message), 'error');
      }
    });
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => (el.hidden = true));
    viewEl.querySelector('input[type="file"]').value = '';
  }

  return { open: render };
}
