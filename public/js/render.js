/* =====================================================================
   RENDER — draws the stage and answers "is this touching that?".

   The stage is 480 × 360 with (0,0) in the middle, x to the right and y
   UP, exactly like Scratch. Internally pictures are placed in "canvas
   units": cx = 240 + x, cy = 180 − y, one unit per stage pixel.

   Touching is checked on real pixels: two sprites touch only where both
   have a pixel that is not see-through, so a round ball near the corner
   of a square does not count as touching it.
   ===================================================================== */
window.RENDER = (function(){
  const W = 480, H = 360, PEN_RES = 2;
  let canvas = null, g = null;
  const pen = document.createElement('canvas');
  pen.width = W * PEN_RES; pen.height = H * PEN_RES;
  const pg = pen.getContext('2d');
  let penDirty = false;

  const scratch = document.createElement('canvas');
  const sg = scratch.getContext('2d', { willReadFrequently:true });
  const scratch2 = document.createElement('canvas');
  const sg2 = scratch2.getContext('2d', { willReadFrequently:true });

  function attach(c){ canvas = c; g = c.getContext('2d'); }

  /* ---------------------------------------------------------- geometry */
  const costumeOf = s => s.costumes[s.currentCostume] || s.costumes[0];
  function matrix(s){
    const c = costumeOf(s);
    const k = (s.isStage ? 1 : s.size / 100) / (c.res || 1);
    let rot = 0, sx = 1;
    if(!s.isStage){
      // facing: which way the picture itself points (90 = right, the default)
      const f = c.facing == null ? 90 : c.facing;
      if(s.rotationStyle === 'all around') rot = (s.direction - f) * Math.PI / 180;
      else if(s.rotationStyle === 'left-right' && (s.direction < 0) !== (Math.sin(f * Math.PI / 180) < -0.01)) sx = -1;
    }
    const tx = s.isStage ? W/2 : W/2 + s.x, ty = s.isStage ? H/2 : H/2 - s.y;
    return { c, k, rot, sx, tx, ty };
  }
  function place(gc, s, ox=0, oy=0, scale=1){
    const m = matrix(s);
    gc.translate((m.tx - ox) * scale, (m.ty - oy) * scale);
    gc.rotate(m.rot);
    gc.scale(m.sx * m.k * scale, m.k * scale);
    gc.translate(-m.c.cx, -m.c.cy);
    return m;
  }
  /* axis-aligned box round the sprite, in canvas units */
  function box(s){
    const m = matrix(s), c = m.c;
    const cos = Math.cos(m.rot), sin = Math.sin(m.rot);
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for(const [px, py] of [[0,0],[c.w,0],[0,c.h],[c.w,c.h]]){
      const x = (px - c.cx) * m.k * m.sx, y = (py - c.cy) * m.k;
      const X = m.tx + x*cos - y*sin, Y = m.ty + x*sin + y*cos;
      l = Math.min(l, X); r = Math.max(r, X); t = Math.min(t, Y); b = Math.max(b, Y);
    }
    return { l, r, t, b };
  }
  /* the same box in stage coordinates (y up) — for bounce and the fence */
  function bounds(s){
    const k = box(s);
    return { left:k.l - W/2, right:k.r - W/2, top:H/2 - k.t, bottom:H/2 - k.b };
  }

  /* ----------------------------------------------------------- effects
     Same maths as Scratch's shader, done on pixels: the coordinate
     effects (mosaic, pixelate, whirl, fisheye) choose WHICH source pixel,
     then colour and brightness change it. Ghost is just transparency. */
  const fxCache = new Map();
  const NONE = {};
  function effected(s){
    const c = costumeOf(s);
    const img = MEDIA.image(c.asset);
    if(!img) return null;
    const fx = s._fx || NONE;
    const keys = ['color','fisheye','whirl','pixelate','mosaic','brightness'].filter(k => fx[k]);
    if(!keys.length) return img;
    const key = c.asset + '|' + keys.map(k => k + fx[k]).join(',');
    let out = fxCache.get(key);
    if(out) return out;
    const w = Math.max(1, Math.round(c.w)), h = Math.max(1, Math.round(c.h));
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sgc = src.getContext('2d'); sgc.drawImage(img, 0, 0, w, h);
    const sd = sgc.getImageData(0, 0, w, h).data;
    out = document.createElement('canvas'); out.width = w; out.height = h;
    const og = out.getContext('2d'); const od = og.createImageData(w, h); const d = od.data;
    const mosaic = fx.mosaic ? Math.max(1, Math.min(512, Math.round((Math.abs(fx.mosaic) + 10) / 10))) : 1;
    const pix = fx.pixelate ? Math.abs(fx.pixelate) / 10 * (c.res || 1) : 0;
    const whirl = (fx.whirl || 0) * Math.PI / 180;
    const fish = fx.fisheye ? Math.max(0, (fx.fisheye + 100) / 100) : 1;
    const hue = (fx.color || 0) / 200, bright = (fx.brightness || 0) / 100 * 255;
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      let u = (x + 0.5) / w, v = (y + 0.5) / h;
      if(mosaic > 1){ u = (u * mosaic) % 1; v = (v * mosaic) % 1; }
      if(pix > 1){ const pu = pix / w, pv = pix / h; u = (Math.floor(u / pu) + 0.5) * pu; v = (Math.floor(v / pv) + 0.5) * pv; }
      if(whirl){
        const ox = u - 0.5, oy = v - 0.5, mag = Math.hypot(ox, oy);
        const f = Math.max(1 - mag / 0.5, 0), a = whirl * f * f, cs = Math.cos(a), sn = Math.sin(a);
        u = 0.5 + cs*ox - sn*oy; v = 0.5 + sn*ox + cs*oy;
      }
      if(fx.fisheye){
        const vx = (u - 0.5) / 0.5, vy = (v - 0.5) / 0.5, len = Math.hypot(vx, vy);
        if(len > 0){ const r = Math.pow(Math.min(len, 1), fish) * Math.max(1, len); u = 0.5 + r * vx / len * 0.5; v = 0.5 + r * vy / len * 0.5; }
      }
      const o = (y*w + x) * 4;
      if(u < 0 || u >= 1 || v < 0 || v >= 1){ d[o+3] = 0; continue; }
      const i = (Math.floor(v * h) * w + Math.floor(u * w)) * 4;
      let r = sd[i], gg = sd[i+1], b = sd[i+2];
      const a = sd[i+3];
      if(hue && a){
        let [hh, ss, vv] = rgb2hsv(r, gg, b);
        vv = Math.max(vv, 0.11); ss = Math.max(ss, 0.09);
        hh = (hh + hue) % 1; if(hh < 0) hh += 1;
        [r, gg, b] = hsv2rgb(hh, ss, vv);
      }
      if(bright){ r += bright; gg += bright; b += bright; }
      d[o] = r; d[o+1] = gg; d[o+2] = b; d[o+3] = a;
    }
    og.putImageData(od, 0, 0);
    fxCache.set(key, out);
    if(fxCache.size > 80) fxCache.delete(fxCache.keys().next().value);
    return out;
  }
  function rgb2hsv(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if(d){ if(mx === r) h = ((g - b) / d) % 6; else if(mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if(h < 0) h += 1; }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v){
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f*s), t2 = v * (1 - (1-f)*s);
    const [r, g, b] = [[v,t2,p],[q,v,p],[p,v,t2],[p,q,v],[t2,p,v],[v,p,q]][i % 6];
    return [r*255, g*255, b*255];
  }

  /* --------------------------------------------------------- drawing */
  function drawSprite(gc, s, ox, oy, scale, mask){
    if(!s.visible && !mask) return;
    const img = mask ? MEDIA.image(costumeOf(s).asset) : effected(s);
    if(!img) return;
    const c = costumeOf(s);
    gc.save();
    if(!mask && s._fx && s._fx.ghost) gc.globalAlpha = Math.max(0, 1 - s._fx.ghost / 100);
    place(gc, s, ox, oy, scale);
    gc.drawImage(img, 0, 0, c.w, c.h);
    gc.restore();
  }
  function drawBackdrop(gc, stage, ox, oy, scale){
    gc.fillStyle = '#fff';
    gc.fillRect(0, 0, W * scale, H * scale);
    const img = effected(stage);
    if(img){
      const c = costumeOf(stage);
      gc.save();
      if(stage._fx && stage._fx.ghost) gc.globalAlpha = Math.max(0, 1 - stage._fx.ghost / 100);
      place(gc, stage, ox, oy, scale);
      gc.drawImage(img, 0, 0, c.w, c.h);
      gc.restore();
    }
  }
  /* everything on the stage into gc, shifted so (ox,oy) is the corner */
  function drawWorld(gc, rt, ox, oy, scale, except){
    drawBackdrop(gc, rt.stage, ox, oy, scale);
    gc.drawImage(pen, -ox * scale, -oy * scale, W * scale, H * scale);
    for(const s of rt.layers) if(s !== except) drawSprite(gc, s, ox, oy, scale);
  }

  function draw(rt){
    if(!canvas) return;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if(canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)){
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    const scale = canvas.width / W;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    drawWorld(g, rt, 0, 0, scale);
    for(const s of rt.layers) if(s.visible && s._bubble) bubble(g, s, scale);
  }

  /* speech and thought bubbles, Scratch style: above and to the right of
     the sprite, flipped to the left near the right edge */
  function bubble(gc, s, scale){
    const { type, text } = s._bubble;
    if(text === '' || text == null) return;
    gc.save();
    gc.scale(scale, scale);
    gc.font = '14px "Helvetica Neue", Helvetica, Arial, sans-serif';
    const lines = wrap(gc, String(text).slice(0, 330), 170);
    const lw = Math.max(50, ...lines.map(l => gc.measureText(l).width));
    const bw = lw + 20, bh = lines.length * 16 + 16;
    const k = box(s);
    let left = k.r, onLeft = false;
    if(left + bw > W){ left = k.l - bw; onLeft = true; }
    left = Math.max(0, Math.min(W - bw, left));
    let top = Math.max(0, Math.min(H - bh - 12, k.t - bh - 12));
    gc.fillStyle = '#fff'; gc.strokeStyle = 'rgba(0,0,0,.18)'; gc.lineWidth = 2;
    round(gc, left, top, bw, bh, 14); gc.fill(); gc.stroke();
    if(type === 'think'){
      const tx = onLeft ? left + bw - 20 : left + 20;
      [[0, 8, 5], [onLeft ? 8 : -8, 18, 3]].forEach(([dx, dy, r]) => {
        gc.beginPath(); gc.arc(tx + dx, top + bh + dy - 2, r, 0, 7); gc.fill(); gc.stroke();
      });
    } else {
      const tx = onLeft ? left + bw - 24 : left + 24;
      gc.beginPath();
      gc.moveTo(tx - 8, top + bh - 1);
      gc.lineTo(onLeft ? tx + 10 : tx - 14, top + bh + 11);
      gc.lineTo(tx + 6, top + bh - 1);
      gc.fill();
      gc.beginPath();
      gc.moveTo(tx - 8, top + bh); gc.lineTo(onLeft ? tx + 10 : tx - 14, top + bh + 11); gc.lineTo(tx + 6, top + bh);
      gc.stroke();
    }
    gc.fillStyle = '#575e75'; gc.textBaseline = 'top';
    lines.forEach((l, i) => gc.fillText(l, left + 10, top + 8 + i * 16));
    gc.restore();
  }
  function wrap(gc, text, max){
    const out = [];
    for(const para of text.split('\n')){
      let line = '';
      for(const word of para.split(' ')){
        const tryLine = line ? line + ' ' + word : word;
        if(gc.measureText(tryLine).width <= max) { line = tryLine; continue; }
        if(line) out.push(line);
        line = word;
        while(gc.measureText(line).width > max && line.length > 1){
          let n = line.length; while(n > 1 && gc.measureText(line.slice(0, n)).width > max) n--;
          out.push(line.slice(0, n)); line = line.slice(n);
        }
      }
      out.push(line);
    }
    return out;
  }
  function round(gc, x, y, w, h, r){
    gc.beginPath();
    gc.moveTo(x + r, y); gc.arcTo(x + w, y, x + w, y + h, r); gc.arcTo(x + w, y + h, x, y + h, r);
    gc.arcTo(x, y + h, x, y, r); gc.arcTo(x, y, x + w, y, r); gc.closePath();
  }

  /* -------------------------------------------------------- touching */
  function clip(k){
    const l = Math.max(0, Math.floor(k.l)), t = Math.max(0, Math.floor(k.t));
    const r = Math.min(W, Math.ceil(k.r)), b = Math.min(H, Math.ceil(k.b));
    return r > l && b > t ? { l, t, w:r - l, h:b - t } : null;
  }
  function inter(a, b){
    const l = Math.max(a.l, b.l), t = Math.max(a.t, b.t), r = Math.min(a.r, b.r), bb = Math.min(a.b, b.b);
    return r > l && bb > t ? { l, t, r, b:bb } : null;
  }
  function maskOf(gc, cv, s, rect){
    cv.width = rect.w; cv.height = rect.h;
    gc.clearRect(0, 0, rect.w, rect.h);
    drawSprite(gc, s, rect.l, rect.t, 1, true);
    return gc.getImageData(0, 0, rect.w, rect.h).data;
  }
  function touchingSprite(a, b){
    if(!b.visible || !a.visible) return false;
    const i = inter(box(a), box(b)); if(!i) return false;
    const rect = { l:Math.floor(i.l), t:Math.floor(i.t), w:Math.max(1, Math.ceil(i.r) - Math.floor(i.l)), h:Math.max(1, Math.ceil(i.b) - Math.floor(i.t)) };
    if(rect.w * rect.h > 600000) return true;
    const da = maskOf(sg, scratch, a, rect), db = maskOf(sg2, scratch2, b, rect);
    for(let p = 3; p < da.length; p += 4) if(da[p] > 50 && db[p] > 50) return true;
    return false;
  }
  function touchingEdge(s){
    const k = box(s);
    return k.l < 0 || k.t < 0 || k.r > W || k.b > H;
  }
  function touchingPoint(s, x, y){
    if(!s.visible) return false;
    const cx = W/2 + x, cy = H/2 - y, k = box(s);
    if(cx < k.l || cx > k.r || cy < k.t || cy > k.b) return false;
    const rect = { l:Math.floor(cx), t:Math.floor(cy), w:1, h:1 };
    return maskOf(sg, scratch, s, rect)[3] > 50;
  }
  const same = (d, i, c) => (d[i] & 0xF8) === (c[0] & 0xF8) && (d[i+1] & 0xF8) === (c[1] & 0xF8) && (d[i+2] & 0xF0) === (c[2] & 0xF0);
  function worldUnder(rt, s){
    const rect = clip(box(s)); if(!rect) return null;
    const mask = maskOf(sg, scratch, s, rect);
    scratch2.width = rect.w; scratch2.height = rect.h;
    sg2.clearRect(0, 0, rect.w, rect.h);
    drawWorld(sg2, rt, rect.l, rect.t, 1, s);
    return { mask, world: sg2.getImageData(0, 0, rect.w, rect.h).data, self: null, rect };
  }
  function touchingColor(rt, s, rgb){
    if(!s.visible) return false;
    const w = worldUnder(rt, s); if(!w) return false;
    for(let p = 0; p < w.mask.length; p += 4) if(w.mask[p+3] > 50 && same(w.world, p, rgb)) return true;
    return false;
  }
  function colorTouchingColor(rt, s, mine, theirs){
    if(!s.visible) return false;
    const w = worldUnder(rt, s); if(!w) return false;
    // the sprite's own pixels, with effects, at the same spot
    scratch.width = w.rect.w; scratch.height = w.rect.h;
    sg.clearRect(0, 0, w.rect.w, w.rect.h);
    drawSprite(sg, s, w.rect.l, w.rect.t, 1, false);
    const own = sg.getImageData(0, 0, w.rect.w, w.rect.h).data;
    for(let p = 0; p < own.length; p += 4) if(own[p+3] > 50 && same(own, p, mine) && same(w.world, p, theirs)) return true;
    return false;
  }
  function pick(rt, x, y){
    for(let i = rt.layers.length - 1; i >= 0; i--){
      const s = rt.layers[i];
      if(s.visible && touchingPoint(s, x, y)) return s;
    }
    return null;
  }
  /* the colour on the stage at (x,y), for the eyedropper */
  function colorAt(rt, x, y){
    const rect = { l:Math.floor(W/2 + x), t:Math.floor(H/2 - y), w:1, h:1 };
    scratch2.width = 1; scratch2.height = 1;
    drawWorld(sg2, rt, rect.l, rect.t, 1);
    const d = sg2.getImageData(0, 0, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* --------------------------------------------------------------- pen */
  function penLine(x1, y1, x2, y2, color, size){
    pg.save();
    pg.scale(PEN_RES, PEN_RES);
    pg.strokeStyle = color; pg.fillStyle = color; pg.lineWidth = size; pg.lineCap = 'round';
    if(x1 === x2 && y1 === y2){
      pg.beginPath(); pg.arc(W/2 + x1, H/2 - y1, size / 2, 0, Math.PI * 2); pg.fill();
    } else {
      pg.beginPath(); pg.moveTo(W/2 + x1, H/2 - y1); pg.lineTo(W/2 + x2, H/2 - y2); pg.stroke();
    }
    pg.restore();
    penDirty = true;
  }
  function stamp(s){ drawSprite(pg, s, 0, 0, PEN_RES); penDirty = true; }
  function penClear(){ pg.clearRect(0, 0, pen.width, pen.height); penDirty = true; }

  /* a small picture of the stage for the project list */
  function snapshot(rt, w=240){
    const c = document.createElement('canvas'); c.width = w; c.height = w * 3/4;
    const gc = c.getContext('2d');
    drawWorld(gc, rt, 0, 0, w / W);
    try { return c.toDataURL('image/jpeg', 0.7); } catch(e){ return null; }
  }

  return { W, H, attach, draw, bounds, box, touchingSprite, touchingEdge, touchingPoint, touchingColor,
           colorTouchingColor, pick, colorAt, penLine, stamp, penClear, snapshot, costumeOf, effected,
           get canvas(){ return canvas; } };
})();
