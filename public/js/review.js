/* =====================================================================
   REVIEW — the teacher's grading screen for a typed page (My Resume,
   Website Presentation, Game Website), like Google Classroom's: the whole
   class loads at once (GET /api/room/:p/review/:site), so ◀ ▶ (or the
   arrow keys) go from student to student straight away.

     • One student: their page as a browser shows it (with their pictures),
       or their code, or both side by side; on the right, their progress
       by Part, what is missing, the suggested rubric level (My Resume),
       clean-code flags, last saved, and a 1–4 grade only the teacher sees.
     • Grid: a small preview of every page with its level, to see who is
       behind at a glance; click one to open it.

   Read only: nothing here changes a student's page (except ✏️ hints, which
   the teacher asks for, the same as in Student work). Open in editor goes
   to the student's page in the editor, where the teacher can change it and
   see its History.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const HL = window.HTMLLESSONS;
  const app = $('#app');
  const NAMES = { site:'My Resume', wiki:'Website Presentation', game:'Game Website' };
  const store = { get:k => { try { return localStorage.getItem('review.' + k); } catch(e){ return null; } },
    set:(k, v) => { try { localStorage.setItem('review.' + k, v); } catch(e){} } };

  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status, body:j });
    return j;
  }
  const send = (path, body, method='PUT') => api(path, { method, body:JSON.stringify(body) });

  /* ---------------------------------------------------- colour the code
     (the same colours as the editor: tags, attributes, comments, CSS) */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, s) => '<span class="t-' + cls + '">' + esc(s) + '</span>';
  function tag(t){
    const m = t.match(/^(<\/?)([!\w-]*)([\s\S]*?)(\/?>)?$/);
    if(!m) return esc(t);
    const attrs = m[3].replace(/(\s+)|([^\s="']+)(\s*=\s*)?("[^"]*"?|'[^']*'?|[^\s"']+)?/g,
      (all, ws, name, eq, val) => ws ? ws : span('attr', name) + (eq ? esc(eq) : '') + (val ? span('str', val) : ''));
    return span('punc', m[1]) + span(m[2].startsWith('!') ? 'doc' : 'tag', m[2]) + attrs + (m[4] ? span('punc', m[4]) : '');
  }
  function css(c){
    let out = '';
    for(const part of c.split(/(\/\*[\s\S]*?(?:\*\/|$)|\{[^{}]*\}?)/)){
      if(!part) continue;
      if(part.startsWith('/*')) out += span('com', part);
      else if(part.startsWith('{')) out += span('punc', '{') + part.slice(1).replace(/\}$/, '').split(/(;)/).map(d => {
        const m = d.match(/^(\s*)([\w-]+)(\s*:)([\s\S]*)$/);
        return m ? esc(m[1]) + span('prop', m[2]) + esc(m[3]) + span('val', m[4]) : esc(d);
      }).join('') + (part.endsWith('}') ? span('punc', '}') : '');
      else out += span('sel', part);
    }
    return out;
  }
  function paint(src){
    let out = '', i = 0;
    const re = /<!--[\s\S]*?(?:-->|$)|<style\b[^>]*>[\s\S]*?(?=<\/style|$)|<\/?[!\w][^<>]*>?/gi;
    for(let m; (m = re.exec(src));){
      out += esc(src.slice(i, m.index));
      const t = m[0];
      if(t.startsWith('<!--')) out += span('com', t);
      else if(/^<style/i.test(t)){ const open = t.match(/^<style\b[^>]*>/i)[0]; out += tag(open) + css(t.slice(open.length)); }
      else out += tag(t);
      i = m.index + t.length;
    }
    return out + esc(src.slice(i));
  }

  /* -------------------------------------------------------------- helpers */
  const when = iso => { if(!iso) return ''; const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' }); };
  const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const COLORS = ['#1e8e3e', '#1967d2', '#d93025', '#e37400', '#9334e6', '#129eaf', '#c26401', '#5f6368'];
  const colorOf = u => COLORS[[...String(u)].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];
  const avatar = st => h('span', { class:'rv-av', style:{ background:colorOf(st.username) } }, initials(st.name));

  // a student's progress: by Part, with the suggested level for My Resume
  function progress(S, st){
    if(S.key === 'site'){
      const r = HL.resumeLevel(st.text);
      return { ...r, parts:HL.RUBRIC_PARTS, done:r.groups.reduce((n, g) => n + g.done, 0), total:r.groups.reduce((n, g) => n + g.total, 0) };
    }
    const has = S.info(st.text, S.who ? st.who : '').has;
    const groups = S.groups.map(g => { const ps = S.parts.filter(p => p.group === g.n), miss = ps.filter(p => !has.includes(p.id));
      return { n:g.n, total:ps.length, done:ps.length - miss.length, missing:miss.map(p => p.id) }; });
    return { level:null, groups, flags:[], extras:[], parts:S.parts, done:has.length, total:S.parts.length };
  }
  function status(d, st){
    if(st.in) return { cls:'in', text:'Turned in', sub:when(st.in) };
    if(st.extension) return { cls:'ext', text:'Extension', sub:'' };
    if(d.locked) return { cls:'locked', text:'Locked', sub:'' };
    if(!st.text.trim()) return { cls:'none', text:'Not started', sub:'' };
    return { cls:'prog', text:'In progress', sub:'' };
  }
  const levelChip = (P, big) => P.level == null ? null :
    h('span', { class:'rv-level l' + P.level + (big ? ' big' : ''), title:P.why || '' }, P.level ? String(P.level) : '–');
  const bar = pct => h('span', { class:'rv-bar' }, h('i', { style:{ width:Math.round(pct * 100) + '%' } }));

  /* --------------------------------------------------------------- start */
  let d, S, period, view, mode, sort, cur = 0, P = [];
  async function start(){
    let me = null;
    try { me = await api('/me'); } catch(e){}
    if(!me || me.role !== 'teacher') return app.replaceChildren(h('div', { class:'rv-msg' }, h('b', {}, '🔑 Only the teacher can open Review.'), h('a', { class:'rv-btn primary', href:'/' }, 'Open the Classroom')));
    const q = new URLSearchParams(location.search);
    const periods = await api('/room').catch(() => []);
    period = q.get('p') && periods.includes(q.get('p')) ? q.get('p') : periods[0];
    S = HL.SITES[Object.prototype.hasOwnProperty.call(HL.SITES, q.get('s')) ? q.get('s') : 'site'];
    view = q.get('v') === 'grid' ? 'grid' : 'one';
    mode = ['page', 'code', 'both', 'editor'].includes(store.get('mode')) ? store.get('mode') : 'page';
    sort = ['az', 'level'].includes(store.get('sort')) ? store.get('sort') : 'az';
    if(!period) return app.replaceChildren(h('div', { class:'rv-msg' }, h('b', {}, 'No classes yet.')));
    await load(q.get('u'), periods);
    addEventListener('keydown', e => {
      if(e.target.closest && e.target.closest('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if(e.key === 'ArrowRight' && view === 'one'){ e.preventDefault(); go(1); }
      if(e.key === 'ArrowLeft' && view === 'one'){ e.preventDefault(); go(-1); }
      if(e.key === 'g'){ setView(view === 'grid' ? 'one' : 'grid'); }
    });
  }

  async function load(username, periods){
    app.replaceChildren(h('div', { class:'rv-msg' }, 'Loading ' + NAMES[S.key] + ' · Period ' + period + '…'));
    try { d = await api('/room/' + encodeURIComponent(period) + '/review/' + S.key); }
    catch(e){ return app.replaceChildren(h('div', { class:'rv-msg' }, h('b', {}, 'Could not load the class. Refresh to try again.'))); }
    order();
    cur = Math.max(0, d.students.findIndex(st => st.username === username));
    draw(periods);
  }
  // the order of the students: A–Z, or the lowest level first (the ones who need help on top)
  function order(){
    for(const st of d.students) st.p = progress(S, st);
    d.students.sort((a, b) => sort === 'level'
      ? ((a.p.level == null ? a.p.done / (a.p.total || 1) : a.p.level) - (b.p.level == null ? b.p.done / (b.p.total || 1) : b.p.level)) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));
    P = d.students.map(st => st.p);
  }
  const url = () => { const q = new URLSearchParams({ p:period, s:S.key }); if(view === 'grid') q.set('v', 'grid');
    else if(d.students[cur]) q.set('u', d.students[cur].username); history.replaceState(null, '', '/review?' + q); };
  function go(n){ if(!d.students.length) return; const was = d.students[cur]; cur = (cur + n + d.students.length) % d.students.length; drawOne(); if(mode === 'editor') fresh(was); }
  // after the editor (where the teacher can type in the page), get that student's page as it is now
  async function fresh(st){
    try { const r = await api('/page/' + encodeURIComponent(st.username) + '/' + S.key); st.text = r.text || ''; st.files = r.files || {}; }
    catch(e){ return; }
    st.p = progress(S, st); P = d.students.map(x => x.p);
    if(view === 'one' && d.students[cur] === st && mode !== 'editor') drawOne();
  }
  function setView(v){ view = v; draw(); }

  /* ------------------------------------------------------------- the top */
  let periodsList = [];
  function draw(periods){
    if(periods) periodsList = periods;
    const sel = (value, opts, on) => h('select', { class:'rv-sel', onchange:e => on(e.target.value) }, ...opts.map(([v, t]) => h('option', { value:v, selected:v === value }, t)));
    const top = h('header', { class:'rv-top' },
      h('a', { class:'rv-x', href:'/#/c/' + encodeURIComponent(period) + '/a/' + S.item, title:'Back to the Classroom' }, '✕'),
      h('div', { class:'rv-title' }, h('b', {}, 'Review'), h('small', {}, NAMES[S.key] + (d.locked ? ' · locked' : '') + (d.due ? ' · due ' + d.due : ''))),
      sel(period, periodsList.map(p => [p, 'Period ' + p]), v => { period = v; load(null); }),
      sel(S.key, Object.keys(NAMES).map(k => [k, NAMES[k]]), v => { S = HL.SITES[v]; load(null); }),
      h('div', { class:'rv-seg' }, ...[['one', 'One student'], ['grid', 'Grid']].map(([v, t]) =>
        h('button', { type:'button', class:view === v ? 'on' : '', onclick:() => setView(v) }, t))),
      h('span', { class:'grow' }),
      h('button', { class:'rv-btn ghost', type:'button', title:'Sort the students', onclick:() => {
        const u = (d.students[cur] || {}).username; sort = sort === 'az' ? 'level' : 'az'; store.set('sort', sort); order();
        cur = Math.max(0, d.students.findIndex(st => st.username === u)); draw(); } }, sort === 'az' ? 'A–Z' : S.key === 'site' ? 'Lowest level first' : 'Least done first'),
      summary());
    const body = h('div', { class:'rv-body' });
    app.replaceChildren(h('div', { class:'rv' }, top, body));
    if(!d.students.length) return body.append(h('div', { class:'rv-msg' }, 'No students in this period.'));
    view === 'grid' ? drawGrid(body) : drawOne(body);
  }
  // how many at each level (My Resume), or how many are done
  function summary(){
    if(S.key === 'site'){ const n = [0, 1, 2, 3, 4].map(l => P.filter(p => p.level === l).length);
      return h('div', { class:'rv-sum' }, ...[4, 3, 2, 1].map(l => h('span', { class:'rv-level l' + l + ' sm', title:'Level ' + l + ': ' + HL.RUBRIC_LEVELS[l] }, l + ' × ' + n[l])),
        n[0] ? h('small', {}, n[0] + ' not started') : null); }
    return h('div', { class:'rv-sum' }, h('small', {}, P.filter(p => p.done === p.total).length + ' of ' + P.length + ' done'));
  }

  /* --------------------------------------------------------- one student */
  let oneBox;
  function drawOne(box){
    if(box) oneBox = box; box = oneBox; if(!box) return;
    const st = d.students[cur], p = P[cur], s = status(d, st);
    url();
    const files = HL.filesOf(S, { [S.key + 'Files']:st.files });
    const frame = h('iframe', { class:'rv-frame', sandbox:'allow-same-origin', title:st.name + ' · ' + S.file });
    frame.srcdoc = st.text.trim() ? HL.withFiles(st.text, files, location.origin) : '<p style="font:15px system-ui;color:#5f6368;padding:24px">Nothing typed yet.</p>';
    const lines = st.text.split('\n');
    const code = h('div', { class:'rv-code' }, h('pre', { class:'rv-gut' }, lines.map((x, i) => i + 1).join('\n')), h('pre', { class:'rv-src', html:paint(st.text) || ' ' }));
    const modes = h('div', { class:'rv-seg small' }, ...[['page', 'Page'], ['code', 'Code'], ['both', 'Both'], ['editor', 'Editor']].map(([v, t]) =>
      h('button', { type:'button', class:mode === v ? 'on' : '', title:v === 'editor' ? 'Their editor, as they see it, with History (what you type here changes their page)' : null,
        onclick:() => { const left = mode === 'editor' && v !== 'editor'; mode = v; store.set('mode', v); drawOne(); if(left) fresh(st); } }, t)));
    const pick = h('select', { class:'rv-sel rv-who-sel', 'aria-label':'Student', onchange:e => { cur = Number(e.target.value); drawOne(); } },
      ...d.students.map((x, i) => h('option', { value:i, selected:i === cur }, x.name + (P[i].level != null ? '  ·  ' + (P[i].level || '–') : ''))));
    const bar1 = h('div', { class:'rv-bar1' },
      avatar(st), pick,
      h('button', { class:'rv-arrow', type:'button', title:'Previous student (←)', onclick:() => go(-1) }, '‹'),
      h('button', { class:'rv-arrow', type:'button', title:'Next student (→)', onclick:() => go(1) }, '›'),
      h('small', { class:'rv-count' }, (cur + 1) + ' of ' + d.students.length),
      h('span', { class:'rv-file' }, '</> ' + S.file),
      h('a', { class:'rv-btn ghost', href:S.path + '?u=' + encodeURIComponent(st.username), target:'_blank', rel:'noopener', title:'Open their page in the editor (History is there too)' }, 'Open in editor ↗'),
      h('span', { class:'grow' }), modes,
      h('span', { class:'rv-state ' + s.cls }, s.text));
    // Editor: the student's own editor (the code they typed, the page beside it, 🕘 History), right here
    const stage = mode === 'editor'
      ? h('div', { class:'rv-stage editor' }, h('iframe', { class:'rv-editor', src:S.path + '?u=' + encodeURIComponent(st.username), title:st.name + '’s editor' }))
      : h('div', { class:'rv-stage ' + mode }, mode !== 'code' ? h('div', { class:'rv-pagebox' }, frame) : null, mode !== 'page' ? code : null);
    box.replaceChildren(h('div', { class:'rv-one' }, bar1, h('div', { class:'rv-split' }, stage, panel(st, p, s))));
  }

  // the right side: grade, suggested level, flags, progress by Part
  function panel(st, p, s){
    const name = id => { const x = p.parts.find(q => q.id === id); return x ? (x.say ? x.say.en : x.en) : id; };
    const grade = h('div', { class:'rv-grade' }, ...[1, 2, 3, 4].map(g => h('button', { type:'button', class:'g' + g + (st.grade === g ? ' on' : ''),
      title:'Level ' + g + ': ' + HL.RUBRIC_LEVELS[g], onclick:async e => {
        const want = st.grade === g ? null : g, btns = e.target.parentNode.querySelectorAll('button');
        btns.forEach(b => b.disabled = true);
        try { const r = await send('/room/' + encodeURIComponent(period) + '/review/' + S.key + '/' + encodeURIComponent(st.username), { grade:want }); st.grade = r.grade; }
        catch(x){ alert('The grade was not saved. Try again.'); }
        drawOne();
      } }, String(g))));
    const hint = S.key === 'site' && !d.locked && !st.in && st.text.trim() && p.groups.slice(0, 3).some(g => g.missing.length)
      ? h('button', { class:'rv-btn ghost small', type:'button', title:'Put a ✏️ To do comment in their code for each Part 1–3 box not done yet', onclick:async e => {
        if(!confirm('Put ✏️ To do hints (Parts 1–3) in ' + st.name + '’s code?')) return;
        e.target.disabled = true;
        try { await send('/room/' + encodeURIComponent(period) + '/hints', { only:[st.username] }, 'POST'); } catch(x){ e.target.disabled = false; return alert('No hints were added.'); }
        load(st.username);
      } }, '✏️ Send hints') : null;
    return h('aside', { class:'rv-panel' },
      h('section', {}, h('h3', {}, 'Grade'), grade, h('small', { class:'muted' }, st.grade ? 'Saved. Only you see it. Click again to clear.' : 'Only you see this grade.')),
      p.level != null ? h('section', { class:'rv-suggest' }, h('h3', {}, 'Suggested level'),
        h('div', { class:'rv-sug-row' }, levelChip(p, true), h('div', {}, h('b', {}, p.level ? p.name : 'Not started'), h('p', {}, p.why))),
        p.close ? h('p', { class:'rv-close' }, '⭐ One step from Level ' + (p.level + 1) + (p.next.length === 1 ? ': ' + name(p.next[0]) : '')) : null) : null,
      st.drop ? h('section', { class:'rv-drop' }, h('b', {}, '⚠️ Most of this page was erased'),
        h('p', {}, when(st.drop.at) + ': ' + st.drop.from.toLocaleString() + ' → ' + st.drop.to.toLocaleString() + ' letters, and not typed back since. Open in editor → History to bring back an older copy.')) : null,
      p.flags.length ? h('section', {}, h('h3', {}, 'Clean code'), h('ul', { class:'rv-flags' }, ...p.flags.map(f => h('li', {}, f)))) : null,
      p.extras.length ? h('section', {}, h('h3', {}, 'Beyond the model page'), h('div', { class:'rv-tags' }, ...p.extras.map(x => h('code', {}, x)))) : null,
      h('section', {}, h('h3', {}, 'Progress', h('small', {}, p.done + ' / ' + p.total)),
        ...p.groups.map(g => { const G = (S.key === 'site' ? HL.SITE_GROUPS : S.groups).find(x => x.n === g.n);
          return h('details', { class:'rv-part' + (g.missing.length ? '' : ' all'), open:g.missing.length && g.done ? true : null },
            h('summary', {}, h('span', {}, G ? G.en : 'Part ' + g.n), bar(g.done / (g.total || 1)), h('small', {}, g.done + ' / ' + g.total)),
            g.missing.length ? h('ul', { class:'rv-miss' }, ...g.missing.map(id => h('li', {}, name(id)))) : h('p', { class:'muted' }, 'All done ✓')); })),
      h('section', { class:'rv-meta' },
        h('div', {}, h('span', {}, 'Status'), h('b', {}, s.text + (s.sub ? ' · ' + s.sub : ''))),
        h('div', {}, h('span', {}, 'Last saved'), h('b', {}, st.saved ? when(st.saved) : '—')),
        h('div', {}, h('span', {}, 'Length'), h('b', {}, st.text.length.toLocaleString() + ' letters · ' + (st.text ? st.text.split('\n').length : 0) + ' lines')),
        S.who ? h('div', {}, h('span', {}, 'Character'), h('b', {}, st.who || '—')) : null,
        hint));
  }

  /* --------------------------------------------------------------- grid */
  function drawGrid(box){
    url();
    const see = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
      if(e.isIntersecting){ const f = e.target; f.srcdoc = f.dataset.src; see.unobserve(f); } }), { rootMargin:'300px' }) : null;
    box.replaceChildren(h('div', { class:'rv-grid' }, ...d.students.map((st, i) => {
      const p = P[i], s = status(d, st);
      const f = h('iframe', { class:'rv-mini', sandbox:'allow-same-origin', tabindex:'-1', 'aria-hidden':'true', loading:'lazy' });
      f.dataset.src = st.text.trim() ? HL.withFiles(st.text, HL.filesOf(S, { [S.key + 'Files']:st.files }), location.origin) : '';
      if(see) see.observe(f); else f.srcdoc = f.dataset.src;
      return h('button', { class:'rv-card', type:'button', onclick:() => { cur = i; view = 'one'; draw(); } },
        h('div', { class:'rv-thumb' }, st.text.trim() ? f : h('span', { class:'rv-blank' }, 'Not started')),
        h('div', { class:'rv-card-b' }, avatar(st), h('div', { class:'rv-card-n' }, h('b', {}, st.name),
            h('small', {}, p.done + ' / ' + p.total + ' boxes' + (st.drop ? ' · ⚠️ erased' : '') + (p.close ? ' · ⭐ close' : ''))),
          levelChip(p), st.grade ? h('span', { class:'rv-mygrade', title:'Your grade' }, '✓ ' + st.grade) : null),
        h('div', { class:'rv-card-f' }, bar(p.done / (p.total || 1)), h('span', { class:'rv-state sm ' + s.cls }, s.text)));
    })));
  }

  start();
})();
