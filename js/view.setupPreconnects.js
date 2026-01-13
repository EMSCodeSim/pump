// js/view.setupPreconnects.js

import {
  getDeptHoses,
  getDeptNozzles,
  getLineDefaults,
  setLineDefaults,
  getConfiguredPreconnects,
  getDeptLineDefault,
  setDeptLineDefault
} from './store.js';

/*
  First-Time Preconnect Setup (Lines 1–3)
  - Preconnects ARE Line 1/2/3
  - Saves into store.js dept defaults: pump_dept_defaults_v1 (left/back/right)
  - Uses setLineDefaults('line1'|'line2'|'line3', {hose,nozzle,length,elevation})
*/

function $(id) { return document.getElementById(id); }

function safeMount() {
  return $('cards') || $('mount');
}

function createEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

// Map wizard index -> store line id + dept key
function lineIdForIndex(i){
  return i === 1 ? 'line1' : i === 2 ? 'line2' : 'line3';
}
function deptKeyForIndex(i){
  return i === 1 ? 'left' : i === 2 ? 'back' : 'right';
}

let preconnectCount = 1;

function renderPreconnectCard(index) {
  const hoses = getDeptHoses();
  const nozzles = getDeptNozzles();

  const lineId = lineIdForIndex(index);
  const existing = getLineDefaults(lineId) || {};
  const existingName =
    (getDeptLineDefault(deptKeyForIndex(index)) || {}).label || `Preconnect ${index}`;

  const hoseVal = existing.hose || (hoses[0]?.size ?? '');
  const lenVal  = Number(existing.length ?? 200) || 200;
  const nozVal  = existing.nozzle || (nozzles[0]?.id ?? '');

  const card = createEl('div', 'card preconnect-card');

  card.innerHTML = `
    <div class="card-title">Preconnect ${index}</div>

    <label>Name</label>
    <input type="text" id="pc-name-${index}" placeholder="Officer Side 1¾" value="${escapeHtml(existingName)}">

    <div class="grid cols2">
      <div>
        <label>Hose Size</label>
        <select id="pc-hose-${index}">
          ${hoses.map(h => {
            const selected = String(h.size) === String(hoseVal) ? 'selected' : '';
            return `<option value="${escapeAttr(h.size)}" ${selected}>${escapeHtml(h.label)}</option>`;
          }).join('')}
        </select>
      </div>

      <div>
        <label>Length (ft)</label>
        <input type="number" id="pc-length-${index}" value="${Number(lenVal)}" min="0" step="25">
      </div>
    </div>

    <label>Nozzle</label>
    <select id="pc-nozzle-${index}">
      ${nozzles.map(n => {
        const selected = String(n.id) === String(nozVal) ? 'selected' : '';
        return `<option value="${escapeAttr(n.id)}" ${selected}>${escapeHtml(n.label)}</option>`;
      }).join('')}
    </select>
  `;

  return card;
}

function renderAll() {
  const mount = safeMount();
  if (!mount) {
    console.error('Preconnect setup: mount container not found (#mount or #cards).');
    return;
  }

  mount.innerHTML = '';
  for (let i = 1; i <= preconnectCount; i++) {
    mount.appendChild(renderPreconnectCard(i));
  }

  const addBtn = $('addBtn');
  if (addBtn) addBtn.disabled = preconnectCount >= 3;
}

function saveAndExit() {
  for (let i = 1; i <= preconnectCount; i++) {
    const name = $(`pc-name-${i}`)?.value?.trim() || `Preconnect ${i}`;
    const hose = String($(`pc-hose-${i}`)?.value || '');
    const length = Number($(`pc-length-${i}`)?.value || 0);
    const nozzle = String($(`pc-nozzle-${i}`)?.value || '');

    const lineId = lineIdForIndex(i);
    const deptKey = deptKeyForIndex(i);

    // This is the IMPORTANT part: save into Line 1/2/3 defaults in store.js shape
    setLineDefaults(lineId, {
      hose,
      nozzle,
      length,
      elevation: 0
    });

    // Optional: store the user-friendly name as the dept default label
    try {
      const full = getDeptLineDefault(deptKey);
      if (full && typeof full === 'object') {
        setDeptLineDefault(deptKey, { ...full, label: name });
      }
    } catch (e) {
      console.warn('Could not set label for', deptKey, e);
    }
  }

  localStorage.setItem('firstTimeSetupComplete', 'true');
  window.location.replace('/');
}

export function render(root) {
  // Determine how many are configured already (min 1, max 3)
  try {
    const configured = getConfiguredPreconnects();
    preconnectCount = Math.min(Math.max(Array.isArray(configured) ? configured.length : 1, 1), 3);
  } catch (_e) {
    preconnectCount = 1;
  }

  renderAll();

  const addBtn = $('addBtn');     // matches setup-preconnects.html :contentReference[oaicite:2]{index=2}
  if (addBtn) {
    addBtn.onclick = () => {
      if (preconnectCount < 3) {
        preconnectCount++;
        renderAll();
      }
    };
  }

  const saveBtn = $('saveBtn');   // matches setup-preconnects.html :contentReference[oaicite:3]{index=3}
  if (saveBtn) {
    saveBtn.onclick = saveAndExit;
  }

  return { dispose() {} };
}

// --- tiny helpers to avoid breaking HTML when injecting values ---
function escapeHtml(str){
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function escapeAttr(str){
  // ok for option values
  return escapeHtml(str).replaceAll('\n', ' ');
}
