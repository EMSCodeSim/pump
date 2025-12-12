// ===========================================================
// view.department.js  (Department Setup)
// - Choose which hoses/nozzles your department carries
// - Add custom hoses/nozzles
// - Set default Line 1/2/3 (hose/nozzle/length/elevation) used by Calc "deploy" buttons
// ===========================================================

import {
  store,
  saveStore,
  addCustomHose,
  addCustomNozzle,
  setSelectedHoses,
  setSelectedNozzles,
  getDeptHoses,
  getDeptNozzles,
  HOSES_MATCHING_CHARTS,
  setDeptUiNozzles,
  getLineDefaults,
  setLineDefaults,
} from "./store.js";

import { DEPT_NOZZLE_LIBRARY } from "./deptNozzles.js";

// ------- DOM Helpers -------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

// This extra config is only used to remember which *standard* nozzles are checked in Dept Setup.
// Custom nozzles still live in store.js (store.customNozzles) and are included in getDeptNozzles().
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
//                RENDER HOSES / NOZZLES
// ===========================================================
function renderHoseSelector() {
  const wrapper = qs("#dept-hose-list");
  if (!wrapper) return;

  const hoses = HOSES_MATCHING_CHARTS;
  const selected = new Set(Array.isArray(store.deptSelectedHoses) ? store.deptSelectedHoses.map(String) : []);

  wrapper.innerHTML = hoses.map(h => `
    <label class="dept-item">
      <input
        type="checkbox"
        class="dept-hose-check"
        value="${h.id}"
        ${selected.has(String(h.id)) ? "checked" : ""}>
      ${h.label}
    </label>
  `).join("");
}

function renderNozzleSelector() {
  const wrapper = qs("#dept-nozzle-list");
  if (!wrapper) return;

  const dept = loadDeptConfig();
  const selectedIds = new Set(Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : []);

  const nozzles = Array.isArray(DEPT_NOZZLE_LIBRARY) ? DEPT_NOZZLE_LIBRARY : [];

  wrapper.innerHTML = nozzles.map(n => `
    <label class="dept-item">
      <input
        type="checkbox"
        class="dept-nozzle-check"
        value="${n.id}"
        ${selectedIds.has(String(n.id)) ? "checked" : ""}>
      ${n.label}
    </label>
  `).join("");
}

// ===========================================================
//                ADD CUSTOM HOSE / NOZZLE
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

    addCustomNozzle(label, gpm, np);

    // Re-render (this is the checkbox list; custom nozzles are managed elsewhere)
    renderNozzleSelector();

    if (nameInput) nameInput.value = "";
    if (gpmInput) gpmInput.value = "";
    if (npInput) npInput.value = "";

    alert("Custom nozzle added.");
  };
}

// ===========================================================
//                SAVE SELECTED HOSES/NOZZLES
// ===========================================================
function setupSaveButtons() {
  const saveHosesBtn = qs("#save-hose-selection");
  const saveNozzlesBtn = qs("#save-nozzle-selection");
  const restoreDefaultsBtn = qs("#restore-dept-defaults");

  if (saveHosesBtn) {
    saveHosesBtn.onclick = () => {
      const selected = qsa(".dept-hose-check").filter(i => i.checked).map(i => String(i.value));
      setSelectedHoses(selected);
      saveStore?.();
      alert("Department hose selection saved!");
    };
  }

  if (saveNozzlesBtn) {
    saveNozzlesBtn.onclick = () => {
      const selectedIds = qsa(".dept-nozzle-check").filter(i => i.checked).map(i => String(i.value));

      // Save "standard nozzle selection" to config
      saveDeptConfig({ nozzles: selectedIds });

      // Build UI list for dropdowns (line defaults, calc, etc.)
      const uiList = Array.isArray(DEPT_NOZZLE_LIBRARY)
        ? DEPT_NOZZLE_LIBRARY
            .filter(n => selectedIds.includes(String(n.id)))
            .map(n => ({ id: n.id, label: n.label }))
        : [];

      // Keep store.js single source of truth for dropdowns
      setDeptUiNozzles(uiList);
      setSelectedNozzles(selectedIds);

      alert("Department nozzle selection saved!");
    };
  }

  if (restoreDefaultsBtn) {
    restoreDefaultsBtn.onclick = () => {
      try {
        // hoses = all chart-matching hoses
        const allHoseIds = Array.isArray(HOSES_MATCHING_CHARTS) ? HOSES_MATCHING_CHARTS.map(h => String(h.id)) : [];
        setSelectedHoses(allHoseIds);

        // nozzles = everything in library
        const allNozzleIds = Array.isArray(DEPT_NOZZLE_LIBRARY) ? DEPT_NOZZLE_LIBRARY.map(n => String(n.id)) : [];
        saveDeptConfig({ nozzles: allNozzleIds });

        const uiList = Array.isArray(DEPT_NOZZLE_LIBRARY)
          ? DEPT_NOZZLE_LIBRARY.map(n => ({ id: n.id, label: n.label }))
          : [];
        setDeptUiNozzles(uiList);
        setSelectedNozzles(allNozzleIds);

        renderHoseSelector();
        renderNozzleSelector();
        populateLineDropdowns();
        renderLineDefaults();

        alert("Department defaults restored.");
      } catch (e) {
        console.warn("Restore defaults failed", e);
      }
    };
  }
}

// ===========================================================
//              LINE 1 / 2 / 3 DEFAULTS
// ===========================================================
function populateLineDropdowns() {
  const hoses = getDeptHoses();
  const nozzles = getDeptNozzles();

  ["line1", "line2", "line3"].forEach(id => {
    const hoseSel = qs(`#${id}-hose`);
    const nozSel = qs(`#${id}-nozzle`);

    if (hoseSel) {
      hoseSel.innerHTML = (Array.isArray(hoses) ? hoses : []).map(h =>
        `<option value="${h.id}">${h.label}</option>`
      ).join("");
    }

    if (nozSel) {
      nozSel.innerHTML = (Array.isArray(nozzles) ? nozzles : []).map(n =>
        `<option value="${n.id}">${n.label}</option>`
      ).join("");
    }
  });
}

function renderLineDefaults() {
  ["line1", "line2", "line3"].forEach(id => {
    const data = getLineDefaults(id) || {};

    const hoseEl = qs(`#${id}-hose`);
    const nozEl = qs(`#${id}-nozzle`);
    const lenEl = qs(`#${id}-length`);
    const elevEl = qs(`#${id}-elevation`);

    if (hoseEl) hoseEl.value = data.hose || hoseEl.value || "";
    if (nozEl) nozEl.value = data.nozzle || nozEl.value || "";
    if (lenEl) lenEl.value = (data.length ?? "");
    if (elevEl) elevEl.value = (data.elevation ?? "");
  });
}

function setupLineDefaultSaving() {
  ["line1", "line2", "line3"].forEach(id => {
    const btn = qs(`#${id}-save`);
    if (!btn) return;

    btn.onclick = () => {
      const hose = qs(`#${id}-hose`)?.value || "";
      const nozzle = qs(`#${id}-nozzle`)?.value || "";
      const length = Number(qs(`#${id}-length`)?.value || 0);
      const elevation = Number(qs(`#${id}-elevation`)?.value || 0);

      // Persists into pump_dept_defaults_v1 via store.js
      setLineDefaults(id, { hose, nozzle, length, elevation });

      alert(`${id} defaults saved`);
    };
  });
}

// ===========================================================
//              INITIALIZE VIEW
// ===========================================================
export function initDepartmentView() {
  // Render equipment selectors
  renderHoseSelector();
  renderNozzleSelector();

  // Wire up forms/buttons
  setupCustomHoseForm();
  setupCustomNozzleForm();
  setupSaveButtons();

  // Line 1/2/3 dropdowns + values + save buttons
  populateLineDropdowns();
  renderLineDefaults();
  setupLineDefaultSaving();
}
