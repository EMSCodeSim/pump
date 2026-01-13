// js/view.setupPreconnects.js
import {
  getDeptHoses,
  getDeptNozzles,
  getLineDefaults,
  setLineDefaults,
} from './store.js';

// Persist how many preconnect cards user wants (so Add Preconnect sticks)
const KEY_PC_COUNT = 'pump_preconnect_count_v1';

function $(id) { return document.getElementById(id); }

function mountEl() {
  // setup-preconnects.html uses <div id="mount"></div>
  return $('mount');
}

function readCount() {
  try {
    const n = Number(localStorage.getItem(KEY_PC_COUNT) || 0);
    if (n >= 1 && n <= 3) return n;
  } catch (_e) {}
  return null;
}

function writeCount(n) {
  try { localStorage.setItem(KEY_PC_COUNT, String(n)); } catch (_e) {}
}

function looksConfigured(d) {
  // d = {hose,nozzle,length,elevation,name}
  if (!d) return false;
  const hose = String(d.hose || '').trim();
  const noz  = String(d.nozzle || '').trim();
  const len  = Number(d.length || 0);
  return (len > 0 && hose !== '') || noz !== '';
}

let preconnectCount = 1;

function buildCard(i) {
  const lineId = `line${i}`;
  const existing = getLineDefaults(lineId) || {};

  const hoses = getDeptHoses() || [];
  const nozzles = getDeptNozzles() || [];

  const card = document.createElement('div');
  card.className = 'card';

  card.innerHTML = `
    <div style="font-weight:800;font-size:16px;margin-bottom:10px;">Preconnect ${i}</div>

    <div class="grid cols2">
      <div>
        <label>Name</label>
        <input id="pc-name-${i}" type="text" placeholder="Preconnect ${i}">
      </div>

      <div>
        <label>Hose</label>
        <select id="pc-hose-${i}">
          <option value="">Select…</option>
          ${hoses.map(h => `<option value="${h.id}">${h.label}</option>`).join('')}
        </select>
      </div>

      <div>
        <label>Length (ft)</label>
        <input id="pc-length-${i}" type="number" min="0" step="25" placeholder="0">
      </div>

      <div>
        <label>Nozzle</label>
        <select id="pc-nozzle-${i}">
          <option value="">Select…</option>
          ${nozzles.map(n => `<option value="${n.id}">${n.label}</option>`).join('')}
        </select>
      </div>
    </div>
  `;

  // Fill existing (if any)
  const nameEl = $(`pc-name-${i}`);
  const hoseEl = $(`pc-hose-${i}`);
  const lenEl  = $(`pc-length-${i}`);
  const nozEl  = $(`pc-nozzle-${i}`);

  if (nameEl) nameEl.value = (existing.name || existing.label || `Preconnect ${i}`);
  if (hoseEl) hoseEl.value = existing.hose || '';
  if (lenEl)  lenEl.value  = Number(existing.length || 0) ? String(Number(existing.length || 0)) : '';
  if (nozEl)  nozEl.value  = existing.nozzle || '';

  return card;
}

function seedNewLine(i) {
  // Make newly-added preconnect become a real default immediately
  // Copy Line 1 if it exists, else use common defaults
  const template = getLineDefaults('line1') || {};
  const hose   = String(template.hose || '1.75');
  const length = Number(template.length || 200);
  const nozzle = String(template.nozzle || 'fog_150');

  const current = getLineDefaults(`line${i}`) || {};
  if (!looksConfigured(current)) {
    setLineDefaults(`line${i}`, { hose, nozzle, length, elevation: 0, name: `Preconnect ${i}` });
  }
}

function computeInitialCount() {
  // 1) persisted count wins
  const saved = readCount();
  if (saved) return saved;

  // 2) infer from saved line defaults
  const l2 = getLineDefaults('line2') || {};
  const l3 = getLineDefaults('line3') || {};
  let c = 1;
  if (looksConfigured(l2)) c = 2;
  if (looksConfigured(l3)) c = 3;
  return c;
}

function renderAll() {
  const mount = mountEl();
  if (!mount) {
    console.error('[setupPreconnects] #mount not found (check setup-preconnects.html)');
    return;
  }

  mount.innerHTML = '';
  for (let i = 1; i <= preconnectCount; i++) {
    mount.appendChild(buildCard(i));
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
    const name = ($(`pc-name-${i}`)?.value || `Preconnect ${i}`).trim() || `Preconnect ${i}`;
    const hose = String($(`pc-hose-${i}`)?.value || '');
    const length = Number($(`pc-length-${i}`)?.value || 0);
    const nozzle = String($(`pc-nozzle-${i}`)?.value || '');

    // Save as Line 1/2/3 defaults (the only correct mapping)
    setLineDefaults(`line${i}`, { hose, nozzle, length, elevation: 0, name });
  }

  // Persist count + mark first time complete
  writeCount(preconnectCount);
  try { localStorage.setItem('firstTimeSetupComplete', 'true'); } catch (_e) {}

  window.location.replace('/');
}

export function render() {
  preconnectCount = computeInitialCount();

  // If user already has 2/3, ensure they are real defaults (so they don't disappear)
  if (preconnectCount >= 2) seedNewLine(2);
  if (preconnectCount >= 3) seedNewLine(3);

  renderAll();

  const addBtn = $('addBtn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (preconnectCount < 3) {
        preconnectCount++;
        writeCount(preconnectCount);   // persist immediately
        seedNewLine(preconnectCount);  // make it a real default immediately
        renderAll();
      }
    };
  } else {
    console.warn('[setupPreconnects] addBtn not found (id="addBtn")');
  }

  const saveBtn = $('saveBtn');
  if (saveBtn) {
    saveBtn.onclick = saveAndExit;
  } else {
    console.warn('[setupPreconnects] saveBtn not found (id="saveBtn")');
  }
}

// Auto-run on the standalone setup page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => render());
} else {
  render();
}
