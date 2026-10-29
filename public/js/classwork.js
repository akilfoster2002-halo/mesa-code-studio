/* =====================================================================
   CLASSWORK — what is in the Classroom, by topic, and how far a student
   has got with each piece (worked out from what the tools already save).

   An item is an assignment (it has progress and shows in Grades) or a
   material (a place to go: My Projects, a free coding site…). The
   teacher can hide an item or give it a due date, per period.

   status(item, d) → { state:'none'|'started'|'done', pct, text } where d is
   one student's { learn:{ levels, words, html }, design:{ done, approved },
   projects, blocks }. Runs in the page (after learn-levels.js) and in Node.
   ===================================================================== */
(function(root){
  const LEARN = root.LEARN || require('./learn-levels.js');
  const DESIGN_STEPS = 15;            // the steps in design-steps.js
  const HTML_ACTS = 7;                // the activities in html-lessons.js
  const GAME_BLOCKS = 30;             // a game with this many blocks counts as made

  const chapter = c => ({
    id:'maze-' + c.id, kind:'assignment', icon:c.icon, title:c.title, href:'/learn#/l/' + c.levels[0].id, teacher:'/learn#/teacher',
    line:{ en:c.levels.length + ' maze levels with Bit', es:c.levels.length + ' niveles del laberinto con Bit' },
    status:d => {
      const n = c.levels.filter(l => ((d.learn.levels || {})[l.id] || {}).stars).length;
      return prog(n, c.levels.length, n + ' / ' + c.levels.length);
    }
  });
  const prog = (n, of, text) => ({ state:n >= of ? 'done' : n > 0 ? 'started' : 'none', pct:of ? Math.round(100 * Math.min(n, of) / of) : 0, text });

  const TOPICS = [
    { id:'start', icon:'👋', title:{ en:'Start here', es:'Empieza aquí' }, items:[
      { id:'tour', kind:'material', icon:'🧭', title:{ en:'Tour of Code Studio', es:'Recorrido por Code Studio' },
        line:{ en:'Press Tour in the top bar to see how the block editor works', es:'Presiona Tour arriba para ver cómo funciona el editor' }, href:'/studio#/' }
    ] },
    { id:'learn', icon:'🎮', title:{ en:'Learn to code', es:'Aprende a programar' }, items:[
      ...LEARN.CHAPTERS.map(chapter),
      { id:'words', kind:'assignment', icon:'🧠', title:{ en:'Code Words', es:'Palabras de código' }, href:'/learn#/words', teacher:'/learn#/teacher',
        line:{ en:'Match each coding word to what it means', es:'Une cada palabra con lo que significa' },
        status:d => d.learn.words ? { state:'done', pct:100, text:d.learn.words.secs + 's' } : prog(0, 1, '') }
    ] },
    { id:'blocks', icon:'◆', title:{ en:'Block coding', es:'Programar con bloques' }, items:[
      { id:'projects', kind:'material', icon:'📁', title:{ en:'My Projects', es:'Mis proyectos' }, href:'/studio#/',
        line:{ en:'Your games and stories, saved as you work', es:'Tus juegos e historias, guardados mientras trabajas' } },
      { id:'game', kind:'assignment', icon:'🕹', title:{ en:'Make a game', es:'Haz un juego' }, href:'/studio#/', teacher:'/studio#/teacher',
        line:{ en:'Build a game with at least ' + GAME_BLOCKS + ' blocks', es:'Construye un juego con al menos ' + GAME_BLOCKS + ' bloques' },
        status:d => prog(d.blocks || 0, GAME_BLOCKS, (d.blocks || 0) + ' 🧩') },
      { id:'classgames', kind:'material', icon:'🎪', title:{ en:'Class Games', es:'Juegos de la clase' }, href:'/studio#/class',
        line:{ en:'Play your classmates’ games and leave feedback', es:'Juega los juegos de tus compañeros y deja comentarios' } }
    ] },
    { id:'design', icon:'🎨', title:{ en:'Game design', es:'Diseño de juegos' }, items:[
      { id:'packet', kind:'assignment', icon:'📝', title:{ en:'Game Design Packet', es:'Paquete de diseño de juego' }, href:'/design', teacher:'/design#/teacher',
        student:u => '/design#/teacher/' + encodeURIComponent(u),
        line:{ en:'Plan your game in ' + DESIGN_STEPS + ' steps', es:'Planea tu juego en ' + DESIGN_STEPS + ' pasos' },
        status:d => {
          const n = (d.design && d.design.done) || 0;
          const s = prog(n, DESIGN_STEPS, n + ' / ' + DESIGN_STEPS);
          if(d.design && d.design.approved) s.text += ' · ✓ OK';
          return s;
        } }
    ] },
    { id:'web', icon:'</>', title:{ en:'Web pages: HTML', es:'Páginas web: HTML' }, items:[
      { id:'html', kind:'assignment', icon:'🌐', title:{ en:'Intro to HTML', es:'Introducción a HTML' }, href:'/html', teacher:'/html#/teacher',
        line:{ en:'7 short activities, about 30 minutes', es:'7 actividades cortas, unos 30 minutos' },
        status:d => { const n = Object.keys(d.learn.html || {}).length; return prog(n, HTML_ACTS, n + ' / ' + HTML_ACTS); } },
      { id:'html-page', kind:'assignment', icon:'✏️', title:{ en:'My First Web Page', es:'Mi primera página web' }, href:'/html#/a/page', teacher:'/html#/teacher',
        line:{ en:'Write your own page and meet all 5 goals', es:'Escribe tu propia página y cumple las 5 metas' },
        status:d => { const v = d.learn.html && d.learn.html.page; return v ? prog(v.best >= 100 ? 1 : 0.5, 1, v.best + '%') : prog(0, 1, ''); } }
    ] },
    { id:'more', icon:'🌍', title:{ en:'More practice', es:'Más práctica' }, items:[
      { id:'bugsquad', kind:'material', icon:'🐞', title:{ en:'Bug Squad', es:'Bug Squad' }, href:'https://bug-squad-6gxr.onrender.com', out:true,
        line:{ en:'Find and fix bugs in arcade games', es:'Encuentra y arregla errores en juegos' } },
      { id:'arcade', kind:'material', icon:'🕹', title:{ en:'Arcade Cabinet', es:'Arcade Cabinet' }, href:'https://arcade-blocks.onrender.com', out:true,
        line:{ en:'10 classic games made of blocks', es:'10 juegos clásicos hechos con bloques' } },
      { id:'blockly', kind:'material', icon:'🧩', title:{ en:'Blockly Games', es:'Blockly Games' }, href:'https://blockly.games', out:true,
        line:{ en:'Maze, bird and turtle puzzles', es:'Laberinto, pájaro y tortuga' } },
      { id:'codeorg', kind:'material', icon:'🌍', title:{ en:'Code.org', es:'Code.org' }, href:'https://code.org/learn', out:true,
        line:{ en:'Hour of Code games', es:'Juegos de la Hora del Código' } },
      { id:'scratch', kind:'material', icon:'😺', title:{ en:'Scratch', es:'Scratch' }, href:'https://scratch.mit.edu', out:true,
        line:{ en:'Make anything with blocks', es:'Haz lo que quieras con bloques' } }
    ] }
  ];
  const ITEMS = TOPICS.flatMap(t => t.items.map(it => ({ ...it, topic:t })));

  /* a teacher's own assignment (from /api/room): students attach HTML files
     and turn them in; d.subs[id] = { turnedIn, at, files } */
  const ASSIGNMENTS_TOPIC = { id:'assignments', icon:'📋', title:{ en:'Assignments', es:'Tareas' } };
  function custom(a){
    return { id:a.id, kind:'assignment', custom:a, icon:'📄', title:a.title, line:a.text || '', topicId:a.topic || 'assignments',
      status:d => {
        const s = (d.subs || {})[a.id];
        if(s && s.turnedIn) return { state:'done', pct:100, text:'✓', late:!!(a.due && s.at && s.at.slice(0, 10) > a.due) };
        return s && s.files ? { state:'started', pct:50, text:s.files + ' 📄' } : { state:'none', pct:0, text:'' };
      } };
  }
  // every topic with its items, the teacher's assignments put in the topic they chose
  function topicsWith(assignments){
    const cs = (assignments || []).map(custom);
    const known = new Set(TOPICS.map(t => t.id));
    const mine = cs.filter(c => !known.has(c.topicId));
    return [...(mine.length ? [{ ...ASSIGNMENTS_TOPIC, items:mine }] : []),
      ...TOPICS.map(t => ({ ...t, items:[...cs.filter(c => c.topicId === t.id), ...t.items] }))];
  }
  const ASSIGNMENTS = ITEMS.filter(it => it.kind === 'assignment');

  /* one student's data, from what the tools save (the same shape the
     teacher's /api/room/:p/grades gives for every student) */
  function studentData(learn, design, projects, subs){
    const ps = Array.isArray(projects) ? projects : [];
    return { subs:subs || {},
      learn:{ levels:(learn && learn.levels) || {}, words:(learn && learn.words) || null, html:(learn && learn.html && learn.html.acts) || {} },
      design:design ? { done:Array.isArray(design.done) ? design.done.length : 0, approved:!!design.approved } : null,
      projects:ps.length, blocks:ps.reduce((a, p) => Math.max(a, (p.stats && p.stats.blocks) || 0), 0)
    };
  }
  function status(item, d){
    if(!item.status) return null;
    return item.status({ ...d, learn:(d && d.learn) || {} });
  }

  const CLASSWORK = { TOPICS, ITEMS, ASSIGNMENTS, ASSIGNMENTS_TOPIC, custom, topicsWith, studentData, status };
  if(typeof module !== 'undefined' && module.exports) module.exports = CLASSWORK; else root.CLASSWORK = CLASSWORK;
})(typeof window !== 'undefined' ? window : this);
