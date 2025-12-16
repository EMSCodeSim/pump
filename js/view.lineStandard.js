import { DEPT_UI_NOZZLES, DEPT_UI_HOSES, NOZ } from './store.js';


function _deptEquipRead() {
  try {
    const raw = localStorage.getItem('fireops_dept_equipment_v1');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function _getCustomNozzleById(id) {
  const dept = _deptEquipRead();
  const list = dept && Array.isArray(dept.customNozzles) ? dept.customNozzles : [];
  return list.find(n => n && n.id === id) || null;
}

function _getCustomHoseById(id) {
  const dept = _deptEquipRead();
  const list = dept && Array.isArray(dept.customHoses) ? dept.customHoses : [];
  return list.find(h => h && h.id === id) || null;
}

function _diaToLabel(dia) {
  const f = Number(dia);
  if (!isFinite(f)) return '';
  const map = {1:'1"', 1.5:'1 1/2"', 1.75:'1 3/4"', 2:'2"', 2.5:'2 1/2"', 3:'3"', 4:'4"', 5:'5"'};
  for (const k of Object.keys(map)) {
    if (Math.abs(f - Number(k)) < 1e-6) return map[k];
  }
  return `${f}"`;
}

function parseGpmFromLabel(label) {
  const m = String(label || '').match(/(\d+)\s*gpm/i);
  return m ? Number(m[1]) : 0;
}

function parseNpFromLabel(label) {
  const m = String(label || '').match(/@\s*(\d+)\s*psi/i);
  return m ? Number(m[1]) : 0;
}


function formatHoseLabel(idOrLabel) {
  const raw = String(idOrLabel || '').trim();

  // Custom hose: show simple size + " C" using stored diameter/label if available
  if (/^custom_hose_/i.test(raw)) {
    const h = _getCustomHoseById(raw);
    const diaLbl = h ? (_diaToLabel(h.diameter) || '') : '';
    if (diaLbl) return `${diaLbl} C`;
    // fallback: try to parse something like 1.75 or 2.5 from label
    const parsed = (h && h.label) ? String(h.label).match(/(\d(?:\.\d+)?)/) : null;
    if (parsed) return `${_diaToLabel(parsed[1])} C`;
    return `Custom C`;
  }

  // Low-friction hose ids like h_lf_175, h_lf_25, h_lf_5
  if (/^h_lf_/i.test(raw)) {
    const m = raw.match(/^h_lf_(\d+)/i);
    const code = m ? m[1] : '';
    const dia = code === '175' ? 1.75
      : code === '15' ? 1.5
      : code === '25' ? 2.5
      : code === '2' ? 2.0
      : code === '1' ? 1.0
      : code === '4' ? 4.0
      : code === '5' ? 5.0
      : Number(code || NaN);
    const base = _diaToLabel(dia);
    return base ? `${base} LF` : `${raw} LF`;
  }

  // Standard hose ids like h_175, h_25, h_4_ldh, etc.
  if (/^h_/i.test(raw)) {
    if (/h_4/i.test(raw)) return '4"';
    if (/h_5/i.test(raw)) return '5"';
    const m = raw.match(/h_(\d+)/i);
    const code = m ? m[1] : '';
    const dia = code === '175' ? 1.75
      : code === '15' ? 1.5
      : code === '25' ? 2.5
      : code === '2' ? 2.0
      : code === '1' ? 1.0
      : Number(code || NaN);
    const base = _diaToLabel(dia);
    return base || raw;
  }

  // If user already gave a nice label like 2 1/2"
  if (/\d/.test(raw) && /"/.test(raw)) return raw;

  return raw || '';
}


const DEFAULT_NOZZLES = [
  { id: 'fog150_50',   label: 'Fog 150 gpm @ 50 psi', gpm: 150, np: 50 },
  { id: 'fog185_50',   label: 'Fog 185 gpm @ 50 psi', gpm: 185, np: 50 },
  { id: 'sb_7_8_50',   label: 'SB 7/8" @ 50',         gpm: 160, np: 50 },
  { id: 'sb_1_1_8_50', label: 'SB 1 1/8" @ 50',       gpm: 265, np: 50 },
];

const DEFAULT_HOSES = [
  { id: '1.75', label: '1 3/4"' },
  { id: '2.5',  label: '2 1/2"' },
  { id: '3',    label: '3"'     },
  { id: '5',    label: '5"'     },
];

function extractSmoothTipFromLabel(label) {
  const txt = String(label || '');
  const frac = txt.match(/(\d+\s*\d*\/\d+)\s*"/);
  if (frac) return frac[1].replace(/\s+/g, ' ');
  const frac2 = txt.match(/(\d+\/\d+)/);
  if (frac2) return frac2[1];
  return '';
}

function prettifyNozzle(id, label, gpm, np) {
  const idStr = String(id || '');
  let lbl = label ? String(label) : idStr;
  const lowerLbl = lbl.toLowerCase();
  const lowerId = idStr.toLowerCase();

  const hasGpmPsiWords = /gpm/i.test(lbl) && /psi/i.test(lbl);

  // Smooth bores
  if (lowerId.startsWith('sb') || lowerLbl.includes('smooth')) {
    if (!/smooth/i.test(lbl) && !/^sb\b/i.test(lbl)) {
      lbl = 'Smooth ' + lbl;
    }

    let gFromLabel = parseGpmFromLabel(lbl);
    let pFromLabel = parseNpFromLabel(lbl);
    let tip = extractSmoothTipFromLabel(lbl);

    if (!tip) {
      const m = idStr.match(/^sb[_-]?(\d+)(?:[_-](\d+))?(?:[_-](\d+))?/i);
      if (m) {
        const boreCode = m[1];
        switch (boreCode) {
          case '78':   tip = '7/8';   break;
          case '1516': tip = '15/16'; break;
          case '1':    tip = '1';     break;
          case '1118': tip = '1 1/8'; break;
          case '114':  tip = '1 1/4'; break;
        }
        if (!pFromLabel && m[2]) pFromLabel = Number(m[2]);
        if (!gFromLabel && m[3]) gFromLabel = Number(m[3]);
      }
    }

    if (!gpm && gFromLabel) gpm = gFromLabel;
    if (!np && pFromLabel)  np  = pFromLabel || 50;

    if (tip && gpm && np) {
      lbl = `SB ${tip}" @ ${np}`;
    }

    return { label: lbl, gpm, np };
  }

  // Custom nozzles
  if (lowerId.startsWith('custom_noz_')) {
    // Preserve user-entered labels (e.g. "the one 444 gpm @ 33 psi") instead of
    // overwriting them with "Custom nozzle ...".
    const hasUserLabel = !!(lbl && String(lbl).trim() && !/^custom\s*nozzle\b/i.test(String(lbl).trim()));

    // Pull label/gpm/np from saved custom nozzle object (dept equipment) if needed
    const saved = _getCustomNozzleById(idStr);
    if (saved) {
      if (!lbl || lbl === idStr) lbl = saved.label || saved.name || saved.title || lbl;
      if (!gpm) gpm = Number(saved.gpm || saved.GPM || 0);
      if (!np) np = Number(saved.NP || saved.np || saved.psi || 0);
    }

    let g = gpm || parseGpmFromLabel(lbl);
    let p = np || parseNpFromLabel(lbl);

    const m = idStr.match(/custom_noz_[^_]*_(\d+)_?(\d+)?$/i);
    if (m) {
      if (!g && m[1]) g = Number(m[1]);
      if (!p && m[2]) p = Number(m[2]);
    }

    if (!p) p = 50;

    // If the user supplied a meaningful label, keep it.
    // Otherwise generate a fallback label from gpm/psi.
    if (!hasUserLabel) {
      if (g && p) {
        lbl = `Custom nozzle ${g} gpm @ ${p} psi`;
      } else if (g) {
        lbl = `Custom nozzle ${g} gpm`;
      } else {
        lbl = 'Custom nozzle';
      }
    }

    return { label: lbl, gpm: g || 0, np: p || 0 };
  }

  // Already has words
  if (hasGpmPsiWords) {
    const gFrom = parseGpmFromLabel(lbl);
    const pFrom = parseNpFromLabel(lbl);
    if (!gpm && gFrom) gpm = gFrom;
    if (!np && pFrom)  np  = pFrom;
    return { label: lbl, gpm, np };
  }

  // Fog internal ids
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
      lbl = `Fog ${gpm} @ ${np}`;
    } else if (gpm) {
      lbl = `Fog ${gpm}`;
    } else {
      lbl = 'Fog nozzle';
    }

    return { label: lbl, gpm, np };
  }

  // Generic
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
      const fromCatalog = NOZ && NOZ[id] ? NOZ[id] : null;
      if (fromCatalog) {
        label = fromCatalog.name || id;
        gpm = typeof fromCatalog.gpm === 'number' ? fromCatalog.gpm : 0;
        np  = typeof fromCatalog.NP  === 'number' ? fromCatalog.NP  : 0;
      } else {
        label = String(n);
        gpm = parseGpmFromLabel(label);
        np  = parseNpFromLabel(label);
      }
    } else {
      id = n.id != null ? String(n.id) : String(n.value ?? n.name ?? idx);
      label = n.label || n.name || String(id);
      if (typeof n.gpm === 'number') gpm = n.gpm;
      if (typeof n.flow === 'number' && !gpm) gpm = n.flow;
      if (typeof n.np === 'number')  np  = n.np;
      if (typeof n.NP === 'number' && !np) np = n.NP;
      if (typeof n.pressure === 'number' && !np) np = n.pressure;
    }

    const idStr = String(id || '');
    const lowerId = idStr.toLowerCase();
    const lowerLabel = String(label || '').toLowerCase();

    let finalLabel = label;
    let finalGpm = gpm;
    let finalNp = np;

    const looksInternal =
      lowerId.startsWith('sb') ||
      lowerId.includes('fog') ||
      lowerLabel.includes('sb_') ||
      lowerLabel.includes('fog_');

    if (looksInternal || lowerId.startsWith('custom_noz_')) {
      const pretty = prettifyNozzle(idStr, label, gpm, np);
      finalLabel = pretty.label;
      finalGpm = pretty.gpm || 0;
      finalNp = pretty.np || 0;
    } else {
      const gFrom = parseGpmFromLabel(finalLabel);
      const pFrom = parseNpFromLabel(finalLabel);
      if (!finalGpm && gFrom) finalGpm = gFrom;
      if (!finalNp && pFrom)  finalNp  = pFrom;
    }

    return {
      id,
      label: finalLabel,
      gpm: finalGpm || 0,
      np:  finalNp  || 0,
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

const PSI_PER_FT = 0.434;
const WYE_LOSS_PSI = 10;

function openStandardLinePopup({ dept = {}, initial = null, onSave = () => {} } = {}) {
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

// ⬅️ important: export both ways so your import always finds it
export { openStandardLinePopup };
export default openStandardLinePopup;
