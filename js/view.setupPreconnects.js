// First-time setup wizard: configure 1-3 Preconnects (Preconnect 1/2/3)
// Saves into Department defaults via store.js setLineDefaults(), so Calc and Presets stay in sync.

import { getDeptHoses, getDeptNozzles, getConfiguredPreconnects, setLineDefaults, getLineDefaults } from './store.js';

const MAX = 3;
const MIN = 1;

const mount = document.getElementById('cards');
const addBtn = document.getElementById('addBtn');
const saveBtn = document.getElementById('saveBtn');
const msg = document.getElementById('msg');

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function getHoses(){
  const list = getDeptHoses?.() || [];
  // Ensure user can select something even if dept hoses are empty
  if (Array.isArray(list) && list.length) return list;
  return [
    { id: '1.75', label: '1¾"' },
    { id: '2.5',  label: '2½"' },
    { id: '3',    label: '3"' },
    { id: '5',    label: '5"' },
  ];
}

function getNozzles(){
  const list = getDeptNozzles?.() || [];
  return Array.isArray(list) ? list : [];
}

function keyForIdx(i){
  return i === 0 ? 'line1' : i === 1 ? 'line2' : 'line3';
}

function niceTitle(i){
  return i === 0 ? 'Preconnect 1' : i === 1 ? 'Preconnect 2' : 'Preconnect 3';
}

function defaultName(i){
  return i === 0 ? 'Preconnect 1' : i === 1 ? 'Preconnect 2' : 'Preconnect 3';
}

function render(count){
  const hoses = getHoses();
  const nozzles = getNozzles();

  mount.innerHTML = '';
  for(let i=0;i<count;i++){
    const id = keyForIdx(i);
    const existing = getLineDefaults?.(id) || { hose:'', nozzle:'', length:0, elevation:0 };
    const html = `
      <div class="card" data-idx="${i}">
        <div class="row">
          <div>
            <div class="title">${esc(niceTitle(i))}</div>
            <div class="small">Set your standard attack line template.</div>
          </div>
          <div>
            ${count > MIN ? `<button class="btn" data-remove="${i}" type="button">Remove</button>` : ''}
          </div>
        </div>

        <div class="grid">
          <div>
            <div class="small" style="margin-bottom:6px">Name</div>
            <input class="input" data-name value="${esc(existing.name || defaultName(i))}" placeholder="e.g., Red Crosslay" />
          </div>

          <div>
            <div class="small" style="margin-bottom:6px">Hose Size</div>
            <select class="select" data-hose>
              ${hoses.map(h => `<option value="${esc(h.id)}" ${String(existing.hose||'')===String(h.id)?'selected':''}>${esc(h.label||h.id)}</option>`).join('')}
            </select>
          </div>

          <div>
            <div class="small" style="margin-bottom:6px">Length (ft)</div>
            <input class="input" type="number" min="0" step="25" data-length value="${esc(existing.length ?? 0)}" placeholder="200" />
          </div>

          <div>
            <div class="small" style="margin-bottom:6px">Nozzle</div>
            <select class="select" data-nozzle>
              <option value="">Select nozzle…</option>
              ${nozzles.map(n => `<option value="${esc(n.id)}" ${String(existing.nozzle||'')===String(n.id)?'selected':''}>${esc(n.label||n.id)}</option>`).join('')}
            </select>
          </div>

          <div>
            <div class="small" style="margin-bottom:6px">Elevation (ft)</div>
            <input class="input" type="number" step="5" data-elev value="${esc(existing.elevation ?? 0)}" placeholder="0" />
          </div>
        </div>
      </div>
    `;
    mount.insertAdjacentHTML('beforeend', html);
  }

  // Remove handlers
  mount.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remove'));
      const next = Math.max(MIN, Math.min(MAX, count - 1));
      render(next);
      setMessage('');
    });
  });

  // Add button state
  addBtn.disabled = count >= MAX;
}

function setMessage(text, kind=''){ 
  msg.textContent = text || '';
  msg.style.color = kind === 'error' ? 'var(--alert)' : kind === 'ok' ? '#9cffb4' : 'var(--muted)';
}

function readCards(){
  const cards = Array.from(mount.querySelectorAll('.card'));
  const out = cards.map((card, i) => {
    const name = card.querySelector('[data-name]')?.value?.trim() || defaultName(i);
    const hose = card.querySelector('[data-hose]')?.value || '';
    const nozzle = card.querySelector('[data-nozzle]')?.value || '';
    const length = Number(card.querySelector('[data-length]')?.value || 0) || 0;
    const elevation = Number(card.querySelector('[data-elev]')?.value || 0) || 0;
    return { i, id: keyForIdx(i), name, hose, nozzle, length, elevation };
  });
  return out;
}

function validate(list){
  if (!Array.isArray(list) || list.length < MIN) return 'Add at least one preconnect.';
  if (list.length > MAX) return 'Maximum is 3 preconnects.';

  for(const pc of list){
    if (!pc.hose) return `${niceTitle(pc.i)}: choose a hose size.`;
    if (!pc.length || pc.length <= 0) return `${niceTitle(pc.i)}: enter a length in feet.`;
    // Nozzle can be blank if the department pumps without a saved nozzle. But warn.
  }
  return '';
}

function save(list){
  // Save sequentially as Department defaults
  for(const pc of list){
    setLineDefaults(pc.id, {
      hose: pc.hose,
      nozzle: pc.nozzle,
      length: pc.length,
      elevation: pc.elevation,
      name: pc.name,
    });

    // Best-effort: also write label into the full stored object, so UI can show custom name.
    // store.js setLineDefaults already writes label as "Preconnect X"; we keep that,
    // but we preserve the user name in the simple defaults.
    try{
      const raw = localStorage.getItem('fireops_line_defaults_v1');
      const parsed = raw ? (JSON.parse(raw)||{}) : {};
      const n = pc.id === 'line1' ? '1' : pc.id === 'line2' ? '2' : '3';
      parsed[n] = { hose: pc.hose, nozzle: pc.nozzle, length: pc.length, elevation: pc.elevation, name: pc.name };
      localStorage.setItem('fireops_line_defaults_v1', JSON.stringify(parsed));
    }catch(_e){}
  }

  // Mark complete
  try{ localStorage.setItem('firstTimeSetupComplete', 'true'); }catch(_e){}
}

// --- Init ---
// If they already have preconnects configured, show the count but keep page usable.
try{
  const existing = getConfiguredPreconnects?.() || [];
  const initialCount = Math.min(MAX, Math.max(MIN, existing.length || 1));
  render(initialCount);
}catch(_e){
  render(1);
}

addBtn.addEventListener('click', () => {
  const current = mount.querySelectorAll('.card').length;
  const next = Math.min(MAX, current + 1);
  render(next);
  setMessage('');
});

saveBtn.addEventListener('click', () => {
  const list = readCards();
  const err = validate(list);
  if (err){
    setMessage(err, 'error');
    return;
  }

  // Soft warning for missing nozzle
  const missingNoz = list.filter(x => !x.nozzle);
  if (missingNoz.length){
    setMessage('Saved. Tip: add a nozzle to improve accuracy (you can edit later in Department Setup).', 'ok');
  } else {
    setMessage('Saved! Loading the app…', 'ok');
  }

  save(list);

  // Go back to the main app.
  setTimeout(() => { window.location.href = '/'; }, 350);
});
