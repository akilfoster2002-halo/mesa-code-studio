/* =====================================================================
   PAINT — draw a sprite, a costume or a backdrop, or change one.

   PAINT.open({ img, cx, cy, backdrop, title }) shows the paint window and
   resolves to { canvas, cx, cy } when Done is pressed, or null.
     • A new sprite or costume is drawn on a 480×480 see-through canvas
       (shown at half size on the stage, so it stays sharp). The middle of
       the canvas (the ✛) is the costume's centre, as in Scratch; empty
       space round the drawing is cut off when it is saved.
     • A backdrop is 960×720 and starts white.
     • An existing picture is put back where its centre was, so editing
       never moves a sprite.
   Tools: brush, eraser, line, rectangle, circle (outline or filled),
   fill bucket, text, colour picker; undo/redo; clear.
   ===================================================================== */
window.PAINT = (function(){
  const { h } = UI;
  const COLORS = ['#000000', '#ffffff', '#9e9e9e', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#3949ab', '#8e24aa', '#ec407a', '#8d6e63', '#ffccbc'];
  const TOOLS = [
    ['brush', '🖌', 'Brush'], ['eraser', '🧽', 'Eraser'], ['line', '╱', 'Line'], ['rect', '▭', 'Rectangle'],
    ['ellipse', '◯', 'Circle'], ['fill', '🪣', 'Fill'], ['text', 'T', 'Text'], ['pick', '💧', 'Pick a colour']
  ];

  function open({ img=null, cx=0, cy=0, backdrop=false, title='' } = {}){
    return new Promise(resolve => {
      /* ------------------------------------------------ the canvas */
      let W, H;
      if(backdrop){
        W = img ? img.naturalWidth || 960 : 960; H = img ? img.naturalHeight || 720 : 720;
      } else {
        // big enough for the picture around its centre, never smaller than 480
        const r = img ? Math.max(cx, (img.naturalWidth || 0) - cx, cy, (img.naturalHeight || 0) - cy) : 0;
        W = H = Math.min(1600, Math.max(480, Math.ceil(r * 2 + 8)));
      }
      const cv = h('canvas', { class:'paint-cv', width:W, height:H });
      const over = h('canvas', { class:'paint-over', width:W, height:H });
      const g = cv.getContext('2d', { willReadFrequently:true }), o = over.getContext('2d');
      if(backdrop){ g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
      if(img){
        if(backdrop) g.drawImage(img, 0, 0);
        else g.drawImage(img, Math.round(W / 2 - cx), Math.round(H / 2 - cy));
      }

      /* ------------------------------------------------ state */
      let tool = 'brush', color = '#1e88e5', size = 8, filled = false;
      const undo = [], redo = [];
      const snap = () => { undo.push(g.getImageData(0, 0, W, H)); if(undo.length > 40) undo.shift(); redo.length = 0; drawBar(); };
      const restore = (from, to) => { const d = from.pop(); if(!d) return; to.push(g.getImageData(0, 0, W, H)); g.putImageData(d, 0, 0); drawBar(); };

      /* ------------------------------------------------ drawing */
      const pos = e => { const r = cv.getBoundingClientRect(); return { x:(e.clientX - r.left) * W / r.width, y:(e.clientY - r.top) * H / r.height }; };
      const scale = () => W / cv.getBoundingClientRect().width;        // brush sizes are in screen pixels
      function style(ctx){
        const lw = size * scale();
        ctx.lineWidth = lw; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.strokeStyle = ctx.fillStyle = color;
      }
      function shape(ctx, a, b){
        style(ctx); ctx.beginPath();
        if(tool === 'line'){ ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); return; }
        const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y);
        if(tool === 'rect') ctx.rect(x, y, w, hh);
        else ctx.ellipse(x + w / 2, y + hh / 2, w / 2, hh / 2, 0, 0, Math.PI * 2);
        filled ? ctx.fill() : ctx.stroke();
      }
      let down = null, last = null;
      over.onpointerdown = async e => {
        if(e.button > 0) return;
        e.preventDefault();
        const p = pos(e);
        if(tool === 'fill'){ snap(); flood(g, W, H, Math.floor(p.x), Math.floor(p.y), hex(color)); return; }
        if(tool === 'pick'){ const d = g.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; if(d[3] > 0){ color = '#' + [0, 1, 2].map(i => d[i].toString(16).padStart(2, '0')).join(''); tool = 'brush'; drawBar(); } return; }
        if(tool === 'text'){
          const txt = await UI.ask(t('Text'), '');
          if(!txt) return;
          snap(); g.fillStyle = color; g.textBaseline = 'middle';
          g.font = 'bold ' + Math.round(Math.max(12, size * 3) * scale()) + 'px "Helvetica Neue", Arial, sans-serif';
          g.fillText(txt, p.x, p.y); return;
        }
        snap(); down = p; last = p; over.setPointerCapture(e.pointerId);
        if(tool === 'brush' || tool === 'eraser') stroke(p, p);
      };
      function stroke(a, b){
        g.save();
        if(tool === 'eraser'){ g.globalCompositeOperation = 'destination-out'; }
        style(g); if(tool === 'eraser') g.lineWidth *= 2;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x + 0.01, b.y); g.stroke();
        g.restore();
      }
      over.onpointermove = e => {
        const p = pos(e);
        o.clearRect(0, 0, W, H);
        if(!down){                                        // show the brush size under the mouse
          if(tool === 'brush' || tool === 'eraser'){
            o.beginPath(); o.arc(p.x, p.y, size * scale() * (tool === 'eraser' ? 1 : 0.5), 0, Math.PI * 2);
            o.strokeStyle = '#888'; o.lineWidth = scale(); o.stroke();
          }
          return;
        }
        if(tool === 'brush' || tool === 'eraser'){ stroke(last, p); last = p; }
        else shape(o, down, p);
      };
      over.onpointerup = over.onpointercancel = e => {
        if(!down) return;
        if(tool === 'line' || tool === 'rect' || tool === 'ellipse'){ o.clearRect(0, 0, W, H); shape(g, down, pos(e)); }
        down = null;
      };
      over.onpointerleave = () => { if(!down) o.clearRect(0, 0, W, H); };

      /* ------------------------------------------------ toolbar */
      const toolsEl = h('div', { class:'paint-tools' });
      const barEl = h('div', { class:'paint-bar' });
      const custom = h('input', { type:'color', class:'paint-custom', title:t('More colours') });
      custom.oninput = () => { color = custom.value; if(tool === 'eraser' || tool === 'pick') tool = 'brush'; drawBar(); };
      function drawBar(){
        toolsEl.replaceChildren(...TOOLS.map(([k, icon, label]) => h('button', { class:'paint-tool' + (tool === k ? ' on' : ''), type:'button', title:t(label), 'aria-label':t(label),
          onclick:() => { tool = k; drawBar(); } }, h('span', { class:'pi' }, icon), h('small', {}, t(label)))));
        custom.value = color;
        barEl.replaceChildren(...[
          h('div', { class:'paint-colors' }, ...COLORS.map(c => h('button', { class:'paint-color' + (c === color ? ' on' : ''), type:'button', title:c, style:{ background:c },
            onclick:() => { color = c; if(tool === 'eraser' || tool === 'pick') tool = 'brush'; drawBar(); } })), custom),
          h('span', { class:'paint-sep' }),
          ...[[3, '•'], [8, '●'], [16, '⬤'], [30, '⬤']].map(([n, s], i) => h('button', { class:'btn small paint-size' + (size === n ? ' on' : ''), type:'button', style:{ fontSize:(10 + i * 4) + 'px' }, title:String(n),
            onclick:() => { size = n; drawBar(); } }, s)),
          tool === 'rect' || tool === 'ellipse' ? h('span', { class:'paint-sep' }) : null,
          tool === 'rect' || tool === 'ellipse' ? h('button', { class:'btn small' + (filled ? '' : ' on'), type:'button', onclick:() => { filled = false; drawBar(); } }, '▢ ' + t('Outline')) : null,
          tool === 'rect' || tool === 'ellipse' ? h('button', { class:'btn small' + (filled ? ' on' : ''), type:'button', onclick:() => { filled = true; drawBar(); } }, '■ ' + t('Filled')) : null,
          h('span', { class:'grow' }),
          h('button', { class:'btn small', type:'button', disabled:!undo.length, title:t('Undo'), onclick:() => restore(undo, redo) }, '↩'),
          h('button', { class:'btn small', type:'button', disabled:!redo.length, title:t('Redo'), onclick:() => restore(redo, undo) }, '↪'),
          h('button', { class:'btn small', type:'button', onclick:() => { snap(); g.clearRect(0, 0, W, H); if(backdrop){ g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); } } }, '🗑 ' + t('Clear'))
        ].filter(Boolean));
      }
      drawBar();

      /* ------------------------------------------------ window */
      const back = h('div', { class:'paint-back' });
      const finish = v => { removeEventListener('keydown', keys, true); back.remove(); resolve(v); };
      const done = () => {
        if(backdrop) return finish({ canvas:cv, cx:W / 2, cy:H / 2 });
        const box = bounds(g, W, H);
        if(!box) return finish(null);                     // nothing drawn
        const out = document.createElement('canvas'); out.width = box.w; out.height = box.h;
        out.getContext('2d').drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
        finish({ canvas:out, cx:W / 2 - box.x, cy:H / 2 - box.y });
      };
      const cancel = async () => { if(!undo.length || await UI.confirm(t('Close without saving?'), t('Close'))) finish(null); };
      function keys(e){
        if(document.querySelector('.modal-back')) return;          // a question box is open on top
        e.stopPropagation();                                      // the block editor must not see these keys
        const mod = e.ctrlKey || e.metaKey;
        if(mod && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? restore(redo, undo) : restore(undo, redo); }
        else if(mod && e.key.toLowerCase() === 'y'){ e.preventDefault(); restore(redo, undo); }
        else if(e.key === 'Escape') cancel();
      }
      addEventListener('keydown', keys, true);
      back.append(h('div', { class:'paint', role:'dialog', 'aria-label':title },
        h('div', { class:'paint-head' }, h('b', {}, '🖌 ' + title), h('span', { class:'grow' }),
          h('button', { class:'btn', type:'button', onclick:cancel }, t('Cancel')),
          h('button', { class:'btn primary', type:'button', onclick:done }, '✓ ' + t('Done'))),
        barEl,
        h('div', { class:'paint-mid' }, toolsEl,
          h('div', { class:'paint-area' }, h('div', { class:'paint-frame' + (backdrop ? ' bd' : ''), style:{ aspectRatio:W + ' / ' + H } },
            cv, over, backdrop ? null : h('div', { class:'paint-centre', title:t('Centre') }, '✛'))))));
      document.body.append(back);
    });
  }

  /* the smallest box round everything that is not see-through */
  function bounds(g, W, H){
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      if(d[(y * W + x) * 4 + 3] > 8){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
    }
    if(x1 < 0) return null;
    const pad = 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    return { x:x0, y:y0, w:x1 - x0 + 1, h:y1 - y0 + 1 };
  }
  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 255]; };

  /* paint bucket: fill the area of the same colour (a little tolerance so soft edges fill too) */
  function flood(g, W, H, x, y, rgba){
    if(x < 0 || y < 0 || x >= W || y >= H) return;
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const i0 = (y * W + x) * 4, from = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    if(from.every((v, k) => Math.abs(v - rgba[k]) < 4)) return;
    const near = i => {
      if(from[3] < 20) return d[i + 3] < 20;                    // filling see-through space
      return Math.abs(d[i] - from[0]) + Math.abs(d[i + 1] - from[1]) + Math.abs(d[i + 2] - from[2]) + Math.abs(d[i + 3] - from[3]) < 90;
    };
    const seen = new Uint8Array(W * H), stack = [x, y];
    while(stack.length){
      const py = stack.pop(), px = stack.pop();
      let lx = px; while(lx >= 0 && !seen[py * W + lx] && near((py * W + lx) * 4)) lx--;
      lx++;
      let up = false, dn = false;
      for(let cx = lx; cx < W; cx++){
        const k = py * W + cx;
        if(seen[k] || !near(k * 4)) break;
        seen[k] = 1; d.set(rgba, k * 4);
        if(py > 0){ const u = k - W; if(!seen[u] && near(u * 4)){ if(!up){ stack.push(cx, py - 1); up = true; } } else up = false; }
        if(py < H - 1){ const v = k + W; if(!seen[v] && near(v * 4)){ if(!dn){ stack.push(cx, py + 1); dn = true; } } else dn = false; }
      }
    }
    g.putImageData(img, 0, 0);
  }

  return { open };
})();
