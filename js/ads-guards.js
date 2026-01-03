// /js/ads-guards.js
// AdSense guards for SPA re-renders: inject + push each slot only once.
// Designed to be "firefighter friendly": best-effort, never breaks core UI.

const pushedSlots = new Set();
const injectedKeys = new Set();

export function isNativeApp(){
  try{
    if (window?.Capacitor){
      if (typeof window.Capacitor.isNativePlatform === 'function') return !!window.Capacitor.isNativePlatform();
      if (typeof window.Capacitor.getPlatform === 'function') return window.Capacitor.getPlatform() !== 'web';
    }
  } catch(_e){}
  const proto = (window?.location?.protocol || '').toLowerCase();
  return proto === 'capacitor:';
}

function ensureIns({ key, client, slot, format, style, extraAttrs }){
  const ins = document.createElement('ins');
  ins.className = 'adsbygoogle';
  ins.setAttribute('data-ads-key', key);
  ins.setAttribute('data-ad-client', client);
  ins.setAttribute('data-ad-slot', slot);
  if (format) ins.setAttribute('data-ad-format', format);
  if (style) ins.style.cssText = style;
  // Default: responsive
  if (!ins.hasAttribute('data-full-width-responsive')){
    ins.setAttribute('data-full-width-responsive', 'true');
  }
  if (extraAttrs){
    for (const [k,v] of Object.entries(extraAttrs)){
      ins.setAttribute(k, String(v));
    }
  }
  return ins;
}

function injectOnce({ key, container, position='bottom', refNode=null, ins }){
  if (!container) return false;
  if (injectedKeys.has(key)) return false;

  const existing = container.querySelector?.(`ins.adsbygoogle[data-ads-key="${CSS.escape(key)}"]`);
  if (existing){
    injectedKeys.add(key);
    return false;
  }

  if (position === 'top'){
    container.prepend(ins);
  } else if (position === 'before' && refNode?.parentNode){
    refNode.parentNode.insertBefore(ins, refNode);
  } else if (position === 'after' && refNode?.parentNode){
    refNode.parentNode.insertBefore(ins, refNode.nextSibling);
  } else {
    container.appendChild(ins);
  }

  injectedKeys.add(key);
  return true;
}

function pushOnce(slot){
  if (!slot) return false;
  if (pushedSlots.has(slot)) return false;

  try{
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.push({});
    pushedSlots.add(slot);
    return true;
  } catch(_e){
    // If AdSense isn't ready yet or rejects a duplicate, just don't mark as pushed.
    return false;
  }
}

/**
 * Inject + push an ad ONCE.
 * - disableInNativeApp: true by default (so Capacitor builds don't show web ads)
 */
export function renderAdOnce({
  key,
  container,
  position='bottom',
  refNode=null,
  client,
  slot,
  format='auto',
  style='display:block; margin:12px 0;',
  extraAttrs=null,
  disableInNativeApp=true
} = {}){
  try{
    if (disableInNativeApp && isNativeApp()) return { injected:false, pushed:false };
    if (!key || !container || !client || !slot) return { injected:false, pushed:false };

    const ins = ensureIns({ key, client, slot, format, style, extraAttrs });
    const injected = injectOnce({ key, container, position, refNode, ins });

    // Push if in DOM (injected now or was already present)
    const inDom = !!container.querySelector?.(`ins.adsbygoogle[data-ads-key="${CSS.escape(key)}"]`);
    const pushed = inDom ? pushOnce(slot) : false;
    return { injected, pushed };
  } catch(_e){
    return { injected:false, pushed:false };
  }
}
