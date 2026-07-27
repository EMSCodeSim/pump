(function(){
  'use strict';
  var IOS='https://apps.apple.com/us/app/fireopscalc/id6753922160';
  var APPLE_WEB='https://t1wgtxvjk0hdhef9pk23.share.dreamflow.app/';
  var ANDROID='https://play.google.com/store/apps/details?id=com.fireopscalc.app&pcampaignid=web_share';
  var FIREPUMPSIM_WEB='https://firepumpsim.com/';
  var FIREPUMPSIM_ANDROID='https://play.google.com/store/apps/details?id=com.fireopssim.firepumpsim';
  var FIREPUMPSIM_IOS='https://apps.apple.com/us/app/firepumpsim-driver-operator/id6768447355';
  var HIDE_KEY='fireops_app_promo_hidden_until';
  function isNative(){try{return !!(window.Capacitor&&((window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())||(window.Capacitor.getPlatform&&window.Capacitor.getPlatform()!=='web')))}catch(e){return false}}
  function hidden(){try{return Number(localStorage.getItem(HIDE_KEY)||0)>Date.now()}catch(e){return false}}
  function dismiss(days){try{localStorage.setItem(HIDE_KEY,String(Date.now()+days*86400000))}catch(e){} document.querySelectorAll('.app-promo-floating,.app-promo-result').forEach(function(el){el.remove()})}
  function card(compact){
    var wrap=document.createElement('section');
    wrap.className=compact?'app-promo-result':'app-promo-showcase';
    wrap.setAttribute('aria-label','FireOps Calc mobile apps');
    wrap.innerHTML='<div class="app-promo-card"><div class="app-promo-inner">'+
      '<img class="app-promo-icon" src="/fireops-icon-1024.png" alt="FireOps Calc app icon">'+
      '<div class="app-promo-copy"><'+(compact?'h3':'h2')+'>'+(compact?'Keep FireOps Calc in your pocket':'Take FireOps Calc to the fireground')+'</'+(compact?'h3':'h2')+'>'+
      '<p>'+(compact?'Use the app for faster access, offline-ready reference, and saved department setups.':'Get one-tap access to pump math, saved department setups, and engineer tools from your phone.')+'</p>'+
      '<div class="app-promo-benefits"><span>iPhone and Android</span><span>Saved department settings</span><span>Quick field access</span></div></div>'+
      '<div class="app-promo-actions"><div class="app-promo-mini-label">Train with FirePumpSim</div><a class="app-promo-store firepumpsim-link" href="'+FIREPUMPSIM_WEB+'" target="_blank" rel="noopener">Open Web Version</a><a class="app-promo-store firepumpsim-android" href="'+FIREPUMPSIM_ANDROID+'" target="_blank" rel="noopener">FirePumpSim on Android</a><a class="app-promo-store firepumpsim-ios" href="'+FIREPUMPSIM_IOS+'" target="_blank" rel="noopener">FirePumpSim on iPhone</a><a class="app-promo-store apple-web" href="'+APPLE_WEB+'" target="_blank" rel="noopener">Use Apple Version Online</a><a class="app-promo-store primary" href="'+ANDROID+'" target="_blank" rel="noopener">Get it on Android</a><a class="app-promo-store" href="'+IOS+'" target="_blank" rel="noopener">Download on iPhone</a>'+ 
      (compact?'<button class="app-promo-dismiss" type="button">Don\'t show again</button>':'')+'</div></div></div>';
    var btn=wrap.querySelector('.app-promo-dismiss'); if(btn) btn.addEventListener('click',function(){dismiss(30)});
    return wrap;
  }
  function addShowcase(){
    if(!document.body.classList.contains('app-promo-home')) return;
    var footer=document.querySelector('footer'); if(footer&&!document.querySelector('.app-promo-showcase')) footer.parentNode.insertBefore(card(false),footer);
  }
  function addFloating(){
    if(hidden()||document.querySelector('.app-promo-floating')) return;
    var a=document.createElement('a');a.className='app-promo-floating';a.href=/iPhone|iPad|iPod/i.test(navigator.userAgent)?IOS:ANDROID;a.target='_blank';a.rel='noopener';a.innerHTML='<img src="/fireops-icon-1024.png" alt=""><span>Get the App</span>';document.body.appendChild(a);
  }
  function setupResultPrompt(){
    var host=document.getElementById('app'); if(!host||hidden()) return;
    var prompt=card(true); host.insertAdjacentElement('afterend',prompt);
    var shown=false;
    function show(){if(shown||hidden())return;shown=true;prompt.classList.add('is-visible')}
    host.addEventListener('click',function(e){var t=(e.target.textContent||'').toLowerCase();if(/calculate|compute|solve|add line|run/.test(t))setTimeout(show,700)},true);
    new MutationObserver(function(muts){if(shown)return;for(var i=0;i<muts.length;i++){var text=(muts[i].target.textContent||'');if(/\bPDP\b|pump discharge|\bPSI\b/.test(text)&&text.length>20){show();break}}}).observe(host,{subtree:true,childList:true,characterData:true});
  }

  function trainingMessage(){
    var path=(location.pathname||'').toLowerCase();
    if(/scenario|practice|training|drill|nfpa/.test(path)) return {kicker:'Continue the drill',title:'Turn this lesson into hands-on practice',text:'Open FirePumpSim for visual driver/operator scenarios, daily pump problems, printable exercises, and step-by-step answer review.'};
    if(/calculator|friction|relay|standpipe/.test(path)) return {kicker:'Calculate, then practice',title:'Use FirePumpSim to train the same pump skills',text:'After checking the math in FireOps Calc, reinforce it with visual pump scenarios and driver/operator practice in FirePumpSim.'};
    if(/pump-card|setup-preconnect/.test(path)) return {kicker:'From reference to repetition',title:'Train with the pump card you build',text:'Use your FireOps Calc pump card for reference, then open FirePumpSim to work realistic driver/operator scenarios and pump problems.'};
    return {kicker:'Training companion',title:'Build skill with FirePumpSim',text:'FireOps Calc handles pump math and quick reference. FirePumpSim turns those concepts into visual scenarios, daily challenges, and driver/operator practice.'};
  }
  function addFirePumpSim(){
    if(document.querySelector('.firepumpsim-promo')) return;
    var path=(location.pathname||'').toLowerCase();
    if(/privacy|contact|about|app-only/.test(path)) return;
    var footer=document.querySelector('footer'); if(!footer) return;
    var m=trainingMessage(), section=document.createElement('section');
    section.className='firepumpsim-promo';
    section.setAttribute('aria-label','FirePumpSim training app');
    section.innerHTML='<div class="firepumpsim-promo-card"><div class="firepumpsim-mark" aria-hidden="true">TRAIN</div><div class="firepumpsim-copy"><div class="firepumpsim-kicker">'+m.kicker+'</div><h2>'+m.title+'</h2><p>'+m.text+'</p><div class="firepumpsim-tags"><span>Visual scenarios</span><span>Daily pump problems</span><span>Driver/operator practice</span><span>Printable training</span></div></div><div class="firepumpsim-actions"><a class="firepumpsim-primary" href="'+FIREPUMPSIM_WEB+'" target="_blank" rel="noopener">Open Web Version</a><a class="firepumpsim-secondary" href="'+FIREPUMPSIM_ANDROID+'" target="_blank" rel="noopener">Google Play</a><a class="firepumpsim-secondary" href="'+FIREPUMPSIM_IOS+'" target="_blank" rel="noopener">App Store</a><a class="firepumpsim-secondary" href="/fire-pump-training-scenarios.html">Try free site scenarios</a></div></div>';
    footer.parentNode.insertBefore(section,footer);
  }

  function init(){if(isNative())return;addShowcase();addFirePumpSim();addFloating();setupResultPrompt()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
