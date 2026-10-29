/* =====================================================================
   APP — sign-in, My Projects, the editor screen, saving, history, and
   the teacher's page.

   Routes (in the address after #):
     #/            My Projects (or the sign-in card)
     #/p/<id>      a project in the editor
     #/teacher     every student, by period (teacher account only)
   /studio?play#/p/<id> is the game alone: just the stage, ⚑ and ■, read only
   (the Classroom shows it in a frame, for Game Feedback).

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
  const PLAY = new URLSearchParams(location.search).has('play');     // the stage alone, in a frame

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
  // the top bar of every page but the editor: logo, then the site's parts
  const logoNav = () => [logo(), SITENAV.bar('blocks')];
  function userBits(compact){
    if(!me) return [];
    const go = [
      me.role === 'teacher' ? { label:t('Dashboard'), value:'#/teacher' } : null,
      { label:t('Class Games'), value:'#/class' }].filter(Boolean);
    const parts = SITENAV.PARTS.filter(p => p.id !== 'blocks').map(p => ({ label:p.icon + '  ' + (I18N.lang === 'es' ? p.es : p.en), value:p.href }));
    // in the editor the pages go in one menu, so the bar stays short
    if(compact) return [
      h('button', { class:'btn ghost menu-btn', type:'button', onclick:e => {
        const r = e.currentTarget.getBoundingClientRect();
        UI.menu(r.left, r.bottom + 4, [...go, { sep:true }, ...parts, { sep:true }, { label:t('Tour'), value:'tour' }, { label:t('Log out'), value:'out' }], v => {
          if(v === 'tour') TOUR.start(); else if(v === 'out') logout(); else if(v.startsWith('#')) location.hash = v; else location.href = v;
        });
      } }, t('Menu') + ' ▾'),
      h('span', { class:'who', title:me.username }, me.name)];
    return [
      ...go.map(g => h('a', { class:'btn ghost', href:g.value }, g.label)),
      h('button', { class:'btn tour-btn', type:'button', title:t('Tour'), onclick:() => TOUR.start() }, t('Tour')),
      h('span', { class:'who', title:me.username }, me.name),
      h('button', { class:'btn ghost', type:'button', onclick:logout }, t('Log out'))
    ];
  }
  async function logout(){
    if(SAVE.dirty) await SAVE.flush();
    await fetch('/api/logout', { method:'POST' }).catch(() => {});
    me = null; tourChecked = false; if(TOUR.running) TOUR.finish(null); location.hash = '#/'; route(true);
  }

  /* ------------------------------------------------------------ routing */
  let current = '';
  async function route(force){
    const hash = location.hash || '#/';
    if(hash === current && !force) return;
    if(current.startsWith('#/p/') && hash !== current && SAVE.dirty) await SAVE.flush();
    current = hash;
    UI.closeMenu();
    CLASSGAMES.closePanel();
    if(!me){
      try { me = await api('/me'); } catch(e){ me = null; }
    }
    if(!me) return loginView();
    const pm = hash.match(/^#\/p\/([^/]+)(\/edit)?$/);
    if(PLAY) return pm ? editorView(pm[1], false) : null;
    setTimeout(maybeTour, 900);
    if(pm) return editorView(pm[1], !!pm[2]);
    if(hash === '#/teacher' && me.role === 'teacher') return teacherView();
    const top = title => h('header', { class:'top' }, ...logoNav(), h('h1', {}, title), h('span', { class:'grow' }), langBtn(), ...userBits());
    if(hash === '#/class/mine') return CLASSGAMES.mineView(app, me, top);
    if(hash === '#/class') return CLASSGAMES.classView(app, me, top);
    return projectsView();
  }
  addEventListener('hashchange', () => route());

  /* the walkthrough: on its own the first time a student logs in, and
     carried on where they were if the page reloads */
  let tourChecked = false;
  function maybeTour(){
    if(!me || tourChecked || TOUR.running) return;
    tourChecked = true;
    if(me.role !== 'student' || me.tutorial === 'done' || me.tutorial === 'skipped') return;
    if(me.tutorial && /^\d+$/.test(me.tutorial)) TOUR.resume(Number(me.tutorial));
    else TOUR.start(0);
  }
  TOUR.onState = state => {
    if(!me) return;
    me.tutorial = state;
    fetch('/api/me/tutorial', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ state }) }).catch(() => {});
  };

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
      h('header', { class:'top' }, ...logoNav(), h('h1', {}, t('My Projects')), h('span', { class:'grow' }), langBtn(), ...userBits()),
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
      { label:t('Open'), value:'open' }, { label:t('Rename'), value:'ren' }, { label:t('Duplicate'), value:'dup' },
      { label:'⤓ ' + t('Download script'), value:'pdf' }, { sep:true },
      { label:t('Delete'), value:'del', danger:true }], async v => {
      if(v === 'open') location.hash = '#/p/' + p.id;
      if(v === 'pdf'){ const full = await api('/projects/' + p.id); SCRIPTPDF.download(PROJECT.repair(full.data), scriptInfo(full)); }
      if(v === 'ren'){ const n = await UI.ask(t('Rename'), p.name); if(n){ await api('/projects/' + p.id, { method:'PUT', body:json({ name:n }) }); projectsView(); } }
      if(v === 'dup'){
        const full = await api('/projects/' + p.id);
        await api('/projects', { method:'POST', body:json({ name:(p.name + ' copy').slice(0, 60), data:full.data, thumb:full.thumb }) });
        projectsView();
      }
      if(v === 'del'){ if(await UI.confirm(t('Delete this project?') + ' “' + p.name + '”', t('Delete'))){ await api('/projects/' + p.id, { method:'DELETE' }); projectsView(); } }
    });
  }
  /* ⤓ the code of every sprite as one PDF, at any moment */
  function scriptInfo(meta){
    const mine = !meta.owner || meta.owner === me.username;
    return { project:meta.name, name: mine ? me.name : (meta.ownerName || meta.owner), username: mine ? me.username : meta.owner, period: mine ? me.period : '' };
  }
  function downloadScript(){
    if(!P || !projectMeta) return;
    VM.syncLayers();
    SCRIPTPDF.download(PROJECT.serialize(P), scriptInfo(projectMeta));
  }

  /* jump between your projects without leaving the editor */
  async function projectSwitcher(e){
    const r = e.currentTarget.getBoundingClientRect();
    let list = [];
    try { list = await api('/projects'); } catch(err){ return; }
    UI.menu(r.left, r.bottom + 4, [
      { label:'＋ ' + t('New project'), value:'__new' },
      { sep:true },
      ...list.slice(0, 15).map(p => ({ label:(projectMeta && p.id === projectMeta.id ? '● ' : '') + p.name + '  ·  ' + UI.ago(p.updated), value:p.id, on: projectMeta && p.id === projectMeta.id })),
      { sep:true },
      { label:'🗂 ' + t('All my projects'), value:'__all' }], v => {
      if(v === '__new') newProject();
      else if(v === '__all') location.hash = '#/';
      else location.hash = '#/p/' + v;
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
    E.stabs = h('div', { class:'sprite-tabs', role:'tablist' });
    E.code = h('div', { class:'code-area' }, E.cats, E.pal, h('div', { class:'ws-col' }, E.stabs, E.ws));
    E.small = h('button', { class:'btn ghost icon', type:'button', title:t('Small stage'), onclick:() => { document.body.classList.toggle('small-stage'); VM.rt.dirty = true; setTimeout(() => STAGE.renderMonitors(), 50); } }, '▭');
    E.full = h('button', { class:'btn ghost icon', type:'button', title:t('Full screen'), onclick:() => { document.body.classList.toggle('full-stage'); VM.rt.dirty = true; setTimeout(() => STAGE.renderMonitors(), 50); } }, '⛶');
    E.root = h('div', { class:'editor' },
      h('header', { class:'top' }, logo(),
        h('button', { class:'btn ghost proj-btn', type:'button', onclick:projectSwitcher, title:t('My Projects') }, t('My Projects') + ' ▾'),
        E.title, E.status, h('span', { class:'grow' }),
        E.fbGive = h('button', { class:'btn primary fb-top hidden', type:'button' }, t('Give feedback')),
        E.fbBtn = h('button', { class:'btn primary fb-top hidden', type:'button' }),
        h('button', { class:'btn ghost hist-btn', type:'button', onclick:historyPanel, title:t('History') }, t('History')),
        h('button', { class:'btn ghost file-btn', type:'button', onclick:fileMenu }, t('File') + ' ▾'),
        E.userBox = h('span', { class:'userbox' })),
      E.banner,
      h('div', { class:'body' },
        h('section', { class:'left' }, E.tabs, E.code, E.costumes, E.sounds),
        h('section', { class:'right' },
          h('div', { class:'stage-bar' }, E.flag, E.stop, h('span', { class:'grow' }), E.small, E.full),
          E.wrap,
          h('div', { class:'below' }, h('div', { class:'sprite-pane' }, E.info, E.sprites), E.stageTile))));
    E.root.append(...HELPER.mount({ me:() => me }));
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
  // one tab per sprite (and the stage) across the top of the script area
  function spriteTabs(){
    if(!mounted || !P) return;
    const cur = EDITOR.target;
    mounted.stabs.replaceChildren(...[...P.targets.slice(1), P.targets[0]].map(tg => {
      const b = h('button', { type:'button', role:'tab', class:'stab' + (tg === cur ? ' on' : '') + (tg.isStage ? ' st' : ''),
        'aria-selected':String(tg === cur), title:tg.isStage ? t('Stage') : tg.name, onclick:() => { if(tg !== EDITOR.target) select(tg); } },
        h('img', { src:MEDIA.url(RENDER.costumeOf(tg).asset), alt:'', draggable:'false' }),
        h('span', {}, tg.isStage ? t('Stage') : tg.name));
      return b;
    }));
    const on = mounted.stabs.querySelector('.on');
    if(on) on.scrollIntoView({ block:'nearest', inline:'nearest' });
  }
  function select(tg){
    EDITOR.setTarget(tg);
    PANES.setTarget(tg);
    spriteTabs();
    tabLabels();
    if(tab !== 'code') showTab(tab);
  }

  async function editorView(id, edit){
    document.body.className = 'v-editor' + (PLAY ? ' play-only full-stage' : '');
    const E = editorShell();
    E.userBox.replaceChildren(langBtn(), ...userBits(true));
    app.replaceChildren(E.root);
    E.status.textContent = t('Loading…');
    let pr;
    try { pr = await api('/projects/' + id); }
    catch(e){ if(e.status !== 401){ app.replaceChildren(h('div', { class:'login-page' }, h('div', { class:'login-card' }, h('p', {}, t('Something went wrong loading this project.')), h('a', { class:'btn primary', href:'#/' }, t('My Projects'))))); } return; }
    projectMeta = { id:pr.id, name:pr.name, updated:pr.updated, owner:pr.owner, ownerName:pr.ownerName };
    readOnly = PLAY || (!!pr.readOnly && !(edit && pr.canEdit));
    const someoneElse = pr.owner !== me.username;
    let data = pr.data;
    // a newer copy left in this browser (saved while offline) wins
    const bak = SAVE.backup(id);
    if(!readOnly && bak && Date.parse(bak.at) > Date.parse(pr.updated) && JSON.stringify(bak.data) !== JSON.stringify(pr.data)){ data = bak.data; setTimeout(() => SAVE.mark(), 100); }
    P = PROJECT.repair(JSON.parse(JSON.stringify(data)));
    await MEDIA.loadAll(PROJECT.assets(P));
    E.title.value = pr.name; E.title.disabled = readOnly;
    E.banner.classList.toggle('hidden', !someoneElse && !pr.locked);
    E.banner.classList.toggle('editing', someoneElse && !readOnly);
    E.banner.replaceChildren();
    if(pr.locked) E.banner.append(h('span', {}, t('Your teacher has locked editing. You can still open and play your game.')));
    if(someoneElse){
      const back = me.role === 'teacher' ? h('a', { class:'btn small', href:'#/teacher' }, '← ' + t('Dashboard'))
        : h('a', { class:'btn small', href:'#/class' }, '← ' + t('Class Games'));
      if(readOnly) E.banner.append(...[h('span', {}, t('Viewing {n}\'s project', { n:pr.ownerName || pr.owner }) + ' — ' + (I18N.lang === 'es' ? 'Solo para jugar, no puedes cambiarlo' : 'Play only, you can\'t change it')),
        h('span', { class:'grow' }), pr.canEdit ? h('a', { class:'btn small primary', href:'#/p/' + id + '/edit' }, '✏️ ' + t('Edit this project')) : null, back].filter(Boolean));
      else E.banner.append(h('span', {}, '✏️ ' + t('Editing {n}\'s project — changes save to their account. Their work from before is kept in History.', { n:pr.ownerName || pr.owner })),
        h('span', { class:'grow' }), h('a', { class:'btn small', href:'#/p/' + id }, '✓ ' + t('Done')), back);
    }
    document.body.classList.toggle('readonly', readOnly);
    // a student in a classmate's game: play only, nothing of it to take away
    document.body.classList.toggle('peer', readOnly && someoneElse && me.role === 'student');
    STAGE.clearMonitors();
    VM.load(P, { username: me.username });
    STAGE.setReadOnly(readOnly);
    const first = P.targets[1] || P.targets[0];
    EDITOR.load(P, first, readOnly);
    PANES.load(P, first, readOnly);
    spriteTabs();
    tabLabels();
    showTab('code');
    STAGE.renderMonitors();
    SAVE.open(id, readOnly);
    HELPER.load(P, { id, readOnly });
    VM.rt.dirty = true;
    if(PLAY) return;                              // the game alone: no feedback panel, nothing else
    // Feedback, in the top bar: a classmate fills in a slip; the owner reads the slips
    const who = pr.ownerName || pr.owner;
    E.fbBtn.classList.add('hidden'); E.fbGive.classList.add('hidden');
    // a teacher can leave a slip on any student's game too
    if(me.role === 'teacher' && someoneElse){ E.fbGive.onclick = () => CLASSGAMES.openPanel(id, pr.name, who, true); E.fbGive.classList.remove('hidden'); }
    if(me.role === 'student' && readOnly && someoneElse){
      E.fbBtn.textContent = t('Give feedback'); E.fbBtn.onclick = () => CLASSGAMES.openPanel(id, pr.name, who);
      E.fbBtn.classList.remove('hidden');
      CLASSGAMES.openPanel(id, pr.name, who);   // and it opens beside the game right away
    } else if(!someoneElse || me.role === 'teacher'){
      const teacher = me.role === 'teacher';
      CLASSGAMES.receivedCount(id, teacher).then(n => {
        if((!n && !teacher) || current !== '#/p/' + id && current !== '#/p/' + id + '/edit') return;
        E.fbBtn.textContent = t('Feedback') + ' (' + n + ')'; E.fbBtn.onclick = () => CLASSGAMES.projectSlips(id, pr.name, teacher);
        E.fbBtn.classList.remove('hidden');
      });
    }
  }

  function changed(kind){
    if(readOnly) return;
    if(kind === 'monitors') STAGE.renderMonitors();
    if(kind === 'sprite' || kind === 'costume'){ PANES.renderSprites(); spriteTabs(); }
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
      status(ro ? t('Read only') : '✓ ' + t('Saved'), 'ok');
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
  const peer = () => readOnly && me.role === 'student' && projectMeta.owner !== me.username;
  function fileMenu(e){
    const r = e.currentTarget.getBoundingClientRect();
    UI.menu(r.left, r.bottom + 4, [
      { label:t('New project'), value:'new' },
      ...(peer() ? [] : [{ label:t('Download script') + ' (PDF)', value:'pdf' }]),
      // a classmate's game is play-only: no copy of it to take home
      ...(peer() ? [] : [{ label:t('Download to your computer'), value:'down' }]),
      ...(readOnly ? [] : [{ label:t('Load from your computer'), value:'up' }])], async v => {
      if(v === 'new') newProject();
      if(v === 'pdf') downloadScript();
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
    HELPER.load(P, { id:projectMeta.id, readOnly:false });
    SAVE.mark();
  }

  /* ---------------------------------------------------------- dashboard
     Everyone's progress at a glance, and the things a teacher needs to do
     for a student: open or fix a project, change a password, add or turn
     off an account. */
  let dash = { tab:null, sort:'name', dir:1, q:'' };
  try { Object.assign(dash, JSON.parse(sessionStorage.getItem('cs-dash') || '{}')); } catch(e){}
  async function teacherView(){
    document.body.className = 'v-teacher';
    const main = h('main', { class:'tmain' }, h('div', { class:'loading' }, t('Loading…')));
    app.replaceChildren(h('header', { class:'top' }, ...logoNav(), h('h1', {}, '🍎 ' + t('Dashboard')), h('span', { class:'grow' }),
      h('a', { class:'btn ghost', href:'#/' }, '🗂 ' + t('My Projects')), langBtn(), ...userBits()), main);
    let rows = [];
    async function load(){ rows = await api('/admin/overview'); draw(); }
    function draw(){
      try { sessionStorage.setItem('cs-dash', JSON.stringify(dash)); } catch(e){}
      const students = rows.filter(r => r.role === 'student');
      const periods = [...new Set(students.map(r => r.period))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric:true }));
      if(!dash.tab || (dash.tab !== 'all' && dash.tab !== 'teachers' && !periods.includes(dash.tab))) dash.tab = periods[0] || 'all';
      let list = dash.tab === 'teachers' ? rows.filter(r => r.role === 'teacher')
               : students.filter(r => dash.tab === 'all' || r.period === dash.tab);
      const shown = list.filter(r => !r.disabled);
      if(dash.q) list = list.filter(r => (r.name + ' ' + r.username).toLowerCase().includes(dash.q.toLowerCase()));
      const key = dash.sort, dir = dash.dir;
      list.sort((x, y) => {
        const a = x[key], b = y[key];
        if(a == null && b == null) return x.name.localeCompare(y.name);
        if(a == null) return 1; if(b == null) return -1;
        return (typeof a === 'string' ? a.localeCompare(b) : a - b) * dir || x.name.localeCompare(y.name);
      });
      const week = shown.filter(r => r.recent > 0).length;
      const stat = (icon, n, label) => h('div', { class:'stat' }, h('span', { class:'stat-ico' }, icon), h('b', {}, String(n)), h('small', {}, label));
      const th = (k, label) => h('th', { class:'sortable' + (dash.sort === k ? ' on' : ''), onclick:() => { dash.dir = dash.sort === k ? -dash.dir : (k === 'name' || k === 'username' ? 1 : -1); dash.sort = k; draw(); } },
        label + (dash.sort === k ? (dash.dir > 0 ? ' ▲' : ' ▼') : ''));
      const maxRecent = Math.max(1, ...list.map(r => r.recent || 0));
      const search = h('input', { class:'inp', type:'search', placeholder:'🔍 ' + t('Search'), value:dash.q });
      search.oninput = () => { dash.q = search.value; const pos = search.selectionStart; draw(); const s2 = $('.tsearch'); s2.focus(); s2.setSelectionRange(pos, pos); };
      search.className = 'inp tsearch';
      main.replaceChildren(
        h('div', { class:'stats' },
          stat('👥', shown.length, dash.tab === 'teachers' ? t('Teachers') : t('Students')),
          stat('🟢', week, t('Worked this week')),
          stat('🗂', shown.reduce((n, r) => n + r.projects, 0), t('Projects')),
          stat('🧱', shown.length ? Math.round(shown.reduce((n, r) => n + r.blocks, 0) / shown.length) : 0, t('Blocks (average)'))),
        h('div', { class:'ptabs' },
          h('button', { class:'tab' + (dash.tab === 'all' ? ' on' : ''), type:'button', onclick:() => { dash.tab = 'all'; draw(); } }, t('All')),
          ...periods.map(p => h('button', { class:'tab' + (p === dash.tab ? ' on' : ''), type:'button', onclick:() => { dash.tab = p; draw(); } }, t('Period') + ' ' + p)),
          h('button', { class:'tab' + (dash.tab === 'teachers' ? ' on' : ''), type:'button', onclick:() => { dash.tab = 'teachers'; draw(); } }, '👩‍🏫 ' + t('Teachers')),
          h('span', { class:'grow' }), search,
          h('button', { class:'btn primary', type:'button', onclick:() => addAccount(dash.tab === 'teachers' ? 'teacher' : 'student', periods, dash.tab, load) },
            '＋ ' + (dash.tab === 'teachers' ? t('Teacher') : t('Student')))),
        h('div', { class:'twrap' }, h('table', { class:'ttable' },
          h('thead', {}, h('tr', {}, th('name', t('Name')), th('username', t('Username')), dash.tab === 'all' ? th('period', t('Period')) : null,
            th('projects', '🗂'), th('blocks', '🧱 ' + t('Blocks')), th('recent', '⏱ ' + t('This week')), th('updated', t('Last saved')), th('last_login', t('Last login')), th('tutorial', '❓ ' + t('Tour')), h('th', {}))),
          h('tbody', {}, list.length ? list.map(r => h('tr', { class:r.disabled ? 'off' : '' },
            h('td', {}, h('b', {}, r.name), r.disabled ? h('span', { class:'tag' }, t('off')) : null),
            h('td', {}, h('code', {}, r.username)),
            dash.tab === 'all' ? h('td', {}, r.period) : null,
            h('td', { class:'num' }, String(r.projects)),
            h('td', { class:'num' }, String(r.blocks)),
            h('td', {}, h('div', { class:'bar', title:'≈ ' + (r.recent * 2) + ' min' }, h('i', { style:{ width:Math.round((r.recent || 0) / maxRecent * 100) + '%' } }), h('span', {}, r.recent ? '≈ ' + r.recent * 2 + ' min' : '—'))),
            h('td', {}, r.updated ? UI.ago(r.updated) : '—'),
            h('td', {}, r.last_login ? UI.ago(r.last_login) : t('never')),
            h('td', {}, r.tutorial === 'done' ? '✅' : r.tutorial === 'skipped' ? '⏭ ' + t('skipped') : r.tutorial ? (Number(r.tutorial) + 1) + ' / ' + TOUR.STEPS.length : '—'),
            h('td', { class:'tact' },
              h('button', { class:'btn small', type:'button', disabled:!r.projects, title:t('Projects'), onclick:() => studentProjects(r) }, '🗂'),
              h('button', { class:'btn small' + (r.tip ? ' on' : ''), type:'button', title:t('Block Helper tip'), onclick:() => editTip(r) }, r.tip ? '💬✓' : '💬'),
              h('button', { class:'btn small', type:'button', title:t('Reset password'), onclick:() => resetPassword(r) }, '🔑'),
              r.username === me.username ? null : h('button', { class:'btn small', type:'button', title:r.disabled ? t('Turn on') : t('Turn off'),
                onclick:async () => {
                  if(!r.disabled && !(await UI.confirm(t('Turn off {n}? They will not be able to log in. Nothing is deleted.', { n:r.name }), t('Turn off')))) return;
                  await api('/admin/students/' + r.username + '/disable', { method:'POST', body:json({ disabled:!r.disabled }) }); load();
                } }, r.disabled ? '▶' : '⏸'))))
            : h('tr', {}, h('td', { colspan:9, class:'empty' }, '—'))))));
    }
    load();
  }

  async function studentProjects(s){
    const list = await api('/admin/students/' + s.username + '/projects');
    let close = null;
    const body = h('div', { class:'pgrid small' }, list.map(p => h('div', { class:'pcard' },
      h('a', { class:'pthumb', href:'#/p/' + p.id, onclick:() => close && close(false) }, p.thumb ? h('img', { src:p.thumb, alt:'' }) : h('span', { class:'pblank' }, '◆')),
      h('div', { class:'pfoot col' },
        h('span', { class:'pname' }, p.name),
        h('small', {}, UI.ago(p.updated) + (p.stats ? ' · 🧱 ' + p.stats.blocks + ' · 👾 ' + p.stats.sprites : '') + (p.edited_by ? ' · ✏️ ' + p.edited_by : '')),
        h('div', { class:'pbtns' },
          h('a', { class:'btn small', href:'#/p/' + p.id, onclick:() => close && close(false) }, '👁 ' + t('Open')),
          h('a', { class:'btn small primary', href:'#/p/' + p.id + '/edit', onclick:() => close && close(false) }, '✏️ ' + t('Edit')))))));
    UI.dialog({ title:'🗂 ' + s.name, body, ok:null, cancel:t('Back'), wide:true, onOpen:(c, d) => close = d });
  }

  /* a username and password, big enough to read out or copy */
  function showLogin(title, username, password){
    const text = username + ' / ' + password;
    const body = h('div', { class:'newlogin' },
      h('div', {}, h('small', {}, '👤 ' + t('Username')), h('b', {}, username)),
      h('div', {}, h('small', {}, '🔑 ' + t('Password')), h('b', {}, password)),
      h('button', { class:'btn', type:'button', onclick:() => { navigator.clipboard && navigator.clipboard.writeText(text); UI.toast('✓ ' + text); } }, '📋 ' + t('Copy')),
      h('p', { class:'muted' }, t('Write it down — it is not shown again.')));
    return UI.dialog({ title, body, cancel:null });
  }
  async function addAccount(role, periods, tab, done){
    const name = h('input', { class:'inp', maxlength:60, placeholder:t('First and last name'), autocomplete:'off' });
    const period = h('input', { class:'inp', maxlength:10, list:'periods', value: role === 'student' && tab !== 'all' && tab !== 'teachers' ? tab : '' });
    const body = h('div', { class:'form' },
      h('label', {}, h('span', {}, t('Name')), name),
      role === 'student' ? h('label', {}, h('span', {}, t('Period')), period, h('datalist', { id:'periods' }, periods.map(p => h('option', { value:p })))) : null);
    if(!(await UI.dialog({ title:'＋ ' + (role === 'teacher' ? t('Teacher') : t('Student')), body, ok:t('Add') }))) return;
    try {
      const r = await api('/admin/users', { method:'POST', body:json({ name:name.value, period:period.value, role }) });
      await showLogin('✓ ' + r.name, r.username, r.password);
      done();
    } catch(e){ UI.toast(e.message === 'period' ? t('Period') + '?' : e.message === 'name' ? t('Name') + '?' : e.message, 'bad'); }
  }
  /* a teacher's note that shows first in the student's Block Helper */
  async function editTip(s){
    const box = UI.h('textarea', { class:'inp', rows:8, maxlength:2000, style:{ width:'100%' }, placeholder:t('Hints for this student. They see it when they open Block Helper.') });
    box.value = s.tip || '';
    const ok = await UI.dialog({ title:'💬 ' + t('Block Helper tip') + ' — ' + s.name, wide:true,
      body:UI.h('div', {}, box, UI.h('p', { class:'muted' }, t('Show a block by writing its name in double brackets, like [[event_whenkeypressed]] or [[motion_glidesecstoxy]].')), UI.h('p', { class:'muted' }, t('Leave it empty to remove the tip.'))), ok:t('Save') });
    if(!ok) return;
    try { await api('/admin/students/' + s.username + '/tip', { method:'POST', body:json({ tip:box.value }) }); UI.toast('✓ ' + t('Saved')); s.tip = box.value.trim() || null; }
    catch(e){ UI.toast(e.message, 'bad'); }
  }

  async function resetPassword(s){
    const words = ['apple','bear','bird','boat','cake','cloud','duck','fish','frog','kite','lemon','lion','moon','owl','panda','pizza','robot','rocket','star','sun','taco','tiger','train','tree','turtle','whale','zebra'];
    const suggest = words[Math.floor(Math.random() * words.length)] + (10 + Math.floor(Math.random() * 90));
    const pw = await UI.ask('🔑 ' + t('New password') + ' — ' + s.name, suggest);
    if(!pw) return;
    try {
      await api('/admin/students/' + s.username + '/password', { method:'POST', body:json({ password:pw }) });
      showLogin('✓ ' + t('Password changed.'), s.username, pw.toLowerCase());
    } catch(e){ UI.toast(e.message === 'short' ? t('At least 4 letters.') : e.message, 'bad'); }
  }

  route();
})();
