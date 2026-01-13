// store.js
// Central app state, nozzle catalog, presets, and friction loss helpers.
// Backward-compatible export surface (legacy views import many symbols from here).

export const state = {
  supply: 'off',       // 'off' | 'pressurized' | 'draft' | 'relay'
  showMath: false,
  lastMaxKey: null,    // track which line last had MAX pressed
  lines: null,         // runtime hose line objects (left/back/right + any added)
  water: null,         // water supply state (hydrant/tanker/etc) if used
};

// -------------------- constants --------------------
export const PSI_PER_FT = 0.05;

// Hose C-values / coefficients
export const COEFF = {
  '1.75': 15.5,
  '2': 8,
  '2.5': 2,
  '3': 0.8,
  '4': 0.2,
  '5': 0.08,
};

// UI color tokens (used by older modules)
export const COLORS = {
  left:  '#3b82f6',
  back:  '#f59e0b',
  right: '#22c55e',
  wye:   '#a855f7',
  relay: '#ef4444',
};

// -------------------- nozzle catalog --------------------
export const NOZ_LIST = [
  // id, label, gpm, NP, type
  { id:'fog_95_100',   label:'Fog 95 @ 100',   gpm:95,  NP:100, type:'fog' },
  { id:'fog_125_100',  label:'Fog 125 @ 100',  gpm:125, NP:100, type:'fog' },
  { id:'fog_150_100',  label:'Fog 150 @ 100',  gpm:150, NP:100, type:'fog' },
  { id:'fog_185_100',  label:'Fog 185 @ 100',  gpm:185, NP:100, type:'fog' },
  { id:'fog_250_100',  label:'Fog 250 @ 100',  gpm:250, NP:100, type:'fog' },

  { id:'chief185_50',  label:'Chief 185 @ 50', gpm:185, NP:50,  type:'fog' },
  { id:'chief250_50',  label:'Chief 250 @ 50', gpm:250, NP:50,  type:'fog' },
  { id:'chief300_50',  label:'Chief 300 @ 50', gpm:300, NP:50,  type:'fog' },

  { id:'chiefXD265',   label:'Chief XD 265 @ 50', gpm:265, NP:50, type:'fog' },

  { id:'sb_7_8_50',    label:'Smooth Bore 7/8 @ 50',    gpm:160, NP:50, type:'sb' },
  { id:'sb_15_16_50',  label:'Smooth Bore 15/16 @ 50',  gpm:185, NP:50, type:'sb' },
  { id:'sb_1_50',      label:'Smooth Bore 1" @ 50',     gpm:210, NP:50, type:'sb' },
  { id:'sb_1_1_8_50',  label:'Smooth Bore 1-1/8 @ 50',  gpm:250, NP:50, type:'sb' },
  { id:'sb_1_1_4_50',  label:'Smooth Bore 1-1/4 @ 50',  gpm:325, NP:50, type:'sb' },

  { id:'fog1000_100',  label:'Master Fog 1000 @ 100', gpm:1000, NP:100, type:'master' },
];

// Map form (older files import NOZ)
export const NOZ = {};
for (const n of NOZ_LIST) NOZ[n.id] = n;

export function nozzleById(id){
  return NOZ[id] || null;
}

// ✅ COMPAT: normalize any nozzle reference into a valid NOZ id
// Accepts: string id, nozzle object, or label-ish string.
// Returns: a valid nozzle id from NOZ (or null if not found).
export function canonicalNozzleId(input){
  if (!input) return null;

  // 1) Already an id or label string
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return null;

    // exact id
    if (NOZ[s]) return s;

    const lower = s.toLowerCase();

    // exact label match
    const byLabel = NOZ_LIST.find(n => String(n.label || '').toLowerCase() === lower);
    if (byLabel) return byLabel.id;

    // substring label match
    const partial = NOZ_LIST.find(n => String(n.label || '').toLowerCase().includes(lower));
    if (partial) return partial.id;

    return null;
  }

  // 2) Nozzle-like object
  if (typeof input === 'object') {
    // id field
    if (input.id && NOZ[input.id]) return input.id;

    // label/name field
    const label = String(input.label || input.name || '').trim();
    if (label) {
      const lower = label.toLowerCase();
      const byLabel = NOZ_LIST.find(n => String(n.label || '').toLowerCase() === lower);
      if (byLabel) return byLabel.id;

      const partial = NOZ_LIST.find(n => String(n.label || '').toLowerCase().includes(lower));
      if (partial) return partial.id;
    }

    // gpm/NP match
    const gpm = Number(input.gpm ?? input.GPM ?? 0);
    const NP  = Number(input.NP ?? input.np ?? 0);
    if (gpm && NP) {
      const found = NOZ_LIST.find(n => Number(n.gpm) === gpm && Number(n.NP) === NP);
      if (found) return found.id;
    }
  }

  return null;
}

// -------------------- department defaults storage --------------------
const KEY_DEPT = 'pump.dept.v2';

function safeParse(raw, fallback){
  try { return JSON.parse(raw); } catch { return fallback; }
}

function deepClone(o){
  try { return JSON.parse(JSON.stringify(o)); } catch { return null; }
}

// Dept line template shape
function defaultDeptLine(label){
  return {
    label,
    visible: false,     // templates should never mean "deployed"
    hasWye: false,
    elevFt: 0,
    nozRight: null,     // nozzle id
    nozLeft: null,
    itemsMain: [],      // [{size,lengthFt,cValue}]
    itemsLeft: [],      // branch left sections
  };
}

// Default dept config
function seedDept(){
  return {
    left:  defaultDeptLine('Preconnect 1'),
    back:  defaultDeptLine('Preconnect 2'),
    right: defaultDeptLine('Preconnect 3'),
    hoses: [
      { id:'1.75', label:'1¾" (15.5)', size:'1.75', cValue:15.5 },
      { id:'2',    label:'2" (8)',     size:'2',    cValue:8 },
      { id:'2.5',  label:'2½" (2)',    size:'2.5',  cValue:2 },
      { id:'3',    label:'3" (0.8)',   size:'3',    cValue:0.8 },
      { id:'4',    label:'4" (0.2)',   size:'4',    cValue:0.2 },
      { id:'5',    label:'5" (0.08)',  size:'5',    cValue:0.08 },
    ],
    nozzles: NOZ_LIST.map(n => ({ id:n.id, label:n.label })),
  };
}

// ✅ COMPAT: older modules import these static lists for Department Setup UI
export const DEPT_UI_HOSES = seedDept().hoses;
export const DEPT_UI_NOZZLES = seedDept().nozzles;

export function loadDept(){
  const raw = localStorage.getItem(KEY_DEPT);
  if (!raw) return seedDept();

  const parsed = safeParse(raw, seedDept());
  const base = seedDept();

  // merge
  const merged = { ...base, ...parsed };
  merged.left  = { ...base.left,  ...(parsed.left  || {}) };
  merged.back  = { ...base.back,  ...(parsed.back  || {}) };
  merged.right = { ...base.right, ...(parsed.right || {}) };

  // sanity arrays
  if (!Array.isArray(merged.hoses)) merged.hoses = base.hoses;
  if (!Array.isArray(merged.nozzles)) merged.nozzles = base.nozzles;

  return merged;
}

export function saveDept(dept){
  localStorage.setItem(KEY_DEPT, JSON.stringify(dept));
}

// ✅ COMPAT ALIASES: some older modules still import these names
export function loadDeptDefaults(){
  return loadDept();
}
export function saveDeptDefaults(dept){
  return saveDept(dept);
}

export function getDeptHoses(){
  return loadDept().hoses || [];
}

export function getDeptNozzles(){
  return loadDept().nozzles || [];
}

// ✅ COMPAT: older Dept UI calls these setters
export function setDeptUiHoses(hoses){
  const dept = loadDept();
  dept.hoses = Array.isArray(hoses) ? hoses : dept.hoses;
  saveDept(dept);
  return dept.hoses;
}
export function setDeptUiNozzles(nozzles){
  const dept = loadDept();
  dept.nozzles = Array.isArray(nozzles) ? nozzles : dept.nozzles;
  saveDept(dept);
  return dept.nozzles;
}

export function getDeptLineDefault(key){
  const dept = loadDept();
  const candidate = dept && dept[key];

  // Ensure it looks like a line template
  if (candidate && typeof candidate === 'object' && Array.isArray(candidate.itemsMain)) {
    const safe = deepClone(candidate) || candidate;
    // Always start with NO lines deployed on app load
    safe.visible = false;
    return safe;
  }
  return defaultDeptLine(key);
}

export function setDeptLineDefault(key, obj){
  const dept = loadDept();
  dept[key] = obj;
  saveDept(dept);
}

// -------------------- mapping: setup wizard -> dept preconnects --------------------
export function setLineDefaults(lineId, data){
  // lineId: 'line1'|'line2'|'line3'
  const map = { line1:'left', line2:'back', line3:'right' };
  const key = map[lineId];
  if (!key) return;

  const dept = loadDept();
  const L = dept[key] || defaultDeptLine(`Preconnect ${lineId}`);

  const size = String(data.hose || '1.75');
  const lengthFt = Number(data.length || 0);
  const cValue = COEFF[size] || Number(data.cValue || 0) || COEFF['1.75'];

  L.label = (data.name || L.label || `Preconnect ${lineId}`);
  L.elevFt = Number(data.elevation || 0);
  L.nozRight = data.nozzle || null;
  L.visible = false; // templates never deployed
  L.hasWye = false;

  L.itemsMain = [{
    size,
    lengthFt,
    cValue
  }];

  // clear branch on template
  L.itemsLeft = [];

  dept[key] = L;
  saveDept(dept);
}

export function getLineDefaults(lineId){
  const map = { line1:'left', line2:'back', line3:'right' };
  const key = map[lineId];
  if (!key) return null;

  const d = getDeptLineDefault(key);
  const seg = (d.itemsMain && d.itemsMain[0]) ? d.itemsMain[0] : null;

  return {
    name: d.label || '',
    hose: seg ? String(seg.size) : '',
    length: seg ? Number(seg.lengthFt || 0) : 0,
    nozzle: d.nozRight || '',
    elevation: Number(d.elevFt || 0),
  };
}

// -------------------- runtime line seed / ensure --------------------
export function seedDefaultsForKey(key){
  const deptLine = getDeptLineDefault(key);
  const safe = deepClone(deptLine) || deptLine;

  // Normalize for runtime shape expected by calc view
  const rt = {
    key,
    visible: false,  // 🚨 start stowed ALWAYS
    enabled: false,
    hasWye: !!safe.hasWye,
    elevFt: Number(safe.elevFt || 0),
    itemsMain: Array.isArray(safe.itemsMain) ? deepClone(safe.itemsMain) : [],
    itemsLeft: Array.isArray(safe.itemsLeft) ? deepClone(safe.itemsLeft) : [],
    nozRight: safe.nozRight || null,
    nozLeft: safe.nozLeft || null,
    label: safe.label || '',
  };

  return rt;
}

export function seedRuntimeLines(){
  return {
    left:  seedDefaultsForKey('left'),
    back:  seedDefaultsForKey('back'),
    right: seedDefaultsForKey('right'),
  };
}

export function ensureSeeded(){
  if (!state.lines) state.lines = seedRuntimeLines();

  // Force start with nothing deployed
  try{
    ['left','back','right'].forEach(k=>{
      if (state.lines[k]) state.lines[k].visible = false;
    });
  }catch(_e){}
}

// -------------------- nozzle / active nozzle (legacy helpers) --------------------
export function setNozzleOnLine(lineKey, nozzleId, side='right'){
  if (!state.lines) ensureSeeded();
  const L = state.lines[lineKey];
  if (!L) return;

  if (side === 'left') L.nozLeft = nozzleId;
  else L.nozRight = nozzleId;
}

// Active nozzle (legacy) – returns the nozzle object for a line
export function activeNozzle(lineKey, side='right'){
  if (!state.lines) ensureSeeded();
  const L = state.lines[lineKey];
  if (!L) return null;

  const id = (side === 'left') ? L.nozLeft : L.nozRight;
  return nozzleById(id);
}

// -------------------- friction loss helpers --------------------
export function CPer100(size, gpm, cOverride){
  const C = (cOverride != null) ? Number(cOverride) : (COEFF[String(size)] || 0);
  if (!C || !gpm) return 0;
  return C * Math.pow((gpm/100), 2);
}

export function FL(gpm, size, lengthFt, cOverride){
  if(!gpm || !lengthFt) return 0;
  return CPer100(size, gpm, cOverride) * (lengthFt/100);
}

export function FL_total(gpm, items){
  if(!Array.isArray(items) || !items.length || !gpm) return 0;
  let sum = 0;
  for(const seg of items) sum += FL(gpm, seg.size, seg.lengthFt, seg.cValue);
  return sum;
}

// ✅ COMPAT: older calc code imports FL_total_sections from store/calcShared
export function FL_total_sections(gpm, sections){
  return FL_total(gpm, sections);
}

// ✅ COMPAT: some modules also look for FL_total_sections under this spelling
export function FL_total_sections_compat(gpm, sections){
  return FL_total(gpm, sections);
}

export function sumFt(items){
  if(!Array.isArray(items)) return 0;
  return items.reduce((a,c)=> a + (Number(c.lengthFt)||0), 0);
}

export function splitIntoSections(items){
  if(!Array.isArray(items)) return [];
  return items
    .filter(Boolean)
    .map(s => ({
      size: String(s.size),
      lengthFt: Number(s.lengthFt)||0,
      cValue: (s.cValue!=null) ? Number(s.cValue) : (COEFF[String(s.size)] || 0)
    }))
    .filter(s => s.lengthFt > 0);
}

// -------------------- presets (saved user presets) --------------------
const KEY_PRESETS = 'pump.presets.v3';

function seedPresets(){
  return { list: [], activeId: null };
}

export function loadPresets(){
  const raw = localStorage.getItem(KEY_PRESETS);
  if(!raw) return seedPresets();
  const parsed = safeParse(raw, seedPresets());
  if(!parsed || typeof parsed !== 'object') return seedPresets();
  if(!Array.isArray(parsed.list)) parsed.list = [];
  if(!('activeId' in parsed)) parsed.activeId = null;
  return parsed;
}

export function savePresets(p){
  localStorage.setItem(KEY_PRESETS, JSON.stringify(p));
}

export function presetCreateFromDept(name){
  const dept = loadDept();
  const p = loadPresets();

  const id = `p_${Date.now()}`;
  const entry = {
    id,
    name: String(name || 'Preset'),
    createdAt: Date.now(),
    dept: deepClone(dept),
  };

  p.list.unshift(entry);
  p.activeId = id;
  savePresets(p);
  return entry;
}

export function presetDelete(id){
  const p = loadPresets();
  p.list = p.list.filter(x => x.id !== id);
  if (p.activeId === id) p.activeId = (p.list[0]?.id || null);
  savePresets(p);
}

export function presetSetActive(id){
  const p = loadPresets();
  p.activeId = id;
  savePresets(p);
}

export function presetGetActive(){
  const p = loadPresets();
  return p.list.find(x => x.id === p.activeId) || null;
}

export function presetApply(entry){
  if(!entry || !entry.dept) return;
  saveDept(entry.dept);

  // Reseed runtime lines from the new dept defaults
  state.lines = seedRuntimeLines();

  // Never auto-deploy on preset apply; user must deploy
  try{
    ['left','back','right'].forEach(k=>{
      if (state.lines[k]) state.lines[k].visible = false;
    });
  }catch(_e){}
}

// -------------------- init --------------------
ensureSeeded();
