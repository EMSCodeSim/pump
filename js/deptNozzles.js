// ===========================================================
// deptNozzles.js
// Department nozzle library (single source of truth)
// - IDs are the internal NOZ ids from store.js (must match).
// - Labels are derived from store.NOZ entries (name field).
// - Includes gpm/NP so calc/UI can use the same objects.
// ===========================================================

import { NOZ_LIST } from "./store.js";

/** Preferred display order for Department Setup checklists. */
const ORDER = [
  "fog95_50",
  "fog125_50",
  "fog150_50",
  "fog175_50",
  "fog185_50",
  "fog200_50",
  "fog95_75",
  "fog125_75",
  "fog150_75",
  "chiefXD200_75",
  "fog95_100",
  "fog125_100",
  "fog150_100",
  "fog175_100",
  "fog200_100",
  "chiefXD165_50",
  "chief185_50",
  "chiefXD",
  "fog250_50",
  "fog265_50",
  "fog250_75",
  "fog250_100",
  "chiefXD265",
  "sb12_50",
  "sb5_8_50",
  "sb3_4_50",
  "sb7_8",
  "sb15_16",
  "sb1",
  "sb1_1_8",
  "sb1_1_4",
  "ms1_3_8_80",
  "ms1_1_2_80",
  "ms1_3_4_80",
  "ms2_80",
  "fog500_100",
  "fog750_100",
  "fog1000_100",
  "piercing100_100",
  "cellar250_100",
  "breaker30_100"
];

function indexNozzlesById() {
  const map = new Map();
  (Array.isArray(NOZ_LIST) ? NOZ_LIST : []).forEach(n => {
    if (n && n.id) map.set(String(n.id), n);
  });
  return map;
}

const nozById = indexNozzlesById();

function toDeptEntry(n) {
  if (!n) return null;
  return {
    id: String(n.id),
    // Prefer a human-friendly name from the nozzle catalog
    label: n.name || n.label || String(n.id),
    // Include these so calc can rely on dept-selected nozzle objects
    gpm: Number(n.gpm) || 0,
    NP: Number(n.NP) || 0,
    name: n.name || n.label || String(n.id),
  };
}

/**
 * Canonical department nozzle list.
 * If ORDER ever drifts, any catalog nozzles not in ORDER are appended.
 */
export const DEPT_NOZZLE_LIBRARY = (() => {
  const out = [];

  // Ordered items first
  for (const id of ORDER) {
    const n = nozById.get(String(id));
    const entry = toDeptEntry(n);
    if (entry) out.push(entry);
  }

  // Append any remaining catalog nozzles not in ORDER (future-proof)
  const orderedSet = new Set(ORDER.map(String));
  for (const n of (Array.isArray(NOZ_LIST) ? NOZ_LIST : [])) {
    if (!n || !n.id) continue;
    const id = String(n.id);
    if (orderedSet.has(id)) continue;
    const entry = toDeptEntry(n);
    if (entry) out.push(entry);
  }

  return out;
})();
