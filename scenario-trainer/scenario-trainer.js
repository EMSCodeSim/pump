import { scenarios } from './scenarios.js';

const C_VALUES = { '1.75': 15.5, '1 3/4': 15.5, '1¾': 15.5, '2.5': 2, '2 1/2': 2, '2½': 2, '3': 0.8, '4': 0.2, '5': 0.08 };
const $ = (id) => document.getElementById(id);
let index = Math.floor(Math.random() * scenarios.length);
let lastIndex = index;

function fl(hoseSize, gpm, length){
  const c = C_VALUES[String(hoseSize)] ?? 15.5;
  const q = Number(gpm) / 100;
  return Math.round(c * q * q * (Number(length) / 100));
}

function applyCorrectOverride(s, result){
  if (Number.isFinite(Number(s.correctPP))) {
    result.pumpPressure = Number(s.correctPP);
  }
  return result;
}

function solve(s){
  if (s.type === 'single') {
    const lineFL = fl(s.line.hoseSize, s.line.gpm, s.line.length);
    const pumpPressure = lineFL + s.line.nozzlePressure + (s.applianceLoss || 0) + (s.elevation || 0);
    return applyCorrectOverride(s, { pumpPressure, frictionLoss: lineFL, nozzlePressure: s.line.nozzlePressure, other: (s.applianceLoss || 0) + (s.elevation || 0), steps:[
      `${s.line.length}' of ${s.line.hoseSize}" hose flowing ${s.line.gpm} gpm = ${lineFL} psi FL.`,
      `Nozzle pressure = ${s.line.nozzlePressure} psi.`,
      `Appliance/elevation adjustment = ${(s.applianceLoss || 0) + (s.elevation || 0)} psi.`,
      `Pump pressure = ${lineFL} + ${s.line.nozzlePressure} + ${(s.applianceLoss || 0) + (s.elevation || 0)} = ${pumpPressure} psi.`
    ]});
  }

  if (s.type === 'wye') {
    const branches = s.branches.map(b => ({...b, branchFL: fl(b.hoseSize,b.gpm,b.length)}));
    const branchRequired = branches.map(b => b.branchFL + b.nozzlePressure);
    const wyePressure = Math.max(...branchRequired);
    const totalGpm = branches.reduce((sum,b)=>sum+b.gpm,0);
    const mainFL = fl(s.main.hoseSize,totalGpm,s.main.length);
    const pumpPressure = mainFL + wyePressure + (s.applianceLoss || 0) + (s.elevation || 0);
    return applyCorrectOverride(s, { pumpPressure, frictionLoss: mainFL + Math.max(...branches.map(b=>b.branchFL)), nozzlePressure: Math.max(...branches.map(b=>b.nozzlePressure)), other:(s.applianceLoss || 0) + (s.elevation || 0), steps:[
      ...branches.map(b => `${b.label}: ${b.length}' of ${b.hoseSize}" flowing ${b.gpm} gpm = ${b.branchFL} psi FL + ${b.nozzlePressure} psi NP = ${b.branchFL + b.nozzlePressure} psi.`),
      `Use the highest branch requirement at the wye: ${wyePressure} psi.`,
      `Main line flow = ${totalGpm} gpm through ${s.main.length}' of ${s.main.hoseSize}" hose = ${mainFL} psi FL.`,
      `Add appliance/elevation adjustment: ${(s.applianceLoss || 0) + (s.elevation || 0)} psi.`,
      `Pump pressure = ${mainFL} + ${wyePressure} + ${(s.applianceLoss || 0) + (s.elevation || 0)} = ${pumpPressure} psi.`
    ]});
  }

  if (s.type === 'masterStream') {
    const count = Number(s.supplyLines?.count || 1);
    const totalGpm = Number(s.supplyLines?.totalGpm || 0);
    const gpmPerLine = totalGpm / count;
    const lineFL = fl(s.supplyLines.hoseSize, gpmPerLine, s.supplyLines.length);
    const pumpPressure = lineFL + (s.nozzlePressure || 0) + (s.applianceLoss || 0) + (s.elevation || 0);
    return applyCorrectOverride(s, { pumpPressure, frictionLoss: lineFL, nozzlePressure: s.nozzlePressure || 0, other:(s.applianceLoss || 0) + (s.elevation || 0), steps:[
      `Total flow = ${totalGpm} gpm through ${count} equal lines, so each line carries ${gpmPerLine} gpm.`,
      `Each line: ${s.supplyLines.length}' of ${s.supplyLines.hoseSize}" hose flowing ${gpmPerLine} gpm = ${lineFL} psi FL.`,
      `Master stream nozzle pressure = ${s.nozzlePressure || 0} psi.`,
      `Appliance/elevation adjustment = ${(s.applianceLoss || 0) + (s.elevation || 0)} psi.`,
      `Pump pressure = ${lineFL} + ${s.nozzlePressure || 0} + ${(s.applianceLoss || 0) + (s.elevation || 0)} = ${pumpPressure} psi.`
    ]});
  }

  if (s.type === 'standpipe') {
    const lineFL = fl(s.line.hoseSize, s.line.gpm, s.line.length);
    const pumpPressure = lineFL + s.line.nozzlePressure + (s.standpipePressure || 0) + (s.elevation || 0);
    return applyCorrectOverride(s, { pumpPressure, frictionLoss: lineFL, nozzlePressure: s.line.nozzlePressure, other:(s.standpipePressure || 0) + (s.elevation || 0), steps:[
      `Interior line: ${s.line.length}' of ${s.line.hoseSize}" flowing ${s.line.gpm} gpm = ${lineFL} psi FL.`,
      `Nozzle pressure = ${s.line.nozzlePressure} psi.`,
      `Standpipe/elevation allowance = ${(s.standpipePressure || 0) + (s.elevation || 0)} psi.`,
      `Pump pressure = ${lineFL} + ${s.line.nozzlePressure} + ${(s.standpipePressure || 0) + (s.elevation || 0)} = ${pumpPressure} psi.`
    ]});
  }

  return { pumpPressure: Number(s.correctPP || 0), frictionLoss: 0, nozzlePressure: 0, other: 0, steps:['No math solver is available for this scenario type yet.'] };
}

function renderArt(s){
  if (s.image) {
    return `<img class="scenario-photo" src="${s.image}" alt="${s.title}" loading="eager" onerror="this.closest('.art-stage').classList.add('image-missing')">`;
  }
  const hydrant = s.hydrant ? `<circle cx="48" cy="232" r="14" fill="#c93333"/><rect x="42" y="204" width="12" height="34" rx="4" fill="#e04b4b"/>` : '';
  const building = `<rect x="285" y="56" width="190" height="160" rx="8" fill="#b9c0c6"/><rect x="310" y="90" width="36" height="42" fill="#1c2e40"/><rect x="365" y="90" width="36" height="42" fill="#1c2e40"/><rect x="420" y="90" width="32" height="92" fill="#4d3329"/>`;
  const engine = `<rect x="82" y="186" width="112" height="54" rx="9" fill="#bf1d1d"/><rect x="116" y="158" width="64" height="36" rx="6" fill="#e33"/><circle cx="107" cy="244" r="13" fill="#101820"/><circle cx="170" cy="244" r="13" fill="#101820"/><text x="102" y="219" fill="white" font-size="15" font-weight="800">E1</text>`;
  let hoses = '';
  if (s.type === 'single') hoses = `<path d="M194 214 C245 215 260 244 320 238 C370 233 405 213 443 196" stroke="#f2d34b" stroke-width="10" fill="none" stroke-linecap="round"/><text x="246" y="256" fill="white" font-size="15" font-weight="800">${s.line.length}' ${s.line.hoseSize}"</text><circle cx="448" cy="194" r="9" fill="#2ce0ff"/>`;
  if (s.type === 'wye') hoses = `<path d="M194 214 C230 214 250 220 278 224" stroke="#f2d34b" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="286" cy="225" r="14" fill="#d58b28"/><text x="270" y="253" fill="white" font-size="14" font-weight="800">WYE</text><path d="M296 219 C335 192 372 178 438 164" stroke="#5ec8ff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M296 232 C336 253 383 254 453 232" stroke="#5ec8ff" stroke-width="8" fill="none" stroke-linecap="round"/><text x="330" y="154" fill="white" font-size="13" font-weight="800">A ${s.branches[0].length}'</text><text x="332" y="278" fill="white" font-size="13" font-weight="800">B ${s.branches[1].length}'</text>`;
  if (s.type === 'masterStream') hoses = `<path d="M194 200 C250 182 310 177 420 150" stroke="#5ec8ff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M194 228 C260 250 330 220 420 170" stroke="#5ec8ff" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="430" cy="158" r="16" fill="#d58b28"/><text x="315" y="138" fill="white" font-size="13" font-weight="800">Portable Monitor</text>`;
  if (s.type === 'standpipe') hoses = `<path d="M194 214 C236 204 257 177 292 150" stroke="#f2d34b" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="292" cy="150" r="9" fill="#d58b28"/><path d="M292 150 C335 132 377 141 430 158" stroke="#5ec8ff" stroke-width="8" fill="none" stroke-linecap="round"/><text x="304" y="130" fill="white" font-size="13" font-weight="800">FDC / Standpipe</text>`;
  return `<svg viewBox="0 0 520 310" role="img"><rect width="520" height="310" fill="transparent"/><rect x="0" y="220" width="520" height="90" fill="#2b3038" opacity=".62"/>${building}${hydrant}${engine}${hoses}<text x="18" y="292" fill="#d8e5ef" font-size="13" font-weight="700">Artwork placeholder generated from scenario data</text></svg>`;
}

function render(){
  const s = scenarios[index];
  $('scenarioTitle').textContent = s.title;
  $('scenarioSubtitle').textContent = s.subtitle || '';
  $('scenarioTag').textContent = s.tag || s.type;
  $('scenarioDescription').textContent = s.description;
  $('artStage').classList.remove('image-missing');
  $('artStage').innerHTML = renderArt(s);
  ['answerPump','answerFL','answerNP','answerOther'].forEach(id => $(id).value = '');
  $('resultBox').hidden = true; $('mathBox').hidden = true;
}

function submit(){
  const s = scenarios[index];
  const ans = solve(s);
  const user = Number($('answerPump').value);
  const tolerance = s.tolerance ?? 5;
  const box = $('resultBox');
  box.hidden = false;
  if (!Number.isFinite(user) || $('answerPump').value === '') {
    box.className = 'result-box bad';
    box.innerHTML = `<strong>Enter a pump pressure answer first.</strong>`;
    return;
  }
  const diff = Math.abs(user - ans.pumpPressure);
  if (diff <= tolerance) {
    box.className = 'result-box good';
    box.innerHTML = `<strong>Correct.</strong><br>Your answer: ${user} psi. Correct answer: ${ans.pumpPressure} psi.`;
  } else {
    box.className = 'result-box bad';
    box.innerHTML = `<strong>Not quite.</strong><br>Your answer: ${user} psi. Correct answer: ${ans.pumpPressure} psi. Tolerance: ±${tolerance} psi.`;
  }
}

function explain(){
  const s = scenarios[index];
  const ans = solve(s);
  const steps = s.formulaBreakdown || ans.steps;
  const box = $('mathBox');
  box.hidden = false;
  box.innerHTML = `<strong>Math Breakdown</strong><ol>${steps.map(step => `<li>${step}</li>`).join('')}</ol>`;
}

function pickRandomScenario(){
  if (scenarios.length <= 1) return 0;
  let nextIndex = Math.floor(Math.random() * scenarios.length);
  while (nextIndex === lastIndex) {
    nextIndex = Math.floor(Math.random() * scenarios.length);
  }
  lastIndex = nextIndex;
  return nextIndex;
}

$('submitBtn').addEventListener('click', submit);
$('explainBtn').addEventListener('click', explain);
$('nextBtn').addEventListener('click', () => { index = pickRandomScenario(); render(); });

render();
