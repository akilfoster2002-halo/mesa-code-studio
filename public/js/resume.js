/* =====================================================================
   MY RESUME — a code editor for the student's resume.html, with the page
   it makes beside it. The way they learned it in class:
   Edit → Save → Refresh (Save, or Ctrl+S, saves and refreshes the page;
   it also saves by itself a moment after typing stops).

   The code is coloured by a <pre> under a see-through <textarea> (the
   textarea does the typing; the pre only draws). Saved with the Learn
   progress (/api/learn, html.site). Turned in (html.siteIn) = read only,
   until Unsubmit in the Classroom. A teacher: ?u=<username>, read only.
   At /wiki it is the Website Presentation's character.html instead (html.wiki):
   it starts as the Mario page, and the student changes it to their character.
   Pictures: 🖼 Add picture (or paste or drop one on the code) makes it smaller,
   keeps it in the asset store and puts it in the page as <img src="https://…/api/assets/…">.
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const HL = window.HTMLLESSONS;
  const S = /^\/wiki/.test(location.pathname) ? HL.SITES.wiki : HL.SITES.site, k = S.key;
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
    empty:{ en:'Start typing your ' + S.file + ' here…', es:'Empieza a escribir tu ' + S.file + ' aquí…' },
    character:{ en:'Your character', es:'Tu personaje' },
    addPic:{ en:'Add picture', es:'Añadir imagen' }, picAdding:{ en:'Adding picture…', es:'Añadiendo imagen…' },
    picFail:{ en:'Picture not added. Try again.', es:'No se añadió la imagen. Inténtalo otra vez.' },
    picHint:{ en:'Put a picture in the page from your computer. You can also paste one or drop it on the code.', es:'Pon una imagen de tu computadora en la página. También puedes pegarla o soltarla en el código.' },
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

  /* ------------------------------------------------------- pictures
     made at most 800 px wide or tall (a phone photo is megabytes), then
     kept in the asset store; a moving GIF or an SVG stays as it is */
  async function shrink(file){
    if(!/^image\/(png|jpeg|webp|bmp|avif)$/.test(file.type)) return file;
    const img = await createImageBitmap(file).catch(() => null);
    if(!img) return file;
    const k = Math.min(1, 800 / Math.max(img.width, img.height));
    if(k === 1 && file.size < 400000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(b => r(b || file), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
  }
  async function upload(file){
    const blob = await shrink(file);
    const r = await fetch('/api/assets', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':blob.type }, body:blob });
    if(!r.ok) throw new Error('upload');
    return location.origin + '/api/assets/' + (await r.json()).id;      // the whole address: a short /api/… does not load in the page's frame
  }

  /* --------------------------------------------------------- the page */
  async function start(){
    let me;
    try { me = await api('/me'); } catch(e){ me = null; }
    if(!me) return app.replaceChildren(h('div', { class:'rs-msg' }, h('b', {}, '🔑 ' + w('login')), h('a', { class:'rs-btn primary', href:'/' }, w('open'))));
    const who = new URLSearchParams(location.search).get('u');
    let text = '', turnedIn = false, owner = me.name, readOnly = false, character = '', fresh = false;
    if(who && me.role === 'teacher'){
      const r = await api('/admin/site/' + encodeURIComponent(who) + '?f=' + k);
      text = r.html; owner = r.name; readOnly = true; character = r.who || '';
    } else {
      const r = await api('/learn');
      const x = ((r && r.data) || {}).html || {};
      text = x[k] || ''; turnedIn = !!x[k + 'In']; readOnly = turnedIn || me.role === 'teacher';
      character = S.who ? x[S.who] || '' : '';
      // the Website Presentation starts as the Mario page (saved as soon as it opens)
      if(!text && S.start && !readOnly){ text = S.start; fresh = true; }
    }
    editor({ me, text, owner, readOnly, turnedIn, character, fresh, teacherView:!!who });
  }

  function editor(o){
    let saved = o.fresh ? '' : o.text, timer = null;
    const ed = h('textarea', { class:'rs-input', spellcheck:'false', autocapitalize:'off', autocomplete:'off', autocorrect:'off', wrap:'off',
      placeholder:w('empty'), 'aria-label':S.file, maxlength:HL.SITE_MAX });
    ed.value = o.text; ed.readOnly = o.readOnly;
    const hl = h('pre', { class:'rs-hl', 'aria-hidden':'true' });
    const gutter = h('div', { class:'rs-gutter', 'aria-hidden':'true' });
    const status = h('span', { class:'rs-status' });
    const frame = h('iframe', { class:'rs-frame', sandbox:'allow-same-origin', title:w('page') });   // no scripts; same origin so its pictures load
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
      tabTitle.textContent = t && t.trim() ? t.trim() : S.file;
      document.title = (t && t.trim() ? t.trim() + ' · ' : '') + S.file;
      const has = S.info(ed.value, o.character).has;
      checks.replaceChildren(h('span', { class:'rs-checks-l' }, w('has')),
        ...S.groups.flatMap(g => [h('span', { class:'rs-checks-g' }, g.n + ':'),
          ...S.parts.filter(p => p.group === g.n).map(p => h('span', { class:'rs-chip' + (has.includes(p.id) ? ' ok' : ''), title:p.say ? L(p.say) : null }, (has.includes(p.id) ? '✓ ' : '') + p.en))]));
    };
    const save = async () => {
      clearTimeout(timer);
      if(o.readOnly) return refresh();
      if(ed.value === saved){ setStatus('saved'); return refresh(); }
      const text = ed.value;
      setStatus('saving');
      try { await api('/learn', { method:'PUT', body:JSON.stringify({ data:{ html:{ [k]:text } } }) }); saved = text; setStatus(ed.value === saved ? 'saved' : 'edited'); refresh(); }
      catch(e){ setStatus('offline'); timer = setTimeout(save, 5000); }
    };
    ed.addEventListener('input', () => { draw(); setStatus('edited'); clearTimeout(timer); timer = setTimeout(save, 2000); });
    // a picture goes where the cursor is in a src="…", else in place of the Mario page's first picture left, else in a new <img> at the cursor
    const addPicture = async file => {
      if(o.readOnly || !file || !/^image\//.test(file.type)) return;
      const at = ed.selectionStart, end = ed.selectionEnd;
      status.textContent = '⏳ ' + w('picAdding'); status.className = 'rs-status saving';
      let src;
      try { src = await upload(file); } catch(e){ status.textContent = '⚠ ' + w('picFail'); status.className = 'rs-status offline'; return; }
      const v = ed.value, ls = v.lastIndexOf('\n', at - 1) + 1, le = v.indexOf('\n', at) < 0 ? v.length : v.indexOf('\n', at);
      const inSrc = [...v.slice(ls, le).matchAll(/src\s*=\s*(["'])([^"']*)\1/gi)].map(m => ({ from:ls + m.index + m[0].indexOf(m[1]) + 1, len:m[2].length }))
        .find(m => at >= m.from && at <= m.from + m.len);
      const spot = v.match(new RegExp('src="(' + HL.WIKI_PIC.replace(/\//g, '\\/') + '[^"]*)"'));    // the first Mario picture left
      if(inSrc) ed.setRangeText(src, inSrc.from, inSrc.from + inSrc.len, 'end');
      else if(spot) ed.setRangeText(src, spot.index + 5, spot.index + 5 + spot[1].length, 'end');
      else ed.setRangeText('<img src="' + src + '" alt="">', at, end, 'end');
      ed.focus(); ed.dispatchEvent(new Event('input')); save();
    };
    const picker = h('input', { type:'file', accept:'image/*', hidden:true, onchange:e => { addPicture(e.target.files[0]); e.target.value = ''; } });
    ed.addEventListener('paste', e => { const f = [...(e.clipboardData && e.clipboardData.files || [])].find(f => /^image\//.test(f.type)); if(f){ e.preventDefault(); addPicture(f); } });
    ed.addEventListener('dragover', e => { if(!o.readOnly && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    ed.addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(f => /^image\//.test(f.type)); if(f){ e.preventDefault(); addPicture(f); } });
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

    const back = o.teacherView ? null : h('a', { class:'rs-btn ghost', href:'/#/c/' + encodeURIComponent(o.me.period || '') + '/a/' + S.item }, '◀ ' + w('back'));
    const langBtn = h('button', { class:'rs-btn ghost', type:'button', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); location.reload(); } }, I18N.lang === 'es' ? 'EN' : 'ES');
    app.replaceChildren(h('div', { class:'rs' },
      h('header', { class:'rs-top' },
        h('span', { class:'rs-logo' }, '</>'),
        h('div', { class:'rs-file' }, h('b', {}, S.file), h('small', {}, o.owner + (o.readOnly ? ' · ' + w('readOnly') : ''))),
        o.character ? h('span', { class:'rs-who' }, '🎭 ' + w('character') + ': ', h('b', {}, o.character)) : null,
        o.readOnly ? null : status, h('span', { class:'grow' }), langBtn, back,
        o.readOnly ? null : h('button', { class:'rs-btn', type:'button', title:w('picHint'), onclick:() => picker.click() }, '🖼 ' + w('addPic')), o.readOnly ? null : picker,
        o.readOnly ? null : h('button', { class:'rs-btn primary', type:'button', onclick:save, title:'Ctrl+S' }, '💾 ' + w('save'), h('kbd', {}, /Mac/.test(navigator.platform) ? '⌘S' : 'Ctrl S'))),
      o.turnedIn ? h('div', { class:'rs-banner' }, '🔒 ' + w('turnedIn')) : null,
      h('main', { class:'rs-main' },
        h('section', { class:'rs-pane rs-code' }, h('div', { class:'rs-pane-h' }, h('span', { class:'rs-dot' }), w('code'), h('span', { class:'grow' }), pos),
          h('div', { class:'rs-ed' }, gutter, h('div', { class:'rs-layers' }, hl, ed))),
        h('section', { class:'rs-pane rs-view' },
          h('div', { class:'rs-chrome' }, h('i'), h('i'), h('i'), h('span', { class:'rs-tab' }, h('span', { class:'rs-fav' }), tabTitle),
            h('span', { class:'grow' }), h('button', { class:'rs-reload', type:'button', title:'Refresh', onclick:save }, '↻')),
          h('div', { class:'rs-url' }, h('span', {}, '🔒'), S.file),
          frame)),
      h('footer', { class:'rs-foot' }, checks)));
    setStatus(o.fresh ? 'edited' : 'saved'); draw(); refresh();
    if(o.fresh) save();
    if(!o.readOnly){ ed.focus(); ed.setSelectionRange(0, 0); ed.scrollTop = 0; where(); }
  }

  start();
})();
