/* ============================
   SmartDiscover — app.js
   ============================ */

let currentMode = 'url';
let contentText = '';

// ===== THEME =====
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
  localStorage.setItem('sd-theme', isLight ? 'light' : 'dark');
}

(function () {
  if (localStorage.getItem('sd-theme') === 'light') {
    document.body.classList.add('light');
    document.addEventListener('DOMContentLoaded', () => {
      const icon = document.querySelector('.theme-icon');
      if (icon) icon.textContent = '☀️';
    });
  }
})();

// ===== MODE TOGGLE =====
function setMode(mode) {
  currentMode = mode;
  document.getElementById('url-section').classList.toggle('hidden', mode !== 'url');
  document.getElementById('text-section').classList.toggle('hidden', mode !== 'text');
  document.getElementById('file-section').classList.toggle('hidden', mode !== 'file');
  document.getElementById('btn-url').classList.toggle('active', mode === 'url');
  document.getElementById('btn-text').classList.toggle('active', mode === 'text');
  document.getElementById('btn-file').classList.toggle('active', mode === 'file');
  updateCounter();
}

// ===== CHAR COUNTER =====
function updateCounter() {
  let len = currentMode === 'text'
    ? document.getElementById('text-input').value.length
    : contentText.length;
  const el = document.getElementById('char-counter');
  el.textContent = `${len.toLocaleString('fr-FR')} caractère${len !== 1 ? 's' : ''}`;
  el.style.color = len < 50 ? 'var(--danger)' : len > 200 ? 'var(--accent)' : 'var(--text-dim)';
}

document.getElementById('text-input').addEventListener('input', updateCounter);
document.getElementById('url-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') extractFromUrl(); });

// ===== URL EXTRACTION =====
async function extractFromUrl() {
  const url = document.getElementById('url-input').value.trim();
  const status = document.getElementById('extract-status');
  const btn = document.getElementById('btn-extract');
  const label = document.getElementById('extract-label');

  if (!url) { showStatus(status, 'error', '⚠️ Veuillez entrer une URL valide.'); return; }

  btn.disabled = true;
  label.textContent = 'Extraction…';
  showStatus(status, '', '');

  try {
    const res = await fetch('/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) {
      showStatus(status, 'error', `❌ ${data.error}`);
    } else {
      contentText = data.content;
      const words = contentText.split(/\s+/).length;
      showStatus(status, 'success', `✅ ${words.toLocaleString('fr-FR')} mots extraits.`);
      updateCounter();
    }
  } catch (err) {
    showStatus(status, 'error', '❌ Erreur réseau.');
  } finally {
    btn.disabled = false;
    label.textContent = 'Extraire';
  }
}

// ===== FILE UPLOAD =====
async function handleFileUpload(file) {
  if (!file) return;
  const status = document.getElementById('file-status');
  const dropZone = document.getElementById('file-drop-zone');

  showStatus(status, '', '⏳ Lecture du fichier…');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      showStatus(status, 'error', `❌ ${data.error}`);
      dropZone.classList.remove('has-file');
    } else {
      contentText = data.content;
      const words = contentText.split(/\s+/).length;
      dropZone.classList.add('has-file');
      let nameEl = dropZone.querySelector('.file-name-display');
      if (!nameEl) {
        nameEl = document.createElement('div');
        nameEl.className = 'file-name-display';
        dropZone.appendChild(nameEl);
      }
      nameEl.textContent = `📄 ${file.name}`;
      showStatus(status, 'success', `✅ ${words.toLocaleString('fr-FR')} mots chargés.`);
      updateCounter();
    }
  } catch (err) {
    showStatus(status, 'error', '❌ Erreur lors de la lecture du fichier.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('file-drop-zone');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { document.getElementById('file-input').files = e.dataTransfer.files; handleFileUpload(file); }
  });
});

// ===== ANALYZE =====
async function analyze() {
  const category = document.getElementById('category').value;
  const content = currentMode === 'text'
    ? document.getElementById('text-input').value.trim()
    : contentText;

  const btn = document.getElementById('btn-analyze');
  const btnText = document.querySelector('.btn-text');
  const loader = document.getElementById('loader');
  const resultContent = document.getElementById('result-content');
  const placeholder = document.getElementById('result-placeholder');

  if (content.length < 50) {
    const msgs = {
      url: '⚠️ Aucun contenu extrait. Cliquez sur "Extraire" d\'abord.',
      text: '⚠️ Le texte est trop court (min. 50 caractères).',
      file: '⚠️ Aucun fichier chargé. Déposez un fichier .txt ou .docx.'
    };
    showResult('error', msgs[currentMode]);
    return;
  }

  btn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');
  placeholder.classList.add('hidden');
  resultContent.classList.add('hidden');

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content })
    });
    const data = await res.json();
    if (!res.ok) {
      showResult('error', `❌ ${data.error}`);
    } else {
      resultContent.innerHTML = marked.parse(data.report);
      resultContent.classList.remove('hidden');
      resultContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (err) {
    showResult('error', '❌ Erreur réseau. Vérifiez votre connexion.');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
  }
}

function showStatus(el, type, msg) {
  el.className = `extract-status ${type}`;
  el.textContent = msg;
}

function showResult(type, message) {
  const resultContent = document.getElementById('result-content');
  document.getElementById('result-placeholder').classList.add('hidden');
  resultContent.innerHTML = type === 'error' ? `<div class="error-box">${message}</div>` : message;
  resultContent.classList.remove('hidden');
}
