// /js/view.practice.js
// FireOps Scene Trainer — JSON-driven scenario mode
// Loads scenario files from /scenarios/scenario-index.json (or built-in fallback).

const VERSION = '20260426-scenarios';
const DEFAULT_TOLERANCE = 5;

const FIELD_DEFS = [
  { key: 'frictionLoss', label: 'Friction Loss', short: 'FL', unit: 'psi', aliases: ['frictionLoss','totalFrictionLoss','fl','hoseFrictionLoss','frictionLossPsi'] },
  { key: 'nozzlePressure', label: 'Nozzle Pressure', short: 'NP', unit: 'psi', aliases: ['nozzlePressure','nozzlePressurePsi','np','nozzlePsi'] },
  { key: 'elevationPressure', label: 'Elevation / Grade', short: 'Elev', unit: 'psi', aliases: ['elevationPressure','elevationPressurePsi','elevationPsi','elevationLoss','elevPsi'] },
  { key: 'applianceLoss', label: 'Appliance Loss', short: 'Appliance', unit: 'psi', aliases: ['applianceLoss','applianceLossPsi','appliancePsi','wyeLoss','masterStreamApplianceLoss'] },
  { key: 'totalGpm', label: 'Total Flow', short: 'GPM', unit: 'gpm', aliases: ['totalGpm','totalGPM','flow','totalFlow','totalFlowGpm','gpm'] },
  { key: 'pumpPressure', label: 'Pump Pressure', short: 'PP', unit: 'psi', aliases: ['pumpPressure','pumpPressurePsi','pdp','PDP','pp','correctPumpPressure','correctPumpPressureAnswer','answer','answerPsi'] },
];

function injectStyle(root, cssText) {
  const s = document.createElement('style');
  s.textContent = cssText;
  root.appendChild(s);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function cleanKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function flattenValues(obj, out = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const ck = cleanKey(k);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenValues(v, out);
    } else {
      if (!(ck in out)) out[ck] = v;
    }
  }
  return out;
}

function findFirstValue(raw, aliases) {
  const buckets = [
    raw?.answers,
    raw?.expectedAnswers,
    raw?.answerKey,
    raw?.solution,
    raw?.math,
    raw?.pumpMath,
    raw?.calculation,
    raw?.correct,
    raw,
  ].filter(Boolean);

  for (const bucket of buckets) {
    const flat = flattenValues(bucket);
    for (const alias of aliases) {
      const key = cleanKey(alias);
      if (Object.prototype.hasOwnProperty.call(flat, key)) return flat[key];
    }
  }
  return null;
}

function normalizeScenario(raw, sourceUrl = '') {
  const answers = {};
  for (const field of FIELD_DEFS) {
    answers[field.key] = toNumber(findFirstValue(raw, field.aliases));
  }

  // If PP was not explicitly provided, calculate it from the pressure components when possible.
  if (answers.pumpPressure == null) {
    const components = [answers.frictionLoss, answers.nozzlePressure, answers.elevationPressure, answers.applianceLoss];
    if (components.every(v => v != null)) {
      answers.pumpPressure = Math.round(components.reduce((a, b) => a + b, 0));
    }
  }

  const imageRaw = raw.image || raw.imagePath || raw.artwork || raw.artworkFile || raw.photo || raw.photoPath || raw.visual;
  const imagePath = typeof imageRaw === 'string' ? imageRaw : (imageRaw?.src || imageRaw?.path || imageRaw?.url || '');
  let resolvedImage = '';
  if (imagePath) {
    try { resolvedImage = new URL(imagePath, sourceUrl || window.location.href).href; }
    catch { resolvedImage = imagePath; }
  }

  const title = raw.title || raw.scenarioTitle || raw.name || raw.id || 'Pump Scenario';
  const prompt = raw.studentQuestion || raw.studentFacingQuestion || raw.question || raw.prompt || raw.task || 'Calculate the correct pump pressure for this setup.';
  const scene = raw.scene || raw.scenario || raw.dispatch || raw.description || raw.setup || '';
  const type = raw.type || raw.category || raw.topic || 'scenario';

  const details = Array.isArray(raw.details) ? raw.details
    : Array.isArray(raw.givens) ? raw.givens
    : Array.isArray(raw.lineSetup) ? raw.lineSetup
    : buildDetails(raw, answers);

  const variations = Array.isArray(raw.variations) ? raw.variations
    : Array.isArray(raw.scenarioVariations) ? raw.scenarioVariations
    : [];

  return {
    raw,
    id: raw.id || raw.scenarioId || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title,
    type,
    chip: raw.chip || raw.level || String(type).toUpperCase(),
    prompt,
    scene,
    details,
    image: resolvedImage,
    answers,
    tolerancePsi: toNumber(raw.tolerancePsi || raw.tolerance || raw.defaults?.tolerancePsi) || DEFAULT_TOLERANCE,
    instructorExplanation: raw.instructorExplanation || raw.explanation || raw.mathExplanation || raw.revealLead || '',
    explainMistake: raw.explainMistake || raw.commonMistakes || raw.mistakeFeedback || '',
    variations,
  };
}

function buildDetails(raw, answers) {
  const lines = [];
  const source = raw.given || raw.givens || raw.hoseSetup || raw.layout || raw.lineSummary || null;
  if (typeof source === 'string') lines.push(source);
  if (source && typeof source === 'object') {
    for (const [k, v] of Object.entries(source)) {
      if (v == null || typeof v === 'function') continue;
      lines.push(`${labelize(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  }
  if (answers.totalGpm != null) lines.push(`Total flow: ${Math.round(answers.totalGpm)} gpm`);
  if (answers.nozzlePressure != null) lines.push(`Nozzle pressure: ${Math.round(answers.nozzlePressure)} psi`);
  if (answers.frictionLoss != null) lines.push(`Friction loss: ${Math.round(answers.frictionLoss)} psi`);
  if (answers.elevationPressure != null) lines.push(`Elevation/grade: ${Math.round(answers.elevationPressure)} psi`);
  if (answers.applianceLoss != null) lines.push(`Appliance loss: ${Math.round(answers.applianceLoss)} psi`);
  return lines;
}

function labelize(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function fallbackScenarios() {
  return [
    normalizeScenario({
      id: 'fallback-single-line',
      title: 'Single 1¾″ Attack Line',
      type: 'single-line',
      chip: 'SINGLE LINE',
      image: '',
      scene: 'Engine 181 is pumping a single 1¾″ handline to the Alpha side.',
      question: 'Calculate the pump pressure for the attack line.',
      details: ['200′ of 1¾″ hose', '185 gpm fog nozzle @ 50 psi', 'No elevation change', 'No appliance loss'],
      answers: { frictionLoss: 106, nozzlePressure: 50, elevationPressure: 0, applianceLoss: 0, totalGpm: 185, pumpPressure: 156 },
      instructorExplanation: 'FL = 15.5 × (185/100)² × 2 = 106 psi. PP = FL 106 + NP 50 = 156 psi.',
      explainMistake: 'Most misses on this scenario come from forgetting to add nozzle pressure after calculating friction loss.'
    }, window.location.href)
  ];
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.json();
}

async function loadScenarioPack() {
  const candidates = [
    new URL('../scenarios/scenario-index.json', import.meta.url),
    new URL('../scenarios/index.json', import.meta.url),
    new URL('../practice/scenario-index.json', import.meta.url),
  ];

  let lastError = null;
  for (const manifestUrl of candidates) {
    try {
      const manifest = await fetchJson(manifestUrl.href + `?v=${encodeURIComponent(VERSION)}`);
      const entries = manifest.scenarios || manifest.files || manifest.items || [];
      const scenarios = [];

      for (const entry of entries) {
        try {
          if (typeof entry === 'string') {
            const scenarioUrl = new URL(entry, manifestUrl.href);
            const raw = await fetchJson(scenarioUrl.href + `?v=${encodeURIComponent(VERSION)}`);
            scenarios.push(normalizeScenario({ ...raw, __sourceFile: entry }, scenarioUrl.href));
          } else if (entry && typeof entry === 'object' && (entry.file || entry.path || entry.src)) {
            const scenarioUrl = new URL(entry.file || entry.path || entry.src, manifestUrl.href);
            const raw = await fetchJson(scenarioUrl.href + `?v=${encodeURIComponent(VERSION)}`);
            scenarios.push(normalizeScenario({ ...entry, ...raw }, scenarioUrl.href));
          } else if (entry && typeof entry === 'object') {
            scenarios.push(normalizeScenario(entry, manifestUrl.href));
          }
        } catch (err) {
          console.warn('Scenario file failed to load:', entry, err);
        }
      }

      if (scenarios.length) {
        return {
          title: manifest.title || 'FireOps Scenario Pack',
          packId: manifest.packId || 'scenario-pack',
          source: manifestUrl.href,
          scenarios,
          error: null,
        };
      }
      lastError = new Error('Manifest loaded but did not contain scenarios.');
    } catch (err) {
      lastError = err;
    }
  }

  return {
    title: 'Built-in fallback scenario',
    packId: 'fallback',
    source: 'fallback',
    scenarios: fallbackScenarios(),
    error: lastError,
  };
}

function renderFallbackArt(scenario) {
  return `
    <div class="scenario-fallback-art" role="img" aria-label="Scenario diagram placeholder">
      <div class="fallback-sky"></div>
      <div class="fallback-house">Structure</div>
      <div class="fallback-engine">E-181</div>
      <div class="fallback-hose"></div>
      <div class="fallback-label">${escapeHtml(scenario.chip || 'SCENARIO')}</div>
    </div>
  `;
}

function renderDetails(details) {
  if (!details || !details.length) return '';
  return `<ul class="scenario-detail-list">${details.map(d => `<li>${escapeHtml(typeof d === 'string' ? d : JSON.stringify(d))}</li>`).join('')}</ul>`;
}

function answerLine(field, correct, entered, ok, tolerance) {
  if (correct == null) return '';
  const enteredText = entered == null ? 'blank' : Math.round(entered * 10) / 10;
  const correctText = Math.round(correct * 10) / 10;
  return `<div class="answer-row ${ok ? 'ok' : 'bad'}"><span>${field.short}</span><b>${enteredText}</b><em>Correct: ${correctText} ${field.unit}${field.unit === 'psi' ? ` ±${tolerance}` : ''}</em></div>`;
}

function inferMistake(scenario, enteredPP) {
  const a = scenario.answers;
  if (enteredPP == null || a.pumpPressure == null) return '';
  const tol = scenario.tolerancePsi;
  const checks = [
    ['nozzle pressure', a.nozzlePressure],
    ['friction loss', a.frictionLoss],
    ['elevation/grade pressure', a.elevationPressure],
    ['appliance loss', a.applianceLoss],
  ].filter(([, v]) => v != null && Math.abs(v) > 0.1);

  for (const [name, value] of checks) {
    if (Math.abs(enteredPP - (a.pumpPressure - value)) <= tol) {
      return `Your pump pressure is close to the correct answer minus the ${name}. Recheck that component and add it into the final PP.`;
    }
  }

  if (a.frictionLoss != null && a.nozzlePressure != null) {
    const npOnly = a.nozzlePressure + (a.elevationPressure || 0) + (a.applianceLoss || 0);
    if (Math.abs(enteredPP - npOnly) <= tol) return 'It looks like the friction loss may have been left out. FL has to be added before final PP.';
  }

  return 'Rebuild the answer as PP = FL + NP ± elevation + appliance loss. Check each box, then add only the needed pressure components.';
}

function renderExplanation(scenario) {
  const a = scenario.answers;
  const parts = [];
  if (a.frictionLoss != null) parts.push(`FL ${Math.round(a.frictionLoss)} psi`);
  if (a.nozzlePressure != null) parts.push(`NP ${Math.round(a.nozzlePressure)} psi`);
  if (a.elevationPressure != null) parts.push(`Elevation ${Math.round(a.elevationPressure)} psi`);
  if (a.applianceLoss != null) parts.push(`Appliance ${Math.round(a.applianceLoss)} psi`);

  return `
    <div class="explain-box">
      <h4>Answer Breakdown</h4>
      <div class="formula">PP = FL + NP ± elevation + appliance loss</div>
      ${parts.length ? `<div class="formula-detail">${escapeHtml(parts.join(' + '))} = <b>${Math.round(a.pumpPressure ?? 0)} psi</b></div>` : ''}
      ${a.totalGpm != null ? `<div class="formula-detail">Total flow: <b>${Math.round(a.totalGpm)} gpm</b></div>` : ''}
      ${scenario.instructorExplanation ? `<p>${escapeHtml(scenario.instructorExplanation)}</p>` : ''}
    </div>
  `;
}

function renderVariations(scenario) {
  if (!scenario.variations?.length) return '';
  return `
    <details class="variation-box">
      <summary>Scenario Variations</summary>
      <div class="variation-list">
        ${scenario.variations.map((v, i) => {
          if (typeof v === 'string') return `<div><b>${i + 1}.</b> ${escapeHtml(v)}</div>`;
          const title = v.title || v.name || `Variation ${i + 1}`;
          const text = v.description || v.change || v.prompt || JSON.stringify(v);
          return `<div><b>${escapeHtml(title)}:</b> ${escapeHtml(text)}</div>`;
        }).join('')}
      </div>
    </details>
  `;
}

function renderScenarioCard(container, scenario, index, count, packTitle) {
  container.querySelector('#scenarioTitle').textContent = scenario.title;
  container.querySelector('#scenarioChip').textContent = scenario.chip || String(scenario.type).toUpperCase();
  container.querySelector('#scenarioCount').textContent = `${index + 1} of ${count}`;
  container.querySelector('#scenarioPack').textContent = packTitle;

  const media = container.querySelector('#scenarioMedia');
  if (scenario.image) {
    media.innerHTML = `<img src="${escapeHtml(scenario.image)}" alt="${escapeHtml(scenario.title)} artwork" onerror="this.closest('#scenarioMedia').innerHTML = ''">`;
    // If image fails, fill on next tick with fallback.
    setTimeout(() => { if (!media.innerHTML.trim()) media.innerHTML = renderFallbackArt(scenario); }, 100);
  } else {
    media.innerHTML = renderFallbackArt(scenario);
  }

  container.querySelector('#scenarioPrompt').innerHTML = `
    ${scenario.scene ? `<p class="scene-text">${escapeHtml(scenario.scene)}</p>` : ''}
    <p class="question-text">${escapeHtml(scenario.prompt)}</p>
    ${renderDetails(scenario.details)}
  `;

  const fields = container.querySelector('#answerFields');
  fields.innerHTML = FIELD_DEFS.map(field => `
    <label class="answer-field" for="ans_${field.key}">
      <span>${field.short}</span>
      <small>${field.label}</small>
      <input id="ans_${field.key}" inputmode="decimal" type="number" step="any" placeholder="${field.unit}" data-answer-key="${field.key}">
    </label>
  `).join('');

  container.querySelector('#scenarioFeedback').innerHTML = '';
  container.querySelector('#scenarioExtra').innerHTML = renderVariations(scenario);
}

function readInputs(container) {
  const values = {};
  for (const field of FIELD_DEFS) {
    const input = container.querySelector(`[data-answer-key="${field.key}"]`);
    values[field.key] = toNumber(input?.value);
  }
  return values;
}

function gradeScenario(container, scenario, revealOnly = false) {
  const entered = readInputs(container);
  const tol = scenario.tolerancePsi;
  let scored = 0;
  let correct = 0;
  const rows = [];

  for (const field of FIELD_DEFS) {
    const expected = scenario.answers[field.key];
    if (expected == null) continue;
    scored++;
    const val = entered[field.key];
    const fieldTol = field.unit === 'psi' ? tol : Math.max(1, tol);
    const ok = val != null && Math.abs(val - expected) <= fieldTol;
    if (ok) correct++;
    rows.push(answerLine(field, expected, val, ok, tol));
  }

  const allOk = scored > 0 && correct === scored;
  const ppOk = scenario.answers.pumpPressure == null || (entered.pumpPressure != null && Math.abs(entered.pumpPressure - scenario.answers.pumpPressure) <= tol);
  const statusClass = revealOnly ? 'neutral' : (allOk ? 'ok' : 'bad');
  const mistake = !revealOnly && !ppOk
    ? (scenario.explainMistake ? `${scenario.explainMistake}\n\n${inferMistake(scenario, entered.pumpPressure)}` : inferMistake(scenario, entered.pumpPressure))
    : '';

  container.querySelector('#scenarioFeedback').innerHTML = `
    <div class="result-card ${statusClass}">
      <h3>${revealOnly ? 'Answer Key' : (allOk ? 'Correct' : 'Needs Review')}</h3>
      ${!revealOnly ? `<div class="score-line">${correct}/${scored} fields within tolerance</div>` : ''}
      <div class="answer-grid">${rows.join('')}</div>
      ${mistake ? `<div class="mistake-box"><b>Explain Mistake</b><p>${escapeHtml(mistake)}</p></div>` : ''}
      ${renderExplanation(scenario)}
    </div>
  `;
}

export async function render(container) {
  if (!container) return;
  container.innerHTML = `
    <section class="scenario-shell card">
      <div class="scenario-top">
        <div>
          <div class="scenario-kicker">FireOps Scene Trainer</div>
          <h2 id="scenarioTitle">Loading scenarios…</h2>
          <div class="scenario-meta"><span id="scenarioChip">SCENARIO</span><span id="scenarioCount">—</span></div>
        </div>
        <button class="btn primary" id="nextScenarioBtn" type="button">Next</button>
      </div>

      <div id="scenarioPack" class="pack-line">Loading scenario pack…</div>
      <div id="scenarioMedia" class="scenario-media"></div>
      <div id="scenarioPrompt" class="scenario-prompt"></div>

      <div class="answer-panel">
        <h3>Student Answer</h3>
        <div id="answerFields" class="answer-fields"></div>
        <div class="scenario-actions">
          <button class="btn primary" id="checkScenarioBtn" type="button">Submit Answer</button>
          <button class="btn" id="showScenarioAnswerBtn" type="button">Show Answer</button>
        </div>
      </div>

      <div id="scenarioFeedback"></div>
      <div id="scenarioExtra"></div>
    </section>
  `;

  injectStyle(container, `
    .scenario-shell{display:grid;gap:12px;padding:12px;background:#07111e;border-color:#18304c;}
    .scenario-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
    .scenario-kicker{font-size:12px;color:#8cc8ff;text-transform:uppercase;letter-spacing:.08em;font-weight:800;}
    #scenarioTitle{margin:2px 0 6px;font-size:22px;line-height:1.1;}
    .scenario-meta{display:flex;gap:8px;flex-wrap:wrap;}
    .scenario-meta span,.pack-line{border:1px solid #264264;background:#091829;border-radius:999px;padding:4px 8px;color:#d9ebff;font-size:12px;}
    .pack-line{border-radius:10px;color:#bcd8f3;}
    .scenario-media{min-height:260px;border:1px solid #1e3554;border-radius:16px;overflow:hidden;background:#02060d;display:grid;place-items:center;}
    .scenario-media img{width:100%;height:auto;display:block;max-height:520px;object-fit:contain;background:#02060d;}
    .scenario-fallback-art{position:relative;width:100%;height:330px;background:linear-gradient(#11253c 0 45%,#122016 45% 100%);overflow:hidden;}
    .fallback-house{position:absolute;left:51%;top:54px;transform:translateX(-50%);width:150px;height:100px;border:2px solid #6f819b;background:#263348;border-radius:8px;display:grid;place-items:center;color:#eaf3ff;font-weight:800;}
    .fallback-house:before{content:"";position:absolute;left:15px;right:15px;top:-38px;height:72px;background:#1b2638;transform:skewY(-18deg);border:2px solid #6f819b;border-bottom:0;}
    .fallback-engine{position:absolute;left:20px;bottom:32px;width:116px;height:62px;border-radius:8px;background:#a51e22;border:2px solid #ffd6d6;display:grid;place-items:center;color:white;font-weight:900;box-shadow:0 14px 24px rgba(0,0,0,.5);}
    .fallback-hose{position:absolute;left:130px;bottom:64px;width:56%;height:10px;border-radius:999px;background:#d13b3b;transform:rotate(-17deg);transform-origin:left center;box-shadow:0 0 0 2px rgba(255,255,255,.16);}
    .fallback-label{position:absolute;right:14px;bottom:14px;padding:6px 9px;border-radius:999px;background:#06101e;border:1px solid #46b0ff;color:#eaf6ff;font-size:12px;font-weight:800;}
    .scenario-prompt{background:#091624;border:1px solid #1e3554;border-radius:14px;padding:12px;}
    .scene-text{margin:0 0 8px;color:#d3e7ff;line-height:1.35;}
    .question-text{margin:0;color:#fff;font-weight:800;line-height:1.35;}
    .scenario-detail-list{margin:10px 0 0 18px;padding:0;color:#cae0f7;line-height:1.45;}
    .answer-panel{background:#050c16;border:1px solid #18304c;border-radius:14px;padding:12px;}
    .answer-panel h3{margin:0 0 10px;font-size:16px;}
    .answer-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
    .answer-field{display:grid;grid-template-columns:1fr;gap:3px;background:#0a1728;border:1px solid #203956;border-radius:12px;padding:9px;}
    .answer-field span{font-weight:900;color:#fff;font-size:14px;}
    .answer-field small{color:#9ebbd8;font-size:11px;}
    .answer-field input{width:100%;font-size:18px;padding:8px;border-radius:10px;border:1px solid #2b4669;background:#02060d;color:#fff;}
    .scenario-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}
    .scenario-actions .btn{flex:1;min-height:42px;}
    .result-card{border-radius:14px;border:1px solid #27415f;background:#071321;padding:12px;}
    .result-card h3{margin:0 0 6px;}
    .result-card.ok{border-color:#3f9964;background:#07190f;}
    .result-card.bad{border-color:#b76262;background:#1d0c0c;}
    .score-line{color:#dbeaff;margin-bottom:8px;font-size:13px;}
    .answer-grid{display:grid;gap:6px;}
    .answer-row{display:grid;grid-template-columns:70px 1fr 1.5fr;gap:8px;align-items:center;background:#06101c;border:1px solid #1e3554;border-radius:10px;padding:7px;font-size:13px;}
    .answer-row.ok{border-color:#39794f;}
    .answer-row.bad{border-color:#924848;}
    .answer-row span{font-weight:900;}.answer-row em{font-style:normal;color:#b9cde2;}
    .mistake-box,.explain-box,.variation-box{margin-top:10px;border:1px solid #263f5f;background:#06101c;border-radius:12px;padding:10px;}
    .mistake-box b{color:#ffd48a;}.mistake-box p,.explain-box p{white-space:pre-line;margin:6px 0 0;line-height:1.4;color:#e9f2ff;}
    .explain-box h4{margin:0 0 6px;}.formula{font-weight:900;color:#fff;}.formula-detail{margin-top:4px;color:#d7eaff;}
    .variation-box summary{font-weight:900;cursor:pointer;}.variation-list{display:grid;gap:6px;margin-top:8px;color:#d7eaff;}
    @media (max-width:520px){.answer-fields{grid-template-columns:1fr;}.scenario-media{min-height:220px}.scenario-fallback-art{height:280px}.answer-row{grid-template-columns:54px 1fr;}.answer-row em{grid-column:1 / -1;}}
  `);

  let disposed = false;
  const pack = await loadScenarioPack();
  if (disposed) return;

  let scenarios = pack.scenarios;
  let idx = 0;

  if (pack.error && pack.source === 'fallback') {
    const warn = document.createElement('div');
    warn.className = 'status';
    warn.style.cssText = 'color:#ffd48a;font-size:12px;line-height:1.35;';
    warn.textContent = `Scenario JSON pack was not found, so a fallback scenario loaded. Add files to scenarios/scenario-index.json. Last error: ${pack.error.message || pack.error}`;
    container.querySelector('.scenario-shell').prepend(warn);
  }

  function show(i) {
    idx = ((i % scenarios.length) + scenarios.length) % scenarios.length;
    renderScenarioCard(container, scenarios[idx], idx, scenarios.length, pack.title);
  }

  container.querySelector('#nextScenarioBtn').addEventListener('click', () => show(idx + 1));
  container.querySelector('#checkScenarioBtn').addEventListener('click', () => gradeScenario(container, scenarios[idx], false));
  container.querySelector('#showScenarioAnswerBtn').addEventListener('click', () => gradeScenario(container, scenarios[idx], true));

  show(0);

  return {
    dispose() { disposed = true; }
  };
}
