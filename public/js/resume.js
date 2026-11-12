/* =====================================================================
   MY RESUME — a code editor for the student's resume.html, with the page
   it makes beside it. The way they learned it in class:
   Edit → Save → Refresh (Save, or Ctrl+S, saves and refreshes the page;
   it also saves by itself a moment after typing stops).

   The code is coloured by a <pre> under a see-through <textarea> (the
   textarea does the typing; the pre only draws). Saved with the Learn
   progress (/api/learn, html.site). Turned in (html.siteIn) = read only,
   until Unsubmit in the Classroom. A teacher: ?u=<username>, read only, with 🕘 History:
   who wrote each line, and the page at any moment (see server/pagehist.js).
   At /wiki it is the Website Presentation's character.html instead (html.wiki):
   it starts as the Mario page, and the student changes it to their character.
   Pictures, as on a desktop: each page has a 📁 files folder beside it. ＋ Add picture
   (or paste or drop one on the code) makes it smaller, keeps it in the asset store,
   puts it in the folder by its file name and in the code as <img src="elsa.png">;
   the page beside the code shows the files where they are kept (HL.withFiles).
   A picture from the computer is kept in the student's ☁️ My Drive (/drive) too, and
   ☁️ My Drive puts one from there in the folder.
   Typing together (as in Google Docs): the page is kept at /api/page/<owner>/<key>.
   Every moment or so the editor sends what changed and gets everyone else's
   changes back (MERGE.merge3 puts them together). The Website Presentation's
   owner can 👥 Share it with classmates, who open it at /wiki?o=<owner>. Each editor
   sends its cursor too, and shows everyone else's in the code: a coloured line with
   their name, and what they have selected (as in Google Docs).
   ===================================================================== */
(function(){
  const { h, $ } = UI;
  const HL = window.HTMLLESSONS;
  const S = /^\/wiki/.test(location.pathname) ? HL.SITES.wiki : /^\/game/.test(location.pathname) ? HL.SITES.game : HL.SITES.site, k = S.key;
  const app = $('#app');
  const L = o => (I18N.lang === 'es' && o.es) || o.en;
  const W = {
    saved:{ en:'Saved', es:'Guardado' }, saving:{ en:'Saving…', es:'Guardando…' }, edited:{ en:'Not saved', es:'Sin guardar' },
    offline:{ en:'Not saved: no connection', es:'Sin guardar: no hay conexión' },
    save:{ en:'Save & refresh', es:'Guardar y actualizar' }, back:{ en:'Classroom', es:'Clase' },
    page:{ en:'Your page', es:'Tu página' }, code:{ en:'Your code', es:'Tu código' },
    turnedIn:{ en:'Turned in. To make changes, Unsubmit in the Classroom.', es:'Entregado. Para hacer cambios, anula la entrega en la Clase.' },
    lockedT:{ en:'Locked by your teacher. You can look at your page but not change it.', es:'Bloqueado por tu docente. Puedes ver tu página pero no cambiarla.' },
    viewing:{ en:'Viewing', es:'Viendo' }, readOnly:{ en:'read only', es:'solo lectura' },
    login:{ en:'Log in to the Classroom first.', es:'Primero inicia sesión en la Clase.' }, open:{ en:'Open the Classroom', es:'Abrir la Clase' },
    empty:{ en:'Start typing your ' + S.file + ' here…', es:'Empieza a escribir tu ' + S.file + ' aquí…' },
    character:{ en:'Your character', es:'Tu personaje' },
    addPic:{ en:'Add picture', es:'Añadir imagen' }, picAdding:{ en:'Adding picture…', es:'Añadiendo imagen…' },
    picFail:{ en:'Picture not added. Try again.', es:'No se añadió la imagen. Inténtalo otra vez.' },
    picHint:{ en:'Put a picture from your computer in your files folder and in the page. You can also paste one or drop it on the code.', es:'Pon una imagen de tu computadora en tu carpeta de archivos y en la página. También puedes pegarla o soltarla en el código.' },
    files:{ en:'Files', es:'Archivos' }, nameIt:{ en:'Name your picture file (like elsa.png):', es:'Nombra tu archivo de imagen (como elsa.png):' },
    useIt:{ en:'Click to put it in the page at the cursor', es:'Haz clic para ponerla en la página donde está el cursor' },
    drive:{ en:'My Drive', es:'Mi unidad' }, fromDrive:{ en:'Put a picture from your Drive in this page', es:'Pon una imagen de tu unidad en esta página' },
    driveEmpty:{ en:'Your Drive has no pictures yet. Add one from your computer, or open My Drive.', es:'Tu unidad aún no tiene imágenes. Añade una de tu computadora o abre Mi unidad.' },
    openDrive:{ en:'Open My Drive', es:'Abrir Mi unidad' }, close:{ en:'Close', es:'Cerrar' },
    delFile:{ en:'Take this file out of the folder?', es:'¿Quitar este archivo de la carpeta?' }, full:{ en:'The folder is full (40 files).', es:'La carpeta está llena (40 archivos).' },
    line:{ en:'Ln', es:'Lín' }, col:{ en:'Col', es:'Col' }, has:{ en:'Your page has', es:'Tu página tiene' }, next:{ en:'Next', es:'Sigue' }, allDone:{ en:'Every part is done!', es:'¡Todas las partes están hechas!' },
    showChecks:{ en:'Show the whole checklist', es:'Mostrar toda la lista' }, hideChecks:{ en:'Fold the checklist to one line', es:'Doblar la lista en una línea' },
    share:{ en:'Share', es:'Compartir' }, shareH:{ en:'Share with classmates', es:'Compartir con compañeros' },
    shareHint:{ en:'They can type in your page too, at the same time as you.', es:'Ellos también pueden escribir en tu página, al mismo tiempo que tú.' },
    done:{ en:'Done', es:'Listo' }, cancel:{ en:'Cancel', es:'Cancelar' }, here:{ en:'Here now', es:'Aquí ahora' },
    notShared:{ en:'This page is not shared with you.', es:'Esta página no está compartida contigo.' },
    noClassmates:{ en:'No classmates yet.', es:'Todavía no hay compañeros.' },
    noCopy:{ en:'Copy and paste are off. Type your code yourself!', es:'Copiar y pegar están desactivados. ¡Escribe tu código tú mismo!' },
    history:{ en:'History', es:'Historial' }, whoWrote:{ en:'Who wrote it', es:'Quién lo escribió' }, versions:{ en:'Versions', es:'Versiones' },
    now:{ en:'Now', es:'Ahora' }, linesNow:{ en:'lines now', es:'líneas ahora' }, letters:{ en:'letters', es:'letras' },
    lastTyped:{ en:'last typed', es:'escribió por última vez' }, before:{ en:'From before history was kept', es:'De antes de guardar el historial' },
    noHistory:{ en:'No changes saved yet. Each change is kept from now on.', es:'Todavía no hay cambios guardados. Desde ahora se guarda cada cambio.' },
    codeTab:{ en:'Code', es:'Código' }, pageTab:{ en:'Page', es:'Página' }, parts:{ en:'parts done', es:'partes hechas' },
    histHint:{ en:'A copy is kept at most every 2 minutes for each person typing.', es:'Se guarda una copia como máximo cada 2 minutos por cada persona que escribe.' }
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

  const { upload } = PICTURES;

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
    const mine = owner === me.username, turnedIn = !!r.in, locked = !!r.locked, readOnly = turnedIn || locked || !r.canEdit;
    // the Website Presentation starts as the Mario page (saved as soon as it opens)
    const fresh = !r.text && !!S.start && mine && !readOnly;
    editor({ me, doc, mine, text:fresh ? S.start : r.text, base:r.text, owner:r.owner, with:r.with || [], here:r.here || [], files:r.files || {},
      readOnly, turnedIn, locked, character:r.who || '', teacherView });
  }

  function editor(o){
    // base: the page as the server last had it; what is typed on top of it is sent every moment or so
    let base = o.base, timer = null, busy = false, rendered = null, lastKey = 0;
    const ed = h('textarea', { class:'rs-input', spellcheck:'false', autocapitalize:'off', autocomplete:'off', autocorrect:'off', wrap:'off',
      placeholder:w('empty'), 'aria-label':S.file, maxlength:HL.SITE_MAX });
    ed.value = o.text; ed.readOnly = o.readOnly;
    // the colored code and the line numbers are moved with the typing box, not scrolled: with scrollbars
    // showing, the box scrolls further than they can, and the cursor would sit above its line
    const hlIn = h('div', { class:'rs-hl-in' }), hl = h('pre', { class:'rs-hl', 'aria-hidden':'true' }, hlIn);
    const gutIn = h('div', { class:'rs-gutter-in' }), gutter = h('div', { class:'rs-gutter', 'aria-hidden':'true' }, gutIn);
    const status = h('span', { class:'rs-status' });
    const frame = h('iframe', { class:'rs-frame', sandbox:'allow-same-origin', title:w('page') });   // no scripts; same origin so its pictures load
    const tabTitle = h('span', { class:'rs-tabt' });
    const pos = h('span', { class:'rs-pos' });
    const checks = h('div', { class:'rs-checks' });
    // the checklist under the code can be folded to one line (this computer remembers it)
    let folded = false, lastHas = [];
    try { folded = localStorage.getItem('rs-fold-' + S.key) === '1'; } catch(e){}
    const chip = (p, has) => h('span', { class:'rs-chip' + (has.includes(p.id) ? ' ok' : ''), title:p.say ? L(p.say) : null }, (has.includes(p.id) ? '✓ ' : '') + p.en);
    const drawChecks = has => {
      lastHas = has;
      const next = S.parts.find(p => !has.includes(p.id));
      const fold = h('button', { class:'rs-fold', type:'button', 'aria-expanded':String(!folded), title:folded ? w('showChecks') : w('hideChecks'),
        onclick:() => { folded = !folded; try { localStorage.setItem('rs-fold-' + S.key, folded ? '1' : '0'); } catch(e){} drawChecks(lastHas); } },
        h('span', { class:'rs-fold-i' }, folded ? '▸' : '▾'), w('has'), h('b', {}, has.length + ' / ' + S.parts.length));
      checks.classList.toggle('folded', folded);
      if(folded) return checks.replaceChildren(fold, next ? h('span', { class:'rs-checks-g' }, w('next') + ':') : h('span', { class:'rs-checks-g' }, '🎉 ' + w('allDone')), next ? chip(next, has) : '');
      checks.replaceChildren(fold, ...S.groups.flatMap(g => [h('span', { class:'rs-checks-g' }, g.n + ':'), ...S.parts.filter(p => p.group === g.n).map(p => chip(p, has))]));
    };
    const setStatus = (k, cls) => { status.textContent = (k === 'saved' ? '✓ ' : k === 'offline' ? '⚠ ' : '') + w(k); status.className = 'rs-status ' + (cls || k); };
    const draw = () => {
      hlIn.innerHTML = paint(ed.value);
      const n = ed.value.split('\n').length;
      if(gutIn.childElementCount !== n) gutIn.replaceChildren(...Array.from({ length:n }, (x, i) => h('div', {}, String(i + 1))));
      scrolled(); where();
    };
    const scrolled = () => { hlIn.style.transform = 'translate(' + -ed.scrollLeft + 'px,' + -ed.scrollTop + 'px)';
      gutIn.style.transform = 'translateY(' + -ed.scrollTop + 'px)';
      marksIn.style.transform = 'translate(' + -ed.scrollLeft + 'px,' + -ed.scrollTop + 'px)'; };
    // classmates' cursors, drawn over the code: a line where each one is, their name, what they selected
    const marksIn = h('div', { class:'rs-marks-in' }), marks = h('div', { class:'rs-marks', 'aria-hidden':'true' }, marksIn);
    let cursors = [];                                   // [{ username, name, sel }] in the page as the server had it (base)
    const drawCursors = () => {
      const list = cursors.filter(x => x.sel && x.username !== o.me.username);
      if(!list.length) return marksIn.replaceChildren();
      const cs = getComputedStyle(ed), lh = parseFloat(cs.lineHeight), top = parseFloat(cs.paddingTop), left = parseFloat(cs.paddingLeft);
      const c = document.createElement('canvas').getContext('2d'); c.font = cs.fontSize + ' ' + cs.fontFamily;
      const cw = c.measureText('M'.repeat(50)).width / 50, text = ed.value;
      const hs = text === base ? null : MERGE.hunks(base, text);      // what I typed since: the cursors move with it
      const at = i => { const before = text.slice(0, i), ln = before.split('\n').length - 1, line = before.slice(before.lastIndexOf('\n') + 1);
        let col = 0; for(const ch of line) col = ch === '\t' ? col + 2 - col % 2 : col + 1;      // tab-size 2
        return { x:left + col * cw, y:top + ln * lh, ln }; };
      marksIn.replaceChildren(...list.flatMap(x => {
        // [where they started, where their cursor is]: a selection can go up as well as down
        const [s, f] = x.sel.map(i => Math.min(text.length, hs ? MERGE.mapPoint(i, hs) : i)), a = Math.min(s, f), b = Math.max(s, f);
        const color = colorOf(x.username), p = at(f), out = [];
        if(a < b){                                      // the selection, one box per line
          const s0 = at(a);
          for(let ln = s0.ln, last = at(b).ln; ln <= last && ln - s0.ln < 200; ln++){
            const e0 = at(b), x0 = ln === s0.ln ? s0.x : left, x1 = ln === e0.ln ? e0.x : left + 2000;
            out.push(h('div', { class:'rs-selbox', style:'left:' + x0 + 'px;top:' + (top + ln * lh) + 'px;width:' + Math.max(2, x1 - x0) + 'px;height:' + lh + 'px;background:' + color }));
          }
        }
        out.push(h('div', { class:'rs-caret', style:'left:' + p.x + 'px;top:' + p.y + 'px;height:' + lh + 'px;background:' + color },
          h('span', { class:'rs-caret-n' + (p.y < 18 ? ' below' : ''), style:'background:' + color }, x.name.split(' ')[0])));
        return out;
      }));
    };
    // my cursor: the end of a selection I am moving (selecting up, that is its start)
    const focusAt = () => ed.selectionDirection === 'backward' ? ed.selectionStart : ed.selectionEnd;
    const mySel = () => ed.selectionDirection === 'backward' ? [ed.selectionEnd, ed.selectionStart] : [ed.selectionStart, ed.selectionEnd];
    const where = () => { const before = ed.value.slice(0, focusAt()).split('\n');
      pos.textContent = w('line') + ' ' + before.length + ', ' + w('col') + ' ' + (before[before.length - 1].length + 1);
      [...gutIn.children].forEach((d, k) => d.classList.toggle('on', k === before.length - 1)); };
    // the page beside it: what the browser shows, and its <title> on the tab
    const refresh = () => {
      rendered = ed.value;
      frame.srcdoc = HL.withFiles(ed.value, files(), location.origin);    // the files' names, where they are kept
      const t = (ed.value.match(/<title>([^<]*)<\/title>/i) || [])[1];
      tabTitle.textContent = t && t.trim() ? t.trim() : S.file;
      document.title = (t && t.trim() ? t.trim() + ' · ' : '') + S.file;
      const has = S.info(ed.value, o.character).has;
      drawChecks(has);
    };
    // someone else's changes: put in the code, the cursor and scroll kept where they were
    const setText = text => {
      if(text === ed.value) return;
      const hs = MERGE.hunks(ed.value, text), a = MERGE.mapPoint(ed.selectionStart, hs), b = Math.max(a, MERGE.mapPoint(ed.selectionEnd, hs)), top = ed.scrollTop;
      ed.value = text;
      if(document.activeElement === ed) ed.setSelectionRange(a, b, ed.selectionDirection);
      ed.scrollTop = top; draw();
    };
    // send my changes, get everyone else's (a page nobody changed only asks "the same?")
    const push = async force => {
      if(busy) return;
      busy = true; clearTimeout(timer);
      const sent = ed.value, mineChanged = !o.readOnly && sent !== base;
      // my cursor, for my classmates (only while I am in the code)
      const sel = !o.readOnly && document.activeElement === ed ? mySel() : null;
      try {
        if(mineChanged) setStatus('saving');
        const r = mineChanged ? await api(o.doc, { method:'PUT', body:JSON.stringify({ base, text:sent, sel }) })
          : await api(o.doc + '?h=' + MERGE.hash(base) + (sel && sent === base ? '&c=' + sel.join(',') : ''));
        if(!r.same){ const from = mineChanged ? sent : base; base = r.text; setText(MERGE.merge3(from, ed.value, r.text)); }
        people(r.here || [], r.with || o.with);
        if(r.files && JSON.stringify(r.files) !== JSON.stringify(o.files)){ o.files = r.files; drawFiles(); refresh(); }   // a classmate added a picture
        if(!o.readOnly) setStatus(ed.value === base ? 'saved' : 'edited');
        if((r.in || r.locked) && !o.readOnly) return location.reload();
      } catch(e){
        if(e.status === 423) return location.reload();          // turned in: read only now
        if(!o.readOnly) setStatus('offline');
      } finally { busy = false; }
      // the page beside the code: when typing stops (or Save), not at every letter
      if(rendered !== ed.value && (force || Date.now() - lastKey > 1500)) refresh();
      timer = setTimeout(push, ed.value !== base ? 700 : document.hidden ? 5000 : cursors.length > 1 ? 1000 : 1500);
    };
    const save = () => { refresh(); if(busy) return; push(true); };
    ed.addEventListener('input', () => { draw(); drawCursors(); lastKey = Date.now(); setStatus('edited'); if(!busy){ clearTimeout(timer); timer = setTimeout(push, 700); } });
    // my cursor moved with someone else here: tell them soon
    const moved = () => { if(cursors.length > 1 && !busy){ clearTimeout(timer); timer = setTimeout(push, 250); } };

    // who else has the page open, and (the owner) who it is shared with
    const hereBox = h('span', { class:'rs-here' });
    const people = (list, shared) => {
      o.with = shared;
      const others = list.filter(x => x.username !== o.me.username);
      cursors = list; drawCursors();
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
      try {
        const id = await upload(file);
        o.files = (await fileApi('', { method:'POST', body:JSON.stringify({ name, id }) })).files;
        api('/drive', { method:'POST', body:JSON.stringify({ name, id }) }).catch(() => {});     // kept in My Drive too
      } catch(e){ status.textContent = '⚠ ' + w(e.status === 413 ? 'full' : 'picFail'); status.className = 'rs-status offline'; return; }
      drawFiles(); usePicture(name, at, end);
    };
    // ☁️ My Drive: pick one of my pictures; it goes in this page's folder (a new name if that one is taken)
    const fromDrive = async () => {
      const at = ed.selectionStart, end = ed.selectionEnd;
      const r = await api('/drive').catch(() => null);
      if(!r) return;
      const names = Object.keys(r.files).sort();
      const back = h('div', { class:'rs-dlg-back', onclick:e => { if(e.target === back) back.remove(); } },
        h('div', { class:'rs-dlg wide', role:'dialog', 'aria-label':w('drive') },
          h('b', {}, '☁️ ' + w('drive')), h('small', {}, w('fromDrive')),
          names.length ? h('div', { class:'rs-drive-grid' }, ...names.map(n => h('button', { type:'button', class:'rs-drive-pic', onclick:async () => {
            back.remove();
            const own = o.files || {}, name = own[n] && own[n] !== r.files[n] ? HL.fileName(n, files()) : n;
            try { o.files = (await fileApi('', { method:'POST', body:JSON.stringify({ name, id:r.files[n] }) })).files; } catch(e){ return; }
            drawFiles(); usePicture(name, at, end);
          } }, h('img', { src:'/api/assets/' + r.files[n], alt:'' }), h('span', {}, n))))
            : h('small', { class:'rs-drive-empty' }, w('driveEmpty')),
          h('div', { class:'rs-dlg-btns' }, h('a', { class:'rs-btn ghost', href:'/drive', target:'_blank', rel:'noopener' }, w('openDrive') + ' ↗'),
            h('button', { class:'rs-btn primary', type:'button', onclick:() => back.remove() }, w('close')))));
      document.body.append(back);
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
        o.readOnly ? '' : h('button', { class:'rs-btn small', type:'button', title:w('picHint'), onclick:() => picker.click() }, '＋ ' + w('addPic')),
        o.readOnly ? '' : h('button', { class:'rs-btn small', type:'button', title:w('fromDrive'), onclick:fromDrive }, '☁️ ' + w('drive')));
    };
    const picker = h('input', { type:'file', accept:'image/*', hidden:true, onchange:e => { addPicture(e.target.files[0]); e.target.value = ''; } });
    // students type their code themselves: no copying, cutting or pasting text (pictures still paste
    // and drop in as files); teachers keep copy and paste
    const noCopy = o.me.role !== 'teacher';
    let noCopyTimer = null;
    const blocked = e => {
      e.preventDefault();
      const was = [status.textContent, status.className];
      setStatus('noCopy', 'offline');
      clearTimeout(noCopyTimer);
      noCopyTimer = setTimeout(() => { if(status.textContent === w('noCopy')){ status.textContent = was[0]; status.className = was[1]; } }, 2500);
    };
    ['copy', 'cut'].forEach(k => ed.addEventListener(k, e => { if(noCopy) blocked(e); }));
    ed.addEventListener('paste', e => {
      const f = [...(e.clipboardData && e.clipboardData.files || [])].find(f => /^image\//.test(f.type));
      if(f){ e.preventDefault(); addPicture(f); } else if(noCopy) blocked(e);
    });
    ed.addEventListener('dragstart', e => { if(noCopy) e.preventDefault(); });
    ed.addEventListener('dragover', e => { if(!o.readOnly && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    ed.addEventListener('drop', e => {
      const f = [...e.dataTransfer.files].find(f => /^image\//.test(f.type));
      if(f){ e.preventDefault(); addPicture(f); } else if(noCopy) blocked(e);
    });
    ed.addEventListener('beforeinput', e => { if(noCopy && /^insertFrom(Paste|Drop|Yank)/.test(e.inputType)) blocked(e); });
    ed.addEventListener('scroll', scrolled);
    ['keyup', 'click', 'select'].forEach(k => ed.addEventListener(k, () => { where(); moved(); }));
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

    /* 🕘 History (a teacher): who wrote each line of the page now, and the page at each moment
       (GET /api/page/:owner/:key/history) */
    const history = async () => {
      let r; try { r = await api(o.doc + '/history'); } catch(e){ return; }
      const when = t => new Date(t).toLocaleString(I18N.lang === 'es' ? 'es' : 'en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
      const nameOf = Object.fromEntries([...r.people, ...r.versions.map(v => ({ username:v.by, name:v.name }))].map(x => [x.username, x.name]));
      const av = (u, n) => h('span', { class:'rs-av', style:'background:' + colorOf(u) }, (n || '?').slice(0, 1).toUpperCase());
      const view = h('div', { class:'rs-hist-view' }), tabs = h('div', { class:'rs-hist-tabs' });
      let mode = 'code', shown = { text:r.text, lines:r.lines };
      const show = () => {
        tabs.replaceChildren(...['code', 'page'].map(m => h('button', { type:'button', class:'rs-hist-tab' + (mode === m ? ' on' : ''), onclick:() => { mode = m; show(); } }, w(m + 'Tab'))));
        if(mode === 'page'){ const f = h('iframe', { class:'rs-hist-frame', sandbox:'allow-same-origin', title:w('page') }); f.srcdoc = HL.withFiles(shown.text, files(), location.origin); return view.replaceChildren(f); }
        view.replaceChildren(h('div', { class:'rs-hist-code' }, ...shown.text.split('\n').map((ln, i) => {
          const u = shown.lines ? shown.lines[i] : null;
          const row = h('div', { class:'rs-hist-ln', title:u ? nameOf[u] || u : '', style:u ? '--who:' + colorOf(u) : '' }, h('span', { class:'rs-hist-n' }, String(i + 1)), h('code', {}));
          row.lastChild.innerHTML = paint(ln).replace(/\n$/, '') || ' ';
          return row;
        })));
      };
      const list = h('div', { class:'rs-hist-list' });
      const pick = async (v, btn) => {
        list.querySelectorAll('.on').forEach(x => x.classList.remove('on')); btn.classList.add('on');
        if(!v){ shown = { text:r.text, lines:r.lines }; return show(); }
        try { const x = await api(o.doc + '/history/' + encodeURIComponent(v.id)); shown = { text:x.text, lines:null }; show(); } catch(e){}
      };
      const nowBtn = h('button', { type:'button', class:'rs-hist-v on', onclick:e => pick(null, e.currentTarget) },
        h('b', {}, '● ' + w('now')), h('small', {}, r.done + ' / ' + r.total + ' ' + w('parts')));
      list.append(nowBtn, ...r.versions.map(v => h('button', { type:'button', class:'rs-hist-v', onclick:e => pick(v, e.currentTarget) },
        h('span', { class:'rs-hist-t' }, when(v.created)),
        h('span', { class:'rs-hist-who' }, av(v.by, v.name), v.name.split(' ')[0],
          h('span', { class:'rs-hist-plus' }, '+' + v.added), h('span', { class:'rs-hist-minus' }, '−' + v.removed)),
        h('small', {}, v.done + ' / ' + r.total + ' ' + w('parts')))));
      if(!r.versions.length) list.append(h('small', { class:'rs-hist-empty' }, w('noHistory')));
      const people = h('div', { class:'rs-hist-people' }, ...r.people.map(x => h('div', { class:'rs-hist-p', style:'--who:' + colorOf(x.username) },
          av(x.username, x.name), h('div', {}, h('b', {}, x.name),
            h('small', {}, x.lines + ' ' + w('linesNow') + ' · +' + x.added + ' −' + x.removed + ' ' + w('letters')),
            x.last ? h('small', {}, w('lastTyped') + ' ' + when(x.last)) : null))),
        r.older ? h('div', { class:'rs-hist-p old' }, h('span', { class:'rs-av' }, '·'), h('div', {}, h('b', {}, w('before')), h('small', {}, r.older + ' ' + w('linesNow')))) : null);
      const back = h('div', { class:'rs-dlg-back', onclick:e => { if(e.target === back) back.remove(); } },
        h('div', { class:'rs-hist', role:'dialog', 'aria-label':w('history') },
          h('div', { class:'rs-hist-h' }, h('b', {}, '🕘 ' + w('history') + ' · ' + S.file + ' · ' + r.owner.name), h('span', { class:'grow' }),
            h('button', { class:'rs-btn ghost', type:'button', onclick:() => back.remove() }, '✕ ' + w('close'))),
          h('div', { class:'rs-hist-body' },
            h('aside', { class:'rs-hist-side' }, h('h4', {}, w('whoWrote')), people, h('h4', {}, w('versions')), h('small', { class:'rs-hist-hint' }, w('histHint')), list),
            h('section', { class:'rs-hist-main' }, tabs, view))));
      document.body.append(back); show();
    };
    const histBtn = o.teacherView ? h('button', { class:'rs-btn', type:'button', onclick:history }, '🕘 ' + w('history')) : null;

    const back = o.teacherView ? null : h('a', { class:'rs-btn ghost', href:'/#/c/' + encodeURIComponent(o.me.period || '') + '/a/' + S.item }, '◀ ' + w('back'));
    const langBtn = h('button', { class:'rs-btn ghost', type:'button', onclick:() => { I18N.set(I18N.lang === 'es' ? 'en' : 'es'); location.reload(); } }, I18N.lang === 'es' ? 'EN' : 'ES');
    app.replaceChildren(h('div', { class:'rs' },
      h('header', { class:'rs-top' },
        h('span', { class:'rs-logo' }, '</>'),
        h('div', { class:'rs-file' }, h('b', {}, S.file), h('small', {}, (o.mine ? o.owner.name : '✏️ ' + L({ en:o.owner.name + '’s page', es:'Página de ' + o.owner.name })) + (o.readOnly ? ' · ' + w('readOnly') : ''))),
        o.character ? h('span', { class:'rs-who' }, '🎭 ' + w('character') + ': ', h('b', {}, o.character)) : null,
        o.readOnly ? null : status, h('span', { class:'grow' }), hereBox, shareBtn, histBtn, langBtn, back,
        o.readOnly ? null : picker,
        o.readOnly ? null : h('button', { class:'rs-btn primary', type:'button', onclick:save, title:'Ctrl+S' }, '💾 ' + w('save'), h('kbd', {}, /Mac/.test(navigator.platform) ? '⌘S' : 'Ctrl S'))),
      o.locked && !o.teacherView ? h('div', { class:'rs-banner' }, '🔒 ' + w('lockedT')) : o.turnedIn ? h('div', { class:'rs-banner' }, '🔒 ' + w('turnedIn')) : null,
      filesBar,
      h('main', { class:'rs-main' },
        h('section', { class:'rs-pane rs-code' }, h('div', { class:'rs-pane-h' }, h('span', { class:'rs-dot' }), w('code'), h('span', { class:'grow' }), pos),
          h('div', { class:'rs-ed' }, gutter, h('div', { class:'rs-layers' }, hl, ed, marks))),
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
