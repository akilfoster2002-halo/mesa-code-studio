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
   Pictures, as on a desktop: each page has a 📁 files folder beside it. ＋ Add picture
   (or paste or drop one on the code) makes it smaller, keeps it in the asset store,
   puts it in the folder by its file name and in the code as <img src="elsa.png">;
   the page beside the code shows the files where they are kept (HL.withFiles).
   Typing together (as in Google Docs): the page is kept at /api/page/<owner>/<key>.
   Every moment or so the editor sends what changed and gets everyone else's
   changes back (MERGE.merge3 puts them together). The Website Presentation's
   owner can 👥 Share it with classmates, who open it at /wiki?o=<owner>.
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
    picHint:{ en:'Put a picture from your computer in your files folder and in the page. You can also paste one or drop it on the code.', es:'Pon una imagen de tu computadora en tu carpeta de archivos y en la página. También puedes pegarla o soltarla en el código.' },
    files:{ en:'Files', es:'Archivos' }, nameIt:{ en:'Name your picture file (like elsa.png):', es:'Nombra tu archivo de imagen (como elsa.png):' },
    useIt:{ en:'Click to put it in the page at the cursor', es:'Haz clic para ponerla en la página donde está el cursor' },
    delFile:{ en:'Take this file out of the folder?', es:'¿Quitar este archivo de la carpeta?' }, full:{ en:'The folder is full (40 files).', es:'La carpeta está llena (40 archivos).' },
    line:{ en:'Ln', es:'Lín' }, col:{ en:'Col', es:'Col' }, has:{ en:'Your page has', es:'Tu página tiene' },
    share:{ en:'Share', es:'Compartir' }, shareH:{ en:'Share with classmates', es:'Compartir con compañeros' },
    shareHint:{ en:'They can type in your page too, at the same time as you.', es:'Ellos también pueden escribir en tu página, al mismo tiempo que tú.' },
    done:{ en:'Done', es:'Listo' }, cancel:{ en:'Cancel', es:'Cancelar' }, here:{ en:'Here now', es:'Aquí ahora' },
    notShared:{ en:'This page is not shared with you.', es:'Esta página no está compartida contigo.' },
    noClassmates:{ en:'No classmates yet.', es:'Todavía no hay compañeros.' }
  };
  const w = k => L(W[k]);
  async function api(path, opts={}){
    const r = await fetch('/api' + path, { credentials:'same-origin', ...opts, headers:{ ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if(!r.ok) throw Object.assign(new Error((j && j.error) || r.statusText), { status:r.status, body:j });
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
    return (await r.json()).id;
  }

  const COLORS = ['#1e8e3e', '#1967d2', '#d93025', '#e37400', '#9334e6', '#129eaf', '#c26401', '#5f6368'];
  const colorOf = u => COLORS[[...String(u)].reduce((n, c) => n + c.charCodeAt(0), 0) % COLORS.length];

  /* --------------------------------------------------------- the page */
  async function start(){
    let me;
    try { me = await api('/me'); } catch(e){ me = null; }
    if(!me) return app.replaceChildren(h('div', { class:'rs-msg' }, h('b', {}, '🔑 ' + w('login')), h('a', { class:'rs-btn primary', href:'/' }, w('open'))));
    // whose page: mine, a classmate's shared with me (?o=), or a student's for the teacher (?u=)
    const q = new URLSearchParams(location.search), teacherView = me.role === 'teacher';
    const owner = (teacherView ? q.get('u') : q.get('o')) || me.username;
    const doc = '/page/' + encodeURIComponent(owner) + '/' + k;
    let r;
    try { r = await api(doc); }
    catch(e){ return app.replaceChildren(h('div', { class:'rs-msg' }, h('b', {}, '🔒 ' + w('notShared')), h('a', { class:'rs-btn primary', href:'/' }, w('open')))); }
    const mine = owner === me.username, turnedIn = !!r.in, readOnly = turnedIn || !r.canEdit;
    // the Website Presentation starts as the Mario page (saved as soon as it opens)
    const fresh = !r.text && !!S.start && mine && !readOnly;
    editor({ me, doc, mine, text:fresh ? S.start : r.text, base:r.text, owner:r.owner, with:r.with || [], here:r.here || [], files:r.files || {},
      readOnly, turnedIn, character:r.who || '', teacherView });
  }

  function editor(o){
    // base: the page as the server last had it; what is typed on top of it is sent every moment or so
    let base = o.base, timer = null, busy = false, rendered = null, lastKey = 0;
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
      scrolled(); where();
    };
    const scrolled = () => { hl.scrollTop = ed.scrollTop; hl.scrollLeft = ed.scrollLeft; gutter.scrollTop = ed.scrollTop; };
    const where = () => { const before = ed.value.slice(0, ed.selectionStart).split('\n');
      pos.textContent = w('line') + ' ' + before.length + ', ' + w('col') + ' ' + (before[before.length - 1].length + 1);
      [...gutter.children].forEach((d, k) => d.classList.toggle('on', k === before.length - 1)); };
    // the page beside it: what the browser shows, and its <title> on the tab
    const refresh = () => {
      rendered = ed.value;
      frame.srcdoc = HL.withFiles(ed.value, files(), location.origin);    // the files' names, where they are kept
      const t = (ed.value.match(/<title>([^<]*)<\/title>/i) || [])[1];
      tabTitle.textContent = t && t.trim() ? t.trim() : S.file;
      document.title = (t && t.trim() ? t.trim() + ' · ' : '') + S.file;
      const has = S.info(ed.value, o.character).has;
      checks.replaceChildren(h('span', { class:'rs-checks-l' }, w('has')),
        ...S.groups.flatMap(g => [h('span', { class:'rs-checks-g' }, g.n + ':'),
          ...S.parts.filter(p => p.group === g.n).map(p => h('span', { class:'rs-chip' + (has.includes(p.id) ? ' ok' : ''), title:p.say ? L(p.say) : null }, (has.includes(p.id) ? '✓ ' : '') + p.en))]));
    };
    // someone else's changes: put in the code, the cursor and scroll kept where they were
    const setText = text => {
      if(text === ed.value) return;
      const hs = MERGE.hunks(ed.value, text), a = MERGE.mapPoint(ed.selectionStart, hs), b = MERGE.mapPoint(ed.selectionEnd, hs), top = ed.scrollTop;
      ed.value = text;
      if(document.activeElement === ed) ed.setSelectionRange(a, b);
      ed.scrollTop = top; draw();
    };
    // send my changes, get everyone else's (a page nobody changed only asks "the same?")
    const push = async force => {
      if(busy) return;
      busy = true; clearTimeout(timer);
      const sent = ed.value, mineChanged = !o.readOnly && sent !== base;
      try {
        if(mineChanged) setStatus('saving');
        const r = mineChanged ? await api(o.doc, { method:'PUT', body:JSON.stringify({ base, text:sent }) }) : await api(o.doc + '?h=' + MERGE.hash(base));
        if(!r.same){ const from = mineChanged ? sent : base; base = r.text; setText(MERGE.merge3(from, ed.value, r.text)); }
        people(r.here || [], r.with || o.with);
        if(r.files && JSON.stringify(r.files) !== JSON.stringify(o.files)){ o.files = r.files; drawFiles(); refresh(); }   // a classmate added a picture
        if(!o.readOnly) setStatus(ed.value === base ? 'saved' : 'edited');
        if(r.in && !o.readOnly) return location.reload();
      } catch(e){
        if(e.status === 423) return location.reload();          // turned in: read only now
        if(!o.readOnly) setStatus('offline');
      } finally { busy = false; }
      // the page beside the code: when typing stops (or Save), not at every letter
      if(rendered !== ed.value && (force || Date.now() - lastKey > 1500)) refresh();
      timer = setTimeout(push, ed.value !== base ? 700 : document.hidden ? 5000 : 1500);
    };
    const save = () => { refresh(); if(busy) return; push(true); };
    ed.addEventListener('input', () => { draw(); lastKey = Date.now(); setStatus('edited'); if(!busy){ clearTimeout(timer); timer = setTimeout(push, 700); } });

    // who else has the page open, and (the owner) who it is shared with
    const hereBox = h('span', { class:'rs-here' });
    const people = (list, shared) => {
      o.with = shared;
      const others = list.filter(x => x.username !== o.me.username);
      hereBox.replaceChildren(...others.map(x => h('span', { class:'rs-av', title:w('here') + ': ' + x.name, style:'background:' + colorOf(x.username) }, x.name.slice(0, 1).toUpperCase())));
      if(shareBtn) shareBtn.lastChild.textContent = w('share') + (shared.length ? ' · ' + shared.length : '');
    };
    const shareBtn = o.mine && S.share && !o.readOnly ? h('button', { class:'rs-btn', type:'button', title:w('shareHint'), onclick:() => shareDialog() }, '👥 ', h('span', {}, w('share'))) : null;
    const shareDialog = async () => {
      const r = await api('/page/' + k + '/shared').catch(() => null);
      if(!r) return;
      const picked = new Set(o.with);
      const back = h('div', { class:'rs-dlg-back', onclick:e => { if(e.target === back) back.remove(); } },
        h('div', { class:'rs-dlg', role:'dialog', 'aria-label':w('shareH') },
          h('b', {}, '👥 ' + w('shareH')), h('small', {}, w('shareHint')),
          h('div', { class:'rs-dlg-list' }, ...(r.classmates.length ? r.classmates.map(c => h('label', { class:'rs-dlg-row' },
            h('input', { type:'checkbox', checked:picked.has(c.username), onchange:e => { e.target.checked ? picked.add(c.username) : picked.delete(c.username); } }),
            h('span', { class:'rs-av', style:'background:' + colorOf(c.username) }, c.name.slice(0, 1).toUpperCase()), c.name)) : [h('small', {}, w('noClassmates'))])),
          h('div', { class:'rs-dlg-btns' }, h('button', { class:'rs-btn ghost', type:'button', onclick:() => back.remove() }, w('cancel')),
            h('button', { class:'rs-btn primary', type:'button', onclick:async () => {
              const x = await api('/page/' + k + '/share', { method:'POST', body:JSON.stringify({ with:[...picked] }) }).catch(() => null);
              if(x) people([], x.with);
              back.remove();
            } }, w('done')))));
      document.body.append(back);
    };
    // the files folder: the page's own pictures (the Mario page's two, and the student's)
    const files = () => HL.filesOf(S, { [k + 'Files']:o.files });
    const filesBar = h('div', { class:'rs-files' });
    const fileApi = (path, opts) => api(o.doc + '/files' + path, opts);
    // a file's name goes where the cursor is in a src="…", else in place of the Mario page's first picture left, else in a new <img> at the cursor
    const usePicture = (name, at = ed.selectionStart, end = ed.selectionEnd) => {
      const v = ed.value, ls = v.lastIndexOf('\n', at - 1) + 1, le = v.indexOf('\n', at) < 0 ? v.length : v.indexOf('\n', at);
      const inSrc = [...v.slice(ls, le).matchAll(/src\s*=\s*(["'])([^"']*)\1/gi)].map(m => ({ from:ls + m.index + m[0].indexOf(m[1]) + 1, len:m[2].length }))
        .find(m => at >= m.from && at <= m.from + m.len);
      const spot = [...v.matchAll(/src="([^"]*)"/g)].find(m => (S.files || {})[m[1]] || m[1].includes(HL.WIKI_PIC));
      if(inSrc) ed.setRangeText(name, inSrc.from, inSrc.from + inSrc.len, 'end');
      else if(spot) ed.setRangeText(name, spot.index + 5, spot.index + 5 + spot[1].length, 'end');
      else ed.setRangeText('<img src="' + name + '" alt="">', at, end, 'end');
      ed.focus(); ed.dispatchEvent(new Event('input')); save();      // the picture shows at once
    };
    const addPicture = async file => {
      if(o.readOnly || !file || !/^image\//.test(file.type)) return;
      const at = ed.selectionStart, end = ed.selectionEnd;
      // name it, as when saving a file into the website's folder
      const asked = prompt(w('nameIt'), HL.fileName(file.name, files()));
      if(asked == null) return;
      const name = HL.FILE_NAME.test(asked.trim()) ? asked.trim().toLowerCase() : HL.fileName(asked, {});
      status.textContent = '⏳ ' + w('picAdding'); status.className = 'rs-status saving';
      try { const id = await upload(file); o.files = (await fileApi('', { method:'POST', body:JSON.stringify({ name, id }) })).files; }
      catch(e){ status.textContent = '⚠ ' + w(e.status === 413 ? 'full' : 'picFail'); status.className = 'rs-status offline'; return; }
      drawFiles(); usePicture(name, at, end);
    };
    const drawFiles = () => {
      const all = files(), own = o.files || {};
      filesBar.replaceChildren(h('span', { class:'rs-files-l' }, '📁 ' + w('files')), h('span', { class:'rs-file-chip page' }, '📄 ' + S.file),
        ...Object.keys(all).sort().map(n => h('span', { class:'rs-file-chip' },
          h('button', { type:'button', class:'rs-file-use', title:w('useIt'), disabled:o.readOnly, onclick:() => usePicture(n) },
            h('img', { src:all[n], alt:'' }), n),
          own[n] && !o.readOnly ? h('button', { type:'button', class:'rs-file-x', title:w('delFile'), 'aria-label':w('delFile') + ' ' + n, onclick:async () => {
            if(!confirm(w('delFile') + '\n' + n)) return;
            try { o.files = (await fileApi('/' + encodeURIComponent(n), { method:'DELETE' })).files; drawFiles(); refresh(); } catch(e){}
          } }, '✕') : null)),
        o.readOnly ? null : h('button', { class:'rs-btn small', type:'button', title:w('picHint'), onclick:() => picker.click() }, '＋ ' + w('addPic')));
    };
    const picker = h('input', { type:'file', accept:'image/*', hidden:true, onchange:e => { addPicture(e.target.files[0]); e.target.value = ''; } });
    ed.addEventListener('paste', e => { const f = [...(e.clipboardData && e.clipboardData.files || [])].find(f => /^image\//.test(f.type)); if(f){ e.preventDefault(); addPicture(f); } });
    ed.addEventListener('dragover', e => { if(!o.readOnly && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    ed.addEventListener('drop', e => { const f = [...e.dataTransfer.files].find(f => /^image\//.test(f.type)); if(f){ e.preventDefault(); addPicture(f); } });
    ed.addEventListener('scroll', scrolled);
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
    addEventListener('beforeunload', e => { if(!o.readOnly && ed.value !== base){ push(); e.preventDefault(); } });
    document.addEventListener('visibilitychange', () => { if(!document.hidden && !busy) push(); });

    const back = o.teacherView ? null : h('a', { class:'rs-btn ghost', href:'/#/c/' + encodeURIComponent(o.me.period || '') + '/a/' + S.item }, '◀ ' + w('back'));
    const langBtn = h('button', { class:'rs-btn ghost', type:'button', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); location.reload(); } }, I18N.lang === 'es' ? 'EN' : 'ES');
    app.replaceChildren(h('div', { class:'rs' },
      h('header', { class:'rs-top' },
        h('span', { class:'rs-logo' }, '</>'),
        h('div', { class:'rs-file' }, h('b', {}, S.file), h('small', {}, (o.mine ? o.owner.name : '✏️ ' + L({ en:o.owner.name + '’s page', es:'Página de ' + o.owner.name })) + (o.readOnly ? ' · ' + w('readOnly') : ''))),
        o.character ? h('span', { class:'rs-who' }, '🎭 ' + w('character') + ': ', h('b', {}, o.character)) : null,
        o.readOnly ? null : status, h('span', { class:'grow' }), hereBox, shareBtn, langBtn, back,
        o.readOnly ? null : picker,
        o.readOnly ? null : h('button', { class:'rs-btn primary', type:'button', onclick:save, title:'Ctrl+S' }, '💾 ' + w('save'), h('kbd', {}, /Mac/.test(navigator.platform) ? '⌘S' : 'Ctrl S'))),
      o.turnedIn ? h('div', { class:'rs-banner' }, '🔒 ' + w('turnedIn')) : null,
      filesBar,
      h('main', { class:'rs-main' },
        h('section', { class:'rs-pane rs-code' }, h('div', { class:'rs-pane-h' }, h('span', { class:'rs-dot' }), w('code'), h('span', { class:'grow' }), pos),
          h('div', { class:'rs-ed' }, gutter, h('div', { class:'rs-layers' }, hl, ed))),
        h('section', { class:'rs-pane rs-view' },
          h('div', { class:'rs-chrome' }, h('i'), h('i'), h('i'), h('span', { class:'rs-tab' }, h('span', { class:'rs-fav' }), tabTitle),
            h('span', { class:'grow' }), h('button', { class:'rs-reload', type:'button', title:'Refresh', onclick:save }, '↻')),
          h('div', { class:'rs-url' }, h('span', {}, '🔒'), S.file),
          frame)),
      h('footer', { class:'rs-foot' }, checks)));
    setStatus(ed.value === base ? 'saved' : 'edited'); drawFiles(); draw(); refresh(); people(o.here, o.with);
    push();
    if(!o.readOnly){ ed.focus(); ed.setSelectionRange(0, 0); ed.scrollTop = 0; where(); }
  }

  start();
})();
