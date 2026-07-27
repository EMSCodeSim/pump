(function(){
  'use strict';
  var IOS='https://apps.apple.com/us/app/fireopscalc/id6753922160';
  var ANDROID='https://play.google.com/store/apps/details?id=com.fireopscalc.app&pcampaignid=web_share';
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
      '<div class="app-promo-actions"><a class="app-promo-store primary" href="'+ANDROID+'" target="_blank" rel="noopener">Get it on Android</a><a class="app-promo-store" href="'+IOS+'" target="_blank" rel="noopener">Download on iPhone</a>'+
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
  function init(){if(isNative())return;addShowcase();addFloating();setupResultPrompt()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
