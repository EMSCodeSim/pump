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
    HOSES_MATCHING_CHARTS,
    NOZ_LIST,
    canonicalNozzleId
} from \"./store.js\";
import { setDeptUiNozzles } from "./store.js";
import { getLineDefaults, setLineDefaults } from "./store.js";

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

    // Single source of truth for the *options shown* in Department Setup:
    // - built-in nozzle catalog (NOZ_LIST from store.js)
    // - plus any user-created custom nozzles (store.customNozzles)
    const fullCatalog = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
    const custom = Array.isArray(store?.customNozzles) ? store.customNozzles : [];

    const options = [
        ...fullCatalog.map(n => ({
            id: String(n.id ?? ""),
            label: String(n.label || n.name || n.id || ""),
            gpm: Number(n.gpm ?? n.GPM ?? 0),
            NP:  Number(n.NP ?? n.np ?? 0)
        })),
        ...custom.map(n => ({
            id: String(n.id ?? ""),
            label: String(n.label || n.name || n.id || ""),
            gpm: Number(n.gpm ?? n.GPM ?? 0),
            NP:  Number(n.NP ?? n.np ?? 0)
        }))
    ].filter(n => n.id);

    // Selected IDs: prefer store (fireops_store_v1), fallback to legacy dept config (fireops_dept_equipment_v1)
    const dept = loadDeptConfig();
    const selectedFromStore = Array.isArray(store.deptSelectedNozzles) ? store.deptSelectedNozzles.map(String) : [];
    const selectedFromLegacy = Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : [];
    const selectedIds = new Set((selectedFromStore.length ? selectedFromStore : selectedFromLegacy).map(canonicalNozzleId));

    wrapper.innerHTML = options.map(n => {
        const id = String(n.id);
        const label = n.label || id;
        const checked = selectedIds.has(canonicalNozzleId(id)) ? "checked" : "";
        return `
        <label class="dept-item">
            <input
                type="checkbox"
                class="dept-nozzle-check"
                value="${id}"
                ${checked} >
            ${label}
        </label>`;
    }).join("");
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

        const created = addCustomNozzle(label, gpm, np);

// Auto-select the newly created nozzle in Department Nozzles so it appears everywhere consistently
try {
    const dept = loadDeptConfig();
    const selected = Array.isArray(store.deptSelectedNozzles) && store.deptSelectedNozzles.length
        ? store.deptSelectedNozzles.map(String)
        : (Array.isArray(dept.nozzles) ? dept.nozzles.map(String) : []);

    // Persist the custom nozzle into the legacy dept store too (used by preset.js)
    const legacyCustom = Array.isArray(dept.customNozzles) ? dept.customNozzles.slice() : [];
    if (created && created.id && !legacyCustom.some(n => n && String(n.id) === String(created.id))) {
        legacyCustom.push({
            id: String(created.id),
            label: String(created.label || created.name || label),
            gpm: Number(created.gpm ?? gpm),
            NP:  Number(created.NP ?? np),
        });
        saveDeptConfig({ customNozzles: legacyCustom });
    }

    // Auto-select the newly created nozzle
    if (created && created.id && !selected.includes(String(created.id))) {
        selected.push(String(created.id));
    }

    // Keep BOTH stores in sync
    saveDeptConfig({ nozzles: selected });
    setSelectedNozzles(selected);
} catch(e) {
    console.warn("Auto-select custom nozzle failed", e);
}

// Re-render lists + dropdowns
renderNozzleSelector();
populateDropdowns();
renderLineDefaults();


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
    let restoreDefaultsBtn = qs("#restore-dept-defaults");

    // If the Restore Defaults button does not exist in HTML,
    // create it next to the "save nozzle" button.
    if (!restoreDefaultsBtn && saveNozzlesBtn) {
        restoreDefaultsBtn = document.createElement("button");
        restoreDefaultsBtn.id = "restore-dept-defaults";
        restoreDefaultsBtn.textContent = "Restore Defaults";
        // Match styling if saveNozzlesBtn has a class
        if (saveNozzlesBtn.className) {
            restoreDefaultsBtn.className = saveNozzlesBtn.className;
        }
        // Insert right after the save nozzle button
        if (saveNozzlesBtn.parentElement) {
            saveNozzlesBtn.parentElement.insertBefore(
                restoreDefaultsBtn,
                saveNozzlesBtn.nextSibling
            );
        } else {
            // Fallback: append to body
            document.body.appendChild(restoreDefaultsBtn);
        }
    }

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
                .map(el => String(el.value))
                .filter(Boolean);

            // IMPORTANT: single nozzle system
            // 1) fireops_store_v1 (calc uses this for filtering)
            setSelectedNozzles(selectedIds);

            // 2) fireops_dept_equipment_v1 (preset.js reads this)
            saveDeptConfig({ nozzles: selectedIds });

            // Refresh dependent UIs on this screen
            renderNozzleSelector();
            populateDropdowns();
            renderLineDefaults();

            alert("Department nozzle selection saved!");
        };
    }

    if (restoreDefaultsBtn) {
        restoreDefaultsBtn.onclick = () => {
            try {
                // Hoses: default = all chart-matching hoses
                const allHoseIds = Array.isArray(store.deptHoses)
                    ? store.deptHoses.map(h => String(h.id))
                    : [];

                setSelectedHoses(allHoseIds);

                // Nozzles: default = full built-in catalog + any custom nozzles
                const built = Array.isArray(NOZ_LIST) ? NOZ_LIST.map(n => String(n.id)) : [];
                const custom = Array.isArray(store.customNozzles) ? store.customNozzles.map(n => String(n.id)) : [];
                const allNozzleIds = [...built, ...custom].filter(Boolean);

                setSelectedNozzles(allNozzleIds);

                // Keep legacy dept store in sync (preset.js)
                saveDeptConfig({ nozzles: allNozzleIds });

                // Re-render the selectors
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
        const num = id.replace("line", "");
        const data = getLineDefaults(id) || {};

        const hoseEl = document.querySelector(`#${id}-hose`);
        const nozEl  = document.querySelector(`#${id}-nozzle`);
        const lenEl  = document.querySelector(`#${id}-length`);
        const elevEl = document.querySelector(`#${id}-elevation`);

        if (hoseEl) hoseEl.value = data.hose || "";
        if (nozEl)  nozEl.value  = data.nozzle || "";
        if (lenEl)  lenEl.value  = data.length ?? "";
        if (elevEl) elevEl.value = data.elevation ?? "";
    });
}


function setupLineDefaultSaving() {
    ["line1","line2","line3"].forEach(id => {
        const lineNum = id.replace('line',''); // '1'|'2'|'3'

        // Try a few likely save-button selectors (supports old/new HTML)
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
            console.warn('Dept setup: save button not found for', id);
            return;
        }

        btn.onclick = () => {
            const hose = (qs(`#${id}-hose`) || document.querySelector(`#${id}-hose`))?.value || "";
            const nozzle = (qs(`#${id}-nozzle`) || document.querySelector(`#${id}-nozzle`))?.value || "";
            const length = Number((qs(`#${id}-length`) || document.querySelector(`#${id}-length`))?.value || 0);
            const elevation = Number((qs(`#${id}-elevation`) || document.querySelector(`#${id}-elevation`))?.value || 0);

            // Persist into pump_dept_defaults_v1 via store.js so calc Line 1/2/3 deploy matches.
            setLineDefaults(id, { hose, nozzle, length, elevation });

            // Re-render in case something got normalized during save.
            renderLineDefaults();

            alert(`${id} defaults saved`);
        };
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
    // Existing initialization
    renderHoseSelector();
    renderNozzleSelector();

    populateDropdowns();

    setupCustomHoseForm();
    setupCustomNozzleForm();
    setupSaveButtons();

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

                    // Nozzles: reset to ALL nozzles in full nozzle catalog
                    const allNozzleIds = Array.isArray(getDeptNozzles()) ? getDeptNozzles().map(n => String(n.id)) : [];

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
