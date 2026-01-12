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
import { getDeptNozzleIds } from "./preset.js";
import { setDeptUiNozzles, getLineDefaults, setLineDefaults } from "./store.js";

import { DEPT_NOZZLE_LIBRARY } from "./deptNozzles.js";


// ------- DOM Helpers -------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }



// ===========================================================
// Single nozzle list: EXACTLY match Calc (view.calc.main.js)
// ===========================================================
function getCalcNozzlesList() {
    // SINGLE source of truth for all Department Setup UIs:
    // Use the same resolved nozzle objects that Calc ultimately uses:
    //   - built-ins from NOZ_LIST (via store.getDeptNozzles)
    //   - custom nozzles from store.customNozzles (with real names)
    //
    // IMPORTANT: Do NOT build a second list from DEPT_NOZZLE_LIBRARY or from
    // dept.customNozzles in localStorage; that is what causes "Custom nozzle X gpm"
    // and first-option fallbacks.
    const list = (typeof getDeptNozzles === "function") ? (getDeptNozzles() || []) : [];
    // Ensure label is always present for rendering
    return list.map(n => ({
        id: String(n.id),
        label: String(n.label || n.name || n.id),
        gpm: Number(n.gpm ?? n.GPM ?? 0),
        NP: Number(n.NP ?? n.np ?? n.psi ?? 0),
        np: Number(n.np ?? n.NP ?? n.psi ?? 0),
    }));
}
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

    const list = getCalcNozzlesList().filter(n => n.id !== "closed");

    // Selected IDs come from preset.js storage (same as calc)
    let selectedIds = [];
    try {
        if (typeof getDeptNozzleIds === "function") {
            const ids = getDeptNozzleIds() || [];
            if (Array.isArray(ids)) selectedIds = ids.map(id => String(id));
        }
    } catch (e) {}

    const selected = new Set(selectedIds);

    const listHtml = list.map(n => {
        const id = String(n.id);
        const label = String(n.label || id);
        return `
        <label class="dept-item">
            <input type="checkbox" class="dept-nozzle-check" value="${id}" ${selected.has(id) ? "checked" : ""}>
            ${label}
        </label>`;
    }).join("");

    // IMPORTANT: The custom nozzle form is injected here so the IDs are guaranteed to match
    // the JS handlers (and so re-renders don't detach the button).
    const customHtml = `
      <div class="dept-custom" style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(148,163,184,0.35);">
        <h3 style="margin:0 0 8px 0; font-size:0.95rem;">Add a custom nozzle</h3>
        <div class="dept-custom-row" style="display:flex; flex-direction:column; gap:8px;">
          <label style="font-weight:600; font-size:0.85rem;">
            Name / label
            <input type="text" id="custom-nozzle-name" placeholder="Example: 2 1/2&quot; fog 250 gpm @ 50 psi" style="width:100%; box-sizing:border-box;">
          </label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <label style="flex:1; min-width:130px; font-weight:600; font-size:0.85rem;">
              GPM
              <input type="number" id="custom-nozzle-gpm" inputmode="numeric" placeholder="250" style="width:100%; box-sizing:border-box;">
            </label>
            <label style="flex:1; min-width:130px; font-weight:600; font-size:0.85rem;">
              Nozzle PSI
              <input type="number" id="custom-nozzle-np" inputmode="numeric" placeholder="50" style="width:100%; box-sizing:border-box;">
            </label>
          </div>
          <button type="button" class="btn-secondary" id="add-custom-nozzle-btn" style="width:100%;">Add custom nozzle</button>
          <div style="font-size:0.78rem; opacity:0.85;">
            Tip: Custom nozzles will appear in the Preconnect 1 / 2 / 3 dropdowns and in the Calc nozzle menu.
          </div>
        </div>
      </div>
    `;

    wrapper.innerHTML = listHtml + customHtml;

    // Wire button AFTER HTML exists
    const btn = qs("#add-custom-nozzle-btn");
    if (btn) {
        btn.onclick = () => {
            const nameInput = qs("#custom-nozzle-name");
            const gpmInput  = qs("#custom-nozzle-gpm");
            const npInput   = qs("#custom-nozzle-np");

            const label = String(nameInput?.value || "").trim();
            const gpm = Number(gpmInput?.value || 0);
            const np  = Number(npInput?.value || 0);

            if (!label) {
                alert("Please enter a nozzle name/label.");
                return;
            }
            if (!Number.isFinite(gpm) || gpm <= 0) {
                alert("Please enter a valid GPM (number greater than 0).");
                return;
            }
            if (!Number.isFinite(np) || np <= 0) {
                alert("Please enter a valid nozzle PSI (number greater than 0).");
                return;
            }

            try {
                addCustomNozzle(label, gpm, np);
            } catch (e) {
                console.error("addCustomNozzle failed", e);
                alert("Could not add custom nozzle. Check console for details.");
                return;
            }

            // Re-render to include the new nozzle in the list
            renderNozzleSelector();

            alert("Custom nozzle added.");
        };
    }
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
                .map(el => el.value);

            // Persist to shared department config used by presets / calc
            saveDeptConfig({ nozzles: selectedIds });

            // Build UI-ready nozzle objects EXACTLY like Calc wants.
            // This must include custom nozzles (with their real names) too.
            const all = getCalcNozzlesList().filter(n => n && n.id);
            const uiList = selectedIds.length
                ? all.filter(n => selectedIds.includes(String(n.id)))
                      .map(n => ({ id: String(n.id), label: String(n.label || n.name || n.id) }))
                : all.map(n => ({ id: String(n.id), label: String(n.label || n.name || n.id) }));

            // Update the global Dept UI nozzle list used by calc view
            try {
                if (typeof setDeptUiNozzles === "function") {
                    setDeptUiNozzles(uiList);
                }
            } catch (e) {
                console.warn("setDeptUiNozzles failed", e);
            }

            // Keep legacy store-based helper in sync if present
            try {
                if (typeof setSelectedNozzles === "function") {
                    setSelectedNozzles(selectedIds);
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

                // Build full UI nozzle list
                const uiList = Array.isArray(DEPT_NOZZLE_LIBRARY)
                    ? DEPT_NOZZLE_LIBRARY.map(n => ({
                        id: n.id,
                        label: n.label
                    }))
                    : [];

                if (typeof setDeptUiNozzles === "function") {
                    setDeptUiNozzles(uiList);
                }

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
// ===========================================================
//              LINE DEFAULTS (Preconnect 1, 2, 3)
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

            // Persist into pump_dept_defaults_v1 via store.js so calc Preconnect 1/2/3 deploy matches.
            setLineDefaults(id, { hose, nozzle, length, elevation });

            // Re-render in case something got normalized during save.
            renderLineDefaults();

            alert(`Preconnect ${id} defaults saved`);
        };
    });
}


// ===========================================================
//         DROPDOWN DATA (Filtered from store.js)
// ===========================================================
function populateDropdowns() {
    const hoses = getDeptHoses();
    const nozzles = getCalcNozzlesList();

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
