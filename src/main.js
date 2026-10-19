import './style.css';
import { isPipSupported, openPip, closePip } from './pip.js';

const appEl = document.getElementById('app');
const pipBtn = appEl.querySelector('#pip-btn');
const detachedNotice = document.getElementById('detached-notice');
const pipError = appEl.querySelector('#pip-error');

if (isPipSupported()) {
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
