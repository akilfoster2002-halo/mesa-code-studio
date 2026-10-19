/* =====================================================================
   HELPER — 💬 the Block Helper: a chat in the editor's lower-right corner
   (a round button that opens a chat window above it) that answers
   "how do I…?" questions with real Code Studio blocks.

   No AI and nothing leaves the school's server: answers are the recipes
   in recipes.js. The helper's job is to pick the right ones and make them
   about THIS student's game:
     • Before the first question, the student fills in "Tell me about your
       game" (required). It is kept with the project (project.about), so
       each game has its own, and the teacher's dashboard can read it.
     • Typed questions are matched to recipes by their words (English or
       Spanish, accents and typos in endings forgiven); features the game
       has count a little extra.
     • Recipes name sprites by their job ({player}, {enemy}…). The helper
       swaps in the student's own sprite names, asking once if it cannot
       tell which sprite does a job.
     • Each answer is a hint first; "Show me the blocks" draws them; then
       why it works. Students drag the blocks in themselves.

   Every question is sent to the server's log, so the dashboard can show
   which questions had no recipe yet (and which recipes left students stuck).
   ===================================================================== */
window.HELPER = (function(){
  const { h, $ } = UI;
  const L = (en, es) => I18N.lang === 'es' ? es : en;
  const T2 = p => Array.isArray(p) ? L(p[0], p[1] || p[0]) : p;
  let P = null, ro = false, projectId = null, getMe = () => null, onChange = () => {};
  let panel = null, main = null, chat = null, isOpen = false, button = null;

  function mount(opts){
    getMe = opts.me; onChange = opts.onChange || onChange;
    panel = h('aside', { class:'helper hidden', 'aria-label':'Block Helper' });
    button = h('button', { class:'hlaunch', type:'button', 'aria-expanded':'false', onclick:toggle },
      h('span', { class:'hl-open' }, '💬'), h('span', { class:'hl-close' }, '✕'));
    label();
    return [panel, button];
  }
  function load(project, opts){
    const same = projectId === opts.id && P === project;
    P = project; ro = !!opts.readOnly; projectId = opts.id;
    if(!same) chat = null;
    if(isOpen) render();
  }
  function toggle(){ isOpen ? close() : open(); }
  function open(){
    if(!panel) return;
    isOpen = true; panel.classList.remove('hidden'); button.classList.add('on'); label();
    if(P) render();          // still loading: load() draws it
  }
  function close(){ isOpen = false; panel && panel.classList.add('hidden'); button && button.classList.remove('on'); label(); }
  function label(){
    const s = isOpen ? L('Close the Block Helper', 'Cerrar el ayudante') : L('Block Helper — ask how to code something', 'Ayudante de bloques — pregunta cómo programar algo');
    button.title = s; button.setAttribute('aria-label', s); button.setAttribute('aria-expanded', String(isOpen));
  }

  const me = () => getMe() || {};
  const firstName = () => String(me().name || '').trim().split(/\s+/)[0] || '';
  const sprites = () => P.targets.filter(tg => !tg.isStage);
  const about = () => P && P.about && typeof P.about === 'object' ? P.about : null;
  const described = () => { const a = about(); return !!(a && a.story && a.has && a.has.length && a.next); };

  /* ---------------------------------------------------------- the panel */
  function render(){
    const head = h('div', { class:'hhead' },
      h('span', { class:'hlogo' }, '💬'), h('b', {}, L('Block Helper', 'Ayudante de bloques')), h('span', { class:'grow' }),
      described() && !ro ? h('button', { class:'btn small ghost', type:'button', title:L('Edit my game', 'Editar mi juego'), onclick:() => { chat = null; renderForm(); } }, '✏️ ' + L('My game', 'Mi juego')) : null,
      h('button', { class:'btn small ghost hx', type:'button', title:L('Close', 'Cerrar'), onclick:close }, '✕'));
    main = h('div', { class:'hmain' });
    panel.replaceChildren(head, main);
    if(!described()){
      if(ro) main.append(h('div', { class:'hnote' }, L('This game has no description yet. Its owner fills it in the first time they open the helper.', 'Este juego aún no tiene descripción. Su dueño la llena la primera vez que abre el ayudante.')));
      else renderForm();
    } else renderChat();
  }

  /* --------------------------------------- "Tell me about your game" */
  function renderForm(){
    const a = about() || {};
    const has = new Set(a.has || []), like = new Set(a.like || []);
    const story = h('textarea', { class:'inp', rows:2, maxlength:200, placeholder:L('e.g. A dino that jumps over cactuses and shoots aliens', 'ej. Un dino que salta cactus y dispara a aliens') });
    story.value = a.story || '';
    const next = h('textarea', { class:'inp', rows:2, maxlength:200, placeholder:L('e.g. I want my dino to duck under the birds', 'ej. Quiero que mi dino se agache bajo los pájaros') });
    next.value = a.next || '';
    const chips = (list, set, label) => h('div', { class:'hchips' }, list.map(([id, icon, en, es]) => {
      const b = h('button', { type:'button', class:'hchip' + (set.has(id) ? ' on' : ''), 'aria-pressed':String(set.has(id)) }, icon + ' ' + (label ? label(en, es) : L(en, es)));
      b.onclick = () => { set.has(id) ? set.delete(id) : set.add(id); b.classList.toggle('on', set.has(id)); b.setAttribute('aria-pressed', String(set.has(id))); };
      return b;
    }));
    const sp = sprites();
    const player = h('select', { class:'inp' },
      sp.map(s => h('option', { value:s.id }, s.name)),
      h('option', { value:'' }, L('I have not made it yet', 'Aún no lo he hecho')));
    player.value = a.player && sp.some(s => s.id === a.player) ? a.player : (guessSprite('player') || (sp[0] || {}).id || '');
    const msg = h('div', { class:'hmsg-err', role:'alert' });
    const q = (n, text, sub) => h('div', { class:'hq' }, h('div', { class:'hqn' }, h('span', { class:'hnum' }, n), h('b', {}, text)), sub ? h('small', {}, sub) : null);
    const form = h('form', { class:'hform' },
      h('p', { class:'hintro' }, (firstName() ? L('Hi ', '¡Hola, ') + firstName() + L('! ', '! ') : '') +
        L('Before I can help, tell me about your game. It takes about a minute.', 'Antes de ayudarte, cuéntame de tu juego. Toma como un minuto.')),
      q('1', L('What is your game about?', '¿De qué se trata tu juego?')), story,
      q('2', L('What is in your game?', '¿Qué hay en tu juego?'), L('Tick everything it has, or will have.', 'Marca todo lo que tiene o tendrá.')), chips(RECIPES.FEATURES, has),
      q('3', L('Which sprite is your player?', '¿Cuál objeto es tu jugador?')), player,
      q('4', L('Inspired by any of these? (optional)', '¿Inspirado en alguno de estos? (opcional)'), L('Pick as many as you like — most games mix a few.', 'Elige los que quieras — casi todos los juegos mezclan varios.')),
      chips(RECIPES.GAMES, like, (en, es) => es ? L(en, es) : en),
      q('5', L('What do you want to add next?', '¿Qué quieres agregar después?')), next,
      msg,
      h('button', { class:'btn primary', type:'submit' }, '✓ ' + L('Save and start', 'Guardar y empezar')));
    form.onsubmit = e => {
      e.preventDefault();
      const s = story.value.trim(), n = next.value.trim();
      if(s.length < 5){ msg.textContent = L('Tell me a little about your game (question 1).', 'Cuéntame un poco de tu juego (pregunta 1).'); story.focus(); return; }
      if(!has.size){ msg.textContent = L('Tick at least one thing your game has (question 2).', 'Marca al menos una cosa que tenga tu juego (pregunta 2).'); return; }
      if(n.length < 3){ msg.textContent = L('What do you want to add next? (question 5)', '¿Qué quieres agregar después? (pregunta 5)'); next.focus(); return; }
      const first = !described();
      P.about = { story:s, has:[...has], like:[...like], next:n, player:player.value || null, roles:(a.roles || {}), at:new Date().toISOString() };
      onChange();
      chat = null;
      render();
      if(first || n !== a.next) ask(n, { fromForm:true });
    };
    main.replaceChildren(form);
    if(!story.value) story.focus();
  }

  /* ---------------------------------------------------------------- chat */
  function renderChat(){
    if(!chat){
      chat = { log:h('div', { class:'hlog', 'aria-live':'polite' }) };
      const a = about();
      bot(h('div', {},
        h('p', {}, (firstName() ? L('Hi ', '¡Hola, ') + firstName() + '! ' : '') + L('I can help you build your game with blocks.', 'Te puedo ayudar a hacer tu juego con bloques.')),
        h('p', { class:'hgame' }, '🎮 ', h('i', {}, a.story)),
        h('p', {}, L('Ask me anything, like “how do I make my sprite jump?”, or tap a question:', 'Pregúntame lo que sea, como “¿cómo hago que mi objeto salte?”, o toca una pregunta:')),
        suggestions()));
    }
    const input = h('input', { class:'inp', maxlength:200, placeholder:L('Ask a question…', 'Haz una pregunta…'), 'aria-label':L('Ask a question', 'Haz una pregunta') });
    const form = h('form', { class:'hask' }, input, h('button', { class:'btn primary', type:'submit' }, L('Ask', 'Preguntar')));
    form.onsubmit = e => { e.preventDefault(); const v = input.value.trim(); if(!v) return; input.value = ''; ask(v); };
    main.replaceChildren(chat.log, form);
    scroll();
    input.focus();
  }
  function scroll(){ if(chat) requestAnimationFrame(() => chat.log.scrollTop = chat.log.scrollHeight); }
  function bot(content){ const m = h('div', { class:'hm bot' }, content); chat.log.append(m); scroll(); return m; }
  function said(text){ chat.log.append(h('div', { class:'hm me' }, text)); scroll(); }

  /* questions to tap: recipes for what the game has, then everything */
  function suggestions(){
    const a = about() || {};
    const has = a.has || [], like = a.like || [];
    const score = r => r.tags.filter(t => has.includes(t)).length * 2 + r.like.filter(g => like.includes(g)).length;
    const top = RECIPES.LIST.map(r => ({ r, s:score(r) })).filter(x => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 5).map(x => x.r);
    return h('div', { class:'hsugg' },
      top.map(r => h('button', { type:'button', class:'hq-btn', onclick:() => pick(r) }, fill(T2(r.ask)))),
      h('button', { type:'button', class:'hq-btn all', onclick:browse }, '📖 ' + L('See all recipes', 'Ver todas las recetas')));
  }
  function browse(){
    bot(h('div', {}, h('p', {}, L('Here is everything I know how to do:', 'Esto es todo lo que sé hacer:')),
      RECIPES.GROUPS.map(([g, icon, en, es]) => h('div', { class:'hgroup' }, h('b', {}, icon + ' ' + L(en, es)),
        h('div', { class:'hsugg' }, RECIPES.LIST.filter(r => r.group === g).map(r => h('button', { type:'button', class:'hq-btn', onclick:() => pick(r) }, T2(r.title))))))));
  }

  function ask(text, opts={}){
    if(!chat) renderChat();
    said(opts.fromForm ? L('I want to add: ', 'Quiero agregar: ') + text : text);
    if(!opts.fromForm && words(text).every(w => HELLO.has(w))){
      bot(h('div', {}, h('p', {}, L('Hi! 👋 Tell me what you want your game to do, like “make my player jump”.', '¡Hola! 👋 Dime qué quieres que haga tu juego, como “hacer que mi jugador salte”.')), suggestions()));
      return;
    }
    const found = match(text);
    if(!found.length){
      log(text, null, 'ask');
      bot(h('div', {},
        h('p', {}, opts.fromForm ? L('I don’t have a recipe for that yet. I saved it so your teacher can see it and help you!', 'Aún no tengo una receta para eso. ¡La guardé para que tu maestro la vea y te ayude!')
          : L('Hmm, I don’t know that one yet. Try different words, or ask your teacher — I saved your question so we can add it!', 'Mmm, eso aún no lo sé. Prueba otras palabras o pregúntale a tu maestro — ¡guardé tu pregunta para agregarla!')),
        suggestions()));
      return;
    }
    log(text, found[0].id, 'ask');
    if(opts.fromForm) bot(h('p', {}, L('Here is a recipe that should help:', 'Aquí hay una receta que te puede ayudar:')));
    answer(found[0]);
    if(found.length > 1) bot(h('div', {}, h('p', {}, L('Or did you mean:', 'O tal vez buscabas:')),
      h('div', { class:'hsugg' }, found.slice(1).map(r => h('button', { type:'button', class:'hq-btn', onclick:() => pick(r) }, T2(r.title))))));
  }
  function pick(r){
    said(fill(T2(r.ask)));
    log(T2(r.title), r.id, 'pick');
    answer(r);
  }

  /* --------------------------------------------------------- an answer */
  function answer(r){
    const more = h('div', { class:'hmore' });
    const btn = h('button', { class:'btn primary small', type:'button' }, '🧱 ' + L('Show me the blocks', 'Muéstrame los bloques'));
    btn.onclick = () => { btn.remove(); reveal(r, more); };
    bot(h('div', { class:'hrecipe' },
      h('div', { class:'htitle' }, '💡 ' + T2(r.title)),
      h('p', {}, h('b', {}, L('Hint: ', 'Pista: ')), T2(r.hint)),
      h('p', { class:'muted' }, L('Try it yourself first! Stuck?', '¡Inténtalo tú primero! ¿Atorado?')),
      btn, more));
  }
  function reveal(r, into){
    const need = rolesIn(r).find(role => resolve(role).ask);
    if(need){
      into.replaceChildren(askRole(need, () => reveal(r, into)));
      scroll(); return;
    }
    into.replaceChildren(...r.steps.map(step => {
      const where = step.in === 'stage' ? null : resolve(step.in);
      const tg = step.in === 'stage' ? P.targets[0] : sprites().find(s => s.id === where.id);
      const label = step.in === 'stage' ? L('In the Stage:', 'En el Escenario:')
        : where.id ? L('In your ', 'En tu objeto ') + '“' + where.name + '”' + L(' sprite:', ':')
        : L('In a new sprite called ', 'En un objeto nuevo llamado ') + '“' + where.name + '” ' + L('(make one with the sprite list):', '(créalo en la lista de objetos):');
      const blocks = fillBlocks(step.script(), tg);
      return h('div', { class:'hstep' },
        h('div', { class:'hwhere' }, '📍 ' + label),
        step.say ? h('p', {}, T2(step.say)) : null,
        h('div', { class:'hblocks' }, EDITOR.view(blocks)));
    }),
    h('p', { class:'hwhy' }, h('b', {}, L('Why it works: ', 'Por qué funciona: ')), T2(r.why)),
    feedback(r),
    r.also && r.also.length ? h('div', {}, h('small', { class:'muted' }, L('Next you could try:', 'Después puedes probar:')),
      h('div', { class:'hsugg' }, r.also.map(id => RECIPES.of(id)).filter(Boolean).map(x => h('button', { type:'button', class:'hq-btn', onclick:() => pick(x) }, T2(x.title))))) : null);
    scroll();
  }
  function feedback(r){
    const row = h('div', { class:'hfb' });
    const done = (kind, text) => { log(T2(r.title), r.id, kind); row.replaceChildren(h('p', {}, text)); scroll(); };
    row.append(
      h('button', { class:'btn small', type:'button', onclick:() => done('worked', L('🎉 Nice work! Press ⚑ to test it again.', '🎉 ¡Buen trabajo! Presiona ⚑ para probarlo otra vez.')) }, '👍 ' + L('It works!', '¡Funciona!')),
      h('button', { class:'btn small', type:'button', onclick:() => done('stuck', L('Check these: is every block in the right sprite? Are they all snapped together under the hat block? Did you press ⚑? If it still does not work, ask your teacher — they can see you were stuck on this one.', 'Revisa: ¿cada bloque está en el objeto correcto? ¿Están todos unidos bajo el bloque de inicio? ¿Presionaste ⚑? Si aún no funciona, pregúntale a tu maestro — puede ver que te atoraste en esta.')) }, '😕 ' + L('Still stuck', 'Sigo atorado')));
    return row;
  }

  /* ------------------------------------------------------------- roles
     Which of the student's sprites does each job. */
  function rolesIn(r){
    const set = new Set();
    for(const s of r.steps){
      if(s.in !== 'stage') set.add(s.in);
      for(const m of JSON.stringify(s.script()).matchAll(/\{(\w+)\}/g)) if(m[1] !== 'sound') set.add(m[1]);
    }
    return [...set];
  }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function guessSprite(role){
    const spec = RECIPES.ROLES[role];
    const s = spec && sprites().find(x => spec.guess.test(norm(x.name)));
    return s ? s.id : null;
  }
  /* -> { id, name } for a sprite, { id:null, name } for one to make, or { ask:true } */
  function resolve(role){
    const a = about() || {};
    const sp = sprites();
    const byId = id => sp.find(s => s.id === id);
    const spec = RECIPES.ROLES[role] || { fallback:role };
    if(role === 'player'){
      const s = byId(a.player) || byId(guessSprite('player')) || sp[0];
      return s ? { id:s.id, name:s.name } : { id:null, name:spec.fallback };
    }
    const chosen = (a.roles || {})[role];
    if(chosen === '-') return { id:null, name:spec.fallback };
    if(byId(chosen)) return { id:chosen, name:byId(chosen).name };
    const player = resolve('player').id;
    const g = sp.find(s => s.id !== player && spec.guess && spec.guess.test(norm(s.name)));
    if(g) return { id:g.id, name:g.name };
    const others = sp.filter(s => s.id !== player);
    if(!others.length) return { id:null, name:spec.fallback };
    if(others.length === 1) return { id:others[0].id, name:others[0].name };
    return { ask:true };
  }
  function askRole(role, then){
    const spec = RECIPES.ROLES[role];
    const player = resolve('player').id;
    const set = id => {
      P.about.roles = { ...(P.about.roles || {}), [role]:id };
      if(!ro) onChange();
      then();
    };
    return h('div', { class:'hrole' },
      h('p', {}, h('b', {}, L('Which sprite is ', '¿Cuál objeto es ') + T2(spec.label) + '?')),
      h('div', { class:'hsugg' },
        sprites().filter(s => s.id !== player).map(s => h('button', { type:'button', class:'hq-btn', onclick:() => set(s.id) },
          h('img', { src:MEDIA.url(RENDER.costumeOf(s).asset), alt:'' }), s.name)),
        h('button', { type:'button', class:'hq-btn', onclick:() => set('-') }, L('I don’t have one yet', 'Aún no tengo uno'))));
  }
  /* the recipe's words with the student's sprite names in */
  function fill(text){
    return String(text).replace(/\{(\w+)\}/g, (m, role) => {
      if(!RECIPES.ROLES[role]) return m;
      const r = resolve(role);
      return r.ask ? T2(RECIPES.ROLES[role].label) : r.name;
    });
  }
  function fillBlocks(blocks, tg){
    const snd = (tg && tg.sounds[0] && tg.sounds[0].name) || 'pop';
    const swap = v => typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (m, role) => role === 'sound' ? snd : RECIPES.ROLES[role] ? (resolve(role).name || m) : m) : v;
    PROJECT.walk(blocks, b => { for(const n in b.args) b.args[n] = swap(b.args[n]); });
    return blocks;
  }

  /* ---------------------------------------------------------- matching
     Words in the question that are in a recipe's word list score a point
     each (longer words a bit more). Endings are trimmed so "jumping",
     "jumps" and "jumped" are all "jump". */
  const STOP = new Set(('a an the i me my mine to of in on at for and or it its is are be can do does did how what when where why ' +
    'make makes made want get let so that this there them they you your with without help please like just also some thing things ' +
    'sprite sprites game games block blocks code coding thing work works ' +
    'que como hago hacer hace mi mis el la los las un una unos unas de del en y o es son se lo le para por con sin quiero puedo ' +
    'objeto objetos juego juegos bloque bloques codigo ayuda favor cosa cosas cuando donde porque').split(' '));
  const stem = w => w.length > 5 && /ing$/.test(w) ? w.slice(0, -3) : w.length > 4 && /(ed|es)$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : w;
  const words = s => norm(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w && !STOP.has(w)).map(stem);
  /* the same word with a different ending (Spanish verbs mostly) */
  function alike(a, b){
    if(b.length < 4) return false;
    let n = 0; while(n < a.length && n < b.length && a[n] === b[n]) n++;
    return n >= 4 && n >= Math.min(a.length, b.length) * 0.75;
  }
  const HELLO = new Set('hi hello hey yo sup thanks thank thx ok okay cool hola gracia buenas bueno vale'.split(' '));
  const index = new Map();
  function recipeWords(r){
    if(!index.has(r.id)) index.set(r.id, new Set(words(r.words + ' ' + r.title.join(' '))));
    return index.get(r.id);
  }
  function match(q){
    const qs = [...new Set(words(q))];
    if(!qs.length) return [];
    const a = about() || {};
    const scored = RECIPES.LIST.map(r => {
      const ws = recipeWords(r);
      let s = 0;
      for(const w of qs){
        if(ws.has(w)) s += w.length > 4 ? 1.5 : 1;
        else if(w.length >= 4 && [...ws].some(x => alike(w, x))) s += 0.75;     // salte ~ saltar, dispare ~ disparar
      }
      if(s > 0) s += r.tags.filter(t => (a.has || []).includes(t)).length * 0.25;
      return { r, s };
    }).filter(x => x.s >= 0.75).sort((x, y) => y.s - x.s);
    if(!scored.length) return [];
    const best = scored[0].s;
    return scored.filter((x, i) => i === 0 || x.s >= best * 0.7).slice(0, 3).map(x => x.r);
  }

  /* --------------------------------------------------------------- log */
  function log(q, recipe, kind){
    if(me().role !== 'student' || ro) return;
    fetch('/api/helper/log', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ q, recipe, kind, project:projectId }) }).catch(() => {});
  }

  return { mount, load, open, close, toggle, match, get isOpen(){ return isOpen; } };
})();
