/* =====================================================================
   PANES — the sprite list, the sprite's info row, and the Costumes and
   Sounds tabs, with every way to add a picture or a sound: the library,
   uploading files (button, drag-and-drop or paste), and recording.
   ===================================================================== */
window.PANES = (function(){
  const { h, $, $$, esc } = UI;
  let P = null, target = null, readOnly = false, els = {}, onChange = () => {}, onSelect = () => {};
  let selSound = 0, playing = null;

  function mount(opts){
    els = opts; onChange = opts.onChange; onSelect = opts.onSelect;
    // drop files anywhere on the costume or sound tab
    for(const [el, kind] of [[els.costumes, 'image'], [els.sounds, 'sound']]){
      el.addEventListener('dragover', e => { if(readOnly) return; e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', e => { if(!el.contains(e.relatedTarget)) el.classList.remove('drop'); });
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('drop');
        if(readOnly) return;
        const files = [...(e.dataTransfer.files || [])];
        kind === 'image' ? addCostumeFiles(files) : addSoundFiles(files);
      });
    }
    els.sprites.addEventListener('dragover', e => { if(!readOnly && e.dataTransfer.types.includes('Files')){ e.preventDefault(); els.sprites.classList.add('drop'); } });
    els.sprites.addEventListener('dragleave', () => els.sprites.classList.remove('drop'));
    els.sprites.addEventListener('drop', e => { e.preventDefault(); els.sprites.classList.remove('drop'); if(!readOnly) uploadSprites([...e.dataTransfer.files]); });
    addEventListener('paste', e => {
      if(readOnly || !els.costumes.offsetParent) return;
      const files = [...(e.clipboardData && e.clipboardData.files || [])].filter(MEDIA.isImage);
      if(files.length){ e.preventDefault(); addCostumeFiles(files); }
    });
  }
  function load(project, tg, ro){ P = project; target = tg; readOnly = !!ro; selSound = 0; renderSprites(); renderInfo(); }
  function setTarget(tg){ target = tg; selSound = 0; renderSprites(); renderInfo(); renderCostumes(); renderSounds(); }

  /* --------------------------------------------------------- sprites */
  function renderSprites(){
    const list = els.sprites;
    list.innerHTML = '';
    const grid = h('div', { class:'tiles' });
    for(const s of P.targets.slice(1)){
      const c = RENDER.costumeOf(s);
      const tile = h('button', { type:'button', class:'tile' + (s === target ? ' on' : ''), 'data-sprite-id':s.id,
        onclick:() => onSelect(s), oncontextmenu:e => { e.preventDefault(); spriteMenu(e, s); } },
        h('img', { src:MEDIA.url(c.asset), alt:'', draggable:'false' }),
        h('span', { class:'tname' }, s.name));
      if(s === target && !readOnly) tile.append(h('span', { class:'tx', title:t('Delete'), onclick:e => { e.stopPropagation(); deleteSprite(s); } }, '✕'));
      grid.append(tile);
    }
    list.append(grid);
    if(!readOnly){
      list.append(h('div', { class:'add-row' },
        h('button', { class:'btn add', type:'button', onclick:() => libraryPicker('sprite') }, '＋ ' + t('Choose a Sprite')),
        h('button', { class:'btn add', type:'button', onclick:async () => uploadSprites(await UI.pickFiles('image/*,.svg')) }, '⤒ ' + t('Upload Sprite'))));
    }
    // the stage, on the right
    const st = P.targets[0];
    els.stageTile.innerHTML = '';
    els.stageTile.append(h('button', { type:'button', class:'tile stage-tile' + (target === st ? ' on' : ''), 'data-sprite-id':'stage', onclick:() => onSelect(st) },
      h('img', { src:MEDIA.url(RENDER.costumeOf(st).asset), alt:'' }), h('span', { class:'tname' }, t('Stage')),
      h('small', {}, t('Backdrops') + ' ' + st.costumes.length)));
    if(!readOnly) els.stageTile.append(h('div', { class:'add-col' },
      h('button', { class:'btn add sm', type:'button', title:t('Choose a Backdrop'), onclick:() => libraryPicker('backdrop') }, '＋'),
      h('button', { class:'btn add sm', type:'button', title:t('Upload'), onclick:async () => { const f = await UI.pickFiles('image/*,.svg'); if(f.length){ onSelect(st); addCostumeFiles(f, st); } } }, '⤒')));
  }
  function spriteMenu(e, s){
    if(readOnly) return;
    UI.menu(e.clientX, e.clientY, [{ label:t('Duplicate'), value:'dup' }, { label:t('Delete'), value:'del', danger:true }], v => {
      if(v === 'dup'){
        const c = JSON.parse(JSON.stringify(PROJECT.serialize(s)));
        const copy = PROJECT.copy(c);
        copy.id = PROJECT.uid(); copy.name = uniqueName(s.name); copy.x = s.x + 20; copy.y = s.y - 20;
        copy.costumes.forEach(x => x.id = PROJECT.uid()); copy.sounds.forEach(x => x.id = PROJECT.uid());
        addSprite(copy);
      }
      if(v === 'del') deleteSprite(s);
    }, { className:'ctx' });
  }
  function uniqueName(base){
    base = String(base).replace(/\d+$/, '') || 'Sprite';
    const names = new Set(P.targets.map(x => x.name));
    if(!names.has(base)) return base;
    for(let i = 2; ; i++) if(!names.has(base + i)) return base + i;
  }
  function addSprite(s){
    VM.fresh(s);
    s.layer = P.targets.length;
    P.targets.push(s);
    VM.rt.sprites.push(s); VM.rt.layers.push(s);
    VM.rt.dirty = true;
    onSelect(s);
    onChange('sprite');
  }
  async function deleteSprite(s){
    if(!(await UI.confirm(t('Delete this sprite?') + ' ' + s.name, t('Delete')))) return;
    VM.stopAll();
    P.targets.splice(P.targets.indexOf(s), 1);
    VM.rt.sprites = VM.rt.sprites.filter(x => x !== s);
    VM.rt.layers = VM.rt.layers.filter(x => x !== s);
    P.monitors = P.monitors.filter(m => m.target !== s.id);
    VM.rt.dirty = true;
    onSelect(P.targets[1] || P.targets[0]);
    onChange('sprite');
  }

  /* the info row: name, x, y, show, size, direction */
  function renderInfo(){
    const box = els.info;
    box.innerHTML = '';
    if(target.isStage){ box.append(h('div', { class:'info-stage' }, t('Stage'))); return; }
    const s = target;
    const num = (label, key, w=52) => h('label', { class:'ifield' }, h('span', {}, label),
      h('input', { class:'inp sm', value:Math.round(s[key]), style:{ width:w + 'px' }, disabled:readOnly, 'data-k':key, inputmode:'decimal',
        onchange:e => { const v = Number(e.target.value); if(isNaN(v)) return renderInfo();
          if(key === 'x' || key === 'y') VM.moveTo(s, key === 'x' ? v : s.x, key === 'y' ? v : s.y, false);
          else if(key === 'size') VM.setSize(s, v); else VM.setDir(s, v);
          renderInfo(); onChange('sprite'); } }));
    box.append(
      h('label', { class:'ifield' }, h('span', {}, t('Sprite')),
        h('input', { class:'inp sm', value:s.name, style:{ width:'110px' }, disabled:readOnly, maxlength:30, onchange:e => {
          const v = e.target.value.trim(); if(!v || P.targets.some(x => x !== s && x.name === v)){ e.target.value = s.name; return; }
          EDITOR.renameSprite(s.name, v); s.name = v; renderSprites(); EDITOR.renderAll(); onChange('sprite'); } })),
      num('x', 'x'), num('y', 'y'),
      h('div', { class:'ifield' }, h('span', {}, t('Show')),
        h('button', { type:'button', class:'eye' + (s.visible ? ' on' : ''), disabled:readOnly, title:'show', onclick:() => { s.visible = true; VM.rt.dirty = true; renderInfo(); onChange('sprite'); } }, '👁'),
        h('button', { type:'button', class:'eye' + (!s.visible ? ' on' : ''), disabled:readOnly, title:'hide', onclick:() => { s.visible = false; VM.rt.dirty = true; renderInfo(); onChange('sprite'); } }, '⊘')),
      num(t('Size'), 'size'), num(t('Direction'), 'direction'));
  }
  /* keep x/y up to date while the program or a drag moves the sprite */
  function refreshInfo(){
    if(!target || target.isStage) return;
    for(const inp of $$('input[data-k]', els.info)){
      if(document.activeElement === inp) continue;
      const v = String(Math.round(target[inp.dataset.k]));
      if(inp.value !== v) inp.value = v;
    }
  }

  /* --------------------------------------------------------- costumes */
  function renderCostumes(){
    const box = els.costumes;
    box.innerHTML = '';
    const tg = target, list = tg.costumes;
    const side = h('div', { class:'asset-list' });
    list.forEach((c, i) => {
      const card = h('button', { type:'button', class:'acard' + (i === tg.currentCostume ? ' on' : ''),
        onclick:() => { VM.setCostume(tg, i + 1); renderCostumes(); renderSprites(); onChange('costume'); },
        oncontextmenu:e => { e.preventDefault(); costumeMenu(e, i); } },
        h('span', { class:'anum' }, i + 1), h('img', { src:MEDIA.url(c.asset), alt:'' }),
        h('span', { class:'aname' }, c.name), h('small', {}, Math.round(c.w / (c.res || 1)) + '×' + Math.round(c.h / (c.res || 1))));
      if(i === tg.currentCostume && list.length > 1 && !readOnly) card.append(h('span', { class:'tx', onclick:e => { e.stopPropagation(); deleteCostume(i); } }, '✕'));
      side.append(card);
    });
    if(!readOnly) side.append(h('div', { class:'add-stack' },
      h('button', { class:'btn add', type:'button', onclick:async () => addCostumeFiles(await UI.pickFiles('image/*,.svg')) }, '⤒ ' + t('Upload')),
      h('button', { class:'btn add', type:'button', onclick:() => libraryPicker(tg.isStage ? 'backdrop' : 'costume') }, '＋ ' + t('Library'))));

    const c = RENDER.costumeOf(tg);
    const main = h('div', { class:'asset-main' });
    main.append(h('div', { class:'asset-head' },
      h('label', { class:'ifield' }, h('span', {}, tg.isStage ? t('backdrop') : t('costume')),
        h('input', { class:'inp', value:c.name, disabled:readOnly, maxlength:40, onchange:e => {
          const v = e.target.value.trim(); if(!v) return;
          const old = c.name; c.name = uniqueIn(list, v, c);
          renameCostumeRefs(tg, old, c.name); renderCostumes(); onChange('costume'); } })),
      readOnly ? null : h('button', { class:'btn', type:'button', title:t('Remove background'), onclick:() => edit(c, 'bg') }, '🪄 ' + t('Remove background')),
      readOnly ? null : h('button', { class:'btn', type:'button', onclick:() => edit(c, 'flip') }, '⇋ ' + t('Flip'))));
    const view = h('div', { class:'checker' }, h('img', { class:'big', src:MEDIA.url(c.asset), alt:c.name }));
    main.append(view);
    main.append(h('div', { class:'tip' }, '💡 ' + t('PNG with a see-through background works best.') + ' ' + t('Drop pictures here') + '.'));
    if(c.opaque && !readOnly) main.append(h('div', { class:'tip warn' }, '⚠️ ' + t('This picture has a solid background.') + ' → 🪄'));
    box.append(side, main);
  }
  function uniqueIn(list, name, self){
    const names = new Set(list.filter(x => x !== self).map(x => x.name));
    if(!names.has(name)) return name;
    for(let i = 2; ; i++) if(!names.has(name + i)) return name + i;
  }
  function renameCostumeRefs(tg, old, name){
    const ops = tg.isStage ? ['looks_switchbackdropto','looks_switchbackdroptoandwait','event_whenbackdropswitchesto'] : ['looks_switchcostumeto'];
    const key = tg.isStage ? 'BACKDROP' : 'COSTUME';
    for(const x of tg.isStage ? P.targets : [tg]) PROJECT.walkTarget(x, b => { if(ops.includes(b.op) && b.args[key] === old) b.args[key] = name; });
    EDITOR.renderAll();
  }
  function costumeMenu(e, i){
    if(readOnly) return;
    const tg = target;
    UI.menu(e.clientX, e.clientY, [{ label:t('Duplicate'), value:'dup' }, { label:'⤓ ' + t('export'), value:'exp' },
      ...(tg.costumes.length > 1 ? [{ label:t('Delete'), value:'del', danger:true }] : [])], v => {
      const c = tg.costumes[i];
      if(v === 'dup'){ tg.costumes.splice(i + 1, 0, { ...c, id:PROJECT.uid(), name:uniqueIn(tg.costumes, c.name) }); renderCostumes(); onChange('costume'); }
      if(v === 'del') deleteCostume(i);
      if(v === 'exp') download(MEDIA.url(c.asset), c.name);
    }, { className:'ctx' });
  }
  function deleteCostume(i){
    const tg = target;
    if(tg.costumes.length < 2) return;
    tg.costumes.splice(i, 1);
    if(tg.currentCostume >= tg.costumes.length) tg.currentCostume = tg.costumes.length - 1;
    VM.rt.dirty = true; renderCostumes(); renderSprites(); onChange('costume');
  }
  async function edit(c, what){
    try {
      UI.toast(t('Uploading…'));
      const out = what === 'bg' ? await MEDIA.removeBackground(c.asset) : await MEDIA.flip(c.asset);
      document.dispatchEvent(new CustomEvent('cs-did', { detail:what }));
      c.asset = out.asset; delete c.opaque;
      if(what === 'flip') c.cx = c.w - c.cx;
      VM.rt.dirty = true; renderCostumes(); renderSprites(); onChange('costume');
      UI.toast('✓');
    } catch(e){ UI.toast(e.message, 'bad'); }
  }

  /* a picture as a costume: sprites show no bigger than 240 px, backdrops fill the stage */
  function costumeFrom(info, name, backdrop){
    const res = backdrop ? Math.min(info.w / 480, info.h / 360) : Math.max(1, Math.max(info.w, info.h) / 240);
    return { id:PROJECT.uid(), name, asset:info.asset, w:info.w, h:info.h, cx:info.w / 2, cy:info.h / 2, res, ...(info.opaque ? { opaque:true } : {}) };
  }
  async function addCostumeFiles(files, tg){
    tg = tg || target;
    files = files.filter(Boolean);
    if(!files.length) return;
    const bad = files.filter(f => !MEDIA.isImage(f));
    if(bad.length) UI.toast(t('That file is not a picture this browser can open.') + ' (' + bad[0].name + ')', 'bad');
    for(const f of files.filter(MEDIA.isImage)){
      try {
        UI.toast(t('Uploading…') + ' ' + f.name);
        const info = await MEDIA.importImage(f);
        const c = costumeFrom(info, uniqueIn(tg.costumes, MEDIA.baseName(f)), tg.isStage);
        tg.costumes.push(c);
        tg.currentCostume = tg.costumes.length - 1;
        if(!tg.isStage) VM.setSize(tg, tg.size);
        UI.toast('✓ ' + c.name + (c.opaque ? ' — ' + t('This picture has a solid background.') : ''));
      } catch(e){ UI.toast(e.message + ' (' + f.name + ')', 'bad'); }
    }
    VM.rt.dirty = true;
    if(target === tg) renderCostumes();
    renderSprites(); EDITOR.renderPalette(); onChange('costume');
  }
  async function uploadSprites(files){
    for(const f of files.filter(Boolean)){
      if(!MEDIA.isImage(f)){ UI.toast(t('That file is not a picture this browser can open.') + ' (' + f.name + ')', 'bad'); continue; }
      try {
        UI.toast(t('Uploading…') + ' ' + f.name);
        const info = await MEDIA.importImage(f);
        const name = uniqueName(MEDIA.baseName(f));
        const s = PROJECT.sprite(name, [costumeFrom(info, MEDIA.baseName(f), false)], { x:Math.round(Math.random() * 200 - 100), y:Math.round(Math.random() * 140 - 70) });
        addSprite(s);
        if(info.opaque) UI.toast('⚠️ ' + t('This picture has a solid background.') + ' → ' + t('Costumes') + ' → 🪄');
      } catch(e){ UI.toast(e.message + ' (' + f.name + ')', 'bad'); }
    }
  }

  /* ---------------------------------------------------------- library */
  function libraryPicker(kind){
    const backdrop = kind === 'backdrop';
    let items;
    if(kind === 'sprite'){
      const groups = {};
      for(const [key, pic] of LIBRARY.sprites()){
        const g = key.replace(/-[ab]$/, '');
        (groups[g] = groups[g] || []).push([key, pic]);
      }
      items = Object.values(groups).map(g => ({ key:g[0][0], name:g[0][1].name.replace(/-a$/, ''), keys:g.map(x => x[0]) }));
    } else {
      items = (backdrop ? LIBRARY.backdrops() : LIBRARY.sprites()).map(([key, pic]) => ({ key, name:pic.name, keys:[key] }));
    }
    let close = null;
    const grid = h('div', { class:'lib-grid' }, items.map(it => h('button', { type:'button', class:'lib-item' + (backdrop ? ' wide' : ''), onclick:() => {
      close && close(false);
      const costumes = it.keys.map(k => PROJECT.costumeFromLib(k));
      if(kind === 'sprite'){
        addSprite(PROJECT.sprite(uniqueName(it.name), costumes, { x:Math.round(Math.random() * 200 - 100), y:Math.round(Math.random() * 140 - 70) }));
      } else {
        const tg = backdrop ? P.targets[0] : target;
        costumes.forEach(c => { c.name = uniqueIn(tg.costumes, c.name); tg.costumes.push(c); });
        tg.currentCostume = tg.costumes.length - 1;
        if(backdrop) onSelect(tg);
        VM.rt.dirty = true; renderCostumes(); renderSprites(); EDITOR.renderPalette(); onChange('costume');
      }
    } }, h('img', { src:LIBRARY.picURL(it.key), alt:'' }), h('span', {}, it.name))));
    UI.dialog({ title: kind === 'sprite' ? t('Choose a Sprite') : backdrop ? t('Choose a Backdrop') : t('Library'), body:grid, ok:null, wide:true,
      onOpen:(card, done) => { close = done; } });
  }
  function soundLibrary(){
    let close = null;
    const grid = h('div', { class:'lib-grid' }, Object.entries(LIBRARY.sounds).map(([key, snd]) => h('div', { class:'lib-item snd' },
      h('button', { type:'button', class:'lib-play', title:t('Play'), onclick:async () => {
        const b = await MEDIA.buffer('lib:' + key); if(!b) return;
        const ac = MEDIA.audio(), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); } }, '▶'),
      h('button', { type:'button', class:'lib-pick', onclick:async () => {
        close && close(false);
        const info = await MEDIA.libSound(key);
        target.sounds.push({ id:PROJECT.uid(), name:uniqueIn(target.sounds, snd.name), asset:info.asset, type:'synth', duration:info.duration });
        selSound = target.sounds.length - 1;
        renderSounds(); EDITOR.renderPalette(); onChange('sound');
      } }, '🔊 ' + snd.name))));
    UI.dialog({ title:t('Library'), body:grid, ok:null, wide:true, onOpen:(card, done) => { close = done; } });
  }

  /* ----------------------------------------------------------- sounds */
  function renderSounds(){
    const box = els.sounds;
    box.innerHTML = '';
    const tg = target, list = tg.sounds;
    if(selSound >= list.length) selSound = Math.max(0, list.length - 1);
    const side = h('div', { class:'asset-list' });
    list.forEach((s, i) => {
      const card = h('button', { type:'button', class:'acard snd' + (i === selSound ? ' on' : ''), onclick:() => { selSound = i; renderSounds(); },
        oncontextmenu:e => { e.preventDefault(); soundMenu(e, i); } },
        h('span', { class:'anum' }, i + 1), h('span', { class:'sico' }, '🔊'), h('span', { class:'aname' }, s.name),
        h('small', {}, s.duration ? s.duration.toFixed(2) + 's' : ''));
      if(i === selSound && !readOnly) card.append(h('span', { class:'tx', onclick:e => { e.stopPropagation(); deleteSound(i); } }, '✕'));
      side.append(card);
    });
    if(!readOnly) side.append(h('div', { class:'add-stack' },
      h('button', { class:'btn add', type:'button', onclick:async () => addSoundFiles(await UI.pickFiles('audio/*,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,.aif,.aiff,.opus,.mp4,.mov,.3gp,.amr,.caf')) }, '⤒ ' + t('Upload')),
      h('button', { class:'btn add', type:'button', onclick:recordSound }, '🎙 ' + t('Record')),
      h('button', { class:'btn add', type:'button', onclick:soundLibrary }, '＋ ' + t('Library'))));
    const main = h('div', { class:'asset-main' });
    const s = list[selSound];
    if(s){
      main.append(h('div', { class:'asset-head' },
        h('label', { class:'ifield' }, h('span', {}, t('Name')),
          h('input', { class:'inp', value:s.name, disabled:readOnly, maxlength:40, onchange:e => {
            const v = e.target.value.trim(); if(!v) return;
            const old = s.name; s.name = uniqueIn(list, v, s);
            PROJECT.walkTarget(tg, b => { if(b.args && b.args.SOUND_MENU === old) b.args.SOUND_MENU = s.name; });
            renderSounds(); EDITOR.renderAll(); onChange('sound'); } })),
        h('button', { class:'btn primary', type:'button', onclick:() => play(s) }, '▶ ' + t('Play')),
        h('button', { class:'btn', type:'button', onclick:stopPlay }, '■ ' + t('Stop'))));
      const cv = h('canvas', { class:'wave', width:600, height:160 });
      main.append(h('div', { class:'wave-box' }, cv));
      drawWave(cv, s);
    }
    main.append(h('div', { class:'tip' }, '💡 MP3 · WAV · OGG · M4A · AAC · FLAC · WebM · AIFF · MP4 — ' + t('Drop sounds here') + '.'));
    box.append(side, main);
  }
  async function drawWave(cv, s){
    const b = await MEDIA.buffer(s.asset).catch(() => null);
    const g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    if(!b) return;
    if(!s.duration){ s.duration = b.duration; }
    const d = b.getChannelData(0), step = Math.max(1, Math.floor(d.length / cv.width));
    g.fillStyle = '#CF63CF';
    for(let x = 0; x < cv.width; x++){
      let mx = 0; for(let i = 0; i < step; i += 4) mx = Math.max(mx, Math.abs(d[x * step + i] || 0));
      const hh = Math.max(1, mx * cv.height * 0.95);
      g.fillRect(x, (cv.height - hh) / 2, 1, hh);
    }
  }
  async function play(s){
    stopPlay();
    const b = await MEDIA.buffer(s.asset); if(!b) return;
    const ac = MEDIA.audio(), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start();
    playing = src;
  }
  function stopPlay(){ if(playing){ try { playing.stop(); } catch(e){} playing = null; } }
  function soundMenu(e, i){
    if(readOnly) return;
    UI.menu(e.clientX, e.clientY, [{ label:t('Duplicate'), value:'dup' }, { label:'⤓ ' + t('export'), value:'exp' }, { label:t('Delete'), value:'del', danger:true }], v => {
      const s = target.sounds[i];
      if(v === 'dup'){ target.sounds.splice(i + 1, 0, { ...s, id:PROJECT.uid(), name:uniqueIn(target.sounds, s.name) }); renderSounds(); onChange('sound'); }
      if(v === 'del') deleteSound(i);
      if(v === 'exp'){
        if(s.asset.startsWith('lib:')) MEDIA.buffer(s.asset).then(b => download(URL.createObjectURL(MEDIA.toWav(b, 22050, 600)), s.name + '.wav'));
        else download(MEDIA.url(s.asset), s.name);
      }
    }, { className:'ctx' });
  }
  function deleteSound(i){ target.sounds.splice(i, 1); renderSounds(); EDITOR.renderPalette(); onChange('sound'); }
  async function addSoundFiles(files){
    files = files.filter(Boolean);
    for(const f of files){
      if(!MEDIA.isSound(f)){ UI.toast(t('That file is not a sound this browser can play.') + ' (' + f.name + ')', 'bad'); continue; }
      try {
        UI.toast(t('Uploading…') + ' ' + f.name);
        const info = await MEDIA.importSound(f);
        target.sounds.push({ id:PROJECT.uid(), name:uniqueIn(target.sounds, MEDIA.baseName(f)), asset:info.asset, type:info.type, duration:info.duration });
        selSound = target.sounds.length - 1;
        UI.toast('✓ ' + f.name);
      } catch(e){ UI.toast(e.message + ' (' + f.name + ')', 'bad'); }
    }
    renderSounds(); EDITOR.renderPalette(); onChange('sound');
  }
  async function recordSound(){
    let rec;
    try { rec = await MEDIA.record(); }
    catch(e){ UI.toast(t('Allow the microphone to record.'), 'bad'); return; }
    const ok = await UI.dialog({ title:'🎙 ' + t('Recording…'), body:h('div', { class:'rec-dot' }, '●'), ok:'■ ' + t('Stop') });
    const info = await rec.stop();
    if(!ok) return;
    if(!info || info.error){ UI.toast((info && info.error) || 'Recording failed', 'bad'); return; }
    target.sounds.push({ id:PROJECT.uid(), name:uniqueIn(target.sounds, 'recording'), asset:info.asset, type:info.type, duration:info.duration });
    selSound = target.sounds.length - 1;
    renderSounds(); EDITOR.renderPalette(); onChange('sound');
  }

  function download(url, name){
    const a = h('a', { href:url, download:name }); document.body.append(a); a.click(); a.remove();
  }

  return { mount, load, setTarget, renderSprites, renderInfo, refreshInfo, renderCostumes, renderSounds, addCostumeFiles, addSoundFiles };
})();
