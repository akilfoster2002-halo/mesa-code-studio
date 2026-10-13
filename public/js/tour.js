/* =====================================================================
   TOUR — the walkthrough every student gets the first time they log in.

   About ten minutes. A spotlight on one part of the screen at a time,
   one short line (English and Spanish) and a big icon. Most steps are
   "your turn": the student actually does the thing — makes a project,
   drags blocks, runs it, changes a number, opens Costumes and Sounds,
   renames the project — and the tour moves on by itself when it is done.
   "Skip tour" is on every step. ❓ starts it again any time.

   Where a student is in the tour is kept on the server (cs_users.tutorial):
   a step number while it runs, then "done" or "skipped", so it starts on
   its own exactly once, on whatever computer they log in from.
   ===================================================================== */
window.TOUR = (function(){
  const { h, $ } = UI;
  let i = -1, timer = null, els = null, base = {}, onState = () => {};
  const L = (en, es) => I18N.lang === 'es' ? es : en;
  const inEditor = () => /^#\/p\//.test(location.hash) && !!$('.editor');
  const tgt = () => window.EDITOR && EDITOR.target;
  const flagScript = () => tgt() && tgt().scripts.find(s => s.blocks[0] && s.blocks[0].op === 'event_whenflagclicked');
  const has = (list, op) => { let f = false; PROJECT.walk(list || [], b => { if(b.op === op) f = true; }); return f; };
  const catOn = c => !!$('.cat.on[data-cat="' + c + '"]');
  const tabOn = k => !!$('.tab.on[data-tab="' + k + '"]');

  /* each step: where it happens, what to light up, what to say, and (for
     "your turn" steps) how to tell it has been done */
  const STEPS = [
    { page:'home', icon:'👋', text:['Welcome to Code Studio! This tour takes about 10 minutes.', '¡Bienvenido a Code Studio! Este recorrido dura unos 10 minutos.'] },
    { page:'home', icon:'🗂', at:'.pmain', text:['This is My Projects. Everything you make is kept here.', 'Esto es Mis proyectos. Aquí se guarda todo lo que haces.'] },
    { page:'home', icon:'＋', at:'.pcard.new', text:['Click New project, give it a name, then OK.', 'Haz clic en Proyecto nuevo, ponle nombre y Aceptar.'],
      done:() => inEditor() },
    { page:'editor', icon:'🎭', at:'.stage-wrap', text:['This is the stage. Your game happens here.', 'Este es el escenario. Aquí pasa tu juego.'] },
    { page:'editor', icon:'🤖', at:'.sprite-pane', text:['These are your sprites. Bit is your first one.', 'Estos son tus objetos. Bit es el primero.'] },
    { page:'editor', icon:'🎨', at:'#cats', text:['Blocks are sorted by colour. Click Events.', 'Los bloques están por colores. Haz clic en Eventos.'],
      done:() => catOn('events') },
    { page:'editor', icon:'⚑', at:'#ph-events', text:['Drag “when ⚑ clicked” into the dark code area.', 'Arrastra “when ⚑ clicked” al área oscura de código.'],
      done:() => !!flagScript() },
    { page:'editor', icon:'🏃', at:'.cat[data-cat="motion"]', text:['Click Motion. Drag “move 10 steps” right under it.', 'Haz clic en Movimiento. Arrastra “move 10 steps” justo debajo.'],
      done:() => { const s = flagScript(); return !!s && has(s.blocks, 'motion_movesteps'); } },
    { page:'editor', icon:'🔁', at:'.cat[data-cat="control"]', text:['Click Control. Drag “forever” in between them. Watch the yellow line!', 'Haz clic en Control. Arrastra “forever” entre los dos. ¡Mira la línea amarilla!'],
      done:() => { const s = flagScript(); return !!s && s.blocks.some(b => b.op === 'control_forever' && has(b.body, 'motion_movesteps')); } },
    { page:'editor', icon:'↩️', at:'.cat[data-cat="motion"]', text:['Back in Motion: put “if on edge, bounce” inside the forever.', 'En Movimiento: pon “if on edge, bounce” dentro del forever.'],
      done:() => { const s = flagScript(); return !!s && s.blocks.some(b => b.op === 'control_forever' && has(b.body, 'motion_ifonedgebounce')); } },
    { page:'editor', icon:'📏', at:'#ws', text:['See how the blocks inside forever are indented? That means “inside the loop”.', '¿Ves que los bloques dentro de forever están corridos? Eso es “dentro del bucle”.'] },
    { page:'editor', icon:'▶️', at:'.flag', text:['Click the green flag to run it!', '¡Haz clic en la bandera verde para correrlo!'],
      done:() => VM.running() },
    { page:'editor', icon:'⏹', at:'.stopb', text:['Now click stop.', 'Ahora haz clic en parar.'], wait:1500,
      done:() => !VM.running() },
    { page:'editor', icon:'🔢', at:'.wsc .b[data-op="motion_movesteps"] .f', text:['Click the 10 and type 3. Then Enter.', 'Haz clic en el 10 y escribe 3. Luego Enter.'],
      done:() => { let ok = false; const s = flagScript(); s && PROJECT.walk(s.blocks, b => { if(b.op === 'motion_movesteps' && String(b.args.STEPS) !== '10') ok = true; }); return ok; } },
    { page:'editor', icon:'▶️', at:'.flag', text:['Run it again. Slower!', 'Córrelo otra vez. ¡Más lento!'], done:() => VM.running() },
    { page:'editor', icon:'✕', at:'#ws', text:['Hover a line and click ✕ to delete just that block. Right-click for more.', 'Pasa el ratón por una línea y haz clic en ✕ para borrar ese bloque. Clic derecho para más.'] },
    { page:'editor', icon:'🗑', at:'#pal', text:['Drag a block back here to throw it away.', 'Arrastra un bloque aquí para tirarlo.'] },
    { page:'editor', icon:'🖌', at:'.tab[data-tab="costumes"]', text:['Click Costumes.', 'Haz clic en Disfraces.'], done:() => tabOn('costumes') },
    { page:'editor', icon:'🖼', at:'#costumes .add-stack', text:['Upload your own pictures here. PNG with a see-through background is best.', 'Sube tus imágenes aquí. Lo mejor es PNG con fondo transparente.'] },
    { page:'editor', icon:'🪄', at:'#costumes .asset-head', text:['Picture has a white box around it? Remove background fixes it.', '¿La imagen tiene un cuadro blanco? Quitar fondo lo arregla.'] },
    { page:'editor', icon:'🔊', at:'.tab[data-tab="sounds"]', text:['Click Sounds.', 'Haz clic en Sonidos.'], done:() => tabOn('sounds') },
    { page:'editor', icon:'🎙', at:'#sounds .add-stack', text:['Upload a sound, record your voice, or pick one from the Library.', 'Sube un sonido, graba tu voz o elige uno de la Biblioteca.'] },
    { page:'editor', icon:'⧉', at:'.tab[data-tab="code"]', text:['Click Code to go back to your blocks.', 'Haz clic en Código para volver a tus bloques.'], done:() => tabOn('code') },
    { page:'editor', icon:'🐱', at:'.sprite-list .add-row', text:['Click Choose a Sprite and pick one.', 'Haz clic en Elegir un objeto y elige uno.'],
      enter:() => { base.sprites = VM.rt.project ? VM.rt.project.targets.length : 0; },
      done:() => VM.rt.project && VM.rt.project.targets.length > base.sprites },
    { page:'editor', icon:'👆', at:'.sprite-list .tiles', text:['Click a sprite to see ITS code. Each sprite has its own.', 'Haz clic en un objeto para ver SU código. Cada uno tiene el suyo.'] },
    { page:'editor', icon:'🏞', at:'.stage-col', text:['The Stage has backdrops and its own code too.', 'El escenario tiene fondos y su propio código.'] },
    { page:'editor', icon:'📦', at:'.cat[data-cat="variables"]', text:['Variables keep a score or a count. Make a Variable is in here.', 'Las variables guardan puntos o cuentas. Crear una variable está aquí.'] },
    { page:'editor', icon:'✏️', at:'.title-in', text:['Click the name and give your project a better one. Then Enter.', 'Haz clic en el nombre y ponle uno mejor. Luego Enter.'],
      enter:() => { base.name = ($('.title-in') || {}).value; },
      done:() => { const v = ($('.title-in') || {}).value; return v && v !== base.name && document.activeElement !== $('.title-in'); } },
    { page:'editor', icon:'💾', at:'.status', text:['Your work saves by itself. Look for “✓ Saved”.', 'Tu trabajo se guarda solo. Busca “✓ Guardado”.'] },
    { page:'editor', icon:'🕘', at:'.hist-btn', text:['Made a mistake? History takes you back to an earlier version.', '¿Te equivocaste? El Historial te lleva a una versión anterior.'] },
    { page:'editor', icon:'⤓', at:'.dl', text:['Download script makes a PDF of your code to hand in.', 'Descargar código hace un PDF de tu código para entregar.'] },
    { page:'editor', icon:'🗂', at:'.proj-btn', text:['My Projects ▾ switches between your projects. ＋ New starts another.', 'Mis proyectos ▾ cambia entre tus proyectos. ＋ Nuevo empieza otro.'] },
    { page:'editor', icon:'🚪', at:'.userbox', text:['When class ends: Log out!', 'Al terminar la clase: ¡Salir!'] },
    { page:'any', icon:'🎉', text:['You did it! Now build something amazing.', '¡Lo lograste! Ahora crea algo increíble.'], last:true }
  ];

  function start(from){
    i = -1; base = {};
    if(!els) build();
    els.root.classList.remove('hidden');
    go(from != null ? from : (inEditor() ? STEPS.findIndex(s => s.page === 'editor') : 0));
  }
  /* pick up where a student left off (after a reload) */
  function resume(n){ start(Math.max(0, Math.min(STEPS.length - 1, n | 0))); }
  function build(){
    const spot = h('div', { class:'tour-spot' });
    const card = h('div', { class:'tour-card', role:'dialog', 'aria-live':'polite' });
    els = { root:h('div', { class:'tour hidden' }, spot, card), spot, card };
    document.body.append(els.root);
    addEventListener('resize', place);
  }
  function go(n){
    i = n;
    const s = STEPS[i];
    if(!s){ finish('done'); return; }
    if(s.enter) s.enter();
    s._t0 = Date.now();
    draw();
    onState(String(i));
  }
  function draw(){
    const s = STEPS[i];
    const doing = !!s.done;
    els.card.replaceChildren(
      h('div', { class:'tour-top' }, h('span', { class:'tour-n' }, (i + 1) + ' / ' + STEPS.length),
        s.last ? null : h('button', { class:'tour-skip', type:'button', onclick:() => finish('skipped') }, L('Skip tour', 'Saltar recorrido'))),
      h('div', { class:'tour-body' }, h('span', { class:'tour-ico' }, s.icon), h('p', {}, L(s.text[0], s.text[1]))),
      h('div', { class:'tour-bar' }, h('i', { style:{ width:Math.round((i + 1) / STEPS.length * 100) + '%' } })),
      h('div', { class:'tour-row' },
        i > 0 && !s.last ? h('button', { class:'btn small', type:'button', onclick:() => go(i - 1) }, '←') : h('span'),
        doing ? h('span', { class:'tour-turn' }, '👉 ' + L('Your turn!', '¡Tu turno!')) : null,
        h('button', { class:'btn primary', type:'button', onclick:() => s.last ? finish('done') : go(i + 1) },
          s.last ? L('Finish', 'Terminar') : doing ? L('Skip step', 'Saltar paso') : L('Next', 'Siguiente'))));
    els.card.classList.toggle('doing', doing);
    place();
    clearInterval(timer);
    timer = setInterval(tick, 300);
  }
  function tick(){
    const s = STEPS[i]; if(!s) return;
    place();
    if(s.done && Date.now() - s._t0 > (s.wait || 300)){
      let ok = false; try { ok = s.done(); } catch(e){}
      if(ok){ els.card.classList.add('yay'); clearInterval(timer); setTimeout(() => { els.card.classList.remove('yay'); go(i + 1); }, 700); }
    }
  }
  /* light up the target and put the card beside it */
  function place(){
    const s = STEPS[i]; if(!s || !els) return;
    const wrongPage = (s.page === 'editor' && !inEditor()) || (s.page === 'home' && inEditor() && !s.done);
    const el = s.at && !wrongPage ? $(s.at) : null;
    const card = els.card, spot = els.spot;
    const cw = card.offsetWidth || 340, ch = card.offsetHeight || 160, M = 12;
    if(el && el.getClientRects().length){
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(spot.style, { display:'block', left:(r.left - pad) + 'px', top:(r.top - pad) + 'px', width:(r.width + pad*2) + 'px', height:(r.height + pad*2) + 'px' });
      els.root.classList.remove('nospot');
      // right, below, left, above — whichever fits first
      const opts = [[r.right + M, r.top], [r.left, r.bottom + M], [r.left - cw - M, r.top], [r.left, r.top - ch - M]];
      let [x, y] = opts.find(([x, y]) => x >= 4 && y >= 4 && x + cw <= innerWidth - 4 && y + ch <= innerHeight - 4) || [innerWidth - cw - 16, innerHeight - ch - 16];
      card.style.left = Math.max(4, Math.min(innerWidth - cw - 4, x)) + 'px';
      card.style.top = Math.max(4, Math.min(innerHeight - ch - 4, y)) + 'px';
    } else {
      spot.style.display = 'none';
      els.root.classList.add('nospot');
      card.style.left = (innerWidth - cw) / 2 + 'px';
      card.style.top = Math.max(20, (innerHeight - ch) / 2) + 'px';
    }
  }
  function finish(state){
    clearInterval(timer); i = -1;
    if(els) els.root.classList.add('hidden');
    if(state) onState(state);
  }
  return { start, resume, finish, get running(){ return i >= 0; }, set onState(f){ onState = f; }, STEPS };
})();
