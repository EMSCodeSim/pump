// ===========================================================
// view.department.js
// FIX: Custom nozzles show wrong name/GPM + dept nozzle selection mismatch
// - Dept nozzle UI list now stores SELECTED NOZZLE IDS (strings), not DEPT_NOZZLE_LIBRARY objects
// - This ensures store.getDeptNozzles() resolves built-ins via NOZ + custom nozzles via store.customNozzles
// - Add Custom Nozzle now auto-selects the new nozzle + refreshes Line 1/2/3 dropdowns immediately
// ===========================================================

import {
  store,
  saveStore,
  NOZ,
  NOZ_LIST,
  addCustomHose,
  addCustomNozzle,
  setSelectedHoses,
  setSelectedNozzles,
  setDeptUiNozzles,
  getDeptHoses,
  getDeptNozzles,
  HOSES_MATCHING_CHARTS,
  getLineDefaults,
  setLineDefaults
} from "./store.js";

import { getDeptNozzleIds, getDeptCustomNozzlesForCalc } from "./preset.js";
import { getUiNozzles } from "./deptState.js";

// ------- DOM Helpers -------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

// ===========================================================
// Calc nozzle list builder (mirror of view.calc.main.js style)
// ===========================================================
function getCalcNozzlesList() {
  let list = Array.isArray(NOZ_LIST) ? [...NOZ_LIST] : [];

  // Merge in custom nozzles created in Dept Setup (calc-ready objects)
  try {
    const customs = (typeof getDeptCustomNozzlesForCalc === "function")
      ? (getDeptCustomNozzlesForCalc() || [])
      : [];
    if (Array.isArray(customs) && customs.length) list = list.concat(customs);
  } catch (e) {
    console.warn("Dept custom nozzles load failed", e);
  }

  // Filter to selected nozzle IDs (dept selection)
  try {
    const ids = (typeof getDeptNozzleIds === "function") ? (getDeptNozzleIds() || []) : [];
    if (Array.isArray(ids) && ids.length) {
      const allowed = new Set(ids.map(id => String(id)));
      const filtered = list.filter(n => n && allowed.has(String(n.id)));
      if (filtered.length) list = filtered;
    }
  } catch (e) {
    console.warn("Dept nozzle filter failed", e);
  }

  // Overlay labels from deptState UI list (if present)
  let uiById = null;
  try {
    const uiNozzles = (typeof getUiNozzles === "function") ? (getUiNozzles() || []) : [];
    if (Array.isArray(uiNozzles) && uiNozzles.length) {
      uiById = new Map(
        uiNozzles
          .filter(n => n && n.id != null)
          .map(n => [String(n.id), n])
      );
    }
  } catch (e) {}

  // Normalize objects {id,label,gpm,NP}
  const out = [];
  const seen = new Set();
  for (const n of list) {
    if (!n) continue;
    const id = n.id != null ? String(n.id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const fromUi = uiById && uiById.get(id);

    // Prefer explicit custom name (n.name) first, then UI label, then store label
    const label =
      (n.name && String(n.name)) ||
      (fromUi && (fromUi.label || fromUi.name || fromUi.desc)) ||
      n.label || n.desc || id;

    let gpm = Number(n.gpm ?? n.GPM ?? 0) || 0;
    let NP  = Number(n.NP ?? n.np ?? n.psi ?? n.pressure ?? 0) || 0;

    // If built-in exists, trust catalog for hydraulics numbers
    if (NOZ && NOZ[id]) {
      if (!gpm && typeof NOZ[id].gpm === "number") gpm = NOZ[id].gpm;
      if (!NP  && typeof NOZ[id].NP  === "number") NP  = NOZ[id].NP;
    }

    out.push({ id, label, gpm, NP });
  }

  out.unshift({ id: "closed", label: "Closed (no flow)", gpm: 0, NP: 0 });
  return out;
}

// ===========================================================
// Storage for dept selection (kept for preset/calc compatibility)
// ===========================================================
const STORAGE_DEPT_KEY = "fireops_dept_equipment_v1";

function loadDeptConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_DEPT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.warn("Dept config load failed", e);
    return {};
  }
}

function saveDeptConfig(update) {
  try {
    const current = loadDeptConfig();
    const merged = Object.assign({}, current || {}, update || {});
    localStorage.setItem(STORAGE_DEPT_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn("Dept config save failed", e);
  }
}

// ===========================================================
// Render hose + nozzle selectors
// ===========================================================
function renderHoseSelector() {
  const wrapper = qs("#dept-hose-list");
  if (!wrapper) return;

  const hoses = HOSES_MATCHING_CHARTS || [];
  wrapper.innerHTML = hoses.map(h => `
    <label class="dept-item">
      <input type="checkbox" class="dept-hose-check" value="${h.id}"
        ${(Array.isArray(store.deptSelectedHoses) && store.deptSelectedHoses.includes(h.id)) ? "checked" : ""}>
      ${h.label}
    </label>
  `).join("");
}

function renderNozzleSelector() {
  const wrapper = qs("#dept-nozzle-list");
  if (!wrapper) return;

  const list = getCalcNozzlesList().filter(n => n.id !== "closed");

  let selectedIds = [];
  try {
    const ids = (typeof getDeptNozzleIds === "function") ? (getDeptNozzleIds() || []) : [];
    if (Array.isArray(ids)) selectedIds = ids.map(String);
  } catch (e) {}

  const selected = new Set(selectedIds);

  wrapper.innerHTML = list.map(n => {
    const id = String(n.id);
    const label = String(n.label || id);
    return `
      <label class="dept-item">
        <input type="checkbox" class="dept-nozzle-check" value="${id}" ${selected.has(id) ? "checked" : ""}>
        ${label}
      </label>
    `;
  }).join("");
}

// ===========================================================
// Custom hose/nozzle add forms
// ===========================================================
function setupCustomHoseForm() {
  const btn = qs("#add-custom-hose-btn");
  const nameInput = qs("#custom-hose-name");
  const diaInput = qs("#custom-hose-diameter");
  const cInput = qs("#custom-hose-c");
  if (!btn) return;

  btn.onclick = () => {
    const label = (nameInput?.value || "").trim();
    const dia = (diaInput?.value || "").trim();
    const c = (cInput?.value || "").trim();
    if (!label || !dia || !c) {
      alert("Please enter hose name, diameter, and C value.");
      return;
    }
    addCustomHose(label, dia, c);
    renderHoseSelector();
    if (nameInput) nameInput.value = "";
    if (diaInput) diaInput.value = "";
    if (cInput) cInput.value = "";
    alert("Custom hose added.");
  };
}

function setupCustomNozzleForm() {
  const btn = qs("#add-custom-nozzle-btn");
  const nameInput = qs("#custom-nozzle-name");
  const gpmInput = qs("#custom-nozzle-gpm");
  const npInput = qs("#custom-nozzle-np");
  if (!btn) return;

  btn.onclick = () => {
    const label = (nameInput?.value || "").trim();
    const gpm = (gpmInput?.value || "").trim();
    const np = (npInput?.value || "").trim();
    if (!label || !gpm || !np) {
      alert("Please enter nozzle name, GPM, and NP.");
      return;
    }

    // store.addCustomNozzle returns a calc-ready nozzle object with id,label,name,gpm,NP
    const noz = addCustomNozzle(label, gpm, np);

    // AUTO-SELECT the new custom nozzle so it appears everywhere (checkboxes + line dropdowns + calc)
    const dept = loadDeptConfig();
    const current = Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : [];
    const next = current.includes(String(noz.id)) ? current : current.concat(String(noz.id));
    saveDeptConfig({ nozzles: next });

    // Critical: DEPT_UI_NOZZLES should be the SELECTED IDS (strings), so store.getDeptNozzles resolves customs too.
    setDeptUiNozzles(next);
    setSelectedNozzles(next);

    renderNozzleSelector();
    populateDropdowns();
    renderLineDefaults();

    if (nameInput) nameInput.value = "";
    if (gpmInput) gpmInput.value = "";
    if (npInput) npInput.value = "";

    alert("Custom nozzle added.");
  };
}

// ===========================================================
// Save selection buttons
// ===========================================================
function setupSaveButtons() {
  const saveHosesBtn = qs("#save-hose-selection");
  const saveNozzlesBtn = qs("#save-nozzle-selection");

  if (saveHosesBtn) {
    saveHosesBtn.onclick = () => {
      const selections = qsa(".dept-hose-check")
        .filter(el => el.checked)
        .map(el => el.value);

      setSelectedHoses(selections);
      alert("Department hose selection saved!");
    };
  }

  if (saveNozzlesBtn) {
    saveNozzlesBtn.onclick = () => {
      const selectedIds = qsa(".dept-nozzle-check")
        .filter(el => el.checked)
        .map(el => String(el.value));

      // Persist for preset/calc readers
      saveDeptConfig({ nozzles: selectedIds });

      // *** FIX: store UI nozzle list should be IDS (strings), not DEPT_NOZZLE_LIBRARY objects ***
      setDeptUiNozzles(selectedIds);
      setSelectedNozzles(selectedIds);

      // Refresh UI so Line 1/2/3 pickers never fall back to first option
      renderNozzleSelector();
      populateDropdowns();
      renderLineDefaults();

      alert("Department nozzle selection saved!");
    };
  }
}

// ===========================================================
// Line defaults (Line 1/2/3)
// ===========================================================
function renderLineDefaults() {
  ["line1", "line2", "line3"].forEach(id => {
    const data = getLineDefaults(id) || {};
    const hoseEl = qs(`#${id}-hose`);
    const nozEl  = qs(`#${id}-nozzle`);
    const lenEl  = qs(`#${id}-length`);
    const elevEl = qs(`#${id}-elevation`);

    if (hoseEl) hoseEl.value = data.hose || "";
    if (nozEl)  nozEl.value  = data.nozzle || "";
    if (lenEl)  lenEl.value  = data.length ?? "";
    if (elevEl) elevEl.value = data.elevation ?? "";
  });
}

function setupLineDefaultSaving() {
  ["line1","line2","line3"].forEach(id => {
    const lineNum = id.replace("line","");

    const btn =
      qs(`#${id}-save`) ||
      qs(`#${id}-save-btn`) ||
      qs(`#save-${id}`) ||
      qs(`#save-${lineNum}`) ||
      document.querySelector(`[data-line-save="${id}"]`) ||
      document.querySelector(`[data-line-save="${lineNum}"]`) ||
      document.querySelector(`.dept-line-save[data-line="${lineNum}"]`) ||
      document.querySelector(`.dept-line-save[data-line="${id}"]`);

    if (!btn) return;

    btn.onclick = () => {
      const hose = qs(`#${id}-hose`)?.value || "";
      const nozzle = qs(`#${id}-nozzle`)?.value || "";
      const length = Number(qs(`#${id}-length`)?.value || 0);
      const elevation = Number(qs(`#${id}-elevation`)?.value || 0);

      setLineDefaults(id, { hose, nozzle, length, elevation });
      renderLineDefaults();
      alert(`${id} defaults saved`);
    };
  });
}

// ===========================================================
// Dropdown data (Line 1/2/3)
// ===========================================================
function populateDropdowns() {
  const hoses = getDeptHoses();
  const nozzles = getCalcNozzlesList(); // includes customs + Closed

  ["line1", "line2", "line3"].forEach(id => {
    const hoseSel = qs(`#${id}-hose`);
    const nozSel = qs(`#${id}-nozzle`);

    if (hoseSel) {
      hoseSel.innerHTML = hoses.map(h => `<option value="${h.id}">${h.label}</option>`).join("");
    }
    if (nozSel) {
      nozSel.innerHTML = nozzles.map(n => `<option value="${n.id}">${n.label}</option>`).join("");
    }
  });
}

// ===========================================================
// Initialize view
// ===========================================================
export function initDepartmentView() {
  renderHoseSelector();
  renderNozzleSelector();

  populateDropdowns();

  setupCustomHoseForm();
  setupCustomNozzleForm();
  setupSaveButtons();

  renderLineDefaults();
  setupLineDefaultSaving();
}
