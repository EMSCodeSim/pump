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
  - FIX: Persist preconnectCount + seed newly-added preconnect with defaults so it sticks across restarts.
*/

const KEY_PC_COUNT = 'pump_preconnect_count_v1';

let preconnectCount = 1;

function $(id) { return document.getElementById(id); }

function safeMount() {
  // setup-preconnects.html should have <div id="setupMount"></div>
  return $('setupMount') || document.querySelector('#setupMount') || null;
}

function deptKeyForIndex(i) {
  return i === 1 ? 'left' : i === 2 ? 'back' : 'right';
}

function hasRealLineDefaults(lineObj) {
  if (!lineObj || typeof lineObj !== 'object') return false;
  const hose = String(lineObj.hose || '').trim();
  const noz  = String(lineObj.nozzle || '').trim();
  const len  = Number(lineObj.length || 0);
  return (len > 0) || !!hose || !!noz;
}

function readSavedCount() {
  try {
    const v = Number(localStorage.getItem(KEY_PC_COUNT) || 0);
    if (v >= 1 && v <= 3) return v;
  } catch (_e) {}
  return null;
}

function writeSavedCount(n) {
  try { localStorage.setItem(KEY_PC_COUNT, String(n)); } catch (_e) {}
}

function computeInitialCount() {
  // 1) Prefer persisted count (so "Add Preconnect" sticks even if values are still blank)
  const saved = readSavedCount();
  if (saved) return saved;

  // 2) Fallback: infer from real saved defaults
  const l2 = getLineDefaults('line2') || {};
  const l3 = getLineDefaults('line3') || {};

  let count = 1;
  if (hasRealLineDefaults(l2)) count = 2;
  if (hasRealLineDefaults(l3)) count = 3;
  return count;
}

function renderPreconnectCard(i) {
  const lineId = `line${i}`;
  const existing = getLineDefaults(lineId) || {};

  const hoses = getDeptHoses();
  const nozzles = getDeptNozzles();

  const card = document.createElement('div');
  card.className = 'pc-card';
  card.innerHTML = `
    <div class="pc-card-header">
      <div class="pc-title">Preconnect ${i}</div>
      <div class="pc-sub">Line ${i}</div>
    </div>

    <div class="pc-grid">
      <label class="pc-field">
        <div class="pc-label">Name</div>
        <input id="pc-name-${i}" type="text" placeholder="Preconnect ${i}">
      </label>

      <label class="pc-field">
        <div class="pc-label">Hose</div>
        <select id="pc-hose-${i}">
          <option value="">Select…</option>
          ${hoses.map(h => `<option value="${h.id}">${h.label}</option>`).join('')}
        </select>
      </label>

      <label class="pc-field">
        <div class="pc-label">Length (ft)</div>
        <input id="pc-length-${i}" type="number" min="0" step="25" placeholder="0">
      </label>

      <label class="pc-field">
        <div class="pc-label">Nozzle</div>
        <select id="pc-nozzle-${i}">
          <option value="">Select…</option>
          ${nozzles.map(n => `<option value="${n.id}">${n.label}</option>`).join('')}
        </select>
      </label>
    </div>
  `;

  // Fill existing values (if any)
  // Note: "Name" is stored as label on the dept default object; we try to read that for display.
  try {
    const deptKey = deptKeyForIndex(i);
    const full = getDeptLineDefault(deptKey);
    const label = full && typeof full === 'object' ? (full.label || '') : '';
    if ($(`pc-name-${i}`)) $(`pc-name-${i}`).value = label || `Preconnect ${i}`;
  } catch (_e) {
    if ($(`pc-name-${i}`)) $(`pc-name-${i}`).value = `Preconnect ${i}`;
  }

  if ($(`pc-hose-${i}`))   $(`pc-hose-${i}`).value   = existing.hose || '';
  if ($(`pc-length-${i}`)) $(`pc-length-${i}`).value = Number(existing.length || 0) || '';
  if ($(`pc-nozzle-${i}`)) $(`pc-nozzle-${i}`).value = existing.nozzle || '';

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

function seedNewPreconnectDefaults(index) {
  // Copy Line 1 if it exists, otherwise use common defaults
  const template = getLineDefaults('line1') || {};
  const hose   = String(template.hose || '1.75');
  const length = Number(template.length || 200);
  const nozzle = String(template.nozzle || 'fog_150');

  const lineId = `line${index}`;
  const current = getLineDefaults(lineId) || {};

  // Only seed if it's still blank-ish
  if (!hasRealLineDefaults(current)) {
    setLineDefaults(lineId, { hose, nozzle, length, elevation: 0 });

    // Also set a label (name) for nicer display
    try {
      const deptKey = deptKeyForIndex(index);
      const full = getDeptLineDefault(deptKey);
      if (full && typeof full === 'object') {
        setDeptLineDefault(deptKey, { ...full, label: `Preconnect ${index}` });
      }
    } catch (_e) { /* ignore */ }
  }
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

  // ✅ Persist count so newly added preconnects stay visible across restarts
  writeSavedCount(preconnectCount);

  // Existing flag
  try { localStorage.setItem('firstTimeSetupComplete', 'true'); } catch (_e) {}

  window.location.replace('/');
}

export function render(_root) {
  preconnectCount = computeInitialCount();

  // If count says we have 2/3, ensure they have something seeded so calc/menus behave consistently
  if (preconnectCount >= 2) seedNewPreconnectDefaults(2);
  if (preconnectCount >= 3) seedNewPreconnectDefaults(3);

  renderAll();

  const addBtn = $('addBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (preconnectCount < 3) {
        preconnectCount++;
        // ✅ Persist immediately so it doesn't disappear if user backs out / restarts
        writeSavedCount(preconnectCount);

        // ✅ Seed defaults so it becomes a real "default" right away
        seedNewPreconnectDefaults(preconnectCount);

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
