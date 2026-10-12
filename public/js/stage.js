/* =====================================================================
   STAGE — the stage panel: the canvas, ⚑ and ■, the mouse and keyboard,
   variable and list monitors, the "ask" box, and dragging sprites around
   with the mouse.
   ===================================================================== */
window.STAGE = (function(){
  const { h, $, $$ } = UI;
  let els = {}, onChange = () => {}, onSelect = () => {}, readOnly = false;
  let dragging = null;

  function mount(opts){
    els = opts; onChange = opts.onChange || onChange; onSelect = opts.onSelect || onSelect;
    RENDER.attach(els.canvas);
    els.flag.onclick = () => { VM.greenFlag(); EDITOR.updateGlow(); };
    els.stop.onclick = () => { VM.stopAll(); EDITOR.updateGlow(); };

    const wrap = els.wrap;
    wrap.addEventListener('pointermove', e => { const p = stagePoint(e); VM.rt.mouse.x = p.x; VM.rt.mouse.y = p.y; dragMove(e, p); });
    wrap.addEventListener('pointerdown', e => {
      if(e.target.closest('.monitor, .ask')) return;
      const p = stagePoint(e);
      VM.rt.mouse.x = p.x; VM.rt.mouse.y = p.y; VM.rt.mouse.down = true;
      if(EDITOR.eyedropping){ const cb = EDITOR.takeEyedropper(); cb && cb(RENDER.colorAt(VM.rt, p.x, p.y)); return; }
      const s = RENDER.pick(VM.rt, p.x, p.y);
      wrap.setPointerCapture(e.pointerId);
      if(s){
        const canDrag = (!els.player || s.draggable) && !readOnly;
        dragging = { s, dx:s.x - p.x, dy:s.y - p.y, moved:false, canDrag, sx:e.clientX, sy:e.clientY };
        if(!canDrag) clickSprite(s);
      } else {
        VM.startHats('event_whenstageclicked', null, VM.rt.stage, true);
      }
    });
    const release = () => {
      VM.rt.mouse.down = false;
      if(dragging){
        const d = dragging; dragging = null;
        if(d.canDrag && !d.moved) clickSprite(d.s);
        if(d.moved){ onChange('sprite'); onSelect(VM.original(d.s)); }
      }
    };
    wrap.addEventListener('pointerup', release);
    wrap.addEventListener('pointercancel', release);
    addEventListener('pointerup', () => { VM.rt.mouse.down = false; });

    addEventListener('keydown', e => {
      if(!els.wrap.offsetParent) return;
      const tg = e.target;
      if(tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
      if(e.ctrlKey || e.metaKey || e.altKey) return;
      const name = VM.keyName(e);
      if(!name) return;
      if(['space','up arrow','down arrow','left arrow','right arrow'].includes(name) && !e.target.closest('#ws')) e.preventDefault();
      VM.pressKey(name);
    });
    addEventListener('keyup', e => VM.releaseKey(VM.keyName(e)));
    addEventListener('blur', () => VM.rt.keys.clear());

    VM.rt.onAsk = ask;
    VM.rt.onChange = kind => { if(kind === 'monitors'){ renderMonitors(); } };
    VM.rt.onFrame = tick;
    VM.rt.onTick = tick;
    MEDIA.onLoad = () => { VM.rt.dirty = true; };
  }
  function setReadOnly(v){ readOnly = v; }

  function clickSprite(s){ VM.startHats('event_whenthisspriteclicked', null, s, true); }
  function dragMove(e, p){
    const d = dragging;
    if(!d || !d.canDrag) return;
    if(!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) < 4) return;
    if(!d.moved){ d.moved = true; if(!d.s.isClone){ const i = VM.rt.layers.indexOf(d.s); VM.rt.layers.splice(i, 1); VM.rt.layers.push(d.s); } }
    VM.moveTo(d.s, Math.round(p.x + d.dx), Math.round(p.y + d.dy), true);
    VM.rt.dirty = true;
    if(!d.s.isClone) onSelect(d.s, true);
  }
  function stagePoint(e){
    const r = els.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 480 - 240, y = 180 - (e.clientY - r.top) / r.height * 360;
    return { x:Math.max(-240, Math.min(240, x)), y:Math.max(-180, Math.min(180, y)) };
  }

  /* ---------------------------------------------------------- monitors */
  let monEls = new Map();
  function monitorLabel(m){
    const P = VM.rt.project;
    const tg = m.target === 'stage' ? null : P.targets.find(x => x.id === m.target);
    const pre = tg ? tg.name + ': ' : '';
    if(m.kind === 'var' || m.kind === 'list') return pre + m.name;
    const spec = BLOCKS.of(m.op);
    let label = spec ? spec.text.replace(/\[([A-Z_]+)\]/g, (x, k) => m.args && m.args[k] != null ? m.args[k] : '') : m.op;
    if(m.op === 'sensing_current') label = 'current ' + (m.args.CURRENTMENU === 'dayofweek' ? 'day of week' : m.args.CURRENTMENU);
    return pre + label.trim();
  }
  function renderMonitors(){
    const P = VM.rt.project; if(!P) return;
    const layer = els.monitors;
    const want = new Set(P.monitors.filter(m => m.visible).map(m => m.id));
    for(const [id, el] of monEls) if(!want.has(id)){ el.remove(); monEls.delete(id); }
    for(const m of P.monitors){
      if(!m.visible) continue;
      let el = monEls.get(m.id);
      const label = monitorLabel(m);
      if(!el){
        el = h('div', { class:'monitor ' + (m.kind === 'list' ? 'm-list' : 'm-var') + (m.mode === 'large' ? ' large' : '') });
        el.append(h('span', { class:'m-name' }), h('span', { class:'m-val' }));
        if(m.kind === 'list') el.querySelector('.m-val').replaceWith(h('div', { class:'m-items' }), h('div', { class:'m-len' }));
        layer.append(el); monEls.set(m.id, el);
        monitorDrag(el, m);
      }
      el.querySelector('.m-name').textContent = label;
      el.classList.toggle('large', m.mode === 'large');
      place(el, m);
    }
    tick(true);
  }
  function place(el, m){
    const k = els.canvas.clientWidth / 480;
    el.style.transform = `translate(${m.x * k}px, ${m.y * k}px) scale(${Math.max(0.5, k)})`;
  }
  function monitorDrag(el, m){
    el.addEventListener('pointerdown', e => {
      if(readOnly || els.player) return;
      e.preventDefault(); e.stopPropagation();
      const k = els.canvas.clientWidth / 480, sx = e.clientX, sy = e.clientY, ox = m.x, oy = m.y;
      const mv = ev => { m.x = Math.max(0, Math.min(440, ox + (ev.clientX - sx) / k)); m.y = Math.max(0, Math.min(340, oy + (ev.clientY - sy) / k)); place(el, m); };
      const upp = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', upp); onChange('monitors'); };
      addEventListener('pointermove', mv); addEventListener('pointerup', upp);
    });
    el.addEventListener('dblclick', () => { if(m.kind !== 'list' && !readOnly){ m.mode = m.mode === 'large' ? 'default' : 'large'; renderMonitors(); onChange('monitors'); } });
  }
  let lastTick = 0;
  function tick(force){
    const t0 = performance.now();
    if(!force && t0 - lastTick < 100) return;
    lastTick = t0;
    const P = VM.rt.project; if(!P) return;
    for(const m of P.monitors){
      const el = monEls.get(m.id); if(!el || !m.visible) continue;
      const v = VM.monitorValue(m);
      if(m.kind === 'list'){
        const arr = Array.isArray(v) ? v : [];
        const items = el.querySelector('.m-items');
        const html = arr.slice(0, 100).map((x, i) => `<div class="m-item"><b>${i + 1}</b><span>${UI.esc(VM.toStr(x))}</span></div>`).join('') + (arr.length > 100 ? '<div class="m-item">…</div>' : '');
        if(items.dataset.h !== html){ items.innerHTML = html || `<div class="m-empty">(${t('empty')})</div>`; items.dataset.h = html; }
        el.querySelector('.m-len').textContent = t('length') + ' ' + arr.length;
      } else {
        const s = typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : VM.toStr(v);
        const val = el.querySelector('.m-val');
        if(val.textContent !== s) val.textContent = s;
      }
    }
    EDITOR.updateGlow && glowSoon();
    if(els.onTick) els.onTick();
  }
  let glowT = 0;
  function glowSoon(){ const n = performance.now(); if(n - glowT > 200){ glowT = n; EDITOR.updateGlow(); } }
  addEventListener('resize', () => { for(const m of (VM.rt.project ? VM.rt.project.monitors : [])){ const el = monEls.get(m.id); if(el) place(el, m); } VM.rt.dirty = true; });
  function clearMonitors(){ for(const el of monEls.values()) el.remove(); monEls.clear(); }

  /* --------------------------------------------------------------- ask */
  function ask(question, answer){
    const old = $('.ask', els.wrap); if(old) old.remove();
    if(question === null) return;
    const input = h('input', { class:'ask-in', autocomplete:'off', spellcheck:'false' });
    const form = h('form', { class:'ask' },
      question ? h('div', { class:'ask-q' }, question) : null,
      h('div', { class:'ask-row' }, input, h('button', { class:'ask-ok', type:'submit', 'aria-label':'OK' }, '✓')));
    form.onsubmit = e => { e.preventDefault(); form.remove(); answer(input.value); };
    els.wrap.append(form);
    setTimeout(() => input.focus(), 0);
  }

  return { mount, renderMonitors, clearMonitors, setReadOnly, monitorLabel };
})();
