import { scenarios } from './scenarios.js';

const $ = (id) => document.getElementById(id);
let index = Math.floor(Math.random() * scenarios.length);
let lastIndex = index;
let showOverlayLabels = false;

const INPUTS = [
  { id:'answerFL', key:'frictionLoss', label:'Friction Loss', unit:'PSI' },
  { id:'answerNP', key:'nozzlePressure', label:'Nozzle Pressure', unit:'PSI' },
  { id:'answerElevation', key:'elevation', label:'Elevation', unit:'PSI' },
  { id:'answerAppliance', key:'applianceLoss', label:'Appliance Loss', unit:'PSI' },
  { id:'answerGPM', key:'totalGpm', label:'Total GPM', unit:'GPM' },
  { id:'answerPump', key:'pumpPressure', label:'Pump Pressure', unit:'PSI' }
];

function escapeHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
}

function getAnswers(s){
  return s.answers || {
    frictionLoss: 0,
    nozzlePressure: 0,
    elevation: 0,
    applianceLoss: 0,
    totalGpm: 0,
    pumpPressure: Number(s.correctPP || 0),
    tolerance: Number(s.tolerance || 5)
  };
}

function imageSrc(s){
  if (!s.image) return '';
  if (s.image.includes('/') || s.image.startsWith('http')) return s.image;
  return `./images/scenarios/${s.image}`;
}

function renderOverlayLayer(s){
  const overlays = Array.isArray(s.overlays) ? s.overlays : [];
  if (!overlays.length) return '<div class="overlay-layer" aria-hidden="true"></div>';
  return `<div class="overlay-layer" aria-hidden="true">${overlays.map(o => {
    const x = Number.isFinite(Number(o.x)) ? `${Number(o.x)}%` : (o.left || '50%');
    const y = Number.isFinite(Number(o.y)) ? `${Number(o.y)}%` : (o.top || '50%');
    const cls = escapeHtml(o.className || o.type || o.label || '');
    return `<div class="scene-label ${cls}" style="left:${escapeHtml(x)};top:${escapeHtml(y)};">${escapeHtml(o.text || o.label || '')}</div>`;
  }).join('')}</div>`;
}

function renderFallbackArt(){
  return `<svg viewBox="0 0 520 310" role="img"><rect width="520" height="310" fill="#142333"/><rect x="285" y="56" width="190" height="160" rx="8" fill="#b9c0c6"/><rect x="82" y="186" width="112" height="54" rx="9" fill="#bf1d1d"/><path d="M194 214 C245 215 260 244 320 238 C370 233 405 213 443 196" stroke="#f2d34b" stroke-width="10" fill="none" stroke-linecap="round"/></svg>`;
}

function renderArt(s){
  const src = imageSrc(s);
  const media = src
    ? `<img class="scenario-photo" src="${escapeHtml(src)}" alt="${escapeHtml(s.title)}" loading="eager" onerror="this.remove(); this.closest('.art-stage').classList.add('image-missing')">`
    : renderFallbackArt();
  return `${media}${renderOverlayLayer(s)}`;
}

function updateOverlayToggle(){
  const stage = $('artStage');
  const btn = $('toggleLabelsBtn');
  if (!stage || !btn) return;
  stage.classList.toggle('labels-on', showOverlayLabels);
  btn.classList.toggle('is-on', showOverlayLabels);
  btn.textContent = showOverlayLabels ? 'Hide Labels' : 'Show Labels';
  btn.setAttribute('aria-pressed', showOverlayLabels ? 'true' : 'false');
}

function render(){
  const s = scenarios[index];
  $('scenarioTitle').textContent = s.title || 'Untitled Scenario';
  $('scenarioSubtitle').textContent = `${s.difficulty || ''}${s.category ? ' • ' + s.category : ''}`;
  $('scenarioTag').textContent = s.type || s.category || 'scenario';
  $('scenarioDescription').textContent = s.question || s.description || '';
  $('artStage').classList.remove('image-missing');
  $('artStage').innerHTML = renderArt(s);
  updateOverlayToggle();
  INPUTS.forEach(i => $(i.id).value = '');
  ['resultBox','mistakeBox','mathBox','variationBox'].forEach(id => { const el=$(id); if(el) el.hidden = true; });
}

function gradeField(input, correct, tolerance){
  const raw = $(input.id).value;
  const user = Number(raw);
  if (raw === '' || !Number.isFinite(user)) return { ...input, status:'missing', user:null, correct };
  const ok = Math.abs(user - Number(correct)) <= tolerance;
  return { ...input, status: ok ? 'good' : 'bad', user, correct };
}

function submit(){
  const s = scenarios[index];
  const answers = getAnswers(s);
  const tolerance = Number(answers.tolerance || s.tolerance || 5);
  const results = INPUTS.map(i => gradeField(i, answers[i.key], tolerance));
  const box = $('resultBox');
  box.hidden = false;

  const missing = results.filter(r => r.status === 'missing');
  if (missing.length) {
    box.className = 'result-box bad';
    box.innerHTML = `<strong>Complete all answer fields.</strong><br>Missing: ${missing.map(m => escapeHtml(m.label)).join(', ')}`;
    return;
  }

  const wrong = results.filter(r => r.status === 'bad');
  box.className = wrong.length ? 'result-box bad' : 'result-box good';
  box.innerHTML = `
    <strong>${wrong.length ? 'Review your numbers.' : 'Correct.'}</strong>
    <div class="grade-list">
      ${results.map(r => `<div class="grade-row ${r.status}"><span>${escapeHtml(r.label)}</span><span>Your: ${r.user} ${r.unit}</span><span>Correct: ${r.correct} ${r.unit}</span></div>`).join('')}
    </div>
    <div class="tolerance-note">Tolerance: ±${tolerance}</div>
  `;

  if (wrong.length) renderMistakes(s, wrong);
}

function renderMistakes(s, wrong){
  const box = $('mistakeBox');
  box.hidden = false;
  const defaultMistakes = [];
  if (wrong.some(w => w.key === 'frictionLoss')) defaultMistakes.push('Check hose length, hose size C value, and GPM squared.');
  if (wrong.some(w => w.key === 'nozzlePressure')) defaultMistakes.push('Check the nozzle type and rated nozzle pressure.');
  if (wrong.some(w => w.key === 'elevation')) defaultMistakes.push('Check elevation. Use about 5 PSI per floor unless the scenario says otherwise.');
  if (wrong.some(w => w.key === 'applianceLoss')) defaultMistakes.push('Check for appliances such as wyes, monitors, standpipe/FDC, or master stream devices.');
  if (wrong.some(w => w.key === 'totalGpm')) defaultMistakes.push('Check total flow. Wye and master stream scenarios may combine multiple lines.');
  if (wrong.some(w => w.key === 'pumpPressure')) defaultMistakes.push('Pump pressure should combine FL + NP ± elevation + appliance loss.');
  const mistakes = s.explainMistake || s.mistakes || defaultMistakes;
  box.innerHTML = `<strong>Explain Mistake</strong><ul>${mistakes.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
}

function explain(){
  const s = scenarios[index];
  const steps = Array.isArray(s.formulaBreakdown) ? s.formulaBreakdown : [];
  const box = $('mathBox');
  box.hidden = false;
  box.innerHTML = `<strong>Math Breakdown</strong>${steps.length ? `<ol>${steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>` : '<p>No math breakdown provided.</p>'}`;

  const vBox = $('variationBox');
  if (Array.isArray(s.variations) && s.variations.length) {
    vBox.hidden = false;
    vBox.innerHTML = `<strong>Scenario Variations</strong><ul>${s.variations.map(v => `<li>${escapeHtml(v.change)} <b>New PP: ${escapeHtml(v.correctPP)} PSI</b></li>`).join('')}</ul>`;
  }
}

function pickRandomScenario(){
  if (scenarios.length <= 1) return 0;
  let nextIndex = Math.floor(Math.random() * scenarios.length);
  while (nextIndex === lastIndex) nextIndex = Math.floor(Math.random() * scenarios.length);
  lastIndex = nextIndex;
  return nextIndex;
}

$('submitBtn').addEventListener('click', submit);
$('explainBtn').addEventListener('click', explain);
$('nextBtn').addEventListener('click', () => { index = pickRandomScenario(); render(); });
$('toggleLabelsBtn')?.addEventListener('click', () => { showOverlayLabels = !showOverlayLabels; updateOverlayToggle(); });

render();
