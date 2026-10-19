/* =====================================================================
   HELPER — 💬 the Block Helper: a chat in the editor's lower-right corner
   (a round button that opens a chat window above it) that answers
   "how do I…?" questions with real Code Studio blocks.

   Every question goes to an AI on the server (server/ai.js), with the
   project as it is on screen (names and scripts, so the answer uses the
   student's own sprites, costumes and variables) and the last few
   questions and answers, so "it didn't work" makes sense.

   The server checks every block against the block table before it gets
   here. Each answer is the idea first; "Show me the blocks" draws them,
   sprite by sprite, with EDITOR.view. Students drag the blocks in
   themselves.
   ===================================================================== */
window.HELPER = (function(){
  const { h } = UI;
  const L = (en, es) => I18N.lang === 'es' ? es : en;
  let P = null, projectId = null, getMe = () => null;
  let panel = null, main = null, chat = null, isOpen = false, button = null, busy = false;

  function mount(opts){
    getMe = opts.me;
    panel = h('aside', { class:'helper hidden', 'aria-label':'Block Helper' });
    button = h('button', { class:'hlaunch', type:'button', 'aria-expanded':'false', onclick:toggle },
      h('span', { class:'hl-open' }, '💬'), h('span', { class:'hl-close' }, '✕'));
    label();
    return [panel, button];
  }
  function load(project, opts){
    const same = projectId === opts.id && P === project;
    P = project; projectId = opts.id;
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

  /* ---------------------------------------------------------- the panel */
  function render(){
    const head = h('div', { class:'hhead' },
      h('span', { class:'hlogo' }, '💬'), h('b', {}, L('Block Helper', 'Ayudante de bloques')), h('span', { class:'grow' }),
      h('button', { class:'btn small ghost hx', type:'button', title:L('Close', 'Cerrar'), onclick:close }, '✕'));
    main = h('div', { class:'hmain' });
    panel.replaceChildren(head, main);
    renderChat();
  }

  function renderChat(){
    if(!chat){
      chat = { log:h('div', { class:'hlog', 'aria-live':'polite' }), history:[] };
      const examples = [
        L('How do I make my sprite jump?', '¿Cómo hago que mi objeto salte?'),
        L('How do I add a score?', '¿Cómo agrego puntos?'),
        L('How do I make something fall from the sky?', '¿Cómo hago que algo caiga del cielo?')
      ];
      bot(h('div', {},
        h('p', {}, (firstName() ? L('Hi ', '¡Hola, ') + firstName() + '! ' : '') + L('I can help you build your game with blocks. I can see your sprites and scripts.', 'Te puedo ayudar a hacer tu juego con bloques. Puedo ver tus objetos y programas.')),
        h('p', {}, L('Ask me anything, like:', 'Pregúntame lo que sea, como:')),
        h('div', { class:'hsugg' }, examples.map(q => h('button', { type:'button', class:'hq-btn', onclick:() => ask(q) }, q)))));
    }
    const input = h('input', { class:'inp', maxlength:300, placeholder:L('Ask a question…', 'Haz una pregunta…'), 'aria-label':L('Ask a question', 'Haz una pregunta') });
    const form = h('form', { class:'hask' }, input, h('button', { class:'btn primary', type:'submit' }, L('Ask', 'Preguntar')));
    form.onsubmit = e => { e.preventDefault(); const v = input.value.trim(); if(!v || busy) return; input.value = ''; ask(v); };
    main.replaceChildren(chat.log, form);
    scroll();
    input.focus();
  }
  function scroll(){ if(chat) requestAnimationFrame(() => chat.log.scrollTop = chat.log.scrollHeight); }
  function bot(content){ const m = h('div', { class:'hm bot' }, content); chat.log.append(m); scroll(); return m; }
  function said(text){ chat.log.append(h('div', { class:'hm me' }, text)); scroll(); }

  /* --------------------------------------------------------- a question */
  async function ask(text){
    if(!chat) renderChat();
    if(busy) return;
    busy = true;
    said(text);
    const wait = bot(h('p', { class:'hthink' }, '🤔 ' + L('Let me think…', 'Déjame pensar…')));
    let r = null, got = null;
    try {
      r = await fetch('/api/helper/ask', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ q:text, game:game(), sprite:EDITOR.target && EDITOR.target.name, history:chat.history, lang:I18N.lang }) });
      got = r.ok ? await r.json() : await r.json().catch(() => ({}));
    } catch(e){}
    wait.remove();
    busy = false;
    if(!r || !r.ok) return bot(h('p', {}, problem(r && r.status, got && got.error)));
    answer(got);
    chat.history.push({ q:text, a:summary(got) });
    if(chat.history.length > 3) chat.history.shift();
  }
  function problem(status, error){
    if(status === 503) return L('The helper is not turned on yet. Ask your teacher!', 'El ayudante aún no está encendido. ¡Pregúntale a tu maestro!');
    if(status === 429 && error === 'hour') return L('You have asked a lot this hour. Try it yourself for a bit, then ask again!', 'Has preguntado mucho esta hora. Inténtalo tú un rato y luego pregunta otra vez.');
    if(status === 429) return L('The helper has answered a lot today. Ask your teacher, or try again tomorrow!', 'El ayudante ha contestado mucho hoy. Pregúntale a tu maestro o intenta mañana.');
    if(status === 401) return L('You are signed out. Sign in again to ask.', 'Cerraste sesión. Entra otra vez para preguntar.');
    return L('I could not think of an answer just now. Try again in a minute, or ask with different words.', 'No pude pensar una respuesta ahora. Intenta en un minuto o pregunta con otras palabras.');
  }

  /* the project as the server needs it: names and scripts, no pictures */
  function game(){
    const names = list => (list || []).map(x => x.name);
    return { targets:P.targets.map(t => ({ name:t.name, isStage:!!t.isStage, costumes:names(t.costumes), sounds:names(t.sounds),
      vars:Object.keys(t.vars || {}), lists:Object.keys(t.lists || {}), messages:t.isStage ? (t.messages || []) : undefined,
      scripts:(t.scripts || []).map(s => PROJECT.serialize(s.blocks)) })) };
  }
  /* what the model said last time, for follow-up questions */
  function summary(a){
    return [a.text, ...(a.steps || []).map(s => 'In ' + s.sprite + ': ' + s.say + ' (' + blockOps(s.blocks).join(', ') + ')'), a.tip].filter(Boolean).join('\n');
  }
  function blockOps(list){
    const out = [];
    PROJECT.walk(list, b => out.push(b.op));
    return out;
  }

  /* --------------------------------------------------------- an answer */
  function answer(a){
    const steps = a.steps || [];
    const more = h('div', { class:'hmore' });
    const btn = steps.length ? h('button', { class:'btn primary small', type:'button' }, '🧱 ' + L('Show me the blocks', 'Muéstrame los bloques')) : null;
    if(btn) btn.onclick = () => { btn.remove(); reveal(a, more); };
    bot(h('div', { class:'hrecipe' },
      a.text ? h('p', {}, a.text) : null,
      steps.length ? h('p', { class:'muted' }, L('Try it yourself first! Stuck?', '¡Inténtalo tú primero! ¿Atorado?')) : null,
      btn, more));
  }
  function reveal(a, into){
    const has = name => P.targets.some(t => t.isStage ? name === 'Stage' : t.name === name);
    const known = kind => new Set(P.targets.flatMap(t => Object.keys(t[kind] || {})));
    const vars = known('vars'), lists = known('lists');
    const make = [
      ...((a.make && a.make.vars) || []).filter(v => !vars.has(v)).map(v => L('Make a variable called ', 'Crea una variable llamada ') + '“' + v + '” ' + L('(Variables → Make a Variable).', '(Variables → Crear una variable).')),
      ...((a.make && a.make.lists) || []).filter(v => !lists.has(v)).map(v => L('Make a list called ', 'Crea una lista llamada ') + '“' + v + '”.')
    ];
    into.replaceChildren(
      make.length ? h('div', { class:'hstep' }, h('div', { class:'hwhere' }, '✨ ' + L('First:', 'Primero:')), make.map(m => h('p', {}, m))) : null,
      ...a.steps.map(step => {
        const isStage = step.sprite === 'Stage';
        const label = isStage ? L('In the Stage:', 'En el Escenario:')
          : has(step.sprite) ? L('In your ', 'En tu objeto ') + '“' + step.sprite + '”' + L(' sprite:', ':')
          : L('In a new sprite called ', 'En un objeto nuevo llamado ') + '“' + step.sprite + '” ' + L('(make one with the sprite list):', '(créalo en la lista de objetos):');
        return h('div', { class:'hstep' },
          h('div', { class:'hwhere' }, '📍 ' + label),
          step.say ? h('p', {}, step.say) : null,
          h('div', { class:'hblocks' }, EDITOR.view(step.blocks.map(build))));
      }),
      a.tip ? h('p', { class:'hwhy' }, '💡 ' + a.tip) : null,
      h('p', { class:'muted hnote-ai' }, L('This answer is from an AI, so it can be wrong. If it does not work, tell me what happened!', 'Esta respuesta es de una IA y puede estar mal. Si no funciona, ¡dime qué pasó!')));
    scroll();
  }
  /* the server's checked block -> a real block, with the table's defaults
     for any slot the answer left empty */
  function build(x){
    const b = PROJECT.block(x.op);
    Object.assign(b.args, x.args || {});
    for(const [k, v] of Object.entries(x.inputs || {})) b.inputs[k] = build(v);
    if(x.body) b.body = x.body.map(build);
    if(x.body2) b.body2 = x.body2.map(build);
    return b;
  }

  return { mount, load, open, close, toggle, get isOpen(){ return isOpen; } };
})();
