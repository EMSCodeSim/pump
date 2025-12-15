// ===========================================================
// view.department.js  (CUSTOM NAME + GPM FIX for Line 1/2/3)
// - Uses EXACT same nozzle source as Calc for dropdowns:
//   NOZ_LIST + getDeptCustomNozzlesForCalc(), filtered by getDeptNozzleIds(),
//   label overlay via deptState.getUiNozzles().
// ===========================================================

import {
  NOZ,
  NOZ_LIST,
  getDeptHoses,
  getLineDefaults,
  setLineDefaults
} from "./store.js";

import { getDeptNozzleIds, getDeptCustomNozzlesForCalc } from "./preset.js";
import { getUiNozzles } from "./deptState.js";

// ------- DOM helpers -------
const qs = (s) => document.querySelector(s);
const qsa = (s) => Array.from(document.querySelectorAll(s));

// ===========================================================
// Single nozzle list builder (match view.calc.main.js behavior)
// ===========================================================
function buildCalcNozzleList() {
  // base list
  let list = Array.isArray(NOZ_LIST) ? [...NOZ_LIST] : [];

  // merge custom nozzles (canonical objects with id/name/gpm/NP)
  try {
    const customs = (typeof getDeptCustomNozzlesForCalc === "function")
      ? (getDeptCustomNozzlesForCalc() || [])
      : [];
    if (Array.isArray(customs) && customs.length) list = list.concat(customs);
  } catch (e) {
    console.warn("Dept: failed to merge custom nozzles", e);
  }

  // filter to selected department nozzle ids (if any)
  try {
    const ids = (typeof getDeptNozzleIds === "function") ? (getDeptNozzleIds() || []) : [];
    if (Array.isArray(ids) && ids.length) {
      const allowed = new Set(ids.map((x) => String(x)));
      const filtered = list.filter((n) => n && allowed.has(String(n.id)));
      if (filtered.length) list = filtered;
    }
  } catch (e) {
    console.warn("Dept: nozzle filter failed", e);
  }

  // overlay UI labels (deptState) so names match the checklist / calc
  let uiById = null;
  try {
    const ui = (typeof getUiNozzles === "function") ? (getUiNozzles() || []) : [];
    if (Array.isArray(ui) && ui.length) {
      uiById = new Map(ui.filter(n => n && n.id != null).map(n => [String(n.id), n]));
    }
  } catch (e) {}

  // normalize + de-dupe
  const out = [];
  const seen = new Set();

  for (const n of list) {
    if (!n || n.id == null) continue;
    const id = String(n.id);
    if (seen.has(id)) continue;
    seen.add(id);

    const uiN = uiById ? uiById.get(id) : null;

    // Prefer explicit custom name (n.name) and UI label, then fallback
    const label =
      (uiN && (uiN.label || uiN.name || uiN.desc)) ||
      n.name || n.label || n.desc || id;

    // Pull hydraulics numbers. Prefer n.gpm/NP (customs), then NOZ catalog.
    let gpm = Number(n.gpm ?? n.GPM ?? 0) || 0;
    let NP  = Number(n.NP  ?? n.np  ?? n.psi ?? n.pressure ?? 0) || 0;

    if (NOZ && NOZ[id]) {
      if (!gpm && typeof NOZ[id].gpm === "number") gpm = NOZ[id].gpm;
      if (!NP  && typeof NOZ[id].NP  === "number") NP  = NOZ[id].NP;
    }

    // If still missing and looks like a custom nozzle, keep what we have (label is the key fix)
    out.push({ id, label, gpm, NP });
  }

  // Add Closed at top (department Line defaults should include it)
  out.unshift({ id: "closed", label: "Closed (no flow)", gpm: 0, NP: 0 });
  return out;
}

// ===========================================================
// Dropdown population (Line 1/2/3)
// ===========================================================
function populateLineDropdowns() {
  const hoses = Array.isArray(getDeptHoses()) ? getDeptHoses() : [];
  const nozzles = buildCalcNozzleList();

  ["line1", "line2", "line3"].forEach((id) => {
    const hoseSel = qs(`#${id}-hose`);
    const nozSel  = qs(`#${id}-nozzle`);

    if (hoseSel) {
      hoseSel.innerHTML = hoses.map(h => `<option value="${h.id}">${h.label}</option>`).join("");
    }
    if (nozSel) {
      nozSel.innerHTML = nozzles.map(n => `<option value="${n.id}">${n.label}</option>`).join("");
    }
  });
}

// ===========================================================
// Render saved line defaults into fields
// ===========================================================
function renderLineDefaults() {
  ["line1", "line2", "line3"].forEach((id) => {
    const d = getLineDefaults(id) || {};
    const hoseEl = qs(`#${id}-hose`);
    const nozEl  = qs(`#${id}-nozzle`);
    const lenEl  = qs(`#${id}-length`);
    const elevEl = qs(`#${id}-elevation`);

    if (hoseEl) hoseEl.value = d.hose || "";
    if (nozEl)  nozEl.value  = d.nozzle || "";
    if (lenEl)  lenEl.value  = d.length ?? "";
    if (elevEl) elevEl.value = d.elevation ?? "";
  });
}

// ===========================================================
// Save handlers for Line 1/2/3
// ===========================================================
function wireLineSaveButtons() {
  ["line1", "line2", "line3"].forEach((id) => {
    const btn =
      qs(`#${id}-save`) ||
      qs(`#${id}-save-btn`) ||
      qs(`#save-${id}`) ||
      document.querySelector(`[data-line-save="${id}"]`);

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
// init
// ===========================================================
export function initDepartmentView() {
  // This file ONLY focuses on fixing the Line 1/2/3 dropdown labels/numbers
  // while keeping the nozzle list identical to Calc's list builder.
  populateLineDropdowns();
  renderLineDefaults();
  wireLineSaveButtons();
}

