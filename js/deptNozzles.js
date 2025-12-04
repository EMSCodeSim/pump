// js/deptNozzles.js
// Master Department Nozzle Library for FireOps Calc

export const DEPT_NOZZLE_LIBRARY = [
  // =========================
  // FOG – 50 PSI (LOW PRESSURE)
  // =========================
  { id: 'fog95_50',   label: 'Fog 95 GPM @ 50 psi',   type: 'fog',      gpm: 95,   np: 50 },
  { id: 'fog125_50',  label: 'Fog 125 GPM @ 50 psi',  type: 'fog',      gpm: 125,  np: 50 },
  { id: 'fog150_50',  label: 'Fog 150 GPM @ 50 psi',  type: 'fog',      gpm: 150,  np: 50 },
  { id: 'fog175_50',  label: 'Fog 175 GPM @ 50 psi',  type: 'fog',      gpm: 175,  np: 50 },
  { id: 'fog185_50',  label: 'Fog 185 GPM @ 50 psi',  type: 'fog',      gpm: 185,  np: 50 },
  { id: 'fog200_50',  label: 'Fog 200 GPM @ 50 psi',  type: 'fog',      gpm: 200,  np: 50 },
  { id: 'fog265_50',  label: 'Fog 265 GPM @ 50 psi',  type: 'fog',      gpm: 265,  np: 50 }, // ChiefXD 265

  // =========================
  // FOG – 100 PSI
  // =========================
  { id: 'fog95_100',  label: 'Fog 95 GPM @ 100 psi',  type: 'fog',      gpm: 95,   np: 100 },
  { id: 'fog125_100', label: 'Fog 125 GPM @ 100 psi', type: 'fog',      gpm: 125,  np: 100 },
  { id: 'fog150_100', label: 'Fog 150 GPM @ 100 psi', type: 'fog',      gpm: 150,  np: 100 },
  { id: 'fog175_100', label: 'Fog 175 GPM @ 100 psi', type: 'fog',      gpm: 175,  np: 100 },
  { id: 'fog200_100', label: 'Fog 200 GPM @ 100 psi', type: 'fog',      gpm: 200,  np: 100 },
  { id: 'fog250_100', label: 'Fog 250 GPM @ 100 psi', type: 'fog',      gpm: 250,  np: 100 },

  // =========================
  // SMOOTH BORE – 50 PSI HANDLINES
  // =========================
  { id: 'sb12_50',    label: 'Smooth 1/2" — 50 GPM @ 50 psi',     type: 'smooth',  gpm: 50,   np: 50 },
  { id: 'sb58_50',    label: 'Smooth 5/8" — 80 GPM @ 50 psi',     type: 'smooth',  gpm: 80,   np: 50 },
  { id: 'sb34_50',    label: 'Smooth 3/4" — 120 GPM @ 50 psi',    type: 'smooth',  gpm: 120,  np: 50 },
  { id: 'sb78_50',    label: 'Smooth 7/8" — 160 GPM @ 50 psi',    type: 'smooth',  gpm: 160,  np: 50 },
  { id: 'sb1516_50',  label: 'Smooth 15/16" — 185 GPM @ 50 psi',  type: 'smooth',  gpm: 185,  np: 50 }, // standard attack SB
  { id: 'sb1_50',     label: 'Smooth 1" — 210 GPM @ 50 psi',      type: 'smooth',  gpm: 210,  np: 50 },

  // Larger handline SB at 50 psi
  { id: 'sb118_50',   label: 'Smooth 1 1/8" — 265 GPM @ 50 psi',  type: 'smooth',  gpm: 265,  np: 50 },
  { id: 'sb114_50',   label: 'Smooth 1 1/4" — 325 GPM @ 50 psi',  type: 'smooth',  gpm: 325,  np: 50 },

  // =========================
  // MASTER STREAM SMOOTH BORE – 80 PSI
  // =========================
  { id: 'ms138_80',   label: 'Master Stream 1 3/8" — 500 GPM @ 80 psi', type: 'master', gpm: 500,  np: 80 },
  { id: 'ms112_80',   label: 'Master Stream 1 1/2" — 600 GPM @ 80 psi', type: 'master', gpm: 600,  np: 80 },
  { id: 'ms134_80',   label: 'Master Stream 1 3/4" — 800 GPM @ 80 psi', type: 'master', gpm: 800,  np: 80 },
  { id: 'ms2_80',     label: 'Master Stream 2" — 1000 GPM @ 80 psi',    type: 'master', gpm: 1000, np: 80 },

  // =========================
  // MASTER STREAM FOG
  // =========================
  { id: 'fog500_100', label: 'Master Fog 500 GPM @ 100 psi',   type: 'master',   gpm: 500,  np: 100 },
  { id: 'fog750_100', label: 'Master Fog 750 GPM @ 100 psi',   type: 'master',   gpm: 750,  np: 100 },
  { id: 'fog1000_100',label: 'Master Fog 1000 GPM @ 100 psi',  type: 'master',   gpm: 1000, np: 100 },

  // =========================
  // SPECIALTY NOZZLES
  // (replace these with your *actual* specialty nozzles)
  // =========================
  { id: 'piercing100_100', label: 'Piercing Nozzle 100 GPM @ 100 psi', type: 'specialty', gpm: 100, np: 100 },
  { id: 'cellar250_100',   label: 'Cellar Nozzle 250 GPM @ 100 psi',   type: 'specialty', gpm: 250, np: 100 },
  { id: 'breaker30_100',   label: 'Breaker Line 30 GPM @ 100 psi',    type: 'specialty', gpm: 30,  np: 100 },
  // Add any other specialty/master nozzles you use here, matching this shape.
];
