/* =====================================================================
   EDITOR — the block palette and the scripts area.

   Scripts sit anywhere on a big scrollable canvas, like Scratch. Drag a
   block (from the palette or from a script) and it can drop:
     • between ANY two blocks, above the first block or below the last,
     • at the top of any C mouth (repeat, forever, if, else) — empty or not,
     • on top of a script (the dragged blocks go above it),
     • round a script (an empty C block wraps it),
     • into any round or hexagonal slot (reporters and booleans),
     • anywhere else, as a new script — or on the palette, to delete it.
   A grey bar shows exactly where it will land before you let go.

   Dragging a block takes the blocks under it too (as in Scratch).
   Right-click → Delete Block removes just that block: the blocks under it
   close up, and a loop's or if's insides stay where they were.

   Drop targets are measured once when a drag starts, in canvas units, so
   scrolling while dragging does not move them.
   ===================================================================== */
window.EDITOR = (function(){
  const { $, $$, h, esc } = UI;
  let P = null, target = null, readOnly = false, zoom = 0.9;
  let els = {};
  let index = {};          // block id -> { block, list, idx, parent, slot, script }
  let lists = {};          // list key -> { arr, script, owner, top }
  let palTemplates = {};   // palette element id -> block template
  let drag = null, pending = null;
  const undo = new Map(), redo = new Map();
  let onChange = () => {};
  let eyedropper = null;

  /* ------------------------------------------------------------ mount */
  function mount(opts){
    els = { cats:opts.cats, pal:opts.pal, ws:opts.ws };
    onChange = opts.onChange || onChange;
    els.wsSizer = h('div', { class:'ws-sizer' });
    els.wsc = h('div', { class:'wsc' });
    els.wsSizer.append(els.wsc);
    els.ws.append(els.wsSizer);
    els.ws.append(h('div', { class:'zoom' },
      h('button', { class:'zb', title:t('Zoom in'), onclick:() => setZoom(zoom + 0.15) }, '+'),
      h('button', { class:'zb', title:t('Zoom out'), onclick:() => setZoom(zoom - 0.15) }, '−'),
      h('button', { class:'zb', title:t('Reset zoom'), onclick:() => setZoom(0.9) }, '=')));
    els.empty = h('div', { class:'ws-empty' }, t('Drag blocks here'));
    els.ws.append(els.empty);

    for(const el of [els.pal, els.ws]) el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    els.ws.addEventListener('contextmenu', wsContext);
    els.pal.addEventListener('contextmenu', palContext);
    els.ws.addEventListener('wheel', e => {
      if(e.ctrlKey || e.metaKey){ e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }
    }, { passive:false });
    els.pal.addEventListener('scroll', () => highlightCat());
    addEventListener('keydown', keys);
  }

  function load(project, tg, ro){
    P = project; readOnly = !!ro; target = tg || P.targets[1] || P.targets[0];
    undo.clear(); redo.clear();
    renderAll();
  }
  function setTarget(tg){
    if(tg === target) return;
    target = tg;
    renderAll();
    els.ws.scrollTo(0, 0);
  }
  function renderAll(){ renderCats(); renderPalette(); renderWorkspace(); }
  function setZoom(z){
    const ws = els.ws, cx = (ws.scrollLeft + ws.clientWidth / 2) / zoom, cy = (ws.scrollTop + ws.clientHeight / 2) / zoom;
    zoom = Math.max(0.4, Math.min(2, z));
    renderWorkspace();
    ws.scrollLeft = cx * zoom - ws.clientWidth / 2; ws.scrollTop = cy * zoom - ws.clientHeight / 2;
  }

  /* -------------------------------------------------------- snapshots */
  function snap(){ return JSON.stringify(target.scripts, (k, v) => k && k[0] === '_' ? undefined : v); }
  function remember(before){
    const id = target.id;
    if(!undo.has(id)) undo.set(id, []);
    const u = undo.get(id);
    u.push(before == null ? snap() : before);
    if(u.length > 80) u.shift();
    redo.set(id, []);
  }
  function changed(kind='blocks'){ onChange(kind); }
  function doUndo(){
    const u = undo.get(target.id); if(!u || !u.length) return;
    (redo.get(target.id) || redo.set(target.id, []).get(target.id)).push(snap());
    target.scripts = JSON.parse(u.pop());
    renderWorkspace(); renderPalette(); changed();
  }
  function doRedo(){
    const r = redo.get(target.id); if(!r || !r.length) return;
    (undo.get(target.id) || undo.set(target.id, []).get(target.id)).push(snap());
    target.scripts = JSON.parse(r.pop());
    renderWorkspace(); renderPalette(); changed();
  }
  function keys(e){
    if(!els.ws || !els.ws.offsetParent) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '') || (e.target && e.target.isContentEditable);
    if(typing || readOnly) return;
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
    else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y'){ e.preventDefault(); doRedo(); }
  }

  /* ------------------------------------------------------ categories */
  function enabledCats(){
    return BLOCKS.CATS.filter(c => !c.hidden && (!c.ext || P.extensions.includes(c.id)));
  }
  function renderCats(){
    const cats = enabledCats();
    els.cats.innerHTML = '';
    for(const c of cats){
      els.cats.append(h('button', { class:'cat', 'data-cat':c.id, type:'button',
        onclick:() => { const hd = $('#ph-' + c.id, els.pal); if(hd) els.pal.scrollTo({ top:hd.offsetTop - 4, behavior:'smooth' }); } },
        h('span', { class:'dot', style:{ background:c.color, borderColor:c.dark } }), h('span', {}, t(c.name))));
    }
    els.cats.append(h('button', { class:'cat ext-btn', type:'button', title:t('Add Extension'), onclick:extensionChooser },
      h('span', { class:'dot plus' }, '+'), h('span', {}, t('Add Extension'))));
    highlightCat();
  }
  function highlightCat(){
    const top = els.pal.scrollTop + 10;
    let cur = null;
    for(const hd of $$('.ph', els.pal)) if(hd.offsetTop <= top + 30) cur = hd.dataset.cat;
    if(!cur){ const f = $('.ph', els.pal); cur = f && f.dataset.cat; }
    $$('.cat', els.cats).forEach(b => b.classList.toggle('on', b.dataset.cat === cur));
  }
  async function extensionChooser(){
    if(readOnly) return;
    const pick = [['pen','✏️',t('Pen'),t('Draw with your sprites.')],['music','🎵',t('Music'),t('Play notes and drums.')],
      ['tts','🗣️',t('Text to Speech'),t('Make your projects talk.')]];
    const body = h('div', { class:'ext-grid' }, pick.map(([id, icon, name, line]) =>
      h('button', { type:'button', class:'ext-card' + (P.extensions.includes(id) ? ' on' : ''), onclick:e => {
        if(!P.extensions.includes(id)) P.extensions.push(id);
        e.target.closest('.modal-back').remove();
        renderCats(); renderPalette(); changed('ext');
        setTimeout(() => { const hd = $('#ph-' + id, els.pal); if(hd) els.pal.scrollTo({ top:hd.offsetTop - 4 }); }, 30);
      } }, h('div', { class:'ext-ico' }, icon), h('b', {}, name), h('small', {}, line))));
    UI.dialog({ title:t('Add Extension'), body, ok:null, wide:true });
  }

  /* --------------------------------------------------------- palette */
  function otherSprites(){ return P.targets.filter(x => !x.isStage && x !== target); }
  function varNames(tg){ return [...new Set([...Object.keys(P.targets[0].vars), ...(tg.isStage ? [] : Object.keys(tg.vars))])].sort(); }
  function listNames(tg){ return [...new Set([...Object.keys(P.targets[0].lists), ...(tg.isStage ? [] : Object.keys(tg.lists))])].sort(); }
  function messages(){
    const set = new Set(P.targets[0].messages || []);
    for(const tg of P.targets) PROJECT.walkTarget(tg, b => {
      if(b.op === 'event_whenbroadcastreceived' && b.args.BROADCAST_OPTION) set.add(b.args.BROADCAST_OPTION);
      if((b.op === 'event_broadcast' || b.op === 'event_broadcastandwait') && !b.inputs.BROADCAST_INPUT && b.args.BROADCAST_INPUT) set.add(b.args.BROADCAST_INPUT);
    });
    if(!set.size) set.add('message1');
    return [...set];
  }

  function template(op){
    const b = PROJECT.block(op);
    const st = P.targets[0];
    const a = b.args;
    switch(op){
      case 'looks_switchcostumeto': a.COSTUME = (target.costumes[1] || target.costumes[0] || {}).name || ''; break;
      case 'looks_switchbackdropto': case 'looks_switchbackdroptoandwait': a.BACKDROP = (st.costumes[0] || {}).name || ''; break;
      case 'event_whenbackdropswitchesto': a.BACKDROP = (st.costumes[0] || {}).name || ''; break;
      case 'sound_play': case 'sound_playuntildone': a.SOUND_MENU = (target.sounds[0] || {}).name || ''; break;
      case 'event_whenbroadcastreceived': a.BROADCAST_OPTION = messages()[0]; break;
      case 'event_broadcast': case 'event_broadcastandwait': a.BROADCAST_INPUT = messages()[0]; break;
      case 'control_create_clone_of': if(target.isStage) a.CLONE_OPTION = (otherSprites()[0] || {}).name || ''; break;
      case 'sensing_of': {
        const o = otherSprites()[0];
        if(target.isStage && o){ a.OBJECT = o.name; a.PROPERTY = 'x position'; }
        else { a.OBJECT = '_stage_'; a.PROPERTY = 'backdrop #'; }
        break;
      }
      case 'motion_goto': case 'motion_glideto': break;
    }
    if('VARIABLE' in a || BLOCKS.of(op).args.VARIABLE) a.VARIABLE = varNames(target)[0] || 'my variable';
    if(BLOCKS.of(op).args.LIST) a.LIST = listNames(target)[0] || '';
    return b;
  }

  function renderPalette(){
    const keep = els.pal.scrollTop;
    els.pal.innerHTML = '';
    palTemplates = {};
    const isStage = target.isStage;
    const show = spec => !spec.gap && spec.palette !== false && !(spec.sprite && isStage) && !(spec.stage && !isStage);
    for(const c of enabledCats()){
      const sec = h('div', { class:'psec' });
      sec.append(h('div', { class:'ph', id:'ph-' + c.id, 'data-cat':c.id }, h('span', { class:'dot', style:{ background:c.color } }), t(c.name)));
      if(c.id === 'motion' && isStage) sec.append(h('div', { class:'pnote' }, 'Stage selected: no motion blocks'));
      if(c.id === 'variables') variablesSection(sec);
      else if(c.id === 'myblocks') myBlocksSection(sec);
      else {
        let lastGap = false;
        for(const spec of BLOCKS.LIST.filter(x => x.cat === c.id)){
          if(spec.gap){ lastGap = true; continue; }
          if(!show(spec)) continue;
          sec.append(palBlock(template(spec.op), lastGap, spec.monitor));
          lastGap = false;
        }
      }
      els.pal.append(sec);
    }
    els.pal.append(h('div', { style:{ height:'60vh' } }));
    els.pal.scrollTop = keep;
    postLayout(els.pal);
    highlightCat();
  }
  function palBlock(b, gapAbove, monitor){
    const el = blockEl(b, true);
    palTemplates[b.id] = b;
    const row = h('div', { class:'prow' + (gapAbove ? ' gap' : '') });
    if(monitor && !readOnly){
      const m = monitorFor(b);
      const cb = h('input', { type:'checkbox', class:'mon', title:'Show on stage' });
      cb.checked = !!(m && m.visible);
      cb.onchange = () => toggleMonitor(b, cb.checked);
      row.append(cb);
    } else row.append(h('span', { class:'mon-sp' }));
    row.append(el);
    return row;
  }
  function variablesSection(sec){
    const st = P.targets[0];
    if(!readOnly) sec.append(h('button', { class:'pbtn', type:'button', onclick:makeVariable }, t('Make a Variable')));
    for(const name of varNames(target)){
      const b = PROJECT.block('data_variable', { args:{ VARIABLE:name } });
      sec.append(palBlock(b, false, true));
    }
    let gap = true;
    for(const op of ['data_setvariableto','data_changevariableby','data_showvariable','data_hidevariable']){
      sec.append(palBlock(template(op), gap)); gap = false;
    }
    const lc = BLOCKS.cat('lists');
    sec.append(h('div', { class:'ph sub', id:'ph-lists', 'data-cat':'variables' }, h('span', { class:'dot', style:{ background:lc.color } }), t('Lists')));
    if(!readOnly) sec.append(h('button', { class:'pbtn', type:'button', onclick:makeList }, t('Make a List')));
    const names = listNames(target);
    if(names.length){
      for(const name of names) sec.append(palBlock(PROJECT.block('data_listcontents', { args:{ LIST:name } }), false, true));
      let gap2 = true;
      for(const spec of BLOCKS.LIST.filter(x => x.cat === 'lists')){
        if(spec.gap){ gap2 = true; continue; }
        if(spec.palette === false) continue;
        sec.append(palBlock(template(spec.op), gap2)); gap2 = false;
      }
    }
    void st;
  }
  function myBlocksSection(sec){
    if(!readOnly) sec.append(h('button', { class:'pbtn', type:'button', onclick:() => makeBlockDialog() }, t('Make a Block')));
    const procs = PROJECT.procs(target);
    for(const code of Object.keys(procs)){
      const def = procs[code].def;
      const b = PROJECT.block('procedures_call', { proc:{ code } });
      PROJECT.procParts(def.proc).forEach(p => { if(p.arg && p.kind === 's') b.args[p.arg] = ''; });
      sec.append(palBlock(b, true));
    }
  }

  /* ---------------------------------------------------------- monitors */
  function monitorKey(b){
    if(b.op === 'data_variable' || b.op === 'data_listcontents'){
      const kind = b.op === 'data_variable' ? 'var' : 'list';
      const name = b.args.VARIABLE || b.args.LIST;
      const local = !target.isStage && Object.prototype.hasOwnProperty.call(kind === 'var' ? target.vars : target.lists, name);
      return { kind, name, target: local ? target.id : 'stage' };
    }
    const spec = BLOCKS.of(b.op);
    const owner = spec.sprite || ['sound_volume','looks_costumenumbername'].includes(b.op) ? target.id : 'stage';
    return { kind:'op', op:b.op, args:{ ...b.args }, target: target.isStage ? 'stage' : owner };
  }
  function monitorFor(b){
    const k = monitorKey(b);
    return P.monitors.find(m => m.kind === k.kind && m.target === k.target &&
      (k.kind === 'op' ? m.op === k.op && JSON.stringify(m.args || {}) === JSON.stringify(k.args) : m.name === k.name));
  }
  function toggleMonitor(b, on){
    let m = monitorFor(b);
    if(!m){ m = { id:PROJECT.uid(), ...monitorKey(b), visible:on, x:5, y:5 + (P.monitors.filter(x => x.visible).length * 30) % 320 }; P.monitors.push(m); }
    m.visible = on;
    changed('monitors');
  }

  /* -------------------------------------------------------- variables */
  async function makeVariable(){ return makeData('var'); }
  async function makeList(){ return makeData('list'); }
  async function makeData(kind){
    const st = P.targets[0];
    let scope = 'all';
    const radios = target.isStage ? null : h('div', { class:'scope' },
      h('label', {}, h('input', { type:'radio', name:'scope', checked:true, onchange:() => scope = 'all' }), ' ' + t('For all sprites')),
      h('label', {}, h('input', { type:'radio', name:'scope', onchange:() => scope = 'one' }), ' ' + t('For this sprite only')));
    const name = await UI.ask(kind === 'var' ? t('New variable name:') : t('New list name:'), '', radios);
    if(!name) return;
    const store = kind === 'var' ? 'vars' : 'lists';
    const taken = Object.prototype.hasOwnProperty.call(st[store], name) || P.targets.some(x => Object.prototype.hasOwnProperty.call(x[store], name));
    if(taken){ UI.toast('“' + name + '” already exists'); return; }
    const where = scope === 'one' ? target : st;
    where[store][name] = kind === 'var' ? 0 : [];
    if(kind === 'list') P.monitors.push({ id:PROJECT.uid(), kind:'list', name, target: where === st ? 'stage' : target.id, visible:true, x:5, y:5 });
    renderPalette(); changed('vars');
  }
  async function renameData(kind, old){
    const store = kind === 'var' ? 'vars' : 'lists', arg = kind === 'var' ? 'VARIABLE' : 'LIST';
    const name = await UI.ask(kind === 'var' ? t('Rename variable') : t('Rename list'), old);
    if(!name || name === old) return;
    const local = !target.isStage && Object.prototype.hasOwnProperty.call(target[store], old);
    const owner = local ? target : P.targets[0];
    if(Object.prototype.hasOwnProperty.call(owner[store], name)){ UI.toast('“' + name + '” already exists'); return; }
    owner[store][name] = owner[store][old]; delete owner[store][old];
    const touched = local ? [target] : P.targets.filter(x => x.isStage || !Object.prototype.hasOwnProperty.call(x[store], old));
    for(const tg of touched) PROJECT.walkTarget(tg, b => { if(b.args && b.args[arg] === old) b.args[arg] = name; });
    P.monitors.forEach(m => { if(m.kind === kind && m.name === old && m.target === (local ? target.id : 'stage')) m.name = name; });
    renderAll(); changed('vars');
  }
  function deleteData(kind, name){
    const store = kind === 'var' ? 'vars' : 'lists';
    const local = !target.isStage && Object.prototype.hasOwnProperty.call(target[store], name);
    delete (local ? target : P.targets[0])[store][name];
    P.monitors = P.monitors.filter(m => !(m.kind === kind && m.name === name && m.target === (local ? target.id : 'stage')));
    renderPalette(); changed('vars');
  }

  /* -------------------------------------------------------- My Blocks */
  async function makeBlockDialog(existing){
    let parts = existing ? PROJECT.procParts(existing.proc).map(p => typeof p === 'string' ? { label:p } : { arg:true, kind:p.kind, name:p.name })
                         : [{ label:'block name' }];
    let warp = existing ? !!existing.proc.warp : false;
    const preview = h('div', { class:'proto-edit' });
    function draw(){
      preview.innerHTML = '';
      parts.forEach((p, i) => {
        const inp = h('input', { class: p.arg ? (p.kind === 'b' ? 'pe-bool' : 'pe-arg') : 'pe-label', value: p.arg ? p.name : p.label,
          size: Math.max(3, (p.arg ? p.name : p.label).length), oninput:e => { p.arg ? p.name = e.target.value : p.label = e.target.value; e.target.size = Math.max(3, e.target.value.length); } });
        const wrap = h('span', { class:'pe-part' }, inp);
        if(parts.length > 1) wrap.append(h('button', { type:'button', class:'pe-x', title:t('Delete'), onclick:() => { parts.splice(i, 1); draw(); } }, '×'));
        preview.append(wrap);
      });
    }
    draw();
    const n = () => parts.filter(p => p.arg).length + 1;
    const body = h('div', {},
      preview,
      h('div', { class:'pe-add' },
        h('button', { type:'button', class:'btn', onclick:() => { parts.push({ arg:true, kind:'s', name:'number or text' + (n() > 1 ? n() : '') }); draw(); } }, '( ) ' + t('Add an input (number or text)')),
        h('button', { type:'button', class:'btn', onclick:() => { parts.push({ arg:true, kind:'b', name:'boolean' + (n() > 1 ? n() : '') }); draw(); } }, '< > ' + t('Add an input (boolean)')),
        h('button', { type:'button', class:'btn', onclick:() => { parts.push({ label:'label text' }); draw(); } }, 'Aa ' + t('Add a label'))),
      h('label', { class:'pe-warp' }, h('input', { type:'checkbox', checked:warp, onchange:e => warp = e.target.checked }), ' ' + t('Run without screen refresh')));
    const ok = await UI.dialog({ title:t('Make a Block'), body, wide:true });
    if(!ok) return;
    parts = parts.filter(p => p.arg ? p.name.trim() : p.label.trim());
    if(!parts.length) return;
    const code = parts.map(p => p.arg ? '%' + p.kind : p.label.trim().replace(/%/g, '')).join(' ');
    const names = parts.filter(p => p.arg).map(p => p.name.trim());
    if(new Set(names).size !== names.length){ UI.toast('Two inputs have the same name'); return; }
    const procs = PROJECT.procs(target);
    if(procs[code] && (!existing || existing.proc.code !== code)){ UI.toast('That block already exists'); return; }
    remember();
    if(existing){
      const oldCode = existing.proc.code, oldNames = existing.proc.names || [];
      existing.proc = { code, names, warp };
      // argument reporters follow their input by position
      PROJECT.walk(procs[oldCode] ? procs[oldCode].script.blocks : [], b => {
        if((b.op === 'argument_reporter' || b.op === 'argument_boolean')){
          const i = oldNames.indexOf(b.name);
          if(i >= 0 && names[i]) b.name = names[i];
        }
      });
      PROJECT.walkTarget(target, b => { if(b.op === 'procedures_call' && b.proc && b.proc.code === oldCode) b.proc.code = code; });
    } else {
      const spot = freeSpot();
      target.scripts.push({ id:PROJECT.uid(), x:spot.x, y:spot.y,
        blocks:[{ id:PROJECT.uid(), op:'procedures_definition', args:{}, inputs:{}, proc:{ code, names, warp } }] });
    }
    renderPalette(); renderWorkspace(); changed();
  }

  /* somewhere in view that no script is covering */
  function freeSpot(){
    const ws = els.ws, y = Math.round(ws.scrollTop / zoom) + 30;
    let x = Math.round(ws.scrollLeft / zoom) + 30;
    const boxes = [...els.wsc.children].map(e => ({ l:e.offsetLeft, r:e.offsetLeft + e.offsetWidth, t:e.offsetTop, b:e.offsetTop + e.offsetHeight }));
    for(let tries = 0; tries < 50; tries++){
      const hit = boxes.find(b => x < b.r + 20 && x + 220 > b.l && y < b.b + 20 && y + 120 > b.t);
      if(!hit) break;
      x = hit.r + 30;
    }
    return { x, y };
  }

  /* ----------------------------------------------------- menu options */
  function menuOptions(b, name){
    const spec = argSpec(b, name);
    const m = spec && spec.menu;
    const st = P.targets[0];
    const others = () => otherSprites().map(s => [s.name, s.name]);
    switch(m){
      case 'goto': return [['random position','_random_'],['mouse-pointer','_mouse_'], ...others()];
      case 'pointto': return [['mouse-pointer','_mouse_'],['random direction','_random_'], ...others()];
      case 'costume': return target.costumes.map(c => [c.name, c.name]);
      case 'backdrop': return [...st.costumes.map(c => [c.name, c.name]), ['next backdrop','next backdrop'],['previous backdrop','previous backdrop'],['random backdrop','random backdrop']];
      case 'backdropname': return st.costumes.map(c => [c.name, c.name]);
      case 'sound': return target.sounds.map(s => [s.name, s.name]);
      case 'touching': return [['mouse-pointer','_mouse_'],['edge','_edge_'], ...others()];
      case 'clone': return [...(target.isStage ? [] : [['myself','_myself_']]), ...others()];
      case 'distance': return [['mouse-pointer','_mouse_'], ...others()];
      case 'oftarget': return [['Stage','_stage_'], ...others()];
      case 'ofprop': {
        const o = b.inputs && b.inputs.OBJECT ? null : b.args.OBJECT;
        if(o === '_stage_') return [['backdrop #','backdrop #'],['backdrop name','backdrop name'],['volume','volume'], ...Object.keys(st.vars).map(v => [v, v])];
        const s = P.targets.find(x => !x.isStage && x.name === o);
        return [['x position','x position'],['y position','y position'],['direction','direction'],['costume #','costume #'],
          ['costume name','costume name'],['size','size'],['volume','volume'], ...(s ? Object.keys(s.vars).map(v => [v, v]) : [])];
      }
      case 'message': return [...messages().map(x => [x, x]), ['New message', '__new__']];
      default: return m ? BLOCKS.MENUS[m] || [] : [];
    }
  }
  function argSpec(b, name){
    if(b.op === 'procedures_call') return { t: procKinds(b)[name] === 'b' ? 'bool' : 'str' };
    const spec = BLOCKS.of(b.op);
    if(!spec) return null;
    const a = spec.args[name];
    if(a && a.t === 'var') return { t:'var' };
    if(a && a.t === 'list') return { t:'list' };
    return a || null;
  }
  function procKinds(b){
    const out = {};
    const def = callDef(b);
    const kinds = String((def ? def.proc.code : b.proc && b.proc.code) || '').match(/%[sb]/g) || [];
    kinds.forEach((k, i) => out['A' + i] = k[1]);
    return out;
  }
  function callDef(b){
    const owner = P.targets.find(x => x.scripts.some(s => s.blocks[0] && s.blocks[0].op === 'procedures_definition' && s.blocks[0].proc && s.blocks[0].proc.code === (b.proc && b.proc.code)) && (x === target || true));
    const procs = PROJECT.procs(target);
    const p = procs[b.proc && b.proc.code] || (owner && PROJECT.procs(owner)[b.proc.code]);
    return p ? p.def : null;
  }
  function labelFor(b, name, value){
    const spec = argSpec(b, name);
    if(spec && spec.menu){
      const opt = menuOptions(b, name).find(o => o[1] === value);
      if(opt) return opt[0];
    }
    return value;
  }

  /* --------------------------------------------------- block elements */
  function blockEl(b, pal){
    const spec = BLOCKS.of(b.op);
    const catId = spec ? spec.cat : 'myblocks';
    const cat = BLOCKS.cat(catId) || BLOCKS.cat('myblocks');
    let shape = spec ? spec.shape : 'stack';
    const el = h('div', { class:'b s-' + shape + (pal ? ' pal' : ''), 'data-id':b.id, 'data-op':b.op });
    el.style.setProperty('--c', cat.pastel || cat.color); el.style.setProperty('--d', cat.dark);
    const row = h('div', { class:'r' });

    if(b.op === 'procedures_definition'){
      row.append(h('span', { class:'t' }, 'define'));
      const proto = h('span', { class:'proto' });
      for(const p of PROJECT.procParts(b.proc || { code:'' })){
        if(typeof p === 'string') proto.append(h('span', { class:'t' }, p));
        else {
          const a = h('div', { class:'b argtpl ' + (p.kind === 'b' ? 's-bool' : 's-report'), 'data-argname':p.name, 'data-argkind':p.kind });
          a.style.setProperty('--c', cat.pastel || cat.color); a.style.setProperty('--d', cat.dark);
          a.append(h('div', { class:'r' }, h('span', { class:'t' }, p.name)));
          proto.append(a);
        }
      }
      row.append(proto);
    } else if(b.op === 'procedures_call'){
      const def = callDef(b);
      const parts = PROJECT.procParts(def ? def.proc : (b.proc || { code:'?' }));
      if(!def) el.classList.add('missing');
      for(const p of parts){
        if(typeof p === 'string') row.append(h('span', { class:'t' }, p));
        else row.append(argEl(b, p.arg, { t: p.kind === 'b' ? 'bool' : 'str' }, pal));
      }
    } else if(b.op === 'argument_reporter' || b.op === 'argument_boolean'){
      row.append(h('span', { class:'t' }, b.name || ''));
    } else if(spec){
      for(const p of BLOCKS.parts(spec.text)){
        if(typeof p === 'string') row.append(h('span', { class:'t' }, p.trim()));
        else row.append(argEl(b, p.arg, spec.args[p.arg], pal));
      }
    } else row.append(h('span', { class:'t' }, '? ' + b.op));
    if(!pal && !readOnly && !BLOCKS.isReporter(shape)) row.append(h('span', { class:'rx', title:t('Delete Block') }, '✕'));
    el.append(row);

    if(BLOCKS.isC(shape)){
      el.append(mouth(b, 'body', pal));
      if(shape === 'c2'){
        const er = h('div', { class:'r else' }, h('span', { class:'t' }, 'else'));
        el.append(er, mouth(b, 'body2', pal));
      }
      el.append(h('div', { class:'foot' }));
    }
    return el;
  }
  function mouth(b, which, pal){
    const m = h('div', { class:'mouth' }, h('div', { class:'arm' }));
    const l = h('div', { class:'list in-mouth' });
    if(!pal){
      const key = b.id + ':' + which;
      l.dataset.key = key;
      lists[key] = { arr:b[which], owner:b, top:false };
      b[which].forEach((c, i) => { index[c.id] = { block:c, list:b[which], idx:i, parent:b }; l.append(blockEl(c, pal)); walkInputs(c); });
    }
    m.append(l);
    return m;
  }
  function walkInputs(b){
    for(const k in b.inputs || {}){
      const inp = b.inputs[k];
      if(inp){ index[inp.id] = { block:inp, parent:b, slot:k }; walkInputs(inp); }
    }
  }
  function argEl(b, name, spec, pal){
    const inp = b.inputs && b.inputs[name];
    if(inp){
      const el = blockEl(inp, pal);
      el.dataset.slot = name; el.dataset.parent = b.id; el.dataset.slotType = spec ? spec.t : 'str';
      return el;
    }
    const v = b.args[name];
    const t0 = spec ? spec.t : 'str';
    const attrs = { 'data-arg':name, 'data-parent':b.id };
    switch(t0){
      case 'bool': return h('span', { class:'hole', 'data-slot':name, 'data-slot-type':'bool', ...attrs });
      case 'color': return h('span', { class:'sw', 'data-slot':name, 'data-slot-type':'color', ...attrs, style:{ background: /^#[0-9a-f]{6}$/i.test(v) ? v : '#000' } });
      case 'menu': case 'var': case 'list':
        return h('span', { class:'f f-menu', ...attrs }, h('span', {}, String(labelFor(b, name, v == null ? '' : v))), h('i', { class:'caret' }));
      case 'rmenu':
        return h('span', { class:'f f-rmenu', 'data-slot':name, 'data-slot-type':'rmenu', ...attrs }, h('span', {}, String(labelFor(b, name, v == null ? '' : v))), h('i', { class:'caret' }));
      default:
        return h('span', { class:'f f-' + (t0 === 'num' ? 'num' : 'str'), 'data-slot':name, 'data-slot-type':t0, ...attrs }, String(v == null ? '' : v));
    }
  }

  /* -------------------------------------------------------- workspace */
  function renderWorkspace(){
    index = {}; lists = {};
    els.wsc.innerHTML = '';
    els.wsc.style.transform = `scale(${zoom})`;
    let maxX = 0, maxY = 0;
    for(const s of target.scripts){
      const sEl = h('div', { class:'script', 'data-script':s.id, style:{ left:s.x + 'px', top:s.y + 'px' } });
      const l = h('div', { class:'list top' });
      const key = 'S:' + s.id;
      l.dataset.key = key;
      lists[key] = { arr:s.blocks, script:s, top:true };
      s.blocks.forEach((b, i) => { index[b.id] = { block:b, list:s.blocks, idx:i, script:s }; l.append(blockEl(b, false)); walkInputs(b); });
      sEl.append(l);
      els.wsc.append(sEl);
      maxX = Math.max(maxX, s.x); maxY = Math.max(maxY, s.y);
    }
    // the script each block lives in, for running and positions
    for(const s of target.scripts) PROJECT.walk(s.blocks, b => { if(index[b.id]) index[b.id].script = s; });
    postLayout(els.wsc);
    let w = 0, hh = 0;
    for(const sEl of els.wsc.children){ w = Math.max(w, sEl.offsetLeft + sEl.offsetWidth); hh = Math.max(hh, sEl.offsetTop + sEl.offsetHeight); }
    const W = Math.max(w + 600, els.ws.clientWidth / zoom), H = Math.max(hh + 500, els.ws.clientHeight / zoom);
    els.wsc.style.width = W + 'px'; els.wsc.style.height = H + 'px';
    els.wsSizer.style.width = W * zoom + 'px'; els.wsSizer.style.height = H * zoom + 'px';
    els.empty.style.display = target.scripts.length ? 'none' : '';
    els.ws.classList.toggle('ro', readOnly);
    updateGlow();
  }
  /* a C block's bottom arm is as wide as its top */
  function postLayout(root){
    for(const c of root.querySelectorAll('.s-c, .s-c2, .s-capc')){
      const r = c.firstElementChild, f = c.lastElementChild;
      if(r && f && f.classList.contains('foot')) f.style.width = Math.max(r.offsetWidth, 64) + 'px';
      const e = c.querySelector(':scope > .else');
      if(e) e.style.width = Math.max(r.offsetWidth, 64) + 'px';
    }
  }
  function updateGlow(){
    if(!els.wsc) return;
    for(const sEl of els.wsc.children){
      const s = target.scripts.find(x => x.id === sEl.dataset.script);
      sEl.classList.toggle('run', !!(s && VM.isRunning(s)));
    }
  }

  /* -------------------------------------------------------- pointer */
  function down(e){
    if(e.button !== 0) return;
    if(e.target.closest('.zoom, .pbtn, input, button, .ws-empty')) return;
    const x = e.target.closest('.rx');
    if(x){ e.preventDefault(); const info = index[x.closest('.b').dataset.id]; if(info) deleteBlock(info); return; }
    const bEl = e.target.closest('.b');
    const fromPal = !!e.target.closest('#pal');
    if(!bEl){
      if(!fromPal){ pending = { pan:true, x:e.clientX, y:e.clientY, sl:els.ws.scrollLeft, st:els.ws.scrollTop }; }
      return;
    }
    e.preventDefault();
    const ed = document.querySelector('.field-edit'); if(ed) ed.blur();
    pending = { x:e.clientX, y:e.clientY, el:bEl, field:e.target.closest('.f, .sw'), fromPal, id:pending && pending.id };
  }
  function move(e){
    if(drag){ dragMove(e); return; }
    if(!pending) return;
    if(pending.pan){
      els.ws.scrollLeft = pending.sl - (e.clientX - pending.x);
      els.ws.scrollTop = pending.st - (e.clientY - pending.y);
      if(Math.abs(e.clientX - pending.x) + Math.abs(e.clientY - pending.y) > 4) els.ws.classList.add('panning');
      return;
    }
    if(Math.abs(e.clientX - pending.x) + Math.abs(e.clientY - pending.y) > 5){
      if(readOnly && !pending.fromPal) { pending = null; return; }
      if(readOnly){ pending = null; return; }
      startDrag(pending, e);
      pending = null;
    }
  }
  function up(e){
    if(drag){ drop(e); return; }
    const p = pending; pending = null;
    els.ws.classList.remove('panning');
    if(!p || p.pan) return;
    if(p.field && !readOnly && !(p.field.closest('.b') !== p.el && false)) return openField(p.field);
    clickBlock(p.el, p.fromPal);
  }

  function clickBlock(el, fromPal){
    if(el.classList.contains('argtpl')) return;
    if(fromPal){
      const b = palTemplates[el.dataset.id];
      if(!b) return;
      const r = VM.runOnce(target, b);
      if(r) report(el, r.value);
      return;
    }
    const info = index[el.dataset.id]; if(!info) return;
    const s = info.script; if(!s) return;
    const r = VM.toggleScript(target, s);
    if(r) report(el, r.value);
    setTimeout(updateGlow, 50);
  }
  function report(el, v){
    $$('.report-bubble').forEach(x => x.remove());
    const r = el.getBoundingClientRect();
    const text = typeof v === 'boolean' ? String(v) : Array.isArray(v) ? VM.listText(v) : VM.toStr(v);
    const bub = h('div', { class:'report-bubble', style:{ left:r.left + 'px', top:(r.bottom + 8) + 'px' } }, text === '' ? ' ' : text);
    document.body.append(bub);
    setTimeout(() => bub.remove(), 3000);
  }

  /* ------------------------------------------------------- dragging */
  function startDrag(p, e){
    const r = p.el.getBoundingClientRect();
    const offX = p.x - r.left, offY = p.y - r.top;     // where the block was grabbed, not where the drag was noticed
    const before = snap();
    let blocks, fromScript = null;

    if(p.el.classList.contains('argtpl')){
      blocks = [{ id:PROJECT.uid(), op:p.el.dataset.argkind === 'b' ? 'argument_boolean' : 'argument_reporter', name:p.el.dataset.argname, args:{}, inputs:{} }];
    } else if(p.fromPal){
      const tpl = palTemplates[p.el.dataset.id];
      if(!tpl) return;
      blocks = [PROJECT.copy(tpl)];
    } else {
      const info = index[p.el.dataset.id];
      if(!info) return;
      if(info.slot){ delete info.parent.inputs[info.slot]; blocks = [info.block]; }
      else {
        blocks = info.list.splice(info.idx);
        if(info.script && info.list === info.script.blocks && !info.list.length){
          fromScript = info.script;
          target.scripts.splice(target.scripts.indexOf(info.script), 1);
        }
      }
      renderWorkspace();
    }
    const ghost = h('div', { class:'drag-ghost' });
    const inner = h('div', { class:'list top', style:{ transform:`scale(${zoom})`, transformOrigin:'0 0' } });
    blocks.forEach(b => inner.append(blockEl(b, false)));
    ghost.append(inner);
    document.body.append(ghost);
    postLayout(ghost);
    drag = { blocks, offX, offY, ghost, before, fromPal:p.fromPal, best:null, fromScript };
    drag.shape = shapeOf(blocks[0]);
    drag.reporter = BLOCKS.isReporter(drag.shape);
    drag.targets = drag.reporter ? slotTargets() : stackTargets();
    drag.h = inner.getBoundingClientRect().height / zoom;
    drag.w = inner.firstElementChild.getBoundingClientRect().width / zoom;
    document.body.classList.add('dragging');
    dragMove(e);
  }
  const shapeOf = b => b.op === 'argument_reporter' ? 'report' : b.op === 'argument_boolean' ? 'bool' :
    b.op === 'procedures_definition' ? 'hat' : b.op === 'procedures_call' ? 'stack' : (BLOCKS.of(b.op) || {}).shape;

  /* screen point -> canvas units */
  function toCanvas(x, y){
    const r = els.wsc.getBoundingClientRect();
    return { x:(x - r.left) / zoom, y:(y - r.top) / zoom };
  }

  function stackTargets(){
    const out = [];
    const D = drag ? drag.blocks : [];
    const first = D[0], last = D[D.length - 1];
    const firstShape = shapeOf(first), lastShape = shapeOf(last);
    const isHat = firstShape === 'hat';
    const endsCap = BLOCKS.isCap(lastShape);
    const lastIsEmptyForever = lastShape === 'capc' && (!last.body || !last.body.length);
    for(const l of $$('.list', els.wsc)){
      const ref = lists[l.dataset.key]; if(!ref) continue;
      const arr = ref.arr;
      const kids = [...l.children];
      if(ref.top && arr[0] && BLOCKS.isReporter(shapeOf(arr[0]))) continue;     // a loose reporter
      for(let i = 0; i <= arr.length; i++){
        const prev = arr[i - 1], next = arr[i];
        let pt, kind = 'insert';
        if(i === 0){
          const rr = (kids[0] || l).getBoundingClientRect();
          pt = toCanvas(rr.left, rr.top);
          if(ref.top){
            kind = 'above';
            if(next && shapeOf(next) === 'hat') continue;
            if(endsCap && !(lastIsEmptyForever)) continue;
          } else if(isHat) continue;
        } else {
          if(isHat) continue;
          if(BLOCKS.isCap(shapeOf(prev))) continue;
          const rr = kids[i - 1].getBoundingClientRect();
          pt = toCanvas(rr.left, rr.bottom);
        }
        if(kind === 'insert' && next && endsCap && !lastIsEmptyForever) continue;
        out.push({ kind, ref, i, x:pt.x, y:pt.y });
      }
    }
    // an empty C block can wrap round a whole script
    if(D.length === 1 && BLOCKS.isC(firstShape) && (!first.body || !first.body.length)){
      for(const s of target.scripts){
        const b0 = s.blocks[0];
        if(!b0 || shapeOf(b0) === 'hat' || BLOCKS.isReporter(shapeOf(b0))) continue;
        if(firstShape === 'capc' && false) continue;
        out.push({ kind:'wrap', script:s, x:s.x, y:s.y });
      }
    }
    return out;
  }
  function slotTargets(){
    const out = [];
    const isBool = drag && drag.shape === 'bool';
    for(const el of $$('[data-slot]', els.wsc)){
      const type = el.dataset.slotType;
      if(type === 'bool' && !isBool) continue;
      if(type !== 'bool' && el.classList.contains('hole')) continue;
      const r = el.getBoundingClientRect();
      const p = toCanvas(r.left, r.top);
      out.push({ kind:'slot', el, parent:el.dataset.parent, name:el.dataset.slot, x:p.x, y:p.y + r.height / zoom / 2, w:r.width / zoom });
    }
    return out;
  }

  function dragMove(e){
    const d = drag;
    d.ghost.style.left = (e.clientX - d.offX) + 'px';
    d.ghost.style.top = (e.clientY - d.offY) + 'px';
    autoscroll(e);
    // where the dragged blocks are, in canvas units
    const tl = toCanvas(e.clientX - d.offX, e.clientY - d.offY);
    const overPal = overPalette(e);
    let best = null, bestD = Infinity;
    if(!overPal){
      for(const c of d.targets){
        let dx, dy;
        if(c.kind === 'above'){ dx = tl.x - c.x; dy = tl.y + d.h - c.y; }
        else if(c.kind === 'wrap'){ dx = tl.x + 16 - c.x; dy = tl.y + 40 - c.y; }
        else if(c.kind === 'slot'){ dx = tl.x - c.x; dy = tl.y + 16 - c.y; if(dx < -30 || dx > c.w + 10) continue; }
        else { dx = tl.x - c.x; dy = tl.y - c.y; }
        const dist = Math.hypot(dx, dy * 1.4);
        const lim = c.kind === 'slot' ? 36 : 44;
        if(dist < lim && dist < bestD){ bestD = dist; best = c; }
      }
    }
    if(best !== d.best){ d.best = best; showMarker(best); }
    d.ghost.classList.toggle('trash', overPal);
  }
  function overPalette(e){
    for(const el of [els.pal, els.cats]){
      const r = el.getBoundingClientRect();
      if(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
    }
    return false;
  }
  function autoscroll(e){
    const r = els.ws.getBoundingClientRect(), m = 30, sp = 14;
    if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    if(e.clientX > r.right - m) els.ws.scrollLeft += sp;
    else if(e.clientX < r.left + m) els.ws.scrollLeft -= sp;
    if(e.clientY > r.bottom - m) els.ws.scrollTop += sp;
    else if(e.clientY < r.top + m) els.ws.scrollTop -= sp;
  }
  function showMarker(c){
    $$('.marker', els.wsc).forEach(x => x.remove());
    $$('.slot-hi', els.wsc).forEach(x => x.classList.remove('slot-hi'));
    if(!c) return;
    if(c.kind === 'slot'){ c.el.classList.add('slot-hi'); return; }
    if(c.kind === 'wrap'){
      els.wsc.append(h('div', { class:'marker wrap', style:{ left:(c.x - 16) + 'px', top:(c.y - 40) + 'px', height:'40px', width:Math.max(80, drag.w) + 'px' } }));
      return;
    }
    const y = c.kind === 'above' ? c.y - drag.h : c.y;
    els.wsc.append(h('div', { class:'marker' + (c.kind === 'above' ? ' above' : ''), style:{ left:c.x + 'px', top:(c.kind === 'above' ? y : y - 3) + 'px',
      width:Math.max(60, drag.w) + 'px', height:(c.kind === 'above' ? drag.h : 8) + 'px' } }));
  }

  function drop(e){
    const d = drag; drag = null;
    document.body.classList.remove('dragging');
    d.ghost.remove();
    $$('.marker', els.wsc).forEach(x => x.remove());
    const tl = toCanvas(e.clientX - d.offX, e.clientY - d.offY);

    // onto a sprite in the sprite list: copy it there
    const tile = document.elementFromPoint(e.clientX, e.clientY);
    const spriteTile = tile && tile.closest('[data-sprite-id]');
    if(spriteTile && !d.fromPal){
      const tg = P.targets.find(x => x.id === spriteTile.dataset.spriteId);
      target.scripts = JSON.parse(d.before);
      if(tg && tg !== target){
        tg.scripts.push({ id:PROJECT.uid(), x:40 + tg.scripts.length * 10, y:40 + tg.scripts.length * 10, blocks:PROJECT.copy(d.blocks) });
        UI.toast('→ ' + tg.name);
        changed();
      }
      renderWorkspace(); return;
    }
    if(overPalette(e)){
      if(!d.fromPal){ remember(d.before); renderWorkspace(); changed(); }
      return;
    }
    const c = d.best;
    if(c && c.kind === 'insert'){
      c.ref.arr.splice(c.i, 0, ...d.blocks);
      const last = d.blocks[d.blocks.length - 1];
      if(shapeOf(last) === 'capc' && c.i + d.blocks.length < c.ref.arr.length) last.body.push(...c.ref.arr.splice(c.i + d.blocks.length));
    } else if(c && c.kind === 'above'){
      const s = c.ref.script;
      const last = d.blocks[d.blocks.length - 1];
      if(shapeOf(last) === 'capc'){ last.body.push(...s.blocks.splice(0)); }
      s.blocks.unshift(...d.blocks);
      s.x = Math.round(tl.x); s.y = Math.round(tl.y);
    } else if(c && c.kind === 'wrap'){
      const cb = d.blocks[0];
      cb.body = c.script.blocks.splice(0);
      c.script.blocks.push(cb);
      c.script.x = Math.round(tl.x); c.script.y = Math.round(tl.y);
    } else if(c && c.kind === 'slot'){
      const info = index[c.parent];
      const parent = info ? info.block : findBlock(c.parent);
      if(parent){
        const old = parent.inputs[c.name];
        if(old){
          const p = slotPos(c);
          target.scripts.push({ id:PROJECT.uid(), x:Math.round(p.x + 20), y:Math.round(p.y + 30), blocks:[old] });
        }
        parent.inputs[c.name] = d.blocks[0];
      }
    } else {
      target.scripts.push({ id:PROJECT.uid(), x:Math.max(4, Math.round(tl.x)), y:Math.max(4, Math.round(tl.y)), blocks:d.blocks });
    }
    remember(d.before);
    renderWorkspace();
    if(d.blocks.some(b => b.op === 'procedures_definition')) renderPalette();
    changed();
  }
  const slotPos = c => ({ x:c.x, y:c.y });
  function findBlock(id){
    let f = null;
    for(const s of target.scripts) PROJECT.walk(s.blocks, b => { if(b.id === id) f = b; });
    return f;
  }

  /* --------------------------------------------------- field editing */
  function openField(f){
    const bEl = f.closest('.b');
    const inPal = !!f.closest('#pal');
    const parentId = f.dataset.parent;
    const b = inPal ? palTemplates[parentId] || findPalTemplate(parentId) : (index[parentId] ? index[parentId].block : null);
    if(!b) return;
    const name = f.dataset.arg;
    if(f.classList.contains('sw')) return colorField(f, b, name, inPal);
    if(f.classList.contains('f-menu') || f.classList.contains('f-rmenu')) return menuField(f, b, name, inPal);
    // a text or number box
    const before = inPal ? null : snap();
    const r = f.getBoundingClientRect();
    const isNum = f.classList.contains('f-num');
    const input = h('input', { class:'field-edit' + (isNum ? ' num' : ''), value:b.args[name] == null ? '' : b.args[name],
      inputmode: isNum ? 'decimal' : 'text', spellcheck:'false', autocomplete:'off',
      style:{ left:r.left + 'px', top:r.top + 'px', height:r.height + 'px', minWidth:r.width + 'px', fontSize:(12 * (inPal ? 1 : zoom)) + 'px' } });
    document.body.append(input);
    input.focus(); input.select();
    const sync = () => {
      let v = input.value;
      if(isNum) v = v.replace(/[^0-9.eE+\-]/g, '');
      if(isNum && v !== input.value) input.value = v;
      b.args[name] = isNum && v !== '' && !isNaN(Number(v)) && !/[eE]$/.test(v) && v !== '-' ? v : v;
      f.textContent = v;
      input.style.width = Math.max(r.width, f.getBoundingClientRect().width) + 'px';
    };
    input.addEventListener('input', sync);
    let gone = false;
    const finish = () => {
      if(gone) return; gone = true;
      input.remove();
      if(isNum){ const v = String(b.args[name]); if(v !== '' && !isNaN(Number(v))) b.args[name] = Number(v) === Math.trunc(Number(v)) && !/\./.test(v) ? Number(v) : v; }
      if(!inPal){ remember(before); renderWorkspace(); changed(); }
      else renderPaletteSoon();
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab'){ e.preventDefault(); input.blur(); } e.stopPropagation(); });
    void bEl;
  }
  function findPalTemplate(id){
    for(const tpl of Object.values(palTemplates)){
      if(tpl.id === id) return tpl;
      let found = null; PROJECT.walk([tpl], b => { if(b.id === id) found = b; });
      if(found) return found;
    }
    return null;
  }
  let palT = null;
  function renderPaletteSoon(){ clearTimeout(palT); palT = setTimeout(() => {}, 0); }

  function menuField(f, b, name, inPal){
    const r = f.getBoundingClientRect();
    const opts = menuOptions(b, name);
    const spec = argSpec(b, name);
    let items = opts.map(([label, value]) => ({ label, value, on: b.args[name] === value }));
    if(spec && (spec.t === 'var' || spec.t === 'list')){
      const names = spec.t === 'var' ? varNames(target) : listNames(target);
      items = names.map(n => ({ label:n, value:n, on: b.args[name] === n }));
      if(!inPal && !readOnly) items.push({ sep:true }, { label:t(spec.t === 'var' ? 'Rename variable' : 'Rename list'), value:'__rename__' });
    }
    if(!items.length) return;
    UI.menu(r.left, r.bottom + 4, items, async value => {
      const before = inPal ? null : snap();
      if(value === '__rename__') return renameData(spec.t, b.args[name]);
      if(value === '__new__'){
        const m = await UI.ask(t('New message name:'));
        if(!m) return;
        const st = P.targets[0];
        if(!st.messages.includes(m)) st.messages.push(m);
        value = m;
      }
      b.args[name] = value;
      if(b.op === 'sensing_of' && name === 'OBJECT'){
        const props = menuOptions(b, 'PROPERTY').map(o => o[1]);
        if(!props.includes(b.args.PROPERTY)) b.args.PROPERTY = props[0];
      }
      if(inPal){ renderPalette(); return; }
      remember(before); renderWorkspace(); changed();
    }, { above:r.top - 4 });
  }
  function colorField(f, b, name, inPal){
    const r = f.getBoundingClientRect();
    const input = h('input', { type:'color', value: /^#[0-9a-f]{6}$/i.test(b.args[name]) ? b.args[name] : '#000000' });
    const before = inPal ? null : snap();
    const apply = v => { b.args[name] = v; f.style.background = v; };
    const pop = h('div', { class:'pop color-pop', style:{ left:r.left + 'px', top:(r.bottom + 6) + 'px' } },
      input,
      h('button', { class:'btn small', type:'button', title:'Pick a colour from the stage', onclick:() => {
        UI.closeMenu(); pop.remove();
        startEyedropper(v => { apply(v); finish(); });
      } }, '💧 ' + 'Stage'),
      h('button', { class:'btn small primary', type:'button', onclick:() => { pop.remove(); finish(); } }, t('OK')));
    input.addEventListener('input', () => apply(input.value));
    document.body.append(pop);
    const off = e => { if(!pop.contains(e.target)){ pop.remove(); removeEventListener('pointerdown', off, true); finish(); } };
    setTimeout(() => addEventListener('pointerdown', off, true), 0);
    let done = false;
    function finish(){ if(done) return; done = true; removeEventListener('pointerdown', off, true); if(!inPal){ remember(before); renderWorkspace(); changed(); } }
  }
  function startEyedropper(cb){ eyedropper = cb; document.body.classList.add('eyedropper'); UI.toast('💧 Click the stage'); }
  function takeEyedropper(){ const cb = eyedropper; eyedropper = null; document.body.classList.remove('eyedropper'); return cb; }

  /* ------------------------------------------------------ right click */
  function wsContext(e){
    e.preventDefault();
    if(readOnly) return;
    const bEl = e.target.closest('.b');
    if(bEl && !bEl.classList.contains('argtpl')){
      const info = index[bEl.dataset.id]; if(!info) return;
      const b = info.block;
      const items = [{ label:t('Duplicate'), value:'dup' }];
      if(b.op === 'procedures_definition') items.push({ label:t('Edit'), value:'edit' });
      if(b.op === 'procedures_call') items.push({ label:t('Edit'), value:'editcall' });
      items.push({ label:t('Delete Block'), value:'del', danger:true });
      const help = BLOCKS.HELP[b.op];
      if(help) items.push({ sep:true }, { label:'? ' + help, value:'help' });
      UI.menu(e.clientX, e.clientY, items, v => {
        if(v === 'dup') return duplicate(info, bEl);
        if(v === 'del') return deleteBlock(info);
        if(v === 'edit') return makeBlockDialog(b);
        if(v === 'editcall'){ const d = PROJECT.procs(target)[b.proc.code]; if(d) makeBlockDialog(d.def); }
      }, { className:'ctx' });
      return;
    }
    UI.menu(e.clientX, e.clientY, [
      { label:t('Undo'), value:'undo' }, { label:t('Redo'), value:'redo' }, { sep:true },
      { label:t('Clean up blocks'), value:'clean' }, { label:t('Make a Block'), value:'proc' }
    ], v => { if(v === 'undo') doUndo(); if(v === 'redo') doRedo(); if(v === 'clean') cleanUp(); if(v === 'proc') makeBlockDialog(); }, { className:'ctx' });
  }
  function palContext(e){
    e.preventDefault();
    if(readOnly) return;
    const bEl = e.target.closest('.b'); if(!bEl) return;
    const b = palTemplates[bEl.dataset.id]; if(!b) return;
    if(b.op === 'data_variable'){
      const n = b.args.VARIABLE;
      UI.menu(e.clientX, e.clientY, [{ label:t('Rename variable'), value:'ren' }, { label:t('Delete the "{n}" variable', { n }), value:'del', danger:true }],
        v => v === 'ren' ? renameData('var', n) : deleteData('var', n), { className:'ctx' });
    } else if(b.op === 'data_listcontents'){
      const n = b.args.LIST;
      UI.menu(e.clientX, e.clientY, [{ label:t('Rename list'), value:'ren' }, { label:t('Delete the "{n}" list', { n }), value:'del', danger:true }],
        v => v === 'ren' ? renameData('list', n) : deleteData('list', n), { className:'ctx' });
    } else if(b.op === 'procedures_call'){
      const d = PROJECT.procs(target)[b.proc.code];
      UI.menu(e.clientX, e.clientY, [{ label:t('Edit'), value:'edit' }], () => d && makeBlockDialog(d.def), { className:'ctx' });
    } else if(BLOCKS.HELP[b.op]){
      UI.menu(e.clientX, e.clientY, [{ label:'? ' + BLOCKS.HELP[b.op], value:'' }], () => {}, { className:'ctx' });
    }
  }
  function duplicate(info, el){
    remember();
    let blocks;
    if(info.slot) blocks = [PROJECT.copy(info.block)];
    else blocks = PROJECT.copy(info.list.slice(info.idx));
    const r = el.getBoundingClientRect(), p = toCanvas(r.left, r.top);
    target.scripts.push({ id:PROJECT.uid(), x:Math.round(p.x + 24), y:Math.round(p.y + 24), blocks });
    renderWorkspace(); changed();
  }
  /* delete one block; whatever was inside it, or under it, stays */
  function deleteBlock(info){
    remember();
    const b = info.block;
    if(info.slot){ delete info.parent.inputs[info.slot]; }
    else {
      const inner = [...(b.body || []), ...(b.body2 || [])];
      info.list.splice(info.idx, 1, ...inner);
      const s = info.script;
      if(s && info.list === s.blocks && !s.blocks.length) target.scripts.splice(target.scripts.indexOf(s), 1);
    }
    renderWorkspace();
    if(b.op === 'procedures_definition') renderPalette();
    changed();
  }
  function cleanUp(){
    remember();
    let y = 20;
    const heights = {};
    for(const sEl of els.wsc.children) heights[sEl.dataset.script] = sEl.offsetHeight;
    for(const s of target.scripts.slice().sort((a, b) => a.y - b.y || a.x - b.x)){
      s.x = 20; s.y = y; y += (heights[s.id] || 40) + 28;
    }
    renderWorkspace(); els.ws.scrollTo(0, 0); changed();
  }

  /* a sprite's name changed: menus that named it follow */
  function renameSprite(old, name){
    for(const tg of P.targets) PROJECT.walkTarget(tg, b => {
      for(const k in b.args) if(b.args[k] === old && ['TO','TOWARDS','TOUCHINGOBJECTMENU','DISTANCETOMENU','CLONE_OPTION','OBJECT'].includes(k)) b.args[k] = name;
    });
  }

  return {
    mount, load, setTarget, renderAll, renderPalette, renderWorkspace, updateGlow, doUndo, doRedo, renameSprite,
    takeEyedropper, get eyedropping(){ return !!eyedropper; }, get target(){ return target; }, makeBlockDialog,
    get zoom(){ return zoom; }
  };
})();
