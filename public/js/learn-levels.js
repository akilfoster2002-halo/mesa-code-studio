/* =====================================================================
   LEARN — the maze games' levels and the robot that runs a program.
   Runs in the browser (window.LEARN) and in node (the tests solve
   every level with its answer, so no level can be impossible).

   A maze is rows of text:  #  wall      .  path      G  the star
                            g  a gem     > < ^ v  Bit, facing that way
   A program is a list of blocks:
     { op:'move' } { op:'left' } { op:'right' } { op:'pick' }
     { op:'repeat', n:3, body:[…] }      { op:'until', body:[…] }  (until ⭐)
     { op:'if', cond:'wall'|'pathL'|'pathR'|'gem', body:[…] }
   Bit wins the moment it stands on ⭐ with every 💎 picked up.
   ===================================================================== */
(function(root){
  const DIRS = { E:[1, 0], S:[0, 1], W:[-1, 0], N:[0, -1] };
  const RIGHT = { E:'S', S:'W', W:'N', N:'E' }, LEFT = { E:'N', N:'W', W:'S', S:'E' };
  const START = { '>':'E', '<':'W', '^':'N', 'v':'S' };

  function parse(rows){
    const m = { w:rows[0].length, h:rows.length, walls:new Set(), gems:new Set(), goal:null, start:null };
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const k = x + ',' + y;
      if(ch === '#') m.walls.add(k);
      else if(ch === 'G') m.goal = k;
      else if(ch === 'g') m.gems.add(k);
      else if(START[ch]) m.start = { x, y, dir:START[ch] };
    }));
    return m;
  }

  /* run → { frames:[{ x, y, dir, gems:[…], id, act }], result } where result is
     'win' · 'crash' (into a wall) · 'gems' (on ⭐, 💎 left) · 'short' (stopped before ⭐) · 'loop' (never ends) */
  function run(level, program){
    const m = parse(level.maze);
    const bot = { ...m.start }, gems = new Set(m.gems);
    const frames = [{ x:bot.x, y:bot.y, dir:bot.dir, gems:[...gems], id:null, act:'start' }];
    let budget = 400, result = null;
    const at = (dx, dy) => (bot.x + dx) + ',' + (bot.y + dy);
    const ahead = d => { const [dx, dy] = DIRS[d]; return at(dx, dy); };
    const onGoal = () => at(0, 0) === m.goal;
    const won = () => onGoal() && gems.size === 0;
    const test = c => c === 'wall' ? m.walls.has(ahead(bot.dir))
                    : c === 'pathL' ? !m.walls.has(ahead(LEFT[bot.dir]))
                    : c === 'pathR' ? !m.walls.has(ahead(RIGHT[bot.dir]))
                    : c === 'gem' ? gems.has(at(0, 0)) : false;
    const frame = (b, act) => frames.push({ x:bot.x, y:bot.y, dir:bot.dir, gems:[...gems], id:b.id || null, act });
    function exec(list){
      for(const b of list){
        if(result) return;
        if(--budget < 0){ result = 'loop'; return; }
        if(b.op === 'move'){
          const [dx, dy] = DIRS[bot.dir];
          if(m.walls.has(at(dx, dy))){ frame(b, 'bump'); result = 'crash'; return; }
          bot.x += dx; bot.y += dy; frame(b, 'move');
          if(won()){ result = 'win'; return; }
        }
        else if(b.op === 'left'){ bot.dir = LEFT[bot.dir]; frame(b, 'turn'); }
        else if(b.op === 'right'){ bot.dir = RIGHT[bot.dir]; frame(b, 'turn'); }
        else if(b.op === 'pick'){ gems.delete(at(0, 0)); frame(b, 'pick'); if(won()){ result = 'win'; return; } }
        else if(b.op === 'repeat'){ for(let i = 0; i < (b.n || 1) && !result; i++) exec(b.body || []); }
        else if(b.op === 'until'){ while(!onGoal() && !result){ if(--budget < 0){ result = 'loop'; return; } exec(b.body || []); } }
        else if(b.op === 'if'){ frame(b, 'check'); if(test(b.cond)) exec(b.body || []); }
      }
    }
    exec(program);
    if(!result) result = won() ? 'win' : onGoal() ? 'gems' : 'short';
    return { frames, result, maze:m };
  }
  const count = list => list.reduce((n, b) => n + 1 + (b.body ? count(b.body) : 0), 0);

  /* ---------------------------------------------------------- the levels
     best = fewest blocks (3 stars). start = the buggy program in Bug Hunt. */
  const M = (op, extra) => ({ op, ...extra });
  const mv = M('move'), L = M('left'), R = M('right'), pick = M('pick');
  const rep = (n, ...body) => ({ op:'repeat', n, body });
  const until = (...body) => ({ op:'until', body });
  const iff = (cond, ...body) => ({ op:'if', cond, body });
  const SEQ = ['move', 'left', 'right'], LOOP = ['move', 'left', 'right', 'repeat'];

  const CHAPTERS = [
    { id:'steps', icon:'🤖', blocks:SEQ,
      title:{ en:'Steps in order', es:'Pasos en orden' },
      word:{ en:'Sequence', es:'Secuencia' },
      means:{ en:'Steps in order. The computer does them one by one.', es:'Pasos en orden. La computadora los hace uno por uno.' },
      levels:[
        { maze:['#####', '#>.G#', '#####'], best:2, answer:[mv, mv] },
        { maze:['#######', '#>...G#', '#######'], best:4, answer:[mv, mv, mv, mv] },
        { maze:['#####', '#>.##', '##.##', '##G##', '#####'], best:4, answer:[mv, R, mv, mv] },
        { maze:['######', '#..G##', '#.####', '#^####', '######'], best:5, answer:[mv, mv, R, mv, mv] },
        { maze:['######', '#G..##', '###.##', '#>..##', '######'], best:8, answer:[mv, mv, L, mv, mv, L, mv, mv] },
        { maze:['#######', '#>.####', '##..###', '###.G##', '#######'], best:9, answer:[mv, R, mv, L, mv, R, mv, L, mv] }
      ] },
    { id:'loops', icon:'🔁', blocks:LOOP,
      title:{ en:'Loops', es:'Bucles' },
      word:{ en:'Loop', es:'Bucle' },
      means:{ en:'A loop does the same steps again and again. Fewer blocks!', es:'Un bucle hace los mismos pasos una y otra vez. ¡Menos bloques!' },
      levels:[
        { maze:['##########', '#>......G#', '##########'], best:2, max:2, answer:[rep(7, mv)] },
        { maze:['######', '#>...#', '####.#', '####.#', '#G...#', '######'], best:5, max:5, answer:[rep(3, mv, mv, mv, R)] },
        { maze:['#######', '#>.####', '##..###', '###..##', '####.G#', '#######'], best:6, max:6, answer:[rep(3, mv, R, mv, L), mv] },
        { maze:['########', '#v######', '#.######', '#.######', '#.######', '#.######', '#.....G#', '########'], best:5, max:5,
          answer:[rep(5, mv), L, rep(5, mv)] }
      ] },
    { id:'bugs', icon:'🐞', blocks:LOOP, fix:true,
      title:{ en:'Bug Hunt', es:'Caza de errores' },
      word:{ en:'Debug', es:'Depurar' },
      means:{ en:'A bug is a mistake in code. Find it and fix it!', es:'Un error (bug) es una equivocación en el código. ¡Encuéntralo y arréglalo!' },
      levels:[
        { maze:['#####', '#>.##', '##.##', '##G##', '#####'], best:4, start:[mv, L, mv, mv], answer:[mv, R, mv, mv] },
        { maze:['#######', '#>...G#', '#######'], best:2, start:[rep(3, mv)], answer:[rep(4, mv)] },
        { maze:['######', '#G..##', '###.##', '#>..##', '######'], best:8, start:[mv, mv, L, mv, mv, R, mv, mv], answer:[mv, mv, L, mv, mv, L, mv, mv] },
        { maze:['######', '#>...#', '####.#', '####.#', '#G...#', '######'], best:5, start:[rep(3, mv, mv, R)], answer:[rep(3, mv, mv, mv, R)] }
      ] },
    { id:'ifs', icon:'🔀', blocks:['move', 'left', 'right', 'pick', 'until', 'if'],
      title:{ en:'IF / THEN', es:'SI / ENTONCES' },
      word:{ en:'Conditional', es:'Condicional' },
      means:{ en:'IF something is true, THEN do something. Bit can look before it moves!', es:'SI algo es cierto, ENTONCES haz algo. ¡Bit puede mirar antes de moverse!' },
      levels:[
        { maze:['###########', '#>.......G#', '###########'], best:2, max:2, blocks:['move', 'until'], answer:[until(mv)] },
        { maze:['#######', '#>...##', '####.##', '#G...##', '#######'], best:4, max:4, blocks:['move', 'right', 'until', 'if'], answer:[until(iff('wall', R), mv)] },
        { maze:['#########', '#>.g.g.G#', '#########'], best:4, max:4, blocks:['move', 'pick', 'until', 'if'], answer:[until(mv, iff('gem', pick))] },
        { maze:['########', '#>..####', '###.####', '###...G#', '########'], best:6, max:6, answer:[until(iff('pathR', R), iff('pathL', L), mv)] }
      ] }
  ];
  CHAPTERS.forEach(c => c.levels.forEach((l, i) => { l.id = c.id + '-' + (i + 1); l.blocks = l.blocks || c.blocks; }));

  /* coding words for the matching game */
  const WORDS = [
    { k:'algorithm', icon:'📋', w:{ en:'Algorithm', es:'Algoritmo' }, m:{ en:'Steps to do a job', es:'Pasos para hacer un trabajo' } },
    { k:'sequence', icon:'🔢', w:{ en:'Sequence', es:'Secuencia' }, m:{ en:'Steps in order', es:'Pasos en orden' } },
    { k:'loop', icon:'🔁', w:{ en:'Loop', es:'Bucle' }, m:{ en:'Do it again and again', es:'Hacerlo una y otra vez' } },
    { k:'bug', icon:'🐞', w:{ en:'Bug', es:'Error' }, m:{ en:'A mistake in code', es:'Una equivocación en el código' } },
    { k:'debug', icon:'🔧', w:{ en:'Debug', es:'Depurar' }, m:{ en:'Find and fix a mistake', es:'Encontrar y arreglar un error' } },
    { k:'if', icon:'🔀', w:{ en:'Conditional', es:'Condicional' }, m:{ en:'IF this, THEN that', es:'SI esto, ENTONCES aquello' } },
    { k:'input', icon:'⌨️', w:{ en:'Input', es:'Entrada' }, m:{ en:'What you press or click', es:'Lo que presionas o haces clic' } },
    { k:'output', icon:'🖥', w:{ en:'Output', es:'Salida' }, m:{ en:'What the computer shows or plays', es:'Lo que la computadora muestra o toca' } },
    { k:'variable', icon:'📦', w:{ en:'Variable', es:'Variable' }, m:{ en:'A box that holds a number', es:'Una caja que guarda un número' } },
    { k:'event', icon:'🚩', w:{ en:'Event', es:'Evento' }, m:{ en:'Something that starts the code', es:'Algo que empieza el código' } },
    { k:'sprite', icon:'🐱', w:{ en:'Sprite', es:'Objeto' }, m:{ en:'A character in your game', es:'Un personaje de tu juego' } },
    { k:'program', icon:'💾', w:{ en:'Program', es:'Programa' }, m:{ en:'Code the computer can run', es:'Código que la computadora puede correr' } }
  ];

  const api = { CHAPTERS, WORDS, run, parse, count };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LEARN = api;
})(typeof window !== 'undefined' ? window : globalThis);
