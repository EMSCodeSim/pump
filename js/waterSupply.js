// waterSupply.js
// Encapsulates: supply graphics (hydrant/static/relay), hydrant %drop panel,
// tender shuttle (static supply) with compact phone layout,
// and supply visibility + live updates (without re-rendering buttons while running).

// Public API:
//   const ws = new WaterSupplyUI(opts)
//   ws.draw(viewHeight)                     // draw supply graphic under truck
//   ws.updatePanelsVisibility()             // show/hide hydrant/static panels
//   ws.getShuttleTotalGpm() : number        // current shuttle GPM total (completed trips only)
//   ws.destroy()                            // cleanup intervals and listeners

export class WaterSupplyUI {
  /**
   * @param {Object} o
   * @param {HTMLElement} o.container  Root container passed to render()
   * @param {Object} o.state           Shared app state (must include state.supply)
   * @param {Function} o.pumpXY(viewH) -> {x,y}  Pump discharge point
   * @param {Function} o.truckTopY(viewH) -> number  Top of the truck Y
   * @param {SVGElement} o.G_supply     <g> layer for supply graphics
   * @param {number} o.TRUCK_H
   */
  constructor(o){
    this.container = o.container;
    this.state     = o.state;
    this.pumpXY    = o.pumpXY;
    this.truckTopY = o.truckTopY;
    this.G_supply  = o.G_supply;
    this.TRUCK_H   = o.TRUCK_H;

    // Panels (created/queried from DOM built by main view)
    this.hydrantHelper = this.container.querySelector('#hydrantHelper');
    this.hydrantStatic = this.container.querySelector('#hydrantStatic');
    this.hydrantResidual = this.container.querySelector('#hydrantResidual');
    this.hydrantCalcBtn  = this.container.querySelector('#hydrantCalcBtn');
    this.hydrantResult   = this.container.querySelector('#hydrantResult');

    // Compact static/tender shuttle panel
    this.staticHelper    = this.container.querySelector('#staticHelper');
    this.tAddId          = this.container.querySelector('#tAddId');
    this.tAddCap         = this.container.querySelector('#tAddCap');
    this.tAddBtn         = this.container.querySelector('#tAddBtn');
    this.tenderList      = this.container.querySelector('#tenderList');
    this.shuttleTotalGpm = this.container.querySelector('#shuttleTotalGpm');

    // Local tender state
    // sec = accumulated seconds for round trips already completed (i.e., after Stop)
    // running/startTs handle the active timing session
    this.tenders = []; // { id, cap, eff, sec, running, startTs }

    // Wire up interactions if panels exist
    this.#wireHydrant();
    this.#wireTender();

    // Live tick for timers: update only the timer text + total (no full table re-render)
    this._tick = setInterval(() => {
      if(!this.staticHelper || this.staticHelper.style.display === 'none') return;
      if (!this.tenders.some(t => t.running)) return;

      // Update visible timer cells in place (smoother; buttons stay tappable)
      for (let i = 0; i < this.tenders.length; i++) {
        const t = this.tenders[i];
        const cell = this.tenderList?.querySelector(`#tTimer_${i}`);
        if (!cell) continue;
        const dispSec = t.running ? (t.sec + this.#runningDelta(t)) : t.sec;
        cell.textContent = this.#fmtTime(dispSec);
      }

      // Update total using only completed (stopped) trips
      if (this.shuttleTotalGpm) {
        this.shuttleTotalGpm.textContent = this.getShuttleTotalGpm();
      }
    }, 500);
  }

  destroy(){
    clearInterval(this._tick);
  }

  // ==== Public: panels visibility ==================================================
  updatePanelsVisibility(){
    if(!this.hydrantHelper || !this.staticHelper) return;
    const s = this.state.supply;
    this.hydrantHelper.style.display = (s === 'pressurized' || s === 'hydrant') ? 'block' : 'none';
    this.staticHelper.style.display  = (s === 'static' || s === 'drafting') ? 'block' : 'none';
  }

  // ==== Public: draw supply graphic ================================================
  draw(viewH){
    const G = this.G_supply;
    if(!G) return;
    while(G.firstChild) G.removeChild(G.firstChild);

    const s = this.state.supply;
    if(!s) return;

    const ns = G.namespaceURI;
    const baseY = this.truckTopY(viewH) + this.TRUCK_H + 6;

    if(s === 'pressurized' || s === 'hydrant'){
      const hyd = document.createElementNS(ns,'rect');
      hyd.setAttribute('x','10'); hyd.setAttribute('y', String(baseY+20));
      hyd.setAttribute('width','80'); hyd.setAttribute('height','60');
      hyd.setAttribute('fill','#243614'); hyd.setAttribute('stroke','#7aa35e');
      G.appendChild(hyd);

      const t = document.createElementNS(ns,'text');
      t.setAttribute('x','50'); t.setAttribute('y', String(baseY+55));
      t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle');
      t.setAttribute('font-size','12'); t.textContent='Hydrant';
      G.appendChild(t);

      const pump = this.pumpXY(viewH);
      const hose = document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 90 ${baseY+50} C 160 ${baseY+50} 240 ${baseY+50} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('stroke-width','12');
      hose.setAttribute('fill','none'); hose.setAttribute('stroke-linecap','round');
      G.appendChild(hose);

    } else if(s === 'drafting' || s === 'static'){
      const r = document.createElementNS(ns,'rect');
      r.setAttribute('x','10'); r.setAttribute('y', String(baseY+60));
      r.setAttribute('width','120'); r.setAttribute('height','70');
      r.setAttribute('fill','#10233b'); r.setAttribute('stroke','#4a6a9b');
      G.appendChild(r);

      const t = document.createElementNS(ns,'text');
      t.setAttribute('x','70'); t.setAttribute('y', String(baseY+100));
      t.setAttribute('fill','#cfe4ff'); t.setAttribute('text-anchor','middle');
      t.setAttribute('font-size','12'); t.textContent='Static Source';
      G.appendChild(t);

      const pump = this.pumpXY(viewH);
      const path = document.createElementNS(ns,'path');
      path.setAttribute('d',`M ${pump.x},${pump.y} C 240 ${baseY+40}, 190 ${baseY+65}, 130 ${baseY+95}`);
      path.setAttribute('stroke','#6ecbff'); path.setAttribute('stroke-width','8');
      path.setAttribute('fill','none'); path.setAttribute('stroke-linecap','round');
      G.appendChild(path);

    } else if(s === 'relay'){
      const img = document.createElementNS(ns,'rect');
      img.setAttribute('x','10'); img.setAttribute('y', String(baseY));
      img.setAttribute('width','120'); img.setAttribute('height','80');
      img.setAttribute('fill','#162032'); img.setAttribute('stroke','#2b3c5a');
      G.appendChild(img);

      const tt = document.createElementNS(ns,'text');
      tt.setAttribute('x','70'); tt.setAttribute('y', String(baseY+45));
      tt.setAttribute('fill','#cfe4ff'); tt.setAttribute('text-anchor','middle');
      tt.setAttribute('font-size','12'); tt.textContent='Engine 2';
      G.appendChild(tt);

      const pump = this.pumpXY(viewH);
      const hose = document.createElementNS(ns,'path');
      hose.setAttribute('d',`M 130 ${baseY+40} C 190 ${baseY+36} 250 ${baseY+36} ${pump.x} ${pump.y-20}`);
      hose.setAttribute('stroke','#ecd464'); hose.setAttribute('stroke-width','12');
      hose.setAttribute('fill','none'); hose.setAttribute('stroke-linecap','round');
      G.appendChild(hose);
    }
  }

  // ==== Public: total shuttle gpm (completed trips only) ===========================
  getShuttleTotalGpm(){
    // Only include tenders that are NOT running and have >0 sec recorded
    const total = this.tenders.reduce((a,t)=> a + (t.running || t.sec<=0 ? 0 : this.#gpmForTenderStopped(t)), 0);
    return Math.round(total * 10) / 10;
  }

  // ==== Hydrant panel wiring =======================================================
  #wireHydrant(){
    if(!this.hydrantHelper || !this.hydrantCalcBtn || !this.hydrantResult) return;
    this.hydrantCalcBtn.addEventListener('click', () => {
      const s = Number(this.container.querySelector('#hydrantStatic')?.value) || 0;
      const r = Number(this.container.querySelector('#hydrantResidual')?.value) || 0;
      if(s<=0 || r<=0 || r>=s){
        this.hydrantResult.textContent = 'Check inputs (static > residual > 0).';
        return;
      }
      const drop = (s-r)/s * 100;
      let extra = '0×';
      if(drop <= 10) extra = '3×';
      else if(drop <= 15) extra = '2×';
      else if(drop <= 25) extra = '1×';
      else extra = '0×';
      this.hydrantResult.innerHTML = `Drop = <b>${Math.round(drop*10)/10}%</b> → add approximately <b>${extra}</b> more of the same line size safely.`;
    });
  }

  // ==== Tender shuttle (static supply) =============================================
  #wireTender(){
    if(!this.staticHelper) return;
    if(this.tAddBtn){
      this.tAddBtn.addEventListener('click', () => {
        const id  = (this.tAddId?.value || 'Tender').trim();
        const cap = Number(this.tAddCap?.value || 0);
        if(id && cap > 0){
          this.tenders.push({ id, cap, eff: Math.round(cap*0.9), sec: 0, running: false, startTs: 0 });
          this.tAddId.value = ''; this.tAddCap.value = '';
          this.#renderTenderTable();
        }
      });
    }

    if(this.tenderList){
      this.tenderList.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-i]'); if(!tr) return;
        const i = Number(tr.getAttribute('data-i'));
        const t = this.tenders[i]; if(!t) return;

        const actEl = e.target.closest('[data-act]'); if(!actEl) return;
        const act = actEl.getAttribute('data-act');

        if(act === 'startstop'){
          if(t.running){
            // STOP: fold running delta into sec; mark not running
            t.sec += this.#runningDelta(t);
            t.running=false; t.startTs=0;
          } else {
            // START: begin timing
            t.running=true; t.startTs=Date.now();
          }
          this.#renderTenderTable(); // re-render once when state toggles

        } else if(act === 'reset'){
          t.running=false; t.startTs=0; t.sec=0; this.#renderTenderTable();

        } else if(act === 'del'){
          this.tenders.splice(i,1); this.#renderTenderTable();

        } else if(act === 'info'){
          alert(
            'Tender: ' + t.id + '\n'
            + 'Capacity: ' + Math.round(t.cap) + ' gal\n'
            + 'Effective (-10%): ' + Math.round(t.eff) + ' gal'
          );
        }
      });
    }

    // initial render (empty table message)
    this.#renderTenderTable();
  }

  #renderTenderTable(){
    if(!this.tenderList) return;

    if(!this.tenders.length){
      this.tenderList.innerHTML = '<div class="status" style="color:#cfe6ff">No tenders added yet.</div>';
      if(this.shuttleTotalGpm) this.shuttleTotalGpm.textContent = '0';
      return;
    }

    // Build rows; while a timer is running we will NOT re-render each tick,
    // we only update the timer text node. That keeps the Start/Stop buttons
    // stationary and easy to tap (esp. on the second/third rows).
    let rows = '';
    for(let i=0;i<this.tenders.length;i++){
      const t = this.tenders[i];
      const dispSec = t.running ? (t.sec + this.#runningDelta(t)) : t.sec;

      // GPM display rule: only show GPM after a completed round trip (not running, sec>0)
      const gpmCellText = (!t.running && t.sec > 0)
        ? this.#fmt1(this.#gpmForTenderStopped(t))
        : '—';

      rows += '<tr data-i="'+i+'">'
            + '<td><button class="tInfoBtn" data-act="info" title="Show details for '+this.#esc(t.id)+'">'
            + '<span class="tBadge">'+this.#esc(t.id)+'</span>'
            + '</button></td>'
            + '<td class="tTimer"><span id="tTimer_'+i+'">'+this.#fmtTime(dispSec)+'</span></td>'
            + '<td><b id="tGpm_'+i+'">'+gpmCellText+'</b></td>'
            + '<td><div class="tCtrlWrap">'
            +   '<button class="btn btnIcon tStartStop" data-act="startstop" title="'+(t.running?'Stop':'Start')+'">'
            +     (t.running?'Stop':'Start')
            +   '</button>'
            +   '<button class="btn tReset" data-act="reset" title="Reset timer">Reset</button>'
            +   '<button class="btn tDelete" data-act="del" title="Remove tender">Delete</button>'
            + '</div></td>'
            + '</tr>';
    }

    this.tenderList.innerHTML =
      '<table class="tTable" role="table" aria-label="Tender Shuttle (compact)">'
      + '<thead><tr><th>Tender</th><th>Round Trip</th><th>GPM</th><th>Controls</th></tr></thead>'
      + '<tbody>'+rows+'</tbody></table>';

    // Update total (completed trips only)
    if(this.shuttleTotalGpm) this.shuttleTotalGpm.textContent = this.getShuttleTotalGpm();

    // Ensure styles that improve tap targets / layout are present once
    if(!document.getElementById('tenderShuttleStyle')){
      const s=document.createElement('style'); s.id='tenderShuttleStyle';
      s.textContent = `
        .tTable { width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:12px; }
        .tTable thead th { background:#162130; color:#fff; padding:10px; text-align:left; border-bottom:1px solid rgba(255,255,255,.1); }
        .tTable tbody td { padding:10px; vertical-align:middle; }
        .tTable tbody tr:nth-child(odd) td { background:#0e151e; color:#dfeaff; }
        .tTable tbody tr:nth-child(even) td { background:#111924; color:#dfeaff; }

        .tBadge { background:#0e151e; border:1px solid rgba(255,255,255,.15); padding:4px 10px; border-radius:999px; font-weight:700; }
        .tTimer { font-family: ui-monospace, Menlo, Consolas, monospace; min-width:86px; display:inline-block; text-align:left; }

        /* Larger, easier tap targets */
        .tCtrlWrap { display:flex; gap:8px; flex-wrap:wrap; }
        .btnIcon, .tStartStop, .tReset, .tDelete {
          min-width: 64px;
          min-height: 36px;
          padding: 8px 12px;
        }
        .tStartStop { font-weight:800; }
        /* Prevent layout shift while running by keeping cells stable */
        #tenderList b { display:inline-block; min-width: 40px; text-align:right; }
      `;
      document.head.appendChild(s);
    }
  }

  // ==== utils =====================================================================
  #runningDelta(t){ return Math.max(0, Math.floor((Date.now() - t.startTs)/1000)); }
  #fmtTime(sec){
    sec = Math.max(0, Math.floor(sec||0));
    const m = Math.floor(sec/60), s = sec%60;
    return m+'m '+(s<10?'0':'')+s+'s';
  }

  // While running we DO NOT compute/display GPM; only after Stop (completed trip)
  #gpmForTenderStopped(t){
    const seconds = t.sec; // completed trip time only
    if(seconds <= 0) return 0;
    const minutes = seconds / 60;
    return t.eff / minutes; // gal/min
  }

  #fmt1(n){ return Math.round(n*10)/10; }
  #esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
}
