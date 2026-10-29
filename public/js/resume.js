/* =====================================================================
   MY RESUME — a code editor for the student's resume.html, with the page
   it makes beside it. The way they learned it in class:
   Edit → Save → Refresh (Save, or Ctrl+S, saves and refreshes the page;
   it also saves by itself a moment after typing stops).

   The code is coloured by a <pre> under a see-through <textarea> (the
   textarea does the typing; the pre only draws). Saved with the Learn
   progress (/api/learn, html.site). Turned in (html.siteIn) = read only,
   until Unsubmit in the Classroom. A teacher: ?u=<username>, read only.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const HL = window.HTMLLESSONS;
  const app = $('#app');
  const L = o => (I18N.lang === 'es' && o.es) || o.en;
  const W = {
    saved:{ en:'Saved', es:'Guardado' }, saving:{ en:'Saving…', es:'Guardando…' }, edited:{ en:'Not saved', es:'Sin guardar' },
    offline:{ en:'Not saved: no connection', es:'Sin guardar: no hay conexión' },
    save:{ en:'Save & refresh', es:'Guardar y actualizar' }, back:{ en:'Classroom', es:'Clase' },
    page:{ en:'Your page', es:'Tu página' }, code:{ en:'Your code', es:'Tu código' },
    turnedIn:{ en:'Turned in. To make changes, Unsubmit in the Classroom.', es:'Entregado. Para hacer cambios, anula la entrega en la Clase.' },
    viewing:{ en:'Viewing', es:'Viendo' }, readOnly:{ en:'read only', es:'solo lectura' },
    login:{ en:'Log in to the Classroom first.', es:'Primero inicia sesión en la Clase.' }, open:{ en:'Open the Classroom', es:'Abrir la Clase' },
    empty:{ en:'Start typing your resume.html here…', es:'Empieza a escribir tu resume.html aquí…' },
    line:{ en:'Ln', es:'Lín' }, col:{ en:'Col', es:'Col' }, has:{ en:'Your page has', es:'Tu página tiene' }
  };
  const w = k => L(W[k]);
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status });
    return j;
  }

  /* ------------------------------------------------- colour the code
     HTML tags, their attributes and values, comments, and the CSS inside
     <style> (selectors, properties, values). Returns safe HTML. */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, s) => '<span class="t-' + cls + '">' + esc(s) + '</span>';
  function tag(t){
    const m = t.match(/^(<\/?)([!\w-]*)([\s\S]*?)(\/?>)?$/);
    if(!m) return esc(t);
    // the rest of the tag: attribute names and their "values" (a lone = or quote is safe as it is)
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
    return out + esc(src.slice(i)) + '\n';
  }

  /* --------------------------------------------------------- the page */
  async function start(){
    let me;
    try { me = await api('/me'); } catch(e){ me = null; }
    if(!me) return app.replaceChildren(h('div', { class:'rs-msg' }, h('b', {}, '🔑 ' + w('login')), h('a', { class:'rs-btn primary', href:'/' }, w('open'))));
    const who = new URLSearchParams(location.search).get('u');
    let text = '', turnedIn = false, owner = me.name, readOnly = false;
    if(who && me.role === 'teacher'){
      const r = await api('/admin/site/' + encodeURIComponent(who));
      text = r.html; owner = r.name; readOnly = true;
    } else {
      const r = await api('/learn');
      const x = ((r && r.data) || {}).html || {};
      text = x.site || ''; turnedIn = !!x.siteIn; readOnly = turnedIn || me.role === 'teacher';
    }
    editor({ me, text, owner, readOnly, turnedIn, teacherView:!!who });
  }

  function editor(o){
    let saved = o.text, timer = null;
    const ed = h('textarea', { class:'rs-input', spellcheck:'false', autocapitalize:'off', autocomplete:'off', autocorrect:'off', wrap:'off',
      placeholder:w('empty'), 'aria-label':'resume.html', maxlength:HL.SITE_MAX });
    ed.value = o.text; ed.readOnly = o.readOnly;
    const hl = h('pre', { class:'rs-hl', 'aria-hidden':'true' });
    const gutter = h('div', { class:'rs-gutter', 'aria-hidden':'true' });
    const status = h('span', { class:'rs-status' });
    const frame = h('iframe', { class:'rs-frame', sandbox:'', title:w('page') });
    const tabTitle = h('span', { class:'rs-tabt' });
    const pos = h('span', { class:'rs-pos' });
    const checks = h('div', { class:'rs-checks' });
    const setStatus = (k, cls) => { status.textContent = (k === 'saved' ? '✓ ' : k === 'offline' ? '⚠ ' : '') + w(k); status.className = 'rs-status ' + (cls || k); };
    const draw = () => {
      hl.innerHTML = paint(ed.value);
      const n = ed.value.split('\n').length;
      if(gutter.childElementCount !== n) gutter.replaceChildren(...Array.from({ length:n }, (x, i) => h('div', {}, String(i + 1))));
      sync(); where();
    };
    const sync = () => { hl.scrollTop = ed.scrollTop; hl.scrollLeft = ed.scrollLeft; gutter.scrollTop = ed.scrollTop; };
    const where = () => { const before = ed.value.slice(0, ed.selectionStart).split('\n');
      pos.textContent = w('line') + ' ' + before.length + ', ' + w('col') + ' ' + (before[before.length - 1].length + 1);
      [...gutter.children].forEach((d, k) => d.classList.toggle('on', k === before.length - 1)); };
    // the page beside it: what the browser shows, and its <title> on the tab
    const refresh = () => {
      frame.srcdoc = ed.value;
      const t = (ed.value.match(/<title>([^<]*)<\/title>/i) || [])[1];
      tabTitle.textContent = t && t.trim() ? t.trim() : 'resume.html';
      document.title = (t && t.trim() ? t.trim() + ' · ' : '') + 'resume.html';
      const has = HL.siteInfo(ed.value).has;
      checks.replaceChildren(h('span', { class:'rs-checks-l' }, w('has')),
        ...HL.SITE_PARTS.map(p => h('span', { class:'rs-chip' + (has.includes(p.id) ? ' ok' : '') }, (has.includes(p.id) ? '✓ ' : '') + p.en)));
    };
    const save = async () => {
      clearTimeout(timer);
      if(o.readOnly) return refresh();
      if(ed.value === saved){ setStatus('saved'); return refresh(); }
      const text = ed.value;
      setStatus('saving');
      try { await api('/learn', { method:'PUT', body:JSON.stringify({ data:{ html:{ site:text } } }) }); saved = text; setStatus(ed.value === saved ? 'saved' : 'edited'); refresh(); }
      catch(e){ setStatus('offline'); timer = setTimeout(save, 5000); }
    };
    ed.addEventListener('input', () => { draw(); setStatus('edited'); clearTimeout(timer); timer = setTimeout(save, 2000); });
    ed.addEventListener('scroll', sync);
    ['keyup', 'click', 'select'].forEach(k => ed.addEventListener(k, where));
    ed.addEventListener('keydown', e => {
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); save(); return; }
      if(o.readOnly) return;
      if(e.key === 'Tab'){ e.preventDefault(); ed.setRangeText('  ', ed.selectionStart, ed.selectionEnd, 'end'); ed.dispatchEvent(new Event('input')); }
      if(e.key === 'Enter' && !e.shiftKey){                // keep the line's indent
        const line = ed.value.slice(0, ed.selectionStart).split('\n').pop();
        const indent = line.match(/^\s*/)[0];
        if(indent){ e.preventDefault(); ed.setRangeText('\n' + indent, ed.selectionStart, ed.selectionEnd, 'end'); ed.dispatchEvent(new Event('input')); }
      }
    });
    addEventListener('beforeunload', e => { if(!o.readOnly && ed.value !== saved){ save(); e.preventDefault(); } });

    const back = o.teacherView ? null : h('a', { class:'rs-btn ghost', href:'/#/c/' + encodeURIComponent(o.me.period || '') + '/a/site' }, '◀ ' + w('back'));
    const langBtn = h('button', { class:'rs-btn ghost', type:'button', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); location.reload(); } }, I18N.lang === 'es' ? 'EN' : 'ES');
    app.replaceChildren(h('div', { class:'rs' },
      h('header', { class:'rs-top' },
        h('span', { class:'rs-logo' }, '</>'),
        h('div', { class:'rs-file' }, h('b', {}, 'resume.html'), h('small', {}, o.owner + (o.readOnly ? ' · ' + w('readOnly') : ''))),
        o.readOnly ? null : status, h('span', { class:'grow' }), langBtn, back,
        o.readOnly ? null : h('button', { class:'rs-btn primary', type:'button', onclick:save, title:'Ctrl+S' }, '💾 ' + w('save'), h('kbd', {}, /Mac/.test(navigator.platform) ? '⌘S' : 'Ctrl S'))),
      o.turnedIn ? h('div', { class:'rs-banner' }, '🔒 ' + w('turnedIn')) : null,
      h('main', { class:'rs-main' },
        h('section', { class:'rs-pane rs-code' }, h('div', { class:'rs-pane-h' }, h('span', { class:'rs-dot' }), w('code'), h('span', { class:'grow' }), pos),
          h('div', { class:'rs-ed' }, gutter, h('div', { class:'rs-layers' }, hl, ed))),
        h('section', { class:'rs-pane rs-view' },
          h('div', { class:'rs-chrome' }, h('i'), h('i'), h('i'), h('span', { class:'rs-tab' }, h('span', { class:'rs-fav' }), tabTitle),
            h('span', { class:'grow' }), h('button', { class:'rs-reload', type:'button', title:'Refresh', onclick:save }, '↻')),
          h('div', { class:'rs-url' }, h('span', {}, '🔒'), 'resume.html'),
          frame)),
      h('footer', { class:'rs-foot' }, checks)));
    setStatus('saved'); draw(); refresh();
    if(!o.readOnly) ed.focus();
  }

  start();
})();
