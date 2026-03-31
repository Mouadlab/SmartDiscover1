/* ============================
   SmartDiscover — app.js
   ============================ */

let currentMode = 'url';
let contentText = '';
let lastReportMarkdown = '';

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

// ===== PROGRESS =====
const STEPS = [
  { id: 'step-1', label: 'Lecture du contenu',            pct: 15 },
  { id: 'step-2', label: 'Analyse des entités',           pct: 35 },
  { id: 'step-3', label: 'Optimisation des titres',       pct: 55 },
  { id: 'step-4', label: 'Évaluation E-E-A-T',            pct: 75 },
  { id: 'step-5', label: 'Recommandations de réécriture', pct: 92 },
];

let progressTimer = null;

function startProgress() {
  document.getElementById('result-placeholder').classList.add('hidden');
  document.getElementById('analysis-progress').classList.remove('hidden');
  setProgress(0, 'Connexion à Gemini AI');
  STEPS.forEach(s => document.getElementById(s.id).classList.remove('active', 'done'));

  let stepIdx = 0;
  const delays = [400, 1800, 3400, 5200, 7200];

  function tick() {
    if (stepIdx >= STEPS.length) return;
    STEPS.slice(0, stepIdx).forEach(s => {
      document.getElementById(s.id).classList.replace('active', 'done') ||
      document.getElementById(s.id).classList.remove('active');
      document.getElementById(s.id).classList.add('done');
    });
    document.getElementById(STEPS[stepIdx].id).classList.add('active');
    setProgress(STEPS[stepIdx].pct, STEPS[stepIdx].label);
    stepIdx++;
    if (stepIdx < STEPS.length)
      progressTimer = setTimeout(tick, delays[stepIdx] - delays[stepIdx - 1]);
  }
  progressTimer = setTimeout(tick, delays[0]);
}

function finishProgress() {
  clearTimeout(progressTimer);
  STEPS.forEach(s => {
    const el = document.getElementById(s.id);
    el.classList.remove('active');
    el.classList.add('done');
  });
  setProgress(100, 'Rapport prêt ✓');
  document.getElementById('progress-pct').style.color = 'var(--accent)';
}

function setProgress(pct, subtitle) {
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + ' %';
  if (subtitle) document.getElementById('progress-subtitle').textContent = subtitle;
}

function hideProgress() {
  document.getElementById('analysis-progress').classList.add('hidden');
}

// ===== RENDER HELPER =====
// Affiche le rapport (complet ou partiel) — utilisé par le stream normal et le fallback erreur réseau
function renderReport(resultContent, exportBar) {
  if (lastReportMarkdown.length > 50) {
    finishProgress();
    setTimeout(() => {
      hideProgress();
      resultContent.innerHTML = marked.parse(lastReportMarkdown);
      resultContent.classList.remove('hidden');
      exportBar.classList.remove('hidden');
      exportBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  } else {
    hideProgress();
    showResult('error', '❌ Aucun contenu reçu. Réessayez.');
  }
}

// ===== ANALYZE — streaming SSE =====
async function analyze() {
  const category = document.getElementById('category').value;
  const content = currentMode === 'text'
    ? document.getElementById('text-input').value.trim()
    : contentText;

  const btn      = document.getElementById('btn-analyze');
  const btnText  = document.querySelector('.btn-text');
  const loader   = document.getElementById('loader');
  const resultContent = document.getElementById('result-content');
  const exportBar     = document.getElementById('export-bar');

  if (content.length < 50) {
    const msgs = {
      url:  '⚠️ Aucun contenu extrait. Cliquez sur "Extraire" d\'abord.',
      text: '⚠️ Le texte est trop court (min. 50 caractères).',
      file: '⚠️ Aucun fichier chargé. Déposez un fichier .txt ou .docx.'
    };
    showResult('error', msgs[currentMode]);
    return;
  }

  btn.disabled = true;
  btnText.classList.add('hidden');
  loader.classList.remove('hidden');
  resultContent.classList.add('hidden');
  exportBar.classList.add('hidden');
  lastReportMarkdown = '';

  startProgress();

  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, content })
    });

    if (!res.ok) {
      // Erreur HTTP classique (400/500)
      const data = await res.json().catch(() => ({ error: `Erreur HTTP ${res.status}` }));
      finishProgress();
      setTimeout(() => { hideProgress(); showResult('error', `❌ ${data.error}`); }, 300);
      return;
    }

    // Lecture du stream SSE ligne par ligne
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    // Map section index → step id pour la progression
    const sectionToStep = { 1: 'step-2', 2: 'step-3', 3: 'step-4', 4: 'step-5' };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        let payload;
        try { payload = JSON.parse(line.slice(6)); } catch { continue; }

        if (payload.error) {
          finishProgress();
          setTimeout(() => { hideProgress(); showResult('error', `❌ ${payload.error}`); }, 300);
          return;
        }

        // Une section est terminée — coche l'étape correspondante
        if (payload.progress) {
          const stepId = sectionToStep[payload.progress];
          if (stepId) {
            const el = document.getElementById(stepId);
            if (el) { el.classList.remove('active'); el.classList.add('done'); }
          }
          // Met à jour la barre de progression (25% par section)
          setProgress(payload.progress * 23 + 10, `Section ${payload.progress}/4 analysée…`);
        }

        // Rapport complet reçu
        if (payload.report) {
          lastReportMarkdown = payload.report;
        }

        if (payload.done) {
          finishProgress();
          setTimeout(() => {
            hideProgress();
            resultContent.innerHTML = marked.parse(lastReportMarkdown);
            resultContent.classList.remove('hidden');
            exportBar.classList.remove('hidden');
            exportBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 500);
          return;
        }
      }
    }

    // Fallback : stream fermé sans signal done
    renderReport(resultContent, exportBar);

  } catch (err) {
    // NS_ERROR_NET_PARTIAL_TRANSFER : si on a du contenu partiel, on l'affiche
    clearTimeout(progressTimer);
    renderReport(resultContent, exportBar);
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    loader.classList.add('hidden');
  }
}

// ===== EXPORT =====
function parseSections(markdown) {
  const sections = [];
  let current = null;
  for (const line of markdown.split('\n')) {
    const match = line.match(/^##\s+(\d+)\.\s+(.+)/);
    if (match) {
      if (current) sections.push(current);
      current = { index: parseInt(match[1]), title: match[2].trim(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function slugDate() { return new Date().toISOString().slice(0, 10); }

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportFull(format) {
  if (!lastReportMarkdown) return;
  const cat  = document.getElementById('category').value.replace(/\s+/g, '-');
  const date = slugDate();
  if (format === 'md') {
    downloadText(`smartdiscover-${cat}-${date}.md`,
      `# Rapport SmartDiscover — ${cat}\n_Généré le ${date}_\n\n---\n\n` + lastReportMarkdown);
  } else {
    downloadText(`smartdiscover-${cat}-${date}.txt`,
      `RAPPORT SMARTDISCOVER — ${cat.toUpperCase()}\nGénéré le ${date}\n${'='.repeat(50)}\n\n` + markdownToPlain(lastReportMarkdown));
  }
}

function exportSection(num) {
  if (!lastReportMarkdown) return;
  const section = parseSections(lastReportMarkdown).find(s => s.index === num);
  if (!section) { alert('Section introuvable.'); return; }
  const cat    = document.getElementById('category').value.replace(/\s+/g, '-');
  const date   = slugDate();
  const slug   = `s${num}-${section.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 30)}`;
  const mdContent = section.lines.join('\n');
  if (window._shiftDown) {
    downloadText(`smartdiscover-${cat}-${slug}-${date}.txt`,
      `SECTION ${num} — ${section.title.toUpperCase()}\nGénéré le ${date}\n${'='.repeat(50)}\n\n` + markdownToPlain(mdContent));
  } else {
    downloadText(`smartdiscover-${cat}-${slug}-${date}.md`,
      `# Section ${num} — ${section.title}\n_Rapport SmartDiscover — ${cat} — ${date}_\n\n---\n\n` + mdContent);
  }
}

window._shiftDown = false;
document.addEventListener('keydown', e => { if (e.key === 'Shift') window._shiftDown = true; });
document.addEventListener('keyup',   e => { if (e.key === 'Shift') window._shiftDown = false; });

function markdownToPlain(md) {
  return md
    .replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ').replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '  ').replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/---+/g, '─'.repeat(40)).replace(/\n{3,}/g, '\n\n').trim();
}

// ===== HELPERS =====
function showStatus(el, type, msg) {
  el.className = `extract-status ${type}`;
  el.textContent = msg;
}

function showResult(type, message) {
  const rc = document.getElementById('result-content');
  document.getElementById('result-placeholder').classList.add('hidden');
  rc.innerHTML = type === 'error' ? `<div class="error-box">${message}</div>` : message;
  rc.classList.remove('hidden');
}
