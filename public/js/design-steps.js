/* =====================================================================
   GAME DESIGN STUDIO — what each step says and asks, in English and
   Spanish. Written for a 3rd-grade reader: short lines, one idea each.
   Key names stay English (they are what is printed on the keyboards).

   A step:  { id, icon, min, title, learn:{ word, means }, example, qs:[…] }
   A question has a key (k) where the answer is saved and a type:
     text · long · chips (one) · multi (some) · pitch · keys · sketch ·
     loop · ifthen · codeplan · quiz · research · mixer · approve · checklist
   req:true means the step is not ✅ until it has an answer.
   ===================================================================== */
window.DESIGN = (function(){
  const ARCADE = 'https://arcade-blocks.onrender.com/play.html?g=';

  /* the games students look at in Research. One right answer per question. */
  const RESEARCH = [
    { id:'pacman', name:'Pac-Man', icon:'🟡',
      qs:[
        { q:{ en:'Who is the player?', es:'¿Quién es el jugador?' }, a:0, o:[
          { en:'A yellow circle', es:'Un círculo amarillo' }, { en:'A ghost', es:'Un fantasma' }, { en:'A dot', es:'Un punto' } ] },
        { q:{ en:'What is the goal?', es:'¿Cuál es la meta?' }, a:1, o:[
          { en:'Shoot the stars', es:'Disparar a las estrellas' }, { en:'Eat every dot', es:'Comer todos los puntos' }, { en:'Jump on blocks', es:'Saltar en bloques' } ] },
        { q:{ en:'What stops you?', es:'¿Qué te detiene?' }, a:2, o:[
          { en:'Cars', es:'Carros' }, { en:'Rocks', es:'Rocas' }, { en:'Ghosts', es:'Fantasmas' } ] } ] },
    { id:'invaders', name:'Space Invaders', icon:'👾',
      qs:[
        { q:{ en:'Who is the player?', es:'¿Quién es el jugador?' }, a:2, o:[
          { en:'An alien', es:'Un extraterrestre' }, { en:'A frog', es:'Una rana' }, { en:'A laser cannon', es:'Un cañón láser' } ] },
        { q:{ en:'What is the goal?', es:'¿Cuál es la meta?' }, a:0, o:[
          { en:'Shoot all the aliens', es:'Disparar a todos los extraterrestres' }, { en:'Eat dots', es:'Comer puntos' }, { en:'Cross the road', es:'Cruzar la calle' } ] },
        { q:{ en:'What stops you?', es:'¿Qué te detiene?' }, a:1, o:[
          { en:'Ghosts', es:'Fantasmas' }, { en:'Alien bullets', es:'Balas de los extraterrestres' }, { en:'Water', es:'Agua' } ] } ] },
    { id:'frogger', name:'Frogger', icon:'🐸',
      qs:[
        { q:{ en:'Who is the player?', es:'¿Quién es el jugador?' }, a:1, o:[
          { en:'A car', es:'Un carro' }, { en:'A frog', es:'Una rana' }, { en:'A log', es:'Un tronco' } ] },
        { q:{ en:'What is the goal?', es:'¿Cuál es la meta?' }, a:2, o:[
          { en:'Eat flies', es:'Comer moscas' }, { en:'Shoot cars', es:'Disparar a los carros' }, { en:'Get home across the road and river', es:'Llegar a casa cruzando la calle y el río' } ] },
        { q:{ en:'What stops you?', es:'¿Qué te detiene?' }, a:0, o:[
          { en:'Cars and water', es:'Carros y agua' }, { en:'Ghosts', es:'Fantasmas' }, { en:'Bricks', es:'Ladrillos' } ] } ] },
    { id:'breakout', name:'Breakout', icon:'🧱',
      qs:[
        { q:{ en:'Who is the player?', es:'¿Quién es el jugador?' }, a:0, o:[
          { en:'A paddle', es:'Una paleta' }, { en:'A brick', es:'Un ladrillo' }, { en:'A ship', es:'Una nave' } ] },
        { q:{ en:'What is the goal?', es:'¿Cuál es la meta?' }, a:1, o:[
          { en:'Catch fruit', es:'Atrapar fruta' }, { en:'Break all the bricks', es:'Romper todos los ladrillos' }, { en:'Eat dots', es:'Comer puntos' } ] },
        { q:{ en:'What stops you?', es:'¿Qué te detiene?' }, a:2, o:[
          { en:'Aliens', es:'Extraterrestres' }, { en:'Cars', es:'Carros' }, { en:'Missing the ball', es:'Que se te escape la pelota' } ] } ] },
    { id:'asteroids', name:'Asteroids', icon:'☄️',
      qs:[
        { q:{ en:'Who is the player?', es:'¿Quién es el jugador?' }, a:2, o:[
          { en:'A rock', es:'Una roca' }, { en:'A frog', es:'Una rana' }, { en:'A spaceship', es:'Una nave espacial' } ] },
        { q:{ en:'What is the goal?', es:'¿Cuál es la meta?' }, a:0, o:[
          { en:'Blast the rocks', es:'Romper las rocas' }, { en:'Eat dots', es:'Comer puntos' }, { en:'Break bricks', es:'Romper ladrillos' } ] },
        { q:{ en:'What stops you?', es:'¿Qué te detiene?' }, a:1, o:[
          { en:'A paddle', es:'Una paleta' }, { en:'Flying rocks', es:'Rocas que vuelan' }, { en:'Logs', es:'Troncos' } ] } ] },
    { id:'pong', name:'Pong', icon:'🏓',
      qs:[
        { q:{ en:'Who is the player?', es:'¿Quién es el jugador?' }, a:1, o:[
          { en:'The ball', es:'La pelota' }, { en:'A paddle', es:'Una paleta' }, { en:'A net', es:'Una red' } ] },
        { q:{ en:'What is the goal?', es:'¿Cuál es la meta?' }, a:2, o:[
          { en:'Eat dots', es:'Comer puntos' }, { en:'Jump high', es:'Saltar alto' }, { en:'Get the ball past the other paddle', es:'Pasar la pelota a la otra paleta' } ] },
        { q:{ en:'What stops you?', es:'¿Qué te detiene?' }, a:0, o:[
          { en:'The other paddle', es:'La otra paleta' }, { en:'Ghosts', es:'Fantasmas' }, { en:'Rocks', es:'Rocas' } ] } ] }
  ];

  const TYPES = [
    { v:'space',   icon:'🚀', en:'Space shooter', es:'Disparos en el espacio' },
    { v:'collect', icon:'🍔', en:'Collect & dodge', es:'Recoge y esquiva' },
    { v:'fight',   icon:'🧟', en:'Fight the bad guys', es:'Pelea contra los malos' },
    { v:'escape',  icon:'🚪', en:'Escape', es:'Escape' },
    { v:'jump',    icon:'🐰', en:'Jump & adventure', es:'Saltos y aventura' },
    { v:'paddle',  icon:'🧱', en:'Paddle & ball', es:'Paleta y pelota' },
    { v:'shop',    icon:'🧁', en:'Shop / clicker', es:'Tienda / clics' },
    { v:'other',   icon:'✨', en:'Something else', es:'Otra cosa' }
  ];
  const MECHANICS = [
    { v:'move', icon:'🏃', en:'move', es:'moverse' }, { v:'jump', icon:'⤴️', en:'jump', es:'saltar' },
    { v:'shoot', icon:'🔫', en:'shoot', es:'disparar' }, { v:'collect', icon:'🪙', en:'collect', es:'recoger' },
    { v:'dodge', icon:'💨', en:'dodge', es:'esquivar' }, { v:'chase', icon:'🏃‍♂️', en:'chase', es:'perseguir' },
    { v:'build', icon:'🧰', en:'build', es:'construir' }, { v:'match', icon:'🧩', en:'match', es:'emparejar' },
    { v:'push', icon:'🫸', en:'push', es:'empujar' }, { v:'clock', icon:'⏱', en:'race the clock', es:'carrera contra el reloj' },
    { v:'click', icon:'👆', en:'click', es:'hacer clic' }
  ];
  const KEYS = ['←', '→', '↑', '↓', 'Space', 'W', 'A', 'S', 'D', 'Mouse click'];
  const HUD = [
    { v:'score', icon:'🔢', en:'score', es:'puntos' }, { v:'lives', icon:'❤️', en:'lives', es:'vidas' },
    { v:'timer', icon:'⏱', en:'timer', es:'reloj' }, { v:'level', icon:'🪜', en:'level', es:'nivel' },
    { v:'health', icon:'🟩', en:'health bar', es:'barra de vida' }, { v:'coins', icon:'🪙', en:'coins', es:'monedas' }
  ];
  const MOVES = [
    { v:'chase', icon:'🎯', en:'chases me', es:'me persigue' }, { v:'patrol', icon:'↔️', en:'walks back and forth', es:'camina de un lado a otro' },
    { v:'fall', icon:'⬇️', en:'falls from the sky', es:'cae del cielo' }, { v:'random', icon:'🎲', en:'moves in random ways', es:'se mueve al azar' },
    { v:'shoot', icon:'🔫', en:'shoots at me', es:'me dispara' }, { v:'still', icon:'🧱', en:'stays still (a wall or trap)', es:'no se mueve (pared o trampa)' }
  ];
  const HARDER = [
    { v:'faster', icon:'⚡', en:'enemies get faster', es:'los enemigos van más rápido' },
    { v:'more', icon:'➕', en:'more enemies come', es:'llegan más enemigos' },
    { v:'less-time', icon:'⏱', en:'less time', es:'menos tiempo' },
    { v:'bigger', icon:'🗺', en:'harder levels', es:'niveles más difíciles' }
  ];
  const MIX_A = ['Pac-Man', 'Frogger', 'Space Invaders', 'Breakout', 'Asteroids', 'Pong', 'Snake', 'Tetris'];
  const MIX_B = [
    { en:'outer space', es:'el espacio' }, { en:'a bakery', es:'una panadería' }, { en:'the ocean', es:'el océano' },
    { en:'a jungle', es:'una selva' }, { en:'a school', es:'una escuela' }, { en:'a candy land', es:'un mundo de dulces' },
    { en:'a haunted house', es:'una casa embrujada' }, { en:'a city at night', es:'una ciudad de noche' },
    { en:'a pizza shop', es:'una pizzería' }, { en:'a farm', es:'una granja' }
  ];

  const STEPS = [
    { id:'welcome', icon:'👋', min:2,
      title:{ en:'You are a game designer!', es:'¡Eres diseñador de juegos!' },
      learn:{ word:{ en:'Game designer', es:'Diseñador de juegos' },
              means:{ en:'A person who plans how a game works, before anyone codes it.', es:'Una persona que planea cómo funciona un juego, antes de programarlo.' } },
      rules:true,
      qs:[
        { k:'q_small', type:'quiz', q:{ en:'Which game is small enough to build?', es:'¿Qué juego es lo bastante pequeño para hacer?' }, a:1, o:[
          { en:'A big world with 50 levels', es:'Un mundo grande con 50 niveles' },
          { en:'A cat catches fish on one screen', es:'Un gato atrapa peces en una pantalla' },
          { en:'A city with 10 players', es:'Una ciudad con 10 jugadores' } ],
          why:{ en:'Yes! 1 player, 1 screen, 1 goal.', es:'¡Sí! 1 jugador, 1 pantalla, 1 meta.' } }
      ] },

    { id:'research', icon:'🔍', min:8,
      title:{ en:'Research', es:'Investiga' },
      learn:{ word:{ en:'Research', es:'Investigar' },
              means:{ en:'Look at other games to learn ideas.', es:'Mirar otros juegos para aprender ideas.' } },
      qs:[
        { k:'research', type:'research', req:true, q:{ en:'Play 2 games. Be a detective!', es:'Juega 2 juegos. ¡Sé detective!' } },
        { k:'liked', type:'long', req:true, q:{ en:'What did you like in those games?', es:'¿Qué te gustó de esos juegos?' },
          ph:{ en:'I liked…', es:'Me gustó…' } },
        { k:'like_mine', type:'chips', q:{ en:'Which one is most like your game?', es:'¿Cuál se parece más a tu juego?' },
          o: RESEARCH.map(g => ({ v:g.id, icon:g.icon, en:g.name, es:g.name })).concat([{ v:'none', icon:'✨', en:'None of them', es:'Ninguno' }]) }
      ] },

    { id:'idea', icon:'💡', min:6,
      title:{ en:'The big idea', es:'La gran idea' },
      learn:{ word:{ en:'Pitch', es:'Presentación' },
              means:{ en:'One sentence that tells your whole game idea.', es:'Una oración que cuenta toda la idea de tu juego.' } },
      example:{ en:'In my game, you are a hungry yellow circle and you must eat every dot while ghosts chase you.',
                es:'En mi juego, eres un círculo amarillo con hambre y debes comer todos los puntos mientras los fantasmas te persiguen.' },
      qs:[
        { k:'type', type:'chips', req:true, q:{ en:'What kind of game?', es:'¿Qué tipo de juego?' }, o:TYPES },
        { k:'mix', type:'mixer', q:{ en:'Need an idea? Mix two things!', es:'¿Necesitas una idea? ¡Mezcla dos cosas!' } },
        { k:'title', type:'text', req:true, q:{ en:'Game title', es:'Título del juego' }, ph:{ en:'Space Cats', es:'Gatos del espacio' } },
        { k:'idea', type:'long', req:true, q:{ en:'What happens? Where is it?', es:'¿Qué pasa? ¿Dónde es?' },
          ph:{ en:'My game is in… The player…', es:'Mi juego es en… El jugador…' } },
        { k:'pitch', type:'pitch', req:true, q:{ en:'Pitch it in one sentence', es:'Preséntalo en una oración' } },
        { k:'approved', type:'approve', q:{ en:'Teacher check: is it small enough?', es:'Revisión del maestro: ¿es lo bastante pequeño?' } }
      ] },

    { id:'player', icon:'🕹', min:5,
      title:{ en:'Player', es:'Jugador' },
      learn:{ word:{ en:'Input', es:'Entrada' },
              means:{ en:'What you press. The computer listens and does something.', es:'Lo que presionas. La computadora escucha y hace algo.' } },
      example:{ en:'Pac-Man is a yellow circle with a mouth. The arrow keys move him up, down, left and right.',
                es:'Pac-Man es un círculo amarillo con boca. Las flechas lo mueven arriba, abajo, izquierda y derecha.' },
      qs:[
        { k:'player', type:'text', req:true, q:{ en:'Who is your player?', es:'¿Quién es tu jugador?' }, ph:{ en:'a brave cat', es:'un gato valiente' } },
        { k:'player_look', type:'text', q:{ en:'What does it look like?', es:'¿Cómo se ve?' }, ph:{ en:'orange, small, round ears', es:'naranja, pequeño, orejas redondas' } },
        { k:'keys', type:'keys', req:true, q:{ en:'Which key does what?', es:'¿Qué hace cada tecla?' } },
        { k:'sk_player', type:'sketch', w:240, h:240, q:{ en:'Draw your player', es:'Dibuja a tu jugador' } }
      ] },

    { id:'goal', icon:'🎯', min:4,
      title:{ en:'Goal', es:'Meta' },
      learn:{ word:{ en:'Goal', es:'Meta' },
              means:{ en:'What the player is trying to do.', es:'Lo que el jugador trata de hacer.' } },
      example:{ en:'Eat every dot in the maze. Bonus: eat fruit for extra points.', es:'Come todos los puntos del laberinto. Extra: come fruta para más puntos.' },
      qs:[
        { k:'goal', type:'text', req:true, q:{ en:'Your goal in ONE sentence', es:'Tu meta en UNA oración' }, ph:{ en:'Catch 20 fish.', es:'Atrapa 20 peces.' } },
        { k:'bonus', type:'text', q:{ en:'Bonus goal (if you want)', es:'Meta extra (si quieres)' }, ph:{ en:'Gold fish = 5 points', es:'Pez dorado = 5 puntos' } },
        { k:'goal_show', type:'text', q:{ en:'How will a new player know the goal?', es:'¿Cómo sabrá la meta un jugador nuevo?' }, ph:{ en:'The screen says "Catch 20 fish!"', es:'La pantalla dice "¡Atrapa 20 peces!"' } },
        { k:'goal_fun', type:'text', q:{ en:'Why is it fun?', es:'¿Por qué es divertido?' } }
      ] },

    { id:'mechanics', icon:'⚙️', min:4,
      title:{ en:'Mechanics', es:'Mecánicas' },
      learn:{ word:{ en:'Mechanic', es:'Mecánica' },
              means:{ en:'An action the player can do, like jump or shoot.', es:'Una acción que el jugador puede hacer, como saltar o disparar.' } },
      example:{ en:'Move: steer in the maze. Collect: eat dots. Escape: run from ghosts.', es:'Moverse: avanzar en el laberinto. Recoger: comer puntos. Escapar: huir de los fantasmas.' },
      qs:[
        { k:'q_mech', type:'quiz', q:{ en:'Which one is a mechanic?', es:'¿Cuál es una mecánica?' }, a:0, o:[
          { en:'Jump', es:'Saltar' }, { en:'The color blue', es:'El color azul' }, { en:'The game title', es:'El título del juego' } ],
          why:{ en:'Yes! Jump is something the player DOES.', es:'¡Sí! Saltar es algo que el jugador HACE.' } },
        { k:'mechanics', type:'multi', max:3, req:true, min_n:2, q:{ en:'Pick 2 or 3', es:'Elige 2 o 3' }, o:MECHANICS },
        { k:'mech_how', type:'long', req:true, q:{ en:'How does each one work in your game?', es:'¿Cómo funciona cada una en tu juego?' },
          ph:{ en:'Move: arrow keys. Collect: touch a fish.', es:'Moverse: flechas. Recoger: tocar un pez.' } }
      ] },

    { id:'loop', icon:'🔁', min:4,
      title:{ en:'Core loop', es:'Ciclo principal' },
      learn:{ word:{ en:'Loop', es:'Bucle' },
              means:{ en:'Something that happens again and again.', es:'Algo que pasa una y otra vez.' } },
      example:{ en:'Move → eat dots → dodge ghosts. Repeat until the dots are gone.', es:'Moverse → comer puntos → esquivar fantasmas. Repetir hasta que no haya puntos.' },
      qs:[
        { k:'q_loop', type:'quiz', q:{ en:'Which one is a loop?', es:'¿Cuál es un bucle?' }, a:0, o:[
          { en:'Brush your teeth every morning', es:'Cepillarte los dientes cada mañana' },
          { en:'Open a door one time', es:'Abrir una puerta una vez' },
          { en:'Eat one apple', es:'Comer una manzana' } ],
          why:{ en:'Yes! Every morning = again and again.', es:'¡Sí! Cada mañana = una y otra vez.' } },
        { k:'loop', type:'loop', req:true, q:{ en:'Your 3 steps', es:'Tus 3 pasos' } },
        { k:'loop_why', type:'text', q:{ en:'Why will players want to do it again?', es:'¿Por qué querrán hacerlo otra vez?' } }
      ] },

    { id:'rules', icon:'📏', min:5,
      title:{ en:'Rules: IF / THEN', es:'Reglas: SI / ENTONCES' },
      learn:{ word:{ en:'Conditional', es:'Condicional' },
              means:{ en:'The computer checks IF something is true, THEN it does something.', es:'La computadora revisa SI algo es cierto, ENTONCES hace algo.' } },
      example:{ en:'IF Pac-Man touches a ghost, THEN he loses a life.', es:'SI Pac-Man toca un fantasma, ENTONCES pierde una vida.' },
      qs:[
        { k:'q_if', type:'quiz', q:{ en:'IF it rains, THEN…', es:'SI llueve, ENTONCES…' }, a:1, o:[
          { en:'it is Monday', es:'es lunes' }, { en:'open an umbrella', es:'abre un paraguas' }, { en:'it rains', es:'llueve' } ],
          why:{ en:'Yes! The THEN part is what you DO.', es:'¡Sí! El ENTONCES es lo que HACES.' } },
        { k:'rules', type:'ifthen', req:true, min_n:3, q:{ en:'Write 3 rules', es:'Escribe 3 reglas' } },
        { k:'not_allowed', type:'text', q:{ en:'What can the player NOT do?', es:'¿Qué NO puede hacer el jugador?' }, ph:{ en:'Go through walls', es:'Pasar por las paredes' } }
      ] },

    { id:'challenge', icon:'👾', min:5,
      title:{ en:'Challenge', es:'Reto' },
      learn:{ word:{ en:'Difficulty', es:'Dificultad' },
              means:{ en:'How hard the game is. Good games get harder little by little.', es:'Qué tan difícil es el juego. Los buenos juegos se ponen difíciles poco a poco.' } },
      example:{ en:'4 ghosts chase you. Each level, the ghosts get faster.', es:'4 fantasmas te persiguen. En cada nivel, van más rápido.' },
      qs:[
        { k:'enemy', type:'text', req:true, q:{ en:'What enemy or obstacle?', es:'¿Qué enemigo u obstáculo?' }, ph:{ en:'sharks', es:'tiburones' } },
        { k:'enemy_moves', type:'multi', max:3, req:true, q:{ en:'How does it move?', es:'¿Cómo se mueve?' }, o:MOVES },
        { k:'harder', type:'multi', max:4, q:{ en:'How does it get harder?', es:'¿Cómo se pone más difícil?' }, o:HARDER },
        { k:'sk_enemy', type:'sketch', w:240, h:240, q:{ en:'Draw your enemy', es:'Dibuja a tu enemigo' } }
      ] },

    { id:'winlose', icon:'🏁', min:4,
      title:{ en:'Win & lose', es:'Ganar y perder' },
      learn:{ word:{ en:'End condition', es:'Condición de fin' },
              means:{ en:'The check that ends the game.', es:'La revisión que termina el juego.' } },
      example:{ en:'Win: no dots left. Lose: no lives left. In code: if lives = 0 → game over.', es:'Ganas: no quedan puntos. Pierdes: no quedan vidas. En código: si vidas = 0 → fin del juego.' },
      qs:[
        { k:'q_end', type:'quiz', q:{ en:'In Pac-Man, IF lives = 0, THEN…', es:'En Pac-Man, SI vidas = 0, ENTONCES…' }, a:2, o:[
          { en:'next level', es:'siguiente nivel' }, { en:'eat a dot', es:'come un punto' }, { en:'game over', es:'fin del juego' } ],
          why:{ en:'Yes! No lives = game over.', es:'¡Sí! Sin vidas = fin del juego.' } },
        { k:'win', type:'text', req:true, q:{ en:'You WIN when…', es:'GANAS cuando…' }, ph:{ en:'you catch 20 fish', es:'atrapas 20 peces' } },
        { k:'lose', type:'text', req:true, q:{ en:'You LOSE when…', es:'PIERDES cuando…' }, ph:{ en:'a shark touches you 3 times', es:'un tiburón te toca 3 veces' } },
        { k:'end_screens', type:'text', q:{ en:'What shows on the screen when you win or lose?', es:'¿Qué sale en la pantalla al ganar o perder?' }, ph:{ en:'"YOU WIN!" and fireworks', es:'"¡GANASTE!" y fuegos artificiales' } },
        { k:'end_code', type:'text', req:true, code:true, q:{ en:'Write it like code: if ___ → game over', es:'Escríbelo como código: si ___ → fin del juego' }, ph:{ en:'lives = 0', es:'vidas = 0' } }
      ] },

    { id:'feedback', icon:'⭐', min:3,
      title:{ en:'Feedback', es:'Retroalimentación' },
      learn:{ word:{ en:'Variable', es:'Variable' },
              means:{ en:'A box that remembers a number, like your score.', es:'Una caja que recuerda un número, como tus puntos.' } },
      example:{ en:'Score and lives on the screen, a "waka waka" sound, and a high score to beat.', es:'Puntos y vidas en la pantalla, un sonido "waka waka" y un récord que superar.' },
      qs:[
        { k:'q_var', type:'quiz', q:{ en:'A variable is like…', es:'Una variable es como…' }, a:0, o:[
          { en:'a box that holds a number', es:'una caja que guarda un número' }, { en:'a picture', es:'un dibujo' }, { en:'a key on the keyboard', es:'una tecla' } ],
          why:{ en:'Yes! Score is a variable.', es:'¡Sí! Los puntos son una variable.' } },
        { k:'hud', type:'multi', max:6, req:true, q:{ en:'What will the player see?', es:'¿Qué verá el jugador?' }, o:HUD },
        { k:'sounds', type:'text', q:{ en:'Sounds: good thing? bad thing?', es:'Sonidos: ¿algo bueno? ¿algo malo?' }, ph:{ en:'pop for a fish, boom for a shark', es:'pop por un pez, bum por un tiburón' } },
        { k:'rewards', type:'text', q:{ en:'What makes them keep playing?', es:'¿Qué los hace seguir jugando?' }, ph:{ en:'beat the high score', es:'superar el récord' } }
      ] },

    { id:'balance', icon:'⚖️', min:3,
      title:{ en:'Balance', es:'Equilibrio' },
      learn:{ word:{ en:'Balance', es:'Equilibrio' },
              means:{ en:'Not too easy. Not too hard. Just right!', es:'Ni muy fácil. Ni muy difícil. ¡Justo bien!' } },
      example:{ en:'The power pellet lets you chase ghosts, but there are only 4, so it is not too easy.', es:'La píldora de poder te deja perseguir fantasmas, pero solo hay 4, así que no es muy fácil.' },
      qs:[
        { k:'helper', type:'text', q:{ en:'What helps the player?', es:'¿Qué ayuda al jugador?' }, ph:{ en:'a shield for 5 seconds', es:'un escudo por 5 segundos' } },
        { k:'not_easy', type:'text', q:{ en:'Why is it NOT too easy?', es:'¿Por qué NO es muy fácil?' } },
        { k:'not_hard', type:'text', q:{ en:'Why is it NOT too hard?', es:'¿Por qué NO es muy difícil?' } },
        { k:'skill', type:'chips', req:true, q:{ en:'My game is mostly…', es:'Mi juego es más que nada…' }, o:[
          { v:'luck', icon:'🎲', en:'luck', es:'suerte' }, { v:'skill', icon:'🧠', en:'skill', es:'habilidad' }, { v:'speed', icon:'⚡', en:'speed', es:'rapidez' } ] }
      ] },

    { id:'code', icon:'🧠', min:5,
      title:{ en:'Code plan', es:'Plan de código' },
      learn:{ word:{ en:'Algorithm', es:'Algoritmo' },
              means:{ en:'Steps the computer follows, in order.', es:'Pasos que sigue la computadora, en orden.' } },
      example:{ en:'Variables: score, lives. Loop: repeat until dots = 0. If: touching ghost → lose a life. Input: arrow keys.',
                es:'Variables: puntos, vidas. Bucle: repetir hasta puntos = 0. Si: toca un fantasma → pierde una vida. Entrada: flechas.' },
      qs:[
        { k:'codeplan', type:'codeplan', req:true, q:{ en:'What will the computer need?', es:'¿Qué necesitará la computadora?' } }
      ] },

    { id:'sketch', icon:'🖼', min:5,
      title:{ en:'Sketch your screen', es:'Dibuja tu pantalla' },
      learn:{ word:{ en:'Prototype', es:'Prototipo' },
              means:{ en:'A quick drawing or model to test an idea.', es:'Un dibujo o modelo rápido para probar una idea.' } },
      qs:[
        { k:'sk_screen', type:'sketch', w:480, h:360, req:true, labels:true,
          q:{ en:'Draw one moment of your game. Add labels!', es:'Dibuja un momento de tu juego. ¡Pon etiquetas!' } }
      ] },

    { id:'finish', icon:'🎉', min:2,
      title:{ en:'Check and build!', es:'¡Revisa y construye!' },
      learn:{ word:{ en:'Iterate', es:'Iterar' },
              means:{ en:'Build, test, fix, and try again.', es:'Construir, probar, arreglar y probar otra vez.' } },
      qs:[ { k:'checklist', type:'checklist', q:{ en:'Before you build, check:', es:'Antes de construir, revisa:' } } ] }
  ];

  return { STEPS, RESEARCH, TYPES, MECHANICS, KEYS, HUD, MOVES, HARDER, MIX_A, MIX_B, ARCADE };
})();
