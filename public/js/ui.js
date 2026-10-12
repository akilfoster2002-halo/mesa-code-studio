/* UI — small pieces every screen uses: escaping, popup menus, dialogs,
   toasts. Nothing here knows about blocks or projects. */
window.UI = (function(){
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function h(tag, attrs, ...kids){
    const el = document.createElement(tag);
    for(const [k, v] of Object.entries(attrs || {})){
      if(v == null || v === false) continue;
      if(k === 'class') el.className = v;
      else if(k === 'html') el.innerHTML = v;
      else if(k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if(k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for(const k of kids.flat()) if(k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }

  /* ------------------------------------------------------- popup menu
     items: [{ label, value, sep, danger }] — calls pick(value). */
  let openMenu = null;
  function menu(x, y, items, pick, opts={}){
    closeMenu();
    const el = h('div', { class:'pop' + (opts.className ? ' ' + opts.className : ''), role:'menu' });
    for(const it of items){
      if(it.sep){ el.append(h('div', { class:'pop-sep' })); continue; }
      const b = h('button', { class:'pop-item' + (it.danger ? ' danger' : '') + (it.on ? ' on' : ''), type:'button' });
      if(it.html) b.innerHTML = it.html; else b.textContent = it.label;
      b.onclick = e => { e.stopPropagation(); closeMenu(); pick(it.value, it); };
      el.append(b);
    }
    document.body.append(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, x)) + 'px';
    el.style.top = (y + r.height > innerHeight - 4 ? Math.max(4, (opts.above != null ? opts.above : y) - r.height) : y) + 'px';
    openMenu = el;
    const on = el.querySelector('.on'); if(on) on.scrollIntoView({ block:'nearest' });
    setTimeout(() => addEventListener('pointerdown', outside, true), 0);
    return el;
  }
  function outside(e){ if(openMenu && !openMenu.contains(e.target)) closeMenu(); }
  function closeMenu(){
    if(openMenu){ openMenu.remove(); openMenu = null; }
    removeEventListener('pointerdown', outside, true);
  }

  /* ----------------------------------------------------------- dialog
     dialog({ title, body (element), ok, cancel }) -> Promise<bool> */
  function dialog({ title, body, ok=t('OK'), cancel=t('Cancel'), wide=false, onOpen }){
    return new Promise(resolve => {
      const back = h('div', { class:'modal-back' });
      const okBtn = ok ? h('button', { class:'btn primary', type:'submit' }, ok) : null;
      const card = h('form', { class:'modal' + (wide ? ' wide' : ''), novalidate:true },
        title ? h('h2', {}, title) : null, body,
        h('div', { class:'modal-row' },
          cancel ? h('button', { class:'btn', type:'button', onclick:() => done(false) }, cancel) : null, okBtn));
      card.onsubmit = e => { e.preventDefault(); done(true); };
      back.append(card);
      back.addEventListener('pointerdown', e => { if(e.target === back) done(false); });
      const key = e => { if(e.key === 'Escape'){ e.stopPropagation(); done(false); } };
      addEventListener('keydown', key, true);
      document.body.append(back);
      const first = card.querySelector('input,select,textarea'); if(first){ first.focus(); first.select && first.select(); }
      onOpen && onOpen(card, done);
      function done(v){ removeEventListener('keydown', key, true); back.remove(); resolve(v); }
    });
  }
  async function ask(title, value='', extra){
    const input = h('input', { class:'inp', value, maxlength:60, autocomplete:'off', spellcheck:'false' });
    const body = h('div', {}, input, extra || null);
    const ok = await dialog({ title, body });
    return ok ? input.value.trim() : null;
  }
  async function confirm(title, okLabel){ return dialog({ title, body:h('div'), ok: okLabel || t('OK') }); }

  /* ------------------------------------------------------------ toast */
  let toastT = null;
  function toast(msg, kind=''){
    let el = $('#toast');
    if(!el){ el = h('div', { id:'toast', role:'status' }); document.body.append(el); }
    el.textContent = msg; el.className = 'show ' + kind;
    clearTimeout(toastT); toastT = setTimeout(() => el.className = '', 3200);
  }

  function ago(iso){
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if(s < 60) return t('just now');
    if(s < 3600) return t('{n} min ago', { n:Math.floor(s / 60) });
    if(s < 86400) return t('{n} h ago', { n:Math.floor(s / 3600) });
    if(s < 172800) return t('yesterday');
    return new Date(iso).toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en', { month:'short', day:'numeric' });
  }
  const clock = iso => new Date(iso).toLocaleString(I18N.lang === 'es' ? 'es' : 'en', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });

  function pickFiles(accept, multiple=true){
    return new Promise(resolve => {
      const i = h('input', { type:'file', accept, multiple, style:{ display:'none' } });
      i.onchange = () => { resolve([...i.files]); i.remove(); };
      document.body.append(i); i.click();
    });
  }

  return { $, $$, esc, h, menu, closeMenu, dialog, ask, confirm, toast, ago, clock, pickFiles };
})();
