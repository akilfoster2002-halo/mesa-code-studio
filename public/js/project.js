/* =====================================================================
   PROJECT — what a project is, as plain JSON.

   { v:1, targets:[stage, ...sprites], monitors:[...], extensions:[...] }

   A target (the stage or a sprite) holds its costumes, sounds, scripts,
   variables and lists, plus — for a sprite — where it is. Variables and
   lists are keyed by name: { score: 0 }, { names: ['a','b'] }. The
   stage's are the global ones ("for all sprites").

   A script is { id, x, y, blocks:[block, ...] }, and a block is
     { id, op, args:{ NAME: value }, inputs:{ NAME: block },
       body:[...], body2:[...], proc:{...} }
   `args` keeps the typed value of every slot even when a reporter has
   been dropped over it (inputs), so pulling the reporter out gives the
   old number back, the way Scratch does.

   Keys starting with "_" are runtime-only and never saved.
   ===================================================================== */
window.PROJECT = (function(){
  let n = 0;
  const uid = () => Date.now().toString(36).slice(-5) + (n++).toString(36) + Math.random().toString(36).slice(2, 6);

  function costumeFromLib(key){
    const pic = LIBRARY.pics[key];
    const [w, h] = LIBRARY.picSize(key);
    return { id:uid(), name:pic.name, asset:'lib:' + key, w, h, cx:w/2, cy:h/2, res:1 };
  }
  function soundFromLib(key){
    return { id:uid(), name:LIBRARY.sounds[key].name, asset:'lib:' + key, type:'synth' };
  }
  function stage(){
    return { id:'stage', name:'Stage', isStage:true, costumes:[costumeFromLib('bd-white')], currentCostume:0,
      sounds:[soundFromLib('pop')], scripts:[], vars:{ 'my variable':0 }, lists:{}, volume:100, tempo:60,
      messages:['message1'] };
  }
  function sprite(name, costumes, extra){
    return { id:uid(), name, isStage:false, x:0, y:0, direction:90, size:100, visible:true,
      rotationStyle:'all around', draggable:false, layer:1,
      costumes, currentCostume:0, sounds:[soundFromLib('pop')], scripts:[], vars:{}, lists:{}, volume:100, ...(extra||{}) };
  }
  function blank(){
    return { v:1, targets:[stage(), sprite('Bit', [costumeFromLib('bit-a'), costumeFromLib('bit-b')])],
      monitors:[], extensions:[] };
  }

  /* make a block from the table with its default slot values */
  function block(op, over){
    const spec = BLOCKS.of(op);
    const b = { id:uid(), op, args:{}, inputs:{} };
    if(spec){
      for(const [k, a] of Object.entries(spec.args)) if(a.t !== 'bool') b.args[k] = a.d != null ? a.d : '';
      if(BLOCKS.isC(spec.shape)) b.body = [];
      if(spec.shape === 'c2') b.body2 = [];
    }
    return Object.assign(b, over || {});
  }

  /* deep copy with fresh ids (duplicate, paste, clone palette blocks) */
  function copy(x){
    const c = JSON.parse(JSON.stringify(x, skipRuntime));
    (function walk(o){
      if(Array.isArray(o)) return o.forEach(walk);
      if(o && typeof o === 'object'){
        if(o.op) o.id = uid();
        Object.values(o).forEach(walk);
      }
    })(c);
    return c;
  }
  function skipRuntime(k, v){ return k && k[0] === '_' ? undefined : v; }
  const serialize = p => JSON.parse(JSON.stringify(p, skipRuntime));

  /* every block in a list of blocks, depth first, with a callback */
  function walk(list, fn){
    for(const b of list || []){
      if(!b) continue;
      fn(b);
      for(const k in b.inputs || {}) if(b.inputs[k]) walk([b.inputs[k]], fn);
      if(b.body) walk(b.body, fn);
      if(b.body2) walk(b.body2, fn);
    }
  }
  function walkTarget(tg, fn){ for(const s of tg.scripts) walk(s.blocks, fn); }

  /* the procedures (My Blocks) a target defines: code -> definition */
  function procs(tg){
    const out = {};
    for(const s of tg.scripts){
      const d = s.blocks[0];
      if(d && d.op === 'procedures_definition' && d.proc) out[d.proc.code] = { def:d, script:s };
    }
    return out;
  }
  /* "jump %s high %b" + ['height','ok'] -> parts for drawing */
  function procParts(proc, names){
    const out = []; let i = 0;
    for(const w of String(proc.code).split(/(%[sb])/)){
      if(!w) continue;
      if(w === '%s' || w === '%b'){ out.push({ arg:'A' + i, kind:w[1], name:(names || proc.names || [])[i] || '' }); i++; }
      else if(w.trim()) out.push(w.trim());
    }
    return out;
  }

  /* make sure an old or hand-edited project has every field it needs */
  function repair(p){
    if(!p || !Array.isArray(p.targets) || !p.targets.length) return blank();
    if(!p.targets[0].isStage) p.targets.unshift(stage());
    p.monitors = Array.isArray(p.monitors) ? p.monitors : [];
    p.extensions = Array.isArray(p.extensions) ? p.extensions : [];
    p.targets.forEach((tg, i) => {
      tg.id = tg.id || uid();
      tg.costumes = (tg.costumes || []).filter(c => c && c.asset);
      if(!tg.costumes.length) tg.costumes = [costumeFromLib(tg.isStage ? 'bd-white' : 'ball')];
      tg.currentCostume = Math.max(0, Math.min(tg.costumes.length - 1, tg.currentCostume | 0));
      tg.sounds = tg.sounds || []; tg.scripts = tg.scripts || []; tg.vars = tg.vars || {}; tg.lists = tg.lists || {};
      tg.volume = tg.volume == null ? 100 : tg.volume;
      if(tg.isStage){ tg.messages = tg.messages || ['message1']; tg.tempo = tg.tempo || 60; }
      else {
        ['x','y'].forEach(k => tg[k] = +tg[k] || 0);
        tg.direction = tg.direction == null ? 90 : +tg.direction;
        tg.size = tg.size == null ? 100 : +tg.size;
        tg.visible = tg.visible !== false;
        tg.rotationStyle = tg.rotationStyle || 'all around';
        tg.layer = tg.layer || i;
      }
      tg.scripts.forEach(s => { s.id = s.id || uid(); s.x = +s.x || 0; s.y = +s.y || 0; s.blocks = (s.blocks || []).filter(Boolean); });
      tg.scripts = tg.scripts.filter(s => s.blocks.length);
    });
    return p;
  }

  /* every asset a project uses (to preload pictures) */
  function assets(p){
    const out = new Set();
    p.targets.forEach(tg => tg.costumes.forEach(c => out.add(c.asset)));
    return [...out];
  }

  return { uid, blank, stage, sprite, block, copy, serialize, walk, walkTarget, procs, procParts, repair, assets,
           costumeFromLib, soundFromLib };
})();
