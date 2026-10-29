/* =====================================================================
   CLASSROOM — the front page (/), set out like Google Classroom: one
   class per period, each with Stream, Classwork, People and Grades.
   The tools (block editor, Learn, Design, HTML) open from Classwork.

   Routes (after #):
     #/                  teacher: a card per class; student: their class
     #/c/<p>             Stream: the teacher's posts, and work due soon
     #/c/<p>/work        Classwork: topics, each with assignments and materials
     #/c/<p>/people      People (teacher)
     #/c/<p>/grades      Grades (teacher: everyone; student: My work)

   Old editor links (/#/p/<id>, /#/class, /#/teacher) go on to /studio.
   ===================================================================== */
(function(){
  if(/^#\/(p\/|class|teacher)/.test(location.hash)) return location.replace('/studio' + location.hash);
  const { h, $ } = UI;
  const { pointsOf, ITEMS, ASSIGNMENTS, TOPICS, custom, topicsWith, studentData, status } = CLASSWORK;
  const app = $('#app');
  let me = null, current = '', periods = [], room = null, mine = null;
  const L = o => o == null ? '' : typeof o === 'string' ? o : (I18N.lang === 'es' && o.es) || o.en;

  const W = {
    app:{ en:'MESA Code Studio', es:'MESA Code Studio' }, cls:{ en:'Computer Science', es:'Ciencias de la computación' },
    period:{ en:'Period', es:'Período' }, stream:{ en:'Stream', es:'Novedades' }, work:{ en:'Classwork', es:'Trabajo de clase' },
    people:{ en:'People', es:'Personas' }, grades:{ en:'Grades', es:'Calificaciones' }, myWork:{ en:'My work', es:'Mi trabajo' },
    upcoming:{ en:'Upcoming', es:'Próximas entregas' }, noDue:{ en:'No work due soon', es:'No hay trabajo pendiente' },
    viewAll:{ en:'View all', es:'Ver todo' }, announce:{ en:'Announce something to your class', es:'Anuncia algo a tu clase' },
    post:{ en:'Post', es:'Publicar' }, allClasses:{ en:'Post to all my classes', es:'Publicar en todas mis clases' },
    noPosts:{ en:'This is where your class talks. Posts from your teacher show up here.', es:'Aquí habla tu clase. Los anuncios de tu maestro aparecen aquí.' },
    del:{ en:'Delete', es:'Eliminar' }, sureDel:{ en:'Delete this post?', es:'¿Eliminar esta publicación?' },
    due:{ en:'Due', es:'Entrega' }, assignment:{ en:'Assignment', es:'Tarea' }, material:{ en:'Material', es:'Material' },
    open:{ en:'Open', es:'Abrir' }, progress:{ en:'Student progress', es:'Progreso de estudiantes' },
    hide:{ en:'Hide from students', es:'Ocultar a estudiantes' }, show:{ en:'Show to students', es:'Mostrar a estudiantes' },
    hidden:{ en:'Hidden', es:'Oculto' }, setDue:{ en:'Due date', es:'Fecha de entrega' }, clear:{ en:'No due date', es:'Sin fecha' },
    none:{ en:'Assigned', es:'Asignado' }, started:{ en:'Started', es:'Empezado' }, done:{ en:'Done', es:'Hecho' },
    missing:{ en:'Missing', es:'Falta' }, teachers:{ en:'Teachers', es:'Maestros' }, students:{ en:'Students', es:'Estudiantes' },
    dashboard:{ en:'Teacher dashboard', es:'Panel del maestro' }, name:{ en:'Name', es:'Nombre' },
    yourClasses:{ en:'Your classes', es:'Tus clases' }, newTab:{ en:'opens in a new tab', es:'se abre en otra pestaña' },
    lastIn:{ en:'Last login', es:'Último ingreso' }, never:{ en:'never', es:'nunca' }, avg:{ en:'Class average', es:'Promedio de la clase' },
    create:{ en:'Create assignment', es:'Crear tarea' }, title:{ en:'Title', es:'Título' }, instructions:{ en:'Instructions (optional)', es:'Instrucciones (opcional)' },
    topic:{ en:'Topic', es:'Tema' }, noTopic:{ en:'Assignments', es:'Tareas' }, assign:{ en:'Assign', es:'Asignar' }, save:{ en:'Save', es:'Guardar' },
    cancel:{ en:'Cancel', es:'Cancelar' }, toAll:{ en:'Assign to all my classes', es:'Asignar a todas mis clases' },
    viewA:{ en:'View assignment', es:'Ver tarea' }, yourWork:{ en:'Your work', es:'Tu trabajo' }, addFile:{ en:'Add HTML file', es:'Añadir archivo HTML' },
    turnIn:{ en:'Turn in', es:'Entregar' }, unsubmit:{ en:'Unsubmit', es:'Anular entrega' }, turnedIn:{ en:'Turned in', es:'Entregado' },
    giveBack:{ en:'Give back', es:'Devolver' }, giveBackT:{ en:'Unlock it so the student can change it', es:'Desbloquéalo para que el estudiante lo cambie' },
    allIn:{ en:'Turn in all', es:'Entregar todos' }, sureAllIn:{ en:'Turn in and lock every student’s packet in this class?', es:'¿Entregar y bloquear el paquete de cada estudiante de esta clase?' },
    sureTurnIn:{ en:'Turn in your plan? You cannot change it after.', es:'¿Entregar tu plan? Después no lo puedes cambiar.' },
    lockedM:{ en:'Locked. To change it, ask your teacher to give it back.', es:'Bloqueado. Para cambiarlo, pide a tu maestro que te lo devuelva.' },
    late:{ en:'late', es:'tarde' }, needFile:{ en:'Add your .html file, then turn it in.', es:'Añade tu archivo .html y luego entrégalo.' },
    tooBig:{ en:'That file is too big (400 KB at most).', es:'Ese archivo es muy grande (máximo 400 KB).' },
    notHtml:{ en:'Pick an .html file.', es:'Elige un archivo .html.' }, studentWork:{ en:'Student work', es:'Trabajo de los estudiantes' },
    edit:{ en:'Edit', es:'Editar' }, sureDelA:{ en:'Delete this assignment and the work turned in for it?', es:'¿Eliminar esta tarea y el trabajo entregado?' },
    page:{ en:'Page', es:'Página' }, code:{ en:'Code', es:'Código' }, close:{ en:'Close', es:'Cerrar' }, back:{ en:'Classwork', es:'Trabajo de clase' },
    noWork:{ en:'Nothing attached yet', es:'Nada adjunto todavía' }, openWork:{ en:'Open their work', es:'Abrir su trabajo' },
    points:{ en:'points', es:'puntos' }, pointsL:{ en:'Points', es:'Puntos' }, ungraded:{ en:'Ungraded', es:'Sin calificar' },
    grade:{ en:'Grade', es:'Calificación' }, graded:{ en:'Graded', es:'Calificado' },
    comments:{ en:'Private comments', es:'Comentarios privados' }, addComment:{ en:'Add a private comment…', es:'Añade un comentario privado…' },
    send:{ en:'Send', es:'Enviar' }, outOf:{ en:'out of', es:'de' }, avgGrade:{ en:'Average', es:'Promedio' }
  };
  const w = k => L(W[k]);
  const COLORS = ['#1e8e3e', '#1967d2', '#d93025', '#e37400', '#9334e6', '#129eaf', '#c26401', '#5f6368'];
  const color = p => COLORS[[...String(p)].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

  /* ---------------------------------------------------------------- api */
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    if(r.status === 401 && path !== '/login'){ if(me){ me = null; current = ''; route(); } throw Object.assign(new Error('login'), { status:401 }); }
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status });
    return j;
  }
  const put = (path, body, method='PUT') => api(path, { method, body:JSON.stringify(body) });

  /* a student's own work, from the tools' own saves and their turned-in assignments */
  async function loadMine(period){
    const [l, d, ps, ...subs] = await Promise.all([api('/learn').catch(() => ({})), api('/design').catch(() => ({})), api('/projects').catch(() => []),
      ...room.assignments.map(a => api('/room/' + period + '/assignments/' + a.id + '/work').catch(() => null))]);
    const by = {};
    room.assignments.forEach((a, i) => { const x = subs[i]; if(x) by[a.id] = subOf(x); });
    mine = studentData(l && l.data, d && d.data, ps, by);
  }
  // what status() needs from one student's work on an assignment
  const subOf = x => ({ turnedIn:x.turnedIn, at:x.at, files:x.files.length, grade:x.grade });
  // every item in this class: the built-in ones and the teacher's own assignments
  const allItems = () => [...room.assignments.map(custom), ...ITEMS];
  const allAssignments = () => [...room.assignments.map(custom), ...ASSIGNMENTS];

  /* ---------------------------------------------------------- helpers */
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = s => new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en', { month:'short', day:'numeric' });
  const fmtWhen = s => { const d = new Date(s); return d.toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en', { month:'short', day:'numeric' }) + ', ' + d.toLocaleTimeString(I18N.lang === 'es' ? 'es' : 'en', { hour:'numeric', minute:'2-digit' }); };
  const setting = it => it.custom ? { due:it.custom.due } : (room && room.work[it.id]) || {};
  const visible = it => me.role === 'teacher' || !setting(it).hidden;
  const avatar = (name, c) => h('span', { class:'cr-av', style:{ background:c || '#5f6368' } }, (name || '?').trim()[0].toUpperCase());
  // post text: line breaks kept, links clickable, nothing else is HTML
  function richText(s){
    const out = h('div', { class:'cr-post-text' });
    for(const part of String(s).split(/(https?:\/\/[^\s<]+)/g))
      out.append(/^https?:\/\//.test(part) ? h('a', { href:part, target:'_blank', rel:'noopener' }, part) : part);
    return out;
  }
  function stateChip(st, it){
    const due = setting(it).due;
    if(!st) return null;
    if(st.graded) return h('span', { class:'cr-chip graded' }, st.points ? st.grade + ' / ' + st.points : '✓ ' + w('graded'));
    if(st.state === 'done') return h('span', { class:'cr-chip done' }, '✓ ' + (it.custom || it.turnin ? w('turnedIn') : w('done')) + (st.late ? ' · ' + w('late') : ''));
    if(due && due < today()) return h('span', { class:'cr-chip late' }, w('missing'));
    return h('span', { class:'cr-chip' + (st.state === 'started' ? ' started' : '') }, st.state === 'started' ? w('started') + ' · ' + st.text : w('none'));
  }
  const bar = pct => h('span', { class:'cr-bar' }, h('i', { style:{ width:pct + '%' } }));

  /* -------------------------------------------------------------- chrome */
  const langBtn = () => h('button', { class:'btn ghost lang', type:'button', title:'English / Español', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); route(true); } }, I18N.lang === 'es' ? 'EN' : 'ES');
  function topbar(period, tab){
    const tabs = period ? [['', w('stream')], ['work', w('work')], ...(me.role === 'teacher' ? [['people', w('people')], ['grades', w('grades')]] : [['grades', w('myWork')]])] : [];
    return h('header', { class:'cr-top' },
      h('a', { class:'cr-logo', href:'#/' }, h('span', { class:'cr-logo-mark' }, '◆'), h('span', { class:'cr-logo-t' },
        period ? [h('b', {}, w('cls')), h('small', {}, w('period') + ' ' + period)] : h('b', {}, w('app')))),
      h('nav', { class:'cr-tabs' }, ...tabs.map(([id, label]) => h('a', { class:'cr-tab' + (id === tab ? ' on' : ''), href:'#/c/' + period + (id ? '/' + id : '') }, label))),
      h('span', { class:'grow' }), langBtn(),
      h('span', { class:'cr-me', title:me.username }, avatar(me.name, '#1967d2'), h('span', { class:'who' }, me.name)),
      h('button', { class:'btn ghost', type:'button', onclick:async () => { await fetch('/api/logout', { method:'POST' }).catch(() => {}); me = null; location.hash = '#/'; route(true); } }, t('Log out')));
  }

  /* ------------------------------------------------------------ routing */
  async function route(force){
    const hash = location.hash || '#/';
    if(hash === current && !force) return;
    current = hash;
    if(!me){ try { me = await api('/me'); } catch(e){ me = null; } }
    if(!me) return loginView();
    document.body.className = 'v-room';
    if(!periods.length) try { periods = await api('/room'); } catch(e){ periods = []; }
    const m = hash.match(/^#\/c\/([\w-]+)(?:\/(work|people|grades|a\/[\w-]+))?$/);
    if(!m){
      if(me.role !== 'teacher' && periods[0]){ location.replace('#/c/' + periods[0]); return; }
      return homeView();
    }
    const [, period, tab] = m;
    try { room = await api('/room/' + encodeURIComponent(period)); } catch(e){ room = { posts:[], work:{} }; if(e.status === 403){ location.replace('#/'); return; } }
    if(!Array.isArray(room.assignments)) room.assignments = [];
    if(me.role !== 'teacher') await loadMine(period);
    if(tab && tab.startsWith('a/')){ const it = allItems().find(x => x.id === tab.slice(2) && x.kind === 'assignment' && visible(x)); if(it) return assignmentView(period, it); }
    if(tab === 'work') return workView(period);
    if(tab === 'people' && me.role === 'teacher') return peopleView(period);
    if(tab === 'grades') return me.role === 'teacher' ? gradesView(period) : myWorkView(period);
    return streamView(period);
  }
  addEventListener('hashchange', () => route());

  function loginView(){
    document.body.className = 'v-login';
    const user = h('input', { class:'inp', autocomplete:'username', autocapitalize:'none', spellcheck:'false', required:true });
    const pass = h('input', { class:'inp', type:'password', autocomplete:'current-password', autocapitalize:'none', required:true });
    const msg = h('div', { class:'msg', role:'alert' });
    const btn = h('button', { class:'btn primary big', type:'submit' }, t('Log in'));
    const form = h('form', { class:'login-card' },
      h('div', { class:'login-top' }, h('span', { class:'logo' }, h('span', { class:'logo-mark' }, '◆'), h('span', {}, w('app'))), langBtn()),
      h('div', { class:'login-art' }, h('img', { src:LIBRARY.picURL('bit-b'), alt:'' })),
      h('label', {}, h('span', {}, '👤 ' + t('Username')), user),
      h('label', {}, h('span', {}, '🔑 ' + t('Password')), pass), msg, btn);
    form.onsubmit = async e => {
      e.preventDefault(); btn.disabled = true; msg.textContent = '';
      try {
        me = await api('/login', { method:'POST', body:JSON.stringify({ username:user.value.trim().toLowerCase(), password:pass.value.trim() }) });
        periods = []; current = ''; route(true);
      } catch(err){
        msg.textContent = err.status === 401 ? t('Wrong username or password.') : err.status === 429 ? t('Too many tries. Wait a few minutes.') : t('Could not reach the server.');
        btn.disabled = false; pass.select();
      }
    };
    app.replaceChildren(h('div', { class:'login-page' }, form)); user.focus();
  }

  /* ------------------------------------------------- the teacher's classes */
  function homeView(){
    app.replaceChildren(topbar(), h('main', { class:'cr-main' },
      h('h2', { class:'cr-h' }, w('yourClasses')),
      h('div', { class:'cr-cards' }, ...periods.map(p => h('a', { class:'cr-ccard', href:'#/c/' + p },
        h('div', { class:'cr-ccard-top', style:{ background:color(p) } }, h('b', {}, w('cls')), h('small', {}, w('period') + ' ' + p)),
        h('div', { class:'cr-ccard-body' }, h('span', {}, '📚 ' + w('work')), h('span', {}, '👥 ' + w('people'))))))));
  }

  /* ------------------------------------------------------------- stream */
  function streamView(period){
    const teacher = me.role === 'teacher';
    const dueSoon = allItems().filter(it => visible(it) && setting(it).due && setting(it).due >= today())
      .filter(it => teacher || !mine || (status(it, mine) || {}).state !== 'done')
      .sort((a, b) => setting(a).due.localeCompare(setting(b).due)).slice(0, 4);
    const composer = teacher ? (() => {
      const ta = h('textarea', { class:'cr-compose-in', rows:1, placeholder:w('announce'), oninput:() => { ta.rows = Math.min(8, Math.max(2, ta.value.split('\n').length)); } });
      const all = h('input', { type:'checkbox' });
      const btn = h('button', { class:'btn primary', type:'button', onclick:async () => {
        const text = ta.value.trim(); if(!text) return;
        btn.disabled = true;
        try {
          for(const p of all.checked ? periods : [period]){ const r = await put('/room/' + p + '/posts', { text }, 'POST'); if(p === period) room = r; }
          streamView(period);
        } catch(e){ btn.disabled = false; UI.toast && UI.toast(t('Could not reach the server.')); }
      } }, w('post'));
      return h('div', { class:'cr-card cr-compose' }, avatar(me.name, '#1967d2'), h('div', { class:'cr-compose-body' }, ta,
        h('div', { class:'cr-compose-foot' }, h('label', { class:'cr-check' }, all, ' ' + w('allClasses')), h('span', { class:'grow' }), btn)));
    })() : null;
    const post = x => h('article', { class:'cr-card cr-post' },
      h('div', { class:'cr-post-head' }, avatar(x.by, color(period)), h('div', {}, h('b', {}, x.by), h('small', {}, fmtWhen(x.at))),
        teacher ? h('button', { class:'cr-kebab', type:'button', title:w('del'), onclick:async () => {
          if(!confirm(w('sureDel'))) return;
          room = await put('/room/' + period + '/posts/' + x.id, {}, 'DELETE'); streamView(period);
        } }, '🗑') : null),
      richText(x.text));
    app.replaceChildren(topbar(period, ''), h('main', { class:'cr-main' },
      h('div', { class:'cr-banner', style:{ background:color(period) } }, h('b', {}, w('cls')), h('span', {}, w('period') + ' ' + period)),
      h('div', { class:'cr-stream' },
        h('aside', { class:'cr-card cr-upcoming' }, h('b', {}, w('upcoming')),
          dueSoon.length ? dueSoon.map(it => h('a', { class:'cr-up', href:'#/c/' + period + (it.kind === 'assignment' ? '/a/' + it.id : '/work') }, h('small', {}, w('due') + ' ' + fmtDate(setting(it).due)), L(it.title)))
                         : h('small', { class:'muted' }, w('noDue')),
          h('a', { class:'cr-link', href:'#/c/' + period + '/work' }, w('viewAll'))),
        h('div', { class:'cr-feed' }, composer,
          ...(room.posts.length ? room.posts.map(post) : [h('div', { class:'cr-card cr-empty' }, '💬 ', w('noPosts'))])))));
  }

  /* ---------------------------------------------------------- classwork */
  let openItem = null;
  function workView(period){
    const teacher = me.role === 'teacher';
    const row = it => {
      const set = setting(it), st = !teacher && mine ? status(it, mine) : null, isOpen = openItem === it.id;
      const head = h('button', { class:'cr-item-head', type:'button', 'aria-expanded':String(isOpen), onclick:() => { openItem = isOpen ? null : it.id; workView(period); } },
        h('span', { class:'cr-item-ico' + (it.kind === 'material' ? ' mat' : '') + (it.custom ? ' own' : '') + (set.hidden ? ' off' : '') }, it.icon),
        h('span', { class:'cr-item-t' }, L(it.title), set.hidden ? h('span', { class:'cr-chip off' }, '🙈 ' + w('hidden')) : null),
        h('span', { class:'grow' }),
        set.due ? h('small', { class:'cr-due' + (set.due < today() && (!st || st.state !== 'done') ? ' late' : '') }, w('due') + ' ' + fmtDate(set.due)) : null,
        st ? stateChip(st, it) : null);
      if(!isOpen) return h('div', { class:'cr-item' }, head);
      const view = it.kind === 'assignment' ? h('a', { class:'btn primary', href:'#/c/' + period + '/a/' + it.id }, '📋 ' + w('viewA')) : null;
      const go = it.custom ? null : h('a', { class:'btn' + (view ? '' : ' primary'), href:it.href, target:it.out ? '_blank' : null, rel:it.out ? 'noopener' : null, title:it.out ? w('newTab') : null }, it.icon + ' ' + w('open') + (it.out ? ' ↗' : ''));
      const tools = teacher && !it.custom ? [
        h('button', { class:'btn', type:'button', onclick:async () => { room = await put('/room/' + period + '/work/' + it.id, { ...set, hidden:!set.hidden }); workView(period); } },
          set.hidden ? '👁 ' + w('show') : '🙈 ' + w('hide')),
        h('label', { class:'cr-duein' }, '📅 ' + w('setDue') + ' ', h('input', { type:'date', class:'inp sm', value:set.due || '', onchange:async e => {
          room = await put('/room/' + period + '/work/' + it.id, { ...set, due:e.target.value || null }); workView(period);
        } }))] : [];
      return h('div', { class:'cr-item open' }, head,
        h('div', { class:'cr-item-body' },
          h('small', { class:'cr-kind' }, it.kind === 'assignment' ? '📋 ' + w('assignment') : '📎 ' + w('material')),
          L(it.line) ? h('p', {}, L(it.line)) : null, st ? h('div', { class:'cr-st' }, bar(st.pct), h('small', {}, st.text)) : null,
          h('div', { class:'cr-item-btns' }, view, go, ...tools)));
    };
    const form = h('div');
    app.replaceChildren(topbar(period, 'work'), h('main', { class:'cr-main narrow' },
      teacher ? h('div', { class:'cr-worktop' }, h('button', { class:'btn cr-create', type:'button', onclick:() => form.replaceChildren(assignmentForm(period, null, () => form.replaceChildren())) }, '＋ ' + w('create'))) : null,
      form,
      ...topicsWith(room.assignments).map(tp => {
        const items = tp.items.filter(visible);
        return items.length ? h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, h('span', {}, tp.icon), L(tp.title)), ...items.map(row)) : null;
      })));
  }

  /* the teacher's form for a new assignment (or changing one: a is the assignment) */
  function assignmentForm(period, a, done){
    const title = h('input', { class:'inp cr-in-title', placeholder:w('title'), value:a ? a.title : '', maxlength:120 });
    const text = h('textarea', { class:'inp cr-in-text', rows:4, placeholder:w('instructions') });
    text.value = a ? a.text : '';
    const topic = h('select', { class:'inp' }, h('option', { value:'assignments' }, '📋 ' + w('noTopic')),
      ...TOPICS.map(t => h('option', { value:t.id, selected:a && a.topic === t.id ? true : null }, t.icon + ' ' + L(t.title))));
    const due = h('input', { type:'date', class:'inp', value:a && a.due || '' });
    const pts = h('input', { type:'number', class:'inp cr-pts', min:0, max:1000, value:a ? pointsOf(a) : 100, title:'0 = ' + w('ungraded') });
    const all = h('input', { type:'checkbox' });
    const msg = h('span', { class:'cr-err' });
    const save = h('button', { class:'btn primary', type:'button', onclick:async () => {
      const body = { title:title.value.trim(), text:text.value, topic:topic.value, due:due.value || null, points:pts.value === '' ? 0 : Number(pts.value) };
      if(!body.title){ title.focus(); return; }
      save.disabled = true;
      try {
        if(a) room = await put('/room/' + period + '/assignments/' + a.id, body);
        else for(const p of all.checked ? periods : [period]){ const r = await put('/room/' + p + '/assignments', body, 'POST'); if(p === period) room = r; }
        done(); route(true);
      } catch(e){ save.disabled = false; msg.textContent = t('Could not reach the server.'); }
    } }, a ? w('save') : w('assign'));
    setTimeout(() => title.focus(), 0);
    return h('div', { class:'cr-card cr-form' }, h('b', { class:'cr-form-h' }, '📄 ' + (a ? w('edit') : w('create'))), title, text,
      h('div', { class:'cr-form-row' }, h('label', {}, w('topic') + ' ', topic), h('label', {}, '📅 ' + w('setDue') + ' ', due), h('label', {}, '💯 ' + w('pointsL') + ' ', pts),
        a ? null : h('label', { class:'cr-check' }, all, ' ' + w('toAll'))),
      h('div', { class:'cr-form-row' }, msg, h('span', { class:'grow' }), h('button', { class:'btn', type:'button', onclick:done }, w('cancel')), save));
  }

  /* -------------------------------------------------------- one assignment
     Instructions on the left. A student gets "Your work" (attach .html
     files, turn in); the teacher gets every student's name with their work. */
  async function assignmentView(period, it){
    const teacher = me.role === 'teacher', a = it.custom, set = setting(it);
    const side = h('div', { class:'cr-aside' });
    const below = h('div');
    const head = h('div', { class:'cr-a-head' }, h('span', { class:'cr-item-ico big' + (a ? ' own' : '') }, it.icon),
      h('div', { class:'cr-a-t' }, h('h1', {}, L(it.title)),
        h('small', { class:'muted' }, a ? a.by + ' · ' + fmtDate(a.at.slice(0, 10)) : w('assignment')),
        a ? h('small', { class:'cr-pts-l' }, pointsOf(a) ? pointsOf(a) + ' ' + w('points') : w('ungraded')) : null,
        set.due ? h('small', { class:'cr-due' + (set.due < today() ? ' late' : '') }, w('due') + ' ' + fmtDate(set.due)) : null),
      teacher && a ? h('div', { class:'cr-a-tools' },
        h('button', { class:'btn', type:'button', onclick:() => below.replaceChildren(assignmentForm(period, a, () => below.replaceChildren())) }, '✏️ ' + w('edit')),
        h('button', { class:'btn', type:'button', onclick:async () => {
          if(!confirm(w('sureDelA'))) return;
          room = await put('/room/' + period + '/assignments/' + a.id, {}, 'DELETE'); location.hash = '#/c/' + period + '/work';
        } }, '🗑 ' + w('del'))) : null);
    const body = h('div', { class:'cr-a-body' }, head, below,
      L(it.line) ? (a ? richText(a.text) : h('p', {}, L(it.line))) : null,
      a ? null : h('div', {}, h('a', { class:'btn primary', href:it.href }, it.icon + ' ' + w('open'))));
    app.replaceChildren(topbar(period, 'work'), h('main', { class:'cr-main' },
      h('a', { class:'cr-back', href:'#/c/' + period + '/work' }, '◀ ' + w('back')),
      h('div', { class:'cr-a' + (teacher ? ' teacher' : '') }, body, teacher ? null : side), teacher ? h('div', { class:'cr-sw' }) : null));
    if(!teacher){
      if(a) return yourWork(period, a, side);
      const st = status(it, mine), turned = it.turnin && st.state === 'done';
      return side.append(h('div', { class:'cr-card cr-yours' }, h('div', { class:'cr-yours-h' }, h('b', {}, w('yourWork')), stateChip(st, it)),
        h('div', { class:'cr-st' }, bar(st.pct), h('small', {}, st.text)),
        turned ? h('small', { class:'muted' }, '🔒 ' + w('lockedM')) : null,
        h('a', { class:'btn' + (turned ? '' : ' primary'), href:it.href }, it.icon + ' ' + w('open')),
        it.turnin && !turned ? h('button', { class:'btn', type:'button', onclick:async e => {
          if(!confirm(w('sureTurnIn'))) return;
          e.target.disabled = true;
          try { await put('/design/turnin', {}, 'POST'); route(true); } catch(x){ e.target.disabled = false; }
        } }, '📤 ' + w('turnIn')) : null));
    }
    studentWork(period, it, $('.cr-sw'));
  }

  /* a student's card: their files, Add HTML file, Turn in / Unsubmit */
  async function yourWork(period, a, box){
    const base = '/room/' + period + '/assignments/' + a.id;
    let sub = await api(base + '/work');
    const msg = h('small', { class:'cr-err' });
    const draw = () => {
      const st = status(custom(a), { subs:{ [a.id]:subOf(sub) } });
      const pick = h('input', { type:'file', accept:'.html,.htm,text/html', multiple:true, hidden:true, onchange:async () => {
        for(const f of pick.files){
          if(!/\.html?$/i.test(f.name)){ msg.textContent = w('notHtml'); continue; }
          if(f.size > 400 * 1024){ msg.textContent = w('tooBig'); continue; }
          try { sub = await put(base + '/files', { name:f.name, html:await f.text() }, 'POST'); msg.textContent = ''; } catch(e){ msg.textContent = t('Could not reach the server.'); }
        }
        draw();
      } });
      box.replaceChildren(h('div', { class:'cr-card cr-yours' },
        h('div', { class:'cr-yours-h' }, h('b', {}, w('yourWork')), stateChip(st, custom(a))),
        sub.files.length ? h('div', { class:'cr-files' }, ...sub.files.map(f => fileChip(base + '/work/' + me.username + '/files/' + f.id, f,
          sub.turnedIn ? null : async () => { sub = await put(base + '/files/' + f.id, {}, 'DELETE'); draw(); }))) : h('small', { class:'muted' }, w('needFile')),
        sub.turnedIn ? null : [pick, h('button', { class:'btn cr-add', type:'button', onclick:() => pick.click() }, '＋ ' + w('addFile'))],
        msg,
        sub.turnedIn ? h('button', { class:'btn', type:'button', onclick:async () => { sub = await put(base + '/turnin', { on:false }, 'POST'); draw(); } }, w('unsubmit'))
          : h('button', { class:'btn primary', type:'button', disabled:!sub.files.length, onclick:async () => { sub = await put(base + '/turnin', { on:true }, 'POST'); draw(); } }, w('turnIn'))),
        h('div', { class:'cr-card cr-yours' }, comments(base + '/work/' + me.username + '/comments', sub.comments, r => { sub = r; draw(); })));
    };
    draw();
  }

  /* one attached file: its name; click to see the page it makes */
  function fileChip(url, f, remove){
    return h('div', { class:'cr-file' },
      h('button', { class:'cr-file-open', type:'button', onclick:() => showFile(url) }, h('span', { class:'cr-file-ico' }, '</>'),
        h('span', {}, h('b', {}, f.name), h('small', {}, 'HTML · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB'))),
      remove ? h('button', { class:'cr-kebab', type:'button', title:w('del'), onclick:remove }, '✕') : null);
  }
  // the page in a sandboxed frame (its own origin: it cannot reach this site), or its code
  async function showFile(url){
    const f = await api(url);
    const frame = h('iframe', { class:'cr-view-frame', sandbox:'allow-scripts', title:f.name });
    frame.srcdoc = f.html;
    const code = h('pre', { class:'cr-view-code', hidden:true }, f.html);
    const tabs = [w('page'), w('code')].map((label, i) => h('button', { class:'cr-tab' + (i ? '' : ' on'), type:'button', onclick:() => {
      tabs.forEach((b, k) => b.classList.toggle('on', k === i)); frame.hidden = !!i; code.hidden = !i; } }, label));
    const back = h('div', { class:'cr-view', onclick:e => { if(e.target === back) back.remove(); } },
      h('div', { class:'cr-view-card' },
        h('div', { class:'cr-view-top' }, h('b', {}, '</> ' + f.name), h('nav', { class:'cr-tabs' }, ...tabs), h('span', { class:'grow' }),
          h('button', { class:'btn', type:'button', onclick:() => back.remove() }, '✕ ' + w('close'))), frame, code));
    document.body.append(back);
  }

  /* private comments between the teacher and one student; send(r) gets the saved work back */
  function comments(url, list, sent){
    const inp = h('textarea', { class:'inp cr-comment-in', rows:1, placeholder:w('addComment') });
    const go = async () => { const text = inp.value.trim(); if(!text) return; btn.disabled = true;
      try { sent(await put(url, { text }, 'POST')); } catch(e){ btn.disabled = false; } };
    const btn = h('button', { class:'btn primary small', type:'button', onclick:go }, w('send'));
    inp.onkeydown = e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); go(); } };
    return h('div', { class:'cr-thread' }, h('b', { class:'cr-thread-h' }, '👤 ' + w('comments')),
      ...list.map(c => h('div', { class:'cr-comment' }, avatar(c.name, c.teacher ? '#1967d2' : '#5f6368'),
        h('div', {}, h('div', {}, h('b', {}, c.name), ' ', h('small', { class:'muted' }, fmtWhen(c.at))), richText(c.text)))),
      h('div', { class:'cr-comment-new' }, inp, btn));
  }

  /* the teacher's list: every student in the class, by name, with their work */
  let openThread = null;
  async function studentWork(period, it, box){
    const a = it.custom;
    if(a){
      const rows = await api('/room/' + period + '/assignments/' + a.id + '/work');
      const n = rows.filter(r => r.turnedIn).length;
      box.replaceChildren(h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, w('studentWork'),
          h('small', { class:'cr-n' }, n + ' ' + w('turnedIn').toLowerCase() + ' · ' + (rows.length - n) + ' ' + w('none').toLowerCase())),
        ...rows.map(r => {
          const st = status(it, { subs:{ [a.id]:subOf(r) } });
          const base = '/room/' + period + '/assignments/' + a.id + '/work/' + r.username;
          const thread = h('div', { class:'cr-thread-wrap', hidden:openThread !== r.username },
            openThread === r.username ? comments(base + '/comments', r.comments, x => { Object.assign(r, x); studentWork(period, it, box); }) : null);
          const grade = h('input', { type:'number', class:'inp cr-grade-in', min:0, max:1000, step:'any', value:r.grade == null ? '' : r.grade,
            placeholder:'—', 'aria-label':w('grade') + ' ' + r.name, onchange:async e => {
              const v = e.target.value;
              try { Object.assign(r, await put(base + '/grade', { grade:v === '' ? null : Number(v) })); e.target.classList.add('saved'); setTimeout(() => studentWork(period, it, box), 500); }
              catch(x){ e.target.classList.add('bad'); }
            } });
          return h('div', { class:'cr-switem' }, h('div', { class:'cr-person cr-swrow' }, avatar(r.name, color(period)), h('div', { class:'cr-sw-name' }, h('b', {}, r.name), h('div', { class:'muted' }, r.username)),
            h('div', { class:'cr-files' }, ...(r.files.length ? r.files.map(f => fileChip(base + '/files/' + f.id, f)) : [h('small', { class:'muted' }, w('noWork'))])),
            h('span', { class:'grow' }), r.at ? h('small', { class:'muted' }, fmtWhen(r.at)) : null, stateChip(st, it),
            pointsOf(a) ? h('label', { class:'cr-grade' }, grade, h('span', {}, '/ ' + pointsOf(a))) : null,
            h('button', { class:'btn small cr-cbtn' + (r.comments.length ? ' has' : ''), type:'button', title:w('comments'),
              onclick:() => { openThread = openThread === r.username ? null : r.username; studentWork(period, it, box); } }, '💬 ' + (r.comments.length || ''))), thread);
        })));
      return;
    }
    const rows = await api('/room/' + period + '/grades');
    const n = rows.filter(r => status(it, r).state === 'done').length;
    // the Game Design Packet: turned in = locked; the teacher gives one back, or turns in the whole class
    const turn = (path, body, ask) => async e => {
      if(ask && !confirm(ask)) return;
      e.target.disabled = true;
      try { await put('/admin/designs/' + path, body, 'POST'); } catch(x){}
      studentWork(period, it, box);
    };
    box.replaceChildren(h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, w('studentWork'),
        h('small', { class:'cr-n' }, n + ' ' + (it.turnin ? w('turnedIn') : w('done')).toLowerCase() + ' · ' + rows.length + ' ' + w('students').toLowerCase()),
        it.turnin && n < rows.length ? h('button', { class:'btn small cr-allin', type:'button', onclick:turn('turnin', { on:true, period }, w('sureAllIn')) }, '🔒 ' + w('allIn')) : null),
      ...rows.map(r => { const st = status(it, r);
        return h('div', { class:'cr-person cr-swrow' }, avatar(r.name, color(period)), h('div', { class:'cr-sw-name' }, h('b', {}, r.name), h('div', { class:'muted' }, r.username)),
          h('div', { class:'cr-st' }, bar(st.pct), h('small', {}, st.text)), h('span', { class:'grow' }),
          it.student && st.state !== 'none' ? h('a', { class:'btn small', href:it.student(r.username) }, '📄 ' + w('openWork')) : null,
          stateChip(st, it),
          it.turnin ? (st.state === 'done'
            ? h('button', { class:'btn small', type:'button', title:w('giveBackT'), onclick:turn(r.username + '/turnin', { on:false }) }, '↩ ' + w('giveBack'))
            : h('button', { class:'btn small', type:'button', onclick:turn(r.username + '/turnin', { on:true }) }, '🔒 ' + w('turnIn'))) : null); })));
  }

  /* -------------------------------------------------------------- people */
  async function peopleView(period){
    const main = h('main', { class:'cr-main narrow' });
    app.replaceChildren(topbar(period, 'people'), main);
    const rows = await api('/room/' + period + '/grades');
    main.replaceChildren(
      h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, w('teachers')),
        h('div', { class:'cr-person' }, avatar(me.name, '#1967d2'), h('b', {}, me.name), h('span', { class:'grow' }),
          h('a', { class:'btn', href:'/studio#/teacher' }, '🍎 ' + w('dashboard')))),
      h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, w('students'), h('small', { class:'cr-n' }, rows.length + ' ' + w('students').toLowerCase())),
        ...rows.map(r => h('div', { class:'cr-person' }, avatar(r.name, color(period)), h('div', {}, h('b', {}, r.name), h('div', { class:'muted' }, r.username)),
          h('span', { class:'grow' }), h('small', { class:'muted' }, w('lastIn') + ': ' + (r.last_login ? UI.ago(r.last_login) : w('never')))))));
  }

  /* ---------------------------------------------- grades (the teacher) */
  async function gradesView(period){
    const main = h('main', { class:'cr-main wide' });
    app.replaceChildren(topbar(period, 'grades'), main);
    const rows = await api('/room/' + period + '/grades');
    const cols = allAssignments().filter(visible);
    const cell = (it, r) => {
      const st = status(it, r), due = setting(it).due;
      const late = st.state !== 'done' && due && due < today();
      return h('td', { class:'cr-g ' + st.state + (late || st.late ? ' late' : ''), title:st.text },
        it.custom ? h('a', { href:'#/c/' + period + '/a/' + it.id, title:w('grade') },          // to the assignment, to grade it
          st.state === 'none' ? (late ? w('missing') : '—') : st.graded ? st.text : st.state === 'done' ? '✓' + (st.late ? ' ' + w('late') : '') : st.text)
        : st.state === 'none' ? (late ? w('missing') : '—') : st.pct + '%');
    };
    // built-in work: average progress; a teacher's assignment: average of the grades given so far
    const avg = it => {
      if(it.custom){ const gs = rows.map(r => status(it, r)).filter(s => s.graded && s.points);
        return gs.length ? Math.round(gs.reduce((n, s) => n + s.pct, 0) / gs.length) + '%' : '—'; }
      return (rows.length ? Math.round(rows.reduce((n, r) => n + status(it, r).pct, 0) / rows.length) : 0) + '%';
    };
    main.replaceChildren(h('div', { class:'twrap cr-gwrap' }, h('table', { class:'ttable cr-gtable' },
      h('thead', {}, h('tr', {}, h('th', {}, w('name')), ...cols.map(it => h('th', { title:L(it.title) },
        h('span', { class:'cr-gh-ico' }, it.icon), h('span', { class:'cr-gh-t' }, L(it.title)),
        it.custom ? h('small', { class:'muted' }, pointsOf(it.custom) ? w('outOf') + ' ' + pointsOf(it.custom) : w('ungraded')) : null, setting(it).due ? h('small', {}, w('due') + ' ' + fmtDate(setting(it).due)) : null))),
        h('tr', { class:'cr-avg' }, h('td', {}, w('avg')), ...cols.map(it => h('td', {}, avg(it))))),
      h('tbody', {}, ...rows.map(r => h('tr', {}, h('td', {}, h('b', {}, r.name), h('div', { class:'muted' }, r.username)), ...cols.map(it => cell(it, r))))))));
  }

  /* ------------------------------------------------- my work (a student) */
  function myWorkView(period){
    const items = allAssignments().filter(visible);
    app.replaceChildren(topbar(period, 'grades'), h('main', { class:'cr-main narrow' },
      h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, '📋 ' + w('myWork')),
        ...items.map(it => { const st = status(it, mine);
          return h('a', { class:'cr-item cr-mine', href:'#/c/' + period + '/a/' + it.id },
            h('span', { class:'cr-item-ico' }, it.icon), h('div', { class:'cr-mine-t' }, h('b', {}, L(it.title)), h('div', { class:'cr-st' }, bar(st.pct), h('small', {}, st.text))),
            h('span', { class:'grow' }), setting(it).due ? h('small', { class:'cr-due' }, w('due') + ' ' + fmtDate(setting(it).due)) : null, stateChip(st, it)); }))));
  }

  route();
})();
