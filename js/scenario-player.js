(function(){
  const state = {
    baseScenarios: [],
    scenarios: [],
    selected: 0,
    deck: []
  };

  const paths = {
    index: 'scenarios/scenario-index.json',
    scenarioDir: 'scenarios/',
    imageDirs: ['scenarios/', 'images/scenarios/', 'assets/']
  };

  const $ = (id) => document.getElementById(id);

  const safe = (v, fallback='') => {
    return v === undefined || v === null ? fallback : v;
  };

  const toNumber = (v, fallback=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const escapeHtml = (value) => String(safe(value)).replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[ch]));

  const normalizeScenario = (s) => {
    const answers = s.answers || {};
    const calculation = s.calculation || {};
    const category = s.category || s.type || 'pump';
    const difficulty = s.difficulty || (s.chip || '').split('•')[0]?.trim() || 'practice';
    const correctPP = toNumber(s.correctPP ?? answers.pumpPressure ?? calculation.pdp, 0);

    return {
      id: s.id || s.file || `scenario-${Math.random().toString(16).slice(2)}`,
      baseId: s.baseId || s.id || s.file || '',
      title: s.title || 'Untitled Scenario',
      difficulty,
      category,
      chip: s.chip || `${safe(difficulty, 'PRACTICE').toString().toUpperCase()} • ${safe(category, 'PUMP').toString().toUpperCase()}`,
      image: s.image || '',
      scene: s.scene || '',
      question: s.studentQuestion || s.question || 'Calculate the pump pressure for this setup.',
      details: Array.isArray(s.details) ? s.details : detailsFromSceneElements(s.sceneElements),
      overlays: Array.isArray(s.overlays) ? s.overlays : [],
      correctPP,
      tolerance: toNumber(s.tolerance ?? answers.tolerance, 5),
      answers,
      calculation,
      formulaBreakdown: Array.isArray(s.formulaBreakdown) ? s.formulaBreakdown : explanationToFormula(s.instructorExplanation),
      instructorExplanation: s.instructorExplanation || '',
      explainMistake: s.explainMistake || '',
      problems: Array.isArray(s.problems) ? s.problems : [],
      variations: Array.isArray(s.variations) ? s.variations : [],
      isVariation: Boolean(s.isVariation),
      variationChange: s.variationChange || '',
      source: s
    };
  };

  function detailsFromSceneElements(sceneElements){
    if(!sceneElements) return [];

    const out = [];

    (sceneElements.hoses || []).forEach(h => {
      if(typeof h === 'string'){
        out.push(h);
      } else {
        out.push(`${safe(h.length)} of ${safe(h.diameter)} hose${h.flowGpm ? ` • ${h.flowGpm} gpm` : ''}`);
      }
    });

    (sceneElements.nozzles || []).forEach(n => {
      if(typeof n === 'string'){
        out.push(n);
      } else {
        out.push(`${safe(n.type, 'Nozzle')}${n.tip ? ` ${n.tip}` : ''}${n.flowGpm ? ` • ${n.flowGpm} gpm` : ''}${n.nozzlePressure ? ` @ ${n.nozzlePressure} psi` : ''}`);
      }
    });

    (sceneElements.appliances || []).forEach(a => {
      out.push(typeof a === 'string' ? a : safe(a.name || a.type));
    });

    if(sceneElements.elevation){
      out.push(`Elevation: ${sceneElements.elevation}`);
    }

    return out.filter(Boolean);
  }

  function explanationToFormula(text){
    return text ? [text] : [];
  }

  async function fetchJson(url){
    const r = await fetch(url, { cache: 'no-store' });
    if(!r.ok) throw new Error(`${url} not found`);
    return r.json();
  }

  async function load(){
    try{
      const index = await fetchJson(paths.index);
      const raw = Array.isArray(index) ? index : (index.scenarios || []);
      const scenarios = [];

      for(const item of raw){
        if(item.file){
          try{
            scenarios.push(await fetchJson(paths.scenarioDir + item.file));
          } catch(e){
            console.warn('Scenario file missing:', item.file, e);
          }
        } else {
          scenarios.push(item);
        }
      }

      state.baseScenarios = scenarios
        .map(normalizeScenario)
        .filter(s => s.correctPP || s.question || s.problems.length || s.variations.length);

      state.scenarios = expandPlayableRuns(state.baseScenarios);

      if(!state.scenarios.length){
        throw new Error('No valid scenarios loaded. Each playable problem needs a question and a correctPP or answers.pumpPressure value.');
      }

      const params = new URLSearchParams(location.search);
      const requested = params.get('id');
      const requestedProblem = params.get('problem');
      const requestedIdx = findRequestedScenarioIndex(requested, requestedProblem);

      state.selected = requestedIdx >= 0 ? requestedIdx : randomIndex(state.scenarios.length);

      rebuildDeck();
      hidePracticeInfo();
      renderScenario();
    } catch(err){
      const app = $('app');

      if(app){
        app.innerHTML = `
          <div class="error">
            <strong>Scenario files not found.</strong><br>
            ${escapeHtml(err.message)}<br><br>
            Required:
            <code>/scenarios/scenario-index.json</code>,
            scenario JSON files,
            scenario images,
            and <code>/js/scenario-player.js</code>.
          </div>
        `;
      }
    }
  }

  function hidePracticeInfo(){
    const info = $('practiceInfo');
    if(info){
      info.innerHTML = '';
      info.style.display = 'none';
    }
  }

  function findRequestedScenarioIndex(requested, requestedProblem){
    if(!requested) return -1;

    const exact = state.scenarios.findIndex(s => {
      return s.id === requested || s.problemId === requested;
    });

    if(exact >= 0) return exact;

    const sameBase = state.scenarios
      .map((scenario, i) => ({ scenario, i }))
      .filter(({ scenario }) => {
        return scenario.baseId === requested || scenario.originalId === requested;
      });

    if(!sameBase.length) return -1;

    const problemNumber = toNumber(requestedProblem, 0);

    if(problemNumber > 0){
      const problemMatch = sameBase.find(({ scenario }) => scenario.problemNumber === problemNumber);
      if(problemMatch) return problemMatch.i;
    }

    return sameBase[0].i;
  }

  function expandPlayableRuns(baseScenarios){
    const playable = [];

    baseScenarios.forEach((base) => {
      const problemDefs = getProblemDefinitions(base);

      const runs = problemDefs
        .map((def, i) => buildProblemRun(base, def.problem, i, def.kind))
        .filter(Boolean);

      runs.forEach((run, i) => {
        run.problemNumber = i + 1;
        run.problemCount = runs.length;
        playable.push(run);
      });
    });

    return playable;
  }

  function getProblemDefinitions(base){
    /*
      New supported format:

      {
        "id": "example-scene",
        "image": "same-picture.png",
        "problems": [
          {
            "question": "200' 1¾ hose, 185 gpm @ 50 psi...",
            "overlays": [...],
            "correctPP": 156
          },
          {
            "question": "200' 1¾ hose, 150 gpm @ 100 psi...",
            "overlays": [...],
            "correctPP": 170
          }
        ]
      }

      Each problem becomes one playable screen.
      The app does not display the full problem list to the student.
    */

    if(base.problems.length){
      return base.problems.map(problem => ({
        kind: 'problem',
        problem
      }));
    }

    const defs = [
      {
        kind: 'base',
        problem: null
      }
    ];

    base.variations.forEach(problem => {
      defs.push({
        kind: 'variation',
        problem
      });
    });

    return defs;
  }

  function buildProblemRun(base, problem, index, kind){
    const isBase = kind === 'base';
    const isStringProblem = typeof problem === 'string';
    const p = isStringProblem ? { change: problem } : (problem || {});

    if(!isBase && (!p || typeof p !== 'object')){
      return null;
    }

    const problemAnswers = p.answers || {};
    const problemCalculation = p.calculation || {};
    const problemCorrectValue = p.correctPP ?? problemAnswers.pumpPressure ?? problemCalculation.pdp;
    const baseCorrectValue = base.correctPP ?? base.answers?.pumpPressure ?? base.calculation?.pdp;

    const correctPP = isBase
      ? toNumber(problemCorrectValue ?? baseCorrectValue, 0)
      : toNumber(problemCorrectValue, 0);

    /*
      Variation/problem entries without an answer stay in the JSON for instructor ideas,
      but they are not used as playable student screens.
    */
    if(!correctPP) return null;

    const change = p.change || p.scenarioChange || p.setup || '';
    const title = p.title || base.title;
    const chip = p.chip || base.chip;
    const image = p.image || base.image;
    const scene = p.scene || base.scene;

    const question = p.studentQuestion || p.question || (
      change
        ? `Same picture, new setup: ${change} What pump pressure should the operator set?`
        : base.question
    );

    const details = Array.isArray(p.details) && p.details.length
      ? p.details
      : (p.sceneElements ? detailsFromSceneElements(p.sceneElements) : base.details);

    const overlays = Array.isArray(p.overlays)
      ? p.overlays
      : base.overlays;

    const formulaBreakdown = Array.isArray(p.formulaBreakdown) && p.formulaBreakdown.length
      ? p.formulaBreakdown
      : (
        change
          ? [
              `Changed setup: ${change}`,
              `Correct pump pressure: ${correctPP} PSI`
            ]
          : base.formulaBreakdown
      );

    const instructorExplanation = p.instructorExplanation || base.instructorExplanation || (
      change
        ? 'This problem reuses the same picture but changes the operating numbers. Use the numbers shown in the current question and labels.'
        : ''
    );

    const problemId = p.id || p.problemId || `${base.id}-${kind}-${index + 1}`;

    return {
      id: isBase ? base.id : `${base.id}__${kind}_${index + 1}`,
      problemId,
      originalId: base.id,
      baseId: base.baseId || base.id,
      title,
      difficulty: p.difficulty || base.difficulty,
      category: p.category || base.category,
      chip,
      image,
      scene,
      question,
      details,
      overlays,
      correctPP,
      tolerance: toNumber(p.tolerance ?? problemAnswers.tolerance, base.tolerance),
      answers: {
        ...base.answers,
        ...problemAnswers
      },
      formulaBreakdown,
      instructorExplanation,
      explainMistake: p.explainMistake || base.explainMistake,
      variations: [],
      isVariation: !isBase,
      variationChange: change,
      problemNumber: 1,
      problemCount: 1
    };
  }

  function randomIndex(max){
    return Math.floor(Math.random() * max);
  }

  function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
  }

  function rebuildDeck(){
    state.deck = shuffle(
      state.scenarios
        .map((_, i) => i)
        .filter(i => i !== state.selected)
    );
  }

  function nextRandomScenario(){
    if(state.scenarios.length <= 1) return;

    if(!state.deck.length){
      rebuildDeck();
    }

    let next = state.deck.shift();

    if(next === state.selected && state.deck.length){
      next = state.deck.shift();
    }

    state.selected = Number.isFinite(next) ? next : randomIndex(state.scenarios.length);
    hidePracticeInfo();
    renderScenario();
  }

  function getSamePictureRuns(current){
    return state.scenarios
      .map((scenario, i) => ({ scenario, i }))
      .filter(({ scenario }) => {
        return scenario.baseId === current.baseId || scenario.image === current.image;
      })
      .sort((a, b) => a.i - b.i);
  }

  function nextSamePictureRun(){
    const current = state.scenarios[state.selected];
    const options = getSamePictureRuns(current);

    if(options.length <= 1){
      nextRandomScenario();
      return;
    }

    const currentPos = options.findIndex(({ i }) => i === state.selected);
    const nextPos = currentPos >= 0 ? (currentPos + 1) % options.length : 0;

    state.selected = options[nextPos].i;
    state.deck = state.deck.filter(i => i !== state.selected);

    hidePracticeInfo();
    renderScenario();
  }

  function renderScenario(){
    const s = state.scenarios[state.selected];

    renderSceneImage(s);

    const samePictureCount = getSamePictureRuns(s).length;
    const samePictureDisabled = samePictureCount <= 1 ? 'disabled' : '';

    const scenarioPanel = $('scenarioPanel');

    scenarioPanel.innerHTML = `
      <div class="chip">${escapeHtml(s.chip)}</div>
      <h2>${escapeHtml(s.title)}</h2>

      ${s.scene ? `<p style="color:#aab3c0;line-height:1.45">${escapeHtml(s.scene)}</p>` : ''}

      <div class="question">${escapeHtml(s.question)}</div>

      <div class="details">
        ${s.details.map(d => `<div class="detail">${escapeHtml(d)}</div>`).join('')}
      </div>

      <label for="ppInput" style="font-weight:900">Your pump pressure answer</label>

      <div class="answer-row">
        <input id="ppInput" type="number" inputmode="numeric" placeholder="Enter PSI">
        <button id="checkBtn" class="btn">Check</button>
      </div>

      <div class="controls">
        <button id="showAnswerBtn" class="btn secondary">Show Answer</button>
        <button id="samePictureBtn" class="btn secondary" ${samePictureDisabled}>Same Picture / Next Problem</button>
        <button id="nextBtn" class="btn ghost">Next Random Scenario</button>
      </div>

      <div id="result" class="result"></div>
    `;

    $('checkBtn').addEventListener('click', checkAnswer);
    $('showAnswerBtn').addEventListener('click', () => showResult(false, true));
    $('samePictureBtn').addEventListener('click', nextSamePictureRun);
    $('nextBtn').addEventListener('click', nextRandomScenario);

    $('ppInput').addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        checkAnswer();
      }
    });
  }

  function imageCandidates(image){
    if(!image) return [];

    if(/^https?:\/\//i.test(image) || image.startsWith('/') || image.includes('/')){
      return [image];
    }

    return paths.imageDirs.map(dir => dir + image);
  }

  function renderSceneImage(s){
    const media = $('sceneMedia');
    const overlays = renderOverlays(s.overlays);
    const candidates = imageCandidates(s.image);

    if(!candidates.length){
      media.innerHTML = '<div class="error">No image set for this scenario.</div>';
      return;
    }

    media.innerHTML = `
      <img id="sceneImg" alt="${escapeHtml(s.title)}">
      ${overlays}
    `;

    const img = $('sceneImg');
    let candidateIndex = 0;

    img.onerror = () => {
      candidateIndex += 1;

      if(candidateIndex < candidates.length){
        img.src = candidates[candidateIndex];
      } else {
        media.innerHTML = `
          <div class="error">
            Image missing: ${escapeHtml(candidates.join(' or '))}
          </div>
        `;
      }
    };

    img.src = candidates[candidateIndex];
  }

  function renderOverlays(overlays){
    if(!Array.isArray(overlays)) return '';

    return overlays.map(o => `
      <div
        class="overlay-label"
        style="--x:${toNumber(o.x, 50)}%;--y:${toNumber(o.y, 50)}%"
      >
        ${escapeHtml(o.text || o.label || '')}
      </div>
    `).join('');
  }

  function checkAnswer(){
    showResult(true, false);
  }

  function showResult(fromInput, forceShow){
    const s = state.scenarios[state.selected];
    const input = $('ppInput');
    const val = Number(input.value);
    const answered = Number.isFinite(val) && input.value !== '';
    const correct = answered && Math.abs(val - s.correctPP) <= s.tolerance;
    const r = $('result');

    r.className = `result show ${correct ? 'good' : 'bad'}`;

    const header = forceShow
      ? `Correct pump pressure: ${s.correctPP} PSI`
      : (correct ? `Correct — ${s.correctPP} PSI` : `Not quite. Correct answer: ${s.correctPP} PSI`);

    const userLine = answered && !forceShow
      ? `<p>Your answer: <strong>${val} PSI</strong> • tolerance ±${s.tolerance} PSI</p>`
      : '';

    r.innerHTML = `
      <h3>${escapeHtml(header)}</h3>

      ${userLine}

      ${s.explainMistake && !correct && !forceShow
        ? `<p><strong>Common mistake:</strong> ${escapeHtml(s.explainMistake)}</p>`
        : ''
      }

      ${s.instructorExplanation
        ? `<p>${escapeHtml(s.instructorExplanation)}</p>`
        : ''
      }

      <div class="math">
        ${s.formulaBreakdown.map(line => `<div>${escapeHtml(line)}</div>`).join('')}
      </div>
    `;
  }

  load();
})();
