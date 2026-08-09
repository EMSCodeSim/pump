(function(){
  const cfg=window.FIREOPS_ACADEMY;
  if(!cfg) return;
  const key=`fireopsAcademy:${cfg.id}:completed`;
  const examKey=`fireopsAcademy:${cfg.id}:bestExam`;
  const completed=new Set(JSON.parse(localStorage.getItem(key)||'[]'));
  const moduleEls=[...document.querySelectorAll('[data-module]')];
  const pctEl=document.getElementById('progressPct');
  const fill=document.getElementById('progressFill');
  const countEl=document.getElementById('progressCount');
  const bestEl=document.getElementById('bestExam');
  function save(){localStorage.setItem(key,JSON.stringify([...completed]));}
  function update(){
    moduleEls.forEach(el=>{
      const id=el.dataset.module, btn=el.querySelector('.complete-btn'), status=el.querySelector('.module-status');
      const done=completed.has(id);
      if(btn){btn.classList.toggle('done',done);btn.textContent=done?'✓ Module complete':'Mark module complete';}
      if(status){status.textContent=done?'Complete':'Not complete';status.className='module-status '+(done?'success':'');}
    });
    const pct=moduleEls.length?Math.round(completed.size/moduleEls.length*100):0;
    if(pctEl)pctEl.textContent=pct+'%'; if(fill)fill.style.width=pct+'%'; if(countEl)countEl.textContent=`${completed.size} of ${moduleEls.length} modules complete`;
    const best=Number(localStorage.getItem(examKey)||0); if(bestEl)bestEl.textContent=best?`Best practice exam: ${best}%`:'Practice exam not taken yet';
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('.complete-btn'); if(!btn)return; const mod=btn.closest('[data-module]'); if(!mod)return; const id=mod.dataset.module;
    completed.has(id)?completed.delete(id):completed.add(id); save(); update();
  });
  document.querySelectorAll('.knowledge').forEach(block=>{
    block.addEventListener('click',e=>{
      const b=e.target.closest('.answer'); if(!b || block.dataset.answered==='1')return; block.dataset.answered='1';
      const ok=b.dataset.correct==='true'; b.classList.add(ok?'correct':'wrong');
      if(!ok){const good=block.querySelector('[data-correct="true"]'); if(good)good.classList.add('correct');}
      const fb=block.querySelector('.feedback'); if(fb)fb.textContent=ok?'Correct. '+(block.dataset.explain||''):'Review this one. '+(block.dataset.explain||'');
    });
  });
  const reset=document.getElementById('resetProgress'); if(reset)reset.addEventListener('click',()=>{if(confirm('Reset module progress and practice-exam score for this academy?')){localStorage.removeItem(key);localStorage.removeItem(examKey);completed.clear();update();location.reload();}});

  const examStart=document.getElementById('examStart'), examBox=document.getElementById('examBox');
  if(examStart && examBox && Array.isArray(cfg.questions)){
    let qs=[],answers=[],i=0;
    const shuffle=a=>{a=[...a];for(let x=a.length-1;x>0;x--){const j=Math.floor(Math.random()*(x+1));[a[x],a[j]]=[a[j],a[x]];}return a;};
    function start(){qs=shuffle(cfg.questions).slice(0,cfg.examLength||20).map(q=>({...q,choices:shuffle(q.choices)}));answers=new Array(qs.length).fill(null);i=0;examStart.classList.add('hidden');examBox.classList.remove('hidden');render();examBox.scrollIntoView({behavior:'smooth',block:'start'});}
    function render(){
      const q=qs[i];
      document.getElementById('examCounter').textContent=`Question ${i+1} of ${qs.length}`;
      document.getElementById('examAnswered').textContent=`${answers.filter(x=>x!==null).length} answered`;
      document.getElementById('examQuestion').textContent=q.q;
      const ans=document.getElementById('examAnswers'); ans.innerHTML='';
      q.choices.forEach(choice=>{const b=document.createElement('button');b.className='exam-answer'+(answers[i]===choice?' selected':'');b.textContent=choice;b.onclick=()=>{answers[i]=choice;render();};ans.appendChild(b);});
      document.getElementById('examPrev').disabled=i===0;document.getElementById('examNext').textContent=i===qs.length-1?'Finish & grade':'Next';
    }
    function finish(){
      if(answers.some(a=>a===null) && !confirm('Some questions are unanswered. Grade the exam anyway?')) return;
      let correct=0;qs.forEach((q,idx)=>{if(answers[idx]===q.a)correct++;}); const pct=Math.round(correct/qs.length*100); const best=Math.max(pct,Number(localStorage.getItem(examKey)||0));localStorage.setItem(examKey,best);update();
      const result=document.getElementById('examResult');result.classList.remove('hidden');
      result.innerHTML=`<div class="score-big">${pct}%</div><strong>${correct} of ${qs.length} correct</strong><p>${pct>=80?'Strong practice score. Keep drilling weak topics and verify local testing requirements.':'Use the review below to target weak areas, then retake the practice exam.'}</p>`+qs.map((q,idx)=>`<div class="review-row"><strong>${idx+1}. ${q.q}</strong><span class="${answers[idx]===q.a?'correct-text':'wrong-text'}">Your answer: ${answers[idx]||'Unanswered'}</span><br><span class="correct-text">Correct: ${q.a}</span><br><small>${q.explain||''}</small></div>`).join('')+`<div class="exam-nav"><button class="btn primary" id="retakeExam">Retake exam</button></div>`;
      document.getElementById('examQuestion').parentElement.classList.add('hidden');
      document.getElementById('retakeExam').onclick=()=>location.reload();
      result.scrollIntoView({behavior:'smooth',block:'start'});
    }
    examStart.addEventListener('click',start);
    document.getElementById('examPrev').onclick=()=>{if(i>0){i--;render();}};
    document.getElementById('examNext').onclick=()=>{if(i<qs.length-1){i++;render();}else finish();};
  }
  update();
})();
