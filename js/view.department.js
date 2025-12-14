// ===========================================================
// view.department.js  (FIXED: single nozzle system + custom nozzle support)
// ===========================================================

import {
    store,
    addCustomHose,
    addCustomNozzle,
    setSelectedHoses,
    setSelectedNozzles,
    getDeptHoses,
    getDeptNozzles,
    HOSES_MATCHING_CHARTS,
    setDeptUiNozzles,
    getLineDefaults,
    setLineDefaults
} from "./store.js";

// ------- DOM Helpers -------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

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

function nozzleLabel(n) {
    if (!n) return "Nozzle";
    return String(n.label || n.name || n.desc || n.id || "Nozzle");
}

// ------- Render Existing Lists -------
function renderHoseSelector() {
    const wrapper = qs("#dept-hose-list");
    if (!wrapper) return;

    const hoses = HOSES_MATCHING_CHARTS || [];
    wrapper.innerHTML = hoses.map(h => `
        <label class="dept-item">
            <input 
                type="checkbox" 
                class="dept-hose-check" 
                value="${h.id}"
                ${Array.isArray(store.deptSelectedHoses) && store.deptSelectedHoses.includes(h.id) ? "checked" : ""} >
            ${h.label}
        </label>
    `).join("");
}

function renderNozzleSelector() {
    const wrapper = qs("#dept-nozzle-list");
    if (!wrapper) return;

    // SINGLE source of truth: getDeptNozzles() (built-ins + custom)
    const allNozzles = Array.isArray(getDeptNozzles()) ? getDeptNozzles() : [];
    const dept = loadDeptConfig();
    const selectedIds = new Set(
        Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : []
    );

    wrapper.innerHTML = allNozzles.map(n => {
        const id = String(n.id ?? "");
        return `
        <label class="dept-item">
            <input 
                type="checkbox" 
                class="dept-nozzle-check" 
                value="${id}" 
                ${selectedIds.has(id) ? "checked" : ""} >
            ${nozzleLabel(n)}
        </label>
        `;
    }).join("");
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
        const label = (nameInput?.value || "").trim();
        const gpm = (gpmInput?.value || "").trim();
        const np = (npInput?.value || "").trim();

        if (!label || !gpm || !np) {
            alert("Please enter nozzle name, GPM, and NP.");
            return;
        }

        addCustomNozzle(label, gpm, np);

        // Re-render selectors + dropdowns because the nozzle universe changed
        renderNozzleSelector();
        populateDropdowns();

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

            // Persist selected ids to shared config
            saveDeptConfig({ nozzles: selectedIds });

            // Keep store selection in sync
            if (typeof setSelectedNozzles === "function") {
                setSelectedNozzles(selectedIds);
            }

            // IMPORTANT: UI nozzle list must be FULL objects, not {id,label} only
            const all = Array.isArray(getDeptNozzles()) ? getDeptNozzles() : [];
            const fullSelected = all.filter(n => selectedIds.includes(String(n.id)));

            if (typeof setDeptUiNozzles === "function") {
                setDeptUiNozzles(fullSelected);
            }

            // Refresh UI immediately so Line 1/2/3 dropdown values remain valid
            populateDropdowns();
            renderLineDefaults();
            renderNozzleSelector();

            alert("Department nozzle selection saved!");
        };
    }

    // Optional: if your HTML already has a restore button, keep it working
    const restoreBtn = qs("#restore-dept-defaults");
    if (restoreBtn) {
        restoreBtn.onclick = () => {
            try {
                // Hoses: default = all matching charts
                const allHoseIds = Array.isArray(HOSES_MATCHING_CHARTS)
                    ? HOSES_MATCHING_CHARTS.map(h => h.id)
                    : [];
                setSelectedHoses(allHoseIds);

                // Nozzles: default = all nozzles currently in the canonical list
                const allNozzles = Array.isArray(getDeptNozzles()) ? getDeptNozzles() : [];
                const allNozzleIds = allNozzles.map(n => String(n.id));

                saveDeptConfig({ nozzles: allNozzleIds });

                if (typeof setSelectedNozzles === "function") {
                    setSelectedNozzles(allNozzleIds);
                }
                if (typeof setDeptUiNozzles === "function") {
                    setDeptUiNozzles(allNozzles);
                }

                renderHoseSelector();
                renderNozzleSelector();
                populateDropdowns();
                renderLineDefaults();

                alert("Department defaults restored.");
            } catch (e) {
                console.warn("Restore defaults failed", e);
            }
        };
    }
}

// ===========================================================
//              LINE DEFAULTS (Line 1, 2, 3)
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

        if (!btn) {
            // Not all layouts include explicit save buttons
            return;
        }

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
//         DROPDOWN DATA (Filtered from store.js)
// ===========================================================
function populateDropdowns() {
    const hoses = Array.isArray(getDeptHoses()) ? getDeptHoses() : [];
    const nozzles = Array.isArray(getDeptNozzles()) ? getDeptNozzles() : [];

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
                <option value="${n.id}">${nozzleLabel(n)}</option>
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
