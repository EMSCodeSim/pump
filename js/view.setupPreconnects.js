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

// ---------- helpers ----------
function $(id) {
  return document.getElementById(id);
}

function safeMount() {
  return $('cards') || $('mount');
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
    <div class="card-title">Preconnect ${index}</div>

    <label>Name</label>
    <input type="text" id="pc-name-${index}" placeholder="Officer Side 1¾">

    <label>Hose Size</label>
    <select id="pc-hose-${index}">
      ${hoses.map(h => `<option value="${h.size}">${h.label}</option>`).join('')}
    </select>

    <label>Length (ft)</label>
    <input type="number" id="pc-length-${index}" value="200">

    <label>Nozzle</label>
    <select id="pc-nozzle-${index}">
      ${nozzles.map(n => `<option value="${n.id}">${n.label}</option>`).join('')}
    </select>
  `;

  return card;
}

function renderAll() {
  const mount = safeMount();
  if (!mount) {
    console.error('Preconnect setup: mount container not found');
    return;
  }

  mount.innerHTML = '';

  for (let i = 1; i <= preconnectCount; i++) {
    mount.appendChild(renderPreconnectCard(i));
  }

  const addBtn = $('addPreconnectBtn');
  if (addBtn) {
    addBtn.disabled = preconnectCount >= 3;
  }
}

// ---------- save ----------
function saveAndExit() {
  for (let i = 1; i <= preconnectCount; i++) {
    const name = $(`pc-name-${i}`)?.value || `Preconnect ${i}`;
    const hose = Number($(`pc-hose-${i}`)?.value);
    const length = Number($(`pc-length-${i}`)?.value);
    const nozzleId = $(`pc-nozzle-${i}`)?.value;

    setLineDefaults(`pc${i}`, {
      name,
      hoseSize: hose,
      length,
      nozzleId
    });
  }

  localStorage.setItem('firstTimeSetupComplete', 'true');
  window.location.replace('/');
}

// ---------- init ----------
export function render(root) {
  const mount = safeMount();
  if (!mount) {
    root.innerHTML = `
      <div class="card">
        <strong>Error:</strong> Setup container missing.
      </div>
    `;
    return;
  }

  // Load existing preconnects if present
  const existing = getLineDefaults();
  const keys = Object.keys(existing || {}).filter(k => k.startsWith('pc'));
  preconnectCount = Math.min(Math.max(keys.length, 1), 3);

  renderAll();

  const addBtn = $('addPreconnectBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (preconnectCount < 3) {
        preconnectCount++;
        renderAll();
      }
    };
  }

  const saveBtn = $('savePreconnectsBtn');
  if (saveBtn) {
    saveBtn.onclick = saveAndExit;
  }

  return {
    dispose() {}
  };
}
