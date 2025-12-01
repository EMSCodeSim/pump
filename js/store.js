// ============================================
// store.js  (Updated for Custom Hoses/Nozzles)
// ============================================

// ---- Persistent Storage Helpers ----
function load() {
    try {
        const raw = localStorage.getItem('fireops-store');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.error("Error loading store:", e);
        return {};
    }
}

function save(obj) {
    try {
        localStorage.setItem('fireops-store', JSON.stringify(obj));
    } catch (e) {
        console.error("Error saving store:", e);
    }
}

// ---- DEFAULTS (App comes with these) ----
const defaultHoses = [
    { id: "1.75-15.5", label: "1 3/4” (C=15.5)", diameter: 1.75, c: 15.5 },
    { id: "2.5-2", label: "2 1/2” (C=2)", diameter: 2.5, c: 2 },
    { id: "3-0.8", label: "3” (C=0.8)", diameter: 3, c: 0.8 },
    { id: "5-0.08", label: "5” LDH (C=0.08)", diameter: 5, c: 0.08 }
];

const defaultNozzles = [
    { id: "smooth-15-16", label: "15/16 Smoothbore", gpm: 185, np: 50 },
    { id: "smooth-7-8", label: "7/8 Smoothbore", gpm: 160, np: 50 },
    { id: "fog-50-150", label: "Fog Nozzle 150@50", gpm: 150, np: 50 },
    { id: "fog-50-185", label: "Fog Nozzle 185@50", gpm: 185, np: 50 },
    { id: "closed", label: "Closed", gpm: 0, np: 0 }
];

// ---- Load existing store or initialize ----
const loaded = load();

export const store = {
    // ---- Department Selected Items ----
    deptSelectedHoses: loaded.deptSelectedHoses || [],
    deptSelectedNozzles: loaded.deptSelectedNozzles || [],

    // ---- Master Lists (Defaults + Custom) ----
    deptHoses: loaded.deptHoses || [...defaultHoses],
    deptNozzles: loaded.deptNozzles || [...defaultNozzles],

    // ---- Line Defaults (Line 1 / Line 2 / Line 3) ----
    lineDefaults: loaded.lineDefaults || {
        line1: {},
        line2: {},
        line3: {}
    },

    // ---- Presets ----
    presets: loaded.presets || []
};

// ---- Save store to localStorage ----
export function saveStore() {
    save(store);
}

// ============================================
//      DEPARTMENT CUSTOM ITEM CREATION
// ============================================

// ---- Add a custom nozzle ----
export function addCustomNozzle(label, gpm, np) {
    const id = 'custom-noz-' + Date.now();
    const newNozzle = { id, label, gpm: Number(gpm), np: Number(np), custom: true };
    store.deptNozzles.push(newNozzle);
    saveStore();
    return newNozzle;
}

// ---- Add a custom hose ----
export function addCustomHose(label, diameter, c) {
    const id = 'custom-hose-' + Date.now();
    const newHose = { id, label, diameter: Number(diameter), c: Number(c), custom: true };
    store.deptHoses.push(newHose);
    saveStore();
    return newHose;
}

// ---- Save selected hoses/nozzles ----
export function setSelectedHoses(ids) {
    store.deptSelectedHoses = [...ids];
    saveStore();
}

export function setSelectedNozzles(ids) {
    store.deptSelectedNozzles = [...ids];
    saveStore();
}

// ============================================
//      FILTERED GETTERS (Used by Calc Page)
// ============================================

export function getDeptHoses() {
    if (!store.deptSelectedHoses.length) {
        return store.deptHoses;
    }
    return store.deptHoses.filter(h => store.deptSelectedHoses.includes(h.id));
}

export function getDeptNozzles() {
    if (!store.deptSelectedNozzles.length) {
        return store.deptNozzles;
    }
    return store.deptNozzles.filter(n => store.deptSelectedNozzles.includes(n.id));
}

// ============================================
//      LINE DEFAULTS (Used by Calc Page)
// ============================================
export function setLineDefaults(lineId, data) {
    store.lineDefaults[lineId] = data;
    saveStore();
}

export function getLineDefaults(lineId) {
    return store.lineDefaults[lineId] || {};
}

// ============================================
//      PRESETS
// ============================================
export function savePreset(presetObj) {
    store.presets.push(presetObj);
    saveStore();
}

export function updatePreset(index, data) {
    store.presets[index] = data;
    saveStore();
}

export function getPresets() {
    return store.presets;
}
