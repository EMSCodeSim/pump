// js/view.setupPreconnects.js

import {
  getDeptHoses,
  getDeptNozzles,
  getLineDefaults,
  setLineDefaults
} from './store.js';

/*
  Preconnect setup wizard
  - Supports 1–3 preconnects
  - Preconnect 1 always exists
  - IMPORTANT: saves to line1/line2/line3 because store.js only supports those ids.
*/

// ---------- helpers ----------
function $(id) {
  return document.getElementById(id);
}

function safeMount() {
  // setup-preconnects.html uses id="mount"
  return $('mount') || $('cards');
}

function createEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

// ---------- state ----------
let preconnectCount = 1;

// ---------- render ----------
function renderPreconnectCard(index) {
  const hoses = getDeptHoses();
  const nozzles = getDeptNozzles();

  const card = createEl('div', 'card preconnect-card');

  card.innerHTML = `
    <div style="font-weight:800;margin-bottom:6px;">Preconnect ${index}</div>

    <div class="grid cols2">
      <div>
        <label>Name</label>
        <input type="text" id="pc-name-${index}" placeholder="Officer Side 1¾">
      </div>
      <div>
        <label>Hose Size</label>
        <select id="pc-hose-${index}">
          ${hoses.map(h => `<option value="${h.id ?? h.size ?? ''}">${h.label}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="grid cols2" style="margin-top:10px;">
      <div>
        <label>Length (ft)</label>
        <input type="number" id="pc-length-${index}" value="200">
      </div>
      <div>
        <label>Nozzle</label>
        <select id="pc-nozzle-${index}">
          ${nozzles.map(n => `<option value="${n.id}">${n.label || n.name || n.id}</option>`).join('')}
        </select>
      </div>
    </div>
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

// ---------- save ----------
function saveAndExit() {
  // store.js supports ONLY: line1/line2/line3
  const map = ['line1', 'line2', 'line3'];

  for (let i = 1; i <= preconnectCount; i++) {
    const name = ($(`pc-name-${i}`)?.value || '').trim() || `Preconnect ${i}`;

    // IMPORTANT: store.setLineDefaults expects { hose, nozzle, length, elevation }
    // - hose should be hose id or diameter string
    // - nozzle should be nozzle id
    const hose = $(`pc-hose-${i}`)?.value || '1.75';
    const length = Number($(`pc-length-${i}`)?.value || 200) || 200;
    const nozzle = $(`pc-nozzle-${i}`)?.value || '';

    // Save to canonical keys used by calc: left/back/right via line1/2/3 mapping in store.js
    setLineDefaults(map[i - 1], {
      hose,
      nozzle,
      length,
      elevation: 0,
      // name is not used by store.js right now; keep it for forward compatibility
      name
    });
  }

  localStorage.setItem('firstTimeSetupComplete', 'true');
  window.location.replace('/');
}

// ---------- init ----------
export function render(root) {
  const mount = safeMount();
  if (!mount) {
    if (root) {
      root.innerHTML = `
        <div class="card">
          <strong>Error:</strong> Setup container missing.
        </div>
      `;
    }
    return;
  }

  // Determine existing preconnect count by checking whether line2/line3 are configured
  // getLineDefaults('lineX') returns a shape: { hose, nozzle, length, elevation }
  const l1 = getLineDefaults('line1') || {};
  const l2 = getLineDefaults('line2') || {};
  const l3 = getLineDefaults('line3') || {};

  const has2 = (Number(l2.length || 0) > 0) || !!l2.hose || !!l2.nozzle;
  const has3 = (Number(l3.length || 0) > 0) || !!l3.hose || !!l3.nozzle;

  preconnectCount = has3 ? 3 : has2 ? 2 : 1;

  renderAll();

  // Prefill values from existing defaults
  const fill = (idx, data) => {
    if (!data) return;
    const hoseEl = $(`pc-hose-${idx}`);
    const nozEl = $(`pc-nozzle-${idx}`);
    const lenEl = $(`pc-length-${idx}`);
    if (hoseEl && data.hose) hoseEl.value = String(data.hose);
    if (nozEl && data.nozzle) nozEl.value = String(data.nozzle);
    if (lenEl && data.length != null) lenEl.value = String(Number(data.length) || 0);
  };

  fill(1, l1);
  if (preconnectCount >= 2) fill(2, l2);
  if (preconnectCount >= 3) fill(3, l3);

  // Wire buttons (match setup-preconnects.html ids)
  const addBtn = $('addBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (preconnectCount < 3) {
        preconnectCount++;
        renderAll();

        // When adding a new card, try to prefill it from stored defaults if present
        const src = preconnectCount === 2 ? l2 : l3;
        fill(preconnectCount, src);
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

// ✅ AUTO-BOOT when loaded directly by setup-preconnects.html
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (safeMount()) render(document.body);
  });
} else {
  if (safeMount()) render(document.body);
}
