/* =====================================================================
   APP — sign-in, My Projects, the editor screen, saving, history, and
   the teacher's page.

   Routes (in the address after #):
     #/            My Projects (or the sign-in card)
     #/p/<id>      a project in the editor
     #/teacher     every student, by period (teacher account only)

   SAVING. Every change marks the project dirty; 1.5 s after the last
   change it is sent to the server. A copy also goes into this browser's
   storage first, so a lost connection loses nothing: the page says
   "Offline — kept on this computer", keeps retrying, and the next time
   the project opens the newer local copy is sent up. The server keeps a
   version at most every two minutes (and whenever "Save now" is pressed),
   which is what History shows.
   ===================================================================== */
(function(){
  const { h, $, $$, esc } = UI;
  const app = $('#app');
  let me = null;

  /* --------------------------------------------------------------- api */
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts,
      headers:{ ...(opts.body && typeof opts.body === 'string' ? { 'Content-Type':'application/json' } : {}), ...(opts.headers || {}) } });
    if(r.status === 401 && path !== '/login'){ me = null; route(); throw Object.assign(new Error('login'), { status:401 }); }
    const data = r.headers.get('content-type') && r.headers.get('content-type').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((data && data.error) || r.statusText), { status:r.status });
    return data;
  }
  const json = b => JSON.stringify(b);

  /* ------------------------------------------------------------ chrome */
  function langBtn(){
    return h('button', { class:'btn ghost lang', type:'button', title:'English / Español', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); route(true); } },
      I18N.lang === 'es' ? 'EN' : 'ES');
  }
  function logo(){ return h('a', { class:'logo', href:'#/' }, h('span', { class:'logo-mark' }, '◆'), h('span', {}, 'Code Studio')); }
  function userBits(){
    if(!me) return [];
    return [
      me.role === 'teacher' ? h('a', { class:'btn ghost', href:'#/teacher' }, '🍎 ' + t('Students')) : null,
      h('span', { class:'who', title:me.username }, '👤 ' + me.name),
      h('button', { class:'btn ghost', type:'button', onclick:logout }, t('Log out'))
    ].filter(Boolean);
  }
  async function logout(){
    if(SAVE.dirty) await SAVE.flush();
    await fetch('/api/logout', { method:'POST' }).catch(() => {});
    me = null; location.hash = '#/'; route(true);
  }

  /* ------------------------------------------------------------ routing */
  let current = '';
  async function route(force){
    const hash = location.hash || '#/';
    if(hash === current && !force) return;
    if(current.startsWith('#/p/') && hash !== current && SAVE.dirty) await SAVE.flush();
    current = hash;
    UI.closeMenu();
    if(!me){
      try { me = await api('/me'); } catch(e){ me = null; }
    }
    if(!me) return loginView();
    if(hash.startsWith('#/p/')) return editorView(hash.slice(4));
    if(hash === '#/teacher' && me.role === 'teacher') return teacherView();
    return projectsView();
  }
  addEventListener('hashchange', () => route());

  /* -------------------------------------------------------------- login */
  function loginView(){
    document.body.className = 'v-login';
    const user = h('input', { class:'inp', name:'username', autocomplete:'username', autocapitalize:'none', spellcheck:'false', required:true });
    const pass = h('input', { class:'inp', name:'password', type:'password', autocomplete:'current-password', autocapitalize:'none', required:true });
    const show = h('button', { type:'button', class:'peek', title:'show', onclick:() => { pass.type = pass.type === 'password' ? 'text' : 'password'; } }, '👁');
    const msg = h('div', { class:'msg', role:'alert' });
    const btn = h('button', { class:'btn primary big', type:'submit' }, t('Log in'));
    const form = h('form', { class:'login-card' },
      h('div', { class:'login-top' }, logo(), langBtn()),
      h('div', { class:'login-art' }, h('img', { src:LIBRARY.picURL('bit-b'), alt:'' })),
      h('label', {}, h('span', {}, '👤 ' + t('Username')), user),
      h('label', {}, h('span', {}, '🔑 ' + t('Password')), h('div', { class:'pw' }, pass, show)),
      msg, btn);
    form.onsubmit = async e => {
      e.preventDefault();
      btn.disabled = true; msg.textContent = '';
      try {
        me = await api('/login', { method:'POST', body:json({ username:user.value.trim().toLowerCase(), password:pass.value.trim() }) });
        current = ''; route(true);
      } catch(err){
        msg.textContent = err.status === 401 ? t('Wrong username or password.') : err.status === 429 ? t('Too many tries. Wait a few minutes.') : t('Could not reach the server.');
        btn.disabled = false; pass.select();
      }
    };
    app.replaceChildren(h('div', { class:'login-page' }, form));
    user.focus();
  }

  /* ----------------------------------------------------------- projects */
  async function projectsView(){
    document.body.className = 'v-projects';
    const grid = h('div', { class:'pgrid' }, h('div', { class:'loading' }, t('Loading…')));
    const trash = h('div', { class:'trash' });
    app.replaceChildren(
      h('header', { class:'top' }, logo(), h('h1', {}, t('My Projects')), h('span', { class:'grow' }), langBtn(), ...userBits()),
      h('main', { class:'pmain' }, grid, trash));
    let list = [];
    try { list = await api('/projects'); } catch(e){ grid.replaceChildren(h('div', { class:'msg' }, t('Could not reach the server.'))); return; }
    grid.replaceChildren(
      h('button', { class:'pcard new', type:'button', onclick:newProject }, h('span', { class:'plus' }, '＋'), h('b', {}, t('New project'))),
      ...list.map(p => h('div', { class:'pcard' },
        h('a', { class:'pthumb', href:'#/p/' + p.id }, p.thumb ? h('img', { src:p.thumb, alt:'' }) : h('span', { class:'pblank' }, '◆')),
        h('div', { class:'pfoot' },
          h('a', { class:'pname', href:'#/p/' + p.id }, p.name),
          h('small', {}, UI.ago(p.updated)),
          h('button', { class:'dots', type:'button', title:'…', onclick:e => projectMenu(e, p) }, '⋯')))));
    if(!list.length) grid.append(h('div', { class:'hint' }, t('Nothing here yet. Press New project!')));
    try {
      const del = await api('/projects/trash');
      if(del.length) trash.append(h('details', {}, h('summary', {}, '🗑 ' + t('Recently deleted') + ' (' + del.length + ')'),
        ...del.map(p => h('div', { class:'trow' }, h('span', {}, p.name), h('small', {}, UI.ago(p.deleted)),
          h('button', { class:'btn small', type:'button', onclick:async () => { await api('/projects/' + p.id + '/undelete', { method:'POST' }); projectsView(); } }, t('Restore'))))));
    } catch(e){}
  }
  function projectMenu(e, p){
    const r = e.target.getBoundingClientRect();
    UI.menu(r.left, r.bottom + 4, [
      { label:t('Open'), value:'open' }, { label:t('Rename'), value:'ren' }, { label:t('Duplicate'), value:'dup' }, { sep:true },
      { label:t('Delete'), value:'del', danger:true }], async v => {
      if(v === 'open') location.hash = '#/p/' + p.id;
      if(v === 'ren'){ const n = await UI.ask(t('Rename'), p.name); if(n){ await api('/projects/' + p.id, { method:'PUT', body:json({ name:n }) }); projectsView(); } }
      if(v === 'dup'){
        const full = await api('/projects/' + p.id);
        await api('/projects', { method:'POST', body:json({ name:(p.name + ' copy').slice(0, 60), data:full.data, thumb:full.thumb }) });
        projectsView();
      }
      if(v === 'del'){ if(await UI.confirm(t('Delete this project?') + ' “' + p.name + '”', t('Delete'))){ await api('/projects/' + p.id, { method:'DELETE' }); projectsView(); } }
    });
  }
  async function newProject(){
    const name = await UI.ask(t('New project'), I18N.lang === 'es' ? 'Mi juego' : 'My Game');
    if(name === null) return;
    const p = await api('/projects', { method:'POST', body:json({ name:name || t('Untitled'), data:PROJECT.blank() }) });
    location.hash = '#/p/' + p.id;
  }

  /* ------------------------------------------------------------- editor */
  let P = null, projectMeta = null, readOnly = false, mounted = null;

  function editorShell(){
    if(mounted) return mounted;
    const E = {};
    E.title = h('input', { class:'title-in', maxlength:60, spellcheck:'false', 'aria-label':t('Name') });
    E.status = h('span', { class:'status' });
    E.banner = h('div', { class:'banner hidden' });
    E.cats = h('div', { id:'cats' });
    E.pal = h('div', { id:'pal' });
    E.ws = h('div', { id:'ws' });
    E.costumes = h('div', { id:'costumes', class:'asset-tab hidden' });
    E.sounds = h('div', { id:'sounds', class:'asset-tab hidden' });
    E.canvas = h('canvas', { id:'stage' });
    E.monitors = h('div', { class:'monitors' });
    E.wrap = h('div', { class:'stage-wrap' }, E.canvas, E.monitors);
    E.flag = h('button', { class:'flag', type:'button', title:'Go' }, h('span', {}, '⚑'));
    E.stop = h('button', { class:'stopb', type:'button', title:t('Stop all') }, h('span', {}, '⬣'));
    E.info = h('div', { class:'sprite-info' });
    E.sprites = h('div', { class:'sprite-list' });
    E.stageTile = h('div', { class:'stage-col' });
    E.tabs = h('div', { class:'tabs' });
    E.tabBtns = ['code','costumes','sounds'].map(k => h('button', { class:'tab', type:'button', 'data-tab':k, onclick:() => showTab(k) }));
    E.tabs.append(...E.tabBtns);
    E.code = h('div', { class:'code-area' }, E.cats, E.pal, E.ws);
    E.small = h('button', { class:'btn ghost icon', type:'button', title:t('Small stage'), onclick:() => { document.body.classList.toggle('small-stage'); VM.rt.dirty = true; setTimeout(() => STAGE.renderMonitors(), 50); } }, '▭');
    E.full = h('button', { class:'btn ghost icon', type:'button', title:t('Full screen'), onclick:() => { document.body.classList.toggle('full-stage'); VM.rt.dirty = true; setTimeout(() => STAGE.renderMonitors(), 50); } }, '⛶');
    E.root = h('div', { class:'editor' },
      h('header', { class:'top' }, logo(),
        h('a', { class:'btn ghost', href:'#/' }, '🗂 ' + t('My Projects')),
        E.title, E.status, h('span', { class:'grow' }),
        h('button', { class:'btn ghost', type:'button', onclick:historyPanel }, '🕘 ' + t('History')),
        h('button', { class:'btn ghost', type:'button', onclick:fileMenu }, '📁 ▾'),
        E.userBox = h('span', { class:'userbox' })),
      E.banner,
      h('div', { class:'body' },
        h('section', { class:'left' }, E.tabs, E.code, E.costumes, E.sounds),
        h('section', { class:'right' },
          h('div', { class:'stage-bar' }, E.flag, E.stop, h('span', { class:'grow' }), E.small, E.full),
          E.wrap,
          h('div', { class:'below' }, h('div', { class:'sprite-pane' }, E.info, E.sprites), E.stageTile))));
    E.title.onchange = () => { if(readOnly) return; const v = E.title.value.trim() || t('Untitled'); E.title.value = v; projectMeta.name = v; SAVE.rename(v); };
    E.title.onkeydown = e => { if(e.key === 'Enter') E.title.blur(); };

    EDITOR.mount({ cats:E.cats, pal:E.pal, ws:E.ws, onChange:kind => changed(kind) });
    STAGE.mount({ canvas:E.canvas, wrap:E.wrap, monitors:E.monitors, flag:E.flag, stop:E.stop,
      onChange:kind => changed(kind), onSelect:(tg, quiet) => quiet ? PANES.refreshInfo() : select(tg),
      onTick:() => { PANES.refreshInfo(); } });
    PANES.mount({ costumes:E.costumes, sounds:E.sounds, sprites:E.sprites, stageTile:E.stageTile, info:E.info,
      onChange:kind => changed(kind), onSelect:tg => select(tg) });
    VM.startLoop();
    VM.rt.onError = (e) => UI.toast('⚠️ ' + (e && e.message || e), 'bad');
    mounted = E;
    return E;
  }
  let tab = 'code';
  function showTab(k){
    tab = k;
    const E = mounted;
    E.tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === k));
    E.code.classList.toggle('hidden', k !== 'code');
    E.costumes.classList.toggle('hidden', k !== 'costumes');
    E.sounds.classList.toggle('hidden', k !== 'sounds');
    if(k === 'costumes') PANES.renderCostumes();
    if(k === 'sounds') PANES.renderSounds();
    if(k === 'code') EDITOR.renderAll();
  }
  function tabLabels(){
    const tg = EDITOR.target;
    mounted.tabBtns[0].textContent = '⧉ ' + t('Code');
    mounted.tabBtns[1].textContent = '🖌 ' + (tg && tg.isStage ? t('Backdrops') : t('Costumes'));
    mounted.tabBtns[2].textContent = '🔊 ' + t('Sounds');
  }
  function select(tg){
    EDITOR.setTarget(tg);
    PANES.setTarget(tg);
    tabLabels();
    if(tab !== 'code') showTab(tab);
  }

  async function editorView(id){
    document.body.className = 'v-editor';
    const E = editorShell();
    E.userBox.replaceChildren(langBtn(), ...userBits());
    app.replaceChildren(E.root);
    E.status.textContent = t('Loading…');
    let pr;
    try { pr = await api('/projects/' + id); }
    catch(e){ if(e.status !== 401){ app.replaceChildren(h('div', { class:'login-page' }, h('div', { class:'login-card' }, h('p', {}, t('Something went wrong loading this project.')), h('a', { class:'btn primary', href:'#/' }, t('My Projects'))))); } return; }
    projectMeta = { id:pr.id, name:pr.name, updated:pr.updated, owner:pr.owner };
    readOnly = !!pr.readOnly;
    let data = pr.data;
    // a newer copy left in this browser (saved while offline) wins
    const bak = SAVE.backup(id);
    if(!readOnly && bak && Date.parse(bak.at) > Date.parse(pr.updated) && JSON.stringify(bak.data) !== JSON.stringify(pr.data)){ data = bak.data; setTimeout(() => SAVE.mark(), 100); }
    P = PROJECT.repair(JSON.parse(JSON.stringify(data)));
    await MEDIA.loadAll(PROJECT.assets(P));
    E.title.value = pr.name; E.title.disabled = readOnly;
    E.banner.classList.toggle('hidden', !readOnly);
    E.banner.textContent = readOnly ? '👁 ' + t('Viewing {n}\'s project', { n:pr.owner }) + ' — ' + t('Read only') : '';
    document.body.classList.toggle('readonly', readOnly);
    STAGE.clearMonitors();
    VM.load(P, { username: me.username });
    STAGE.setReadOnly(readOnly);
    const first = P.targets[1] || P.targets[0];
    EDITOR.load(P, first, readOnly);
    PANES.load(P, first, readOnly);
    tabLabels();
    showTab('code');
    STAGE.renderMonitors();
    SAVE.open(id, readOnly);
    VM.rt.dirty = true;
  }

  function changed(kind){
    if(readOnly) return;
    if(kind === 'monitors') STAGE.renderMonitors();
    if(kind === 'sprite' || kind === 'costume') PANES.renderSprites();
    if(kind === 'vars') STAGE.renderMonitors();
    SAVE.mark();
  }

  /* --------------------------------------------------------------- save */
  const SAVE = (function(){
    let id = null, ro = false, dirty = false, saving = false, timer = null, retry = null, lastThumb = 0, nameDirty = null;
    const KEY = i => 'cs-bak-' + i;
    function status(text, cls){ if(mounted){ mounted.status.textContent = text; mounted.status.className = 'status ' + (cls || ''); } }
    function open(i, readOnly){
      id = i; ro = readOnly; dirty = false; nameDirty = null; clearTimeout(timer); clearTimeout(retry);
      status(ro ? '👁 ' + t('Read only') : '✓ ' + t('Saved'), 'ok');
    }
    function backup(i){ try { return JSON.parse(localStorage.getItem(KEY(i)) || 'null'); } catch(e){ return null; } }
    function snapshot(){ VM.syncLayers(); return PROJECT.serialize(P); }
    function keepLocal(data){ try { localStorage.setItem(KEY(id), JSON.stringify({ at:new Date().toISOString(), data })); } catch(e){} }
    function mark(){
      if(ro || !id) return;
      dirty = true;
      status(t('Saving…'), 'busy');
      clearTimeout(timer);
      timer = setTimeout(save, 1500);
    }
    function rename(name){ nameDirty = name; mark(); }
    async function save(extra){
      if(ro || !id) return;
      if(saving){ clearTimeout(timer); timer = setTimeout(save, 800); return; }
      const sid = id;
      saving = true; dirty = false;
      const data = snapshot();
      keepLocal(data);
      const body = { data, ...(extra || {}) };
      if(nameDirty){ body.name = nameDirty; }
      if(Date.now() - lastThumb > 20000){ body.thumb = RENDER.snapshot(VM.rt); lastThumb = Date.now(); }
      try {
        const r = await api('/projects/' + sid, { method:'PUT', body:json(body) });
        if(body.name === nameDirty) nameDirty = null;
        if(sid === id){
          projectMeta.updated = r.updated;
          try { localStorage.removeItem(KEY(sid)); } catch(e){}
          status('✓ ' + t('Saved') + ' ' + new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }), 'ok');
        }
      } catch(e){
        if(e.status === 401) return;
        dirty = true;
        status('⚠️ ' + t('Offline — kept on this computer'), 'bad');
        clearTimeout(retry); retry = setTimeout(() => dirty && save(), 5000);
      } finally { saving = false; }
      if(dirty){ clearTimeout(timer); timer = setTimeout(save, 1500); }
    }
    async function flush(){ clearTimeout(timer); if(dirty) await save(); }
    async function checkpoint(){ clearTimeout(timer); dirty = true; await save({ checkpoint:true }); }
    addEventListener('beforeunload', e => {
      if(dirty && id && !ro){
        try {
          const data = snapshot(); keepLocal(data);
          fetch('/api/projects/' + id, { method:'PUT', keepalive:true, credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, body:json({ data }) });
        } catch(err){}
        e.preventDefault(); e.returnValue = '';
      }
    });
    document.addEventListener('visibilitychange', () => { if(document.hidden) flush(); });
    return { open, mark, rename, flush, checkpoint, backup, get dirty(){ return dirty; } };
  })();

  /* ------------------------------------------------------------ history */
  async function historyPanel(){
    if(!projectMeta) return;
    await SAVE.flush();
    const list = h('div', { class:'hist' }, h('div', { class:'loading' }, t('Loading…')));
    const body = h('div', {},
      h('p', { class:'muted' }, t('Versions are saved as you work.')),
      readOnly ? null : h('button', { class:'btn primary', type:'button', onclick:async () => { await SAVE.checkpoint(); load(); } }, '💾 ' + t('Save now')),
      list);
    let close = null;
    UI.dialog({ title:'🕘 ' + t('History') + ' — ' + projectMeta.name, body, ok:null, cancel:t('Back'), wide:true, onOpen:(c, d) => close = d });
    async function load(){
      const vs = await api('/projects/' + projectMeta.id + '/versions');
      list.replaceChildren(...vs.map((v, i) => h('div', { class:'hrow' + (i === 0 ? ' now' : '') },
        h('div', { class:'htime' }, h('b', {}, UI.clock(v.updated || v.created)), h('small', {}, UI.ago(v.updated || v.created) + (v.label && v.label !== 'auto' ? ' · ' + v.label : '') + (i === 0 ? ' · now' : ''))),
        h('span', { class:'grow' }),
        i === 0 || readOnly ? null : h('button', { class:'btn small', type:'button', onclick:async () => {
          if(!(await UI.confirm(t('Restore this version? Your current work is kept in the history too.'), t('Restore')))) return;
          await api('/projects/' + projectMeta.id + '/restore/' + v.id, { method:'POST' });
          try { localStorage.removeItem('cs-bak-' + projectMeta.id); } catch(e){}
          close && close(false);
          current = ''; route(true);
        } }, '↩ ' + t('Go back to this version')))));
    }
    load();
  }

  /* -------------------------------------------------- file: download/load */
  function fileMenu(e){
    const r = e.currentTarget.getBoundingClientRect();
    UI.menu(r.left, r.bottom + 4, [
      { label:'＋ ' + t('New project'), value:'new' },
      { label:'⤓ ' + t('Download to your computer'), value:'down' },
      ...(readOnly ? [] : [{ label:'⤒ ' + t('Load from your computer'), value:'up' }])], async v => {
      if(v === 'new') newProject();
      if(v === 'down') exportProject();
      if(v === 'up') importProject();
    });
  }
  async function exportProject(){
    VM.syncLayers();
    const data = PROJECT.serialize(P);
    const assets = {};
    for(const id of new Set(data.targets.flatMap(tg => [...tg.costumes, ...tg.sounds].map(x => x.asset)))){
      if(id.startsWith('lib:')) continue;
      const r = await fetch('/api/assets/' + id); if(!r.ok) continue;
      const b = await r.blob();
      assets[id] = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); });
    }
    const blob = new Blob([JSON.stringify({ codestudio:1, name:projectMeta.name, project:data, assets })], { type:'application/json' });
    const a = h('a', { href:URL.createObjectURL(blob), download:(projectMeta.name || 'project').replace(/[^\w\- ]+/g, '') + '.codestudio.json' });
    document.body.append(a); a.click(); a.remove();
  }
  async function importProject(){
    const [f] = await UI.pickFiles('.json,application/json', false);
    if(!f) return;
    let file;
    try { file = JSON.parse(await f.text()); } catch(e){ UI.toast('Not a Code Studio file', 'bad'); return; }
    if(!file || !file.project){ UI.toast('Not a Code Studio file', 'bad'); return; }
    if(!(await UI.confirm(t('Load this file? It replaces the project you have open.')))) return;
    UI.toast(t('Uploading…'));
    const map = {};
    for(const [old, dataUrl] of Object.entries(file.assets || {})){
      const b = await (await fetch(dataUrl)).blob();
      const r = await fetch('/api/assets', { method:'POST', headers:{ 'Content-Type':b.type }, body:b });
      if(r.ok) map[old] = (await r.json()).id;
    }
    const data = PROJECT.repair(file.project);
    data.targets.forEach(tg => [...tg.costumes, ...tg.sounds].forEach(x => { if(map[x.asset]) x.asset = map[x.asset]; }));
    P = data;
    await MEDIA.loadAll(PROJECT.assets(P));
    STAGE.clearMonitors();
    VM.load(P, { username:me.username });
    EDITOR.load(P, P.targets[1] || P.targets[0], false);
    PANES.load(P, P.targets[1] || P.targets[0], false);
    STAGE.renderMonitors(); tabLabels(); showTab('code');
    SAVE.mark();
  }

  /* ------------------------------------------------------------ teacher */
  async function teacherView(){
    document.body.className = 'v-teacher';
    const main = h('main', { class:'tmain' }, h('div', { class:'loading' }, t('Loading…')));
    app.replaceChildren(h('header', { class:'top' }, logo(), h('h1', {}, '🍎 ' + t('Students')), h('span', { class:'grow' }),
      h('a', { class:'btn ghost', href:'#/' }, '🗂 ' + t('My Projects')), langBtn(), ...userBits()), main);
    const all = (await api('/admin/students')).filter(s => s.role === 'student');
    const periods = [...new Set(all.map(s => s.period))].sort();
    let pick = (() => { try { return sessionStorage.getItem('cs-period'); } catch(e){ return null; } })() || periods[0];
    function draw(){
      try { sessionStorage.setItem('cs-period', pick); } catch(e){}
      const rows = all.filter(s => s.period === pick).sort((a, b) => a.name.localeCompare(b.name));
      main.replaceChildren(
        h('div', { class:'ptabs' }, periods.map(p => h('button', { class:'tab' + (p === pick ? ' on' : ''), type:'button', onclick:() => { pick = p; draw(); } }, t('Period') + ' ' + p))),
        h('table', { class:'ttable' },
          h('thead', {}, h('tr', {}, h('th', {}, t('Name')), h('th', {}, t('Username')), h('th', {}, t('Projects')), h('th', {}, t('Last saved')), h('th', {}))),
          h('tbody', {}, rows.map(s => h('tr', {},
            h('td', {}, s.name), h('td', {}, h('code', {}, s.username)), h('td', {}, String(s.projects)),
            h('td', {}, s.updated ? UI.ago(s.updated) : '—'),
            h('td', { class:'tact' },
              h('button', { class:'btn small', type:'button', disabled:!s.projects, onclick:() => studentProjects(s) }, '🗂 ' + t('Projects')),
              h('button', { class:'btn small', type:'button', onclick:() => resetPassword(s) }, '🔑 ' + t('Reset password'))))))));
    }
    draw();
  }
  async function studentProjects(s){
    const list = await api('/admin/students/' + s.username + '/projects');
    let close = null;
    const body = h('div', { class:'pgrid small' }, list.map(p => h('a', { class:'pcard', href:'#/p/' + p.id, onclick:() => close && close(false) },
      h('span', { class:'pthumb' }, p.thumb ? h('img', { src:p.thumb, alt:'' }) : h('span', { class:'pblank' }, '◆')),
      h('div', { class:'pfoot' }, h('span', { class:'pname' }, p.name), h('small', {}, UI.ago(p.updated))))));
    UI.dialog({ title:s.name, body, ok:null, cancel:t('Back'), wide:true, onOpen:(c, d) => close = d });
  }
  async function resetPassword(s){
    const words = ['apple','bear','bird','boat','cake','cloud','duck','fish','frog','kite','lemon','lion','moon','owl','panda','pizza','robot','rocket','star','sun','taco','tiger','train','tree','turtle','whale','zebra'];
    const suggest = words[Math.floor(Math.random() * words.length)] + (10 + Math.floor(Math.random() * 90));
    const pw = await UI.ask(t('New password') + ' — ' + s.name, suggest);
    if(!pw) return;
    try { await api('/admin/students/' + s.username + '/password', { method:'POST', body:json({ password:pw }) }); UI.toast(t('Password changed.') + ' ' + s.username + ' / ' + pw.toLowerCase()); }
    catch(e){ UI.toast(e.message, 'bad'); }
  }

  route();
})();
