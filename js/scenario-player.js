(function(){
  const state = { scenarios: [], selected: 0 };
  const paths = {
    index: 'scenarios/scenario-index.json',
    scenarioDir: 'scenarios/',
    imageDir: 'images/scenarios/'
  };
  const $ = (id) => document.getElementById(id);
  const safe = (v, fallback='') => (v === undefined || v === null ? fallback : v);
  const normalizeScenario = (s) => {
    const answers = s.answers || {};
    return {
      id: s.id || s.file || `scenario-${Math.random().toString(16).slice(2)}`,
      title: s.title || 'Untitled Scenario',
      difficulty: s.difficulty || (s.chip || '').split('•')[0]?.trim() || 'practice',
      category: s.category || s.type || 'pump',
      chip: s.chip || `${safe(s.difficulty,'PRACTICE').toString().toUpperCase()} • ${safe(s.category || s.type,'PUMP').toString().toUpperCase()}`,
      image: s.image || '',
      scene: s.scene || '',
      question: s.studentQuestion || s.question || 'Calculate the pump pressure for this setup.',
      details: Array.isArray(s.details) ? s.details : detailsFromSceneElements(s.sceneElements),
      overlays: Array.isArray(s.overlays) ? s.overlays : [],
      correctPP: Number(s.correctPP ?? answers.pumpPressure ?? 0),
      tolerance: Number(s.tolerance ?? answers.tolerance ?? 5),
      answers,
      formulaBreakdown: Array.isArray(s.formulaBreakdown) ? s.formulaBreakdown : explanationToFormula(s.instructorExplanation),
      instructorExplanation: s.instructorExplanation || '',
      explainMistake: s.explainMistake || '',
      variations: s.variations || []
    };
  };
  function detailsFromSceneElements(sceneElements){
    if(!sceneElements) return [];
    const out=[];
    (sceneElements.hoses||[]).forEach(h=>out.push(`${safe(h.length)} of ${safe(h.diameter)} hose • ${safe(h.flowGpm)} gpm`));
    (sceneElements.nozzles||[]).forEach(n=>out.push(`${safe(n.type,'Nozzle')} ${safe(n.flowGpm)} gpm @ ${safe(n.nozzlePressure)} psi`));
    if(sceneElements.elevation) out.push(`Elevation: ${sceneElements.elevation}`);
    return out.filter(Boolean);
  }
  function explanationToFormula(text){ return text ? [text] : []; }
  async function fetchJson(url){ const r = await fetch(url, {cache:'no-store'}); if(!r.ok) throw new Error(`${url} not found`); return r.json(); }
  async function load(){
    try{
      const index = await fetchJson(paths.index);
      const raw = Array.isArray(index) ? index : (index.scenarios || []);
      const scenarios=[];
      for(const item of raw){
        if(item.file){
          try{ scenarios.push(await fetchJson(paths.scenarioDir + item.file)); }
          catch(e){ console.warn('Scenario file missing:', item.file, e); }
        } else { scenarios.push(item); }
      }
      state.scenarios = scenarios.map(normalizeScenario).filter(s => s.correctPP || s.question);
      if(!state.scenarios.length) throw new Error('No valid scenarios loaded.');
      const params = new URLSearchParams(location.search);
      const requested = params.get('id');
      const idx = requested ? state.scenarios.findIndex(s=>s.id===requested) : 0;
      state.selected = idx >= 0 ? idx : 0;
      renderList(); renderScenario();
    } catch(err){
      $('app').innerHTML = `<div class="error"><strong>Scenario files not found.</strong><br>${err.message}<br><br>Required: <code>/scenarios/scenario-index.json</code>, scenario JSON files, <code>/images/scenarios/</code> images, and <code>/js/scenario-player.js</code>.</div>`;
    }
  }
  function renderList(){
    $('scenarioButtons').innerHTML = state.scenarios.map((s,i)=>`<button class="scenario-option ${i===state.selected?'active':''}" data-i="${i}"><div class="scenario-title">${s.title}</div><div class="scenario-meta">${s.chip}</div></button>`).join('');
    document.querySelectorAll('.scenario-option').forEach(b=>b.addEventListener('click',()=>{state.selected=Number(b.dataset.i); renderList(); renderScenario();}));
  }
  function renderScenario(){
    const s = state.scenarios[state.selected];
    const imageUrl = s.image ? paths.imageDir + s.image : '';
    $('sceneMedia').innerHTML = imageUrl ? `<img src="${imageUrl}" alt="${s.title}" onerror="this.outerHTML='<div class=&quot;error&quot;>Image missing: ${imageUrl}</div>'">${renderOverlays(s.overlays)}` : '<div class="error">No image set for this scenario.</div>';
    $('scenarioPanel').innerHTML = `<div class="chip">${s.chip}</div><h2>${s.title}</h2>${s.scene?`<p style="color:#aab3c0;line-height:1.45">${s.scene}</p>`:''}<div class="question">${s.question}</div><div class="details">${s.details.map(d=>`<div class="detail">${d}</div>`).join('')}</div><label for="ppInput" style="font-weight:900">Your pump pressure answer</label><div class="answer-row"><input id="ppInput" type="number" inputmode="numeric" placeholder="Enter PSI"><button id="checkBtn" class="btn">Check</button></div><div class="controls"><button id="showAnswerBtn" class="btn secondary">Show Answer</button><button id="nextBtn" class="btn ghost">Next Scenario</button></div><div id="result" class="result"></div>`;
    $('checkBtn').addEventListener('click', checkAnswer);
    $('showAnswerBtn').addEventListener('click', ()=>showResult(false,true));
    $('nextBtn').addEventListener('click', ()=>{state.selected=(state.selected+1)%state.scenarios.length; renderList(); renderScenario();});
    $('ppInput').addEventListener('keydown', e=>{if(e.key==='Enter') checkAnswer();});
  }
  function renderOverlays(overlays){ return overlays.map(o=>`<div class="overlay-label" style="--x:${Number(o.x)||50}%;--y:${Number(o.y)||50}%">${o.text || o.label || ''}</div>`).join(''); }
  function checkAnswer(){ showResult(true,false); }
  function showResult(fromInput, forceShow){
    const s = state.scenarios[state.selected];
    const input = $('ppInput');
    const val = Number(input.value);
    const answered = Number.isFinite(val) && input.value !== '';
    const correct = answered && Math.abs(val - s.correctPP) <= s.tolerance;
    const r = $('result');
    r.className = `result show ${correct ? 'good' : 'bad'}`;
    const header = forceShow ? `Correct pump pressure: ${s.correctPP} PSI` : (correct ? `Correct — ${s.correctPP} PSI` : `Not quite. Correct answer: ${s.correctPP} PSI`);
    const userLine = answered && !forceShow ? `<p>Your answer: <strong>${val} PSI</strong> • tolerance ±${s.tolerance} PSI</p>` : '';
    r.innerHTML = `<h3>${header}</h3>${userLine}${s.explainMistake && !correct && !forceShow ? `<p><strong>Common mistake:</strong> ${s.explainMistake}</p>` : ''}${s.instructorExplanation ? `<p>${s.instructorExplanation}</p>` : ''}<div class="math">${s.formulaBreakdown.map(line=>`<div>${line}</div>`).join('')}</div>${renderVariations(s.variations)}`;
  }
  function renderVariations(vars){
    if(!Array.isArray(vars) || !vars.length) return '';
    return `<h3 style="margin-top:14px">Variations</h3><div class="math">${vars.map(v=>`<div>${typeof v==='string' ? v : `${v.change} <strong>${v.correctPP ? `Answer: ${v.correctPP} PSI` : ''}</strong>`}</div>`).join('')}</div>`;
  }
  load();
})();
