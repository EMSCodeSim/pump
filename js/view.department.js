// ===========================================================
// view.department.js  (Updated for Custom Hoses/Nozzles)
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
    HOSES_MATCHING_CHARTS
} from "./store.js";
import { setDeptUiNozzles } from "./store.js";
import { getLineDefaults, setLineDefaults } from "./store.js";

import { DEPT_NOZZLE_LIBRARY } from "./deptNozzles.js";


// ------- DOM Helpers -------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }


const STORAGE_DEPT_KEY = 'fireops_dept_equipment_v1';

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

// ------- Render Existing Lists -------
function renderHoseSelector() {
    const wrapper = qs("#dept-hose-list");
    const hoses = HOSES_MATCHING_CHARTS;

    wrapper.innerHTML = hoses.map(h => `
        <label class="dept-item">
            <input 
                type="checkbox" 
                class="dept-hose-check" 
                value="${h.id}"
                ${store.deptSelectedHoses.includes(h.id) ? "checked" : ""} >
            ${h.label}
        </label>
    `).join("");
}

function renderNozzleSelector() {
    const wrapper = qs("#dept-nozzle-list");
    if (!wrapper) return;

    const dept = loadDeptConfig();
    const selectedIds = new Set(
        Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : []
    );

    const nozzles = DEPT_NOZZLE_LIBRARY;

    wrapper.innerHTML = nozzles.map(n => `
        <label class="dept-item">
            <input 
                type="checkbox" 
                class="dept-nozzle-check" 
                value="${n.id}" 
                ${selectedIds.has(String(n.id)) ? "checked" : ""} >
            ${n.label}
        </label>
    `).join("");
}


// ===========================================================
//                ADD CUSTOM HOSE
// ===========================================================
function setupCustomHoseForm() {
    const btn = qs("#add-custom-hose-btn");
    const nameInput = qs("#custom-hose-name");
    const diaInput = qs("#custom-hose-diameter");
    const cInput = qs("#custom-hose-c");

    if (!btn) return;

    const saveNow = (showAlert) => {
            const hose = (qs(`#${id}-hose`) || document.querySelector(`#${id}-hose`))?.value || "";
            const nozzle = (qs(`#${id}-nozzle`) || document.querySelector(`#${id}-nozzle`))?.value || "";
            const length = Number((qs(`#${id}-length`) || document.querySelector(`#${id}-length`))?.value || 0);
            const elevation = Number((qs(`#${id}-elevation`) || document.querySelector(`#${id}-elevation`))?.value || 0);

            // Persist into pump_dept_defaults_v1 via store.js so calc Line 1/2/3 deploy matches.
            setLineDefaults(id, { hose, nozzle, length, elevation });

            // Re-render in case something got normalized during save.
            populateDropdowns();
            renderLineDefaults();

            if (showAlert) alert(`${id} defaults saved`);
        };

        btn.onclick = () => saveNow(true);

        // Also auto-save on changes so the dropdown doesn't "snap back" to the first option.
        const hoseEl = qs(`#${id}-hose`) || document.querySelector(`#${id}-hose`);
        const nozEl  = qs(`#${id}-nozzle`) || document.querySelector(`#${id}-nozzle`);
        const lenEl  = qs(`#${id}-length`) || document.querySelector(`#${id}-length`);
        const elevEl = qs(`#${id}-elevation`) || document.querySelector(`#${id}-elevation`);

        if (hoseEl) hoseEl.addEventListener('change', () => saveNow(false));
        if (nozEl)  nozEl.addEventListener('change',  () => saveNow(false));
        if (lenEl)  lenEl.addEventListener('input',   () => saveNow(false));
        if (elevEl) elevEl.addEventListener('input',  () => saveNow(false));
    });
}


// ===========================================================
//         DROPDOWN DATA (Filtered from store.js)
// ===========================================================
function populateDropdowns() {
    const hoses = getDeptHoses();
    const nozzles = getDeptNozzles();

    ["line1", "line2", "line3"].forEach(id => {
        const hoseSel = qs(`#${id}-hose`);
        const nozSel = qs(`#${id}-nozzle`);

        if (hoseSel) {
            hoseSel.innerHTML = hoses.map(h => `
                <option value="${h.id}">${h.label}</option>
            `).join("");
        }

        if (nozSel) {
            nozSel.innerHTML = nozzles.map(n => `
                <option value="${n.id}">${(n.label || n.name || n.id)}</option>
            `).join("");
        }
    });
}

// ===========================================================
//              INITIALIZE VIEW
// ===========================================================
export function initDepartmentView() {
    // Existing initialization
    renderHoseSelector();
    renderNozzleSelector();

    populateDropdowns();

    setupCustomHoseForm();
    setupCustomNozzleForm();
    setupSaveButtons();

    try { ensureLineDefaultsNozzlesValid(); } catch(e) { console.warn('ensureLineDefaultsNozzlesValid failed', e); }
    renderLineDefaults();
    setupLineDefaultSaving();

    // Ensure a Restore Defaults button exists on the Department page
    try {
        const deptHose = document.querySelector('#dept-hose-list') || document.body;

        if (deptHose && !document.getElementById('restore-dept-defaults')) {
            const btn = document.createElement('button');
            btn.id = 'restore-dept-defaults';
            btn.textContent = 'Restore Defaults';
            btn.className = 'btn';

            btn.addEventListener('click', () => {
                try {
                    // Hoses: reset to ALL department hoses
                    const allHoseIds = Array.isArray(store.deptHoses)
                        ? store.deptHoses.map(h => h.id)
                        : [];

                    setSelectedHoses(allHoseIds);

                    // Nozzles: reset to ALL nozzles in DEPT_NOZZLE_LIBRARY
                    const allNozzleIds = Array.isArray(DEPT_NOZZLE_LIBRARY)
                        ? DEPT_NOZZLE_LIBRARY.map(n => n.id)
                        : [];

                    // Save into shared dept config used by presets / calc
                    saveDeptConfig({
                        nozzles: allNozzleIds
                    });

                    // Keep legacy store-based helper in sync if present
                    if (typeof setSelectedNozzles === 'function') {
                        setSelectedNozzles(allNozzleIds);
                    }

                    // Re-render UI selections
                    renderHoseSelector();
                    renderNozzleSelector();

                    alert('Department defaults restored.');
                } catch (e) {
                    console.warn('Restore defaults failed', e);
                }
            });

            // Append button at bottom of hose section (or body fallback)
            deptHose.appendChild(btn);
        }
    } catch (e) {
        console.warn('Failed to attach Restore Defaults button', e);
    }
}
