/* =====================================================================
   LEARN — coding games for 3rd graders, with the Code Studio logins.

   Routes (after #):
     #/              the games, plus MESA games and free coding sites
     #/l/<level>     a maze level (steps-1 … ifs-4)
     #/words         Code Words: match each word to what it means
     #/teacher       stars per student, by period (teacher only)

   Maze: tap blocks to add them where the orange bar is (tap a gap to move
   the bar), ▶ Run, and Bit acts them out. Fewer blocks = more stars.
   Block words stay English, as in Code Studio (they are the code); the
   rest is English/Español, and 🔊 reads it out loud.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const { CHAPTERS, WORDS, run, count } = LEARN;
  const app = $('#app');
  let me = null, prog = { levels:{}, words:null }, current = '';
  const L = o => o == null ? '' : typeof o === 'string' ? o : (I18N.lang === 'es' && o.es) || o.en;
  const LEVELS = CHAPTERS.flatMap(c => c.levels.map(l => ({ ...l, chapter:c })));

  const W = {
    learn:{ en:'Learn to Code', es:'Aprende a programar' }, play:{ en:'Play and learn', es:'Juega y aprende' },
    mesa:{ en:'More MESA games', es:'Más juegos MESA' }, free:{ en:'More free coding sites', es:'Más sitios gratis para programar' },
    words:{ en:'Code Words', es:'Palabras de código' }, wordsM:{ en:'Match each word to what it means', es:'Une cada palabra con lo que significa' },
    level:{ en:'Level', es:'Nivel' }, run:{ en:'Run', es:'Correr' }, reset:{ en:'Reset', es:'Reiniciar' }, clear:{ en:'Clear', es:'Borrar' },
    goal:{ en:'Get Bit to the ⭐', es:'Lleva a Bit a la ⭐' }, gems:{ en:'Pick up every 💎 on the way', es:'Recoge cada 💎 en el camino' },
    fix:{ en:'This code has a bug 🐞. Fix it!', es:'Este código tiene un error 🐞. ¡Arréglalo!' },
    blocks:{ en:'Blocks', es:'Bloques' }, max:{ en:'Use {n} blocks or fewer', es:'Usa {n} bloques o menos' },
    win:{ en:'You did it!', es:'¡Lo lograste!' }, next:{ en:'Next level', es:'Siguiente nivel' }, again:{ en:'Try again', es:'Intenta otra vez' },
    fewer:{ en:'Can you do it with {n} blocks?', es:'¿Puedes hacerlo con {n} bloques?' },
    crash:{ en:'Bonk! Bit hit a wall.', es:'¡Pum! Bit chocó con una pared.' },
    short:{ en:'Bit did not get to the ⭐ yet.', es:'Bit aún no llegó a la ⭐.' },
    loop:{ en:'Bit is stuck in a loop that never ends.', es:'Bit está atrapado en un bucle sin fin.' },
    gemsLeft:{ en:'Pick up all the 💎 first!', es:'¡Primero recoge todos los 💎!' },
    empty:{ en:'Tap a block to add it', es:'Toca un bloque para añadirlo' }, here:{ en:'next block goes here', es:'el siguiente bloque va aquí' },
    inside:{ en:'inside', es:'adentro' }, home:{ en:'All games', es:'Todos los juegos' }, done:{ en:'All done!', es:'¡Todo listo!' },
    chapterDone:{ en:'You finished {c}!', es:'¡Terminaste {c}!' }, time:{ en:'Time', es:'Tiempo' }, mistakes:{ en:'Mistakes', es:'Errores' },
    best:{ en:'Best', es:'Mejor' }, playAgain:{ en:'Play again', es:'Jugar otra vez' }, slow:{ en:'Slow', es:'Lento' }, fast:{ en:'Fast', es:'Rápido' },
    teacher:{ en:'Learn progress', es:'Progreso' }, all:{ en:'All', es:'Todos' }, period:{ en:'Period', es:'Período' }, name:{ en:'Name', es:'Nombre' },
    stars:{ en:'Stars', es:'Estrellas' }, last:{ en:'Last played', es:'Último juego' }, studio:{ en:'Code Studio', es:'Code Studio' },
    design:{ en:'Game design', es:'Diseño de juego' }, open:{ en:'Open', es:'Abrir' }, hint:{ en:'Hint', es:'Pista' },
    listen:{ en:'Listen', es:'Escuchar' }, newTab:{ en:'opens in a new tab', es:'se abre en otra pestaña' }
  };
  const w = (k, v) => { let s = L(W[k]); if(v) s = s.replace(/\{(\w+)\}/g, (m, x) => v[x]); return s; };
  const HINTS = {
    steps:{ en:'Count the squares. Turn when the path turns.', es:'Cuenta los cuadros. Gira cuando el camino gira.' },
    loops:{ en:'Find the steps that repeat. Put them inside "repeat".', es:'Busca los pasos que se repiten. Ponlos dentro de "repeat".' },
    bugs:{ en:'Press Run and watch. Where does Bit go wrong?', es:'Presiona Correr y mira. ¿Dónde se equivoca Bit?' },
    ifs:{ en:'Bit checks before each move. What should Bit do IF there is a wall?', es:'Bit revisa antes de moverse. ¿Qué debe hacer Bit SI hay una pared?' }
  };

  /* the blocks: words are code (English); Spanish meaning shown under them in ES */
  const BLOCKS = {
    move:{ txt:'move forward', es:'avanzar', cls:'motion', icon:'⬆' },
    left:{ txt:'turn left ↺', es:'girar a la izquierda', cls:'motion', icon:'↺' },
    right:{ txt:'turn right ↻', es:'girar a la derecha', cls:'motion', icon:'↻' },
    pick:{ txt:'pick up 💎', es:'recoger 💎', cls:'looks', icon:'💎' },
    repeat:{ txt:'repeat', es:'repetir', cls:'control', icon:'🔁', c:true },
    until:{ txt:'repeat until ⭐', es:'repetir hasta ⭐', cls:'control', icon:'🔁', c:true },
    if:{ txt:'if', es:'si', cls:'control', icon:'🔀', c:true }
  };
  const CONDS = { wall:'wall ahead', pathL:'path to the left', pathR:'path to the right', gem:'💎 here' };
  const CONDS_ES = { wall:'pared enfrente', pathL:'camino a la izquierda', pathR:'camino a la derecha', gem:'💎 aquí' };

  const MESA = [
    { icon:'🐞', name:'Bug Squad', d:{ en:'Find and fix bugs in 6 arcade games', es:'Encuentra y arregla errores en 6 juegos' }, url:'https://bug-squad-6gxr.onrender.com' },
    { icon:'🕹', name:'Arcade Cabinet', d:{ en:'10 classic games made of blocks', es:'10 juegos clásicos hechos con bloques' }, url:'https://arcade-blocks.onrender.com' },
    { icon:'🦖', name:'Dino Run', d:{ en:'Code a jumping dino', es:'Programa un dino que salta' }, url:'https://dino-run-sepia.vercel.app' },
    { icon:'🏓', name:'Pong', d:{ en:'Code the first video game', es:'Programa el primer videojuego' }, url:'https://pong-three-delta.vercel.app' },
    { icon:'☄️', name:'Asteroid Dodge', d:{ en:'Dodge rocks with code', es:'Esquiva rocas con código' }, url:'https://asteroid-dodge-nu.vercel.app' },
    { icon:'🏫', name:'MESA CS 0.2', d:{ en:'All the class lessons', es:'Todas las lecciones de la clase' }, url:'https://mesacs-0-2.onrender.com' }
  ];
  const FREE = [
    { icon:'🧩', name:'Blockly Games', d:{ en:'Maze, bird, turtle puzzles', es:'Laberinto, pájaro, tortuga' }, url:'https://blockly.games' },
    { icon:'🌍', name:'Code.org', d:{ en:'Hour of Code games', es:'Juegos de la Hora del Código' }, url:'https://code.org/learn' },
    { icon:'😺', name:'Scratch', d:{ en:'Make anything with blocks', es:'Haz lo que quieras con bloques' }, url:'https://scratch.mit.edu' },
    { icon:'💡', name:'Lightbot', d:{ en:'Program a robot to light tiles', es:'Programa un robot que enciende cuadros' }, url:'https://lightbot.com' },
    { icon:'⚔️', name:'CodeCombat', d:{ en:'Code your hero through levels', es:'Programa a tu héroe por niveles' }, url:'https://codecombat.com' }
  ];

  /* ---------------------------------------------------------------- api */
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    if(r.status === 401 && path !== '/login'){ if(me){ me = null; current = ''; route(); } throw Object.assign(new Error('login'), { status:401 }); }
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status });
    return j;
  }
  const localKey = () => 'learn-' + (me && me.username);
  async function loadProgress(){
    try { const r = await api('/learn'); prog = r.data || { levels:{}, words:null }; } catch(e){ if(e.status === 401) throw e; }
    try {                                                     // anything won while offline
      const local = JSON.parse(localStorage.getItem(localKey()) || 'null');
      if(local){ await saveProgress(local); localStorage.removeItem(localKey()); }
    } catch(e){}
    prog.levels = prog.levels || {};
  }
  async function saveProgress(add){
    try { const r = await api('/learn', { method:'PUT', body:JSON.stringify({ data:add }) }); prog = r.data; }
    catch(e){
      try {                                                   // keep it here and send it next time
        const local = JSON.parse(localStorage.getItem(localKey()) || '{"levels":{}}');
        Object.assign(local.levels, add.levels || {}); if(add.words) local.words = add.words;
        localStorage.setItem(localKey(), JSON.stringify(local));
      } catch(x){}
    }
  }
  const starsOf = id => (prog.levels[id] || {}).stars || 0;

  /* ------------------------------------------------------- read aloud */
  function speak(text){
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/[⭐💎🐞↺↻⬆]/g, ' '));
      u.lang = I18N.lang === 'es' ? 'es-US' : 'en-US'; u.rate = 0.9; speechSynthesis.speak(u); } catch(e){}
  }
  const ear = text => h('button', { class:'ln-ear', type:'button', title:w('listen'), 'aria-label':w('listen'), onclick:e => { e.stopPropagation(); speak(typeof text === 'function' ? text() : text); } }, '🔊');

  /* -------------------------------------------------------------- chrome */
  const langBtn = () => h('button', { class:'btn ghost lang', type:'button', title:'English / Español', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); route(true); } }, I18N.lang === 'es' ? 'EN' : 'ES');
  function topbar(extra){
    return h('header', { class:'top ln-top' },
      h('a', { class:'logo', href:'#/' }, h('span', { class:'logo-mark' }, '🎮'), h('span', {}, w('learn'))),
      h('span', { class:'grow' }), ...(extra || []),
      h('a', { class:'btn ghost', href:'/#/' }, '◆ ', h('span', { class:'lbl' }, w('studio'))),
      h('a', { class:'btn ghost', href:'/design' }, '🎨 ', h('span', { class:'lbl' }, w('design'))),
      me.role === 'teacher' ? h('a', { class:'btn ghost', href:'#/teacher' }, '🍎 ', h('span', { class:'lbl' }, w('teacher'))) : null,
      langBtn(), h('span', { class:'who' }, '👤 ' + me.name),
      h('button', { class:'btn ghost', type:'button', onclick:async () => { await fetch('/api/logout', { method:'POST' }).catch(() => {}); me = null; location.hash = '#/'; route(true); } }, t('Log out')));
  }

  /* ------------------------------------------------------------ routing */
  async function route(force){
    const hash = location.hash || '#/';
    if(hash === current && !force) return;
    current = hash; stopRun();
    try { speechSynthesis.cancel(); } catch(e){}
    if(!me){ try { me = await api('/me'); } catch(e){ me = null; } if(me) try { await loadProgress(); } catch(e){} }
    if(!me) return loginView();
    const lm = hash.match(/^#\/l\/([a-z]+-\d+)$/);
    if(lm && LEVELS.find(l => l.id === lm[1])) return levelView(lm[1]);
    if(hash === '#/words') return wordsView();
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
      h('div', { class:'login-top' }, h('span', { class:'logo' }, h('span', { class:'logo-mark' }, '🎮'), h('span', {}, w('learn'))), langBtn()),
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
  function stars(n, of=3){ return h('span', { class:'ln-stars', 'aria-label':n + ' / ' + of }, '★'.repeat(n), h('i', {}, '★'.repeat(Math.max(0, of - n)))); }
  function homeView(){
    document.body.className = 'v-learn';
    const linkCard = it => h('a', { class:'ln-link', href:it.url, target:'_blank', rel:'noopener', title:w('newTab') },
      h('span', { class:'ln-link-ico' }, it.icon), h('div', {}, h('b', {}, it.name), h('small', {}, L(it.d))), h('span', { class:'ln-out' }, '↗'));
    const chapterCard = c => {
      const got = c.levels.reduce((n, l) => n + starsOf(l.id), 0), done = c.levels.filter(l => starsOf(l.id)).length;
      const next = c.levels.find(l => !starsOf(l.id)) || c.levels[0];
      return h('div', { class:'ln-card' },
        h('a', { class:'ln-card-top', href:'#/l/' + next.id }, h('span', { class:'ln-card-ico' }, c.icon),
          h('div', {}, h('b', {}, L(c.title)), h('small', {}, '🧠 ' + L(c.word))), h('span', { class:'ln-card-go' }, '▶')),
        h('div', { class:'ln-dots' }, ...c.levels.map((l, i) => h('a', { class:'ln-dot' + (starsOf(l.id) ? ' done' : ''), href:'#/l/' + l.id, title:w('level') + ' ' + (i + 1) },
          h('span', {}, String(i + 1)), h('small', {}, starsOf(l.id) ? '★'.repeat(starsOf(l.id)) : '')))),
        h('div', { class:'ln-card-foot' }, stars(Math.round(got / c.levels.length), 3), h('small', {}, done + ' / ' + c.levels.length)));
    };
    const wb = prog.words;
    app.replaceChildren(topbar(), h('main', { class:'ln-main' },
      h('h2', { class:'ln-h' }, '🎮 ' + w('play')),
      h('div', { class:'ln-grid' }, ...CHAPTERS.map(chapterCard),
        h('div', { class:'ln-card' }, h('a', { class:'ln-card-top', href:'#/words' }, h('span', { class:'ln-card-ico' }, '🧠'),
          h('div', {}, h('b', {}, w('words')), h('small', {}, w('wordsM'))), h('span', { class:'ln-card-go' }, '▶')),
          h('div', { class:'ln-card-foot' }, wb ? h('small', {}, '🏆 ' + w('best') + ': ' + wb.secs + 's') : h('small', {}, ' ')))),
      h('h2', { class:'ln-h' }, '🏫 ' + w('mesa')), h('div', { class:'ln-links' }, ...MESA.map(linkCard)),
      h('h2', { class:'ln-h' }, '🌐 ' + w('free')), h('div', { class:'ln-links' }, ...FREE.map(linkCard))));
  }

  /* ------------------------------------------------------------ a level */
  let program = [], cursor = null, runTimer = null, speed = 380, seq = 0;
  const uid = () => 'b' + (++seq);
  const clone = list => list.map(b => ({ ...b, id:uid(), body:b.body ? clone(b.body) : undefined }));
  function stopRun(){ clearTimeout(runTimer); runTimer = null; }

  function levelView(id){
    document.body.className = 'v-learn';
    const lv = LEVELS.find(l => l.id === id), ch = lv.chapter, i = ch.levels.findIndex(l => l.id === id);
    program = lv.start ? clone(lv.start) : [];
    cursor = { list:program, at:program.length };
    const maze = LEARN.parse(lv.maze);
    const cell = Math.max(34, Math.min(64, Math.floor(460 / Math.max(maze.w, maze.h))));

    /* the board */
    const board = h('div', { class:'ln-board', style:{ gridTemplateColumns:`repeat(${maze.w}, ${cell}px)`, gridAutoRows:cell + 'px' } });
    const cells = {};
    lv.maze.forEach((r, y) => [...r].forEach((chx, x) => {
      const k = x + ',' + y;
      const c = h('div', { class:'ln-cell ' + (chx === '#' ? 'wall' : 'path') }, chx === 'G' ? h('span', { class:'ln-goal' }, '⭐') : '');
      cells[k] = c; board.append(c);
    }));
    const gemEls = {};
    const bit = h('div', { class:'ln-bit', style:{ width:cell + 'px', height:cell + 'px' } },
      h('img', { src:LIBRARY.picURL('bit-b'), alt:'Bit' }), h('span', { class:'ln-arrow' }, '➤'));
    board.append(bit);
    const place = f => {
      bit.style.transform = `translate(${f.x * cell}px, ${f.y * cell}px)`;
      bit.querySelector('.ln-arrow').style.transform = `rotate(${{ E:0, S:90, W:180, N:270 }[f.dir]}deg)`;
      for(const k of maze.gems){
        if(!gemEls[k]){ gemEls[k] = h('span', { class:'ln-gem' }, '💎'); cells[k].append(gemEls[k]); }
        gemEls[k].classList.toggle('hidden', !f.gems.includes(k));
      }
    };
    const start = { x:maze.start.x, y:maze.start.y, dir:maze.start.dir, gems:[...maze.gems] };
    place(start);

    /* the program */
    const progEl = h('div', { class:'ln-prog' });
    const counter = h('div', { class:'ln-count' });
    const palette = h('div', { class:'ln-palette' });
    const msg = h('div', { class:'ln-msg', role:'status' });
    const total = () => count(program);
    const full = () => lv.max && total() >= lv.max;
    function drawPalette(){
      palette.replaceChildren(...lv.blocks.map(op => {
        const B = BLOCKS[op];
        return h('button', { class:'ln-pblock ' + B.cls, type:'button', disabled:full(), onclick:() => add(op) },
          h('span', { class:'ln-picon' }, B.icon), h('span', {}, h('b', {}, B.txt), I18N.lang === 'es' ? h('small', {}, B.es) : null));
      }));
      counter.replaceChildren(w('blocks') + ': ', h('b', {}, String(total())), lv.max ? ' / ' + lv.max : '');
      counter.classList.toggle('full', !!full());
    }
    function add(op){
      if(full()) return;
      const b = { op, id:uid() };
      if(op === 'repeat'){ b.n = 3; b.body = []; }
      if(op === 'until') b.body = [];
      if(op === 'if'){ b.cond = lv.id === 'ifs-3' ? 'gem' : 'wall'; b.body = []; }
      cursor.list.splice(cursor.at, 0, b);
      cursor = b.body ? { list:b.body, at:0 } : { list:cursor.list, at:cursor.at + 1 };
      changed();
    }
    function remove(list, idx){
      const b = list[idx];
      list.splice(idx, 1, ...(b.body || []));                 // a loop's insides stay where they were
      cursor = { list, at:idx + (b.body ? b.body.length : 0) };
      changed();
    }
    function changed(){ reset(); drawProgram(); drawPalette(); }
    const gap = (list, at) => {
      const on = cursor.list === list && cursor.at === at;
      return h('button', { class:'ln-gap' + (on ? ' on' : ''), type:'button', title:w('here'), onclick:() => { cursor = { list, at }; drawProgram(); } },
        on ? h('span', {}, '▸ ' + w('here')) : '');
    };
    function lines(list, depth){
      const out = [gap(list, 0)];
      list.forEach((b, idx) => {
        const B = BLOCKS[b.op];
        const row = h('div', { class:'ln-line ' + B.cls, 'data-id':b.id, style:{ marginLeft:(depth * 18) + 'px' } },
          h('span', { class:'ln-licon' }, B.icon), h('b', {}, B.txt));
        if(b.op === 'repeat'){
          const sel = h('select', { class:'ln-sel' }, ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => h('option', { value:n }, String(n))));
          sel.value = b.n; sel.onchange = () => { b.n = Number(sel.value); reset(); };
          row.append(sel, h('b', {}, 'times'));
        }
        if(b.op === 'if'){
          const sel = h('select', { class:'ln-sel' }, ...Object.entries(CONDS).map(([k, v]) => h('option', { value:k }, v + (I18N.lang === 'es' ? ' · ' + CONDS_ES[k] : ''))));
          sel.value = b.cond; sel.onchange = () => { b.cond = sel.value; reset(); };
          row.append(sel, h('b', {}, 'then'));
        }
        if(I18N.lang === 'es') row.append(h('small', { class:'ln-es' }, B.es));
        row.append(h('span', { class:'grow' }), h('button', { class:'ln-x', type:'button', title:t('Delete'), onclick:() => remove(list, idx) }, '✕'));
        out.push(row);
        if(b.body){
          const inner = h('div', { class:'ln-body', style:{ marginLeft:(depth * 18 + 14) + 'px' } }, ...lines(b.body, 0));
          out.push(inner);
        }
        out.push(gap(list, idx + 1));
      });
      return out;
    }
    function drawProgram(){
      progEl.replaceChildren(...lines(program, 0));
      if(!program.length) progEl.append(h('div', { class:'ln-empty' }, '👆 ' + w('empty')));
    }

    /* running */
    let lastResult = null;
    function reset(){ stopRun(); place(start); bit.classList.remove('bump', 'happy'); msg.replaceChildren(); clearHi(); lastResult = null; runBtn.disabled = false; }
    const clearHi = () => progEl.querySelectorAll('.hi').forEach(e => e.classList.remove('hi'));
    function go(){
      reset(); runBtn.disabled = true;
      const r = run(lv, program);
      let k = 1;
      const step = () => {
        if(k >= r.frames.length) return finish(r.result);
        const f = r.frames[k++];
        clearHi(); if(f.id){ const el = progEl.querySelector(`[data-id="${f.id}"]`); if(el) el.classList.add('hi'); }
        if(f.act === 'bump'){ bit.classList.add('bump'); return finish(r.result); }
        place(f);
        runTimer = setTimeout(step, f.act === 'check' ? speed / 2 : speed);
      };
      runTimer = setTimeout(step, 150);
    }
    function finish(result){
      runTimer = null; runBtn.disabled = false; lastResult = result;
      if(result === 'win'){
        bit.classList.add('happy');
        const n = lv.fix ? 3 : total() <= lv.best ? 3 : total() <= lv.best + 2 ? 2 : 1;
        if(n > starsOf(lv.id)) prog.levels[lv.id] = { stars:n };
        saveProgress({ levels:{ [lv.id]:{ stars:n } } });
        const nextLv = ch.levels[i + 1];
        const lastOfChapter = !nextLv;
        const nextChapter = lastOfChapter ? CHAPTERS[CHAPTERS.indexOf(ch) + 1] : null;
        msg.replaceChildren(h('div', { class:'ln-win' },
          h('div', { class:'ln-win-stars' }, stars(n)), h('b', {}, '🎉 ' + (lastOfChapter ? w('chapterDone', { c:L(ch.title) }) : w('win'))),
          n < 3 ? h('div', { class:'ln-tip' }, '💡 ' + w('fewer', { n:lv.best })) : null,
          h('div', { class:'ln-win-btns' },
            n < 3 ? h('button', { class:'btn', type:'button', onclick:reset }, '↺ ' + w('again')) : null,
            nextLv ? h('a', { class:'btn primary big', href:'#/l/' + nextLv.id }, w('next') + ' ▶')
                   : nextChapter ? h('a', { class:'btn primary big', href:'#/l/' + nextChapter.levels[0].id }, nextChapter.icon + ' ' + L(nextChapter.title) + ' ▶')
                   : h('a', { class:'btn primary big', href:'#/words' }, '🧠 ' + w('words') + ' ▶'))));
      } else {
        const why = { crash:'crash', short:'short', loop:'loop', gems:'gemsLeft' }[result];
        msg.replaceChildren(h('div', { class:'ln-fail' }, h('b', {}, '🤔 ' + w(why)), ear(w(why)),
          h('button', { class:'btn', type:'button', onclick:reset }, '↺ ' + w('reset'))));
        speak(w(why));
      }
    }

    const runBtn = h('button', { class:'btn primary big ln-run', type:'button', onclick:go }, '▶ ' + w('run'));
    const speedBtn = h('button', { class:'btn small', type:'button', onclick:() => { speed = speed > 300 ? 180 : 380; speedBtn.textContent = speed > 300 ? '🐢 ' + w('slow') : '🐇 ' + w('fast'); } },
      speed > 300 ? '🐢 ' + w('slow') : '🐇 ' + w('fast'));
    const goalText = () => (lv.fix ? w('fix') + ' ' : '') + w('goal') + (maze.gems.size ? '. ' + w('gems') : '') + (lv.max ? '. ' + w('max', { n:lv.max }) : '');
    const firstOfChapter = i === 0;
    const hintBox = h('div', { class:'ln-hint hidden' }, '💡 ' + L(HINTS[ch.id]), ear(L(HINTS[ch.id])));

    app.replaceChildren(topbar(), h('main', { class:'ln-play' },
      h('div', { class:'ln-crumbs' }, h('a', { class:'btn small', href:'#/' }, '◀ ' + w('home')),
        h('b', {}, ch.icon + ' ' + L(ch.title)),
        h('div', { class:'ln-lvls' }, ...ch.levels.map((l, j) => h('a', { class:'ln-lvl' + (l.id === lv.id ? ' on' : '') + (starsOf(l.id) ? ' done' : ''), href:'#/l/' + l.id }, String(j + 1))))),
      h('div', { class:'ln-learn' + (firstOfChapter ? '' : ' small') }, h('span', { class:'ln-learn-tag' }, '🧠'),
        h('b', {}, L(ch.word)), h('span', {}, L(ch.means)), ear(L(ch.word) + '. ' + L(ch.means))),
      h('div', { class:'ln-goalrow' }, h('span', { class:'ln-goaltext' }, '🎯 ' + goalText()), ear(goalText),
        h('span', { class:'grow' }), h('button', { class:'btn small', type:'button', onclick:() => hintBox.classList.toggle('hidden') }, '💡 ' + w('hint'))),
      hintBox,
      h('div', { class:'ln-cols' },
        h('div', { class:'ln-left' }, h('div', { class:'ln-boardwrap' }, board),
          h('div', { class:'ln-controls' }, runBtn, h('button', { class:'btn big', type:'button', onclick:reset }, '↺ ' + w('reset')), speedBtn), msg),
        h('div', { class:'ln-right' }, palette,
          h('div', { class:'ln-progwrap' }, h('div', { class:'ln-proghead' }, h('b', {}, '🚩 when ▶ Run'), counter,
            h('button', { class:'btn small', type:'button', onclick:() => { program.length = 0; cursor = { list:program, at:0 }; changed(); } }, '🗑 ' + w('clear'))), progEl)))));
    drawProgram(); drawPalette();
  }

  /* ---------------------------------------------------------- Code Words */
  function wordsView(){
    document.body.className = 'v-learn';
    const pick = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 6);
    const means = [...pick].sort(() => Math.random() - 0.5);
    let sel = null, matched = new Set(), mistakes = 0, t0 = Date.now(), tick = null;
    const clock = h('b', {}, '0s');
    const left = h('div', { class:'ln-wcol' }), right = h('div', { class:'ln-wcol' }), result = h('div', { class:'ln-msg' });
    const draw = () => {
      left.replaceChildren(...pick.map(it => h('button', { class:'ln-word' + (sel === it.k ? ' on' : '') + (matched.has(it.k) ? ' ok' : ''), type:'button', disabled:matched.has(it.k),
        onclick:() => { sel = it.k; speak(L(it.w)); draw(); } }, h('span', { class:'ln-wicon' }, it.icon), h('b', {}, L(it.w)))));
      right.replaceChildren(...means.map(it => {
        const b = h('button', { class:'ln-mean' + (matched.has(it.k) ? ' ok' : ''), type:'button', disabled:matched.has(it.k), onclick:() => {
          if(!sel){ speak(L(it.m)); return; }
          if(sel === it.k){ matched.add(it.k); sel = null; draw(); if(matched.size === pick.length) done(); }
          else { mistakes++; b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 450); }
        } }, L(it.m), ear(L(it.m)));
        return b;
      }));
    };
    const done = () => {
      clearInterval(tick);
      const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      const best = prog.words && prog.words.secs;
      saveProgress({ words:{ secs, mistakes } });
      result.replaceChildren(h('div', { class:'ln-win' }, h('b', {}, '🎉 ' + w('win')),
        h('div', {}, '⏱ ' + w('time') + ': ' + secs + 's · ❌ ' + w('mistakes') + ': ' + mistakes + (best ? ' · 🏆 ' + w('best') + ': ' + Math.min(best, secs) + 's' : '')),
        h('div', { class:'ln-win-btns' }, h('button', { class:'btn primary big', type:'button', onclick:() => wordsView() }, '↺ ' + w('playAgain')),
          h('a', { class:'btn big', href:'#/' }, w('home')))));
    };
    tick = setInterval(() => { if(!document.body.contains(clock)) return clearInterval(tick); clock.textContent = Math.round((Date.now() - t0) / 1000) + 's'; }, 500);
    app.replaceChildren(topbar(), h('main', { class:'ln-play' },
      h('div', { class:'ln-crumbs' }, h('a', { class:'btn small', href:'#/' }, '◀ ' + w('home')), h('b', {}, '🧠 ' + w('words')), h('span', { class:'grow' }), h('span', {}, '⏱ '), clock),
      h('div', { class:'ln-goalrow' }, h('span', { class:'ln-goaltext' }, '👆 ' + w('wordsM')), ear(w('wordsM'))),
      h('div', { class:'ln-wgrid' }, left, right), result));
    draw();
  }

  /* --------------------------------------------------------- teacher */
  let tab = null;
  async function teacherView(){
    document.body.className = 'v-teacher v-learn';
    const main = h('main', { class:'tmain' }, h('div', { class:'loading' }, t('Loading…')));
    app.replaceChildren(topbar(), main);
    let rows = [];
    try { rows = await api('/admin/learn'); } catch(e){ return; }
    const draw = () => {
      const periods = [...new Set(rows.map(r => r.period).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric:true }));
      if(!tab || (tab !== 'all' && !periods.includes(tab))) tab = periods[0] || 'all';
      const list = rows.filter(r => !r.disabled && (tab === 'all' || r.period === tab)).sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name));
      const maxStars = LEVELS.length * 3;
      main.replaceChildren(
        h('div', { class:'ptabs' }, h('button', { class:'tab' + (tab === 'all' ? ' on' : ''), type:'button', onclick:() => { tab = 'all'; draw(); } }, w('all')),
          ...periods.map(p => h('button', { class:'tab' + (p === tab ? ' on' : ''), type:'button', onclick:() => { tab = p; draw(); } }, w('period') + ' ' + p))),
        h('div', { class:'twrap' }, h('table', { class:'ttable' },
          h('thead', {}, h('tr', {}, h('th', {}, w('name')), tab === 'all' ? h('th', {}, w('period')) : null, h('th', {}, '★ ' + w('stars')),
            ...CHAPTERS.map(c => h('th', { title:L(c.title) }, c.icon + ' ' + L(c.title))), h('th', {}, '🧠 ' + w('words')), h('th', {}, w('last')))),
          h('tbody', {}, ...list.map(r => h('tr', {},
            h('td', {}, h('b', {}, r.name), h('div', { class:'muted' }, r.username)), tab === 'all' ? h('td', {}, r.period) : null,
            h('td', {}, h('div', { class:'bar' }, h('i', { style:{ width:Math.round(r.stars / maxStars * 100) + '%' } }), h('span', {}, r.stars + ' / ' + maxStars))),
            ...CHAPTERS.map(c => h('td', { class:'num' }, ((r.byChapter || {})[c.id] || 0) + ' / ' + c.levels.length)),
            h('td', {}, r.words ? r.words.secs + 's' : '—'),
            h('td', {}, r.updated ? UI.ago(r.updated) : t('never'))))))));
    };
    draw();
  }

  route();
})();
