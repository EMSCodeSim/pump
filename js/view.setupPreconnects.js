// js/view.setupPreconnects.js

import {
  getDeptHoses,
  getDeptNozzles,
  getLineDefaults,
  setLineDefaults,
  getDeptLineDefault,
  setDeptLineDefault
} from './store.js';

/*
  First-Time Preconnect Setup (Lines 1–3)
  - Preconnects ARE Line 1/2/3
  - Saves using setLineDefaults('line1'|'line2'|'line3', {hose,nozzle,length,elevation})
*/

function $(id) { return document.getElementById(id); }

function safeMount() {
  return $('mount') || $('cards');
}

function createEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function lineIdForIndex(i){
  return i === 1 ? 'line1' : i === 2 ? 'line2' : 'line3';
}
function deptKeyForIndex(i){
  return i === 1 ? 'left' : i === 2 ? 'back' : 'right';
}

let preconnectCount = 1;

function escapeHtml(str){
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPreconnectCard(index) {
  const hoses = getDeptHoses();
  const nozzles = getDeptNozzles();

  const lineId = lineIdForIndex(index);
  const existing = getLineDefaults(lineId) || {};

  // Name: store it in dept default label (optional)
  const existingFull = getDeptLineDefault(deptKeyForIndex(index)) || {};
  const existingName = existingFull.label || `Preconnect ${index}`;

  const hoseVal = existing.hose || (hoses[0]?.id ?? hoses[0]?.size ?? '');
  const lenVal  = Number(existing.length ?? 200) || 200;
  const nozVal  = existing.nozzle || (nozzles[0]?.id ?? '');

  const card = createEl('div', 'card preconnect-card');

  card.innerHTML = `
    <div style="font-weight:800;margin-bottom:6px;">Preconnect ${index}</div>

    <label>Name</label>
    <input type="text" id="pc-name-${index}" placeholder="Officer Side 1¾" value="${escapeHtml(existingName)}">

    <div class="grid cols2">
      <div>
        <label>Hose Size</label>
        <select id="pc-hose-${index}">
          ${hoses.map(h => {
            const v = String(h.id ?? h.size ?? '');
            const selected = v === String(hoseVal) ? 'selected' : '';
            return `<option value="${escapeHtml(v)}" ${selected}>${escapeHtml(h.label)}</option>`;
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
        return `<option value="${escapeHtml(n.id)}" ${selected}>${escapeHtml(n.label || n.name || n.id)}</option>`;
      }).join('')}
    </select>
  `;

  return card;
}

function renderAll() {
  const mount = safeMount();
  if (!mount) {
    console.error('[setup-preconnects] mount container not found');
    return;
  }

  mount.innerHTML = '';
  for (let i = 1; i <= preconnectCount; i++) {
    mount.appendChild(renderPreconnectCard(i));
  }

  const addBtn = $('addBtn');
  if (addBtn) addBtn.disabled = preconnectCount >= 3;

  const msg = $('msg');
  if (msg) {
    msg.textContent = preconnectCount >= 3
      ? 'Maximum reached (3 preconnects).'
      : 'Tip: Preconnect 2 and 3 are optional.';
  }
}

// Only treat line2/line3 as configured if they have REAL values
function hasRealLineDefaults(lineObj){
  if (!lineObj || typeof lineObj !== 'object') return false;
  const hose = String(lineObj.hose || '').trim();
  const noz  = String(lineObj.nozzle || '').trim();
  const len  = Number(lineObj.length || 0);
  return (len > 0) || !!hose || !!noz;
}

function computeInitialCount(){
  const l1 = getLineDefaults('line1') || {};
  const l2 = getLineDefaults('line2') || {};
  const l3 = getLineDefaults('line3') || {};

  // Always show at least 1
  let count = 1;

  if (hasRealLineDefaults(l2)) count = 2;
  if (hasRealLineDefaults(l3)) count = 3;

  // If line1 is totally empty, still keep count=1 (wizard requires at least one)
  // (No need to check l1)
  return count;
}

function saveAndExit() {
  const map = ['line1', 'line2', 'line3'];

  for (let i = 1; i <= preconnectCount; i++) {
    const name = ($(`pc-name-${i}`)?.value || '').trim() || `Preconnect ${i}`;
    const hose = String($(`pc-hose-${i}`)?.value || '');
    const length = Number($(`pc-length-${i}`)?.value || 0);
    const nozzle = String($(`pc-nozzle-${i}`)?.value || '');

    setLineDefaults(map[i - 1], {
      hose,
      nozzle,
      length,
      elevation: 0
    });

    // Store name as label on the dept default (optional but nice)
    try {
      const deptKey = deptKeyForIndex(i);
      const full = getDeptLineDefault(deptKey);
      if (full && typeof full === 'object') {
        setDeptLineDefault(deptKey, { ...full, label: name });
      }
    } catch (_e) { /* non-fatal */ }
  }

  localStorage.setItem('firstTimeSetupComplete', 'true');
  window.location.replace('/');
}

export function render(_root) {
  preconnectCount = computeInitialCount();
  renderAll();

  const addBtn = $('addBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (preconnectCount < 3) {
        preconnectCount++;
        renderAll();
      }
    };
  } else {
    console.warn('[setup-preconnects] addBtn not found');
  }

  const saveBtn = $('saveBtn');
  if (saveBtn) {
    saveBtn.onclick = saveAndExit;
  } else {
    console.warn('[setup-preconnects] saveBtn not found');
  }

  return { dispose(){} };
}

// Auto-boot on the standalone page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (safeMount()) render(document.body);
  });
} else {
  if (safeMount()) render(document.body);
}
