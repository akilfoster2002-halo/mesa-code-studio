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
  const { TOPICS, ITEMS, ASSIGNMENTS, studentData, status } = CLASSWORK;
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
    lastIn:{ en:'Last login', es:'Último ingreso' }, never:{ en:'never', es:'nunca' }, avg:{ en:'Class average', es:'Promedio de la clase' }
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

  /* a student's own work, from the tools' own saves */
  async function loadMine(){
    const [l, d, ps] = await Promise.all([api('/learn').catch(() => ({})), api('/design').catch(() => ({})), api('/projects').catch(() => [])]);
    mine = studentData(l && l.data, d && d.data, ps);
  }

  /* ---------------------------------------------------------- helpers */
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = s => new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en', { month:'short', day:'numeric' });
  const fmtWhen = s => { const d = new Date(s); return d.toLocaleDateString(I18N.lang === 'es' ? 'es' : 'en', { month:'short', day:'numeric' }) + ', ' + d.toLocaleTimeString(I18N.lang === 'es' ? 'es' : 'en', { hour:'numeric', minute:'2-digit' }); };
  const setting = it => (room && room.work[it.id]) || {};
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
    if(st.state === 'done') return h('span', { class:'cr-chip done' }, '✓ ' + w('done'));
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
    const m = hash.match(/^#\/c\/([\w-]+)(?:\/(work|people|grades))?$/);
    if(!m){
      if(me.role !== 'teacher' && periods[0]){ location.replace('#/c/' + periods[0]); return; }
      return homeView();
    }
    const [, period, tab] = m;
    try { room = await api('/room/' + encodeURIComponent(period)); } catch(e){ room = { posts:[], work:{} }; if(e.status === 403){ location.replace('#/'); return; } }
    if(me.role !== 'teacher') await loadMine();
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
    const dueSoon = ITEMS.filter(it => visible(it) && setting(it).due && setting(it).due >= today())
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
          dueSoon.length ? dueSoon.map(it => h('a', { class:'cr-up', href:'#/c/' + period + '/work' }, h('small', {}, w('due') + ' ' + fmtDate(setting(it).due)), L(it.title)))
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
        h('span', { class:'cr-item-ico' + (it.kind === 'material' ? ' mat' : '') + (set.hidden ? ' off' : '') }, it.icon),
        h('span', { class:'cr-item-t' }, L(it.title), set.hidden ? h('span', { class:'cr-chip off' }, '🙈 ' + w('hidden')) : null),
        h('span', { class:'grow' }),
        set.due ? h('small', { class:'cr-due' + (set.due < today() && (!st || st.state !== 'done') ? ' late' : '') }, w('due') + ' ' + fmtDate(set.due)) : null,
        st ? stateChip(st, it) : null);
      if(!isOpen) return h('div', { class:'cr-item' }, head);
      const go = h('a', { class:'btn primary', href:it.href, target:it.out ? '_blank' : null, rel:it.out ? 'noopener' : null, title:it.out ? w('newTab') : null }, it.icon + ' ' + w('open') + (it.out ? ' ↗' : ''));
      const tools = teacher ? [
        it.teacher ? h('a', { class:'btn', href:it.teacher }, '📊 ' + w('progress')) : null,
        h('button', { class:'btn', type:'button', onclick:async () => { room = await put('/room/' + period + '/work/' + it.id, { ...set, hidden:!set.hidden }); workView(period); } },
          set.hidden ? '👁 ' + w('show') : '🙈 ' + w('hide')),
        h('label', { class:'cr-duein' }, '📅 ' + w('setDue') + ' ', h('input', { type:'date', class:'inp sm', value:set.due || '', onchange:async e => {
          room = await put('/room/' + period + '/work/' + it.id, { ...set, due:e.target.value || null }); workView(period);
        } }))] : [];
      return h('div', { class:'cr-item open' }, head,
        h('div', { class:'cr-item-body' },
          h('small', { class:'cr-kind' }, it.kind === 'assignment' ? '📋 ' + w('assignment') : '📎 ' + w('material')),
          h('p', {}, L(it.line)), st ? h('div', { class:'cr-st' }, bar(st.pct), h('small', {}, st.text)) : null,
          h('div', { class:'cr-item-btns' }, go, ...tools)));
    };
    app.replaceChildren(topbar(period, 'work'), h('main', { class:'cr-main narrow' },
      ...TOPICS.map(tp => {
        const items = tp.items.filter(visible);
        return items.length ? h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, h('span', {}, tp.icon), L(tp.title)), ...items.map(row)) : null;
      })));
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
    const cols = ASSIGNMENTS.filter(visible);
    const cell = (it, r) => {
      const st = status(it, r), due = setting(it).due;
      const late = st.state !== 'done' && due && due < today();
      return h('td', { class:'cr-g ' + st.state + (late ? ' late' : ''), title:st.text }, st.state === 'none' ? (late ? w('missing') : '—') : st.pct + '%');
    };
    const avg = it => rows.length ? Math.round(rows.reduce((n, r) => n + status(it, r).pct, 0) / rows.length) : 0;
    main.replaceChildren(h('div', { class:'twrap cr-gwrap' }, h('table', { class:'ttable cr-gtable' },
      h('thead', {}, h('tr', {}, h('th', {}, w('name')), ...cols.map(it => h('th', { title:L(it.title) },
        h('span', { class:'cr-gh-ico' }, it.icon), h('span', { class:'cr-gh-t' }, L(it.title)), setting(it).due ? h('small', {}, w('due') + ' ' + fmtDate(setting(it).due)) : null))),
        h('tr', { class:'cr-avg' }, h('td', {}, w('avg')), ...cols.map(it => h('td', {}, avg(it) + '%')))),
      h('tbody', {}, ...rows.map(r => h('tr', {}, h('td', {}, h('b', {}, r.name), h('div', { class:'muted' }, r.username)), ...cols.map(it => cell(it, r))))))));
  }

  /* ------------------------------------------------- my work (a student) */
  function myWorkView(period){
    const items = ASSIGNMENTS.filter(visible);
    app.replaceChildren(topbar(period, 'grades'), h('main', { class:'cr-main narrow' },
      h('section', { class:'cr-topic' }, h('h2', { class:'cr-topic-h' }, '📋 ' + w('myWork')),
        ...items.map(it => { const st = status(it, mine);
          return h('a', { class:'cr-item cr-mine', href:it.href },
            h('span', { class:'cr-item-ico' }, it.icon), h('div', { class:'cr-mine-t' }, h('b', {}, L(it.title)), h('div', { class:'cr-st' }, bar(st.pct), h('small', {}, st.text))),
            h('span', { class:'grow' }), setting(it).due ? h('small', { class:'cr-due' }, w('due') + ' ' + fmtDate(setting(it).due)) : null, stateChip(st, it)); }))));
  }

  route();
})();
