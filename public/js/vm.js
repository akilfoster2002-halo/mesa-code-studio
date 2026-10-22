/* =====================================================================
   VM — runs the blocks, with Scratch's rules.

   Every running script is a THREAD: a JavaScript generator that runs
   until it reaches the end of a loop iteration or a wait, then yields
   until the next frame. Thirty frames a second, like Scratch; within a
   frame, threads that have not drawn anything get stepped again (for up
   to 75% of the frame), so a counting loop is fast and a moving sprite
   moves one step per frame.

   "stop this script" and "stop all" are thrown, so they unwind out of any
   depth of loops and My Blocks.
   ===================================================================== */
window.VM = (function(){
  const W = 480, H = 360, FPS = 30, MAX_CLONES = 300;
  const STOP_SCRIPT = { stop:'script' }, STOP_ALL = { stop:'all' };
  const now = () => performance.now();

  const rt = {
    project:null, stage:null, sprites:[], layers:[], threads:[],
    keys:new Set(), mouse:{ x:0, y:0, down:false },
    timerStart:now(), answer:'', username:'', redraw:true, dirty:true,
    cloneCount:0, askQueue:[], asking:null, edge:new Map(),
    onAsk:null, onChange:null, onError:null, loudness:-1, turbo:false
  };

  /* --------------------------------------------------------------- cast */
  const toNum = v => {
    if(typeof v === 'number') return isNaN(v) ? 0 : v;
    if(typeof v === 'boolean') return v ? 1 : 0;
    const s = String(v == null ? '' : v).trim();
    if(s === '') return 0;
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };
  const toStr = v => v == null ? '' : typeof v === 'number' ? (Object.is(v, -0) ? '0' : String(v)) : String(v);
  const toBool = v => {
    if(typeof v === 'boolean') return v;
    if(typeof v === 'number') return v !== 0 && !isNaN(v);
    const s = String(v == null ? '' : v).toLowerCase();
    return !(s === '' || s === '0' || s === 'false');
  };
  const isWhite = v => typeof v === 'string' && v.trim() === '';
  function compare(a, b){
    let n1 = Number(a), n2 = Number(b);
    if(n1 === 0 && isWhite(a)) n1 = NaN; else if(n2 === 0 && isWhite(b)) n2 = NaN;
    if(isNaN(n1) || isNaN(n2)){
      const s1 = toStr(a).toLowerCase(), s2 = toStr(b).toLowerCase();
      return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
    }
    return n1 === n2 ? 0 : n1 - n2;
  }
  const toRGB = v => {
    if(typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.trim())){
      const h = v.trim().replace('#', '');
      return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    }
    const n = toNum(v) >>> 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const wrapDir = d => { d = ((d + 179) % 360 + 360) % 360 - 179; return d; };

  /* ------------------------------------------------------------- loading */
  function load(project, opts={}){
    stopAll();
    rt.project = project;
    rt.stage = project.targets[0];
    rt.sprites = project.targets.slice(1);
    rt.layers = rt.sprites.slice().sort((a, b) => (a.layer || 0) - (b.layer || 0));
    rt.username = opts.username || '';
    rt.cloneCount = 0;
    rt.edge.clear();
    for(const tg of project.targets) fresh(tg);
    RENDER.penClear();
    rt.timerStart = now();
    rt.dirty = true;
  }
  function fresh(tg){
    tg._fx = {}; tg._sfx = { pitch:0, pan:0 }; tg._sounds = new Set(); tg._bubble = null;
    tg._pen = tg._pen || { down:false, h:66, s:100, v:100, a:0, size:1 };
    tg._inst = 1;
  }
  /* call before saving: the layer order goes back into the sprites */
  function syncLayers(){
    let i = 1;
    for(const s of rt.layers) if(!s.isClone) s.layer = i++;
  }

  /* ------------------------------------------------------------ targets */
  const all = () => rt.stage ? [rt.stage, ...rt.layers] : [];
  const spriteNamed = name => rt.sprites.find(s => s.name === name) || null;
  const instancesOf = name => rt.layers.filter(s => s.name === name);
  function original(s){ return s.isClone ? s.original : s; }

  /* ------------------------------------------------------------- threads */
  let nextThread = 1;
  function startThread(target, script, blocks, opts={}){
    const th = { id:nextThread++, target, script, done:false, warp:0, warpStart:0, frames:[], sleeping:false,
      hat: blocks[0], gen:null };
    th.gen = (function*(){
      const body = blocks[0] && BLOCKS.of(blocks[0].op) && BLOCKS.of(blocks[0].op).shape === 'hat' && !opts.hatToo
        ? blocks.slice(1) : blocks;
      if(blocks[0] && blocks[0].op === 'procedures_definition') return;
      yield* runList(body, th);
    })();
    rt.threads.push(th);
    return th;
  }
  function stopThread(th){ th.done = true; }
  function threadsFor(target, script){ return rt.threads.filter(t => !t.done && t.target === target && t.script === script); }

  /* start every script under a hat (`op`), for every target or just one */
  function startHats(op, match, only, restart=true){
    const started = [];
    for(const tg of only ? [only] : all()){
      if(!tg) continue;
      for(const s of tg.scripts){
        const h = s.blocks[0];
        if(!h || h.op !== op) continue;
        if(match && !match(h, tg)) continue;
        const running = threadsFor(tg, s);
        if(running.length){
          if(!restart) continue;
          running.forEach(stopThread);
          // restart it in its old place in the line, like Scratch: pushed to the back, a
          // script restarted every frame (broadcast in a forever) would never get to run
          const th = startThread(tg, s, s.blocks);
          rt.threads.pop();
          rt.threads.splice(rt.threads.indexOf(running[0]), 0, th);
          started.push(th);
          continue;
        }
        started.push(startThread(tg, s, s.blocks));
      }
    }
    return started;
  }

  function step(){
    // edge-triggered hats: when timer/loudness > n
    for(const tg of all()) for(const s of tg.scripts){
      const h = s.blocks[0];
      if(!h || h.op !== 'event_whengreaterthan') continue;
      const which = h.args.WHENGREATERTHANMENU, v = evalArg(h, 'VALUE', null, tg);
      const cur = (which === 'loudness' ? loudness() : (now() - rt.timerStart) / 1000) > toNum(v);
      const key = s.id + '|' + (tg.isClone ? tg._cid : tg.id);
      const was = rt.edge.get(key);
      rt.edge.set(key, cur);
      if(cur && !was) startHats('event_whengreaterthan', (hh) => hh === h, tg, false);
    }
    const start = now();
    rt.redraw = false;
    do {
      let active = 0, awake = 0;
      // the live list, like Scratch: a script started or restarted this frame runs this frame too
      for(let i = 0; i < rt.threads.length; i++){
        const th = rt.threads[i];
        if(th.done) continue;
        active++;
        th.sleeping = false;
        try {
          const r = th.gen.next();
          if(r.done) th.done = true;
        } catch(e){
          if(e === STOP_SCRIPT) th.done = true;
          else if(e === STOP_ALL){ stopAll(); break; }
          else { th.done = true; console.error(e); rt.onError && rt.onError(e, th); }
        }
        if(!th.done && !th.sleeping) awake++;
      }
      rt.threads = rt.threads.filter(t => !t.done);
      if(!active || !awake) break;
    } while(!rt.redraw && !rt.turbo && now() - start < 1000 / FPS * 0.75);
    if(rt.redraw) rt.dirty = true;
  }

  /* a loop iteration ends: yield to the next frame unless running a My
     Block "without screen refresh" (and then only for half a second) */
  function* tick(th){
    if(th.warp > 0 && now() - th.warpStart < 500) return;
    yield;
  }
  function* sleep(th, ms){
    const end = now() + ms;
    rt.redraw = true;
    th.sleeping = true;
    yield;
    while(now() < end){ th.sleeping = true; yield; }
  }
  function* waitFor(th, fn){
    while(!fn()){ th.sleeping = true; yield; }
  }

  function* runList(list, th){
    if(!list) return;
    for(let i = 0; i < list.length; i++){
      const b = list[i];
      if(b) yield* run(b, th);
    }
  }

  /* --------------------------------------------------------- reporters */
  function evalArg(b, name, th, target){
    const inp = b.inputs && b.inputs[name];
    if(inp) return evaluate(inp, th, target);
    const v = b.args ? b.args[name] : undefined;
    return v === undefined ? '' : v;
  }
  const A = (b, name, th) => evalArg(b, name, th, th.target);
  const N = (b, name, th) => toNum(A(b, name, th));
  const S = (b, name, th) => toStr(A(b, name, th));
  const Bo = (b, name, th) => {
    const inp = b.inputs && b.inputs[name];
    return inp ? toBool(evaluate(inp, th, th.target)) : false;
  };

  function evaluate(b, th, target){
    const s = target || th.target;
    const thx = th || { target:s, frames:[] };
    switch(b.op){
      case 'motion_xposition': return s.isStage ? 0 : limit(s.x);
      case 'motion_yposition': return s.isStage ? 0 : limit(s.y);
      case 'motion_direction': return s.isStage ? 90 : s.direction;
      case 'looks_costumenumbername': return b.args.NUMBER_NAME === 'name' ? RENDER.costumeOf(s).name : s.currentCostume + 1;
      case 'looks_backdropnumbername': return b.args.NUMBER_NAME === 'name' ? RENDER.costumeOf(rt.stage).name : rt.stage.currentCostume + 1;
      case 'looks_size': return s.isStage ? 100 : Math.round(s.size);
      case 'sound_volume': return s.volume;
      case 'sensing_touchingobject': return touching(s, A(b, 'TOUCHINGOBJECTMENU', thx));
      case 'sensing_touchingcolor': return !s.isStage && RENDER.touchingColor(rt, s, toRGB(A(b, 'COLOR', thx)));
      case 'sensing_coloristouchingcolor': return !s.isStage && RENDER.colorTouchingColor(rt, s, toRGB(A(b, 'COLOR', thx)), toRGB(A(b, 'COLOR2', thx)));
      case 'sensing_distanceto': {
        if(s.isStage) return 10000;
        const p = pointOf(A(b, 'DISTANCETOMENU', thx));
        return p ? Math.sqrt((s.x - p[0])**2 + (s.y - p[1])**2) : 10000;
      }
      case 'sensing_answer': return rt.answer;
      case 'sensing_keypressed': return keyDown(A(b, 'KEY_OPTION', thx));
      case 'sensing_mousedown': return rt.mouse.down;
      case 'sensing_mousex': return Math.round(rt.mouse.x);
      case 'sensing_mousey': return Math.round(rt.mouse.y);
      case 'sensing_loudness': return loudness();
      case 'sensing_timer': return Math.round((now() - rt.timerStart)) / 1000;
      case 'sensing_of': return propOf(b.args.PROPERTY, A(b, 'OBJECT', thx));
      case 'sensing_current': {
        const d = new Date();
        switch(b.args.CURRENTMENU){
          case 'year': return d.getFullYear(); case 'month': return d.getMonth() + 1; case 'date': return d.getDate();
          case 'dayofweek': return d.getDay() + 1; case 'hour': return d.getHours(); case 'minute': return d.getMinutes();
          case 'second': return d.getSeconds();
        }
        return 0;
      }
      case 'sensing_dayssince2000': return (Date.now() - Date.UTC(2000, 0, 1) + new Date().getTimezoneOffset() * 0) / 86400000;
      case 'sensing_username': return rt.username;
      case 'operator_add': return N(b,'NUM1',thx) + N(b,'NUM2',thx);
      case 'operator_subtract': return N(b,'NUM1',thx) - N(b,'NUM2',thx);
      case 'operator_multiply': return N(b,'NUM1',thx) * N(b,'NUM2',thx);
      case 'operator_divide': return N(b,'NUM1',thx) / N(b,'NUM2',thx);
      case 'operator_random': {
        const f = A(b,'FROM',thx), t2 = A(b,'TO',thx);
        let lo = toNum(f), hi = toNum(t2);
        if(lo > hi) [lo, hi] = [hi, lo];
        const ints = Number.isInteger(lo) && Number.isInteger(hi) && !String(f).includes('.') && !String(t2).includes('.');
        return ints ? lo + Math.floor(Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo);
      }
      case 'operator_gt': return compare(A(b,'OPERAND1',thx), A(b,'OPERAND2',thx)) > 0;
      case 'operator_lt': return compare(A(b,'OPERAND1',thx), A(b,'OPERAND2',thx)) < 0;
      case 'operator_equals': return compare(A(b,'OPERAND1',thx), A(b,'OPERAND2',thx)) === 0;
      case 'operator_and': return Bo(b,'OPERAND1',thx) && Bo(b,'OPERAND2',thx);
      case 'operator_or': return Bo(b,'OPERAND1',thx) || Bo(b,'OPERAND2',thx);
      case 'operator_not': return !Bo(b,'OPERAND',thx);
      case 'operator_join': return S(b,'STRING1',thx) + S(b,'STRING2',thx);
      case 'operator_letter_of': { const str = S(b,'STRING',thx), i = Math.floor(N(b,'LETTER',thx)) - 1; return i >= 0 && i < str.length ? str[i] : ''; }
      case 'operator_length': return S(b,'STRING',thx).length;
      case 'operator_contains': return S(b,'STRING1',thx).toLowerCase().includes(S(b,'STRING2',thx).toLowerCase());
      case 'operator_mod': { const n = N(b,'NUM1',thx), m = N(b,'NUM2',thx); let r = n % m; if(r / m < 0) r += m; return r; }
      case 'operator_round': return Math.round(N(b,'NUM',thx));
      case 'operator_mathop': return mathop(b.args.OPERATOR, N(b,'NUM',thx));
      case 'data_variable': return varOf(s, b.args.VARIABLE).value;
      case 'data_listcontents': return listText(listOf(s, b.args.LIST).value);
      case 'data_itemoflist': { const l = listOf(s, b.args.LIST).value, i = index(A(b,'INDEX',thx), l.length); return i ? l[i-1] : ''; }
      case 'data_itemnumoflist': { const l = listOf(s, b.args.LIST).value, it = A(b,'ITEM',thx); for(let i = 0; i < l.length; i++) if(compare(l[i], it) === 0) return i + 1; return 0; }
      case 'data_lengthoflist': return listOf(s, b.args.LIST).value.length;
      case 'data_listcontainsitem': { const it = A(b,'ITEM',thx); return listOf(s, b.args.LIST).value.some(x => compare(x, it) === 0); }
      case 'argument_reporter': case 'argument_boolean': {
        const f = thx.frames[thx.frames.length - 1];
        if(f && b.name in f) return f[b.name];
        return b.op === 'argument_boolean' ? false : 0;
      }
      case 'music_getTempo': return rt.stage.tempo;
    }
    return '';
  }
  const limit = v => Math.round(v * 1e8) / 1e8;
  function mathop(op, n){
    const r = x => Math.round(x * 1e10) / 1e10;
    switch(op){
      case 'abs': return Math.abs(n); case 'floor': return Math.floor(n); case 'ceiling': return Math.ceil(n);
      case 'sqrt': return Math.sqrt(n); case 'sin': return r(Math.sin(n * Math.PI / 180));
      case 'cos': return r(Math.cos(n * Math.PI / 180));
      case 'tan': { const m = ((n % 360) + 360) % 360; if(m === 90) return Infinity; if(m === 270) return -Infinity; return r(Math.tan(n * Math.PI / 180)); }
      case 'asin': return Math.asin(n) * 180 / Math.PI; case 'acos': return Math.acos(n) * 180 / Math.PI;
      case 'atan': return Math.atan(n) * 180 / Math.PI; case 'ln': return Math.log(n); case 'log': return Math.log10(n);
      case 'e ^': return Math.exp(n); case '10 ^': return Math.pow(10, n);
    }
    return 0;
  }
  function listText(l){
    const single = l.every(x => toStr(x).length === 1);
    return l.map(toStr).join(single ? '' : ' ');
  }
  /* "last", "random", "all" or a number, to a 1-based index (0 = none) */
  function index(v, len, allowAll){
    const s = toStr(v).toLowerCase();
    if(s === 'last') return len || 0;
    if(s === 'random' || s === 'any') return len ? 1 + Math.floor(Math.random() * len) : 0;
    if(s === 'all') return allowAll ? 'all' : 0;
    const n = Math.floor(toNum(v));
    return n >= 1 && n <= len ? n : 0;
  }

  /* -------------------------------------------------- variables, lists */
  function varOf(s, name){
    name = String(name == null ? '' : name);
    if(!s.isStage && Object.prototype.hasOwnProperty.call(s.vars, name)) return ref(s.vars, name);
    if(!Object.prototype.hasOwnProperty.call(rt.stage.vars, name)) rt.stage.vars[name] = 0;
    return ref(rt.stage.vars, name);
  }
  function listOf(s, name){
    name = String(name == null ? '' : name);
    if(!s.isStage && Object.prototype.hasOwnProperty.call(s.lists, name)) return ref(s.lists, name);
    if(!Object.prototype.hasOwnProperty.call(rt.stage.lists, name)) rt.stage.lists[name] = [];
    if(!Array.isArray(rt.stage.lists[name])) rt.stage.lists[name] = [];
    return ref(rt.stage.lists, name);
  }
  const ref = (obj, k) => ({ get value(){ return obj[k]; }, set value(v){ obj[k] = v; } });

  /* ---------------------------------------------------------- sensing */
  function pointOf(v){
    if(v === '_mouse_') return [rt.mouse.x, rt.mouse.y];
    if(v === '_random_') return [Math.round(Math.random() * W - W/2), Math.round(Math.random() * H - H/2)];
    const s = spriteNamed(toStr(v));
    return s ? [s.x, s.y] : null;
  }
  function touching(s, what){
    if(s.isStage) return false;
    if(what === '_mouse_') return RENDER.touchingPoint(s, rt.mouse.x, rt.mouse.y);
    if(what === '_edge_') return RENDER.touchingEdge(s);
    const name = toStr(what);
    for(const o of instancesOf(name)) if(o !== s && RENDER.touchingSprite(s, o)) return true;
    return false;
  }
  function propOf(prop, obj){
    if(obj === '_stage_' || toStr(obj) === 'Stage' && !spriteNamed('Stage')){
      const st = rt.stage;
      if(prop === 'backdrop #') return st.currentCostume + 1;
      if(prop === 'backdrop name') return RENDER.costumeOf(st).name;
      if(prop === 'volume') return st.volume;
      return Object.prototype.hasOwnProperty.call(st.vars, prop) ? st.vars[prop] : 0;
    }
    const s = spriteNamed(toStr(obj));
    if(!s) return 0;
    switch(prop){
      case 'x position': return limit(s.x); case 'y position': return limit(s.y);
      case 'direction': return s.direction; case 'costume #': return s.currentCostume + 1;
      case 'costume name': return RENDER.costumeOf(s).name; case 'size': return Math.round(s.size);
      case 'volume': return s.volume;
    }
    return Object.prototype.hasOwnProperty.call(s.vars, prop) ? s.vars[prop] : 0;
  }
  const KEYNAME = { ' ':'space', 'ArrowUp':'up arrow', 'ArrowDown':'down arrow', 'ArrowLeft':'left arrow', 'ArrowRight':'right arrow', 'Enter':'enter' };
  function keyName(e){
    if(KEYNAME[e.key]) return KEYNAME[e.key];
    if(e.key && e.key.length === 1) return e.key.toLowerCase();
    return e.key ? e.key.toLowerCase() : '';
  }
  function keyDown(k){
    k = toStr(k).toLowerCase();
    if(k === 'any') return rt.keys.size > 0;
    if(typeof k === 'string' && /^\d+$/.test(k) && Number(k) >= 48 && k.length > 1) k = String.fromCharCode(Number(k)).toLowerCase();
    return rt.keys.has(k);
  }
  function pressKey(name){
    if(!name) return;
    const isNew = !rt.keys.has(name);
    rt.keys.add(name);
    if(isNew || true) startHats('event_whenkeypressed', h => h.args.KEY_OPTION === name || h.args.KEY_OPTION === 'any', null, false);
  }
  function releaseKey(name){ rt.keys.delete(name); }

  /* microphone loudness, 0–100, switched on the first time it is asked for */
  let mic = null;
  function loudness(){
    if(!mic){
      mic = { level:-1 };
      if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
        navigator.mediaDevices.getUserMedia({ audio:true }).then(stream => {
          const ac = MEDIA.audio(), src = ac.createMediaStreamSource(stream), an = ac.createAnalyser();
          an.fftSize = 1024; src.connect(an);
          const d = new Float32Array(an.fftSize);
          mic.read = () => { an.getFloatTimeDomainData(d); let s = 0; for(const v of d) s += v*v; return Math.min(100, Math.round(Math.sqrt(s / d.length) * 300)); };
        }).catch(() => {});
    }
    return mic.read ? mic.read() : -1;
  }

  /* ------------------------------------------------------------ motion */
  function moveTo(s, x, y, fence=true){
    if(s.isStage) return;
    const ox = s.x, oy = s.y;
    s.x = x; s.y = y;
    if(fence) keepInFence(s);
    if(s._pen.down) RENDER.penLine(ox, oy, s.x, s.y, penCSS(s._pen), s._pen.size);
    if(s.visible) rt.redraw = true;
    rt.dirty = true;
  }
  /* a sprite may go off the edge, but never so far that none of it shows */
  function keepInFence(s){
    const b = RENDER.bounds(s);
    const ix = Math.floor(Math.min(15, (b.right - b.left) / 2)), iy = Math.floor(Math.min(15, (b.top - b.bottom) / 2));
    let dx = 0, dy = 0;
    if(b.right < -W/2 + ix) dx = -W/2 + ix - b.right;
    if(b.left > W/2 - ix) dx = W/2 - ix - b.left;
    if(b.top < -H/2 + iy) dy = -H/2 + iy - b.top;
    if(b.bottom > H/2 - iy) dy = H/2 - iy - b.bottom;
    s.x += dx; s.y += dy;
  }
  function setDir(s, d){
    if(s.isStage) return;
    if(!isFinite(d)) return;
    s.direction = wrapDir(d);
    if(s.visible) rt.redraw = true;
    rt.dirty = true;
  }
  function bounce(s){
    const b = RENDER.bounds(s);
    const dl = Math.max(0, W/2 + b.left), dt = Math.max(0, H/2 - b.top), dr = Math.max(0, W/2 - b.right), db = Math.max(0, H/2 + b.bottom);
    let near = 'left', min = dl;
    if(dt < min){ min = dt; near = 'top'; }
    if(dr < min){ min = dr; near = 'right'; }
    if(db < min){ min = db; near = 'bottom'; }
    if(min > 0) return;
    const rad = (90 - s.direction) * Math.PI / 180;
    let dx = Math.cos(rad), dy = -Math.sin(rad);
    if(near === 'left') dx = Math.max(0.2, Math.abs(dx));
    else if(near === 'top') dy = Math.max(0.2, Math.abs(dy));
    else if(near === 'right') dx = 0 - Math.max(0.2, Math.abs(dx));
    else dy = 0 - Math.max(0.2, Math.abs(dy));
    setDir(s, Math.atan2(dy, dx) * 180 / Math.PI + 90);
    // and back inside the stage
    const nb = RENDER.bounds(s);
    let x = s.x, y = s.y;
    if(nb.left < -W/2) x += -W/2 - nb.left;
    if(nb.right > W/2) x -= nb.right - W/2;
    if(nb.top > H/2) y -= nb.top - H/2;
    if(nb.bottom < -H/2) y += -H/2 - nb.bottom;
    moveTo(s, x, y);
  }

  /* ------------------------------------------------------------- looks */
  function setCostume(s, v){
    const list = s.costumes;
    if(typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && !list.some(c => c.name === v))){
      const n = Math.round(toNum(v));
      const i = ((n - 1) % list.length + list.length) % list.length;
      s.currentCostume = i;
    } else {
      const name = toStr(v);
      const i = list.findIndex(c => c.name === name);
      if(i >= 0) s.currentCostume = i;
      else if(s.isStage && name === 'next backdrop' || !s.isStage && name === 'next costume') s.currentCostume = (s.currentCostume + 1) % list.length;
      else if(s.isStage && name === 'previous backdrop' || !s.isStage && name === 'previous costume') s.currentCostume = (s.currentCostume - 1 + list.length) % list.length;
      else if(s.isStage && name === 'random backdrop' && list.length > 1){
        let i2; do { i2 = Math.floor(Math.random() * list.length); } while(i2 === s.currentCostume); s.currentCostume = i2;
      }
    }
    if(s.visible || s.isStage) rt.redraw = true;
    rt.dirty = true;
    if(!s.isStage) setSize(s, s.size);
  }
  function setBackdrop(v){
    const before = rt.stage.currentCostume;
    setCostume(rt.stage, v);
    const name = RENDER.costumeOf(rt.stage).name;
    return startHats('event_whenbackdropswitchesto', h => h.args.BACKDROP === name);
  }
  function setSize(s, v){
    if(s.isStage) return;
    const c = RENDER.costumeOf(s), cw = c.w / (c.res || 1), ch = c.h / (c.res || 1);
    const min = Math.min(1, Math.max(5 / cw, 5 / ch)) * 100;
    const max = Math.min(1.5 * W / cw, 1.5 * H / ch) * 100;
    s.size = Math.max(min, Math.min(max, v));
    if(s.visible) rt.redraw = true;
    rt.dirty = true;
  }
  function setEffect(s, name, v){
    if(name === 'ghost') v = Math.max(0, Math.min(100, v));
    if(name === 'brightness') v = Math.max(-100, Math.min(100, v));
    s._fx[name] = v;
    rt.redraw = true; rt.dirty = true;
  }
  function layerTo(s, i){
    const k = rt.layers.indexOf(s); if(k < 0) return;
    rt.layers.splice(k, 1);
    rt.layers.splice(Math.max(0, Math.min(rt.layers.length, i)), 0, s);
    rt.redraw = true; rt.dirty = true;
  }
  function say(s, type, text){
    const str = toStr(text);
    s._bubble = str === '' ? null : { type, text: str, id: Math.random() };
    rt.redraw = true; rt.dirty = true;
    return s._bubble && s._bubble.id;
  }

  /* -------------------------------------------------------------- sound */
  function soundFor(s, v){
    const list = s.sounds;
    if(!list.length) return null;
    const name = toStr(v);
    const byName = list.find(x => x.name === name);
    if(byName) return byName;
    if(name.trim() !== '' && !isNaN(Number(name))){
      const n = Math.round(Number(name));
      return list[((n - 1) % list.length + list.length) % list.length];
    }
    return null;
  }
  function playSound(s, snd){
    const handle = { done:false, src:null };
    for(const h of [...s._sounds]) if(h.snd === snd){ try { h.src.stop(); } catch(e){} h.done = true; s._sounds.delete(h); }
    handle.snd = snd;
    s._sounds.add(handle);
    MEDIA.buffer(snd.asset).then(buf => {
      if(handle.done || !buf){ handle.done = true; s._sounds.delete(handle); return; }
      const ac = MEDIA.audio();
      const src = ac.createBufferSource(); src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (s._sfx.pitch || 0) / 120);
      const gain = ac.createGain(); gain.gain.value = s.volume / 100;
      let node = src;
      node.connect(gain); node = gain;
      if(ac.createStereoPanner){ const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (s._sfx.pan || 0) / 100)); node.connect(p); node = p; }
      node.connect(ac.destination);
      handle.src = src; handle.gain = gain;
      src.onended = () => { handle.done = true; s._sounds.delete(handle); };
      src.start();
    }).catch(() => { handle.done = true; s._sounds.delete(handle); });
    return handle;
  }
  function stopSounds(s){
    for(const h of s._sounds || []){ h.done = true; try { h.src && h.src.stop(); } catch(e){} }
    if(s._sounds) s._sounds.clear();
  }
  function updateVolume(s){
    for(const h of s._sounds) if(h.gain) h.gain.gain.value = s.volume / 100;
    for(const h of s._sounds) if(h.src) h.src.playbackRate.value = Math.pow(2, (s._sfx.pitch || 0) / 120);
  }

  /* --------------------------------------------------------------- pen */
  function penCSS(p){
    const [r, g, b] = hsv(p.h / 100, p.s / 100, p.v / 100);
    return `rgba(${r|0},${g|0},${b|0},${1 - p.a / 100})`;
  }
  function hsv(h, s, v){
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f*s), t2 = v * (1 - (1-f)*s);
    return [[v,t2,p],[q,v,p],[p,v,t2],[p,q,v],[t2,p,v],[v,p,q]][i % 6].map(x => x * 255);
  }
  function setPenColor(p, rgb){
    const [r, g, b] = rgb.map(x => x / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if(d){ if(mx === r) h = ((g - b) / d) % 6; else if(mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if(h < 0) h += 1; }
    p.h = h * 100; p.s = mx ? d / mx * 100 : 0; p.v = mx * 100; p.a = 0;
  }
  function penParam(p, which, v, change){
    const key = { color:'h', saturation:'s', brightness:'v', transparency:'a' }[which] || 'h';
    let x = change ? p[key] + v : v;
    if(key === 'h') x = ((x % 100) + 100) % 100; else x = Math.max(0, Math.min(100, x));
    p[key] = x;
  }

  /* ------------------------------------------------------------- music */
  const music = window.MUSIC || null;

  /* ------------------------------------------------------------- clones */
  let cloneId = 1;
  function makeClone(src){
    if(rt.cloneCount >= MAX_CLONES || src.isStage) return null;
    const o = original(src);
    const c = {
      ...src, isClone:true, original:o, _cid: cloneId++,
      vars: JSON.parse(JSON.stringify(src.vars)), lists: JSON.parse(JSON.stringify(src.lists)),
      _fx: { ...src._fx }, _sfx: { ...src._sfx }, _sounds:new Set(), _pen: { ...src._pen }, _bubble:null
    };
    rt.cloneCount++;
    const k = rt.layers.indexOf(src);
    rt.layers.splice(k < 0 ? rt.layers.length : k, 0, c);       // just under the one it was made from
    rt.redraw = true; rt.dirty = true;
    startHats('control_start_as_clone', null, c);
    return c;
  }
  function removeClone(c){
    if(!c.isClone) return;
    rt.threads.forEach(t => { if(t.target === c) t.done = true; });
    stopSounds(c);
    const k = rt.layers.indexOf(c);
    if(k >= 0){ rt.layers.splice(k, 1); rt.cloneCount--; }
    rt.redraw = true; rt.dirty = true;
  }

  /* ------------------------------------------------------------- run one */
  function* run(b, th){
    const s = th.target, st = s.isStage;
    switch(b.op){
      /* motion */
      case 'motion_movesteps': if(!st){ const n = N(b,'STEPS',th), r = (90 - s.direction) * Math.PI / 180; moveTo(s, s.x + n*Math.cos(r), s.y + n*Math.sin(r)); } return;
      case 'motion_turnright': if(!st) setDir(s, s.direction + N(b,'DEGREES',th)); return;
      case 'motion_turnleft': if(!st) setDir(s, s.direction - N(b,'DEGREES',th)); return;
      case 'motion_goto': if(!st){ const p = pointOf(A(b,'TO',th)); if(p) moveTo(s, p[0], p[1]); } return;
      case 'motion_gotoxy': if(!st) moveTo(s, N(b,'X',th), N(b,'Y',th)); return;
      case 'motion_glideto': case 'motion_glidesecstoxy': {
        if(st) return;
        const secs = N(b,'SECS',th);
        let p;
        if(b.op === 'motion_glideto'){ p = pointOf(A(b,'TO',th)); if(!p) return; }
        else p = [N(b,'X',th), N(b,'Y',th)];
        const sx = s.x, sy = s.y, t0 = now(), dur = secs * 1000;
        if(dur <= 0){ moveTo(s, p[0], p[1]); return; }
        rt.redraw = true;
        yield;
        for(;;){
          const k = (now() - t0) / dur;
          if(k >= 1){ moveTo(s, p[0], p[1]); return; }
          moveTo(s, sx + (p[0] - sx) * k, sy + (p[1] - sy) * k);
          yield;
        }
      }
      case 'motion_pointindirection': if(!st) setDir(s, N(b,'DIRECTION',th)); return;
      case 'motion_pointtowards': {
        if(st) return;
        const v = A(b,'TOWARDS',th);
        if(v === '_random_'){ setDir(s, Math.round(Math.random() * 360) - 180); return; }
        const p = pointOf(v); if(!p) return;
        const dx = p[0] - s.x, dy = p[1] - s.y;
        if(dx || dy) setDir(s, 90 - Math.atan2(dy, dx) * 180 / Math.PI);
        return;
      }
      case 'motion_changexby': if(!st) moveTo(s, s.x + N(b,'DX',th), s.y); return;
      case 'motion_setx': if(!st) moveTo(s, N(b,'X',th), s.y); return;
      case 'motion_changeyby': if(!st) moveTo(s, s.x, s.y + N(b,'DY',th)); return;
      case 'motion_sety': if(!st) moveTo(s, s.x, N(b,'Y',th)); return;
      case 'motion_ifonedgebounce': if(!st) bounce(s); return;
      case 'motion_setrotationstyle': if(!st){ s.rotationStyle = b.args.STYLE; rt.redraw = true; rt.dirty = true; } return;

      /* looks */
      case 'looks_say': case 'looks_think': if(!st) say(s, b.op === 'looks_say' ? 'say' : 'think', A(b,'MESSAGE',th)); return;
      case 'looks_sayforsecs': case 'looks_thinkforsecs': {
        if(st) return;
        const id = say(s, b.op === 'looks_sayforsecs' ? 'say' : 'think', A(b,'MESSAGE',th));
        yield* sleep(th, N(b,'SECS',th) * 1000);
        if(s._bubble && s._bubble.id === id){ s._bubble = null; rt.redraw = true; rt.dirty = true; }
        return;
      }
      case 'looks_switchcostumeto': if(!st) setCostume(s, A(b,'COSTUME',th)); return;
      case 'looks_nextcostume': if(!st) setCostume(s, s.currentCostume + 2); return;
      case 'looks_switchbackdropto': setBackdrop(A(b,'BACKDROP',th)); return;
      case 'looks_switchbackdroptoandwait': {
        const started = setBackdrop(A(b,'BACKDROP',th));
        yield;
        yield* waitFor(th, () => started.every(t => t.done));
        return;
      }
      case 'looks_nextbackdrop': setBackdrop(rt.stage.currentCostume + 2); return;
      case 'looks_changesizeby': if(!st) setSize(s, s.size + N(b,'CHANGE',th)); return;
      case 'looks_setsizeto': if(!st) setSize(s, N(b,'SIZE',th)); return;
      case 'looks_changeeffectby': setEffect(s, b.args.EFFECT, (s._fx[b.args.EFFECT] || 0) + N(b,'CHANGE',th)); return;
      case 'looks_seteffectto': setEffect(s, b.args.EFFECT, N(b,'VALUE',th)); return;
      case 'looks_flipx': if(!st){ s.flipX = !s.flipX; rt.redraw = true; rt.dirty = true; } return;
      case 'looks_flipy': if(!st){ s.flipY = !s.flipY; rt.redraw = true; rt.dirty = true; } return;
      case 'looks_cleargraphiceffects': s._fx = {}; rt.redraw = true; rt.dirty = true; return;
      case 'looks_show': if(!st){ s.visible = true; rt.redraw = true; rt.dirty = true; } return;
      case 'looks_hide': if(!st){ s.visible = false; rt.redraw = true; rt.dirty = true; } return;
      case 'looks_gotofrontback': if(!st) layerTo(s, b.args.FRONT_BACK === 'back' ? 0 : rt.layers.length); return;
      case 'looks_goforwardbackwardlayers': if(!st){ const n = Math.round(N(b,'NUM',th)); layerTo(s, rt.layers.indexOf(s) + (b.args.FORWARD_BACKWARD === 'backward' ? -n : n)); } return;

      /* sound */
      case 'sound_play': { const snd = soundFor(s, A(b,'SOUND_MENU',th)); if(snd) playSound(s, snd); return; }
      case 'sound_playuntildone': {
        const snd = soundFor(s, A(b,'SOUND_MENU',th)); if(!snd) return;
        const h = playSound(s, snd);
        yield* waitFor(th, () => h.done);
        return;
      }
      case 'sound_stopallsounds': all().forEach(stopSounds); return;
      case 'sound_changeeffectby': case 'sound_seteffectto': {
        const k = b.args.EFFECT === 'pan' ? 'pan' : 'pitch', v = N(b,'VALUE',th);
        let x = b.op === 'sound_changeeffectby' ? (s._sfx[k] || 0) + v : v;
        x = k === 'pan' ? Math.max(-100, Math.min(100, x)) : Math.max(-360, Math.min(360, x));
        s._sfx[k] = x; updateVolume(s); return;
      }
      case 'sound_cleareffects': s._sfx = { pitch:0, pan:0 }; updateVolume(s); return;
      case 'sound_changevolumeby': s.volume = Math.max(0, Math.min(100, s.volume + N(b,'VOLUME',th))); updateVolume(s); return;
      case 'sound_setvolumeto': s.volume = Math.max(0, Math.min(100, N(b,'VOLUME',th))); updateVolume(s); return;

      /* events */
      case 'event_broadcast': broadcast(S(b,'BROADCAST_INPUT',th)); return;
      case 'event_broadcastandwait': {
        const started = broadcast(S(b,'BROADCAST_INPUT',th));
        yield;
        yield* waitFor(th, () => started.every(t => t.done));
        return;
      }

      /* control */
      case 'control_wait': yield* sleep(th, Math.max(0, N(b,'DURATION',th)) * 1000); return;
      case 'control_repeat': {
        const n = Math.round(N(b,'TIMES',th));
        for(let i = 0; i < n; i++){ yield* runList(b.body, th); yield* tick(th); }
        return;
      }
      case 'control_forever': for(;;){ yield* runList(b.body, th); yield* tick(th); }
      case 'control_if': if(Bo(b,'CONDITION',th)) yield* runList(b.body, th); return;
      case 'control_if_else': if(Bo(b,'CONDITION',th)) yield* runList(b.body, th); else yield* runList(b.body2, th); return;
      case 'control_wait_until': while(!Bo(b,'CONDITION',th)){ th.sleeping = true; yield; } return;
      case 'control_repeat_until': while(!Bo(b,'CONDITION',th)){ yield* runList(b.body, th); yield* tick(th); } return;
      case 'control_stop': {
        const w = b.args.STOP_OPTION;
        if(w === 'all') throw STOP_ALL;
        if(w === 'this script') throw STOP_SCRIPT;
        rt.threads.forEach(t => { if(t.target === s && t !== th) t.done = true; });
        return;
      }
      case 'control_create_clone_of': {
        const v = A(b,'CLONE_OPTION',th);
        const src = v === '_myself_' ? s : spriteNamed(toStr(v));
        if(src) makeClone(src);
        return;
      }
      case 'control_delete_this_clone': if(s.isClone){ removeClone(s); throw STOP_SCRIPT; } return;

      /* sensing */
      case 'sensing_askandwait': {
        const q = { target:s, question:S(b,'QUESTION',th), done:false };
        rt.askQueue.push(q);
        nextAsk();
        yield* waitFor(th, () => q.done);
        return;
      }
      case 'sensing_setdragmode': if(!st) s.draggable = b.args.DRAG_MODE === 'draggable'; return;
      case 'sensing_resettimer': rt.timerStart = now(); return;

      /* variables */
      case 'data_setvariableto': { const v = varOf(s, b.args.VARIABLE); v.value = A(b,'VALUE',th); return; }
      case 'data_changevariableby': { const v = varOf(s, b.args.VARIABLE); v.value = toNum(v.value) + N(b,'VALUE',th); return; }
      case 'data_showvariable': case 'data_hidevariable': showMonitor('var', s, b.args.VARIABLE, b.op === 'data_showvariable'); return;
      case 'data_showlist': case 'data_hidelist': showMonitor('list', s, b.args.LIST, b.op === 'data_showlist'); return;
      case 'data_addtolist': { const l = listOf(s, b.args.LIST); if(l.value.length < 200000) l.value.push(A(b,'ITEM',th)); return; }
      case 'data_deleteoflist': {
        const l = listOf(s, b.args.LIST), i = index(A(b,'INDEX',th), l.value.length, true);
        if(i === 'all') l.value.length = 0; else if(i) l.value.splice(i - 1, 1);
        return;
      }
      case 'data_deletealloflist': listOf(s, b.args.LIST).value.length = 0; return;
      case 'data_insertatlist': {
        const l = listOf(s, b.args.LIST), i = index(A(b,'INDEX',th), l.value.length + 1);
        if(i && l.value.length < 200000) l.value.splice(i - 1, 0, A(b,'ITEM',th));
        return;
      }
      case 'data_replaceitemoflist': {
        const l = listOf(s, b.args.LIST), i = index(A(b,'INDEX',th), l.value.length);
        if(i) l.value[i - 1] = A(b,'ITEM',th);
        return;
      }

      /* my blocks */
      case 'procedures_call': {
        const owner = original(s);
        const found = PROJECT.procs(owner)[b.proc && b.proc.code];
        if(!found) return;
        const def = found.def, names = def.proc.names || [];
        const frame = {};
        const kinds = (def.proc.code.match(/%[sb]/g) || []);
        kinds.forEach((k, i) => {
          frame[names[i]] = k === '%b' ? (b.inputs && b.inputs['A' + i] ? toBool(evaluate(b.inputs['A' + i], th)) : false)
                                       : A(b, 'A' + i, th);
        });
        th.frames.push(frame);
        const warp = !!def.proc.warp;
        if(warp){ if(!th.warp) th.warpStart = now(); th.warp++; }
        try { yield* runList(found.script.blocks.slice(1), th); }
        catch(e){ if(e !== STOP_SCRIPT) throw e; }
        finally { th.frames.pop(); if(warp) th.warp--; }
        return;
      }

      /* pen */
      case 'pen_clear': RENDER.penClear(); rt.redraw = true; rt.dirty = true; return;
      case 'pen_stamp': if(!st){ RENDER.stamp(s); rt.redraw = true; rt.dirty = true; } return;
      case 'pen_penDown': if(!st){ s._pen.down = true; RENDER.penLine(s.x, s.y, s.x, s.y, penCSS(s._pen), s._pen.size); rt.redraw = true; rt.dirty = true; } return;
      case 'pen_penUp': if(!st) s._pen.down = false; return;
      case 'pen_setPenColorToColor': if(!st){ const v = A(b,'COLOR',th); setPenColor(s._pen, toRGB(v)); if(typeof v !== 'string' || !v.startsWith('#')){ const n = toNum(v); if(n > 0xffffff) s._pen.a = 100 - ((n >>> 24) & 255) / 2.55; } } return;
      case 'pen_changePenColorParamBy': if(!st) penParam(s._pen, b.args.COLOR_PARAM, N(b,'VALUE',th), true); return;
      case 'pen_setPenColorParamTo': if(!st) penParam(s._pen, b.args.COLOR_PARAM, N(b,'VALUE',th), false); return;
      case 'pen_changePenSizeBy': if(!st) s._pen.size = Math.max(1, Math.min(1200, s._pen.size + N(b,'SIZE',th))); return;
      case 'pen_setPenSizeTo': if(!st) s._pen.size = Math.max(1, Math.min(1200, N(b,'SIZE',th))); return;

      /* music */
      case 'music_playDrumForBeats': {
        const beats = Math.max(0, Math.min(100, N(b,'BEATS',th)));
        if(window.MUSIC) MUSIC.drum(Math.round(N(b,'DRUM',th)), s.volume / 100);
        yield* sleep(th, beats * 60000 / rt.stage.tempo);
        return;
      }
      case 'music_restForBeats': yield* sleep(th, Math.max(0, Math.min(100, N(b,'BEATS',th))) * 60000 / rt.stage.tempo); return;
      case 'music_playNoteForBeats': {
        const beats = Math.max(0, Math.min(100, N(b,'BEATS',th))), secs = beats * 60 / rt.stage.tempo;
        if(window.MUSIC && secs > 0) MUSIC.note(Math.max(0, Math.min(130, N(b,'NOTE',th))), secs, s._inst || 1, s.volume / 100);
        yield* sleep(th, secs * 1000);
        return;
      }
      case 'music_setInstrument': s._inst = Math.max(1, Math.min(21, Math.round(N(b,'INSTRUMENT',th)))); return;
      case 'music_setTempo': rt.stage.tempo = Math.max(20, Math.min(500, N(b,'TEMPO',th))); return;
      case 'music_changeTempo': rt.stage.tempo = Math.max(20, Math.min(500, rt.stage.tempo + N(b,'TEMPO',th))); return;

      /* text to speech */
      case 'text2speech_speakAndWait': {
        const text = S(b,'WORDS',th).slice(0, 128);
        if(!window.speechSynthesis || !text) return;
        const u = new SpeechSynthesisUtterance(text);
        const v = rt.tts || { voice:'ALTO', lang:'en' };
        u.lang = v.lang;
        const voice = speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(v.lang));
        if(voice) u.voice = voice;
        u.pitch = { ALTO:1, TENOR:0.7, SQUEAK:2, GIANT:0.1, KITTEN:1.8 }[v.voice] || 1;
        u.rate = v.voice === 'GIANT' ? 0.7 : v.voice === 'KITTEN' ? 1.3 : 1;
        let done = false;
        u.onend = u.onerror = () => { done = true; };
        speechSynthesis.speak(u);
        const t0 = now();
        yield* waitFor(th, () => done || now() - t0 > 20000);
        return;
      }
      case 'text2speech_setVoice': rt.tts = { ...(rt.tts || { lang:'en' }), voice:b.args.VOICE }; return;
      case 'text2speech_setLanguage': rt.tts = { ...(rt.tts || { voice:'ALTO' }), lang:b.args.LANGUAGE }; return;
    }
    // a reporter dropped as a stack block does nothing, like Scratch
  }

  function broadcast(name){
    const n = toStr(name).toLowerCase();
    return startHats('event_whenbroadcastreceived', h => toStr(h.args.BROADCAST_OPTION).toLowerCase() === n);
  }

  /* ------------------------------------------------------------- asking */
  function nextAsk(){
    if(rt.asking || !rt.askQueue.length) return;
    rt.asking = rt.askQueue.shift();
    const q = rt.asking;
    if(!q.target.isStage && q.target.visible) say(q.target, 'say', q.question);
    rt.onAsk && rt.onAsk(q.target.isStage || !q.target.visible ? q.question : '', ans => {
      rt.answer = ans;
      if(!q.target.isStage && q.target._bubble && q.target._bubble.text === q.question) say(q.target, 'say', '');
      q.done = true; rt.asking = null; nextAsk();
    });
  }

  /* ---------------------------------------------------------- monitors */
  function showMonitor(kind, s, name, visible){
    const P = rt.project;
    const local = !s.isStage && (kind === 'var' ? s.vars : s.lists) && Object.prototype.hasOwnProperty.call(kind === 'var' ? s.vars : s.lists, name);
    const owner = local ? original(s).id : 'stage';
    let m = P.monitors.find(x => x.kind === kind && x.name === name && x.target === owner);
    if(!m){ m = { id:PROJECT.uid(), kind, name, target:owner, visible, x:5, y:5 + P.monitors.length * 28 % 300 }; P.monitors.push(m); }
    m.visible = visible;
    rt.onChange && rt.onChange('monitors');
  }
  function monitorValue(m){
    const tg = m.target === 'stage' ? rt.stage : rt.sprites.find(s => s.id === m.target);
    if(!tg) return '';
    if(m.kind === 'var') return (m.target === 'stage' ? rt.stage.vars : tg.vars)[m.name];
    if(m.kind === 'list') return (m.target === 'stage' ? rt.stage.lists : tg.lists)[m.name];
    if(m.kind === 'op') return evaluate({ op:m.op, args:m.args || {}, inputs:{} }, null, tg);
    return '';
  }

  /* ------------------------------------------------------------ control */
  function greenFlag(){
    stopAll();
    rt.timerStart = now();
    startHats('event_whenflagclicked');
    rt.dirty = true;
  }
  function stopAll(){
    rt.threads.forEach(t => t.done = true);
    rt.threads = [];
    for(const c of rt.layers.filter(s => s.isClone)) removeClone(c);
    rt.layers = rt.layers.filter(s => !s.isClone);
    rt.cloneCount = 0;
    for(const tg of all()){ stopSounds(tg); tg._fx = {}; tg._bubble = null; tg._sfx = { pitch:0, pan:0 }; }
    if(window.speechSynthesis) speechSynthesis.cancel();
    if(rt.asking){ rt.asking.done = true; rt.asking = null; rt.onAsk && rt.onAsk(null); }
    rt.askQueue.forEach(q => q.done = true); rt.askQueue = [];
    rt.dirty = true;
  }
  const running = () => rt.threads.some(t => !t.done);
  function isRunning(script){ return rt.threads.some(t => !t.done && t.script === script); }

  /* clicking a script in the editor runs it (or stops it if it is running) */
  function toggleScript(target, script){
    const going = rt.threads.filter(t => !t.done && t.script === script && original(t.target) === target);
    if(going.length){ going.forEach(stopThread); return null; }
    const first = script.blocks[0];
    if(first && BLOCKS.isReporter((BLOCKS.of(first.op) || {}).shape)) return { value: evaluateSafe(first, target) };
    startThread(target, script, script.blocks);
    return null;
  }
  function evaluateSafe(b, target){
    try { return evaluate(b, { target, frames:[] }, target); } catch(e){ return ''; }
  }
  /* run a single palette block on a target */
  function runOnce(target, block){
    const shape = (BLOCKS.of(block.op) || {}).shape;
    if(BLOCKS.isReporter(shape)) return { value: evaluateSafe(block, target) };
    if(shape === 'hat') return null;
    startThread(target, { id:'palette' }, [block]);
    return null;
  }

  /* -------------------------------------------------------- frame loop */
  let last = 0, acc = 0, raf = 0;
  function loop(t){
    raf = requestAnimationFrame(loop);
    if(!rt.project) return;
    const dt = Math.min(250, t - (last || t)); last = t;
    acc += dt;
    const frame = 1000 / FPS;
    if(acc >= frame - 1){
      acc = Math.min(acc - frame, frame);
      if(acc < 0) acc = 0;
      if(rt.threads.length) step();
      else checkEdgesOnly();
    }
    if(rt.dirty){ rt.dirty = false; RENDER.draw(rt); rt.onFrame && rt.onFrame(); }
    else if(rt.onTick) rt.onTick();
  }
  function checkEdgesOnly(){
    // hats that start on their own (timer > n) need checking even when nothing runs
    for(const tg of all()) for(const s of tg.scripts) if(s.blocks[0] && s.blocks[0].op === 'event_whengreaterthan'){ step(); return; }
  }
  function startLoop(){ if(!raf) raf = requestAnimationFrame(loop); }

  return {
    rt, load, syncLayers, greenFlag, stopAll, step, startHats, startThread, toggleScript, runOnce, isRunning, running,
    pressKey, releaseKey, keyName, broadcast, monitorValue, showMonitor, makeClone, setCostume, setBackdrop, setSize,
    moveTo, setDir, fresh, startLoop, evaluate, toNum, toStr, toBool, compare, listText, original
  };
})();
