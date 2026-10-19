/* =====================================================================
   MEDIA — pictures and sounds: loading them, and turning whatever a
   student uploads into something every browser can show and play.

   Pictures: PNG, JPG, GIF, WebP, BMP, AVIF, SVG… anything the browser can
   open. Bitmaps are redrawn as PNG (keeping see-through pixels) and made
   no bigger than 960 px; SVG stays SVG. A picture with no see-through
   pixels gets a "Remove background" button (see removeBackground).

   Sounds: MP3, WAV, OGG, M4A/AAC, FLAC, WebM, AIFF, the audio out of an
   MP4… anything the browser can decode. MP3 and small WAV files are kept
   as they are; everything else is re-saved as WAV (mono, 22 kHz) so it
   plays the same on every computer in the lab.
   ===================================================================== */
window.MEDIA = (function(){
  const images = new Map();     // asset id -> HTMLImageElement (loaded) | Promise
  const buffers = new Map();    // asset id -> AudioBuffer | Promise
  const MAX_SIDE = 960;
  let ctx = null;

  function audio(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if(ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // browsers only let sound start after a click or key press
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { try { audio(); } catch(e){} }, { capture:true }));

  const url = id => id.startsWith('lib:') ? LIBRARY.picURL(id.slice(4)) : '/api/assets/' + id;

  /* ------------------------------------------------------------ images */
  let onLoad = () => {};
  function image(id){
    const got = images.get(id);
    if(got && !(got instanceof Promise)) return got;
    if(!got) loadImage(id);
    return null;
  }
  function loadImage(id){
    if(images.has(id)) return Promise.resolve(images.get(id));
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { images.set(id, img); resolve(img); onLoad(id); };
      img.onerror = () => { images.delete(id); resolve(null); };
      img.src = url(id);
    });
    images.set(id, p);
    return p;
  }
  const loadAll = ids => Promise.all(ids.map(loadImage));

  /* -------------------------------------------------------------- sound */
  async function buffer(id){
    const got = buffers.get(id);
    if(got) return got;
    const p = (async () => {
      const ac = audio();
      if(id.startsWith('lib:')){
        const s = LIBRARY.makeSound(id.slice(4));
        if(!s) return null;
        const b = ac.createBuffer(1, s.data.length, s.rate);
        b.copyToChannel ? b.copyToChannel(s.data, 0) : b.getChannelData(0).set(s.data);
        return b;
      }
      const r = await fetch(url(id));
      if(!r.ok) return null;
      return decode(await r.arrayBuffer());
    })();
    buffers.set(id, p);
    const b = await p;
    buffers.set(id, b);
    return b;
  }
  function decode(arr){
    const ac = audio();
    return new Promise((res, rej) => {
      const p = ac.decodeAudioData(arr.slice(0), res, rej);
      if(p && p.then) p.then(res, rej);
    });
  }

  /* ------------------------------------------------------------ upload */
  async function upload(blob, type){
    const r = await fetch('/api/assets', { method:'POST', headers:{ 'Content-Type':type }, body:blob, credentials:'same-origin' });
    if(r.status === 413) throw new Error(t('File too big.'));
    if(!r.ok) throw new Error('upload ' + r.status);
    return (await r.json()).id;
  }

  const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg|ico|jfif|heic|heif|tiff?)$/i;
  const SND_EXT = /\.(mp3|wav|wave|ogg|oga|opus|m4a|aac|flac|webm|aif|aiff|caf|mp4|m4v|mov|3gp|amr|wma)$/i;
  const isImage = f => /^image\//.test(f.type) || IMG_EXT.test(f.name || '');
  const isSound = f => /^(audio|video)\//.test(f.type) || SND_EXT.test(f.name || '');
  const baseName = f => String(f.name || 'file').replace(/\.[^.]+$/, '').slice(0, 40) || 'file';

  function fileToImage(file){
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(u), 1000); };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error(t('That file is not a picture this browser can open.'))); };
      img.src = u;
    });
  }

  /* Any picture file -> { asset, w, h, opaque }. `w`/`h` are the picture's
     own pixel size; the costume decides how big it shows on the stage. */
  async function importImage(file){
    const svgFile = /svg/.test(file.type) || /\.svg$/i.test(file.name || '');
    if(svgFile){
      const text = await file.text();
      if(!/<svg[\s>]/i.test(text)) throw new Error(t('That file is not a picture this browser can open.'));
      const blob = new Blob([text], { type:'image/svg+xml' });
      const img = await fileToImage(blob);
      let w = img.naturalWidth || 100, h = img.naturalHeight || 100;
      const asset = await upload(blob, 'image/svg+xml');
      images.set(asset, img);
      return { asset, w, h, opaque:false };
    }
    const img = await fileToImage(file);
    let w = img.naturalWidth, h = img.naturalHeight;
    if(!w || !h) throw new Error(t('That file is not a picture this browser can open.'));
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    const opaque = isOpaque(g.getImageData(0, 0, w, h).data);
    return { ...(await canvasAsset(c)), w, h, opaque };
  }
  async function canvasAsset(c){
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const asset = await upload(blob, 'image/png');
    const img = new Image();
    await new Promise(r => { img.onload = img.onerror = r; img.src = c.toDataURL('image/png'); setTimeout(r, 3000); });
    images.set(asset, img);
    return { asset, w:c.width, h:c.height };
  }
  function isOpaque(d){
    for(let i = 3; i < d.length; i += 16) if(d[i] < 250) return false;
    return true;
  }

  /* REMOVE BACKGROUND: the colour round the edge of the picture is the
     background. Flood in from every edge pixel that is close to it and
     make it see-through, then soften the cut by one pixel. Works on the
     usual uploads (a drawing on white, a sprite on a flat colour). */
  async function removeBackground(assetId, tolerance=48){
    const img = await loadImage(assetId);
    if(!img) throw new Error('no picture');
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    // the background colour: the most common colour among edge pixels
    const counts = new Map();
    const key = i => (d[i]>>4)<<8 | (d[i+1]>>4)<<4 | (d[i+2]>>4);
    for(let x = 0; x < w; x++){ [0, h-1].forEach(y => { const k = key((y*w+x)*4); counts.set(k, (counts.get(k)||0)+1); }); }
    for(let y = 0; y < h; y++){ [0, w-1].forEach(x => { const k = key((y*w+x)*4); counts.set(k, (counts.get(k)||0)+1); }); }
    let best = 0, bestN = -1; counts.forEach((n, k) => { if(n > bestN){ bestN = n; best = k; } });
    const br = ((best>>8)&15)*16+8, bg = ((best>>4)&15)*16+8, bb = (best&15)*16+8;
    const near = i => d[i+3] > 0 && Math.abs(d[i]-br) + Math.abs(d[i+1]-bg) + Math.abs(d[i+2]-bb) <= tolerance*1.5;
    const seen = new Uint8Array(w*h), stack = [];
    const push = (x, y) => { const p = y*w+x; if(!seen[p] && near(p*4)){ seen[p] = 1; stack.push(p); } };
    for(let x = 0; x < w; x++){ push(x, 0); push(x, h-1); }
    for(let y = 0; y < h; y++){ push(0, y); push(w-1, y); }
    while(stack.length){
      const p = stack.pop(), x = p % w, y = (p / w) | 0;
      d[p*4+3] = 0;
      if(x > 0) push(x-1, y); if(x < w-1) push(x+1, y);
      if(y > 0) push(x, y-1); if(y < h-1) push(x, y+1);
    }
    // soften: a kept pixel next to a removed one goes half see-through
    for(let y = 1; y < h-1; y++) for(let x = 1; x < w-1; x++){
      const p = y*w+x; if(seen[p]) continue;
      if(seen[p-1] || seen[p+1] || seen[p-w] || seen[p+w]) d[p*4+3] = Math.min(d[p*4+3], 150);
    }
    g.putImageData(id, 0, 0);
    return canvasAsset(c);
  }
  async function flip(assetId){
    const img = await loadImage(assetId);
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0);
    return canvasAsset(c);
  }

  /* Any sound file -> { asset, type, duration }. */
  async function importSound(file){
    const arr = await file.arrayBuffer();
    let buf;
    try { buf = await decode(arr); }
    catch(e){ throw new Error(t('That file is not a sound this browser can play.')); }
    if(!buf || !buf.length) throw new Error(t('That file is not a sound this browser can play.'));
    const type = (file.type || '').toLowerCase();
    const keep = (type === 'audio/mpeg' || type === 'audio/mp3' || /\.mp3$/i.test(file.name || '')) && arr.byteLength <= 10e6
              || (/wav/.test(type) || /\.wav$/i.test(file.name || '')) && arr.byteLength <= 3e6;
    let blob, mime;
    if(keep){ blob = new Blob([arr], { type: /wav/.test(type) || /\.wav$/i.test(file.name||'') ? 'audio/wav' : 'audio/mpeg' }); mime = blob.type; }
    else { blob = toWav(buf, 22050, 180); mime = 'audio/wav'; }
    const asset = await upload(blob, mime);
    buffers.set(asset, buf);
    return { asset, type:mime, duration: Math.min(buf.duration, keep ? buf.duration : 180) };
  }
  /* mono 16-bit WAV at `rate`, at most `maxSecs` long */
  function toWav(buf, rate, maxSecs){
    const n = Math.min(Math.floor(buf.duration * rate), rate * maxSecs);
    const chans = [...Array(buf.numberOfChannels)].map((_, i) => buf.getChannelData(i));
    const step = buf.sampleRate / rate;
    const out = new DataView(new ArrayBuffer(44 + n*2));
    const w = (o, s) => [...s].forEach((ch, i) => out.setUint8(o+i, ch.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n*2, true); w(8, 'WAVEfmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, rate, true); out.setUint32(28, rate*2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, n*2, true);
    for(let i = 0; i < n; i++){
      const src = i * step, j = Math.floor(src), f = src - j;
      let v = 0;
      for(const c of chans) v += (c[j] || 0) * (1-f) + (c[j+1] || 0) * f;
      v = Math.max(-1, Math.min(1, v / chans.length));
      out.setInt16(44 + i*2, v < 0 ? v*0x8000 : v*0x7fff, true);
    }
    return new Blob([out.buffer], { type:'audio/wav' });
  }

  /* RECORD from the microphone. start() -> stop() gives a sound like importSound. */
  async function record(){
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.start();
    return {
      stop: () => new Promise(resolve => {
        rec.onstop = async () => {
          stream.getTracks().forEach(tr => tr.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          try { resolve(await importSound(new File([blob], 'recording', { type: blob.type }))); }
          catch(e){ resolve({ error:e.message }); }
        };
        rec.stop();
      })
    };
  }

  /* a library sound as a costume-free record */
  async function libSound(key){
    const b = await buffer('lib:' + key);
    return { asset:'lib:' + key, type:'synth', duration: b ? b.duration : 0.5 };
  }

  /* draw an asset into a thumbnail-sized data URL */
  function thumb(assetId, size=96){
    const img = image(assetId);
    if(!img) return null;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const w = img.naturalWidth || size, h = img.naturalHeight || size, k = Math.min(size / w, size / h);
    g.drawImage(img, (size - w*k) / 2, (size - h*k) / 2, w*k, h*k);
    return c.toDataURL();
  }

  return { audio, image, loadImage, loadAll, buffer, url, importImage, importSound, removeBackground, flip, canvasAsset,
           record, libSound, isImage, isSound, baseName, thumb, toWav, set onLoad(f){ onLoad = f; } };
})();
