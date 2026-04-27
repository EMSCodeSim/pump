// /js/view.practice.js
// FireOps Scene Trainer — JSON-driven random scenario mode
// - Loads scenarios from /scenarios/scenario-index.json
// - Uses overlay coordinates from JSON on top of the image
// - Displays scenes randomly
// - Randomly picks a variation for the same base photo when available
// - Removes the old visible variations list
// - Adds an Explain Math button

const VERSION = '20260427-random-scenarios-v1';
const DEFAULT_TOLERANCE = 5;

const FIELD_DEFS = [
  { key: 'frictionLoss', label: 'Friction Loss', short: 'FL', unit: 'psi', aliases: ['frictionLoss','totalFrictionLoss','fl','hoseFrictionLoss','frictionLossPsi'] },
  { key: 'nozzlePressure', label: 'Nozzle Pressure', short: 'NP', unit: 'psi', aliases: ['nozzlePressure','nozzlePressurePsi','np','nozzlePsi'] },
  { key: 'elevationPressure', label: 'Elevation / Grade', short: 'Elev', unit: 'psi', aliases: ['elevationPressure','elevationPressurePsi','elevationPsi','elevationLoss','elevPsi','elevation'] },
  { key: 'applianceLoss', label: 'Appliance Loss', short: 'Appliance', unit: 'psi', aliases: ['applianceLoss','applianceLossPsi','appliancePsi','wyeLoss','masterStreamApplianceLoss'] },
  { key: 'totalGpm', label: 'Total Flow', short: 'GPM', unit: 'gpm', aliases: ['totalGpm','totalGPM','flow','totalFlow','totalFlowGpm','gpm'] },
  { key: 'pumpPressure', label: 'Pump Pressure', short: 'PP', unit: 'psi', aliases: ['pumpPressure','pumpPressurePsi','pdp','PDP','pp','correctPP','correctPumpPressure','correctPumpPressureAnswer','answer','answerPsi'] },
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
    } else if (!(ck in out)) {
      out[ck] = v;
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

function resolveImage(raw, sourceUrl = '') {
  const imageRaw = raw?.image || raw?.imagePath || raw?.artwork || raw?.artworkFile || raw?.photo || raw?.photoPath || raw?.visual;
  const imagePath = typeof imageRaw === 'string' ? imageRaw : (imageRaw?.src || imageRaw?.path || imageRaw?.url || '');
  if (!imagePath) return '';
  try {
    return new URL(imagePath, sourceUrl || window.location.href).href;
  } catch {
    return imagePath;
  }
}

function collectAnswers(raw) {
  const answers = {};
  for (const field of FIELD_DEFS) {
    answers[field.key] = toNumber(findFirstValue(raw, field.aliases));
  }
  if (answers.pumpPressure == null) {
    const components = [answers.frictionLoss, answers.nozzlePressure, answers.elevationPressure, answers.applianceLoss];
    if (components.every(v => v != null)) {
      answers.pumpPressure = Math.round(components.reduce((a, b) => a + b, 0));
    }
  }
  return answers;
}

function labelize(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
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
  const scene = raw.sceneElements || raw.scene_elements || null;
  if (scene && typeof scene === 'object') {
    if (scene.engine) lines.push(`Engine: ${scene.engine}`);
    if (Array.isArray(scene.hoses)) {
      for (const h of scene.hoses) {
        const bits = [h.length, h.diameter, h.flowGpm != null ? `${h.flowGpm} gpm` : '', h.cValue != null ? `C${h.cValue}` : ''].filter(Boolean);
        if (bits.length) lines.push(`Line: ${bits.join(' • ')}`);
      }
    }
    if (Array.isArray(scene.nozzles)) {
      for (const n of scene.nozzles) {
        const label = [n.type, n.tip, n.flowGpm != null ? `${n.flowGpm} gpm` : '', n.nozzlePressure != null ? `@ ${n.nozzlePressure} psi` : ''].filter(Boolean);
        if (label.length) lines.push(`Nozzle: ${label.join(' ')}`);
      }
    }
    if (scene.elevation) lines.push(`Elevation: ${scene.elevation}`);
    if (Array.isArray(scene.appliances) && scene.appliances.length) lines.push(`Appliances: ${scene.appliances.join(', ')}`);
  }
  if (answers.totalGpm != null) lines.push(`Total flow: ${Math.round(answers.totalGpm)} gpm`);
  if (answers.nozzlePressure != null) lines.push(`Nozzle pressure: ${Math.round(answers.nozzlePressure)} psi`);
  if (answers.frictionLoss != null) lines.push(`Friction loss: ${Math.round(answers.frictionLoss)} psi`);
  if (answers.elevationPressure != null) lines.push(`Elevation/grade: ${Math.round(answers.elevationPressure)} psi`);
  if (answers.applianceLoss != null) lines.push(`Appliance loss: ${Math.round(answers.applianceLoss)} psi`);
  return [...new Set(lines)];
}

function normalizeVariation(rawVariation, index, sourceUrl = '') {
  const raw = typeof rawVariation === 'string' ? { change: rawVariation } : (rawVariation || {});
  const answers = collectAnswers(raw);
  const note = raw.change || raw.description || raw.prompt || raw.question || '';
  return {
    raw,
    id: raw.id || raw.variationId || `variation-${index + 1}`,
    title: raw.title || raw.name || `Variation ${index + 1}`,
    prompt: raw.studentQuestion || raw.studentFacingQuestion || raw.question || raw.prompt || note,
    note,
    details: Array.isArray(raw.details) ? raw.details : [],
    answers,
    image: resolveImage(raw, sourceUrl),
    overlays: Array.isArray(raw.overlays) ? raw.overlays : [],
    tolerancePsi: toNumber(raw.tolerancePsi || raw.tolerance || raw.defaults?.tolerancePsi) || null,
    instructorExplanation: raw.instructorExplanation || raw.explanation || raw.mathExplanation || raw.revealLead || '',
    formulaBreakdown: Array.isArray(raw.formulaBreakdown) ? raw.formulaBreakdown : [],
    explainMistake: raw.explainMistake || raw.commonMistakes || raw.mistakeFeedback || '',
  };
}

function normalizeScenario(raw, sourceUrl = '') {
  const answers = collectAnswers(raw);
  const title = raw.title || raw.scenarioTitle || raw.name || raw.id || 'Pump Scenario';
  const prompt = raw.studentQuestion || raw.studentFacingQuestion || raw.question || raw.prompt || raw.task || 'Calculate the correct pump pressure for this setup.';
  const scene = raw.scene || raw.scenario || raw.dispatch || raw.description || raw.setup || '';
  const type = raw.type || raw.category || raw.topic || 'scenario';
  const details = Array.isArray(raw.details) ? raw.details
    : Array.isArray(raw.givens) ? raw.givens
    : Array.isArray(raw.lineSetup) ? raw.lineSetup
    : buildDetails(raw, answers);

  const variationsRaw = Array.isArray(raw.variations) ? raw.variations
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
    image: resolveImage(raw, sourceUrl),
    answers,
    tolerancePsi: toNumber(raw.tolerancePsi || raw.tolerance || raw.defaults?.tolerancePsi) || DEFAULT_TOLERANCE,
    instructorExplanation: raw.instructorExplanation || raw.explanation || raw.mathExplanation || raw.revealLead || '',
    formulaBreakdown: Array.isArray(raw.formulaBreakdown) ? raw.formulaBreakdown : [],
    explainMistake: raw.explainMistake || raw.commonMistakes || raw.mistakeFeedback || '',
    overlays: Array.isArray(raw.overlays) ? raw.overlays : [],
    variations: variationsRaw.map((v, i) => normalizeVariation(v, i, sourceUrl)),
  };
}

function activeFieldDefs(scenario) {
  const fields = FIELD_DEFS.filter(field => scenario?.answers?.[field.key] != null);
  return fields.length ? fields : [FIELD_DEFS[FIELD_DEFS.length - 1]];
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
      explainMistake: 'Most misses on this scenario come from forgetting to add nozzle pressure after calculating friction loss.',
      overlays: [
        { label: 'Engine', text: 'Engine 181', x: 18, y: 68 },
        { label: 'Line', text: '200\' 1¾"', x: 45, y: 52 },
        { label: 'Nozzle', text: 'Fog 185 @ 50', x: 70, y: 32 },
      ]
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
      const entries = Array.isArray(manifest) ? manifest : (manifest.scenarios || manifest.files || manifest.items || []);
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
          title: (Array.isArray(manifest) ? 'FireOps Scenario Pack' : manifest.title) || 'FireOps Scenario Pack',
          packId: (Array.isArray(manifest) ? 'scenario-pack' : manifest.packId) || 'scenario-pack',
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

function buildPresentedScenario(base) {
  const variationPool = Array.isArray(base.variations) && base.variations.length ? [null, ...base.variations] : [null];
  const selectedVariation = variationPool[Math.floor(Math.random() * variationPool.length)] || null;

  let title = base.title;
  let prompt = base.prompt;
  let scene = base.scene;
  let details = Array.isArray(base.details) ? [...base.details] : [];
  let answers = { ...base.answers };
  let image = base.image;
  let overlays = Array.isArray(base.overlays) ? [...base.overlays] : [];
  let instructorExplanation = base.instructorExplanation;
  let formulaBreakdown = Array.isArray(base.formulaBreakdown) ? [...base.formulaBreakdown] : [];
  let explainMistake = base.explainMistake;
  let tolerancePsi = base.tolerancePsi;
  let mathLimited = false;

  if (selectedVariation) {
    const explicitFields = FIELD_DEFS.filter(field => selectedVariation.answers?.[field.key] != null);
    const variationText = selectedVariation.prompt || selectedVariation.note;

    if (variationText) {
      details.push(`Variation: ${variationText}`);
    }

    if (explicitFields.length === 1 && selectedVariation.answers.pumpPressure != null) {
      answers = { pumpPressure: selectedVariation.answers.pumpPressure };
      mathLimited = true;
    } else if (explicitFields.length > 0) {
      const merged = {};
      for (const field of FIELD_DEFS) {
        if (selectedVariation.answers[field.key] != null) {
          merged[field.key] = selectedVariation.answers[field.key];
        } else if (base.answers[field.key] != null) {
          merged[field.key] = base.answers[field.key];
        }
      }
      answers = merged;
      mathLimited = explicitFields.some(field => field.key === 'pumpPressure') && explicitFields.length < FIELD_DEFS.length;
    }

    if (selectedVariation.image) image = selectedVariation.image;
    if (Array.isArray(selectedVariation.overlays) && selectedVariation.overlays.length) overlays = [...selectedVariation.overlays];
    if (selectedVariation.instructorExplanation) instructorExplanation = selectedVariation.instructorExplanation;
    if (Array.isArray(selectedVariation.formulaBreakdown) && selectedVariation.formulaBreakdown.length) formulaBreakdown = [...selectedVariation.formulaBreakdown];
    if (selectedVariation.explainMistake) explainMistake = selectedVariation.explainMistake;
    if (selectedVariation.tolerancePsi) tolerancePsi = selectedVariation.tolerancePsi;

    if (selectedVariation.title && !/^variation\s+\d+$/i.test(selectedVariation.title)) {
      title = `${base.title} — ${selectedVariation.title}`;
    }
  }

  return {
    ...base,
    title,
    prompt,
    scene,
    details: [...new Set(details)],
    answers,
    image,
    overlays,
    instructorExplanation,
    formulaBreakdown,
    explainMistake,
    tolerancePsi,
    selectedVariation,
    mathLimited,
    signature: `${base.id}::${selectedVariation?.id || 'base'}`,
  };
}

function chooseRandomPresentedScenario(allScenarios, previousSignature = '') {
  if (!Array.isArray(allScenarios) || !allScenarios.length) return null;
  let tries = 0;
  let presented = null;
  do {
    const base = allScenarios[Math.floor(Math.random() * allScenarios.length)];
    presented = buildPresentedScenario(base);
    tries++;
  } while (allScenarios.length > 1 && presented && presented.signature === previousSignature && tries < 20);
  return presented;
}

function renderFallbackArt(scenario) {
  return `
    <div class="scenario-fallback-art" role="img" aria-label="Scenario diagram placeholder">
      <div class="fallback-sky"></div>
      <div class="fallback-house">Structure</div>
      <div class="fallback-engine">E-181</div>
      <div class="fallback-hose"></div>
      <div class="fallback-label">${escapeHtml(scenario.chip || 'SCENARIO')}</div>
      ${renderOverlays(scenario)}
    </div>
  `;
}

function renderDetails(details) {
  if (!details || !details.length) return '';
  return `<ul class="scenario-detail-list">${details.map(d => `<li>${escapeHtml(typeof d === 'string' ? d : JSON.stringify(d))}</li>`).join('')}</ul>`;
}

function renderOverlays(scenario) {
  if (!Array.isArray(scenario.overlays) || !scenario.overlays.length) return '';
  return `<div class="scenario-overlays" aria-hidden="true">${scenario.overlays.map(o => {
    const x = Math.max(0, Math.min(100, toNumber(o.x) ?? 50));
    const y = Math.max(0, Math.min(100, toNumber(o.y) ?? 50));
    const label = o.label ? `<small>${escapeHtml(o.label)}</small>` : '';
    const text = escapeHtml(o.text || o.value || o.name || '');
    return `<div class="scenario-overlay" style="left:${x}%;top:${y}%">${label}<b>${text}</b></div>`;
  }).join('')}</div>`;
}

function answerLine(field, correct, entered, ok, tolerance) {
  if (correct == null) return '';
  const enteredText = entered == null ? 'blank' : Math.round(entered * 10) / 10;
  const correctText = Math.round(correct * 10) / 10;
  return `<div class="answer-row ${ok ? 'ok' : 'bad'}"><span>${field.short}</span><b>${enteredText}</b><em>Correct: ${correctText} ${field.unit}${field.unit === 'psi' ? ` ±${tolerance}` : ''}</em></div>`;
}

function inferMistake(scenario, enteredPP) {
  const a = scenario.answers || {};
  if (enteredPP == null || a.pumpPressure == null) return '';
  const tol = scenario.tolerancePsi || DEFAULT_TOLERANCE;
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

  return 'Rebuild the answer as PP = FL + NP ± elevation + appliance loss. Check each component, then add only the needed pressures.';
}

function renderExplanationBody(scenario) {
  const a = scenario.answers || {};
  const parts = [];
  if (a.frictionLoss != null) parts.push(`FL ${Math.round(a.frictionLoss)} psi`);
  if (a.nozzlePressure != null) parts.push(`NP ${Math.round(a.nozzlePressure)} psi`);
  if (a.elevationPressure != null) parts.push(`Elevation ${Math.round(a.elevationPressure)} psi`);
  if (a.applianceLoss != null) parts.push(`Appliance ${Math.round(a.applianceLoss)} psi`);

  const lines = [];
  lines.push(`<div class="formula">PP = FL + NP ± elevation + appliance loss</div>`);

  if (parts.length) {
    lines.push(`<div class="formula-detail">${escapeHtml(parts.join(' + '))} = <b>${Math.round(a.pumpPressure ?? 0)} psi</b></div>`);
  } else if (a.pumpPressure != null) {
    lines.push(`<div class="formula-detail">Final required pump pressure: <b>${Math.round(a.pumpPressure)} psi</b></div>`);
  }

  if (a.totalGpm != null) {
    lines.push(`<div class="formula-detail">Total flow: <b>${Math.round(a.totalGpm)} gpm</b></div>`);
  }

  if (scenario.formulaBreakdown?.length) {
    lines.push(`<ol class="formula-steps">${scenario.formulaBreakdown.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`);
  }

  if (scenario.instructorExplanation) {
    lines.push(`<p>${escapeHtml(scenario.instructorExplanation)}</p>`);
  }

  if (scenario.mathLimited) {
    lines.push(`<p>This variation only supplied a final pump pressure in the JSON file. A full variation-specific FL / NP / elevation breakdown was not included, so the app can only explain the math that was provided.</p>`);
  }

  return `<div class="explain-box"><h4>Math Breakdown</h4>${lines.join('')}</div>`;
}

function renderScenarioCard(container, scenario, packTitle, packCount) {
  container.querySelector('#scenarioTitle').textContent = scenario.title;
  container.querySelector('#scenarioChip').textContent = scenario.chip || String(scenario.type).toUpperCase();
  container.querySelector('#scenarioCount').textContent = `Random • ${packCount} loaded`;
  container.querySelector('#scenarioPack').textContent = `${packTitle} • random display`;

  const media = container.querySelector('#scenarioMedia');
  if (scenario.image) {
    const cacheBustedImage = `${scenario.image}${scenario.image.includes('?') ? '&' : '?'}v=${encodeURIComponent(VERSION)}`;
    media.innerHTML = `<div class="scenario-image-wrap"><img src="${escapeHtml(cacheBustedImage)}" alt="${escapeHtml(scenario.title)} artwork" onerror="this.closest('#scenarioMedia').innerHTML = ''">${renderOverlays(scenario)}</div>`;
    setTimeout(() => { if (!media.innerHTML.trim()) media.innerHTML = renderFallbackArt(scenario); }, 100);
  } else {
    media.innerHTML = renderFallbackArt(scenario);
  }

  container.querySelector('#scenarioPrompt').innerHTML = `
    ${scenario.scene ? `<p class="scene-text">${escapeHtml(scenario.scene)}</p>` : ''}
    <p class="question-text">${escapeHtml(scenario.prompt)}</p>
    ${renderDetails(scenario.details)}
  `;

  const fields = activeFieldDefs(scenario);
  container.querySelector('#answerFields').innerHTML = fields.map(field => `
    <label class="answer-field" for="ans_${field.key}">
      <span>${field.short}</span>
      <small>${field.label}</small>
      <input id="ans_${field.key}" inputmode="decimal" type="number" step="any" placeholder="${field.unit}" data-answer-key="${field.key}">
    </label>
  `).join('');

  container.querySelector('#scenarioFeedback').innerHTML = '';
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
  const tol = scenario.tolerancePsi || DEFAULT_TOLERANCE;
  const fields = activeFieldDefs(scenario);

  let scored = 0;
  let correct = 0;
  const rows = [];

  for (const field of fields) {
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
      ${renderExplanationBody(scenario)}
    </div>
  `;
}

function explainMath(container, scenario) {
  container.querySelector('#scenarioFeedback').innerHTML = `
    <div class="result-card neutral">
      <h3>Explain Math</h3>
      ${renderExplanationBody(scenario)}
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
        <button class="btn primary" id="nextScenarioBtn" type="button">Random</button>
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
          <button class="btn" id="explainMathBtn" type="button">Explain Math</button>
        </div>
      </div>

      <div id="scenarioFeedback"></div>
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
    .scenario-image-wrap{position:relative;width:100%;}
    .scenario-media img{width:100%;height:auto;display:block;max-height:620px;object-fit:contain;background:#02060d;}
    .scenario-overlays{position:absolute;inset:0;pointer-events:none;z-index:2;}
    .scenario-overlay{position:absolute;transform:translate(-50%,-50%);min-width:72px;max-width:138px;padding:5px 7px;border-radius:10px;background:rgba(3,10,18,.86);border:1px solid rgba(117,190,255,.75);box-shadow:0 8px 16px rgba(0,0,0,.35);color:#fff;text-align:center;line-height:1.1;}
    .scenario-overlay small{display:block;color:#9ed0ff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;}
    .scenario-overlay b{display:block;font-size:11px;}
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
    .answer-row span{font-weight:900;}
    .answer-row em{font-style:normal;color:#b9cde2;}
    .mistake-box,.explain-box{margin-top:10px;border:1px solid #263f5f;background:#06101c;border-radius:12px;padding:10px;}
    .mistake-box b{color:#ffd48a;}
    .mistake-box p,.explain-box p{white-space:pre-line;margin:6px 0 0;line-height:1.4;color:#e9f2ff;}
    .explain-box h4{margin:0 0 6px;}
    .formula{font-weight:900;color:#fff;}
    .formula-detail{margin-top:4px;color:#d7eaff;}
    .formula-steps{margin:8px 0 0 18px;padding:0;color:#e4f1ff;line-height:1.45;}
    @media (max-width:520px){.answer-fields{grid-template-columns:1fr;}.scenario-media{min-height:220px}.scenario-fallback-art{height:280px}.answer-row{grid-template-columns:54px 1fr;}.answer-row em{grid-column:1 / -1;}}
  `);

  let disposed = false;
  const pack = await loadScenarioPack();
  if (disposed) return;

  const scenarios = pack.scenarios;
  let currentScenario = null;

  if (pack.error && pack.source === 'fallback') {
    const warn = document.createElement('div');
    warn.className = 'status';
    warn.style.cssText = 'color:#ffd48a;font-size:12px;line-height:1.35;';
    warn.textContent = `Scenario JSON pack was not found, so a fallback scenario loaded. Add files to scenarios/scenario-index.json. Last error: ${pack.error.message || pack.error}`;
    container.querySelector('.scenario-shell').prepend(warn);
  }

  function showRandom() {
    currentScenario = chooseRandomPresentedScenario(scenarios, currentScenario?.signature || '');
    if (!currentScenario) return;
    renderScenarioCard(container, currentScenario, pack.title, scenarios.length);
  }

  container.querySelector('#nextScenarioBtn').addEventListener('click', () => showRandom());
  container.querySelector('#checkScenarioBtn').addEventListener('click', () => { if (currentScenario) gradeScenario(container, currentScenario, false); });
  container.querySelector('#showScenarioAnswerBtn').addEventListener('click', () => { if (currentScenario) gradeScenario(container, currentScenario, true); });
  container.querySelector('#explainMathBtn').addEventListener('click', () => { if (currentScenario) explainMath(container, currentScenario); });

  showRandom();

  return {
    dispose() { disposed = true; }
  };
}
