/* =====================================================================
   SCRIPT — "⤓ Download script": every sprite's code in ONE PDF, to hand
   in, the same file Dino Run and Bug Squad make: the project, the
   student's name, period and the date at the top, then the Stage and each
   sprite under its own heading, one block to a line, indented the way the
   blocks nest. It works at any moment, so half-finished work can be
   handed in as it stands.

   The PDF is written by hand (Courier text, no library): a few objects, a
   content stream per page, and a table of byte offsets at the end.
   Courier has no accents, so they are dropped (Código → Codigo).
   ===================================================================== */
window.SCRIPTPDF = (function(){
  const ASCII = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/⚑/g, 'flag').replace(/↻/g, 'right').replace(/↺/g, 'left').replace(/[−–—]/g, '-')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[^\x20-\x7e]/g, '?');
  const SPECIAL = { _mouse_:'mouse-pointer', _random_:'random position', _edge_:'edge', _myself_:'myself', _stage_:'Stage' };
  const isC = b => b.body !== undefined;

  /* one block as one line of text: (round) for numbers and text, <pointy>
     for true/false, [square] for menus */
  function inline(b, project, owner){
    if(!b) return '';
    if(b.op === 'argument_reporter') return '(' + b.name + ')';
    if(b.op === 'argument_boolean') return '<' + b.name + '>';
    if(b.op === 'procedures_definition'){
      return 'define ' + PROJECT.procParts(b.proc || { code:'' }).map(p => typeof p === 'string' ? p : (p.kind === 'b' ? '<' + p.name + '>' : '(' + p.name + ')')).join(' ');
    }
    if(b.op === 'procedures_call'){
      const d = PROJECT.procs(owner)[b.proc && b.proc.code];
      return PROJECT.procParts(d ? d.def.proc : (b.proc || { code:'?' })).map(p => typeof p === 'string' ? p : slot(b, p.arg, { t: p.kind === 'b' ? 'bool' : 'str' }, project, owner)).join(' ');
    }
    const spec = BLOCKS.of(b.op);
    if(!spec) return b.op;
    return BLOCKS.parts(spec.text).map(p => typeof p === 'string' ? p : slot(b, p.arg, spec.args[p.arg], project, owner)).join('').replace(/\s+/g, ' ').trim();
  }
  function slot(b, name, spec, project, owner){
    const inp = b.inputs && b.inputs[name];
    if(inp){
      const sh = (BLOCKS.of(inp.op) || {}).shape;
      const txt = inline(inp, project, owner);
      return sh === 'bool' || inp.op === 'argument_boolean' ? '<' + txt + '>' : '(' + txt + ')';
    }
    const v = b.args ? b.args[name] : '';
    const t = spec ? spec.t : 'str';
    if(t === 'bool') return '< >';
    if(t === 'num' || t === 'str') return '(' + (v == null ? '' : v) + ')';
    if(t === 'color') return '[color ' + v + ']';
    return '[' + (SPECIAL[v] || (v == null ? '' : v)) + ']';
  }
  function lines(list, depth, out, project, owner){
    const pad = '    '.repeat(depth);
    for(const b of list || []){
      out.push(pad + inline(b, project, owner));
      if(isC(b)){
        lines(b.body, depth + 1, out, project, owner);
        if(b.body2 !== undefined){ out.push(pad + 'else'); lines(b.body2, depth + 1, out, project, owner); }
        out.push(pad + 'end');
      }
    }
    return out;
  }
  /* a target's scripts, top to bottom then left to right, a blank line between */
  function targetText(tg, project){
    const out = [];
    const scripts = tg.scripts.slice().sort((a, b) => (a.y - b.y) || (a.x - b.x));
    scripts.forEach((sc, i) => {
      if(i) out.push('');
      const first = sc.blocks[0], shape = first && ((BLOCKS.of(first.op) || {}).shape || (first.op === 'procedures_definition' ? 'hat' : ''));
      if(shape === 'hat'){ out.push(inline(first, project, tg)); lines(sc.blocks.slice(1), 1, out, project, tg); }
      else lines(sc.blocks, 0, out, project, tg);
    });
    return out;
  }
  function rows(project, info){
    const L = [t('Student:'), t('Username:'), t('Period:'), t('Date:')];
    const w = Math.max(...L.map(l => l.length)) + 2;
    const out = [
      { t:String(info.project || 'Project').toUpperCase() + ' - ' + t('Block code'), b:true }, { t:'' },
      { t:L[0].padEnd(w) + (info.name || '') },
      { t:L[1].padEnd(w) + (info.username || '') },
      ...(info.period ? [{ t:L[2].padEnd(w) + info.period }] : []),
      { t:L[3].padEnd(w) + new Date().toLocaleString(I18N.lang === 'es' ? 'es' : 'en') }
    ];
    for(const tg of [...project.targets.slice(1), project.targets[0]]){
      const text = targetText(tg, project);
      const vars = Object.keys(tg.vars || {}), lists = Object.keys(tg.lists || {});
      out.push({ t:'' }, { t:'' }, { t:(tg.isStage ? t('Stage') : t('Sprite') + ': ' + tg.name).toUpperCase(), b:true });
      if(vars.length) out.push({ t:t('Variables') + ': ' + vars.join(', ') });
      if(lists.length) out.push({ t:t('Lists') + ': ' + lists.join(', ') });
      out.push({ t:'' });
      if(text.length) text.forEach(x => out.push({ t:x }));
      else out.push({ t:t('(no blocks yet)') });
    }
    return out;
  }

  /* pages of Courier, a bold line where asked */
  function pdf(rws){
    const W = 612, H = 792, M = 54, LH = 13, COLS = 84, PER = Math.floor((H - 2*M) / LH);
    const wrapped = [];
    rws.forEach(r => {
      let s = ASCII(r.t);
      const lead = (s.match(/^ */) || [''])[0] + '      ';
      if(!s.length){ wrapped.push({ t:'', b:r.b }); return; }
      while(s.length > COLS){ wrapped.push({ t:s.slice(0, COLS), b:r.b }); s = lead + s.slice(COLS); }
      wrapped.push({ t:s, b:r.b });
    });
    const pages = [];
    for(let i = 0; i < wrapped.length; i += PER) pages.push(wrapped.slice(i, i + PER));
    const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const objs = [];
    objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>';
    const kids = [];
    pages.forEach((pg, n) => {
      const pageNo = 6 + n*2, streamNo = pageNo + 1;
      let body = 'BT\n' + LH + ' TL\n' + M + ' ' + (H - M) + ' Td\n';
      pg.forEach(r => { body += (r.b ? '/F2' : '/F1') + ' 10 Tf\n(' + esc(r.t) + ') Tj T*\n'; });
      body += '/F1 8 Tf\nET\nBT /F1 8 Tf ' + (W - M - 60) + ' ' + (M / 2) + ' Td (page ' + (n + 1) + ' of ' + pages.length + ') Tj ET\n';
      objs[pageNo - 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] ' +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + streamNo + ' 0 R >>';
      objs[streamNo - 1] = '<< /Length ' + body.length + ' >>\nstream\n' + body + 'endstream';
      kids.push(pageNo + ' 0 R');
    });
    objs[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + pages.length + ' >>';
    objs[4] = '<< /Producer (Code Studio) >>';
    let out = '%PDF-1.4\n'; const at = [];
    objs.forEach((o, i) => { at[i] = out.length; out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' +
      at.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
      'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
    return out;
  }
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* info: { project, name, username, period } */
  function download(project, info){
    const blob = new Blob([pdf(rows(project, info))], { type:'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (slug(info.project) || 'project') + '-' + (slug(info.name) || slug(info.username) || 'student') + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  return { download, rows, pdf, targetText };
})();
