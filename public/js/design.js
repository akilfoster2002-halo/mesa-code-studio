/* =====================================================================
   GAME DESIGN STUDIO — plan a game before you code it.

   Same accounts and sign-in as Code Studio (one cookie for both).
   Routes (after #):
     #/            the step you were on        #/s/<id>   one step
     #/packet      your whole plan, to print
     #/teacher     every student's plan, by period (teacher only)
     #/teacher/<u> one student's plan

   Saving works like Code Studio: a copy goes into this browser first,
   then to the server 0.8 s after the last change.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const { STEPS, RESEARCH, KEYS, MIX_A, MIX_B, ARCADE } = DESIGN;
  const app = $('#app');
  let me = null, data = null, current = '';
  const L = o => o == null ? '' : typeof o === 'string' ? o : (I18N.lang === 'es' && o.es) || o.en;

  /* words on the page that are not in the steps */
  const W = {
    min:{ en:'min', es:'min' }, learn:{ en:'Learn', es:'Aprende' }, example:{ en:'Pac-Man example', es:'Ejemplo de Pac-Man' },
    next:{ en:'Next', es:'Siguiente' }, back:{ en:'Back', es:'Atrás' }, saved:{ en:'Saved', es:'Guardado' },
    saving:{ en:'Saving…', es:'Guardando…' }, offline:{ en:'Offline — kept on this computer', es:'Sin conexión — guardado en esta computadora' },
    packet:{ en:'My plan', es:'Mi plan' }, print:{ en:'Print', es:'Imprimir' }, studio:{ en:'Code Studio', es:'Code Studio' },
    left:{ en:'about {n} min left', es:'faltan unos {n} min' }, allDone:{ en:'All done!', es:'¡Todo listo!' },
    tryAgain:{ en:'Try again!', es:'¡Intenta otra vez!' }, play:{ en:'Play it', es:'Jugar' },
    games:{ en:'{n} of 2 games done', es:'{n} de 2 juegos listos' }, spin:{ en:'Spin', es:'Girar' }, useIt:{ en:'Use it', es:'Usar' },
    waiting:{ en:'Show your teacher. They check it on their screen.', es:'Muéstralo a tu maestro. Lo revisa en su pantalla.' },
    yes:{ en:'Your teacher said yes!', es:'¡Tu maestro dijo que sí!' }, check:{ en:'Check again', es:'Revisar otra vez' },
    inMy:{ en:'In my game, you are', es:'En mi juego, eres' }, mustDo:{ en:'and you must', es:'y debes' },
    before:{ en:'before', es:'antes de' }, while:{ en:'while', es:'mientras' },
    key:{ en:'Key', es:'Tecla' }, does:{ en:'does…', es:'hace…' }, addRow:{ en:'Add', es:'Añadir' },
    repeat:{ en:'Repeat until…', es:'Repetir hasta…' }, step:{ en:'Step', es:'Paso' },
    IF:{ en:'IF', es:'SI' }, THEN:{ en:'THEN', es:'ENTONCES' },
    vars:{ en:'Variables', es:'Variables' }, varsM:{ en:'things the game remembers', es:'cosas que el juego recuerda' },
    loopR:{ en:'Loop', es:'Bucle' }, loopM:{ en:'what repeats', es:'lo que se repite' },
    ifR:{ en:'If / then', es:'Si / entonces' }, ifM:{ en:'what the computer checks', es:'lo que revisa la computadora' },
    inputR:{ en:'Input', es:'Entrada' }, inputM:{ en:'keys or clicks', es:'teclas o clics' },
    randR:{ en:'Random', es:'Al azar' }, randM:{ en:'what changes each time (if you want)', es:'lo que cambia cada vez (si quieres)' },
    idea:{ en:'From your plan:', es:'De tu plan:' },
    pen:{ en:'Pen', es:'Lápiz' }, eraser:{ en:'Eraser', es:'Borrador' }, label:{ en:'Label', es:'Etiqueta' },
    undo:{ en:'Undo', es:'Deshacer' }, clear:{ en:'Clear', es:'Borrar todo' }, labelQ:{ en:'Label text', es:'Texto de la etiqueta' },
    clickPlace:{ en:'Now click where it goes', es:'Ahora haz clic donde va' },
    c1:{ en:'My goal fits in one sentence.', es:'Mi meta cabe en una oración.' },
    c2:{ en:'The player can win AND lose.', es:'El jugador puede ganar Y perder.' },
    c3:{ en:'I have 2–3 mechanics.', es:'Tengo 2–3 mecánicas.' },
    c4:{ en:'My screen sketch has labels.', es:'Mi dibujo de pantalla tiene etiquetas.' },
    c5:{ en:'I wrote at least 3 IF / THEN rules.', es:'Escribí al menos 3 reglas SI / ENTONCES.' },
    c6:{ en:'My teacher checked my idea.', es:'Mi maestro revisó mi idea.' },
    fix:{ en:'Fix it', es:'Arreglar' }, build:{ en:'Build it in Code Studio', es:'Constrúyelo en Code Studio' },
    rules1:{ en:'1 player', es:'1 jugador' }, rules2:{ en:'1 screen', es:'1 pantalla' }, rules3:{ en:'1 clear goal', es:'1 meta clara' },
    rules4:{ en:'2–3 mechanics', es:'2–3 mecánicas' }, keepSmall:{ en:'Keep it small!', es:'¡Hazlo pequeño!' },
    designer:{ en:'Designer', es:'Diseñador' }, date:{ en:'Date', es:'Fecha' }, period:{ en:'Period', es:'Período' },
    designs:{ en:'Game designs', es:'Diseños de juegos' }, all:{ en:'All', es:'Todos' }, name:{ en:'Name', es:'Nombre' },
    game:{ en:'Game', es:'Juego' }, steps:{ en:'Steps', es:'Pasos' }, ideaOk:{ en:'Idea OK', es:'Idea OK' },
    lastSaved:{ en:'Last saved', es:'Último guardado' }, open:{ en:'Open', es:'Abrir' }, tryIt:{ en:'Try it as a student', es:'Probar como estudiante' },
    notStarted:{ en:'not started', es:'sin empezar' }, approveT:{ en:'Tap when the idea is small enough', es:'Toca cuando la idea sea lo bastante pequeña' },
    sketchHere:{ en:'(no drawing)', es:'(sin dibujo)' }, empty:{ en:'—', es:'—' }, listen:{ en:'Listen', es:'Escuchar' },
    newer:{ en:'Your plan was changed on another computer. This is the newest one.', es:'Tu plan cambió en otra computadora. Este es el más nuevo.' },
    yourTitle:{ en:'My game', es:'Mi juego' }, nothing:{ en:'Nothing yet.', es:'Aún nada.' },
    turnIn:{ en:'Turn in', es:'Entregar' }, turnedIn:{ en:'Turned in', es:'Entregado' },
    sureTurnIn:{ en:'Turn in your plan? You cannot change it after.', es:'¿Entregar tu plan? Después no lo puedes cambiar.' },
    locked:{ en:'Turned in. Your plan is locked.', es:'Entregado. Tu plan está bloqueado.' },
    lockedM:{ en:'To change it, ask your teacher to give it back.', es:'Para cambiarlo, pide a tu maestro que te lo devuelva.' },
    giveBack:{ en:'Give back', es:'Devolver' }, allIn:{ en:'Turn in all', es:'Entregar todos' }
  };
  const w = (k, vars) => { let s = L(W[k]); if(vars) s = s.replace(/\{(\w+)\}/g, (m, x) => vars[x]); return s; };

  /* ---------------------------------------------------------------- api */
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts,
      headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}), ...(opts.headers || {}) } });
    if(r.status === 401 && path !== '/login'){
      if(me){ me = null; data = null; current = ''; route(); }       // signed out while working: back to the sign-in card
      throw Object.assign(new Error('login'), { status:401 });
    }
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status });
    return j;
  }

  /* ------------------------------------------------------------- saving */
  const SAVE = { timer:null, dirty:false, state:'saved' };
  const localKey = () => 'gd-' + (me && me.username);
  function mark(){
    if(data.turnedIn) return;                     // turned in: locked
    data.savedAt = Date.now();
    data.done = STEPS.filter(complete).map(s => s.id);
    try { localStorage.setItem(localKey(), JSON.stringify(data)); } catch(e){}
    SAVE.dirty = true; setStatus('saving');
    clearTimeout(SAVE.timer); SAVE.timer = setTimeout(flush, 800);
    drawMap();
  }
  async function flush(){
    clearTimeout(SAVE.timer);
    if(!SAVE.dirty || !data) return;
    SAVE.dirty = false;
    const sent = data.savedAt;
    try { await api('/design', { method:'PUT', body:JSON.stringify({ data, base:SAVE.base }) }); SAVE.base = sent; setStatus('saved'); }
    catch(e){
      if(e.status === 423){                       // turned in (here or by the teacher): show it locked
        try { localStorage.removeItem(localKey()); } catch(x){}
        data = null; await loadMine(); current = ''; route(true); UI.toast(w('locked'));
      } else if(e.status === 409){                       // changed on another computer since this one loaded it: take that copy
        try { localStorage.removeItem(localKey()); } catch(x){}
        data = null; await loadMine(); current = ''; route(true); UI.toast(w('newer'));
      } else if(e.status !== 401){ SAVE.dirty = true; setStatus('offline'); SAVE.timer = setTimeout(flush, 5000); }
    }
  }
  function setStatus(s){
    SAVE.state = s;
    const el = $('.gd-status'); if(!el) return;
    el.textContent = s === 'saved' ? '✓ ' + w('saved') : s === 'saving' ? w('saving') : '⚠ ' + w('offline');
    el.classList.toggle('bad', s === 'offline');
  }
  addEventListener('beforeunload', e => { if(SAVE.dirty){ flush(); e.preventDefault(); } });

  async function loadMine(){
    const r = await api('/design');
    let d = r.data || {};
    SAVE.base = d.savedAt || 0;
    try {
      const local = JSON.parse(localStorage.getItem(localKey()) || 'null');
      if(!d.turnedIn && local && (local.savedAt || 0) > (d.savedAt || 0)){ d = { ...local, approved:d.approved, approvedBy:d.approvedBy }; SAVE.dirty = true; }
    } catch(e){}
    data = Object.assign({ step:0, answers:{}, research:{}, done:[] }, d);
    data.answers = data.answers || {}; data.research = data.research || {};
    if(SAVE.dirty) setTimeout(flush, 300);
  }

  /* --------------------------------------------------------- read aloud */
  function speak(text){
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/[→↺←↑↓]/g, ' '));
      u.lang = I18N.lang === 'es' ? 'es-US' : 'en-US'; u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch(e){}
  }
  const ear = text => h('button', { class:'gd-ear', type:'button', title:w('listen'), 'aria-label':w('listen'), onclick:e => { e.stopPropagation(); speak(typeof text === 'function' ? text() : text); } }, '🔊');

  /* ---------------------------------------------------- what is finished */
  const A = k => data.answers[k];
  const filled = s => typeof s === 'string' && s.trim().length >= 2;
  function researchDone(){
    return RESEARCH.filter(g => { const r = data.research[g.id] || {}; return g.qs.every((q, i) => r[i] === q.a); }).length;
  }
  function answered(q){
    const v = A(q.k);
    switch(q.type){
      case 'text': case 'long': return filled(v);
      case 'chips': return !!v;
      case 'multi': return Array.isArray(v) && v.length >= (q.min_n || 1);
      case 'pitch': return !!v && filled(v.a) && filled(v.b) && filled(v.c);
      case 'keys': return Array.isArray(v) && v.some(r => r.key && filled(r.act));
      case 'sketch': return typeof v === 'string' && v.startsWith('data:image');
      case 'loop': return !!v && Array.isArray(v.s) && v.s.filter(filled).length === 3 && filled(v.until);
      case 'ifthen': return Array.isArray(v) && v.filter(r => filled(r.if) && filled(r.then)).length >= (q.min_n || 1);
      case 'codeplan': return !!v && ['vars', 'loop', 'ifs', 'input'].filter(k => filled(v[k])).length >= 3;
      case 'quiz': return v === q.a;
      case 'research': return researchDone() >= 2;
      case 'checklist': return checklist().every(c => c.ok);
      default: return true;
    }
  }
  const needs = q => q.req || q.type === 'quiz' || q.type === 'checklist';
  const complete = s => s.qs.filter(needs).every(answered);
  const minutesLeft = () => STEPS.filter(s => !complete(s)).reduce((n, s) => n + s.min, 0);
  function checklist(){
    const goal = String(A('goal') || '').trim();
    const rules = (A('rules') || []).filter(r => filled(r.if) && filled(r.then)).length;
    const mech = (A('mechanics') || []).length;
    return [
      { k:'c1', ok: filled(goal) && goal.split(/[.!?]+/).filter(s => s.trim()).length <= 1, step:'goal' },
      { k:'c2', ok: filled(A('win')) && filled(A('lose')), step:'winlose' },
      { k:'c3', ok: mech >= 2 && mech <= 3, step:'mechanics' },
      { k:'c4', ok: !!A('sk_screen') && !!data.answers.sk_screen_labels, step:'sketch' },
      { k:'c5', ok: rules >= 3, step:'rules' },
      { k:'c6', ok: !!data.approved, step:'idea' }
    ];
  }

  /* -------------------------------------------------------------- chrome */
  function langBtn(){
    return h('button', { class:'btn ghost lang', type:'button', title:'English / Español',
      onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); route(true); } }, I18N.lang === 'es' ? 'EN' : 'ES');
  }
  const logo = () => h('a', { class:'logo', href:'#/' }, h('span', { class:'logo-mark' }, '🎨'), h('span', {}, 'Game Design Studio'));
  function topbar(extra){
    return h('header', { class:'top gd-top' }, logo(), SITENAV.bar('design'), h('span', { class:'grow' }), ...(extra || []),
      me.role === 'teacher' ? h('a', { class:'btn ghost', href:'#/teacher' }, '🍎 ', h('span', { class:'lbl' }, w('designs'))) : null,
      langBtn(), h('span', { class:'who' }, '👤 ' + me.name),
      h('button', { class:'btn ghost', type:'button', onclick:logout }, t('Log out')));
  }
  async function logout(){
    await flush();
    await fetch('/api/logout', { method:'POST' }).catch(() => {});
    me = null; data = null; location.hash = '#/'; route(true);
  }

  /* ------------------------------------------------------------ routing */
  async function route(force){
    const hash = location.hash || '#/';
    if(hash === current && !force) return;
    current = hash;
    try { speechSynthesis.cancel(); } catch(e){}
    if(!me){ try { me = await api('/me'); } catch(e){ me = null; } }
    if(!me) return loginView();
    const tm = hash.match(/^#\/teacher(?:\/([^/]+))?$/);
    if(tm && me.role === 'teacher') return tm[1] ? packetView(tm[1]) : teacherView();
    if(hash === '#/' && me.role === 'teacher' && !data) return teacherView();
    if(!data){ try { await loadMine(); } catch(e){ return; } }
    if(hash === '#/packet') return packetView();
    const sm = hash.match(/^#\/s\/([\w-]+)$/);
    const i = sm ? STEPS.findIndex(s => s.id === sm[1]) : data.step || 0;
    return stepView(Math.max(0, i));
  }
  addEventListener('hashchange', () => route());

  /* -------------------------------------------------------------- login */
  function loginView(){
    document.body.className = 'v-login';
    const user = h('input', { class:'inp', name:'username', autocomplete:'username', autocapitalize:'none', spellcheck:'false', required:true });
    const pass = h('input', { class:'inp', name:'password', type:'password', autocomplete:'current-password', autocapitalize:'none', required:true });
    const msg = h('div', { class:'msg', role:'alert' });
    const btn = h('button', { class:'btn primary big', type:'submit' }, t('Log in'));
    const form = h('form', { class:'login-card' },
      h('div', { class:'login-top' }, h('a', { class:'logo', href:'#/' }, h('span', { class:'logo-mark' }, '🎨'), h('span', {}, 'Game Design Studio')), langBtn()),
      h('div', { class:'gd-login-art' }, '🕹🎨💡'),
      h('label', {}, h('span', {}, '👤 ' + t('Username')), user),
      h('label', {}, h('span', {}, '🔑 ' + t('Password')), h('div', { class:'pw' }, pass,
        h('button', { type:'button', class:'peek', onclick:() => { pass.type = pass.type === 'password' ? 'text' : 'password'; } }, '👁'))),
      msg, btn);
    form.onsubmit = async e => {
      e.preventDefault(); btn.disabled = true; msg.textContent = '';
      try {
        me = await api('/login', { method:'POST', body:JSON.stringify({ username:user.value.trim().toLowerCase(), password:pass.value.trim() }) });
        current = ''; route(true);
      } catch(err){
        msg.textContent = err.status === 401 ? t('Wrong username or password.') : err.status === 429 ? t('Too many tries. Wait a few minutes.') : t('Could not reach the server.');
        btn.disabled = false; pass.select();
      }
    };
    app.replaceChildren(h('div', { class:'login-page' }, form));
    user.focus();
  }

  /* ---------------------------------------------------------- step map */
  function drawMap(){
    const map = $('.gd-map'); if(!map) return;
    const at = data.step || 0;
    map.replaceChildren(...STEPS.map((s, i) => h('a', { class:'gd-dot' + (i === at ? ' on' : '') + (complete(s) ? ' done' : ''), href:'#/s/' + s.id, title:L(s.title) },
      h('span', { class:'gd-dot-ico' }, complete(s) ? '✅' : s.icon), h('span', { class:'gd-dot-name' }, L(s.title)))));
    const left = $('.gd-left'); if(left){ const n = minutesLeft(); left.textContent = n ? '⏱ ' + w('left', { n }) : '🎉 ' + w('allDone'); }
  }

  /* -------------------------------------------------------------- a step */
  function stepView(i){
    document.body.className = 'v-design';
    const s = STEPS[i];
    if(data.step !== i){ data.step = i; mark(); }
    const learnText = () => L(s.learn.word) + '. ' + L(s.learn.means);
    const parts = [
      h('div', { class:'gd-head' },
        h('div', { class:'gd-big' }, s.icon),
        h('div', {}, h('div', { class:'gd-num' }, w('step') + ' ' + (i + 1) + ' / ' + STEPS.length + ' · ⏱ ' + s.min + ' ' + w('min')),
          h('h1', {}, L(s.title))),
        ear(() => L(s.title) + '. ' + learnText())),
      h('div', { class:'gd-learn' }, h('span', { class:'gd-learn-tag' }, '🧠 ' + w('learn')),
        h('b', {}, L(s.learn.word)), h('span', {}, L(s.learn.means)), ear(learnText))
    ];
    if(s.rules) parts.push(h('div', { class:'gd-rules' }, h('div', { class:'gd-rules-t' }, '✋ ' + w('keepSmall')),
      ...[['👤', 'rules1'], ['🖥', 'rules2'], ['🎯', 'rules3'], ['⚙️', 'rules4']].map(([ic, k]) => h('div', { class:'gd-rule' }, h('span', {}, ic), w(k)))));
    if(s.example){
      const ex = h('div', { class:'gd-ex-text hidden' }, L(s.example), ear(L(s.example)));
      parts.push(h('div', { class:'gd-ex' }, h('button', { class:'btn gd-ex-btn', type:'button', onclick:() => ex.classList.toggle('hidden') }, '🟡 ' + w('example')), ex));
    }
    if(data.turnedIn) parts.unshift(lockBanner());
    parts.push(h('fieldset', { class:'gd-fs', disabled:!!data.turnedIn }, ...s.qs.map(questionCard)));
    const nav = h('div', { class:'gd-nav' },
      i > 0 ? h('a', { class:'btn big', href:'#/s/' + STEPS[i - 1].id }, '◀ ' + w('back')) : h('span'),
      h('span', { class:'grow' }),
      i < STEPS.length - 1 ? h('a', { class:'btn primary big', href:'#/s/' + STEPS[i + 1].id }, w('next') + ' ▶')
                           : h('a', { class:'btn primary big', href:'#/packet' }, '📄 ' + w('packet')));
    app.replaceChildren(
      topbar([h('span', { class:'gd-left' }), h('span', { class:'gd-status status' }),
        h('a', { class:'btn ghost', href:'#/packet', title:w('packet') }, '📄 ', h('span', { class:'lbl' }, w('packet'))), turnInBtn()]),
      h('div', { class:'gd-body' }, h('nav', { class:'gd-map' }), h('main', { class:'gd-main' }, h('div', { class:'gd-card' }, ...parts, nav))));
    setStatus(SAVE.state); drawMap();
    $('.gd-main').scrollTop = 0; scrollTo(0, 0);
  }

  // turned in: the plan is locked until the teacher gives it back
  const lockBanner = () => h('div', { class:'gd-lock' }, h('span', { class:'gd-lock-ico' }, '🔒'),
    h('div', {}, h('b', {}, w('locked')), h('small', {}, w('lockedM'))));
  const turnInBtn = () => data.turnedIn ? h('span', { class:'gd-in-chip' }, '🔒 ' + w('turnedIn'))
    : h('button', { class:'btn primary', type:'button', onclick:async () => {
        if(!confirm(w('sureTurnIn'))) return;
        await flush();
        try { await api('/design/turnin', { method:'POST', body:'{}' }); data.turnedIn = true; current = ''; route(true); }
        catch(e){ UI.toast(t('Could not reach the server.')); }
      } }, '📤 ' + w('turnIn'));

  /* ---------------------------------------------------------- questions */
  function questionCard(q){
    const star = needs(q) && q.type !== 'quiz' && q.type !== 'checklist';
    const card = h('section', { class:'gd-q' + (q.type === 'quiz' ? ' quiz' : '') + (answered(q) && star ? ' ok' : '') },
      h('div', { class:'gd-q-top' }, h('h2', {}, q.type === 'quiz' ? '❓ ' + L(q.q) : L(q.q)), star ? h('span', { class:'gd-star', title:'*' }, '⭐') : null, ear(L(q.q))));
    const set = v => { data.answers[q.k] = v; mark(); card.classList.toggle('ok', star && answered(q)); };
    const body = (INPUT[q.type] || INPUT.text)(q, A(q.k), set, card);
    if(body) card.append(body);
    return card;
  }
  const textIn = (val, ph, on, cls) => {
    const el = h('input', { class:'inp gd-in' + (cls ? ' ' + cls : ''), value:val || '', placeholder:L(ph), maxlength:200 });
    el.oninput = () => on(el.value); return el;
  };
  const chip = (o, on, click) => h('button', { class:'gd-chip' + (on ? ' on' : ''), type:'button', 'aria-pressed':on ? 'true' : 'false', onclick:click },
    o.icon ? h('span', { class:'gd-chip-ico' }, o.icon) : null, L(o));

  const INPUT = {
    text(q, v, set){ return textIn(v, q.ph, set, q.code ? 'code' : ''); },
    long(q, v, set){
      const el = h('textarea', { class:'inp gd-in', rows:3, placeholder:L(q.ph), maxlength:800 }); el.value = v || '';
      el.oninput = () => set(el.value); return el;
    },
    chips(q, v, set){
      const box = h('div', { class:'gd-chips' });
      const draw = cur => box.replaceChildren(...q.o.map(o => chip(o, cur === o.v, () => { set(o.v); draw(o.v); })));
      draw(v); return box;
    },
    multi(q, v, set){
      const box = h('div', { class:'gd-chips' });
      const draw = cur => box.replaceChildren(...q.o.map(o => chip(o, cur.includes(o.v), () => {
        let next = cur.includes(o.v) ? cur.filter(x => x !== o.v) : [...cur, o.v];
        if(q.max && next.length > q.max) next = next.slice(next.length - q.max);
        set(next); draw(next);
      })));
      draw(Array.isArray(v) ? v : []); return box;
    },
    pitch(q, v, set){
      v = Object.assign({ a:'', b:'', link:'while', c:'' }, v);
      const up = () => set({ ...v });
      const link = h('select', { class:'inp gd-sel' }, h('option', { value:'while' }, w('while')), h('option', { value:'before' }, w('before')));
      link.value = v.link; link.onchange = () => { v.link = link.value; up(); };
      return h('div', { class:'gd-pitch' },
        h('span', {}, w('inMy')), textIn(v.a, { en:'a brave cat', es:'un gato valiente' }, x => { v.a = x; up(); }),
        h('span', {}, w('mustDo')), textIn(v.b, { en:'catch 20 fish', es:'atrapar 20 peces' }, x => { v.b = x; up(); }),
        link, textIn(v.c, { en:'sharks chase you', es:'los tiburones te persiguen' }, x => { v.c = x; up(); }), h('span', {}, '.'));
    },
    keys(q, v, set){
      let rows = Array.isArray(v) && v.length ? v.map(r => ({ ...r })) : [{ key:'', act:'' }, { key:'', act:'' }];
      const box = h('div', { class:'gd-rows' });
      const draw = () => box.replaceChildren(...rows.map((r, i) => {
        const sel = h('select', { class:'inp gd-sel' }, h('option', { value:'' }, w('key') + '…'), ...KEYS.map(k => h('option', { value:k }, k)));
        sel.value = r.key; sel.onchange = () => { r.key = sel.value; set(rows); };
        return h('div', { class:'gd-row' }, h('span', { class:'gd-kbd' }, '⌨️'), sel, h('span', {}, '→'),
          textIn(r.act, { en:'move left', es:'moverse a la izquierda' }, x => { r.act = x; set(rows); }),
          rows.length > 1 ? h('button', { class:'btn small', type:'button', onclick:() => { rows.splice(i, 1); set(rows); draw(); } }, '✕') : null);
      }), rows.length < 8 ? h('button', { class:'btn small gd-add', type:'button', onclick:() => { rows.push({ key:'', act:'' }); draw(); } }, '＋ ' + w('addRow')) : null);
      draw(); return box;
    },
    sketch(q, v, set){ return sketchPad(q, v, set); },
    loop(q, v, set){
      v = Object.assign({ s:['', '', ''], until:'' }, v);
      const up = () => set({ s:[...v.s], until:v.until });
      const ph = [{ en:'move', es:'moverse' }, { en:'catch a fish', es:'atrapar un pez' }, { en:'dodge sharks', es:'esquivar tiburones' }];
      return h('div', { class:'gd-loop' },
        h('div', { class:'gd-loop-steps' }, ...v.s.flatMap((x, i) => [
          h('div', { class:'gd-loop-box' }, h('b', {}, String(i + 1)), textIn(x, ph[i], y => { v.s[i] = y; up(); })),
          i < 2 ? h('span', { class:'gd-arrow' }, '→') : h('span', { class:'gd-arrow' }, '↺')])),
        h('label', { class:'gd-until' }, h('span', {}, '🔁 ' + w('repeat')), textIn(v.until, { en:'all the fish are caught', es:'se atrapan todos los peces' }, y => { v.until = y; up(); })));
    },
    ifthen(q, v, set){
      let rows = Array.isArray(v) && v.length ? v.map(r => ({ ...r })) : [{}, {}, {}].map(() => ({ if:'', then:'' }));
      const box = h('div', { class:'gd-rows' });
      const phs = [[{ en:'the cat touches a fish', es:'el gato toca un pez' }, { en:'score goes up 1', es:'los puntos suben 1' }],
                   [{ en:'a shark touches the cat', es:'un tiburón toca al gato' }, { en:'lose a life', es:'pierde una vida' }],
                   [{ en:'lives = 0', es:'vidas = 0' }, { en:'game over', es:'fin del juego' }]];
      const draw = () => box.replaceChildren(...rows.map((r, i) => h('div', { class:'gd-row gd-if' },
        h('span', { class:'gd-kw if' }, w('IF')), textIn(r.if, (phs[i] || phs[0])[0], x => { r.if = x; set(rows); }),
        h('span', { class:'gd-kw then' }, w('THEN')), textIn(r.then, (phs[i] || phs[0])[1], x => { r.then = x; set(rows); }),
        rows.length > 1 ? h('button', { class:'btn small', type:'button', onclick:() => { rows.splice(i, 1); set(rows); draw(); } }, '✕') : null)),
        rows.length < 8 ? h('button', { class:'btn small gd-add', type:'button', onclick:() => { rows.push({ if:'', then:'' }); draw(); } }, '＋ ' + w('addRow')) : null);
      draw(); return box;
    },
    codeplan(q, v, set){
      v = Object.assign({ vars:'', loop:'', ifs:'', input:'', random:'' }, v);
      const hints = planHints();
      const box = h('div', { class:'gd-plan' });
      for(const [k, label, means, icon] of [['vars', 'vars', 'varsM', '📦'], ['loop', 'loopR', 'loopM', '🔁'], ['ifs', 'ifR', 'ifM', '🔀'], ['input', 'inputR', 'inputM', '⌨️'], ['random', 'randR', 'randM', '🎲']]){
        const inp = textIn(v[k], null, x => { v[k] = x; set({ ...v }); });
        box.append(h('div', { class:'gd-plan-row' },
          h('div', { class:'gd-plan-name' }, h('span', { class:'gd-plan-ico' }, icon), h('div', {}, h('b', {}, w(label)), h('small', {}, w(means)))),
          h('div', { class:'gd-plan-in' }, inp,
            hints[k] ? h('div', { class:'gd-hint' }, '💡 ' + w('idea') + ' ', h('i', {}, hints[k]), ' ',
              h('button', { class:'btn small', type:'button', onclick:() => { inp.value = hints[k]; v[k] = hints[k]; set({ ...v }); } }, w('useIt'))) : null)));
      }
      return box;
    },
    quiz(q, v, set, card){
      const fb = h('div', { class:'gd-fb' });
      const box = h('div', { class:'gd-chips' });
      const draw = (cur, wrong) => {
        box.replaceChildren(...q.o.map((o, i) => h('button', { class:'gd-chip' + (cur === i && i === q.a ? ' right' : '') + (wrong === i ? ' wrong' : ''), type:'button',
          onclick:() => { if(i === q.a){ set(i); draw(i); } else { draw(cur, i); } } }, L(o))));
        fb.replaceChildren(cur === q.a ? h('span', { class:'gd-good' }, '✅ ' + L(q.why)) : wrong != null ? h('span', { class:'gd-bad' }, '🤔 ' + w('tryAgain')) : '');
        card.classList.toggle('ok', cur === q.a);
      };
      draw(v); return h('div', {}, box, fb);
    },
    research(q, v, set){
      const box = h('div', { class:'gd-research' });
      const count = h('div', { class:'gd-count' });
      const drawCount = () => { const n = researchDone(); count.textContent = (n >= 2 ? '✅ ' : '🔍 ') + w('games', { n:Math.min(n, 2) }); };
      for(const g of RESEARCH){
        const r = data.research[g.id] || {};
        const solved = () => g.qs.every((qq, i) => (data.research[g.id] || {})[i] === qq.a);
        const head = h('button', { class:'gd-game-head', type:'button' }, h('span', { class:'gd-game-ico' }, g.icon), h('b', {}, g.name), h('span', { class:'gd-game-ok' }, solved() ? '✅' : ''));
        const inner = h('div', { class:'gd-game-body hidden' },
          h('a', { class:'btn primary', href:ARCADE + g.id, target:'_blank', rel:'noopener' }, '▶ ' + w('play')),
          ...g.qs.map((qq, qi) => {
            const fb = h('span', { class:'gd-mini-fb' });
            const chips = h('div', { class:'gd-chips small' });
            const draw = (cur, wrong) => {
              chips.replaceChildren(...qq.o.map((o, i) => h('button', { class:'gd-chip' + (cur === i ? ' right' : '') + (wrong === i ? ' wrong' : ''), type:'button',
                onclick:() => {
                  if(i !== qq.a) return draw(cur, i);
                  data.research[g.id] = { ...(data.research[g.id] || {}), [qi]:i }; mark(); draw(i);
                  head.querySelector('.gd-game-ok').textContent = solved() ? '✅' : ''; head.parentNode.classList.toggle('ok', solved()); drawCount();
                } }, L(o))));
              fb.textContent = cur === qq.a ? '✅' : wrong != null ? '🤔 ' + w('tryAgain') : '';
            };
            draw(r[qi]);
            return h('div', { class:'gd-mini' }, h('div', { class:'gd-mini-q' }, L(qq.q), ' ', fb, ear(L(qq.q))), chips);
          }));
        head.onclick = () => inner.classList.toggle('hidden');
        box.append(h('div', { class:'gd-game' + (solved() ? ' ok' : '') }, head, inner));
      }
      drawCount();
      return h('div', {}, count, box);
    },
    mixer(q, v, set){
      const out = h('div', { class:'gd-mix-out' }, v || '');
      const pick = a => a[Math.floor(Math.random() * a.length)];
      return h('div', { class:'gd-mix' },
        h('button', { class:'btn gd-spin', type:'button', onclick:() => { const x = pick(MIX_A) + ' + ' + L(pick(MIX_B)); out.textContent = x; set(x); } }, '🎲 ' + w('spin')),
        out,
        h('button', { class:'btn small', type:'button', onclick:() => {
          if(!data.answers.mix) return;
          const ta = document.querySelector('.gd-q textarea');
          data.answers.idea = (data.answers.idea ? data.answers.idea + ' ' : '') + data.answers.mix + ': ';
          if(ta){ ta.value = data.answers.idea; ta.focus(); }
          mark();
        } }, w('useIt')));
    },
    approve(q, v, set, card){
      const box = h('div', { class:'gd-approve' });
      const draw = () => {
        card.classList.toggle('ok', !!data.approved);
        box.replaceChildren(data.approved ? h('span', { class:'gd-good big' }, '✅ ' + w('yes'))
          : h('span', { class:'gd-wait' }, '🙋 ' + w('waiting')),
          data.approved ? '' : h('button', { class:'btn small', type:'button', onclick:async () => {
            try { const r = await api('/design'); if(r.data){ data.approved = !!r.data.approved; data.approvedBy = r.data.approvedBy; } } catch(e){}
            draw(); drawMap();
          } }, '🔄 ' + w('check')));
      };
      draw(); return box;
    },
    checklist(q, v, set){
      const list = checklist();
      return h('div', {},
        h('div', { class:'gd-checks' }, ...list.map(c => h('div', { class:'gd-check' + (c.ok ? ' ok' : '') },
          h('span', { class:'gd-check-box' }, c.ok ? '✅' : '⬜'), h('span', { class:'grow' }, w(c.k)),
          c.ok ? null : h('a', { class:'btn small', href:'#/s/' + c.step }, w('fix'))))),
        h('div', { class:'gd-final' },
          h('a', { class:'btn big', href:'#/packet' }, '📄 ' + w('packet')),
          h('a', { class:'btn primary big', href:'/studio#/' }, '◆ ' + w('build'))));
    }
  };

  /* ideas for the code plan, pulled from the student's own answers */
  function planHints(){
    const hud = (A('hud') || []).map(v => L(DESIGN.HUD.find(x => x.v === v) || {})).filter(Boolean);
    const lp = A('loop'), rules = (A('rules') || []).filter(r => filled(r.if) && filled(r.then));
    const keys = (A('keys') || []).filter(r => r.key && filled(r.act));
    const moves = A('enemy_moves') || [];
    return {
      vars: hud.length ? hud.join(', ') : '',
      loop: lp && filled(lp.until) ? w('repeat').replace('…', '') + ' ' + lp.until : '',
      ifs: rules[0] ? w('IF') + ' ' + rules[0].if + ' → ' + rules[0].then : '',
      input: keys.length ? keys.map(r => r.key + ' = ' + r.act).join(', ') : '',
      random: moves.includes('random') || moves.includes('fall') ? (I18N.lang === 'es' ? 'dónde aparece el enemigo' : 'where the enemy shows up') : ''
    };
  }

  /* ------------------------------------------------------------ sketch */
  const COLORS = ['#222', '#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#fdd835', '#8d6e63'];
  function sketchPad(q, v, set){
    const cv = h('canvas', { class:'gd-canvas', width:q.w, height:q.h, style:{ maxWidth:q.w + 'px', aspectRatio:q.w + ' / ' + q.h } });
    const cx = cv.getContext('2d');
    let tool = 'pen', color = COLORS[0], size = 4, undo = [], down = false, last = null;
    const blank = () => { cx.fillStyle = '#fff'; cx.fillRect(0, 0, q.w, q.h); };
    blank();
    if(v){ const im = new Image(); im.onload = () => cx.drawImage(im, 0, 0); im.src = v; }
    const save = () => set(cv.toDataURL('image/png'));
    const pos = e => { const r = cv.getBoundingClientRect(); return { x:(e.clientX - r.left) * q.w / r.width, y:(e.clientY - r.top) * q.h / r.height }; };
    const snap = () => { undo.push(cx.getImageData(0, 0, q.w, q.h)); if(undo.length > 20) undo.shift(); };
    cv.onpointerdown = async e => {
      e.preventDefault();
      if(tool === 'label'){
        const p = pos(e);
        const txt = await UI.ask(w('labelQ'), '');
        if(!txt) return;
        snap(); cx.fillStyle = color; cx.font = 'bold ' + Math.round(q.w / 22 + 4) + 'px "Helvetica Neue", Arial, sans-serif';
        cx.textBaseline = 'middle'; cx.fillText(txt.slice(0, 30), p.x, p.y);
        if(q.labels) data.answers[q.k + '_labels'] = (data.answers[q.k + '_labels'] || 0) + 1;
        save(); return;
      }
      snap(); down = true; last = pos(e); cv.setPointerCapture(e.pointerId);
      dot(last, last);
    };
    const dot = (a, b) => {
      cx.strokeStyle = tool === 'eraser' ? '#fff' : color; cx.lineWidth = tool === 'eraser' ? size * 4 : size;
      cx.lineCap = cx.lineJoin = 'round'; cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x + 0.01, b.y); cx.stroke();
    };
    cv.onpointermove = e => { if(!down) return; const p = pos(e); dot(last, p); last = p; };
    cv.onpointerup = cv.onpointercancel = () => { if(down){ down = false; save(); } };
    const bar = h('div', { class:'gd-tools' });
    const drawBar = () => bar.replaceChildren(...[
      ...COLORS.map(c => h('button', { class:'gd-color' + (c === color && tool !== 'eraser' ? ' on' : ''), type:'button', style:{ background:c }, title:c,
        onclick:() => { color = c; if(tool === 'eraser') tool = 'pen'; drawBar(); } })),
      h('span', { class:'gd-sep' }),
      ...[[2, '•'], [5, '●'], [10, '⬤']].map(([n, s]) => h('button', { class:'btn small' + (size === n ? ' on' : ''), type:'button', onclick:() => { size = n; drawBar(); } }, s)),
      h('span', { class:'gd-sep' }),
      h('button', { class:'btn small' + (tool === 'pen' ? ' on' : ''), type:'button', onclick:() => { tool = 'pen'; drawBar(); } }, '✏️ ' + w('pen')),
      h('button', { class:'btn small' + (tool === 'eraser' ? ' on' : ''), type:'button', onclick:() => { tool = 'eraser'; drawBar(); } }, '🧽 ' + w('eraser')),
      q.labels || q.w > 300 ? h('button', { class:'btn small' + (tool === 'label' ? ' on' : ''), type:'button', title:w('clickPlace'), onclick:() => { tool = 'label'; drawBar(); UI.toast(w('clickPlace')); } }, '🔤 ' + w('label')) : null,
      h('button', { class:'btn small', type:'button', onclick:() => { const u = undo.pop(); if(u){ cx.putImageData(u, 0, 0); save(); } } }, '↩ ' + w('undo')),
      h('button', { class:'btn small', type:'button', onclick:() => { snap(); blank(); if(q.labels) data.answers[q.k + '_labels'] = 0; save(); } }, '🗑 ' + w('clear'))
    ].filter(Boolean));
    drawBar();
    return h('div', { class:'gd-sketch' }, bar, cv);
  }

  /* -------------------------------------------------- the whole plan
     One page with every answer, for printing — the student's own, or
     (for a teacher) any student's. */
  async function packetView(username){
    document.body.className = 'v-design v-packet';
    let d = data, who = me;
    if(username){
      try { const r = await api('/admin/designs/' + encodeURIComponent(username)); d = r.data || { answers:{}, research:{} }; who = r; }
      catch(e){ return; }
    } else await flush();
    d.answers = d.answers || {}; d.research = d.research || {};
    const a = k => d.answers[k];
    const opt = (list, v) => { const o = list.find(x => x.v === v); return o ? (o.icon ? o.icon + ' ' : '') + L(o) : ''; };
    const txt = v => filled(v) ? v : w('empty');
    const row = (label, val) => h('div', { class:'pk-row' }, h('div', { class:'pk-l' }, label), h('div', { class:'pk-v' }, val));
    const pic = k => a(k) ? h('img', { class:'pk-img', src:a(k), alt:'' }) : h('span', { class:'muted' }, w('sketchHere'));
    const Q = (sid, k) => L(STEPS.find(s => s.id === sid).qs.find(q => q.k === k).q);
    const sec = (sid, ...rows) => { const s = STEPS.find(x => x.id === sid); return h('section', { class:'pk-sec' }, h('h2', {}, s.icon + ' ' + L(s.title)), ...rows); };
    const pitch = a('pitch') || {};
    const lp = a('loop') || { s:[] };
    const cp = a('codeplan') || {};
    const researched = RESEARCH.filter(g => g.qs.every((q, i) => (d.research[g.id] || {})[i] === q.a)).map(g => g.icon + ' ' + g.name);
    const page = h('div', { class:'pk' },
      h('div', { class:'pk-top' },
        h('div', {}, h('div', { class:'pk-kicker' }, 'Game Design Packet · ' + (I18N.lang === 'es' ? 'Plan de diseño' : 'Design plan')),
          h('h1', {}, a('title') || w('yourTitle'))),
        h('div', { class:'pk-who' }, h('div', {}, h('b', {}, w('designer') + ': '), who.name), h('div', {}, h('b', {}, w('period') + ': '), who.period || '—'),
          h('div', {}, h('b', {}, w('date') + ': '), new Date().toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en')),
          h('div', {}, d.approved ? '✅ ' + w('c6') : '⬜ ' + w('c6')))),
      sec('research', row(Q('research', 'research'), researched.length ? researched.join(' · ') : w('empty')),
        row(Q('research', 'liked'), txt(a('liked'))), row(Q('research', 'like_mine'), opt(RESEARCH.map(g => ({ v:g.id, icon:g.icon, en:g.name })).concat([{ v:'none', en:'None', es:'Ninguno' }]), a('like_mine')) || w('empty'))),
      sec('idea', row(Q('idea', 'type'), opt(DESIGN.TYPES, a('type')) || w('empty')), row(Q('idea', 'idea'), txt(a('idea'))),
        row(Q('idea', 'pitch'), filled(pitch.a) ? `${w('inMy')} ${pitch.a} ${w('mustDo')} ${pitch.b} ${w(pitch.link || 'while')} ${pitch.c}.` : w('empty'))),
      sec('player', row(Q('player', 'player'), txt(a('player'))), row(Q('player', 'player_look'), txt(a('player_look'))),
        row(Q('player', 'keys'), (a('keys') || []).filter(r => r.key).map(r => r.key + ' = ' + r.act).join(' · ') || w('empty')),
        row(Q('player', 'sk_player'), pic('sk_player'))),
      sec('goal', row(Q('goal', 'goal'), txt(a('goal'))), row(Q('goal', 'bonus'), txt(a('bonus'))), row(Q('goal', 'goal_show'), txt(a('goal_show'))), row(Q('goal', 'goal_fun'), txt(a('goal_fun')))),
      sec('mechanics', row(Q('mechanics', 'mechanics'), (a('mechanics') || []).map(v => opt(DESIGN.MECHANICS, v)).join(' · ') || w('empty')), row(Q('mechanics', 'mech_how'), txt(a('mech_how')))),
      sec('loop', row(Q('loop', 'loop'), (lp.s || []).filter(Boolean).length ? lp.s.join(' → ') + ' ↺' : w('empty')), row(w('repeat'), txt(lp.until)), row(Q('loop', 'loop_why'), txt(a('loop_why')))),
      sec('rules', row(Q('rules', 'rules'), h('div', {}, ...((a('rules') || []).filter(r => filled(r.if)).map(r => h('div', { class:'pk-if' }, h('b', {}, w('IF') + ' '), r.if, h('b', {}, ' ' + w('THEN') + ' '), r.then))))),
        row(Q('rules', 'not_allowed'), txt(a('not_allowed')))),
      sec('challenge', row(Q('challenge', 'enemy'), txt(a('enemy'))), row(Q('challenge', 'enemy_moves'), (a('enemy_moves') || []).map(v => opt(DESIGN.MOVES, v)).join(' · ') || w('empty')),
        row(Q('challenge', 'harder'), (a('harder') || []).map(v => opt(DESIGN.HARDER, v)).join(' · ') || w('empty')), row(Q('challenge', 'sk_enemy'), pic('sk_enemy'))),
      sec('winlose', row(Q('winlose', 'win'), txt(a('win'))), row(Q('winlose', 'lose'), txt(a('lose'))), row(Q('winlose', 'end_screens'), txt(a('end_screens'))),
        row(Q('winlose', 'end_code'), h('code', {}, (I18N.lang === 'es' ? 'si ' : 'if ') + (a('end_code') || '___') + (I18N.lang === 'es' ? ' → fin del juego' : ' → game over')))),
      sec('feedback', row(Q('feedback', 'hud'), (a('hud') || []).map(v => opt(DESIGN.HUD, v)).join(' · ') || w('empty')), row(Q('feedback', 'sounds'), txt(a('sounds'))), row(Q('feedback', 'rewards'), txt(a('rewards')))),
      sec('balance', row(Q('balance', 'helper'), txt(a('helper'))), row(Q('balance', 'not_easy'), txt(a('not_easy'))), row(Q('balance', 'not_hard'), txt(a('not_hard'))),
        row(Q('balance', 'skill'), opt(STEPS.find(s => s.id === 'balance').qs[3].o, a('skill')) || w('empty'))),
      sec('code', row('📦 ' + w('vars'), txt(cp.vars)), row('🔁 ' + w('loopR'), txt(cp.loop)), row('🔀 ' + w('ifR'), txt(cp.ifs)), row('⌨️ ' + w('inputR'), txt(cp.input)), row('🎲 ' + w('randR'), txt(cp.random))),
      sec('sketch', h('div', { class:'pk-screen' }, pic('sk_screen'))));
    const back = username ? '#/teacher' : '#/s/' + STEPS[data ? data.step || 0 : 0].id;
    app.replaceChildren(topbar([h('a', { class:'btn ghost', href:back }, '◀ ' + w('back')),
      h('button', { class:'btn ghost', type:'button', onclick:() => print() }, '🖨 ', h('span', { class:'lbl' }, w('print'))),
      username ? null : turnInBtn()]),
      h('main', { class:'pk-wrap' }, username || !data.turnedIn ? null : lockBanner(), page));
  }

  /* ------------------------------------------------------ teacher list */
  let tab = null;
  try { tab = sessionStorage.getItem('gd-tab'); } catch(e){}
  async function teacherView(){
    document.body.className = 'v-teacher v-design';
    const main = h('main', { class:'tmain' }, h('div', { class:'loading' }, t('Loading…')));
    app.replaceChildren(topbar([h('a', { class:'btn ghost', href:'#/s/welcome' }, '🧪 ', h('span', { class:'lbl' }, w('tryIt')))]), main);
    let rows = [];
    try { rows = await api('/admin/designs'); } catch(e){ return; }
    const draw = () => {
      const periods = [...new Set(rows.map(r => r.period).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric:true }));
      if(!tab || (tab !== 'all' && !periods.includes(tab))) tab = periods[0] || 'all';
      try { sessionStorage.setItem('gd-tab', tab); } catch(e){}
      const list = rows.filter(r => !r.disabled && (tab === 'all' || r.period === tab)).sort((a, b) => a.name.localeCompare(b.name));
      const started = list.filter(r => r.updated).length;
      const ok = list.filter(r => r.approved).length;
      const avg = list.length ? Math.round(list.reduce((n, r) => n + r.done, 0) / list.length) : 0;
      const stat = (icon, n, label) => h('div', { class:'stat' }, h('span', { class:'stat-ico' }, icon), h('b', {}, String(n)), h('small', {}, label));
      main.replaceChildren(
        h('div', { class:'stats' }, stat('👥', list.length, t('Students')), stat('✏️', started, I18N.lang === 'es' ? 'Empezaron' : 'Started'),
          stat('✅', ok, w('ideaOk')), stat('🔒', list.filter(r => r.turnedIn).length, w('turnedIn')), stat('📶', avg + ' / ' + STEPS.length, w('steps'))),
        h('div', { class:'ptabs' },
          h('button', { class:'tab' + (tab === 'all' ? ' on' : ''), type:'button', onclick:() => { tab = 'all'; draw(); } }, w('all')),
          ...periods.map(p => h('button', { class:'tab' + (p === tab ? ' on' : ''), type:'button', onclick:() => { tab = p; draw(); } }, w('period') + ' ' + p))),
        h('div', { class:'twrap' }, h('table', { class:'ttable' },
          h('thead', {}, h('tr', {}, h('th', {}, w('name')), tab === 'all' ? h('th', {}, w('period')) : null, h('th', {}, w('game')), h('th', {}, w('steps')),
            h('th', { title:w('approveT') }, w('ideaOk')), h('th', {}, w('turnedIn')), h('th', {}, w('lastSaved')), h('th', {}))),
          h('tbody', {}, ...list.map(r => h('tr', {},
            h('td', {}, h('b', {}, r.name), h('div', { class:'muted' }, r.username)),
            tab === 'all' ? h('td', {}, r.period) : null,
            h('td', {}, r.title || h('span', { class:'muted' }, r.updated ? '—' : w('notStarted'))),
            h('td', {}, h('div', { class:'bar', title:r.done + ' / ' + STEPS.length }, h('i', { style:{ width:Math.round(r.done / STEPS.length * 100) + '%' } }), h('span', {}, r.done + ' / ' + STEPS.length))),
            h('td', {}, h('button', { class:'btn small' + (r.approved ? ' gd-okbtn' : ''), type:'button', title:w('approveT'), onclick:async () => {
              await api('/admin/designs/' + r.username + '/approve', { method:'POST', body:JSON.stringify({ approved:!r.approved }) });
              r.approved = !r.approved; draw();
            } }, r.approved ? '✅' : '⬜')),
            h('td', {}, r.turnedIn ? h('button', { class:'btn small gd-okbtn', type:'button', title:w('giveBack'), onclick:async () => {
                if(!confirm(w('giveBack') + ': ' + r.name + '?')) return;
                await api('/admin/designs/' + r.username + '/turnin', { method:'POST', body:JSON.stringify({ on:false }) });
                r.turnedIn = false; draw();
              } }, '🔒 ' + w('giveBack')) : h('span', { class:'muted' }, '—')),
            h('td', {}, r.updated ? UI.ago(r.updated) : '—'),
            h('td', {}, r.updated ? h('a', { class:'btn small', href:'#/teacher/' + r.username, title:w('open') }, '📄 ' + w('open')) : null)))))));
    };
    draw();
  }

  route();
})();
