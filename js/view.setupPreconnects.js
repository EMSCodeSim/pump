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
*/

function $(id) { return document.getElementById(id); }

function safeMount() {
  // Your setup-preconnects.html uses id="mount"
  return $('mount') || $('cards');
}

function createEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

let preconnectCount = 1;

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
          ${hoses.map(h => `<option value="${h.size}">${h.label}</option>`).join('')}
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
          ${nozzles.map(n => `<option value="${n.id}">${n.label}</option>`).join('')}
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

function saveAndExit() {
  for (let i = 1; i <= preconnectCount; i++) {
    const name = $(`pc-name-${i}`)?.value?.trim() || `Preconnect ${i}`;
    const hoseSize = Number($(`pc-hose-${i}`)?.value || 0);
    const length = Number($(`pc-length-${i}`)?.value || 0);
    const nozzleId = $(`pc-nozzle-${i}`)?.value || '';

    setLineDefaults(`pc${i}`, { name, hoseSize, length, nozzleId });
  }

  // Mark setup complete
  localStorage.setItem('firstTimeSetupComplete', 'true');

  // Go to app home
  window.location.replace('/');
}

export function render(root) {
  // root is optional for this standalone page
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

  // Determine existing preconnects count
  const existing = (typeof getLineDefaults === 'function') ? (getLineDefaults() || {}) : {};
  const pcKeys = Object.keys(existing).filter(k => k.startsWith('pc'));
  preconnectCount = Math.min(Math.max(pcKeys.length, 1), 3);

  renderAll();

  // IMPORTANT: match your HTML ids: addBtn + saveBtn
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

// ✅ AUTO-BOOT when loaded directly by setup-preconnects.html
// The router won't call render() on this standalone page, so we do it here.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (safeMount()) render(document.body);
  });
} else {
  if (safeMount()) render(document.body);
}
