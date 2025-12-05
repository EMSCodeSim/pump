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
    setLineDefaults,
    getLineDefaults
} from "./store.js";
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
    const hoses = store.deptHoses;

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

    btn.onclick = () => {
        const label = nameInput.value.trim();
        const dia = diaInput.value.trim();
        const c = cInput.value.trim();

        if (!label || !dia || !c) {
            alert("Please enter hose name, diameter, and C value.");
            return;
        }

        addCustomHose(label, dia, c);

        // Re-render list
        renderHoseSelector();

        // Clear fields
        nameInput.value = "";
        diaInput.value = "";
        cInput.value = "";

        alert("Custom hose added.");
    };
}

// ===========================================================
//                ADD CUSTOM NOZZLE
// ===========================================================
function setupCustomNozzleForm() {
    const btn = qs("#add-custom-nozzle-btn");
    const nameInput = qs("#custom-nozzle-name");
    const gpmInput = qs("#custom-nozzle-gpm");
    const npInput = qs("#custom-nozzle-np");

    if (!btn) return;

    btn.onclick = () => {
        const label = nameInput.value.trim();
        const gpm = gpmInput.value.trim();
        const np = npInput.value.trim();

        if (!label || !gpm || !np) {
            alert("Please enter nozzle name, GPM, and NP.");
            return;
        }

        addCustomNozzle(label, gpm, np);

        // Re-render list
        renderNozzleSelector();

        // Clear
        nameInput.value = "";
        gpmInput.value = "";
        npInput.value = "";

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
            const selections = qsa(".dept-hose-check")
                .filter(el => el.checked)
                .map(el => el.value);

            setSelectedHoses(selections);
            alert("Department hose selection saved!");
        };
    }

    if (saveNozzlesBtn) {
        saveNozzlesBtn.onclick = () => {
            const selections = qsa(".dept-nozzle-check")
                .filter(el => el.checked)
                .map(el => el.value);

            // Persist to shared department config used by presets / calc
            saveDeptConfig({ nozzles: selections });

            // If older store-based helper exists, keep it in sync too
            try {
                if (typeof setSelectedNozzles === "function") {
                    setSelectedNozzles(selections);
                }
            } catch (e) {
                console.warn("setSelectedNozzles failed", e);
            }

            alert("Department nozzle selection saved!");
        };
    }

    if (restoreDefaultsBtn) {
        restoreDefaultsBtn.onclick = () => {
            try {
                // Hoses: default = all department hoses
                const allHoseIds = Array.isArray(store.deptHoses)
                    ? store.deptHoses.map(h => h.id)
                    : [];

                setSelectedHoses(allHoseIds);

                // Nozzles: default = all entries from DEPT_NOZZLE_LIBRARY
                const allNozzleIds = Array.isArray(DEPT_NOZZLE_LIBRARY)
                    ? DEPT_NOZZLE_LIBRARY.map(n => n.id)
                    : [];

                // Save into shared dept config used by presets/calc
                saveDeptConfig({
                    nozzles: allNozzleIds
                });

                // Keep legacy store-based helper in sync if present
                if (typeof setSelectedNozzles === "function") {
                    setSelectedNozzles(allNozzleIds);
                }

                // Re-render UI selections
                renderHoseSelector();
                renderNozzleSelector();

                alert("Department defaults restored.");
            } catch (e) {
                console.warn("Restore defaults failed", e);
            }
        };
    }
}

eof setSelectedNozzles === "function") {
                    setSelectedNozzles(selections);
                }
            } catch (e) {
                console.warn("setSelectedNozzles failed", e);
            }

            alert("Department nozzle selection saved!");
        };
    }

// ===========================================================
//              LINE DEFAULTS (Line 1, 2, 3)
// ===========================================================
function renderLineDefaults() {
    ["line1", "line2", "line3"].forEach(id => {
        const data = getLineDefaults(id);

        qs(`#${id}-hose`)?.value = data.hose || "";
        qs(`#${id}-nozzle`)?.value = data.nozzle || "";
        qs(`#${id}-length`)?.value = data.length || "";
        qs(`#${id}-elevation`)?.value = data.elevation || "";
    });
}

function setupLineDefaultSaving() {
    ["line1", "line2", "line3"].forEach(id => {
        qs(`#${id}-save`)?.addEventListener("click", () => {
            const hose = qs(`#${id}-hose`).value;
            const nozzle = qs(`#${id}-nozzle`).value;
            const length = Number(qs(`#${id}-length`).value || 0);
            const elevation = Number(qs(`#${id}-elevation`).value || 0);

            setLineDefaults(id, { hose, nozzle, length, elevation });

            alert(`${id} defaults saved`);
        });
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
                <option value="${n.id}">${n.label}</option>
            `).join("");
        }
    });
}

// ===========================================================
//              INITIALIZE VIEW
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
