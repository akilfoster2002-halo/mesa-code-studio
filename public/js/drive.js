/* =====================================================================
   MY DRIVE — the student's pictures (html.drive, by file name), to use in
   any page: ＋ Upload (or drop them here) keeps them; the editor's
   ☁️ My Drive puts one in a page. Below: their pages, and the pages
   classmates share with them (both can type in those at the same time).
   GET/POST /api/drive, DELETE /api/drive/:name.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const HL = window.HTMLLESSONS;
  const app = $('#app');
  const L = o => (I18N.lang === 'es' && o.es) || o.en;
  const W = {
    drive:{ en:'My Drive', es:'Mi unidad' }, back:{ en:'Classroom', es:'Clase' },
    pics:{ en:'My pictures', es:'Mis imágenes' }, picsHint:{ en:'Keep pictures here, then use them in any page with ☁️ My Drive.', es:'Guarda imágenes aquí y úsalas en cualquier página con ☁️ Mi unidad.' },
    upload:{ en:'Upload pictures', es:'Subir imágenes' }, drop:{ en:'Drop pictures here', es:'Suelta imágenes aquí' },
    uploading:{ en:'Uploading…', es:'Subiendo…' }, failed:{ en:'Not uploaded. Try again.', es:'No se subió. Inténtalo otra vez.' },
    full:{ en:'Your Drive is full (200 pictures).', es:'Tu unidad está llena (200 imágenes).' },
    del:{ en:'Delete this picture from your Drive? Pages that use it keep their copy.', es:'¿Borrar esta imagen de tu unidad? Las páginas que la usan guardan su copia.' },
    mine:{ en:'My pages', es:'Mis páginas' }, shared:{ en:'Shared with me', es:'Compartido conmigo' },
    sharedHint:{ en:'You can type in these too, at the same time as your classmates.', es:'También puedes escribir en estas, al mismo tiempo que tus compañeros.' },
    noShared:{ en:'Nothing shared with you yet.', es:'Todavía no hay nada compartido contigo.' },
    notStarted:{ en:'not started', es:'sin empezar' }, turnedIn:{ en:'turned in', es:'entregado' }, sharedWith:{ en:'shared with', es:'compartido con' },
    login:{ en:'Log in to the Classroom first.', es:'Primero inicia sesión en la Clase.' }, open:{ en:'Open the Classroom', es:'Abrir la Clase' },
    teacher:{ en:'My Drive is for students.', es:'Mi unidad es para estudiantes.' }
  };
  const w = k => L(W[k]);
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status });
    return j;
  }

  let me = null, data = null;
  const status = h('span', { class:'rs-status' });
  const picker = h('input', { type:'file', accept:'image/*', multiple:true, hidden:true, onchange:e => { add([...e.target.files]); e.target.value = ''; } });

  async function add(list){
    list = list.filter(f => /^image\//.test(f.type));
    if(!list.length) return;
    status.textContent = '⏳ ' + w('uploading'); status.className = 'rs-status saving';
    try {
      for(const f of list){
        const id = await PICTURES.upload(f), name = HL.fileName(f.name, data.files);
        data.files = (await api('/drive', { method:'POST', body:JSON.stringify({ name, id }) })).files;
      }
      status.textContent = ''; status.className = 'rs-status';
    } catch(e){ status.textContent = '⚠ ' + w(e.status === 413 ? 'full' : 'failed'); status.className = 'rs-status offline'; }
    draw();
  }

  function draw(){
    const names = Object.keys(data.files).sort();
    const drop = h('div', { class:'dv-drop' }, '⬇ ' + w('drop'));
    const zone = h('section', { class:'dv-sec' },
      h('div', { class:'dv-sec-h' }, h('h2', {}, '🖼 ' + w('pics')), h('small', {}, names.length + ' · ' + w('picsHint')), h('span', { class:'grow' }), status,
        h('button', { class:'rs-btn primary', type:'button', onclick:() => picker.click() }, '＋ ' + w('upload')), picker),
      names.length ? h('div', { class:'dv-grid' }, ...names.map(n => h('div', { class:'dv-pic' },
        h('img', { src:'/api/assets/' + data.files[n], alt:n, loading:'lazy' }), h('span', { title:n }, n),
        h('button', { class:'dv-x', type:'button', title:w('del'), 'aria-label':w('del') + ' ' + n, onclick:async () => {
          if(!confirm(w('del') + '\n' + n)) return;
          try { data.files = (await api('/drive/' + encodeURIComponent(n), { method:'DELETE' })).files; draw(); } catch(e){}
        } }, '✕')))) : null,
      drop);
    // drop pictures anywhere on the section
    zone.addEventListener('dragover', e => { if([...e.dataTransfer.types].includes('Files')){ e.preventDefault(); drop.classList.add('on'); } });
    zone.addEventListener('dragleave', e => { if(!zone.contains(e.relatedTarget)) drop.classList.remove('on'); });
    zone.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('on'); add([...e.dataTransfer.files]); });

    const doc = (icon, href, file, line) => h('a', { class:'dv-doc', href, target:'_blank', rel:'noopener' },
      h('span', { class:'dv-doc-i' }, icon), h('span', { class:'grow' }, h('b', {}, file), h('small', {}, line)), h('span', {}, '↗'));
    app.replaceChildren(h('div', { class:'dv' },
      h('header', { class:'rs-top' }, h('span', { class:'rs-logo' }, '☁️'),
        h('div', { class:'rs-file' }, h('b', {}, w('drive')), h('small', {}, me.name)), h('span', { class:'grow' }),
        h('button', { class:'rs-btn ghost', type:'button', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); draw(); } }, I18N.lang === 'es' ? 'EN' : 'ES'),
        h('a', { class:'rs-btn ghost', href:'/#/c/' + encodeURIComponent(me.period || '') + '/work' }, '◀ ' + w('back'))),
      h('main', { class:'dv-main' }, zone,
        h('section', { class:'dv-sec' }, h('div', { class:'dv-sec-h' }, h('h2', {}, '📄 ' + w('mine'))),
          h('div', { class:'dv-docs' }, ...data.pages.map(p => doc('📄', p.path, p.file,
            (p.len ? Math.round(p.len / 100) / 10 + ' KB' : w('notStarted')) + (p.in ? ' · 🔒 ' + w('turnedIn') : '') + (p.with.length ? ' · 👥 ' + w('sharedWith') + ' ' + p.with.length : ''))))),
        h('section', { class:'dv-sec' }, h('div', { class:'dv-sec-h' }, h('h2', {}, '👥 ' + w('shared')), h('small', {}, w('sharedHint'))),
          data.shared.length ? h('div', { class:'dv-docs' }, ...data.shared.map(x => doc('✏️', x.path, x.file, L({ en:x.name + '’s page', es:'Página de ' + x.name }) + (x.title ? ' · ' + x.title : ''))))
            : h('small', { class:'dv-msg' }, w('noShared'))))));
    document.title = w('drive');
  }

  async function start(){
    try { me = await api('/me'); } catch(e){ me = null; }
    if(!me) return app.replaceChildren(h('div', { class:'rs-msg' }, h('b', {}, '🔑 ' + w('login')), h('a', { class:'rs-btn primary', href:'/' }, w('open'))));
    if(me.role === 'teacher') return app.replaceChildren(h('div', { class:'rs-msg' }, h('b', {}, w('teacher')), h('a', { class:'rs-btn primary', href:'/' }, w('open'))));
    data = await api('/drive');
    draw();
    // back from an editor tab: pages shared since then show up
    document.addEventListener('visibilitychange', async () => { if(!document.hidden){ try { data = await api('/drive'); draw(); } catch(e){} } });
  }
  start();
})();
