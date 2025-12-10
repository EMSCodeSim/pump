import { DEPT_UI_NOZZLES, DEPT_UI_HOSES } from './store.js';

// view.lineStandpipe.js
// Standpipe-only popup editor for a single line (Line 1 / 2 / 3).
// - Uses same department hose/nozzle logic as view.lineStandard.js
//   (DEPT_UI_HOSES / DEPT_UI_NOZZLES, with "Closed" nozzle option).
// - Engine → standpipe hose: type + length + number of hoses
// - Floors up (or vertical feet)
// - Standpipe → nozzle hose: type + length
// - Nozzle type
// - Live GPM & PDP preview
// - "Explain math" button shows breakdown window

/* -------------------------------------------------------------------------- */
/*  Shared hose / nozzle helpers (mirrored from view.lineStandard.js)         */
/* -------------------------------------------------------------------------- */

// Very small helper: parse something like "150 gpm @ 50 psi" out of labels
function parseGpmFromLabel(label) {
  if (!label) return null;
  const match = String(label).match(/(\d+)\s*gpm/i);
  return match ? Number(match[1]) : null;
}

function parseNpFromLabel(label) {
  if (!label) return null;
  const match = String(label).match(/@?\s*(\d+)\s*psi/i);
  return match ? Number(match[1]) : null;
}

// For smooth-bore tips, try to pull out "7/8", "15/16", "1 1/8", etc.
function extractSmoothTipFromLabel(label) {
  if (!label) return '';
  const str = String(label);

  // Look for explicit fraction first
  const frac = str.match(/(\d+\s*\/\s*\d+)/);
  if (frac) return frac[1].replace(/\s+/g, ' ');

  // Look for patterns like 7/8", 15/16", 1 1/8"
  const frac2 = str.match(/(\d+\s*\/\s*\d+)\s*"?/);
  if (frac2) return frac2[1];

  return '';
}

/* ===================== UPDATED NOZZLE LABEL FORMATTER ===================== */
/* This is where we make the names look nice in the dropdowns.                */
/* It now:                                                                    */
/*   - decodes smooth-bore ids like sb_1516_50_185 → "Smooth 15/16"          */
/*   - formats custom_noz_* entries as "Fog 150 gpm @ 50 psi" style          */
/*   - formats ms_tip_* entries as "Master stream tip 600 gpm @ 80 psi"      */
/* ========================================================================== */

function prettifyNozzle(id, label, gpm, np) {
  const idStr = String(id || '');
  let lbl = label ? String(label) : idStr;
  const lowerLbl = lbl.toLowerCase();
  const lowerId = idStr.toLowerCase();

  const hasGpmPsiWords = /gpm/i.test(lbl) && /psi/i.test(lbl);

  // --- Custom nozzles (built from user input) ------------------------------
  // Expect ids like: custom_noz_<timestamp>_<gpm>_<np>
  if (lowerId.startsWith('custom_noz_')) {
    let g = gpm || 0;
    let p = np || 0;

    const m = idStr.match(/(\d+)_([0-9]+)$/);
    if (m) {
      if (!g) g = Number(m[1]);
      if (!p) p = Number(m[2]);
    }

    let type = 'Custom nozzle';
    if (lowerId.includes('fog') || /fog/i.test(lbl)) type = 'Fog';
    else if (lowerId.includes('sb') || /smooth/i.test(lbl)) type = 'Smooth';
    else if (lowerId.includes('ms_tip')) type = 'Master stream';

    if (!g && !p) {
      return { label: lbl || type, gpm: 0, np: 0 };
    }
    if (!p) p = 50;

    const finalLabel = `${type} ${g} gpm @ ${p} psi`;
    return { label: finalLabel, gpm: g, np: p };
  }

  // --- Smooth bores --------------------------------------------------------
  if (lowerId.startsWith('sb') || lowerLbl.includes('smooth')) {
    if (!/smooth/i.test(lbl)) {
      lbl = 'Smooth ' + lbl;
    }

    let tip = extractSmoothTipFromLabel(lbl);

    // If the label doesn't already contain a nice tip size, try to decode from id.
    // Example ids:
    //   sb_78_50_160   ->  7/8"   160 gpm @ 50 psi
    //   sb_1516_50_185 -> 15/16"  185 gpm @ 50 psi
    //   sb_1118_50_265 -> 1 1/8"  265 gpm @ 50 psi
    const idMatch = idStr.match(/^sb_([^_]+)_([^_]+)_([^_]+)/);
    if (idMatch) {
      const tipCode = idMatch[1];
      const npId = Number(idMatch[2]);
      const gId = Number(idMatch[3]);

      if (!tip) {
        if (tipCode === '78') tip = '7/8';
        else if (tipCode === '1516') tip = '15/16';
        else if (tipCode === '1') tip = '1';
        else if (tipCode === '1118') tip = '1 1/8';
        else if (tipCode === '114') tip = '1 1/4';
      }
      if (!gpm && gId) gpm = gId;
      if (!np && npId) np = npId;
    }

    const gFromLabel = parseGpmFromLabel(lbl);
    const pFromLabel = parseNpFromLabel(lbl);
    if (!gpm && gFromLabel) gpm = gFromLabel;
    if (!np && pFromLabel)  np  = pFromLabel;

    if (!tip) {
      tip = extractSmoothTipFromLabel(lbl);
    }

    if (tip && gpm && np) {
      lbl = `Smooth ${tip}" ${gpm} gpm @ ${np} psi`;
    }

    return { label: lbl, gpm, np };
  }

  // --- Master stream tips --------------------------------------------------
  // Expect ids like: ms_tip_<npGuess?>_<gpm>
  if (lowerId.startsWith('ms_tip')) {
    const parts = idStr.split('_'); // e.g. ["ms","tip","134","800"]
    const maybeGpm = Number(parts[parts.length - 1]);
    if (!gpm && maybeGpm) gpm = maybeGpm;
    if (!np) np = 80; // default NP for master stream tips if not stored

    const finalLabel = `Master stream tip ${gpm || 0} gpm @ ${np} psi`;
    return { label: finalLabel, gpm: gpm || 0, np: np || 0 };
  }

  // --- Fog and everything else --------------------------------------------
  if (hasGpmPsiWords) {
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom;
    return { label: lbl, gpm, np };
  }

  // FOG patterns based on id if available
  if (lowerId.includes('fog')) {
    const nums = idStr.match(/\d+/g) || [];
    if (nums.length >= 2) {
      const p = Number(nums[nums.length - 2]);
      const g = Number(nums[nums.length - 1]);
      if (!gpm && g) gpm = g;
      if (!np && p)  np  = p;
    }
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom || 50;

    if (gpm && np) {
      lbl = `Fog ${gpm} gpm @ ${np} psi`;
    } else if (gpm) {
      lbl = `Fog ${gpm} gpm`;
    } else {
      lbl = 'Fog nozzle';
    }

    return { label: lbl, gpm, np };
  }

  // Generic: if we have numbers but no words, just format "XXX gpm @ YY psi"
  if (!hasGpmPsiWords) {
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom;

    if (gpm && np) {
      lbl = `${lbl} ${gpm} gpm @ ${np} psi`;
    } else if (gpm) {
      lbl = `${lbl} ${gpm} gpm`;
    }
  }

  return { label: lbl, gpm, np };
}

/* -------------------------------------------------------------------------- */
/*  Department → hose list                                                   */
/* -------------------------------------------------------------------------- */

function getHoseListFromDept(dept) {
  if (Array.isArray(DEPT_UI_HOSES) && DEPT_UI_HOSES.length) {
    return DEPT_UI_HOSES.map((h, idx) => {
      if (!h) return null;
      const id = h.id != null ? String(h.id) : String(h.value ?? h.name ?? idx);
      const baseLabel = h.label || h.name || String(id);
      return {
        id,
        label: formatHoseLabel(baseLabel),
        c: typeof h.c === 'number' ? h.c : undefined,
      };
    }).filter(Boolean);
  }

  // Fallback if dept is carrying some ad-hoc hose data
  if (dept && dept.hoses) {
    if (Array.isArray(dept.hoses)) {
      return dept.hoses.map((h, idx) => {
        if (!h) return null;
        if (typeof h === 'string') {
          return {
            id: h,
            label: formatHoseLabel(h),
          };
        }
        if (h && typeof h === 'object') {
          const id = h.id != null ? String(h.id) : String(h.value ?? h.name ?? idx);
          const baseLabel = h.label || h.name || String(id);
          return {
            id,
            label: formatHoseLabel(baseLabel),
            c: typeof h.c === 'number' ? h.c : undefined,
          };
        } else {
          const id = String(h);
          return { id, label: formatHoseLabel(id) };
        }
      }).filter(Boolean);
    }
  }

  return [];
}

// Simple formatting for hoses (mirror of calc’s look: "1 3/4\" 200'")
function formatHoseLabel(baseLabel) {
  if (!baseLabel) return '';
  let lbl = String(baseLabel);

  // Normalize some common patterns
  lbl = lbl.replace(/1\.75/g, '1 3/4');
  lbl = lbl.replace(/2\.5/g, '2 1/2');
  lbl = lbl.replace(/3\.0/g, '3');

  return lbl;
}

/* -------------------------------------------------------------------------- */
/*  Popup open / close wiring                                                */
/* -------------------------------------------------------------------------- */

let standpipeState = {
  lineId: null,
  mode: 'single', // 'single' or 'attack + supply' etc, depending how you wire it later
  data: null,     // the object that represents this standpipe line in the store
  onSave: null,   // callback(lineId, updatedData)
};

export function openStandpipeLinePopup(lineId, currentData, options = {}) {
  standpipeState.lineId = lineId;
  standpipeState.data = { ...(currentData || {}) };
  standpipeState.onSave = typeof options.onSave === 'function' ? options.onSave : null;

  const overlay = document.getElementById('standpipe-line-overlay');
  const panel = document.getElementById('standpipe-line-panel');
  if (!overlay || !panel) {
    console.warn('Standpipe popup elements not found in DOM');
    return;
  }

  overlay.classList.add('visible');
  panel.classList.add('visible');

  populateStandpipeForm(standpipeState.data);
  wireStandpipeEvents();
  updateStandpipePreview();
}

export function closeStandpipeLinePopup() {
  const overlay = document.getElementById('standpipe-line-overlay');
  const panel = document.getElementById('standpipe-line-panel');
  if (overlay) overlay.classList.remove('visible');
  if (panel) panel.classList.remove('visible');

  standpipeState.lineId = null;
  standpipeState.data = null;
  standpipeState.onSave = null;
}

/* -------------------------------------------------------------------------- */
/*  Form population                                                          */
/* -------------------------------------------------------------------------- */

function populateStandpipeForm(data = {}) {
  const dept = {}; // if you eventually pass department data in, wire it here

  // Engine → standpipe hose
  const engineHoseSelect = document.getElementById('sp-engine-hose');
  const engineLengthInput = document.getElementById('sp-engine-length');
  const engineQtyInput = document.getElementById('sp-engine-qty');

  // Floors up / elevation
  const floorsUpInput = document.getElementById('sp-floors-up');
  const elevationFeetInput = document.getElementById('sp-elevation-feet');

  // Standpipe → nozzle hose
  const attackHoseSelect = document.getElementById('sp-attack-hose');
  const attackLengthInput = document.getElementById('sp-attack-length');

  // Nozzle
  const nozzleSelect = document.getElementById('sp-nozzle-select');

  if (!engineHoseSelect || !engineLengthInput || !engineQtyInput ||
      !floorsUpInput || !elevationFeetInput ||
      !attackHoseSelect || !attackLengthInput ||
      !nozzleSelect) {
    console.warn('Standpipe form elements missing');
    return;
  }

  // --- Populate hose dropdowns from department -----------------------------
  const hoseList = getHoseListFromDept(dept);
  engineHoseSelect.innerHTML = '';
  attackHoseSelect.innerHTML = '';

  hoseList.forEach(h => {
    const opt1 = document.createElement('option');
    opt1.value = h.id;
    opt1.textContent = h.label;
    engineHoseSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = h.id;
    opt2.textContent = h.label;
    attackHoseSelect.appendChild(opt2);
  });

  // --- Populate nozzle dropdown from department ----------------------------
  const nozzleList = getNozzleListFromDept(dept);
  nozzleSelect.innerHTML = '';

  nozzleList.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.id;
    opt.textContent = n.label;
    nozzleSelect.appendChild(opt);
  });

  // Also add a "Closed (no flow)" option at the top
  const closedOpt = document.createElement('option');
  closedOpt.value = 'closed';
  closedOpt.textContent = 'Closed (no flow)';
  nozzleSelect.insertBefore(closedOpt, nozzleSelect.firstChild);

  // --- Set existing values if present --------------------------------------
  engineHoseSelect.value = data.engineHoseId || (hoseList[0] && hoseList[0].id) || '';
  engineLengthInput.value = data.engineLengthFt != null ? String(data.engineLengthFt) : '100';
  engineQtyInput.value = data.engineQty != null ? String(data.engineQty) : '1';

  floorsUpInput.value = data.floorsUp != null ? String(data.floorsUp) : '0';
  elevationFeetInput.value = data.elevationFt != null ? String(data.elevationFt) : '0';

  attackHoseSelect.value = data.attackHoseId || (hoseList[0] && hoseList[0].id) || '';
  attackLengthInput.value = data.attackLengthFt != null ? String(data.attackLengthFt) : '150';

  nozzleSelect.value = data.nozzleId || 'closed';
}

/* -------------------------------------------------------------------------- */
/*  Nozzle list from department (uses prettifyNozzle above)                  */
/* -------------------------------------------------------------------------- */

function getNozzleListFromDept(dept) {
  const result = [];

  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    DEPT_UI_NOZZLES.forEach((n, idx) => {
      if (!n) return;
      const id = n.id != null ? String(n.id) : String(n.value ?? n.name ?? idx);
      const baseLabel = n.label || n.name || String(id);
      const gpm = typeof n.gpm === 'number' ? n.gpm : undefined;
      const np = typeof n.np === 'number' ? n.np : undefined;

      const pretty = prettifyNozzle(id, baseLabel, gpm, np);
      result.push({
        id,
        label: pretty.label,
        gpm: pretty.gpm,
        np: pretty.np,
      });
    });
    return result;
  }

  // Fallback if dept carries its own nozzle list
  if (dept && dept.nozzles && Array.isArray(dept.nozzles)) {
    dept.nozzles.forEach((n, idx) => {
      if (!n) return;
      let id, baseLabel, gpm, np;
      if (typeof n === 'string') {
        id = n;
        baseLabel = n;
      } else {
        id = n.id != null ? String(n.id) : String(n.value ?? n.name ?? idx);
        baseLabel = n.label || n.name || String(id);
        gpm = typeof n.gpm === 'number' ? n.gpm : undefined;
        np = typeof n.np === 'number' ? n.np : undefined;
      }
      const pretty = prettifyNozzle(id, baseLabel, gpm, np);
      result.push({
        id,
        label: pretty.label,
        gpm: pretty.gpm,
        np: pretty.np,
      });
    });
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*  Event wiring & live preview                                              */
/* -------------------------------------------------------------------------- */

function wireStandpipeEvents() {
  const overlay = document.getElementById('standpipe-line-overlay');
  const panel = document.getElementById('standpipe-line-panel');
  const saveBtn = document.getElementById('sp-save-btn');
  const cancelBtn = document.getElementById('sp-cancel-btn');
  const explainBtn = document.getElementById('sp-explain-btn');

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeStandpipeLinePopup();
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      closeStandpipeLinePopup();
    };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      const updated = readStandpipeForm();
      if (standpipeState.onSave && standpipeState.lineId != null) {
        standpipeState.onSave(standpipeState.lineId, updated);
      }
      closeStandpipeLinePopup();
    };
  }

  if (explainBtn) {
    explainBtn.onclick = () => {
      const data = readStandpipeForm();
      showStandpipeExplainWindow(data);
    };
  }

  const inputs = document.querySelectorAll(
    '#standpipe-line-panel input, #standpipe-line-panel select'
  );
  inputs.forEach(el => {
    el.addEventListener('input', updateStandpipePreview);
    el.addEventListener('change', updateStandpipePreview);
  });
}

/* -------------------------------------------------------------------------- */
/*  Reading / saving form data                                               */
/* -------------------------------------------------------------------------- */

function readStandpipeForm() {
  const engineHoseSelect = document.getElementById('sp-engine-hose');
  const engineLengthInput = document.getElementById('sp-engine-length');
  const engineQtyInput = document.getElementById('sp-engine-qty');
  const floorsUpInput = document.getElementById('sp-floors-up');
  const elevationFeetInput = document.getElementById('sp-elevation-feet');
  const attackHoseSelect = document.getElementById('sp-attack-hose');
  const attackLengthInput = document.getElementById('sp-attack-length');
  const nozzleSelect = document.getElementById('sp-nozzle-select');

  const data = {
    engineHoseId: engineHoseSelect?.value || '',
    engineLengthFt: Number(engineLengthInput?.value || 0),
    engineQty: Number(engineQtyInput?.value || 0),
    floorsUp: Number(floorsUpInput?.value || 0),
    elevationFt: Number(elevationFeetInput?.value || 0),
    attackHoseId: attackHoseSelect?.value || '',
    attackLengthFt: Number(attackLengthInput?.value || 0),
    nozzleId: nozzleSelect?.value || 'closed',
  };

  return data;
}

/* -------------------------------------------------------------------------- */
/*  Live preview (very simplified hydraulics for now)                        */
/* -------------------------------------------------------------------------- */

function updateStandpipePreview() {
  const data = readStandpipeForm();

  const preview = document.getElementById('sp-preview-text');
  if (!preview) return;

  if (data.nozzleId === 'closed') {
    preview.textContent = 'Closed – Flow: 0 gpm • PDP: 50 psi';
    return;
  }

  // This is intentionally simplified and not fully accurate hydraulics –
  // just enough to give the user feedback that things are updating.
  const nozzle = findNozzleById(data.nozzleId);
  const gpm = nozzle?.gpm || 0;
  const np = nozzle?.np || 50;

  const engineFL = 0.08 * gpm * (data.engineLengthFt / 100) * (data.engineQty || 1);
  const standpipeFL = 0.08 * gpm * (data.attackLengthFt / 100);
  const elevationLoss = data.elevationFt * 0.5; // rough 0.5 psi / ft

  const pdp = Math.round(np + engineFL + standpipeFL + elevationLoss);

  preview.textContent = `Flow: ${Math.round(gpm)} gpm • PDP: ${pdp} psi`;
}

function findNozzleById(id) {
  if (!id) return null;
  const dept = {};
  const list = getNozzleListFromDept(dept);
  return list.find(n => String(n.id) === String(id)) || null;
}

/* -------------------------------------------------------------------------- */
/*  Explain math window (placeholder)                                        */
/* -------------------------------------------------------------------------- */

function showStandpipeExplainWindow(data) {
  console.log('Standpipe explain math – placeholder', data);
  alert('Explain-math window will show a full PDP breakdown here in a future update.');
}
