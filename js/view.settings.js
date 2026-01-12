import { state, NOZ_LIST, savePresets, loadPresets } from './store.js';
import { getDeptNozzleIds } from './preset.js';

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.fireopscalc.app";

function isNativeApp(){
  try{
    // Capacitor exposes a global in native builds
    if (window?.Capacitor?.isNativePlatform) return !!window.Capacitor.isNativePlatform();
    const p = window?.Capacitor?.getPlatform?.();
    if (p && p !== 'web') return true;
  }catch(_e){}
  // Fallback heuristics
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:'; // common in native shells
}

export async function render(container){
  const IS_APP = isNativeApp();

  if (!IS_APP){
    container.innerHTML = `
      <section class="stack">
        <section class="card">
          <h3 style="margin:4px 0 8px">Department Setup & Presets (App Only)</h3>
          <p style="margin:0 0 10px; opacity:.92">
            The <b>website version</b> includes the full calculator, Practice mode, and Tables.
            To customize your <b>department hoses/nozzles</b> and save <b>Line 1/2/3 presets</b>,
            install the <b>FireOps Calc app</b>.
          </p>

          <div class="card" style="background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.10)">
            <h4 style="margin:0 0 6px">What are these?</h4>
            <ul style="margin:0 0 0 18px; padding:0; line-height:1.45">
              <li><b>Department Setup</b>: pick the exact hoses/nozzles your rig carries so menus only show your gear.</li>
              <li><b>Presets</b>: save common Line 1/2/3 lengths, diameters, and nozzle choices for one-tap deployment.</li>
            </ul>
          </div>

          <div class="te-actions" style="margin-top:12px">
            <a class="btn primary" href="${PLAY_STORE_URL}" target="_blank" rel="noopener">Get FireOps Calc on Google Play</a>
            <a class="btn" href="/app-only-presets.html">Learn about Presets</a>
            <a class="btn" href="/app-only.html">Learn about Department Setup</a>
          </div>

          <div class="status" style="margin-top:10px; opacity:.85">
            Note: the app saves your setup <b>locally on your device</b> for fast offline use.
          </div>
        </section>
      </section>
    `;
    return { dispose(){} };
  }

  // === APP VERSION: allow editing presets ===
  container.innerHTML = `
    <section class="stack">
      <section class="card">
        <h3 style="margin:4px 0 8px">Customize Presets</h3>
        <div class="row">
          <div class="field"><label>Line 1 length (ft)</label><input id="s_len1" type="number"></div>
          <div class="field"><label>Line 1 size</label>
            <select id="s_sz1"><option value="1.75">1¾″</option><option value="2.5">2½″</option></select>
          </div>
          <div class="field"><label>Line 1 nozzle</label><select id="s_noz1"></select></div>
        </div>
        <div class="row">
          <div class="field"><label>Line 2 length (ft)</label><input id="s_len2" type="number"></div>
          <div class="field"><label>Line 2 size</label>
            <select id="s_sz2"><option value="1.75">1¾″</option><option value="2.5">2½″</option></select>
          </div>
          <div class="field"><label>Line 2 nozzle</label><select id="s_noz2"></select></div>
        </div>
        <div class="row">
          <div class="field"><label>Line 3 length (ft)</label><input id="s_len3" type="number"></div>
          <div class="field"><label>Line 3 size</label>
            <select id="s_sz3"><option value="1.75">1¾″</option><option value="2.5">2½″</option></select>
          </div>
          <div class="field"><label>Line 3 nozzle</label><select id="s_noz3"></select></div>
        </div>
        <div class="te-actions">
          <button class="btn" id="settingsReset">Reset Defaults</button>
          <button class="btn primary" id="settingsSave">Save Presets</button>
        </div>
        <div id="settingsMsg" class="status"></div>
      </section>
    </section>
  `;

  const $ = s => container.querySelector(s);

  // Fill nozzle selects, preferring Department Setup nozzle list if available
  function fillNoz(sel){
    if (!sel) return;
    const fullList = Array.isArray(NOZ_LIST) ? NOZ_LIST : [];
    let deptIds = [];

    try {
      if (typeof getDeptNozzleIds === 'function') {
        const ids = getDeptNozzleIds() || [];
        if (Array.isArray(ids)) {
          deptIds = ids.filter(x => typeof x === 'string' && x.trim().length > 0);
        }
      }
    } catch (_e) {
      deptIds = [];
    }

    let list = fullList;
    if (deptIds.length) {
      const set = new Set(deptIds);
      const filtered = fullList.filter(n => n && n.id && set.has(n.id));
      if (filtered.length) {
        list = filtered;
      }
    }

    sel.innerHTML = list
      .map(n => `<option value="${n.id}">${n.name || n.label || n.id}</option>`)
      .join('');
  }

  fillNoz($('#s_noz1'));
  fillNoz($('#s_noz2'));
  fillNoz($('#s_noz3'));

  function loadIntoForm(){
    const p = state.presets || loadPresets();
    $('#s_len1').value = p.left.len;
    $('#s_sz1').value  = p.left.size;
    $('#s_noz1').value = p.left.noz;

    $('#s_len2').value = p.back.len;
    $('#s_sz2').value  = p.back.size;
    $('#s_noz2').value = p.back.noz;

    $('#s_len3').value = p.right.len;
    $('#s_sz3').value  = p.right.size;
    $('#s_noz3').value = p.right.noz;
  }
  loadIntoForm();

  $('#settingsReset').addEventListener('click', ()=>{
    localStorage.removeItem('fireops_presets');
    state.presets = loadPresets();
    loadIntoForm();
    $('#settingsMsg').textContent = 'Defaults restored (not yet saved).';
  });

  $('#settingsSave').addEventListener('click', ()=>{
    state.presets = {
      left:  { len:+$('#s_len1').value||200, size:$('#s_sz1').value, noz:$('#s_noz1').value },
      back:  { len:+$('#s_len2').value||200, size:$('#s_sz2').value, noz:$('#s_noz2').value },
      right: { len:+$('#s_len3').value||250, size:$('#s_sz3').value, noz:$('#s_noz3').value }
    };
    savePresets(state.presets);
    $('#settingsMsg').textContent = 'Saved! New presets apply when you deploy/edit lines.';
  });

  return { dispose(){} };
}

export default { render };
