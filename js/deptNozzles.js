// deptNozzles.js
// Unified nozzle library for Department Setup, aligned with Charts view.
//
// This file defines which nozzles are available for selection in
// Department Setup. It is intentionally kept in sync with the
// nozzle types shown on the Charts tab (smooth bore handline,
// smooth bore master stream, fog handline, fog master, specialty).

import { NOZ } from "./store.js";

// Smooth-bore handline tips @ 50 psi
const SB_HANDLINE = [
  { id: "sb7_8",    label: 'SB 7/8" @ 50',    noz: NOZ.sb7_8 },
  { id: "sb15_16",  label: 'SB 15/16" @ 50',  noz: NOZ.sb15_16 },
  { id: "sb1",      label: 'SB 1" @ 50',      noz: NOZ.sb1 },
  { id: "sb1_1_8",  label: 'SB 1 1/8" @ 50',  noz: NOZ.sb1_1_8 },
  { id: "sb1_1_4",  label: 'SB 1 1/4" @ 50',  noz: NOZ.sb1_1_4 },
  // Optional smaller handline tips (not all shown on Charts but useful)
  { id: "sb12_50",  label: 'SB 1/2" @ 50',    noz: NOZ.sb12_50 },
  { id: "sb5_8_50", label: 'SB 5/8" @ 50',    noz: NOZ.sb5_8_50 },
  { id: "sb3_4_50", label: 'SB 3/4" @ 50',    noz: NOZ.sb3_4_50 },
];

// Smooth-bore master stream tips @ 80 psi
const SB_MASTER = [
  { id: "ms1_3_8_80", label: 'MS 1 3/8" @ 80', noz: NOZ.ms1_3_8_80 },
  { id: "ms1_1_2_80", label: 'MS 1 1/2" @ 80', noz: NOZ.ms1_1_2_80 },
  { id: "ms1_3_4_80", label: 'MS 1 3/4" @ 80', noz: NOZ.ms1_3_4_80 },
  { id: "ms2_80",     label: 'MS 2" @ 80',     noz: NOZ.ms2_80 },
];

// Fog / ChiefXD handline nozzles
const FOG_HANDLINE = [
  // 75 psi handline fogs (Charts: Fog 150/185/200/250 @ 75)
  { id: "fog150_75",  label: "Fog 150 @ 75",           noz: NOZ.fog150_75 },
  // We do not have a dedicated fog185_75, so we reuse a 50 psi 185 gpm fog
  { id: "fog185_50",  label: "Fog 185 @ 50",           noz: NOZ.fog185_50 },
  { id: "fog200_75",  label: "Fog 200 @ 75",           noz: NOZ.fog200_75 || NOZ.fog200_50 },
  { id: "fog250_75",  label: 'Fog 250 @ 75 (2½")',     noz: NOZ.fog250_75 },

  // ChiefXD low-pressure handline fogs (Charts: ChiefXD 150/185/200/265 @ 50)
  { id: "chiefXD165_50", label: "ChiefXD 165 @ 50",    noz: NOZ.chiefXD165_50 },
  { id: "chief185_50",   label: "ChiefXD 185 @ 50",    noz: NOZ.chief185_50 },
  { id: "chiefXD200_75", label: "ChiefXD 200 @ 75",    noz: NOZ.chiefXD200_75 },
  { id: "chiefXD265",    label: "ChiefXD 265 @ 50",    noz: NOZ.chiefXD265 },

  // Legacy 100 psi fogs that appear on Charts
  { id: "fog95_100",   label: "Fog 95 @ 100",          noz: NOZ.fog95_100 },
  { id: "fog125_100",  label: "Fog 125 @ 100",         noz: NOZ.fog125_100 },
  { id: "fog150_100",  label: "Fog 150 @ 100",         noz: NOZ.fog150_100 },
  { id: "fog200_100",  label: "Fog 200 @ 100",         noz: NOZ.fog200_100 },
  { id: "fog250_100",  label: "Fog 250 @ 100",         noz: NOZ.fog250_100 },
];

// Master fog nozzles @ 100 psi
const FOG_MASTER = [
  { id: "fog500_100",  label: "Master Fog 500 @ 100",  noz: NOZ.fog500_100 },
  { id: "fog750_100",  label: "Master Fog 750 @ 100",  noz: NOZ.fog750_100 },
  { id: "fog1000_100", label: "Master Fog 1000 @ 100", noz: NOZ.fog1000_100 },
];

// Specialty nozzles (aligned with Charts specialty section)
const SPECIALTY = [
  { id: "piercing100_100", label: "Piercing nozzle ~100 gpm", noz: NOZ.piercing100_100 },
  { id: "cellar250_100",   label: "Cellar nozzle ~250 gpm",   noz: NOZ.cellar250_100 },
  { id: "breaker30_100",   label: "Breaker / distributor 30 gpm", noz: NOZ.breaker30_100 },
];

// Flatten to a single library with id + label (and pass through any gpm/NP if needed later)
export const DEPT_NOZZLE_LIBRARY = [
  ...SB_HANDLINE,
  ...SB_MASTER,
  ...FOG_HANDLINE,
  ...FOG_MASTER,
  ...SPECIALTY,
].map(entry => ({
  id: entry.id,
  label: entry.label,
  // Expose gpm / NP for future use, if the consumer wants it:
  gpm: entry.noz?.gpm,
  NP: entry.noz?.NP,
}));
