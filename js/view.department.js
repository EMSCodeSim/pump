// ===========================================================
// view.department.js
// Updated so Department Setup hoses/nozzles drive the Calc + menu
// from the same shared storage/state.
// ===========================================================

import {
    store,
    addCustomHose,
    addCustomNozzle,
    setSelectedHoses,
    setSelectedNozzles,
    getDeptHoses,
    getDeptNozzles,
    setDeptUiNozzles,
    setDeptUiHoses,
    getLineDefaults,
    setLineDefaults
} from "./store.js";

import { getDeptNozzleIds } from "./preset.js";
import { DEPT_NOZZLE_LIBRARY } from "./deptNozzles.js";

// ------- DOM Helpers -------
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

const STORAGE_DEPT_KEY = "fireops_dept_equipment_v1";

// ===========================================================
// Shared Dept Config Helpers
// ===========================================================
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
// Single nozzle list: EXACTLY match Calc
// ===========================================================
function getCalcNozzlesList() {
    const list = (typeof getDeptNozzles === "function") ? (getDeptNozzles() || []) : [];
    return list.map(n => ({
        id: String(n.id),
        label: String(n.label || n.name || n.id),
        gpm: Number(n.gpm ?? n.GPM ?? 0),
        NP: Number(n.NP ?? n.np ?? n.psi ?? 0),
        np: Number(n.np ?? n.NP ?? n.psi ?? 0),
    }));
}

// ===========================================================
// Render Existing Lists
// ===========================================================
function renderHoseSelector() {
    const wrapper = qs("#dept-hose-list");
    if (!wrapper) return;

    const hoses = (typeof getDeptHoses === "function") ? (getDeptHoses() || []) : [];
    const selected = new Set(
        Array.isArray(store?.deptSelectedHoses) ? store.deptSelectedHoses.map(String) : []
    );

    wrapper.innerHTML = hoses.map(h => `
        <label class="dept-item">
            <input
                type="checkbox"
                class="dept-hose-check"
                value="${String(h.id)}"
                ${selected.has(String(h.id)) ? "checked" : ""}>
            ${String(h.label || h.name || h.id)}
        </label>
    `).join("");
}

function renderNozzleSelector() {
    const wrapper = qs("#dept-nozzle-list");
    if (!wrapper) return;

    const list = getCalcNozzlesList().filter(n => n.id !== "closed");

    let selectedIds = [];
    try {
        if (typeof getDeptNozzleIds === "function") {
            const ids = getDeptNozzleIds() || [];
            if (Array.isArray(ids)) selectedIds = ids.map(id => String(id));
        }
    } catch (e) {}

    if (!selectedIds.length && Array.isArray(store?.deptSelectedNozzles)) {
        selectedIds = store.deptSelectedNozzles.map(String);
    }

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

                const updatedIds = Array.isArray(store?.deptSelectedNozzles)
                    ? store.deptSelectedNozzles.map(String)
                    : [];
                saveDeptConfig({ selectedNozzles: updatedIds });

                renderNozzleSelector();
                populateDropdowns();
            } catch (e) {
                console.error("addCustomNozzle failed", e);
                alert("Could not add custom nozzle. Check console for details.");
                return;
            }

            if (nameInput) nameInput.value = "";
            if (gpmInput) gpmInput.value = "";
            if (npInput) npInput.value = "";

            alert("Custom nozzle added.");
        };
    }
}

// ===========================================================
// Add Custom Hose
// ===========================================================
function setupCustomHoseForm() {
    const btn = qs("#add-custom-hose-btn");
    const nameInput = qs("#custom-hose-name");
    const diaInput = qs("#custom-hose-diameter");
    const cInput = qs("#custom-hose-c");

    if (!btn) return;

    btn.onclick = () => {
        const label = String(nameInput?.value || "").trim();
        const dia = String(diaInput?.value || "").trim();
        const c = Number(cInput?.value || 0);

        if (!label || !dia || !Number.isFinite(c) || c <= 0) {
            alert("Please enter hose name, diameter, and a valid C value.");
            return;
        }

        try {
            addCustomHose(label, dia, c);

            renderHoseSelector();
            populateDropdowns();
        } catch (e) {
            console.error("addCustomHose failed", e);
            alert("Could not add custom hose. Check console for details.");
            return;
        }

        if (nameInput) nameInput.value = "";
        if (diaInput) diaInput.value = "";
        if (cInput) cInput.value = "";

        alert("Custom hose added.");
    };
}

// ===========================================================
// Save Selected Hoses/Nozzles
// ===========================================================
function setupSaveButtons() {
    const saveHosesBtn = qs("#save-hose-selection");
    const saveNozzlesBtn = qs("#save-nozzle-selection");
    let restoreDefaultsBtn = qs("#restore-dept-defaults");

    if (!restoreDefaultsBtn && saveNozzlesBtn) {
        restoreDefaultsBtn = document.createElement("button");
        restoreDefaultsBtn.id = "restore-dept-defaults";
        restoreDefaultsBtn.textContent = "Restore Defaults";
        if (saveNozzlesBtn.className) {
            restoreDefaultsBtn.className = saveNozzlesBtn.className;
        }
        if (saveNozzlesBtn.parentElement) {
            saveNozzlesBtn.parentElement.insertBefore(
                restoreDefaultsBtn,
                saveNozzlesBtn.nextSibling
            );
        } else {
            document.body.appendChild(restoreDefaultsBtn);
        }
    }

    if (saveHosesBtn) {
        saveHosesBtn.onclick = () => {
            const selections = qsa(".dept-hose-check")
                .filter(el => el.checked)
                .map(el => String(el.value));

            setSelectedHoses(selections);

            const allHoses = getDeptHoses() || [];
            const uiHoses = selections.length
                ? allHoses.filter(h => selections.includes(String(h.id)))
                : allHoses;

            try {
                setDeptUiHoses(uiHoses);
            } catch (e) {
                console.warn("setDeptUiHoses failed", e);
            }

            saveDeptConfig({
                selectedHoses: selections,
                customHoses: Array.isArray(store?.customHoses) ? store.customHoses : []
            });

            populateDropdowns();
            alert("Department hose selection saved!");
        };
    }

    if (saveNozzlesBtn) {
        saveNozzlesBtn.onclick = () => {
            const selectedIds = qsa(".dept-nozzle-check")
                .filter(el => el.checked)
                .map(el => String(el.value));

            setSelectedNozzles(selectedIds);

            const all = getCalcNozzlesList().filter(n => n && n.id);
            const uiList = selectedIds.length
                ? all.filter(n => selectedIds.includes(String(n.id)))
                    .map(n => ({ id: String(n.id), label: String(n.label || n.name || n.id) }))
                : all.map(n => ({ id: String(n.id), label: String(n.label || n.name || n.id) }));

            try {
                setDeptUiNozzles(uiList);
            } catch (e) {
                console.warn("setDeptUiNozzles failed", e);
            }

            saveDeptConfig({
                selectedNozzles: selectedIds
            });

            populateDropdowns();
            alert("Department nozzle selection saved!");
        };
    }

    if (restoreDefaultsBtn) {
        restoreDefaultsBtn.onclick = () => {
            try {
                const allHoses = getDeptHoses() || [];
                const allHoseIds = allHoses.map(h => String(h.id));

                setSelectedHoses(allHoseIds);
                setDeptUiHoses(allHoses);

                const allNozzles = getCalcNozzlesList().filter(n => n.id !== "closed");
                const allNozzleIds = allNozzles.map(n => String(n.id));
                const uiNozzles = allNozzles.map(n => ({
                    id: String(n.id),
                    label: String(n.label || n.name || n.id)
                }));

                setSelectedNozzles(allNozzleIds);
                setDeptUiNozzles(uiNozzles);

                saveDeptConfig({
                    selectedHoses: allHoseIds,
                    customHoses: Array.isArray(store?.customHoses) ? store.customHoses : [],
                    selectedNozzles: allNozzleIds
                });

                renderHoseSelector();
                renderNozzleSelector();
                populateDropdowns();

                alert("Department defaults restored.");
            } catch (e) {
                console.warn("Restore defaults failed", e);
            }
        };
    }
}

// ===========================================================
// Line Defaults (Preconnect 1, 2, 3)
// ===========================================================
function renderLineDefaults() {
    ["line1", "line2", "line3"].forEach(id => {
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
            console.warn("Dept setup: save button not found for", id);
            return;
        }

        btn.onclick = () => {
            const hose = qs(`#${id}-hose`)?.value || "";
            const nozzle = qs(`#${id}-nozzle`)?.value || "";
            const length = Number(qs(`#${id}-length`)?.value || 0);
            const elevation = Number(qs(`#${id}-elevation`)?.value || 0);

            setLineDefaults(id, { hose, nozzle, length, elevation });
            renderLineDefaults();

            alert(`Preconnect ${lineNum} defaults saved`);
        };
    });
}

// ===========================================================
// Dropdown Data (Filtered from shared dept state)
// ===========================================================
function populateDropdowns() {
    const hoses = getDeptHoses() || [];
    const nozzles = getCalcNozzlesList() || [];

    ["line1", "line2", "line3"].forEach(id => {
        const hoseSel = qs(`#${id}-hose`);
        const nozSel = qs(`#${id}-nozzle`);

        if (hoseSel) {
            hoseSel.innerHTML = hoses.map(h => `
                <option value="${String(h.id)}">${String(h.label || h.name || h.id)}</option>
            `).join("");
        }

        if (nozSel) {
            nozSel.innerHTML = nozzles.map(n => `
                <option value="${String(n.id)}">${String(n.label || n.name || n.id)}</option>
            `).join("");
        }
    });
}

// ===========================================================
// Initialize View
// ===========================================================
export function initDepartmentView() {
    renderHoseSelector();
    renderNozzleSelector();
    populateDropdowns();

    setupCustomHoseForm();
    setupSaveButtons();

    renderLineDefaults();
    setupLineDefaultSaving();

    try {
        const deptHose = document.querySelector("#dept-hose-list") || document.body;

        if (deptHose && !document.getElementById("restore-dept-defaults")) {
            const btn = document.createElement("button");
            btn.id = "restore-dept-defaults";
            btn.textContent = "Restore Defaults";
            btn.className = "btn";

            btn.addEventListener("click", () => {
                try {
                    const allHoses = getDeptHoses() || [];
                    const allHoseIds = allHoses.map(h => String(h.id));

                    setSelectedHoses(allHoseIds);
                    setDeptUiHoses(allHoses);

                    const allNozzles = getCalcNozzlesList().filter(n => n.id !== "closed");
                    const allNozzleIds = allNozzles.map(n => String(n.id));
                    const uiNozzles = allNozzles.map(n => ({
                        id: String(n.id),
                        label: String(n.label || n.name || n.id)
                    }));

                    setSelectedNozzles(allNozzleIds);
                    setDeptUiNozzles(uiNozzles);

                    saveDeptConfig({
                        selectedHoses: allHoseIds,
                        customHoses: Array.isArray(store?.customHoses) ? store.customHoses : [],
                        selectedNozzles: allNozzleIds
                    });

                    renderHoseSelector();
                    renderNozzleSelector();
                    populateDropdowns();

                    alert("Department defaults restored.");
                } catch (e) {
                    console.warn("Restore defaults failed", e);
                }
            });

            deptHose.appendChild(btn);
        }
    } catch (e) {
        console.warn("Failed to attach Restore Defaults button", e);
    }
}
