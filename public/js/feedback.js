/* =====================================================================
   CLASS GAMES — play a classmate's game and leave a feedback slip.

     #/class        every game in my period (a teacher picks the period)
     #/class/mine   the slips classmates left on my games
   Inside a classmate's game (read only) the Give feedback panel
   is the same slip as the paper one (questions from feedback-def.js),
   so students copy their paper slip box for box. It saves by itself.
   ===================================================================== */
window.CLASSGAMES = (function(){
  const { h } = UI;
  const L = (en, es) => I18N.lang === 'es' ? es : en;
  const F = window.FEEDBACK;
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ 'Content-Type':'application/json', ...(opts.headers || {}) } });
    const body = await r.json().catch(() => ({}));
    if(!r.ok){ const e = new Error(body.error || r.status); e.status = r.status; throw e; }
    return body;
  }

  /* ---------------------------------------------------- the game list */
  async function classView(app, me, top){
    document.body.className = 'v-projects v-class';
    const isTeacher = me.role === 'teacher';
    const list = h('div', { class:'cg-list' }, h('div', { class:'loading' }, L('Loading…', 'Cargando…')));
    const pick = isTeacher ? h('select', { class:'inp cg-period', 'aria-label':L('Period', 'Período') },
      ...['2', '3', '4', '5', '6'].map(p => h('option', { value:p }, L('Period ', 'Período ') + p))) : null;
    if(pick){ pick.value = sessionStorageGet('cg-period') || '2'; pick.onchange = () => { sessionStorageSet('cg-period', pick.value); load(); }; }
    // lock a whole period: its students can play their games but not change them
    const lockBtn = isTeacher ? h('button', { class:'btn', type:'button' }) : null;
    async function drawLock(){
      if(!lockBtn) return;
      let on = false;
      try { on = (await api('/admin/lock')).includes(pick.value); } catch(e){}
      lockBtn.textContent = on ? L('Unlock editing', 'Desbloquear edición') : L('Lock editing', 'Bloquear edición');
      lockBtn.classList.toggle('danger', !on);
      lockBtn.onclick = async () => {
        const msg = on ? L('Let period ', 'Permitir que el período ') + pick.value + L(' change their games again?', ' cambie sus juegos otra vez?')
          : L('Lock period ', '¿Bloquear el período ') + pick.value + L('? Students can still open and play their games, but cannot change them or make new ones.', '? Pueden abrir y jugar sus juegos, pero no cambiarlos ni hacer nuevos.');
        if(!(await UI.confirm(msg, on ? L('Unlock', 'Desbloquear') : L('Lock', 'Bloquear')))) return;
        await api('/admin/lock', { method:'POST', body:JSON.stringify({ period:pick.value, locked:!on }) });
        drawLock();
      };
    }
    if(pick){ const was = pick.onchange; pick.onchange = () => { was(); drawLock(); }; drawLock(); }
    app.replaceChildren(
      top(L('Class Games', 'Juegos de la clase')),
      h('main', { class:'pmain cg-main' },
        h('div', { class:'cg-intro' },
          h('p', {}, L('Pick a classmate\'s game. Play it, then fill in the feedback slip and press Submit.',
                                 'Escoge el juego de un compañero. Juégalo, luego llena la tarjeta y presiona Enviar.')),
          h('span', { class:'grow' }), pick,
          isTeacher ? h('a', { class:'btn', href:'/feedback-form.html', target:'_blank' }, L('Paper slips', 'Tarjetas de papel')) : null,
          !isTeacher ? h('a', { class:'btn primary', href:'#/class/mine' }, L('Feedback on my games', 'Comentarios sobre mis juegos')) : null,
          isTeacher ? lockBtn : null,
          isTeacher ? h('button', { class:'btn primary', type:'button', onclick:() => teacherSlips(pick.value) }, L('All slips', 'Todas las tarjetas')) : null),
        list));
    async function load(){
      let d;
      try { d = await api('/class/games' + (pick ? '?period=' + pick.value : '')); }
      catch(e){ list.replaceChildren(h('div', { class:'msg' }, L('Could not reach the server.', 'No se pudo conectar.'))); return; }
      const people = d.people.filter(u => u.projects.length);
      if(!people.length){ list.replaceChildren(h('div', { class:'hint' }, L('No games yet.', 'Todavía no hay juegos.'))); return; }
      list.replaceChildren(...people.map(u => {
        const mine = u.username === d.me;
        return h('section', { class:'cg-person' + (mine ? ' mine' : '') },
          h('h2', {}, '👤 ' + u.name + (mine ? ' — ' + L('you', 'tú') : '')),
          h('div', { class:'pgrid cg-grid' }, ...u.projects.map(p => h('a', { class:'pcard cg-card', href:'#/p/' + p.id },
            h('span', { class:'pthumb' }, p.thumb ? h('img', { src:p.thumb, alt:'' }) : h('span', { class:'pblank' }, '◆')),
            h('div', { class:'pfoot' },
              h('b', { class:'pname' }, p.name),
              h('small', {}, p.blocks + L(' blocks · ', ' bloques · ') + p.slips + L(' feedback', ' comentarios')),
              mine ? null : p.reviewed ? h('span', { class:'cg-done' }, L('✓ You gave feedback', '✓ Ya comentaste')) : null)))));
      }));
    }
    load();
  }
  function sessionStorageGet(k){ try { return sessionStorage.getItem(k); } catch(e){ return null; } }
  function sessionStorageSet(k, v){ try { sessionStorage.setItem(k, v); } catch(e){} }

  /* ------------------------------------------ slips left on my games */
  async function mineView(app, me, top){
    document.body.className = 'v-projects v-class';
    const box = h('div', { class:'cg-list' }, h('div', { class:'loading' }, L('Loading…', 'Cargando…')));
    app.replaceChildren(top(L('Feedback on my games', 'Comentarios sobre mis juegos')),
      h('main', { class:'pmain cg-main' }, h('div', { class:'cg-intro' }, h('a', { class:'btn', href:'#/class' }, '← ' + L('Class Games', 'Juegos de la clase'))), box));
    let list;
    try { list = await api('/feedback/received'); } catch(e){ box.replaceChildren(h('div', { class:'msg' }, L('Could not reach the server.', 'No se pudo conectar.'))); return; }
    if(!list.length){ box.replaceChildren(h('div', { class:'hint' }, L('No feedback yet. When classmates play your game, their slips show up here.', 'Aún no hay comentarios. Cuando tus compañeros jueguen tu juego, sus tarjetas aparecerán aquí.'))); return; }
    box.replaceChildren(h('div', { class:'cg-slips' }, ...list.map(f => slipCard(f, false))));
  }

  /* --------------------------------- every slip in a period (teacher) */
  async function teacherSlips(period){
    let list;
    try { list = await api('/admin/feedback?period=' + encodeURIComponent(period)); } catch(e){ UI.toast(e.message, 'bad'); return; }
    const body = h('div', { class:'cg-slips cg-modal' }, list.length ? list.map(f => slipCard(f, true)) : h('p', {}, L('No slips yet.', 'Aún no hay tarjetas.')));
    UI.dialog({ title:L('Feedback slips — Period ', 'Tarjetas — Período ') + period + ' (' + list.length + ')', body, wide:true, ok:L('Close', 'Cerrar'), cancel:null });
  }

  /* the slips classmates left on one of my games (the owner, from the editor) */
  // a teacher reads the slips on any game; the owner reads the ones on their own
  const slipsFor = async (projectId, teacher) => teacher
    ? api('/admin/feedback?project=' + encodeURIComponent(projectId))
    : (await api('/feedback/received')).filter(f => f.project === projectId);
  async function projectSlips(projectId, gameName, teacher){
    let list;
    try { list = await slipsFor(projectId, teacher); } catch(e){ UI.toast(e.message, 'bad'); return; }
    const body = h('div', { class:'cg-slips cg-modal' }, list.length ? list.map(f => slipCard(f, false)) : h('p', {}, L('No feedback on this game yet.', 'Aún no hay comentarios en este juego.')));
    UI.dialog({ title:L('Feedback on ', 'Comentarios sobre ') + gameName + ' (' + list.length + ')', body, wide:true, ok:L('Close', 'Cerrar'), cancel:null });
  }
  async function receivedCount(projectId, teacher){
    try { return (await slipsFor(projectId, teacher)).length; } catch(e){ return 0; }
  }

  /* one slip, read only */
  function slipCard(f, showOwner){
    const d = f.data || {};
    return h('article', { class:'cg-slip' + (f.complete ? '' : ' partial') },
      h('header', {}, h('b', {}, f.game), h('span', { class:'grow' }),
        h('small', {}, (showOwner ? L('by ', 'de ') + f.ownerName + ' · ' : '') + L('from ', 'por ') + f.reviewerName + ' · ' + UI.ago(f.updated))),
      !f.complete ? h('div', { class:'cg-partial' }, L('Not finished', 'Sin terminar')) : null,
      h('div', { class:'cg-checks' },
        ...F.checks.map(c => h('p', { class:'cg-text' }, h('b', {}, L(c.en, c.es) + ' '), (d.checks && d.checks[c.id]) || '—'))),
      h('div', { class:'cg-row' },
        h('span', {}, L('Level', 'Nivel') + ': ' + (d.level !== undefined ? d.level : '—'))),
      ...F.texts.filter(x => d.texts && d.texts[x.id]).map(x => h('p', { class:'cg-text' }, h('b', {}, L(x.en, x.es) + ': '), d.texts[x.id])));
  }

  /* ----------------------------------- the slip, beside the game */
  let panel = null, reopen = null;
  function closePanel(keepButton){
    if(panel){ panel.remove(); panel = null; document.body.classList.remove('fb-open'); }
    if(reopen && keepButton !== true){ reopen.remove(); reopen = null; }
  }
  async function openPanel(projectId, gameName, ownerName, teacher){
    if(panel){ closePanel(true); return; }
    if(reopen){ reopen.remove(); reopen = null; }
    let data = { checks:{}, ratings:{}, texts:{} };
    try { const got = await api('/feedback/' + projectId); if(got.data) data = { checks:{}, ratings:{}, texts:{}, ...got.data }; } catch(e){}
    const status = h('span', { class:'fb-status' });
    let timer = null;
    const save = () => {
      clearTimeout(timer);
      status.textContent = L('Saving…', 'Guardando…');
      timer = setTimeout(async () => {
        try { await api('/feedback/' + projectId, { method:'PUT', body:JSON.stringify({ data }) }); showDone(); }
        catch(e){ status.textContent = '⚠️ ' + L('Not saved — try again', 'No se guardó — intenta otra vez'); }
      }, 500);
    };
    const doneBox = h('div', { class:'fb-done' });
    function missingList(){
      const missing = [];
      F.checks.forEach((c, i) => { if(!data.checks[c.id]) missing.push(L('question ', 'pregunta ') + (i + 1)); });
      if(data.level === undefined) missing.push(L('the level', 'el nivel'));
      F.texts.filter(x => x.required).forEach(x => { if(!data.texts[x.id]) missing.push(L(x.en, x.es)); });
      return missing;
    }
    function showDone(){
      const missing = missingList();
      status.textContent = '✓ ' + L('Saved', 'Guardado');
      doneBox.className = 'fb-done' + (missing.length ? '' : ' ok');
      doneBox.textContent = missing.length ? L('Still to fill: ', 'Falta llenar: ') + missing.join(', ') : L('Slip finished! Thank you.', '¡Tarjeta terminada! Gracias.');
    }
    const levelBtns = [];
    function markLevel(){
      levelBtns.forEach(b => { const n = Number(b.dataset.n); b.classList.toggle('on', data.level === n);  });
    }
    const checkRows = F.checks.map(c => {
      const ta = h('textarea', { class:'inp fb-ta', rows:2, maxlength:F.CHECK_TEXT, placeholder:L('Write what you saw…', 'Escribe lo que viste…') });
      ta.value = data.checks[c.id] || '';
      ta.oninput = () => { if(ta.value.trim()) data.checks[c.id] = ta.value; else delete data.checks[c.id]; markLevel(); save(); };
      return h('label', { class:'fb-text' }, h('span', {}, (F.checks.indexOf(c) + 1) + '. ' + L(c.en, c.es), h('small', {}, ' · ' + L(c.es, c.en))), ta);
    });
    const levelRow = h('div', { class:'fb-levels' }, ...F.levels.map(lv => {
      const b = h('button', { type:'button', class:'fb-level', 'data-n':lv.n, onclick:() => { data.level = lv.n; markLevel(); save(); } },
        h('b', {}, String(lv.n)), h('small', {}, L(lv.en, lv.es)));
      levelBtns.push(b); return b;
    }));
    const textRows = F.texts.map(x => {
      const ta = h('textarea', { class:'inp fb-ta', rows:2, maxlength:F.MAX_TEXT, placeholder:x.required ? '' : L('(optional)', '(opcional)') });
      ta.value = data.texts[x.id] || '';
      ta.oninput = () => { if(ta.value.trim()) data.texts[x.id] = ta.value; else delete data.texts[x.id]; save(); };
      return h('label', { class:'fb-text' }, h('span', {}, L(x.en, x.es), h('small', {}, ' · ' + L(x.es, x.en))), ta);
    });
    panel = h('aside', { class:'fb-panel', 'aria-label':L('Feedback slip', 'Tarjeta de comentarios') },
      h('header', {}, h('b', {}, L('Feedback slip', 'Tarjeta de comentarios')), h('span', { class:'grow' }), status,
        h('button', { class:'btn small ghost', type:'button', title:L('Close', 'Cerrar'), onclick:hide }, '✕')),
      h('div', { class:'fb-body' },
        h('p', { class:'fb-who' }, h('b', {}, gameName), ' — ' + L('by ', 'de ') + ownerName),
        h('p', { class:'muted' }, L('Copy your paper slip. Play the game to check each one.', 'Copia tu tarjeta de papel. Juega para revisar cada una.')),
        h('h3', {}, '1 · ' + L('Play it and write what you saw', 'Juega y escribe lo que viste')), ...checkRows,
        h('h3', {}, '2 · ' + L('I think this game is at level…', 'Creo que este juego está en el nivel…')), levelRow,
        h('h3', {}, '3 · ' + L('Comments', 'Comentarios')), ...textRows,
        doneBox,
        h('button', { class:'btn primary fb-submit', type:'button', onclick:submit }, L('Submit feedback', 'Enviar comentarios'))));
    // the Feedback button in the top bar brings it back
    function hide(){ closePanel(); }
    async function submit(){
      clearTimeout(timer);
      try { await api('/feedback/' + projectId, { method:'PUT', body:JSON.stringify({ data }) }); }
      catch(e){ status.textContent = '⚠️ ' + L('Not saved — try again', 'No se guardó — intenta otra vez'); return; }
      showDone();
      if(missingList().length){ doneBox.scrollIntoView({ behavior:'smooth', block:'center' }); return UI.toast(doneBox.textContent, 'bad'); }
      UI.toast(L('Feedback sent to ', 'Comentarios enviados a ') + ownerName + '!');
      if(teacher) closePanel(); else location.hash = '#/class';
    }
    document.body.append(panel);
    document.body.classList.add('fb-open');
    markLevel();
    if(Object.keys(data.checks).length) showDone();
  }

  return { classView, mineView, openPanel, closePanel, projectSlips, receivedCount };
})();
