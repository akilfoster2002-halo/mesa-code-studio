/* =====================================================================
   INTRO TO HTML — seven short activities (about 30 minutes) that repeat
   the first HTML tags until they stick. Same logins as Code Studio;
   scores are kept with the Learn progress (/api/learn, key `html`).

   Routes (after #):
     #/            the seven activities, in order
     #/a/<id>      one activity (cards, type, close, match, build, fix, page)
     #/teacher     best score per activity, per student (teacher only)

   Every activity ends with a score out of 100; the best one is kept and
   "Again" plays it once more (that is the point: repetition).
   Code stays English; the rest is English/Español, and 🔊 reads it out.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const { ACTS, CARDS, TYPE, CLOSE, MATCH_WORDS, MATCH_TAGS, wrap, BUILD, FIX, PAGE_START, GOALS, score } = HTMLLESSONS;
  const app = $('#app');
  let me = null, prog = { html:{} }, current = '';
  const L = o => o == null ? '' : typeof o === 'string' ? o : (I18N.lang === 'es' && o.es) || o.en;

  const W = {
    app:{ en:'Intro to HTML', es:'Introducción a HTML' },
    what:{ en:'HTML is the code that builds every web page.', es:'HTML es el código que construye cada página web.' },
    min:{ en:'min', es:'min' }, best:{ en:'Best', es:'Mejor' }, start:{ en:'Start', es:'Empezar' },
    all:{ en:'All activities', es:'Todas las actividades' }, again:{ en:'Again', es:'Otra vez' }, next:{ en:'Next', es:'Siguiente' },
    done:{ en:'Done!', es:'¡Listo!' }, score:{ en:'Score', es:'Puntos' }, beat:{ en:'Play again to beat it!', es:'¡Juega otra vez para superarlo!' },
    flip:{ en:'Tap the card to flip it', es:'Toca la tarjeta para voltearla' }, knew:{ en:'I knew it', es:'Lo sabía' }, notYet:{ en:'Not yet', es:'Todavía no' },
    typeThis:{ en:'Type this:', es:'Escribe esto:' }, shiftLt:{ en:'< is Shift + ,   and   > is Shift + .', es:'< es Shift + ,   y   > es Shift + .' },
    makes:{ en:'It makes:', es:'Hace esto:' }, mistakes:{ en:'Mistakes', es:'Errores' },
    whichClose:{ en:'Which tag closes it?', es:'¿Qué etiqueta la cierra?' },
    whichCode:{ en:'Which code made this?', es:'¿Qué código hizo esto?' },
    makeThis:{ en:'Make this page', es:'Haz esta página' }, tapNext:{ en:'Tap the next line', es:'Toca la siguiente línea' },
    noBug:{ en:'Which one has no bug?', es:'¿Cuál no tiene error?' },
    yourCode:{ en:'Your code', es:'Tu código' }, yourPage:{ en:'Your page', es:'Tu página' }, try:{ en:'Try to add:', es:'Intenta añadir:' },
    pictures:{ en:'Pictures', es:'Imágenes' }, finish:{ en:'I am done', es:'Terminé' }, reset:{ en:'Start over', es:'Empezar de nuevo' },
    sure:{ en:'Erase your page and start over?', es:'¿Borrar tu página y empezar de nuevo?' },
    teacher:{ en:'HTML progress', es:'Progreso HTML' }, allP:{ en:'All', es:'Todos' }, period:{ en:'Period', es:'Período' }, name:{ en:'Name', es:'Nombre' },
    listen:{ en:'Listen', es:'Escuchar' }
  };
  const w = k => L(W[k]);

  /* ---------------------------------------------------------------- api */
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    if(r.status === 401 && path !== '/login'){ if(me){ me = null; current = ''; route(); } throw Object.assign(new Error('login'), { status:401 }); }
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status });
    return j;
  }
  const localKey = () => 'html-' + (me && me.username);
  async function loadProgress(){
    try { const r = await api('/learn'); prog = r.data || {}; } catch(e){ if(e.status === 401) throw e; }
    prog.html = prog.html || {};
    try {                                                     // anything done while offline
      const local = JSON.parse(localStorage.getItem(localKey()) || 'null');
      if(local){ localStorage.removeItem(localKey()); await save(local); }
    } catch(e){}
  }
  async function save(add){
    try { const r = await api('/learn', { method:'PUT', body:JSON.stringify({ data:{ html:add } }) }); prog = r.data; prog.html = prog.html || {}; }
    catch(e){
      try {                                                   // keep it here and send it next time
        const local = JSON.parse(localStorage.getItem(localKey()) || '{"acts":{}}');
        for(const [id, v] of Object.entries(add.acts || {})) local.acts[id] = { best:Math.max(v.best, (local.acts[id] || {}).best || 0) };
        if(add.page != null) local.page = add.page;
        localStorage.setItem(localKey(), JSON.stringify(local));
        Object.assign(prog.html, { acts:{ ...(prog.html.acts || {}), ...add.acts } }, add.page != null ? { page:add.page } : {});
      } catch(x){}
    }
  }
  const bestOf = id => ((prog.html.acts || {})[id] || {}).best || 0;
  const playedOf = id => !!(prog.html.acts || {})[id];

  /* ------------------------------------------------------- read aloud */
  function speak(text){
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/[<>/]/g, ' '));
      u.lang = I18N.lang === 'es' ? 'es-US' : 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); } catch(e){}
  }
  const ear = text => h('button', { class:'ln-ear', type:'button', title:w('listen'), 'aria-label':w('listen'), onclick:e => { e.stopPropagation(); speak(typeof text === 'function' ? text() : text); } }, '🔊');

  /* ---------------------------------------------------------- helpers */
  const shuffle = a => { a = a.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const code = s => h('code', { class:'hx-code' }, s);
  // what a bit of HTML looks like on a page (only ever our own lines, or the student's page in a sandbox)
  const render = (html, cls) => h('div', { class:'hx-render' + (cls ? ' ' + cls : ''), html });
  const browser = (body, title) => h('div', { class:'hx-browser' },
    h('div', { class:'hx-bar' }, h('i'), h('i'), h('i'), h('span', { class:'hx-tab' }, title || '…')), body);
  // the right answer is in: no more taps until the next question
  const lock = btn => btn.parentNode.querySelectorAll('button').forEach(b => { b.disabled = true; });
  function shake(el){ el.classList.remove('hx-shake'); void el.offsetWidth; el.classList.add('hx-shake'); }
  const pct = n => h('span', { class:'hx-pct' + (n >= 90 ? ' gold' : n >= 70 ? ' ok' : '') }, n + '%');
  function stars(n){ const s = n >= 90 ? 3 : n >= 70 ? 2 : n > 0 ? 1 : 0; return h('span', { class:'ln-stars' }, '★'.repeat(s), h('i', {}, '★'.repeat(3 - s))); }

  /* -------------------------------------------------------------- chrome */
  const langBtn = () => h('button', { class:'btn ghost lang', type:'button', title:'English / Español', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); route(true); } }, I18N.lang === 'es' ? 'EN' : 'ES');
  const logo = () => h('a', { class:'logo', href:'#/' }, h('span', { class:'logo-mark' }, '</>'), h('span', {}, w('app')));
  function topbar(){
    return h('header', { class:'top hx-top' }, logo(), SITENAV.bar('html'), h('span', { class:'grow' }),
      me.role === 'teacher' ? h('a', { class:'btn ghost', href:'#/teacher' }, '🍎 ', h('span', { class:'lbl' }, w('teacher'))) : null,
      langBtn(), h('span', { class:'who' }, '👤 ' + me.name),
      h('button', { class:'btn ghost', type:'button', onclick:async () => { await fetch('/api/logout', { method:'POST' }).catch(() => {}); me = null; location.hash = '#/'; route(true); } }, t('Log out')));
  }
  // one activity's screen: a crumb row (back, name, how far), then its body
  function shell(act, body){
    const count = h('span', { class:'hx-count' });
    const bar = h('div', { class:'hx-progress' }, h('i'));
    const main = h('main', { class:'hx-play' },
      h('div', { class:'hx-crumbs' }, h('a', { class:'btn', href:'#/' }, '◀ ', h('span', { class:'lbl2' }, w('all'))),
        h('b', {}, act.icon + ' ' + L(act.title)), h('span', { class:'grow' }), count), bar, body);
    app.replaceChildren(topbar(), main);
    return { main, step:(n, of) => { count.textContent = Math.min(n + 1, of) + ' / ' + of; bar.firstChild.style.width = (100 * n / of) + '%'; },
      done:() => { count.textContent = '✓'; bar.firstChild.style.width = '100%'; } };
  }
  // the end of an activity: the score, then Again / Next
  async function finish(act, sc, s){
    const before = bestOf(act.id);
    await save({ acts:{ [act.id]:{ best:sc } } });
    s.done();
    const i = ACTS.indexOf(act), nxt = ACTS[i + 1];
    s.main.lastChild.replaceWith(h('div', { class:'hx-end' },
      h('div', { class:'hx-end-ico' }, sc >= 90 ? '🏆' : sc >= 70 ? '🎉' : '👍'),
      h('b', { class:'hx-end-t' }, w('done')), stars(sc), h('div', { class:'hx-end-s' }, w('score') + ': ', pct(sc)),
      before ? h('small', {}, w('best') + ': ' + Math.max(before, sc) + '%') : null,
      sc < 100 ? h('small', {}, w('beat')) : null,
      h('div', { class:'hx-end-btns' },
        h('button', { class:'btn big', type:'button', onclick:() => route(true) }, '↻ ' + w('again')),
        nxt ? h('a', { class:'btn primary big', href:'#/a/' + nxt.id }, nxt.icon + ' ' + w('next') + ' ▶') : h('a', { class:'btn primary big', href:'#/' }, '🏠 ' + w('all')))));
  }

  /* ------------------------------------------------------------ routing */
  async function route(force){
    const hash = location.hash || '#/';
    if(hash === current && !force) return;
    current = hash;
    try { speechSynthesis.cancel(); } catch(e){}
    if(!me){ try { me = await api('/me'); } catch(e){ me = null; } if(me) try { await loadProgress(); } catch(e){} }
    if(!me) return loginView();
    document.body.className = 'v-html';
    const am = hash.match(/^#\/a\/([a-z]+)$/);
    const act = am && ACTS.find(a => a.id === am[1]);
    if(act) return VIEWS[act.id](act);
    if(hash === '#/teacher' && me.role === 'teacher') return teacherView();
    return homeView();
  }
  addEventListener('hashchange', () => route());

  function loginView(){
    document.body.className = 'v-login';
    const user = h('input', { class:'inp', autocomplete:'username', autocapitalize:'none', spellcheck:'false', required:true });
    const pass = h('input', { class:'inp', type:'password', autocomplete:'current-password', autocapitalize:'none', required:true });
    const msg = h('div', { class:'msg', role:'alert' });
    const btn = h('button', { class:'btn primary big', type:'submit' }, t('Log in'));
    const form = h('form', { class:'login-card' },
      h('div', { class:'login-top' }, h('span', { class:'logo' }, h('span', { class:'logo-mark' }, '</>'), h('span', {}, w('app'))), langBtn()),
      h('div', { class:'login-art' }, h('img', { src:LIBRARY.picURL('bit-b'), alt:'' })),
      h('label', {}, h('span', {}, '👤 ' + t('Username')), user),
      h('label', {}, h('span', {}, '🔑 ' + t('Password')), pass), msg, btn);
    form.onsubmit = async e => {
      e.preventDefault(); btn.disabled = true; msg.textContent = '';
      try {
        me = await api('/login', { method:'POST', body:JSON.stringify({ username:user.value.trim().toLowerCase(), password:pass.value.trim() }) });
        await loadProgress(); current = ''; route(true);
      } catch(err){
        msg.textContent = err.status === 401 ? t('Wrong username or password.') : err.status === 429 ? t('Too many tries. Wait a few minutes.') : t('Could not reach the server.');
        btn.disabled = false; pass.select();
      }
    };
    app.replaceChildren(h('div', { class:'login-page' }, form)); user.focus();
  }

  /* ---------------------------------------------------------------- home */
  function homeView(){
    const next = ACTS.find(a => !playedOf(a.id));
    const total = ACTS.reduce((n, a) => n + a.min, 0), doneN = ACTS.filter(a => playedOf(a.id)).length;
    app.replaceChildren(topbar(), h('main', { class:'hx-main' },
      h('div', { class:'hx-hero' }, h('span', { class:'hx-hero-tag' }, '</>'),
        h('div', {}, h('b', {}, w('what')), h('small', {}, '⏱ ' + total + ' ' + w('min') + ' · ' + doneN + ' / ' + ACTS.length + ' ✓')), ear(w('what'))),
      h('div', { class:'hx-path' }, ...ACTS.map((a, i) => {
        const b = bestOf(a.id), played = playedOf(a.id);
        return h('a', { class:'hx-step' + (played ? ' done' : '') + (a === next ? ' next' : ''), href:'#/a/' + a.id },
          h('span', { class:'hx-num' }, played ? '✓' : String(i + 1)), h('span', { class:'hx-step-ico' }, a.icon),
          h('div', { class:'hx-step-txt' }, h('b', {}, L(a.title)), h('small', {}, L(a.line))),
          h('span', { class:'hx-step-meta' }, played ? [stars(b), h('small', {}, w('best') + ' ' + b + '%')] : h('small', {}, '⏱ ' + a.min + ' ' + w('min'))),
          h('span', { class:'ln-card-go' }, '▶'));
      }))));
  }

  /* ------------------------------------------------------- flash cards
     Tap to flip. "Not yet" sends the card to the back of the deck, so
     every card comes round until it is known. Score: known the first time. */
  function cardsView(act){
    const deck = shuffle(CARDS), missed = new Set();
    let known = 0;
    const box = h('div', { class:'hx-stage' });
    const s = shell(act, box);
    function draw(){
      s.step(known, CARDS.length);
      if(!deck.length) return finish(act, score(CARDS.length - missed.size, CARDS.length), s);
      const c = deck[0];
      let flipped = false;
      const back = h('div', { class:'hx-face hx-back' }, code(c.code), h('b', {}, L(c)), c.ex ? browser(render(c.ex)) : null);
      const card = h('button', { class:'hx-card', type:'button', onclick:() => { flipped = !flipped; card.classList.toggle('flipped', flipped); btns.hidden = !flipped; } },
        h('div', { class:'hx-face hx-front' }, code(c.code), h('small', {}, w('flip'))), back);
      const btns = h('div', { class:'hx-cardbtns', hidden:true }, ear(L(c)),
        h('button', { class:'btn big hx-no', type:'button', onclick:() => { if(deck[0] !== c) return; missed.add(c.code); deck.push(deck.shift()); draw(); } }, '↻ ' + w('notYet')),
        h('button', { class:'btn primary big', type:'button', onclick:() => { if(deck[0] !== c) return; deck.shift(); known++; draw(); } }, '✓ ' + w('knew')));
      box.replaceChildren(card, btns);
    }
    draw();
  }

  /* ----------------------------------------------------------- type it
     Type the line exactly. A wrong key does not go in (it counts as a
     mistake); the page underneath shows what the code makes as you type. */
  function typeView(act){
    let i = 0, typed = 0, mistakes = 0;
    const box = h('div', { class:'hx-stage' });
    const s = shell(act, box);
    function draw(){
      s.step(i, TYPE.length);
      if(i >= TYPE.length) return finish(act, score(typed, typed + mistakes), s);
      const target = TYPE[i];
      const chars = [...target].map(ch => h('span', {}, ch));
      const line = h('div', { class:'hx-typeline' }, ...chars);
      const out = render('');
      const miss = h('span', { class:'hx-miss' }, w('mistakes') + ': ' + mistakes);
      const inp = h('input', { class:'hx-typein', autocomplete:'off', autocapitalize:'none', autocorrect:'off', spellcheck:'false', 'aria-label':target,
        onpaste:e => e.preventDefault(), ondrop:e => e.preventDefault() });
      let ok = 0;
      inp.oninput = () => {
        const v = inp.value;
        if(!target.startsWith(v)){
          let n = 0; while(n < v.length && v[n] === target[n]) n++;
          if(v.length > ok){ mistakes++; miss.textContent = w('mistakes') + ': ' + mistakes; shake(line); }
          inp.value = v.slice(0, n);
        }
        if(inp.value.length > ok) typed += inp.value.length - ok;
        ok = inp.value.length;
        chars.forEach((c, k) => c.className = k < ok ? 'ok' : k === ok ? 'cur' : '');
        out.innerHTML = inp.value;
        if(inp.value === target){ inp.disabled = true; line.classList.add('won'); setTimeout(() => { i++; draw(); }, 900); }
      };
      chars[0].className = 'cur';
      box.replaceChildren(
        h('div', { class:'hx-label' }, w('typeThis')), line, inp,
        h('div', { class:'hx-label' }, w('makes')), browser(out),
        h('div', { class:'hx-foot' }, i < 2 ? h('small', { class:'hx-keys' }, '⌨️ ' + w('shiftLt')) : h('span'), miss));
      inp.focus();
    }
    draw();
  }

  /* ----------------------------------------------------- close the tag */
  function closeView(act){
    const rounds = shuffle(CLOSE).slice(0, 10);
    let i = 0, right = 0;
    const box = h('div', { class:'hx-stage' });
    const s = shell(act, box);
    function draw(){
      s.step(i, rounds.length);
      if(i >= rounds.length) return finish(act, score(right, rounds.length), s);
      const [tag, word] = rounds[i];
      const other = pick(['p', 'b', 'i', 'h1', 'h2', 'li', 'a'].filter(x => x !== tag));
      const opts = shuffle(['</' + tag + '>', '<' + tag + '>', '</' + other + '>', '/' + tag + '>']);
      let first = true;
      const blank = h('span', { class:'hx-blank' }, '?');
      const q = h('div', { class:'hx-q' }, code('<' + tag + '>' + word), blank);
      box.replaceChildren(h('div', { class:'hx-label' }, w('whichClose')), q,
        h('div', { class:'hx-opts' }, ...opts.map(o => h('button', { class:'hx-opt', type:'button', onclick:e => {
          if(o !== '</' + tag + '>'){ first = false; e.currentTarget.classList.add('bad'); e.currentTarget.disabled = true; shake(q); return; }
          if(first) right++;
          lock(e.currentTarget);
          blank.textContent = o; blank.classList.add('ok'); e.currentTarget.classList.add('good');
          setTimeout(() => { i++; draw(); }, 700);
        } }, o))));
    }
    draw();
  }

  /* ------------------------------------------------- what did it make? */
  function matchView(act){
    const words = shuffle(MATCH_WORDS);
    let i = 0, right = 0;
    const box = h('div', { class:'hx-stage' });
    const s = shell(act, box);
    function draw(){
      s.step(i, words.length);
      if(i >= words.length) return finish(act, score(right, words.length), s);
      const word = words[i], tags = shuffle(MATCH_TAGS).slice(0, 3), ans = pick(tags);
      let first = true;
      box.replaceChildren(h('div', { class:'hx-label' }, w('whichCode')), browser(render(wrap(ans, word), 'big')),
        h('div', { class:'hx-opts col' }, ...tags.map(tg => h('button', { class:'hx-opt', type:'button', onclick:e => {
          if(tg !== ans){ first = false; e.currentTarget.classList.add('bad'); e.currentTarget.disabled = true; return; }
          if(first) right++;
          lock(e.currentTarget);
          e.currentTarget.classList.add('good');
          setTimeout(() => { i++; draw(); }, 700);
        } }, wrap(tg, word)))));
    }
    draw();
  }

  /* ------------------------------------------------------ build a page
     Tap the lines in order; the finished page is shown, so the order can
     be worked out. A wrong tap shakes and counts as a mistake. */
  function buildView(act){
    let r = 0, placed = 0, mistakes = 0;
    const lines = BUILD.reduce((n, b) => n + b.length, 0);
    const box = h('div', { class:'hx-stage wide' });
    const s = shell(act, box);
    function draw(){
      s.step(r, BUILD.length);
      if(r >= BUILD.length) return finish(act, score(lines, lines + mistakes), s);
      const page = BUILD[r], full = page.map(l => l[1]).join('');
      const title = (full.match(/<title>(.*?)<\/title>/) || [])[1];
      let k = 0;
      const built = h('div', { class:'hx-built' });
      const pieces = h('div', { class:'hx-pieces' }, ...shuffle(page.map((l, n) => ({ l, n }))).map(({ l }) =>
        h('button', { class:'hx-piece', type:'button', onclick:e => {
          const b = e.currentTarget;
          if(l[1] !== page[k][1]){ mistakes++; shake(b); return; }
          b.remove(); k++; placed++;
          built.append(h('div', { class:'hx-bline', style:{ paddingLeft:(l[0] * 22 + 8) + 'px' } }, l[1]));
          if(k === page.length){ built.classList.add('won'); setTimeout(() => { r++; draw(); }, 1100); }
        } }, l[1])));
      box.replaceChildren(
        h('div', { class:'hx-buildcols' },
          h('div', {}, h('div', { class:'hx-label' }, w('makeThis')), browser(render(full), title)),
          h('div', {}, h('div', { class:'hx-label' }, w('tapNext')), built, pieces)));
    }
    draw();
  }

  /* ------------------------------------------------------- fix the tag */
  function fixView(act){
    const rounds = shuffle(FIX);
    let i = 0, right = 0;
    const box = h('div', { class:'hx-stage' });
    const s = shell(act, box);
    function draw(){
      s.step(i, rounds.length);
      if(i >= rounds.length) return finish(act, score(right, rounds.length), s);
      const f = rounds[i];
      let first = true;
      const why = h('div', { class:'ln-hint', hidden:true }, '💡 ', L(f.why));
      box.replaceChildren(h('div', { class:'hx-label' }, '🐞 ' + w('noBug')),
        h('div', { class:'hx-opts col' }, ...shuffle([f.good, ...f.bad]).map(o => h('button', { class:'hx-opt', type:'button', onclick:e => {
          why.hidden = false;
          if(o !== f.good){ first = false; e.currentTarget.classList.add('bad'); e.currentTarget.disabled = true; shake(e.currentTarget); return; }
          if(first) right++;
          lock(e.currentTarget);
          e.currentTarget.classList.add('good');
          setTimeout(() => { i++; draw(); }, 1300);
        } }, o))), why);
    }
    draw();
  }

  /* ----------------------------------------------------- my first page
     A code box and the page it makes, side by side. Pictures are short
     names (star.png) swapped for the Code Studio pictures when shown. */
  const PICS = { bit:'bit-b', star:'star', rocket:'rocket', heart:'heart', dino:'dino-a', cat:'cat-blob', fish:'fish', apple:'apple' };
  function pageView(act){
    const ta = h('textarea', { class:'hx-editor', spellcheck:'false', autocapitalize:'none', autocorrect:'off' });
    ta.value = prog.html.page != null ? prog.html.page : PAGE_START;
    const frame = h('iframe', { class:'hx-frame', sandbox:'', title:w('yourPage') });
    const goals = h('div', { class:'hx-goals' });
    const insert = (txt, inside) => {
      const a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      ta.value = v.slice(0, a) + txt + v.slice(b);
      const at = a + (inside != null ? inside : txt.length);
      ta.focus(); ta.setSelectionRange(at, at); update();
    };
    const snip = (label, txt, inside) => h('button', { class:'hx-snip', type:'button', onclick:() => insert(txt, inside) }, label);
    let timer = null;
    function update(){
      const src = ta.value.replace(/src="(\w+)\.png"/g, (m, n) => PICS[n] ? 'src="' + LIBRARY.picURL(PICS[n]) + '"' : m);
      frame.srcdoc = '<style>body{font-family:system-ui,sans-serif;margin:14px;color:#222}img{max-width:120px;max-height:120px}</style>' + src;
      goals.replaceChildren(...GOALS.map(g => { const ok = g.test(ta.value); return h('div', { class:'hx-goal' + (ok ? ' ok' : '') }, h('span', {}, ok ? '✓' : '○'), L(g)); }));
      clearTimeout(timer); timer = setTimeout(() => save({ page:ta.value }), 1500);
    }
    ta.oninput = update;
    ta.onkeydown = e => { if(e.key === 'Tab'){ e.preventDefault(); insert('  '); } };
    const done = () => { clearTimeout(timer); save({ page:ta.value }); finish(act, score(GOALS.filter(g => g.test(ta.value)).length, GOALS.length), s); };
    const s = shell(act, h('div', { class:'hx-pagewrap' },
      h('div', { class:'hx-snips' },
        snip('<h1>', '<h1></h1>', 4), snip('<h2>', '<h2></h2>', 4), snip('<p>', '<p></p>', 3), snip('<b>', '<b></b>', 3), snip('<i>', '<i></i>', 3),
        snip('<br>', '<br>'), snip('<ul> <li>', '<ul>\n  <li></li>\n  <li></li>\n  <li></li>\n</ul>\n', 11)),
      h('div', { class:'hx-snips pics' }, h('small', {}, '🖼 ' + w('pictures') + ':'),
        ...Object.entries(PICS).map(([n, id]) => h('button', { class:'hx-pic', type:'button', title:n + '.png', onclick:() => insert('<img src="' + n + '.png">\n') },
          h('img', { src:LIBRARY.picURL(id), alt:n })))),
      h('div', { class:'hx-pagecols' },
        h('div', {}, h('div', { class:'hx-label' }, w('yourCode')), ta),
        h('div', {}, h('div', { class:'hx-label' }, w('yourPage')), browser(frame, (ta.value.match(/<title>(.*?)<\/title>/) || [])[1]))),
      h('div', { class:'hx-label' }, w('try')), goals,
      h('div', { class:'hx-end-btns' },
        h('button', { class:'btn', type:'button', onclick:() => { if(confirm(w('sure'))){ ta.value = PAGE_START; update(); } } }, '↺ ' + w('reset')),
        h('button', { class:'btn primary big', type:'button', onclick:done }, '✓ ' + w('finish')))));
    s.step(0, 1);
    update();
  }

  const VIEWS = { cards:cardsView, type:typeView, close:closeView, match:matchView, build:buildView, fix:fixView, page:pageView };

  /* ------------------------------------------------------------ teacher */
  let tab = null;
  async function teacherView(){
    const main = h('main', { class:'hx-main' });
    app.replaceChildren(topbar(), main);
    let rows;
    try { rows = await api('/admin/learn'); } catch(e){ return; }
    const periods = [...new Set(rows.map(r => r.period).filter(Boolean))].sort();
    const draw = () => {
      if(!tab || (tab !== 'all' && !periods.includes(tab))) tab = periods[0] || 'all';
      const list = rows.filter(r => !r.disabled && (tab === 'all' || r.period === tab)).sort((a, b) => a.name.localeCompare(b.name));
      main.replaceChildren(h('h2', { class:'ln-h' }, '🍎 ' + w('teacher')),
        h('div', { class:'ptabs' }, h('button', { class:'tab' + (tab === 'all' ? ' on' : ''), type:'button', onclick:() => { tab = 'all'; draw(); } }, w('allP')),
          ...periods.map(p => h('button', { class:'tab' + (p === tab ? ' on' : ''), type:'button', onclick:() => { tab = p; draw(); } }, w('period') + ' ' + p))),
        h('div', { class:'twrap' }, h('table', { class:'ttable' },
          h('thead', {}, h('tr', {}, h('th', {}, w('name')), tab === 'all' ? h('th', {}, w('period')) : null,
            ...ACTS.map(a => h('th', { title:L(a.title) }, a.icon)))),
          h('tbody', {}, ...list.map(r => h('tr', {},
            h('td', {}, h('b', {}, r.name), h('div', { class:'muted' }, r.username)), tab === 'all' ? h('td', {}, r.period) : null,
            ...ACTS.map(a => { const v = (r.html || {})[a.id]; return h('td', {}, v ? pct(v.best) : '—'); })))))));
    };
    draw();
  }

  route();
})();
