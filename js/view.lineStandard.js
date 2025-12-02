import { DEPT_UI_NOZZLES, DEPT_UI_HOSES } from './store.js';

// view.lineStandard.js
// Standard attack line popup (with optional wye).
// - Hoses and nozzles come from department UI (same logic as master stream).
// - NO master-stream-only filter; all department nozzles are available.
// - Fog nozzle IDs like "fog_xd_175_50_165" are converted to readable labels
//   like "Fog 165 gpm @ 50 psi" and their GPM/NP are parsed so math updates.
// - Smooth bores keep the exact department label text, but we make sure their
//   GPM and NP are filled in correctly from that label (or a small tip map).

function parseGpmFromLabel(label) {
  const m = String(label || '').match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : 0;
}

function parseNpFromLabel(label) {
  const m = String(label || '').match(/@\s*(\d+)\s*psi/i);
  return m ? Number(m[1]) : 0;
}

// Turn internal hose ids into nice labels that match on desktop/phone.
function formatHoseLabel(idOrLabel) {
  const raw = String(idOrLabel || '').trim();

  // Already looks like 2.5" / 4" / 5"
  const quoteMatch = raw.match(/(\d(?:\.\d+)?)\s*"/);
  if (quoteMatch) {
    const v = quoteMatch[1];
    if (v === '1.75') return '1 3/4"';
    if (v === '1.5')  return '1 1/2"';
    if (v === '2.5')  return '2 1/2"';
    if (v === '3')    return '3"';
    if (v === '4')    return '4"';
    if (v === '5')    return '5"';
  }

  // Internal IDs like h_175
  if (/^h_?175$/i.test(raw)) return '1 3/4"';
  if (/^h_?15$/i.test(raw))  return '1 1/2"';
  if (/^h_?25$/i.test(raw))  return '2 1/2"';
  if (/^h_?3$/i.test(raw))   return '3"';
  if (/^h_?4$/i.test(raw))   return '4"';
  if (/^h_?5$/i.test(raw))   return '5"';

  // Custom hose ids: "custom_hose_<...>"
  if (/^custom_hose_/i.test(raw)) {
    if (/175/.test(raw)) return 'Custom 1 3/4"';
    if (/15/.test(raw))  return 'Custom 1 1/2"';
    if (/25/.test(raw))  return 'Custom 2 1/2"';
    if (/\b3\b/.test(raw))   return 'Custom 3"';
    if (/\b4\b/.test(raw))   return 'Custom 4"';
    if (/\b5\b/.test(raw))   return 'Custom 5"';
    return 'Custom hose';
  }

  // Text like "2.5 supply", "4 inch LDH"
  const numMatch = raw.match(/(\d(?:\.\d+)?)/);
  if (numMatch) {
    const v = numMatch[1];
    if (v === '1.75') return '1 3/4"';
    if (v === '1.5')  return '1 1/2"';
    if (v === '2.5')  return '2 1/2"';
    if (v === '3')    return '3"';
    if (v === '4')    return '4"';
    if (v === '5')    return '5"';
  }

  return raw;
}

const DEFAULT_NOZZLES = [
  { id: 'fog150_50',   label: 'Fog 150 gpm @ 50 psi', gpm: 150, np: 50 },
  { id: 'fog185_50',   label: 'Fog 185 gpm @ 50 psi', gpm: 185, np: 50 },
  { id: 'sb_15_16_50', label: '7/8" smooth bore 160 gpm @ 50 psi', gpm: 160, np: 50 },
  { id: 'sb_1_1_8_50', label: '1 1/8" smooth bore 265 gpm @ 50 psi', gpm: 265, np: 50 },
];

const DEFAULT_HOSES = [
  { id: '1.75', label: '1 3/4"' },
  { id: '2.5',  label: '2 1/2"' },
  { id: '3',    label: '3"'     },
  { id: '5',    label: '5"'     },
];

// For smooth bores, we want to keep the department label (which already has
// tip, gpm, psi) and just make sure gpm/np are filled in. As a backup, we
// have a small map by tip.
const SMOOTH_TIP_GPM_MAP = {
  '7/8': 160,
  '15/16': 185,
  '1': 210,
  '1 1/8': 265,
  '1 1/4': 325,
};

function extractSmoothTipFromLabel(label) {
  const txt = String(label || '');

  // 15/16", 7/8", 1 1/8", 1 1/4"
  const frac = txt.match(/(\d+\s*\d*\/\d+)\s*"/);
  if (frac) {
    return frac[1].replace(/\s+/g, ' ');
  }

  // 7/8, 15/16 without quotes
  const frac2 = txt.match(/(\d+\/\d+)/);
  if (frac2) return frac2[1];

  return '';
}

// Take an internal id / label / gpm / np and return a nicer label and
// solid gpm/np values so math works. We only aggressively "prettify" fogs;
// smooth bores mostly keep their department labels.
function prettifyNozzle(id, label, gpm, np) {
  const idStr = String(id || '');
  let lbl = label ? String(label) : idStr;
  const lowerLbl = lbl.toLowerCase();
  const lowerId = idStr.toLowerCase();

  const hasGpmPsiWords = /gpm/i.test(lbl) && /psi/i.test(lbl);

  // --- Smooth bores --------------------------------------------------------
  if (lowerId.startsWith('sb') || lowerLbl.includes('smooth')) {
    // Keep the label very close to department wording.
    // Just normalize capitalization a bit.
    if (!/smooth/i.test(lbl)) {
      lbl = 'Smooth ' + lbl;
    }

    // Pull gpm / psi from label if present
    let gFromLabel = parseGpmFromLabel(lbl);
    let pFromLabel = parseNpFromLabel(lbl);

    let tip = extractSmoothTipFromLabel(lbl);

    if (!gFromLabel && tip && SMOOTH_TIP_GPM_MAP[tip]) {
      gFromLabel = SMOOTH_TIP_GPM_MAP[tip];
    }
    if (!pFromLabel) pFromLabel = 50; // default if needed

    if (!gpm && gFromLabel) gpm = gFromLabel;
    if (!np && pFromLabel)  np  = pFromLabel;

    // Build a clean label if we have tip & numbers; otherwise use original.
    if (tip && gpm && np) {
      lbl = `Smooth ${tip}" ${gpm} gpm @ ${np} psi`;
    }

    return { label: lbl, gpm, np };
  }

  // --- Fog and everything else --------------------------------------------
  // If it already has gpm & psi words, just make sure numbers are filled and
  // don't change the wording much.
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
      const g = Number(nums[nums.length - 1]);
      const p = Number(nums[nums.length - 2]);
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

// Department → hose list
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

  if (dept && typeof dept === 'object') {
    const allRaw = Array.isArray(dept.hosesAll) ? dept.hosesAll : [];
    const raw = allRaw.length ? allRaw : (Array.isArray(dept.hoses) ? dept.hoses : []);
    if (raw.length) {
      return raw.map((h, idx) => {
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

  return DEFAULT_HOSES;
}

// Department → nozzle list (no master-stream filter)
function getNozzleListFromDept(dept) {
  let baseRaw;

  if (Array.isArray(DEPT_UI_NOZZLES) && DEPT_UI_NOZZLES.length) {
    baseRaw = DEPT_UI_NOZZLES;
  } else if (dept && Array.isArray(dept.nozzlesAll) && dept.nozzlesAll.length) {
    baseRaw = dept.nozzlesAll;
  } else if (dept && Array.isArray(dept.nozzles) && dept.nozzles.length) {
    baseRaw = dept.nozzles;
  } else {
    baseRaw = DEFAULT_NOZZLES;
  }

  if (!Array.isArray(baseRaw) || !baseRaw.length) {
    baseRaw = DEFAULT_NOZZLES;
  }

  const mapped = baseRaw.map((n, idx) => {
    if (!n) return null;

    let id;
    let label;
    let gpm = 0;
    let np = 0;

    if (typeof n === 'string' || typeof n === 'number') {
      id = String(n);
      label = String(n);
      gpm = parseGpmFromLabel(label);
      np  = parseNpFromLabel(label);
    } else {
      id = n.id != null ? String(n.id) : String(n.value ?? n.name ?? idx);
      label = n.label || n.name || String(id);
      if (typeof n.gpm === 'number') gpm = n.gpm;
      if (typeof n.flow === 'number' && !gpm) gpm = n.flow;
      if (typeof n.np === 'number')  np  = n.np;
      if (typeof n.NP === 'number' && !np) np = n.NP;
      if (typeof n.pressure === 'number' && !np) np = n.pressure;
    }

    const pretty = prettifyNozzle(id, label, gpm, np);
    return {
      id,
      label: pretty.label,
      gpm: pretty.gpm || 0,
      np:  pretty.np  || 0,
    };
  }).filter(Boolean);

  return mapped.length ? mapped : DEFAULT_NOZZLES;
}

function guessHoseCFromLabel(label) {
  if (!label) return 15.5;
  const txt = String(label).toLowerCase();
  if (txt.includes('1 3/4') || txt.includes('1.75')) return 15.5;
  if (txt.includes('1 1/2') || txt.includes('1.5'))  return 24;
  if (txt.includes('2 1/2') || txt.includes('2.5'))  return 2;
  if (txt.includes('3"') || txt.includes(' 3 '))     return 0.8;
  if (txt.includes('4"') || txt.includes(' 4 '))     return 0.2;
  if (txt.includes('5"') || txt.includes(' 5 '))     return 0.08;
  return 15.5;
}

function findNozzleById(list, id) {
  if (!id) return null;
  return list.find(n => String(n.id) === String(id)) || null;
}

function findHoseById(list, id) {
  if (!id) return null;
  return list.find(h => String(h.id) === String(id)) || null;
}

/* -------------------------------------------------------------------------- */
/*  Main popup                                                                */
/* -------------------------------------------------------------------------- */

const PSI_PER_FT = 0.434;
const WYE_LOSS_PSI = 10;

export function openStandardLinePopup({ dept = {}, initial = null, onSave = () => {} } = {}) {
  const nozzleList = getNozzleListFromDept(dept);
  const hoseList = getHoseListFromDept(dept);

  const CLOSED_NOZZLE = { id: 'closed', label: 'Closed (no flow)', gpm: 0, np: 0 };
  const allNozzles = [CLOSED_NOZZLE, ...nozzleList];

  const firstHose = hoseList[0] || DEFAULT_HOSES[0];
  const secondHose = hoseList[1] || hoseList[0] || DEFAULT_HOSES[1] || DEFAULT_HOSES[0];
  const firstNozzle = allNozzles[1] || allNozzles[0];

  const state = {
    mode: (initial && initial.mode) || 'single',
    targetGpm: 0,
    targetPdp: 0,
    single: {
      hoseId:      initial?.single?.hoseId      ?? firstHose.id,
      hoseSize:    initial?.single?.hoseSize    ?? firstHose.label,
      lengthFt:    initial?.single?.lengthFt    ?? 200,
      elevationFt: initial?.single?.elevationFt ?? 0,
      nozzleId:    initial?.single?.nozzleId    ?? firstNozzle.id,
    },
    wye: {
      engineHoseId:   initial?.wye?.engineHoseId   ?? secondHose.id,
      engineHoseSize: initial?.wye?.engineHoseSize ?? secondHose.label,
      engineLengthFt: initial?.wye?.engineLengthFt ?? 100,
      elevationFt:    initial?.wye?.elevationFt    ?? 0,
      branchA: {
        hoseId:   initial?.wye?.branchA?.hoseId   ?? firstHose.id,
        hoseSize: initial?.wye?.branchA?.hoseSize ?? firstHose.label,
        lengthFt: initial?.wye?.branchA?.lengthFt ?? 200,
        nozzleId: initial?.wye?.branchA?.nozzleId ?? firstNozzle.id,
      },
      branchB: {
        hoseId:   initial?.wye?.branchB?.hoseId   ?? firstHose.id,
        hoseSize: initial?.wye?.branchB?.hoseSize ?? firstHose.label,
        lengthFt: initial?.wye?.branchB?.lengthFt ?? 200,
        nozzleId: initial?.wye?.branchB?.nozzleId ?? 'closed',
      },
    },
  };

  // ---- DOM: overlay & panel ----
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.55)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'flex-end';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '8px';
  overlay.style.zIndex = '9999';
  overlay.style.boxSizing = 'border-box';
  overlay.style.overflowX = 'hidden';

  const panel = document.createElement('div');
  panel.style.maxWidth = '100vw';
  panel.style.width = '100%';
  panel.style.maxHeight = '90vh';
  panel.style.background = '#020617';
  panel.style.color = '#e5e7eb';
  panel.style.borderRadius = '16px 16px 0 0';
  panel.style.boxShadow = '0 18px 30px rgba(15,23,42,0.75)';
  panel.style.border = '1px solid rgba(148,163,184,0.35)';
  panel.style.padding = '12px 10px 10px';
  panel.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  panel.style.boxSizing = 'border-box';
  panel.style.overflow = 'hidden';

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.marginBottom = '6px';
  header.style.borderBottom = '1px solid rgba(148,163,184,0.25)';
  header.style.paddingBottom = '4px';

  const title = document.createElement('div');
  title.textContent = 'Standard attack line';
  title.style.fontSize = '16px';
  title.style.fontWeight = '600';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.style.width = '28px';
  closeBtn.style.height = '28px';
  closeBtn.style.borderRadius = '999px';
  closeBtn.style.border = '1px solid rgba(148,163,184,0.6)';
  closeBtn.style.background = '#020617';
  closeBtn.style.color = '#e5e7eb';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', close);

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.style.maxHeight = '65vh';
  body.style.overflowY = 'auto';
  body.style.fontSize = '14px';

  // Mode toggle
  const modeRow = document.createElement('div');
  modeRow.style.display = 'flex';
  modeRow.style.gap = '6px';
  modeRow.style.marginTop = '4px';

  const singleBtn = document.createElement('button');
  singleBtn.type = 'button';
  singleBtn.textContent = 'Single';

  const wyeBtn = document.createElement('button');
  wyeBtn.type = 'button';
  wyeBtn.textContent = 'Wye';

  [singleBtn, wyeBtn].forEach((b) => {
    b.style.flex = '1 1 0';
    b.style.padding = '6px 4px';
    b.style.borderRadius = '999px';
    b.style.border = '1px solid rgba(55,65,81,0.9)';
    b.style.background = 'rgba(15,23,42,0.9)';
    b.style.color = '#e5e7eb';
    b.style.cursor = 'pointer';
    b.style.fontSize = '14px';
  });

  function updateModeButtons() {
    if (state.mode === 'single') {
      singleBtn.style.background = '#022c22';
      singleBtn.style.borderColor = '#22c55e';
      wyeBtn.style.background = 'rgba(15,23,42,0.9)';
      wyeBtn.style.borderColor = 'rgba(55,65,81,0.9)';
    } else {
      wyeBtn.style.background = '#022c22';
      wyeBtn.style.borderColor = '#22c55e';
      singleBtn.style.background = 'rgba(15,23,42,0.9)';
      singleBtn.style.borderColor = 'rgba(55,65,81,0.9)';
    }
  }

  singleBtn.addEventListener('click', () => {
    state.mode = 'single';
    updateModeButtons();
    renderSections();
    updatePreview();
  });

  wyeBtn.addEventListener('click', () => {
    state.mode = 'wye';
    updateModeButtons();
    renderSections();
    updatePreview();
  });

  const sectionsContainer = document.createElement('div');
  sectionsContainer.style.marginTop = '8px';
  sectionsContainer.style.display = 'flex';
  sectionsContainer.style.flexDirection = 'column';
  sectionsContainer.style.gap = '8px';

  function makeSection(titleText) {
    const box = document.createElement('div');
    box.style.border = '1px solid rgba(30,64,175,0.5)';
    box.style.borderRadius = '12px';
    box.style.padding = '6px 8px';
    box.style.background = 'rgba(15,23,42,0.85)';

    const h = document.createElement('div');
    h.textContent = titleText;
    h.style.fontSize = '12px';
    h.style.fontWeight = '600';
    h.style.textTransform = 'uppercase';
    h.style.letterSpacing = '0.06em';
    h.style.marginBottom = '4px';
    h.style.color = '#bfdbfe';

    box.appendChild(h);
    return { box, h };
  }

  function makeNumberRow(labelText, value, onChange) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '2px';
    row.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.fontSize = '14px';

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.style.padding = '6px 8px';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid rgba(55,65,81,0.9)';
    input.style.background = '#020617';
    input.style.color = '#e5e7eb';
    input.style.fontSize = '16px';

    input.addEventListener('input', () => {
      const v = input.value === '' ? 0 : Number(input.value);
      onChange(v);
      updatePreview();
    });

    row.append(label, input);
    return row;
  }

  function makeSelectRow(labelText, list, selectedId, onChange) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '2px';
    row.style.marginBottom = '4px';

    const label = document.createElement('label');
    label.textContent = labelText;
    label.style.fontSize = '14px';

    const sel = document.createElement('select');
    sel.style.padding = '6px 8px';
    sel.style.borderRadius = '8px';
    sel.style.border = '1px solid rgba(55,65,81,0.9)';
    sel.style.background = '#020617';
    sel.style.color = '#e5e7eb';
    sel.style.fontSize = '16px';
    sel.style.maxWidth = '100%';
    sel.style.whiteSpace = 'nowrap';
    sel.style.textOverflow = 'ellipsis';
    sel.style.overflow = 'hidden';

    list.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.label;
      sel.appendChild(opt);
    });

    if (selectedId != null) sel.value = selectedId;

    sel.addEventListener('change', () => {
      onChange(sel.value);
      updatePreview();
    });

    row.append(label, sel);
    return row;
  }

  function renderSections() {
    sectionsContainer.innerHTML = '';

    if (state.mode === 'single') {
      const section = makeSection('Single attack line');

      section.box.appendChild(
        makeSelectRow('Hose size', hoseList, state.single.hoseId, (id) => {
          state.single.hoseId = id;
          const h = findHoseById(hoseList, id);
          if (h) state.single.hoseSize = h.label;
        })
      );

      section.box.appendChild(
        makeNumberRow('Line length (ft)', state.single.lengthFt, (v) => {
          state.single.lengthFt = v;
        })
      );

      section.box.appendChild(
        makeNumberRow('Elevation (+/- ft)', state.single.elevationFt, (v) => {
          state.single.elevationFt = v;
        })
      );

      section.box.appendChild(
        makeSelectRow('Nozzle', allNozzles, state.single.nozzleId, (id) => {
          state.single.nozzleId = id;
        })
      );

      sectionsContainer.appendChild(section.box);
    } else {
      const engine = makeSection('Engine to wye');
      engine.box.appendChild(
        makeSelectRow('Engine hose size', hoseList, state.wye.engineHoseId, (id) => {
          state.wye.engineHoseId = id;
          const h = findHoseById(hoseList, id);
          if (h) state.wye.engineHoseSize = h.label;
        })
      );
      engine.box.appendChild(
        makeNumberRow('Engine line length (ft)', state.wye.engineLengthFt, (v) => {
          state.wye.engineLengthFt = v;
        })
      );
      engine.box.appendChild(
        makeNumberRow('Elevation at nozzle (+/- ft)', state.wye.elevationFt, (v) => {
          state.wye.elevationFt = v;
        })
      );
      sectionsContainer.appendChild(engine.box);

      const branchA = makeSection('Branch A');
      branchA.box.appendChild(
        makeSelectRow('Hose size', hoseList, state.wye.branchA.hoseId, (id) => {
          state.wye.branchA.hoseId = id;
          const h = findHoseById(hoseList, id);
          if (h) state.wye.branchA.hoseSize = h.label;
        })
      );
      branchA.box.appendChild(
        makeNumberRow('Length (ft)', state.wye.branchA.lengthFt, (v) => {
          state.wye.branchA.lengthFt = v;
        })
      );
      branchA.box.appendChild(
        makeSelectRow('Nozzle', allNozzles, state.wye.branchA.nozzleId, (id) => {
          state.wye.branchA.nozzleId = id;
        })
      );
      sectionsContainer.appendChild(branchA.box);

      const branchB = makeSection('Branch B');
      branchB.box.appendChild(
        makeSelectRow('Hose size', hoseList, state.wye.branchB.hoseId, (id) => {
          state.wye.branchB.hoseId = id;
          const h = findHoseById(hoseList, id);
          if (h) state.wye.branchB.hoseSize = h.label;
        })
      );
      branchB.box.appendChild(
        makeNumberRow('Length (ft)', state.wye.branchB.lengthFt, (v) => {
          state.wye.branchB.lengthFt = v;
        })
      );
      branchB.box.appendChild(
        makeSelectRow('Nozzle', allNozzles, state.wye.branchB.nozzleId, (id) => {
          state.wye.branchB.nozzleId = id;
        })
      );
      sectionsContainer.appendChild(branchB.box);
    }
  }

  // ---- Preview + math ----
  const preview = document.createElement('div');
  preview.style.marginTop = '8px';
  preview.style.padding = '8px';
  preview.style.borderRadius = '10px';
  preview.style.border = '1px solid rgba(37,99,235,0.8)';
  preview.style.background = '#020617';
  preview.style.fontSize = '14px';
  preview.style.fontWeight = '600';
  preview.style.textAlign = 'center';

  function frictionLoss(c, gpm, lengthFt) {
    if (!c || !gpm || !lengthFt) return 0;
    const flPer100 = c * Math.pow(gpm / 100, 2);
    return flPer100 * (lengthFt / 100);
  }

  function calcSingle() {
    const noz = findNozzleById(allNozzles, state.single.nozzleId) || CLOSED_NOZZLE;
    const hose = findHoseById(hoseList, state.single.hoseId) || firstHose;
    let gpm = noz.gpm || parseGpmFromLabel(noz.label) || 0;
    let np = noz.np || parseNpFromLabel(noz.label) || 50;
    const len = state.single.lengthFt || 0;
    const elevPsi = (state.single.elevationFt || 0) * PSI_PER_FT;
    const c = typeof hose.c === 'number' ? hose.c : guessHoseCFromLabel(hose.label);
    const fl = frictionLoss(c, gpm, len);
    const pdp = Math.round(np + fl + elevPsi);
    return { gpm: Math.round(gpm), pdp };
  }

  function calcWye() {
    const branch = (b) => {
      const noz = findNozzleById(allNozzles, b.nozzleId) || CLOSED_NOZZLE;
      const hose = findHoseById(hoseList, b.hoseId) || firstHose;
      let gpm = noz.gpm || parseGpmFromLabel(noz.label) || 0;
      let np = noz.np || parseNpFromLabel(noz.label) || 50;
      const len = b.lengthFt || 0;
      const c = typeof hose.c === 'number' ? hose.c : guessHoseCFromLabel(hose.label);
      const fl = frictionLoss(c, gpm, len);
      return { gpm, np, fl };
    };

    const a = branch(state.wye.branchA);
    const b = branch(state.wye.branchB);
    const totalGpm = a.gpm + b.gpm;
    const elevPsi = (state.wye.elevationFt || 0) * PSI_PER_FT;

    const needA = a.np + a.fl + elevPsi;
    const needB = b.np + b.fl + elevPsi;
    const branchMax = Math.max(needA, needB);

    const engineHose = findHoseById(hoseList, state.wye.engineHoseId) || secondHose;
    const cE = typeof engineHose.c === 'number' ? engineHose.c : guessHoseCFromLabel(engineHose.label);
    const lenE = state.wye.engineLengthFt || 0;
    const flE = frictionLoss(cE, totalGpm, lenE);

    const pdp = Math.round(branchMax + flE + (totalGpm > 0 ? WYE_LOSS_PSI : 0));
    return { gpm: Math.round(totalGpm), pdp };
  }

  function updatePreview() {
    let gpm, pdp;
    if (state.mode === 'single') {
      const r = calcSingle();
      gpm = r.gpm;
      pdp = r.pdp;
      preview.textContent = `Single line • Flow: ${gpm} gpm • PDP: ${pdp} psi`;
    } else {
      const r = calcWye();
      gpm = r.gpm;
      pdp = r.pdp;
      preview.textContent = `Wye line • Total flow: ${gpm} gpm • PDP: ${pdp} psi`;
    }
    state.targetGpm = gpm;
    state.targetPdp = pdp;
  }

  // Footer
  const footer = document.createElement('div');
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  footer.style.gap = '6px';
  footer.style.marginTop = '8px';
  footer.style.borderTop = '1px solid rgba(148,163,184,0.25)';
  footer.style.paddingTop = '6px';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.borderRadius = '999px';
  cancelBtn.style.padding = '6px 10px';
  cancelBtn.style.fontSize = '14px';
  cancelBtn.style.border = '1px solid rgba(148,163,184,0.7)';
  cancelBtn.style.background = '#020617';
  cancelBtn.style.color = '#e5e7eb';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.addEventListener('click', close);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save line';
  saveBtn.style.borderRadius = '999px';
  saveBtn.style.padding = '6px 10px';
  saveBtn.style.fontSize = '14px';
  saveBtn.style.border = 'none';
  saveBtn.style.background = '#22c55e';
  saveBtn.style.color = '#020617';
  saveBtn.style.fontWeight = '600';
  saveBtn.style.cursor = 'pointer';

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const calc = state.mode === 'single' ? calcSingle() : calcWye();

    const payload = {
      type: 'standard',
      mode: state.mode,
      single: { ...state.single },
      wye: {
        engineHoseId:   state.wye.engineHoseId,
        engineHoseSize: state.wye.engineHoseSize,
        engineLengthFt: state.wye.engineLengthFt,
        elevationFt:    state.wye.elevationFt,
        branchA: { ...state.wye.branchA },
        branchB: { ...state.wye.branchB },
      },
      targetGpm: calc.gpm,
      targetPdp: calc.pdp,
      lastCalc: {
        targetGpm: calc.gpm,
        targetPdp: calc.pdp,
      },
    };

    onSave(payload);
    close();
  });

  footer.append(cancelBtn, saveBtn);

  const numbersNote = document.createElement('div');
  numbersNote.style.fontSize = '12px';
  numbersNote.style.marginTop = '6px';
  numbersNote.style.opacity = '0.85';
  numbersNote.textContent =
    'GPM comes from nozzle selection (Closed = 0 gpm). PDP uses hose C, length, nozzle pressure, elevation, and (for a wye) both branches plus the engine line and wye loss.';

  body.append(modeRow, sectionsContainer, numbersNote, preview);
  panel.append(header, body, footer);

  updateModeButtons();
  renderSections();
  updatePreview();
}
