import { renderAdOnce } from './ads-guards.js';
// /js/view.practice.js
// Practice Mode (phone-friendly) with:
// - 50' multiples only (no 25' / 75')
// - New Question clears prior answer/work
// - 2½″ hose = BLUE, 1¾″ hose = RED
// - Equations box = white text on black background
// - Non-overlapping label "bubbles" at line ends
// - NOZZLE graphics drawn at line ends (and master stream junction)

import {
  COEFF,
  PSI_PER_FT,
  FL_total,
} from './store.js';

// ---------- small DOM helpers ----------
function injectStyle(root, cssText) {
  const s = document.createElement('style');
  s.textContent = cssText;
  root.appendChild(s);
}
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function weightedPick(weightedArray){
  const total = weightedArray.reduce((a,x)=>a+x.w,0);
  let r = Math.random()*total;
  for(const x of weightedArray){ if((r-=x.w)<=0) return x.v; }
  return weightedArray[weightedArray.length-1].v;
}
const sizeLabel = (sz) => sz==='2.5' ? '2½″' : (sz==='1.75' ? '1¾″' : `${sz}″`);

// ---------- constants ----------
const ns = 'http://www.w3.org/2000/svg';
const TOL = 5; // ± psi for "Check"
const TRUCK_W = 390;
const TRUCK_H = 260;
const PX_PER_50FT = 45;
const BRANCH_LIFT = 10;

// ---------- geometry helpers ----------
function truckTopY(viewH){
  const isWide = (typeof window !== 'undefined' && window.innerWidth >= 768);
  const margin = isWide ? 80 : 0; // leave extra space at bottom on tablets/desktops
  return viewH - TRUCK_H - margin;
}
function pumpXY(viewH){
  const top = truckTopY(viewH);
  return { x: TRUCK_W*0.515, y: top + TRUCK_H*0.74 };
}
function mainCurve(totalPx, viewH){
  const {x:sx,y:sy} = pumpXY(viewH);
  const ex = sx;
  const ey = Math.max(10, sy - totalPx);
  const cx = (sx+ex)/2;
  const cy = sy - (sy-ey)*0.48;
  return { d:`M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`, endX:ex, endY:ey };
}
function straightBranch(side, startX, startY, totalPx){
  const dir = side==='L'?-1:1;
  const x = startX + dir*20;
  const y1 = startY - BRANCH_LIFT;
  const y2 = Math.max(8, y1 - totalPx);
  return { d:`M ${startX},${startY} L ${startX},${y1} L ${x},${y1} L ${x},${y2}`, endX:x, endY:y2 };
}

// ---------- scenario generator (50' multiples only) ----------
function makeScenario(){
  const kind = weightedPick([
    { v:'single', w:34 },
    { v:'wye2',   w:33 },
    { v:'master', w:33 }
  ]);

  if(kind==='single'){
    const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
    const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
    const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
    const noz175 = [
      {gpm:185, NP:50, label:'185@50'},
      {gpm:150, NP:75, label:'150@75'},
      {gpm:185, NP:75, label:'185@75'}
    ];
    const noz25 = [
      {gpm:265, NP:50, label:'265@50'},
      {gpm:250, NP:75, label:'250@75'}
    ];
    const mainNoz = mainSize==='2.5' ? pick(noz25) : pick(noz175);
    const flow = mainNoz.gpm;
    const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);
    const PDP = Math.round(mainNoz.NP + mainFL + elevFt*PSI_PER_FT);
    return { type:'single', mainSize, mainLen, elevFt, mainNoz, flow, PDP };
  }

  if(kind==='wye2'){
    const mainSize = weightedPick([{v:'1.75',w:70},{v:'2.5',w:30}]);
    const mainLen  = weightedPick([{v:150,w:25},{v:200,w:50},{v:250,w:20},{v:300,w:5}]);
    const elevFt   = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
    const wyeLoss = 10;

    const nozChoices = [
      {gpm:150, NP:75, label:'150@75'},
      {gpm:185, NP:50, label:'185@50'},
      {gpm:185, NP:75, label:'185@75'}
    ];
    const lenChoices = [50,100,150];

    const bnA = { len: pick(lenChoices), noz: pick(nozChoices) };
    const bnB = { len: pick(lenChoices), noz: pick(nozChoices) };

    const flow = bnA.noz.gpm + bnB.noz.gpm;
    const mainFL = FL_total(flow, [{size:mainSize, lengthFt:mainLen}]);

    const needA = bnA.noz.NP + FL_total(bnA.noz.gpm, [{size:'1.75', lengthFt:bnA.len}]);
    const needB = bnB.noz.NP + FL_total(bnB.noz.gpm, [{size:'1.75', lengthFt:bnB.len}]);
    const PDP = Math.round(Math.max(needA,needB) + mainFL + wyeLoss + elevFt*PSI_PER_FT);

    return { type:'wye2', mainSize, mainLen, elevFt, wyeLoss, bnA, bnB, flow, PDP };
  }

  // master stream w/ two equal 2½″ lines
  const elevFt = weightedPick([{v:0,w:30},{v:10,w:30},{v:20,w:25},{v:30,w:10},{v:40,w:5}]);
  const ms = pick([
    { gpm: 500, NP: 80, appliance: 25 },
    { gpm: 750, NP: 80, appliance: 25 },
    { gpm: 1000, NP: 80, appliance: 25 }
  ]);
  const totalGPM = ms.gpm;
  const perLine = totalGPM/2;
  const lenChoices = [100,150,200,250,300];
  const L = pick(lenChoices);
  const flPer = FL_total(perLine, [{size:'2.5', lengthFt:L}]);
  const PDP = Math.round(ms.NP + flPer + ms.appliance + elevFt*PSI_PER_FT);

  return {
    type:'master',
    elevFt,
    ms, // {gpm, NP, appliance}
    line1: { len: L, gpm: perLine },
    line2: { len: L, gpm: perLine },
    PDP
  };
}

function computeAll(S){
  const Epsi = (S.elevFt||0) * PSI_PER_FT;

  if(S.type==='single'){
    const mainFL = FL_total(S.flow, [{size:S.mainSize, lengthFt:S.mainLen}]);
    const PDP = Math.round(S.mainNoz.NP + mainFL + Epsi);
    return { type:'single', flow:S.flow, mainFL:Math.round(mainFL), Epsi:Math.round(Epsi), PDP };
  }

  if(S.type==='wye2'){
    const flow = S.bnA.noz.gpm + S.bnB.noz.gpm;
    const mainFL = FL_total(flow, [{size:S.mainSize, lengthFt:S.mainLen}]);

    const flA = FL_total(S.bnA.noz.gpm, [{size:'1.75', lengthFt:S.bnA.len}]);
    const flB = FL_total(S.bnB.noz.gpm, [{size:'1.75', lengthFt:S.bnB.len}]);

    const needA = S.bnA.noz.NP + flA;
    const needB = S.bnB.noz.NP + flB;
    const higherNeed = Math.max(needA, needB);

    const PDP = Math.round(higherNeed + mainFL + (S.wyeLoss||10) + Epsi);

    return {
      type:'wye2',
      flow,
      mainFL:Math.round(mainFL),
      flA:Math.round(flA),
      flB:Math.round(flB),
      needA:Math.round(needA),
      needB:Math.round(needB),
      higherNeed:Math.round(higherNeed),
      Epsi:Math.round(Epsi),
      PDP
    };
  }

  // master: two equal 2½″ lines
  const totalGPM = S.ms.gpm;
  const perLine = totalGPM/2;
  const flPer = FL_total(perLine, [{size:'2.5', lengthFt:S.line1.len}]); // equal lines in generator
  const PDP = Math.round(S.ms.NP + flPer + S.ms.appliance + Epsi);

  return {
    type:'master',
    totalGPM,
    perLine,
    flPer:Math.round(flPer),
    Epsi:Math.round(Epsi),
    PDP
  };
}

function makeQuestion(){
  // base visual scenario
  const baseS = generateScenarioBase();
  const base = computeAll(baseS);

  const qKind = weightedPick([
    { v:'PP',     w:35 },
    { v:'ADJUST', w:25 },
    { v:'REVERSE',w:20 },
    { v:'CHECK',  w:20 }
  ]);

  // default
  const q = {
    scenario: baseS,
    qKind,
    questionType: 'NUM', // NUM or YN
    unitHint: 'psi',
    prompt: 'Calculate required Pump Discharge Pressure (PDP).',
    answer: base.PDP,
    revealHtml: null
  };

  // CHECK (Y/N) against 150 psi
  if(qKind==='CHECK'){
    const limit = 150;
    const ok = base.PDP <= limit;
    q.questionType = 'YN';
    q.unitHint = 'Y/N';
    q.prompt = `Is this setup acceptable with a ${limit} psi pump limit? (Y/N)`;
    q.answer = ok ? 'Y' : 'N';
    q.revealHtml = `
      <div><b>Decision Check</b></div>
      <ul class="simpleList">
        <li>Calculated PDP = <b>${base.PDP} psi</b></li>
        <li>Limit = <b>${limit} psi</b></li>
      </ul>
      <div><b>Answer: <span class="${ok?'ok':'alert'}">${ok?'Y (acceptable)':'N (not acceptable)'}</span></b></div>
    `;
    return q;
  }

  // ADJUST
  if(qKind==='ADJUST'){
    const S2 = structuredClone ? structuredClone(baseS) : JSON.parse(JSON.stringify(baseS));
    let changeText = '';

    if(S2.type==='single'){
      const which = pick(['addLen','moreElev','swapNoz']);
      if(which==='addLen'){
        const add = pick([50,100]);
        S2.mainLen = Math.min(450, S2.mainLen + add);
        changeText = `Add ${add}′ to the attack line.`;
      }else if(which==='moreElev'){
        const add = pick([10,20]);
        S2.elevFt = Math.min(70, (S2.elevFt||0) + add);
        changeText = `Increase elevation by ${add}′.`;
      }else{
        const opts = S2.mainSize==='2.5'
          ? [{gpm:265, NP:50, label:'265@50'},{gpm:250, NP:75, label:'250@75'}]
          : [{gpm:185, NP:50, label:'185@50'},{gpm:150, NP:75, label:'150@75'},{gpm:185, NP:75, label:'185@75'}];
        S2.mainNoz = pick(opts);
        S2.flow = S2.mainNoz.gpm;
        changeText = `Change nozzle to ${S2.mainNoz.gpm} gpm @ NP ${S2.mainNoz.NP}.`;
      }
    }else if(S2.type==='wye2'){
      const which = pick(['addMain','addBranch','moreElev','swapBranchNoz']);
      if(which==='addMain'){
        const add = pick([50,100]);
        S2.mainLen = Math.min(450, S2.mainLen + add);
        changeText = `Add ${add}′ to the main line feeding the wye.`;
      }else if(which==='addBranch'){
        const add = pick([50,100]);
        const side = pick(['A','B']);
        if(side==='A') S2.bnA.len = Math.min(300, S2.bnA.len + add);
        else S2.bnB.len = Math.min(300, S2.bnB.len + add);
        changeText = `Add ${add}′ to Branch ${side}.`;
      }else if(which==='moreElev'){
        const add = pick([10,20]);
        S2.elevFt = Math.min(70, (S2.elevFt||0) + add);
        changeText = `Increase elevation by ${add}′.`;
      }else{
        const opts = [
          {gpm:185, NP:50, label:'185@50'},
          {gpm:150, NP:75, label:'150@75'},
          {gpm:185, NP:75, label:'185@75'}
        ];
        const side = pick(['A','B']);
        if(side==='A') S2.bnA.noz = pick(opts);
        else S2.bnB.noz = pick(opts);
        changeText = `Change Branch ${side} nozzle.`;
      }
      // refresh cached flow/PDP used by generator visuals
      S2.flow = S2.bnA.noz.gpm + S2.bnB.noz.gpm;
    }else{
      const which = pick(['addLen','moreElev','raiseFlow']);
      if(which==='addLen'){
        const add = pick([50,100]);
        S2.line1.len = Math.min(450, S2.line1.len + add);
        S2.line2.len = S2.line1.len;
        changeText = `Add ${add}′ to each 2½″ line.`;
      }else if(which==='moreElev'){
        const add = pick([10,20]);
        S2.elevFt = Math.min(70, (S2.elevFt||0) + add);
        changeText = `Increase elevation by ${add}′.`;
      }else{
        const opts = [
          { gpm: 500, NP: 80, appliance: 25 },
          { gpm: 750, NP: 80, appliance: 25 },
          { gpm: 1000, NP: 80, appliance: 25 }
        ];
        S2.ms = pick(opts);
        changeText = `Change master stream flow to ${S2.ms.gpm} gpm.`;
      }
    }

    const b2 = computeAll(S2);
    q.scenario = S2;
    q.prompt = `[${S2.type.toUpperCase()} • ADJUST] Adjustment: ${changeText} What is the NEW PDP?`;
    q.answer = b2.PDP;
    return q;
  }

  // REVERSE
  if(qKind==='REVERSE'){
    if(baseS.type==='single'){
      q.prompt = 'Reverse: What is the Main friction loss (psi)?';
      q.unitHint = 'psi';
      q.answer = base.mainFL;
      q.revealHtml = `
        <div><b>Reverse: Main Friction Loss</b></div>
        <ul class="simpleList">
          <li>Flow = <b>${base.flow} gpm</b></li>
          <li>Main FL = <b>${base.mainFL} psi</b></li>
        </ul>
        <div><b>Answer = <span class="ok">${base.mainFL} psi</span></b></div>
      `;
      return q;
    }

    if(baseS.type==='wye2'){
      const target = weightedPick([
        {v:'TOTAL_GPM', w:35},
        {v:'MAIN_FL', w:40},
        {v:'HIGHER_NEED', w:25}
      ]);
      if(target==='TOTAL_GPM'){
        q.prompt = 'Reverse: What is the TOTAL flow through the main line (GPM)?';
        q.unitHint = 'gpm';
        q.answer = Math.round(base.flow);
        return q;
      }
      if(target==='HIGHER_NEED'){
        q.prompt = 'Reverse: What is the required pressure at the wye (higher branch need), before main FL/elevation?';
        q.unitHint = 'psi';
        q.answer = Math.round(base.higherNeed);
        return q;
      }
      q.prompt = 'Reverse: What is the Main friction loss feeding the wye (psi)?';
      q.unitHint = 'psi';
      q.answer = base.mainFL;
      return q;
    }

    // master
    const target = weightedPick([
      {v:'PER_LINE_GPM', w:45},
      {v:'LINE_FL', w:55}
    ]);
    if(target==='PER_LINE_GPM'){
      q.prompt = `[${baseS.type.toUpperCase()} • REVERSE] Reverse: Total flow is ${base.totalGPM} gpm. What is the per-line GPM (two equal 2½″ lines)?`;
      q.unitHint = 'gpm';
      q.answer = Math.round(base.perLine);
      return q;
    }
    q.prompt = 'Reverse: What is the friction loss (psi) in each 2½″ line?';
    q.unitHint = 'psi';
    q.answer = base.flPer;
    return q;
  }

  // PP
  return q;
}

function buildRevealForQuestion(q){
  // If a special reveal was prepared, use it.
  if(q.revealHtml){
    return { total: q.answer, html: q.revealHtml };
  }

  // Default: reuse existing PP breakdown (works for PP and ADJUST)
  if(q.questionType==='YN'){
    return { total: q.answer, html: q.revealHtml || '' };
  }

  // For numeric reverse questions without custom reveal, provide a concise explanation.
  if(q.qKind==='REVERSE'){
    const base = computeAll(q.scenario);
    if(q.unitHint==='gpm'){
      if(q.scenario.type==='wye2'){
        return {
          total: q.answer,
          html: `
            <div><b>Reverse: Total Flow</b></div>
            <ul class="simpleList">
              <li>Branch A = <b>${q.scenario.bnA.noz.gpm} gpm</b></li>
              <li>Branch B = <b>${q.scenario.bnB.noz.gpm} gpm</b></li>
              <li>Total = A + B = <b>${Math.round(base.flow)} gpm</b></li>
            </ul>
            <div><b>Answer = <span class="ok">${Math.round(base.flow)} gpm</span></b></div>
          `
        };
      }
      // master per-line gpm
      return {
        total: q.answer,
        html: `
          <div><b>Reverse: Per-line Flow</b></div>
          <ul class="simpleList">
            <li>Total = <b>${base.totalGPM} gpm</b></li>
            <li>Per-line = total ÷ 2 = <b>${Math.round(base.perLine)} gpm</b></li>
          </ul>
          <div><b>Answer = <span class="ok">${Math.round(base.perLine)} gpm</span></b></div>
        `
      };
    }
    // otherwise just show computed piece and PP breakdown
    return buildReveal(q.scenario);
  }

  return buildReveal(q.scenario);
}

// NOTE: generateScenarioBase returns ONLY a visual scenario/layout.
// Questions are built on top of it via makeQuestion().
function generateScenarioBase(){
  let S;
  for(let i=0;i<18;i++){
    S = makeScenario();
    if(S.PDP <= 270) return S;
  }
  return S;
}


// ---------- reveal builder ----------
function flSteps(gpm, size, lenFt, label){
  const C = COEFF[size];
  const per100 = C * Math.pow(gpm/100, 2);
  const flLen = per100 * (lenFt/100);
  return {
    text1: `${label} FL = C × (GPM/100)² × (length/100)`,
    text2: `= ${C} × (${gpm}/100)² × (${lenFt}/100)`,
    value: Math.round(flLen)
  };
}
function buildReveal(S){
  const E = (S.elevFt||0) * PSI_PER_FT;
  if(S.type==='single'){
    const mFL = flSteps(S.flow, S.mainSize, S.mainLen, 'Main');
    const total = S.mainNoz.NP + mFL.value + E;
    return {
      total: Math.round(total),
      html: `
        <div><b>PP Breakdown (Single line)</b></div>
        <ul class="simpleList">
          <li>Nozzle Pressure = <b>${S.mainNoz.NP} psi</b></li>
          <li>${mFL.text1}</li>
          <li>${mFL.text2} → <b>${mFL.value} psi</b></li>
          <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
        </ul>
        <div><b>PP = ${S.mainNoz.NP} + ${mFL.value} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
      `
    };
  }
  if(S.type==='wye2'){
    const flow = S.bnA.noz.gpm + S.bnB.noz.gpm;
    const mainFL = flSteps(flow, S.mainSize, S.mainLen, 'Main');
    const aFL = flSteps(S.bnA.noz.gpm, '1.75', S.bnA.len, 'Branch A');
    const bFL = flSteps(S.bnB.noz.gpm, '1.75', S.bnB.len, 'Branch B');
    const needA = S.bnA.noz.NP + aFL.value;
    const needB = S.bnB.noz.NP + bFL.value;
    const higher = Math.max(needA, needB);
    const total = higher + mainFL.value + 10 + E;
    return {
      total: Math.round(total),
      html: `
        <div><b>PP Breakdown (Two-branch wye)</b></div>
        <ul class="simpleList">
          <li>Branch A need = NP ${S.bnA.noz.NP} + FL_A = <b>${Math.round(needA)} psi</b></li>
          <li>  • ${aFL.text1}</li>
          <li>  • ${aFL.text2} → <b>${aFL.value} psi</b></li>
          <li>Branch B need = NP ${S.bnB.noz.NP} + FL_B = <b>${Math.round(needB)} psi</b></li>
          <li>  • ${bFL.text1}</li>
          <li>  • ${bFL.text2} → <b>${bFL.value} psi</b></li>
          <li>Take higher branch = <b>${Math.round(higher)} psi</b></li>
          <li>${mainFL.text1}</li>
          <li>${mainFL.text2} → <b>${mainFL.value} psi</b></li>
          <li>Wye loss = +<b>10 psi</b></li>
          <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
        </ul>
        <div><b>PP = ${Math.round(higher)} + ${mainFL.value} + 10 ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
      `
    };
  }
  // master
  const totalGPM = S.ms.gpm;
  const perLine = totalGPM/2;
  const a = flSteps(perLine, '2.5', S.line1.len, 'Preconnect 1');
  const b = flSteps(perLine, '2.5', S.line2.len, 'Preconnect 2');
  const worst = Math.max(a.value, b.value);
  const total = S.ms.NP + worst + S.ms.appliance + E;
  return {
    total: Math.round(total),
    html: `
      <div><b>PP Breakdown (Master stream; two equal 2½″ lines)</b></div>
      <ul class="simpleList">
        <li>Total GPM = <b>${totalGPM} gpm</b> → per-line = <b>${perLine} gpm</b></li>
        <li>Master NP = <b>${S.ms.NP} psi</b></li>
        <li>Appliance loss = <b>${S.ms.appliance} psi</b></li>
        <li>${a.text1}</li>
        <li>${a.text2} → <b>${a.value} psi</b></li>
        <li>${b.text1}</li>
        <li>${b.text2} → <b>${b.value} psi</b></li>
        <li>Take higher line FL = <b>${Math.round(worst)} psi</b></li>
        <li>Elevation = ${E>=0?'+':''}${Math.round(E)} psi</li>
      </ul>
      <div><b>PP = ${S.ms.NP} + ${Math.round(worst)} + ${S.ms.appliance} ${E>=0?'+':''}${Math.round(E)} = <span class="ok">${Math.round(total)} psi</span></b></div>
    `
  };
}

// ---------- bubble labels (non-overlapping) ----------
const placedBoxes = [];
function overlaps(a,b){
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
function nudge(attempt, sideBias){
  const dy = -12; // prefer upward
  const dx = ((attempt % 4) - 1.5) * 8 + sideBias; // small lateral jitter + side bias
  return { dx, dy };
}
function addBubble(G_labelsP, x, y, text, side='C'){
  const pad = 4;

  // Measure text first offscreen
  const t = document.createElementNS(ns,'text');
  t.setAttribute('x', -1000);
  t.setAttribute('y', -1000);
  t.setAttribute('text-anchor','middle');
  t.setAttribute('fill','#0b0f14');
  t.setAttribute('font-size','12');
  t.textContent = text;
  G_labelsP.appendChild(t);

  let bb = t.getBBox();
  let box = { x: x - bb.width/2 - pad, y: y - bb.height - pad, w: bb.width + pad*2, h: bb.height + pad*2 };

  const sideBias = side==='L' ? -10 : side==='R' ? 10 : 0;
  let tries = 0;
  while(placedBoxes.some(b => overlaps(b, box)) && tries < 32){
    const {dx, dy} = nudge(tries++, sideBias);
    box.x += dx;
    box.y += dy;
  }

  const r = document.createElementNS(ns,'rect');
  r.setAttribute('x', box.x);
  r.setAttribute('y', box.y);
  r.setAttribute('width', box.w);
  r.setAttribute('height', box.h);
  r.setAttribute('rx','4'); r.setAttribute('ry','4');
  r.setAttribute('fill', '#eaf2ff'); r.setAttribute('stroke', '#111'); r.setAttribute('stroke-width', '.5');

  t.setAttribute('x', box.x + box.w/2);
  t.setAttribute('y', box.y + box.h - 4 - 1);

  const g = document.createElementNS(ns,'g');
  g.appendChild(r); g.appendChild(t);
  G_labelsP.appendChild(g);

  placedBoxes.push(box);
}

// ---------- nozzle graphics ----------
// Draws a small nozzle oriented UP (no rotation math needed).
// Scales slightly by hose size; colors match hose color on the coupling.
function drawNozzle(G, x, y, hoseSize, scale = 1) {
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('transform', `translate(${x},${y})`);

  // choose hose class / color
  const hoseClass = hoseSize === '2.5' ? 'hose25' : 'hose175';
  const couplingStroke = hoseSize === '2.5' ? '#3b82f6' : '#ef4444';

  // coupling (short stub where hose meets nozzle)
  const coupling = document.createElementNS(ns, 'rect');
  coupling.setAttribute('x', -4 * scale);
  coupling.setAttribute('y', -8 * scale);
  coupling.setAttribute('width', 8 * scale);
  coupling.setAttribute('height', 6 * scale);
  coupling.setAttribute('rx', 2 * scale);
  coupling.setAttribute('ry', 2 * scale);
  coupling.setAttribute('fill', '#f3f4f6');
  coupling.setAttribute('stroke', couplingStroke);
  coupling.setAttribute('stroke-width', 1);

  // nozzle body (slight taper)
  const body = document.createElementNS(ns, 'polygon');
  // points relative to (0,0): draw upward
  const pts = [
    [-3*scale, -8*scale],
    [ 3*scale, -8*scale],
    [ 5*scale, -14*scale],
    [-5*scale, -14*scale]
  ].map(p=>p.join(',')).join(' ');
  body.setAttribute('points', pts);
  body.setAttribute('fill', '#9ca3af');
  body.setAttribute('stroke', '#111');
  body.setAttribute('stroke-width', .6);

  // tip
  const tip = document.createElementNS(ns, 'polygon');
  const tpts = [
    [-2*scale, -14*scale],
    [ 2*scale, -14*scale],
    [ 0,       -18*scale],
  ].map(p=>p.join(',')).join(' ');
  tip.setAttribute('points', tpts);
  tip.setAttribute('fill', '#6b7280');
  tip.setAttribute('stroke', '#111');
  tip.setAttribute('stroke-width', .6);

  group.appendChild(coupling);
  group.appendChild(body);
  group.appendChild(tip);
  G.appendChild(group);
}

// ---------- rendering ----------
export function render(container) {
  container.innerHTML = `
    <style>
      .practice-actions .btn { min-height: 40px; }

      /* Make New Question stand out more */
      .practice-actions #newScenarioBtn {
        font-weight: 600;
        min-width: 120px;
      }

      .stage { min-height: 180px; display:flex; align-items:center; justify-content:center; }
      .status { font-size: 14px; color: #e5e7eb; }
            .sub { font-size: 13px; color: #cbd5e1; opacity: .9; }
      .promptRow { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .qChip { padding:4px 10px; border-radius:999px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.18); color:#ffffff; font-size:12px; letter-spacing:.5px; text-transform:uppercase; }
      .promptText { color:#ffffff; font-size:15px; }
      .promptText b { color:#ffffff; }
.math { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace; font-size: 14px; line-height: 1.4; }
      .btn { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; cursor: pointer; }
      .btn.primary { background: #0ea5e9; border-color: #0284c7; color: white; }

      /* Hose styling — 1¾″ red, 2½″ blue */
      .hoseBase { fill: none; stroke-width: 10; stroke-linecap: round; }
      .hose175 { stroke: #ef4444; } /* red */
      .hose25  { stroke: #3b82f6; } /* blue */
      .shadow  { stroke: rgba(0,0,0,.22); stroke-width: 12; }

      /* Equations box: white text on black */
      #eqBox {
        background:#0b0f14;
        color:#ffffff;
        border-radius:12px;
        padding:10px 12px;
        border:1px solid rgba(255,255,255,.15);
      }
      #eqBox code {
        background: transparent;
        color: #e6f3ff;
        padding: 0 2px;
      }

      /* NEW: ensure the SVG fills and paints cleanly before first question */
      #overlayPractice{width:100%;display:block}
    
    .partLabel{display:block;font-size:13px;opacity:.9;margin-bottom:4px;color:#e6f3ff}
    .partPrompt{font-size:13px;opacity:.95;margin:4px 0 6px;color:#ffffff}
    .revealLead{font-weight:700;margin-top:6px;color:#ffffff}
</style>

    <section class="card">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:space-between">
        <div>
          <b>Practice Mode</b>
          <div class="sub">Use the graphic info to answer the prompt.</div>
        </div>
        <div class="practice-actions" style="display:flex;gap:8px;flex-wrap:wrap">
<button class="btn" id="eqToggleBtn">Equations</button>
          <button class="btn" id="revealBtn">Reveal</button>
        </div>
      </div>
    </section>

    <section class="wrapper card">
      <div class="stage" id="stageP">
        <svg id="overlayPractice" preserveAspectRatio="xMidYMax meet" aria-label="Visual stage (practice)">
          <image id="truckImgP" href="assets/engine181.png" width="390" height="260" preserveAspectRatio="xMidYMax meet" onerror="this.setAttribute('href','https://fireopssim.com/pump/engine181.png')"></image>          <g id="hosesP"></g><g id="branchesP"></g><g id="labelsP"></g><g id="nozzlesP"></g>
        </svg>
      </div>

      <div id="eqBox" style="margin-top:6px; display:none"></div>

      <div id="practiceInfo" class="status promptSticky">Loading first question…</div>
      <div id="work" class="math" style="margin-top:8px"></div>
    </section>

    <section class="card">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1;min-width:200px">
          <div id="answersWrap"></div>
        </div>
        <div class="field" style="width:170px;max-width:200px">
          <button class="btn primary" id="checkBtn" style="width:100%">Check (±${TOL} psi)</button>
        </div>
      </div>

      <div class="field" style="margin-top:10px">
        <button class="btn" id="newScenarioBtn" style="width:100%">New Question</button>
      </div>

      <div id="practiceStatus" class="status" style="margin-top:8px">No scenario loaded.</div>
    </section>
  `;

  injectStyle(container, `
    input, select, textarea, button { font-size:16px; } /* prevent iOS zoom on iPhone */
  `);

  // refs
  const stageEl = container.querySelector('#stageP');
  const svg = container.querySelector('#overlayPractice');
  const truckImg = container.querySelector('#truckImgP');
  const G_hosesP = container.querySelector('#hosesP');
  const G_branchesP = container.querySelector('#branchesP');
  const G_labelsP = container.querySelector('#labelsP');
  const G_nozzlesP = container.querySelector('#nozzlesP');

  const practiceInfo = container.querySelector('#practiceInfo');
  const statusEl = container.querySelector('#practiceStatus');
  const workEl = container.querySelector('#work');
  const eqBox = container.querySelector('#eqBox');
  const eqToggleBtn = container.querySelector('#eqToggleBtn');
  const answersWrapEl = container.querySelector('#answersWrap');
  let guessEl = null; // set by renderAnswerUI()
  const answerLabelEl = null; // legacy label removed
  const checkBtnEl = container.querySelector('#checkBtn');

  let scenario = null;
  let currentQ = null;
  let practiceAnswer = null;
  let eqVisible = false;

  // ----- UI copy (consistent across question types) -----
  const UI_COPY = {
    chips: {
      PP: 'PDP CALCULATION',
      ADJUST: 'ADJUSTMENT',
      REVERSE: 'REVERSE CALCULATION',
      CHECK: 'DECISION CHECK',
    },
    input: {
      psiLabel: 'Your answer (psi)',
      psiPlaceholder: 'Enter pressure in psi',
      gpmLabel: 'Your answer (gpm)',
      gpmPlaceholder: 'Enter flow in gpm',
      ynLabel: 'Your answer (Y / N)',
      ynPlaceholder: 'Enter Y or N',
    },
    buttons: {
      checkPsi: `Check (±${TOL} psi)`,
      checkGpm: `Check (±${TOL})`,
      checkYN: 'Check (Y/N)',
    },
    feedback: {
      correct: {
        PP: 'Correct. This is the required pump discharge pressure.',
        ADJUST: 'Correct. Pump pressure adjusted appropriately.',
        REVERSE: 'Correct. You isolated the correct value.',
        CHECK_Y: 'Correct. This setup is within safe operating limits.',
        CHECK_N: 'Correct. This setup exceeds safe operating limits.',
      },
      incorrect: {
        PP: 'Not quite. Review nozzle pressure, friction loss, and elevation.',
        ADJUST: 'Not quite. Recalculate using the updated setup.',
        REVERSE: 'Not quite. Work backward from the total PDP.',
        CHECK: 'Not quite. Compare required PDP to the pump limit.',
      },
    },
    revealLead: {
      PP: 'Pump to meet the highest required pressure.',
      ADJUST: 'Changes in flow or elevation affect friction loss and required pressure.',
      REVERSE: 'Work backward from PDP by removing known values.',
      CHECK: 'Pump operators must verify operations stay within equipment limits.',
    },
  };


  // ----- JSON practice bank (for future flexibility) -----
  const DEFAULT_PRACTICE_BANK = {
    version: 1,
    packId: 'core_dopumper',
    defaults: { tolerancePsi: TOL, pumpLimitPsi: 150 },
    templates: [
      {
        id: 'tender_can_supply_from_diagram',
        topic: 'tender_shuttle',
        layout: 'from_current_diagram',
        type: 'MULTIPART',
        weight: 12,
        chip: 'TENDER SHUTTLE',
        prompt: 'Answer both parts:',
        parts: [
          {
            id: 'p1_flow',
            prompt: 'Based on the diagram, how many gpm is flowing?',
            answerKey: 'totalGpm',
            unit: 'gpm',
            answerType: 'number'
          },
          {
            id: 'p2_can_supply',
            prompt: 'You have 1 tender carrying 3000 gallons with a 15 minute round trip. Can it supply the required gpm? (Y/N)',
            answerKey: 'tenderCanSupply',
            unit: 'YN',
            answerType: 'yn',
            uses: { tender: { tankGallons: 3000, turnaroundMinutes: 15 } }
          }
        ],
        revealLead: 'First determine required flow, then compare to sustained tender flow (tank ÷ turnaround).'
      }
    ]
  };

  async function loadPracticeBank(){
    try{
      const res = await fetch('./practice/practiceBank.core.json', { cache: 'no-store' });
      if(!res.ok) throw new Error('bad status');
      const bank = await res.json();
      if(!bank || !Array.isArray(bank.templates)) throw new Error('bad json');
      return bank;
    }catch(_){
      return DEFAULT_PRACTICE_BANK;
    }
  }

  function pickBankTemplate(bank){
    const list = (bank?.templates||[]).filter(t => t && typeof t.weight === 'number' && t.weight > 0);
    if(!list.length) return null;
    const sum = list.reduce((a,t)=>a+t.weight,0);
    let r = Math.random()*sum;
    for(const t of list){ if((r-=t.weight)<=0) return t; }
    return list[list.length-1];
  }

  function computeDerivedForBankQuestion(q){
    const S = q.layout;
    const base = q.base || computeAll(S);
    const totalGpm =
      (S.type==='single') ? base.flow :
      (S.type==='wye2')   ? base.flow :
      (S.type==='master') ? base.totalGPM : 0;

    return {
      totalGpm: Math.round(totalGpm),
      PDP: base.PDP,
      mainFL: base.mainFL,
      higherNeed: base.higherNeed,
      _base: base
    };
  }

  function evaluateBankTemplate(template, derived){
    const parts = (template.parts||[]).map(p => {
      let ans = null;

      // Stable derived values from the current diagram
      if(p.answerKey === 'totalGpm') ans = derived.totalGpm;
      if(p.answerKey === 'PDP') ans = derived.PDP;

      // ----- Tender shuttle (simple model: sustained gpm = tank ÷ turnaround) -----
      const tank = p?.uses?.tender?.tankGallons ?? 3000;
      const tmin = p?.uses?.tender?.turnaroundMinutes ?? 15;
      const sustained = tank / tmin;

      if(p.answerKey === 'tenderSustainedGpm'){
        ans = Math.round(sustained * 10) / 10;
      }
      if(p.answerKey === 'tenderCanSupply'){
        ans = sustained >= derived.totalGpm ? 'Y' : 'N';
      }
      if(p.answerKey === 'tenderCountNeeded'){
        ans = Math.max(1, Math.ceil(derived.totalGpm / sustained));
      }
      if(p.answerKey === 'tenderMaxTurnaround'){
        ans = Math.round((tank / Math.max(1, derived.totalGpm)) * 10) / 10;
      }

      // ----- Foam helpers -----
      const foamPct = p?.uses?.foam?.percent ?? null;
      const foamFlow = p?.uses?.foam?.solutionGpm ?? derived.totalGpm;
      const foamMin  = p?.uses?.foam?.minutes ?? null;
      const foamOnboard = p?.uses?.foam?.onboardGallons ?? null;

      if(p.answerKey === 'foamConcentrateGpm' && foamPct != null){
        ans = Math.round((foamFlow * (foamPct/100)) * 10) / 10;
      }
      if(p.answerKey === 'foamConcentrateGallons' && foamPct != null && foamMin != null){
        const concGpm = (foamFlow * (foamPct/100));
        ans = Math.round((concGpm * foamMin) * 10) / 10;
      }
      if(p.answerKey === 'foamEnoughYN' && foamPct != null && foamMin != null && foamOnboard != null){
        const concGpm = (foamFlow * (foamPct/100));
        const need = concGpm * foamMin;
        ans = foamOnboard >= need ? 'Y' : 'N';
      }

      // ----- Standpipe helpers (simplified) -----
      const floorsUp = p?.uses?.standpipe?.floorsUp ?? null;
      const psiPerFloor = p?.uses?.standpipe?.psiPerFloor ?? 5;
      const outletPsi = p?.uses?.standpipe?.outletPsi ?? null;
      const flowGpm = p?.uses?.standpipe?.flowGpm ?? 150;
      const hoseLenFt = p?.uses?.standpipe?.hoseLenFt ?? 150;
      const hoseSize = p?.uses?.standpipe?.hoseSize ?? '1.75';
      const applianceLoss = p?.uses?.standpipe?.applianceLossPsi ?? 0;
      const pumpLimit = p?.uses?.standpipe?.pumpLimitPsi ?? 150;

      function standpipeHoseFL(){
        const len100 = hoseLenFt / 100;
        if(String(hoseSize) === '2.5') return FL_25(flowGpm) * len100;
        return FL_175(flowGpm) * len100;
      }

      if(p.answerKey === 'standpipePDP' && floorsUp != null && outletPsi != null){
        const elevPsi = floorsUp * psiPerFloor;
        const fl = standpipeHoseFL();
        ans = Math.round(outletPsi + applianceLoss + elevPsi + fl);
      }

      if(p.answerKey === 'standpipeAcceptableYN' && floorsUp != null && outletPsi != null){
        const elevPsi = floorsUp * psiPerFloor;
        const fl = standpipeHoseFL();
        const pdp = Math.round(outletPsi + applianceLoss + elevPsi + fl);
        ans = pdp <= pumpLimit ? 'Y' : 'N';
      }

      const usesOut = p.uses ? JSON.parse(JSON.stringify(p.uses)) : null;
      // If this is a foam question and solutionGpm was omitted in JSON, inject the diagram flow so reveals can show the math.
      if(usesOut && usesOut.foam){
        if(usesOut.foam.solutionGpm == null) usesOut.foam.solutionGpm = foamFlow;
      }
      return { id:p.id, prompt:p.prompt, unit:p.unit, answerType:p.answerType, answer:ans, uses:usesOut };
    });

    return {
      questionType: 'MULTI',
      qKind: 'MULTI',
      unitHint: '',
      chip: template.chip || 'MULTIPART',
      prompt: template.prompt || 'Answer all parts:',
      revealLead: template.revealLead || '',
      parts
    };
  }

  function renderAnswerUI(q){
    if(!answersWrapEl) return;

    if(q.questionType === 'MULTI'){
      const parts = Array.isArray(q.parts) ? q.parts : [];
      const html = parts.map((p, i)=>{
        const unitRaw = (p.unit || '');
        const unit = unitRaw.toLowerCase();
        const isYN = (p.answerType === 'yn') || unit === 'yn' || unit === 'y/n';
        const isGpm = unit === 'gpm';
        const isMin = unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes';
        const isTenders = unit === 'tenders' || unit === 'tender';
        const isGal = unit === 'gal' || unit === 'gallons';
        const label = isYN ? `Part ${i+1} (Y / N)`
                    : isGpm ? `Part ${i+1} (gpm)`
                    : isMin ? `Part ${i+1} (min)`
                    : isTenders ? `Part ${i+1} (tenders)`
                    : isGal ? `Part ${i+1} (gal)`
                    : unitRaw ? `Part ${i+1} (${unitRaw})`
                    : `Part ${i+1}`;
        const placeholder = isYN ? 'Enter Y or N'
                          : isGpm ? 'Enter flow in gpm'
                          : isTenders ? 'Enter number of tenders'
                          : isMin ? 'Enter minutes'
                          : isGal ? 'Enter gallons'
                          : 'Enter answer';
        const inputmode = isYN ? 'text' : 'decimal';
        const extra = isYN ? 'autocapitalize="characters"' : '';
        const mt = i===0 ? '' : 'margin-top:10px';
        return `
          <div class="partBlock" style="${mt}">
            <label class="partLabel">${label}</label>
            <div class="partPrompt">${p.prompt || ''}</div>
            <input class="partInput" data-part="${i}" type="text" inputmode="${inputmode}" autocomplete="off" spellcheck="false" placeholder="${placeholder}"
              style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" ${extra}>
          </div>
        `;
      }).join('');
      answersWrapEl.innerHTML = html || '<div style="opacity:.85">No parts defined.</div>';
      guessEl = answersWrapEl.querySelector('input.partInput') || null;
      return;
    }
    const isYN = q.questionType === 'YN';
    const isGpm = !isYN && String(q.unitHint||'').toLowerCase() === 'gpm';
    const label = isYN ? UI_COPY.input.ynLabel : (isGpm ? UI_COPY.input.gpmLabel : UI_COPY.input.psiLabel);
    const ph = isYN ? UI_COPY.input.ynPlaceholder : (isGpm ? UI_COPY.input.gpmPlaceholder : UI_COPY.input.psiPlaceholder);
    const inputmode = isYN ? 'text' : 'decimal';

    answersWrapEl.innerHTML = `
      <label class="partLabel">${label}</label>
      <input type="text" id="ppGuess" placeholder="${ph}" style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;" inputmode="${inputmode}" autocomplete="off" spellcheck="false" ${isYN?'autocapitalize="characters"':''}>
    `;
    guessEl = answersWrapEl.querySelector('#ppGuess');
  }

  function gradeMultipart(q){
    const inputs = Array.from(answersWrapEl?.querySelectorAll('input.partInput') || []);
    const results = [];
    for(const inp of inputs){
      const idx = Number(inp.getAttribute('data-part'));
      const part = q.parts[idx];
      const raw = (inp.value||'').trim().toUpperCase();

      if(part.answerType === 'yn'){
        const v = raw.startsWith('Y') ? 'Y' : raw.startsWith('N') ? 'N' : '';
        results.push({ idx, ok: v && v === String(part.answer).toUpperCase(), user: v || raw, answer: part.answer });
      }else{
        const n = Number(raw);
        const ok = Number.isFinite(n) && Math.abs(n - Number(part.answer)) <= (DEFAULT_PRACTICE_BANK.defaults?.tolerancePsi ?? TOL);
        results.push({ idx, ok, user: n, answer: part.answer });
      }
    }
    return { allOk: results.length && results.every(r=>r.ok), results };
  }


  function qKindToChip(q){
    if(!q) return '';
    if(q.chip) return q.chip;
    if(q.questionType === 'YN') return UI_COPY.chips.CHECK;
    if(q.qKind === 'ADJUST') return UI_COPY.chips.ADJUST;
    if(q.qKind === 'REVERSE') return UI_COPY.chips.REVERSE;
    return UI_COPY.chips.PP;
  }

  function correctMsg(q){
    if(!q) return UI_COPY.feedback.correct.PP;
    if(q.questionType === 'YN'){
      return String(practiceAnswer).toUpperCase() === 'Y'
        ? UI_COPY.feedback.correct.CHECK_Y
        : UI_COPY.feedback.correct.CHECK_N;
    }
    if(q.qKind === 'ADJUST') return UI_COPY.feedback.correct.ADJUST;
    if(q.qKind === 'REVERSE') return UI_COPY.feedback.correct.REVERSE;
    return UI_COPY.feedback.correct.PP;
  }

  function incorrectMsg(q){
    if(!q) return UI_COPY.feedback.incorrect.PP;
    if(q.questionType === 'YN') return UI_COPY.feedback.incorrect.CHECK;
    if(q.qKind === 'ADJUST') return UI_COPY.feedback.incorrect.ADJUST;
    if(q.qKind === 'REVERSE') return UI_COPY.feedback.incorrect.REVERSE;
    return UI_COPY.feedback.incorrect.PP;
  }

  function revealLeadMsg(q){
    if(!q) return UI_COPY.revealLead.PP;
    if(q.questionType === 'YN') return UI_COPY.revealLead.CHECK;
    if(q.qKind === 'ADJUST') return UI_COPY.revealLead.ADJUST;
    if(q.qKind === 'REVERSE') return UI_COPY.revealLead.REVERSE;
    return UI_COPY.revealLead.PP;
  }

  function diagnoseMistake(q, guessNum){
    // Returns a short, specific hint when we can detect a common miss.
    try{
      if(!q || q.questionType === 'YN' || !Number.isFinite(guessNum)) return '';
      const base = computeAll(q.scenario);
      const expected = Number(q.answer);
      const diff = (a,b)=>Math.abs(a-b);

      // Elevation forgotten (any layout)
      if(base.Epsi && diff(guessNum, expected - base.Epsi) <= TOL){
        return 'Hint: elevation was not applied.';
      }

      // Wye loss forgotten
      if(q.scenario.type === 'wye2' && diff(guessNum, expected - 10) <= TOL){
        return 'Hint: add 10 psi for the wye.';
      }

      // Master appliance forgotten
      if(q.scenario.type === 'master' && q.scenario.ms?.appliance && diff(guessNum, expected - q.scenario.ms.appliance) <= TOL){
        return 'Hint: include appliance loss.';
      }

      // Pumped for lower-loss branch on wye
      if(q.scenario.type === 'wye2'){
        const lowerNeed = Math.min(base.needA, base.needB);
        const usingLower = Math.round(lowerNeed + base.mainFL + 10 + base.Epsi);
        if(diff(guessNum, usingLower) <= TOL){
          return 'Hint: pump to the higher-loss branch (use the higher branch need).';
        }
      }

      // Reverse: user entered total PDP instead of the component
      if(q.qKind === 'REVERSE' && Number.isFinite(base.PDP) && diff(guessNum, base.PDP) <= TOL){
        return 'Hint: that is the total PDP—work backward to isolate the requested value.';
      }

      return '';
    }catch(_){
      return '';
    }
  }

  /* NEW: set an initial SVG size so the truck is fully visible before first question */
  {
    const initH = TRUCK_H + 20;
    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${initH}`);
    stageEl.style.height = initH + 'px';
    truckImg.setAttribute('y', String(truckTopY(initH)));
  }

  // -------- draw --------

  function drawScenario(S){
    // clear layers
    for (const g of [G_hosesP, G_branchesP, G_labelsP, G_nozzlesP]) {
      while (g.firstChild) g.removeChild(g.firstChild);
    }
    placedBoxes.length = 0;
    workEl.innerHTML = '';

    // --- responsive view size & scaling ---
    const baseH = TRUCK_H + 20; // truck height plus small padding

    // Work in "50 ft segments" so we can scale them on bigger screens.
    const segments =
      S.type === 'single'
        ? (S.mainLen / 50)
        : S.type === 'wye2'
        ? (Math.max(S.bnA.len, S.bnB.len) / 50)
        : (S.line1.len / 50); // master

    // Default px-per-50ft tuned for phones.
    let pxPer50 = PX_PER_50FT;

    // On wider screens, cap the total stage height so the hose doesn't run
    // off the top and the truck doesn't get buried under the answer section.
    const isWide = (typeof window !== 'undefined' && window.innerWidth >= 768);
    const maxViewH = isWide ? 380 : Infinity; // visual cap for larger displays

    let extra = segments * pxPer50 + BRANCH_LIFT + 20;
    let viewH = Math.ceil(baseH + extra);

    if (isWide && viewH > maxViewH) {
      const extraAvailable = Math.max(60, maxViewH - baseH - BRANCH_LIFT - 20);
      const segs = Math.max(1, segments);
      const pxPer50Cap = extraAvailable / segs;
      // Don't crush it too much; keep hoses visually meaningful.
      pxPer50 = Math.max(20, Math.min(PX_PER_50FT, pxPer50Cap));

      extra = segs * pxPer50 + BRANCH_LIFT + 20;
      viewH = Math.ceil(baseH + extra);
    }

    svg.setAttribute('viewBox', `0 0 ${TRUCK_W} ${viewH}`);
    stageEl.style.height = viewH + 'px';
    truckImg.setAttribute('y', String(truckTopY(viewH)));

    if (S.type === 'single' || S.type === 'wye2') {
      const totalPx = (S.mainLen / 50) * pxPer50;
      const geom = mainCurve(totalPx, viewH);

      // main
      const sh = document.createElementNS(ns, 'path');
      sh.setAttribute('class', 'hoseBase shadow');
      sh.setAttribute('d', geom.d);
      G_hosesP.appendChild(sh);

      const main = document.createElementNS(ns, 'path');
      main.setAttribute('class', `hoseBase ${S.mainSize === '2.5' ? 'hose25' : 'hose175'}`);
      main.setAttribute('d', geom.d);
      G_hosesP.appendChild(main);

      // nozzle for single; for wye, we put nozzles on branches
      if (S.type === 'single') {
        drawNozzle(G_nozzlesP, geom.endX, geom.endY, S.mainSize, S.mainSize === '2.5' ? 1.1 : 1);
      }

      if (S.type === 'wye2') {
        // A
        const aPx = (S.bnA.len / 50) * pxPer50;
        const aGeom = straightBranch('L', geom.endX, geom.endY, aPx);
        const aSh = document.createElementNS(ns, 'path');
        aSh.setAttribute('class', 'hoseBase shadow');
        aSh.setAttribute('d', aGeom.d);
        G_branchesP.appendChild(aSh);
        const a = document.createElementNS(ns, 'path');
        a.setAttribute('class', 'hoseBase hose175');
        a.setAttribute('d', aGeom.d);
        G_branchesP.appendChild(a);

        // B
        const bPx = (S.bnB.len / 50) * pxPer50;
        const bGeom = straightBranch('R', geom.endX, geom.endY, bPx);
        const bSh = document.createElementNS(ns, 'path');
        bSh.setAttribute('class', 'hoseBase shadow');
        bSh.setAttribute('d', bGeom.d);
        G_branchesP.appendChild(bSh);
        const b = document.createElementNS(ns, 'path');
        b.setAttribute('class', 'hoseBase hose175');
        b.setAttribute('d', bGeom.d);
        G_branchesP.appendChild(b);

        // branch nozzles
        drawNozzle(G_nozzlesP, aGeom.endX, aGeom.endY, '1.75', 1);
        drawNozzle(G_nozzlesP, bGeom.endX, bGeom.endY, '1.75', 1);

        // bubbles (non-overlap-ish)
        addBubble(
          G_labelsP,
          geom.endX,
          Math.max(12, geom.endY - 12),
          `${S.mainLen}′ ${sizeLabel(S.mainSize)}`,
          'C'
        );
        addBubble(
          G_labelsP,
          aGeom.endX,
          Math.max(12, aGeom.endY - 12),
          `A: ${S.bnA.len}′ 1¾″ — ${S.bnA.noz.gpm} gpm — NP ${S.bnA.noz.NP}${
            S.elevFt ? ` — Elev ${S.elevFt}′` : ''
          }`,
          'L'
        );
        addBubble(
          G_labelsP,
          bGeom.endX,
          Math.max(12, bGeom.endY - 12),
          `B: ${S.bnB.len}′ 1¾″ — ${S.bnB.noz.gpm} gpm — NP ${S.bnB.noz.NP}${
            S.elevFt ? ` — Elev ${S.elevFt}′` : ''
          }`,
          'R'
        );
      } else {
        addBubble(
          G_labelsP,
          geom.endX,
          Math.max(12, geom.endY - 12),
          `${S.mainLen}′ ${sizeLabel(S.mainSize)} — ${S.flow} gpm — NP ${S.mainNoz.NP}${
            S.elevFt ? ` — Elev ${S.elevFt}′` : ''
          }`,
          'C'
        );
      }
      return;
    }

    // master
    const { x: sx, y: sy } = pumpXY(viewH);
    const outLeftX = sx - 26;
    const outRightX = sx + 26;
    const outY = sy;
    const junctionY = Math.max(12, sy - (S.line1.len / 50) * pxPer50);
    const junctionX = sx;

    // left
    const aPath = `M ${outLeftX},${outY} L ${outLeftX},${outY - BRANCH_LIFT} L ${outLeftX},${junctionY} L ${junctionX},${junctionY}`;
    const aSh = document.createElementNS(ns, 'path');
    aSh.setAttribute('class', 'hoseBase shadow');
    aSh.setAttribute('d', aPath);
    G_branchesP.appendChild(aSh);
    const a = document.createElementNS(ns, 'path');
    a.setAttribute('class', 'hoseBase hose25');
    a.setAttribute('d', aPath);
    G_branchesP.appendChild(a);

    // right
    const bPath = `M ${outRightX},${outY} L ${outRightX},${outY - BRANCH_LIFT} L ${outRightX},${junctionY} L ${junctionX},${junctionY}`;
    const bSh = document.createElementNS(ns, 'path');
    bSh.setAttribute('class', 'hoseBase shadow');
    bSh.setAttribute('d', bPath);
    G_branchesP.appendChild(bSh);
    const b = document.createElementNS(ns, 'path');
    b.setAttribute('class', 'hoseBase hose25');
    b.setAttribute('d', bPath);
    G_branchesP.appendChild(b);

    // nozzle at master stream junction (a bit larger)
    drawNozzle(G_nozzlesP, junctionX, junctionY, '2.5', 1.25);

    // junction bubble labels
    addBubble(
      G_labelsP,
      outLeftX - 20,
      Math.max(12, junctionY - 12),
      `Preconnect 1: ${S.line1.len}′ 2½″`,
      'L'
    );
    addBubble(
      G_labelsP,
      outRightX + 20,
      Math.max(12, junctionY - 12),
      `Preconnect 2: ${S.line2.len}′ 2½″`,
      'R'
    );
    addBubble(
      G_labelsP,
      junctionX,
      Math.max(12, junctionY - 26),
      `Master: ${S.ms.gpm} gpm — NP ${S.ms.NP} — App ${S.ms.appliance}${
        S.elevFt ? ` — Elev ${S.elevFt}′` : ''
      }`,
      'C'
    );
  }
  // ---------- equations ----------
  function renderEquations(S){
    const base = `
      <div><b>Friction Loss (per section):</b> <code>FL = C × (GPM/100)² × (length/100)</code></div>
      <div style="margin-top:2px"><b>Elevation (psi):</b> <code>Elev = 0.05 × height(ft)</code></div>
      <div style="margin-top:4px"><b>C Coefficients:</b> 1¾″ = <b>${COEFF["1.75"]}</b>, 2½″ = <b>${COEFF["2.5"]}</b>, 5″ = <b>${COEFF["5"]}</b></div>
    `;
    if(!S){
      return base + `<div style="margin-top:6px">Generate a problem to see scenario-specific equations.</div>`;
    }
    if(S.type === 'single'){
      return `${base}
        <hr style="opacity:.2;margin:8px 0">
        <div><b>Single Line:</b> <code>PP = NP + MainFL ± Elev</code></div>`;
    }
    if(S.type === 'wye2'){
      return `${base}
        <hr style="opacity:.2;margin:8px 0">
        <div><b>Two-Branch Wye:</b> <code>PP = max(Need_A, Need_B) + MainFL + 10 ± Elev</code></div>`;
    }
    return `${base}
      <hr style="opacity:.2;margin:8px 0">
      <div><b>Master Stream (two equal 2½″ lines):</b> <code>PP = NP(ms) + max(FL_line) + Appliance ± Elev</code></div>`;
  }

  // ---------- interactions ----------
  function makePractice(){
    const q = makeQuestion();
    currentQ = q;
    scenario = q.scenario;

    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
      eqBox.style.display = 'block';
    }

    const rev = buildRevealForQuestion(q);
    practiceAnswer = (currentQ.questionType === 'MULTI') ? null : rev.total;

    drawScenario(scenario);
    renderAnswerUI(currentQ);

    // Prompt
    practiceInfo.innerHTML = `<div class="promptRow">`+
      `<span class="qChip">${qKindToChip(currentQ)}</span>`+
      `<span class="promptText"><b>Prompt:</b> ${currentQ.prompt}</span>`+
    `</div>`;

    // Update label + check button to match question type
    if(answerLabelEl){
      if(q.questionType === 'YN') answerLabelEl.textContent = UI_COPY.input.ynLabel;
      else if((q.unitHint||'').toLowerCase() === 'gpm') answerLabelEl.textContent = UI_COPY.input.gpmLabel;
      else answerLabelEl.textContent = UI_COPY.input.psiLabel;
    }
    if(checkBtnEl){
      if(q.questionType === 'YN') checkBtnEl.textContent = UI_COPY.buttons.checkYN;
      else checkBtnEl.textContent = UI_COPY.buttons.checkPsi;
    }

    // Input type hints + keyboard behavior
    if(q.questionType === 'YN'){
      guessEl.placeholder = UI_COPY.input.ynPlaceholder;
      guessEl.setAttribute('inputmode','text');
      guessEl.setAttribute('autocomplete','off');
      guessEl.setAttribute('autocapitalize','characters');
      guessEl.setAttribute('spellcheck','false');
      statusEl.textContent = 'Enter Y or N, then press Check.';
    } else if((q.unitHint||'').toLowerCase() === 'gpm'){
      guessEl.placeholder = UI_COPY.input.gpmPlaceholder;
      guessEl.setAttribute('inputmode','decimal');
      guessEl.setAttribute('autocomplete','off');
      guessEl.setAttribute('autocapitalize','off');
      guessEl.setAttribute('spellcheck','false');
      statusEl.textContent = `Enter your answer (±${TOL}).`;
    } else {
      guessEl.placeholder = UI_COPY.input.psiPlaceholder;
      guessEl.setAttribute('inputmode','decimal');
      guessEl.setAttribute('autocomplete','off');
      guessEl.setAttribute('autocapitalize','off');
      guessEl.setAttribute('spellcheck','false');
      statusEl.textContent = `Enter your answer (±${TOL} psi).`;
    }

    // Reset previous work/answer
    workEl.innerHTML = '';
    if (guessEl) guessEl.value = '';
  }

  container.querySelector('#newScenarioBtn').addEventListener('click', makePractice);

  container.querySelector('#checkBtn').addEventListener('click', ()=>{
    const raw = (guessEl?.value || '').trim();
    if(!currentQ){ statusEl.textContent = 'Generate a problem first.'; return; }
    if(currentQ.questionType !== 'MULTI' && practiceAnswer==null){ statusEl.textContent = 'Generate a problem first.'; return; }

    const rev = buildRevealForQuestion(currentQ);

    // MULTIPART (multi-part) grading
    if(currentQ.questionType === 'MULTI'){
      const graded = gradeMultipart(currentQ);

      if(graded.allOk){
        const badges = graded.results.map(r => `Part ${r.idx+1} ✅`).join('  ');
        statusEl.innerHTML = `<span class="ok">✅ Correct.</span> ${badges}`;
        workEl.innerHTML = '';
      }else{
        const badges = graded.results.map(r => `Part ${r.idx+1} ${r.ok ? '✅' : '❌'}`).join('  ');
        statusEl.innerHTML = `<span class="alert">❌ Not quite.</span> ${badges}`;

        const lines = (currentQ.parts||[]).map((p,i)=>{
          const unit = p.unit ? ` ${p.unit}` : '';
          return `<div style="margin-top:6px"><b>Part ${i+1} answer:</b> ${p.answer}${unit}</div>`;
        }).join('');

        const tender = (currentQ.parts||[]).map(p=>p?.uses?.tender).find(Boolean);
        let tenderLine = '';
        if(tender && tender.tankGallons && tender.turnaroundMinutes){
          const sustained = Math.round((tender.tankGallons / tender.turnaroundMinutes) * 10) / 10;
          tenderLine = `<div style="margin-top:8px"><b>Tender sustained flow:</b> ${tender.tankGallons} ÷ ${tender.turnaroundMinutes} = ${sustained} gpm</div>`;
        }

        const foam = (currentQ.parts||[]).map(p=>p?.uses?.foam).find(Boolean);
        let foamLine = '';
        if(foam && foam.percent!=null){
          const sol = foam.solutionGpm ?? 0;
          const conc = Math.round((sol * (foam.percent/100)) * 10) / 10;
          foamLine = `<div style="margin-top:8px"><b>Foam concentrate flow:</b> ${sol} × ${foam.percent}% = ${conc} gpm</div>`;
        }

        workEl.innerHTML = `
          <div class="revealLead">${currentQ.revealLead || ''}</div>
          ${tenderLine}
          ${foamLine}
          ${lines}
        `;
      }
      return;
    }

    // Y/N decision questions
    if(currentQ.questionType === 'YN'){
      const user = raw.toUpperCase();
      const v = user.startsWith('Y') ? 'Y' : user.startsWith('N') ? 'N' : '';
      const ok = v && v === String(practiceAnswer).toUpperCase();

      if(ok){
        statusEl.innerHTML = `<span class="ok">✅ ${correctMsg(currentQ)}</span> (Answer ${practiceAnswer})`;
        workEl.innerHTML = '';
      }else{
        statusEl.innerHTML = `<span class="alert">❌ ${incorrectMsg(currentQ)}</span> (Answer ${practiceAnswer})`;
        const lead = revealLeadMsg(currentQ);
        workEl.innerHTML = `
          <div class="revealCompact">
            <div class="lead">${lead}</div>
            <div>Tap below for the full breakdown.</div>
            <button class="btn" id="fullBreakdownBtn">Full Breakdown</button>
          </div>
        `;
        const fb = container.querySelector('#fullBreakdownBtn');
        if(fb){
          fb.onclick = ()=>{
            workEl.innerHTML = rev.html || '';
            workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
          };
        }
        workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
      }
      return;
    }

    // Numeric questions (psi or gpm)
    const guess = Number(raw);
    if(!Number.isFinite(guess)){
      statusEl.textContent = 'Enter a number (or Y/N for decision questions).';
      return;
    }

    const diff = Math.abs(guess - Number(practiceAnswer));
    const unit = (currentQ.unitHint || 'psi');

    if(diff<=TOL){
      statusEl.innerHTML = `<span class="ok">✅ Correct!</span> (Answer ${practiceAnswer} ${unit}; Δ ${diff})`;
      workEl.innerHTML = '';
    }else{
      const hint = diagnoseMistake(currentQ, guess);
      statusEl.innerHTML = `<span class="alert">❌ ${incorrectMsg(currentQ)}</span> (Answer ${practiceAnswer} ${unit}; Δ ${diff})` +
        (hint ? `<span class="hint">${hint}</span>` : '');
      const lead = revealLeadMsg(currentQ);
      workEl.innerHTML = `
        <div class="revealCompact">
          <div class="lead">${lead}</div>
          <div>Tap below for the full breakdown.</div>
          <button class="btn" id="fullBreakdownBtn">Full Breakdown</button>
        </div>
      `;
      const fb = container.querySelector('#fullBreakdownBtn');
      if(fb){
        fb.onclick = ()=>{
          workEl.innerHTML = rev.html || '';
          workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
        };
      }
      workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
    }
  });

  container.querySelector('#revealBtn').addEventListener('click', ()=>{
    if(!currentQ || !scenario) return;
    const rev = buildRevealForQuestion(currentQ);
    workEl.innerHTML = rev.html || '';
    const unit = currentQ.questionType === 'YN' ? '' : ` ${currentQ.unitHint || 'psi'}`;
    statusEl.innerHTML = `<b>Answer:</b> ${rev.total}${unit}`;
    workEl.scrollIntoView({behavior:'smooth', block:'nearest'});
  });

  eqToggleBtn.addEventListener('click', ()=>{
    eqVisible = !eqVisible;
    if(eqVisible){
      eqBox.innerHTML = renderEquations(scenario);
      eqBox.style.display = 'block';
      eqToggleBtn.textContent = 'Hide Equations';
    }else{
      eqBox.style.display = 'none';
      eqToggleBtn.textContent = 'Equations';
    }
  });

  // Global capture handler: on desktop some overlay may intercept clicks,
  // so we map clicks by screen position into the three header buttons.
  const globalPracticeClick = (e)=>{
    try{
      const x = e.clientX, y = e.clientY;
      const pairs = [
        [container.querySelector('#newScenarioBtn'), ()=> makePractice()],
        [eqToggleBtn, ()=> eqToggleBtn.click()],
        [container.querySelector('#revealBtn'), ()=> container.querySelector('#revealBtn').click()],
      ];
      for(const [btn, handler] of pairs){
        if(!btn) continue;
        const r = btn.getBoundingClientRect();
        if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
          e.preventDefault();
          handler();
          return;
        }
      }
    }catch(_){}
  };
  window.addEventListener('click', globalPracticeClick, true);

  // external events (optional)
  const onNew = ()=> makePractice();
  const onEq  = ()=> eqToggleBtn.click();
  window.addEventListener('practice:newProblem', onNew);
  window.addEventListener('toggle:equations', onEq);

  // initial state: immediately generate first practice question on page load
  practiceAnswer = null;
  scenario = null;
  makePractice();

  return {
    dispose(){
      window.removeEventListener('practice:newProblem', onNew);
      window.removeEventListener('toggle:equations', onEq);
      window.removeEventListener('click', globalPracticeClick, true);
    }
  };
}

export default { render };
