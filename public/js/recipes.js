/* =====================================================================
   RECIPES — the Block Helper's answers, written out ahead of time.

   Each recipe is one thing a student wants their game to do ("make my
   sprite jump"), in three steps, as the helper gives it:
     hint   a nudge: what the idea is and where to look
     steps  the actual blocks, sprite by sprite (drawn by EDITOR.view)
     why    a sentence or two on how it works and what to change

   Recipes are tagged with game FEATURES (the boxes a student ticks in
   "Tell me about your game"), so a game that mixes Dino Run with Space
   Invaders gets the jump AND the shooting recipes first.

   ROLES. A recipe talks about the sprites by their job — {player},
   {obstacle}, {enemy}… The helper swaps in the student's own sprite
   names (see HELPER.roleName), so the blocks say "touching Cactus?".
   {sound} becomes that sprite's first sound.

   Text is [English, Español]. Block words stay English: they are the code.
   ===================================================================== */
window.RECIPES = (function(){

  /* ------------------------------------------------------ block builders
     k(op, slots, body, body2): a value that is a block goes in the slot as
     a reporter; anything else is typed into the slot. */
  function k(op, slots, body, body2){
    const b = PROJECT.block(op);
    for(const [n, v] of Object.entries(slots || {})){
      if(v && typeof v === 'object') b.inputs[n] = v; else b.args[n] = v;
    }
    if(body) b.body = body;
    if(body2) b.body2 = body2;
    return b;
  }
  const flag = () => k('event_whenflagclicked');
  const onKey = key => k('event_whenkeypressed', { KEY_OPTION:key });
  const asClone = () => k('control_start_as_clone');
  const onMsg = m => k('event_whenbroadcastreceived', { BROADCAST_OPTION:m });
  const forever = (...b) => k('control_forever', {}, b);
  const repeat = (n, ...b) => k('control_repeat', { TIMES:n }, b);
  const until = (c, ...b) => k('control_repeat_until', { CONDITION:c }, b);
  const IF = (c, ...b) => k('control_if', { CONDITION:c }, b);
  const waitUntil = c => k('control_wait_until', { CONDITION:c });
  const wait = n => k('control_wait', { DURATION:n });
  const stopAll = () => k('control_stop', { STOP_OPTION:'all' });
  const cloneOf = o => k('control_create_clone_of', { CLONE_OPTION:o });
  const delClone = () => k('control_delete_this_clone');
  const touching = o => k('sensing_touchingobject', { TOUCHINGOBJECTMENU:o });
  const touchColor = c => k('sensing_touchingcolor', { COLOR:c });
  const keyDown = key => k('sensing_keypressed', { KEY_OPTION:key });
  const mouseX = () => k('sensing_mousex');
  const changeX = n => k('motion_changexby', { DX:n });
  const changeY = n => k('motion_changeyby', { DY:n });
  const setX = n => k('motion_setx', { X:n });
  const setY = n => k('motion_sety', { Y:n });
  const gotoXY = (x, y) => k('motion_gotoxy', { X:x, Y:y });
  const goTo = o => k('motion_goto', { TO:o });
  const move = n => k('motion_movesteps', { STEPS:n });
  const pointTo = o => k('motion_pointtowards', { TOWARDS:o });
  const point = d => k('motion_pointindirection', { DIRECTION:d });
  const bounce = () => k('motion_ifonedgebounce');
  const rotStyle = s => k('motion_setrotationstyle', { STYLE:s });
  const xpos = () => k('motion_xposition'), ypos = () => k('motion_yposition'), dir = () => k('motion_direction');
  const say = (m, s) => s == null ? k('looks_say', { MESSAGE:m }) : k('looks_sayforsecs', { MESSAGE:m, SECS:s });
  const show = () => k('looks_show'), hide = () => k('looks_hide');
  const front = () => k('looks_gotofrontback', { FRONT_BACK:'front' });
  const nextCostume = () => k('looks_nextcostume');
  const sound = () => k('sound_play', { SOUND_MENU:'{sound}' });
  const soundAll = () => k('sound_playuntildone', { SOUND_MENU:'{sound}' });
  const send = m => k('event_broadcast', { BROADCAST_INPUT:m });
  const setVar = (v, n) => k('data_setvariableto', { VARIABLE:v, VALUE:n });
  const changeVar = (v, n) => k('data_changevariableby', { VARIABLE:v, VALUE:n });
  const V = v => k('data_variable', { VARIABLE:v });
  const lt = (a, b) => k('operator_lt', { OPERAND1:a, OPERAND2:b });
  const gt = (a, b) => k('operator_gt', { OPERAND1:a, OPERAND2:b });
  const eq = (a, b) => k('operator_equals', { OPERAND1:a, OPERAND2:b });
  const or = (a, b) => k('operator_or', { OPERAND1:a, OPERAND2:b });
  const sub = (a, b) => k('operator_subtract', { NUM1:a, NUM2:b });
  const rnd = (a, b) => k('operator_random', { FROM:a, TO:b });
  const GROUND = '#22c55e', WALL = '#3b82f6';

  /* ------------------------------------------- what a game can have in it
     The boxes on "Tell me about your game". */
  const FEATURES = [
    ['arrows', '⬅️', 'Moving with arrow keys', 'Moverse con las flechas'],
    ['jump', '🦘', 'Jumping', 'Saltar'],
    ['gravity', '🪂', 'Gravity / platforms', 'Gravedad / plataformas'],
    ['mouse', '🖱', 'Follows the mouse', 'Sigue al ratón'],
    ['walls', '🧱', 'Walls / maze', 'Paredes / laberinto'],
    ['obstacles', '🌵', 'Obstacles', 'Obstáculos'],
    ['enemies', '👾', 'Enemies that chase', 'Enemigos que persiguen'],
    ['shooting', '🔫', 'Shooting', 'Disparar'],
    ['collect', '🪙', 'Collecting things', 'Recoger cosas'],
    ['falling', '🍎', 'Things falling from the sky', 'Cosas que caen del cielo'],
    ['bounce', '🏓', 'A bouncing ball', 'Una pelota que rebota'],
    ['score', '💯', 'Score / points', 'Puntos'],
    ['lives', '❤️', 'Lives / health', 'Vidas / salud'],
    ['timer', '⏱', 'Timer', 'Temporizador'],
    ['levels', '📈', 'Levels / getting faster', 'Niveles / más rápido'],
    ['twoplayer', '👥', '2 players', '2 jugadores'],
    ['gameover', '💀', 'Game over screen', 'Pantalla de fin del juego'],
    ['sounds', '🎵', 'Sounds & music', 'Sonidos y música'],
    ['animation', '🚶', 'Walking animation', 'Animación al caminar']
  ];
  /* "Inspired by…" (any number of them: most games mix a few) */
  const GAMES = [
    ['dino', '🦖', 'Dino Run'], ['pong', '🏓', 'Pong'], ['snake', '🐍', 'Snake'], ['breakout', '🧱', 'Breakout'],
    ['invaders', '👾', 'Space Invaders'], ['tetris', '🟪', 'Tetris'], ['frogger', '🐸', 'Frogger'], ['pacman', '🟡', 'Pac-Man'],
    ['asteroids', '☄️', 'Asteroids'], ['galaga', '🚀', 'Galaga'], ['centipede', '🐛', 'Centipede'], ['own', '💡', 'My own idea', 'Mi propia idea']
  ];

  /* the jobs sprites do in recipes, and names that usually mean that job */
  const ROLES = {
    player:   { label:['your player', 'tu jugador'], fallback:'Player',
                guess:/player|hero|dino|cat|frog|ship|cannon|fighter|pac|snake|shooter|runner|jugador|heroe|gato|rana|nave/ },
    player2:  { label:['player 2', 'el jugador 2'], fallback:'Player 2', guess:/player ?2|p2|jugador ?2/ },
    danger:   { label:['the thing that hurts you', 'lo que te hace daño'], fallback:'Obstacle',
                guess:/cactus|rock|obstacle|spike|pipe|car|enemy|alien|ghost|zombie|monster|bomb|asteroid|bird|lava|roca|cacto|obstaculo|enemigo|fantasma|monstruo|bomba|pajaro/ },
    obstacle: { label:['your obstacle', 'tu obstáculo'], fallback:'Obstacle',
                guess:/cactus|rock|obstacle|spike|pipe|car|log|bird|roca|cacto|obstaculo|tubo|carro|coche|pajaro|tronco/ },
    enemy:    { label:['your enemy', 'tu enemigo'], fallback:'Enemy',
                guess:/enemy|alien|ghost|zombie|monster|ufo|spider|bug|invader|asteroid|centipede|enemigo|fantasma|monstruo|arana|bicho/ },
    bullet:   { label:['your bullet / laser', 'tu bala / láser'], fallback:'Laser',
                guess:/bullet|laser|shot|dart|fire|missile|arrow|bala|disparo|flecha|misil/ },
    item:     { label:['the thing to collect', 'lo que se recoge'], fallback:'Coin',
                guess:/coin|apple|star|food|fruit|gem|dot|cookie|moneda|manzana|estrella|comida|fruta|galleta|punto/ },
    ball:     { label:['your ball', 'tu pelota'], fallback:'Ball', guess:/ball|pelota|bola/ },
    paddle:   { label:['your paddle', 'tu paleta'], fallback:'Paddle', guess:/paddle|paleta|raqueta|bat/ },
    gameover: { label:['your Game Over sign', 'tu letrero de Game Over'], fallback:'Game Over', guess:/game ?over|fin|the end/ }
  };

  /* ------------------------------------------------------------ recipes
     in: which sprite the blocks go in (a role, or 'stage').
     words: what a student might type, both languages, no accents needed. */
  const LIST = [
  { id:'arrows', group:'move', tags:['arrows', 'walls', 'twoplayer'], like:['pacman', 'frogger', 'snake'],
    title:['Move with the arrow keys', 'Moverse con las flechas'],
    ask:['How do I move {player} with the arrow keys?', '¿Cómo muevo a {player} con las flechas?'],
    words:'move moving walk walking run arrow arrows key keys left right up down control controls mover moverse camina caminar correr flecha flechas tecla teclas izquierda derecha arriba abajo controlar',
    hint:['Over and over, check each arrow key. If it is pressed, change x (left and right) or y (up and down). The block that asks “is this key pressed?” is in Sensing.',
          'Una y otra vez, revisa cada flecha. Si está presionada, cambia x (izquierda y derecha) o y (arriba y abajo). El bloque que pregunta “¿está presionada esta tecla?” está en Sensores.'],
    steps:[{ in:'player', script:() => [flag(), forever(
      IF(keyDown('right arrow'), changeX(5)), IF(keyDown('left arrow'), changeX(-5)),
      IF(keyDown('up arrow'), changeY(5)), IF(keyDown('down arrow'), changeY(-5)))] }],
    why:['The forever loop checks the keys about 30 times a second, so holding a key keeps the sprite moving. A bigger number moves faster. Only want left and right? Leave out the up and down ifs.',
         'El bucle forever revisa las teclas unas 30 veces por segundo, así que al mantener una tecla el objeto sigue moviéndose. Un número más grande va más rápido. ¿Solo quieres izquierda y derecha? Quita los if de arriba y abajo.'],
    also:['walls', 'wrap', 'animate'] },

  { id:'jump', group:'move', tags:['jump'], like:['dino'],
    title:['Jump', 'Saltar'],
    ask:['How do I make {player} jump?', '¿Cómo hago que {player} salte?'],
    words:'jump jumps jumping jumped hop leap space spacebar fly up salta saltar salto brinca brincar brinco espacio',
    hint:['A jump is two parts: go up a little many times, then come down the same amount. Which block repeats something a number of times? Look in Control.',
          'Un salto tiene dos partes: subir un poco muchas veces y luego bajar lo mismo. ¿Qué bloque repite algo varias veces? Busca en Control.'],
    steps:[{ in:'player', script:() => [onKey('space'), repeat(10, changeY(12)), repeat(10, changeY(-12))] }],
    why:['Up 12 ten times, then down 12 ten times, so it lands right where it started. Bigger numbers jump higher. For a jump that slows down at the top like a real one, try “Gravity and platforms”.',
         'Sube 12 diez veces y baja 12 diez veces, así que cae justo donde empezó. Números más grandes saltan más alto. Para un salto que se frena arriba como uno de verdad, prueba “Gravedad y plataformas”.'],
    also:['gravity', 'scroll'] },

  { id:'gravity', group:'move', tags:['gravity', 'jump'], like:['dino'],
    title:['Gravity and platforms', 'Gravedad y plataformas'],
    ask:['How do I make {player} fall and land on platforms?', '¿Cómo hago que {player} caiga y aterrice en plataformas?'],
    words:'gravity fall falling falls land landing platform platforms ground floor stand physics realistic jump gravedad cae caer caida aterriza aterrizar plataforma plataformas suelo piso fisica',
    hint:['Use a variable for how fast the sprite is moving up or down. Gravity takes a little away from it every moment. When the sprite touches the ground colour, stop it falling.',
          'Usa una variable para la velocidad hacia arriba o abajo. La gravedad le quita un poco en cada momento. Cuando el objeto toca el color del suelo, deja de caer.'],
    steps:[{ in:'player', say:['First make a variable called y speed (Variables → Make a Variable). Paint your ground and platforms in one colour, like green.',
                              'Primero crea una variable llamada y speed (Variables → Crear una variable). Pinta el suelo y las plataformas de un solo color, como verde.'],
      script:() => [flag(), setVar('y speed', 0), forever(
        changeVar('y speed', -1),
        changeY(V('y speed')),
        IF(touchColor(GROUND), changeY(sub(0, V('y speed'))), setVar('y speed', 0),
          IF(keyDown('up arrow'), setVar('y speed', 14))))] }],
    why:['y speed above 0 goes up, below 0 goes down. Every moment gravity takes 1 away, so you fall faster and faster. Touching the ground steps you back out and stops you. Jumping just sets y speed to 14. Click the colour in “touching color”, then use the dropper to pick your ground’s colour.',
         'y speed mayor que 0 sube, menor que 0 baja. En cada momento la gravedad le quita 1, así que caes cada vez más rápido. Al tocar el suelo vuelves a salir y te detienes. Saltar solo pone y speed en 14. Haz clic en el color de “touching color” y usa el gotero para elegir el color de tu suelo.'],
    also:['arrows', 'jump'] },

  { id:'scroll', group:'danger', tags:['obstacles'], like:['dino', 'frogger'],
    title:['An obstacle that comes at you', 'Un obstáculo que viene hacia ti'],
    ask:['How do I make {obstacle} move across the screen and come back?', '¿Cómo hago que {obstacle} cruce la pantalla y vuelva?'],
    words:'obstacle obstacles cactus come coming across slide slides scroll scrolling moving toward again repeat loop back side edge cars rock obstaculo obstaculos cacto viene cruza cruzar desliza otra vez vuelve regresa lado borde carros roca',
    hint:['Keep moving the obstacle to the left. When it gets to the left edge (x is about -240), put it back on the right side.',
          'Mueve el obstáculo a la izquierda sin parar. Cuando llegue al borde izquierdo (x es más o menos -240), ponlo otra vez en el lado derecho.'],
    steps:[{ in:'obstacle', script:() => [flag(), gotoXY(240, -100), forever(changeX(-8), IF(lt(xpos(), -235), setX(240)))] }],
    why:['change x by -8 moves it left a bit every moment. “if x position < -235” notices when it has gone off the left side, and set x to 240 sends it back to the right. Change -8 for speed, and -100 so it is at the same height as your player.',
         'change x by -8 lo mueve un poco a la izquierda en cada momento. “if x position < -235” nota cuando salió por la izquierda, y set x to 240 lo manda otra vez a la derecha. Cambia -8 para la velocidad y -100 para que esté a la altura de tu jugador.'],
    also:['lose', 'speedup', 'falling'] },

  { id:'lose', group:'danger', tags:['obstacles', 'enemies', 'gameover'], like:['dino', 'frogger', 'asteroids'],
    title:['Game over when you touch something', 'Fin del juego al tocar algo'],
    ask:['How do I make the game end when {player} touches {danger}?', '¿Cómo hago que el juego termine cuando {player} toque {danger}?'],
    words:'touch touches touching hit hits crash collide collision die dies dead death lose lost end game over stop gameover toca tocar choca chocar golpea muere morir pierde perder termina fin juego',
    hint:['Wait until your player is touching the dangerous sprite, then stop everything. The “touching ?” block is in Sensing.',
          'Espera hasta que tu jugador toque al objeto peligroso y luego detén todo. El bloque “touching ?” está en Sensores.'],
    steps:[{ in:'player', script:() => [flag(), waitUntil(touching('{danger}')), say('Game over!', 2), stopAll()] }],
    why:['“wait until” sits and waits until the touching block is true. Then the sprite says Game over! and “stop all” stops the whole game. Want lives instead of losing straight away? Try “Lives”.',
         '“wait until” se queda esperando hasta que el bloque touching sea verdadero. Entonces el objeto dice Game over! y “stop all” detiene todo el juego. ¿Quieres vidas en lugar de perder enseguida? Prueba “Vidas”.'],
    also:['lives', 'gameover'] },

  { id:'lives', group:'score', tags:['lives'], like:['invaders', 'pacman', 'frogger'],
    title:['Lives', 'Vidas'],
    ask:['How do I give {player} 3 lives?', '¿Cómo le doy 3 vidas a {player}?'],
    words:'lives life health hearts heart hp lose die damage hurt three 3 vidas vida salud corazones corazon dano pierde tres',
    hint:['Make a variable for lives. Start it at 3, take 1 away every time you get hit, and end the game when it reaches 0.',
          'Crea una variable para las vidas. Empieza en 3, quita 1 cada vez que te golpean y termina el juego cuando llegue a 0.'],
    steps:[{ in:'player', say:['Make a variable called lives (Variables → Make a Variable, For all sprites). Keep its box ticked to show it on the stage.',
                              'Crea una variable llamada lives (Variables → Crear una variable, Para todos los objetos). Deja su casilla marcada para verla en el escenario.'],
      script:() => [flag(), setVar('lives', 3), forever(
        IF(touching('{danger}'), changeVar('lives', -1), wait(1)),
        IF(eq(V('lives'), 0), say('Game over!', 2), stopAll()))] }],
    why:['Every time you touch the danger, lives goes down by 1. The wait 1 seconds gives you a second to get away, so one hit only takes one life. When lives is 0, the game ends.',
         'Cada vez que tocas el peligro, lives baja 1. El wait 1 seconds te da un segundo para escapar, así un golpe solo quita una vida. Cuando lives es 0, el juego termina.'],
    also:['lose', 'gameover'] },

  { id:'score', group:'score', tags:['score'], like:['dino'],
    title:['Score that goes up over time', 'Puntos que suben con el tiempo'],
    ask:['How do I make a score that goes up while I play?', '¿Cómo hago puntos que suban mientras juego?'],
    words:'score scores points point counter count keep track time survive distance meters puntos punto puntaje marcador contar contador tiempo sobrevivir distancia',
    hint:['A score is a variable. Set it to 0 when the game starts, then keep adding 1 to it.',
          'Los puntos son una variable. Ponla en 0 cuando empieza el juego y luego súmale 1 sin parar.'],
    steps:[{ in:'stage', say:['Make a variable called score (Variables → Make a Variable, For all sprites).', 'Crea una variable llamada score (Variables → Crear una variable, Para todos los objetos).'],
      script:() => [flag(), setVar('score', 0), forever(wait(0.1), changeVar('score', 1))] }],
    why:['Every tenth of a second the score goes up by 1, so the longer you survive, the higher it gets. It stops when “stop all” runs. Want points for catching or hitting things instead? Use “change score by 1” in that if.',
         'Cada décima de segundo los puntos suben 1, así que mientras más sobrevives, más alto. Se detiene cuando se ejecuta “stop all”. ¿Quieres puntos por atrapar o golpear cosas? Usa “change score by 1” dentro de ese if.'],
    also:['collect', 'speedup'] },

  { id:'collect', group:'score', tags:['collect', 'score'], like:['pacman', 'snake'],
    title:['Collect things for points', 'Recoger cosas para ganar puntos'],
    ask:['How do I get points when {player} touches {item}?', '¿Cómo gano puntos cuando {player} toca {item}?'],
    words:'collect collecting pick grab eat eats catch coin coins apple apples food star gem point points get recoger recoge agarrar agarra comer come atrapar moneda monedas manzana comida estrella gema puntos ganar',
    hint:['In the thing you collect: if it is touching the player, add 1 to score and move it somewhere new.',
          'En la cosa que recoges: si toca al jugador, suma 1 a score y muévela a otro lugar.'],
    steps:[{ in:'item', say:['Make a variable called score first (Variables → Make a Variable).', 'Primero crea una variable llamada score (Variables → Crear una variable).'],
      script:() => [flag(), setVar('score', 0), goTo('_random_'), forever(
        IF(touching('{player}'), changeVar('score', 1), sound(), goTo('_random_')))] }],
    why:['The forever loop keeps asking “am I touching the player?”. When it is, the score goes up, a sound plays, and it jumps to a random spot so you can collect it again.',
         'El bucle forever pregunta todo el tiempo “¿estoy tocando al jugador?”. Cuando sí, los puntos suben, suena un sonido y salta a un lugar al azar para recogerlo otra vez.'],
    also:['falling', 'score'] },

  { id:'falling', group:'danger', tags:['falling', 'collect', 'obstacles'], like:['dino', 'centipede'],
    title:['Lots of things falling from the sky', 'Muchas cosas cayendo del cielo'],
    ask:['How do I make lots of {item} fall from the sky?', '¿Cómo hago que caigan muchos {item} del cielo?'],
    words:'falling fall drop drops rain raining sky lots many copies copy clone clones spawn spawning random appear appears more cae caen caer caiga caigan caida lluvia llueve cielo muchos copias copia clon clones aparece aparecen azar aleatorio',
    hint:['Use clones: the sprite hides and keeps making copies of itself. Each copy starts at the top in a random spot, falls down, and deletes itself at the bottom.',
          'Usa clones: el objeto se esconde y hace copias de sí mismo sin parar. Cada copia empieza arriba en un lugar al azar, cae y se borra al llegar abajo.'],
    steps:[
      { in:'item', say:['The first script makes a new copy every 0.5 to 2 seconds:', 'El primer programa hace una copia nueva cada 0.5 a 2 segundos:'],
        script:() => [flag(), hide(), forever(cloneOf('_myself_'), wait(rnd(0.5, 2)))] },
      { in:'item', say:['The second script is what each copy does:', 'El segundo programa es lo que hace cada copia:'],
        script:() => [asClone(), gotoXY(rnd(-220, 220), 180), show(),
          until(lt(ypos(), -170), changeY(-5), IF(touching('{player}'), changeVar('score', 1), delClone())), delClone()] }],
    why:['“create clone of myself” makes a copy, and every copy runs “when I start as a clone”. The copy falls until it reaches the bottom (y is -180), then deletes itself. Catching it adds a point. If touching it should hurt instead, change the inside of the if to “change lives by -1”.',
         '“create clone of myself” hace una copia, y cada copia ejecuta “when I start as a clone”. La copia cae hasta llegar abajo (y es -180) y se borra. Atraparla suma un punto. Si tocarla debe hacer daño, cambia lo de adentro del if por “change lives by -1”.'],
    also:['collect', 'lives'] },

  { id:'shoot', group:'shoot', tags:['shooting'], like:['invaders', 'galaga', 'asteroids', 'centipede'],
    title:['Shoot', 'Disparar'],
    ask:['How do I make {player} shoot {bullet}?', '¿Cómo hago que {player} dispare {bullet}?'],
    words:'shoot shoots shooting shot fire fires firing bullet bullets laser lasers gun blast projectile attack missile dispara disparar disparo dispara bala balas laser pistola ataque atacar misil',
    hint:['Make a sprite for the laser. When you press space, the player makes a clone of the laser. Each clone starts at the player and flies up until it leaves the screen.',
          'Haz un objeto para el láser. Al presionar espacio, el jugador hace un clon del láser. Cada clon empieza en el jugador y vuela hacia arriba hasta salir de la pantalla.'],
    steps:[
      { in:'player', script:() => [onKey('space'), cloneOf('{bullet}')] },
      { in:'bullet', script:() => [flag(), hide()] },
      { in:'bullet', script:() => [asClone(), goTo('{player}'), show(), until(gt(ypos(), 175), changeY(10)), delClone()] }],
    why:['The real laser stays hidden. Every space press makes a copy, the copy jumps to the player, shows, and moves up 10 at a time until it reaches the top (y is 180), then deletes itself. Shooting sideways? Use change x by 10 and x position > 235.',
         'El láser original se queda escondido. Cada vez que presionas espacio se hace una copia, que salta al jugador, aparece y sube de 10 en 10 hasta llegar arriba (y es 180), y luego se borra. ¿Disparas de lado? Usa change x by 10 y x position > 235.'],
    also:['hit', 'chase'] },

  { id:'hit', group:'shoot', tags:['shooting', 'enemies', 'score'], like:['invaders', 'galaga', 'asteroids', 'centipede'],
    title:['Enemy gets hit by your laser', 'El enemigo recibe el disparo'],
    ask:['How do I make {enemy} get hit when my laser touches it?', '¿Cómo hago que {enemy} reciba el golpe cuando mi láser lo toca?'],
    words:'hit hits kill kills killed destroy destroys explode defeat die dies enemy enemies alien aliens shot shoot touch laser bullet golpe golpea matar mata destruir destruye explota vencer muere enemigo enemigos alien disparo bala',
    hint:['In the enemy: if it is touching the laser, add a point and send the enemy back to the top. Then make the laser disappear when it hits.',
          'En el enemigo: si toca el láser, suma un punto y manda al enemigo otra vez arriba. Luego haz que el láser desaparezca al golpear.'],
    steps:[
      { in:'enemy', script:() => [flag(), show(), forever(IF(touching('{bullet}'), changeVar('score', 1), sound(), gotoXY(rnd(-200, 200), 150)))] },
      { in:'bullet', say:['In your laser’s clone script, change the “repeat until” so it also stops when it hits the enemy:', 'En el programa del clon de tu láser, cambia el “repeat until” para que también pare al golpear al enemigo:'],
        script:() => [until(or(gt(ypos(), 175), touching('{enemy}')), changeY(10))] }],
    why:['The enemy keeps checking if a laser is touching it. When one is, you score, and the enemy reappears at a random spot at the top. The “or” lets the laser stop at the top OR when it hits, and then “delete this clone” removes it.',
         'El enemigo revisa todo el tiempo si un láser lo toca. Cuando sí, ganas puntos y el enemigo aparece en un lugar al azar arriba. El “or” hace que el láser pare arriba O cuando golpea, y luego “delete this clone” lo borra.'],
    also:['shoot', 'chase', 'score'] },

  { id:'chase', group:'danger', tags:['enemies'], like:['pacman', 'centipede'],
    title:['An enemy that chases you', 'Un enemigo que te persigue'],
    ask:['How do I make {enemy} chase {player}?', '¿Cómo hago que {enemy} persiga a {player}?'],
    words:'chase chases chasing follow follows following hunt hunts after toward towards come enemy ghost zombie monster persigue perseguir sigue seguir caza viene hacia enemigo fantasma zombi monstruo',
    hint:['Over and over: turn to face the player, then take a few steps. The block that turns to face another sprite is in Motion.',
          'Una y otra vez: voltea hacia el jugador y da unos pasos. El bloque que voltea hacia otro objeto está en Movimiento.'],
    steps:[{ in:'enemy', script:() => [flag(), gotoXY(200, 150), rotStyle('left-right'), forever(pointTo('{player}'), move(2))] }],
    why:['“point towards” turns the enemy to face the player, and “move 2 steps” walks that way, many times a second, so it follows wherever you go. Bigger steps make it faster. “left-right” keeps the picture from turning upside down.',
         '“point towards” voltea al enemigo hacia el jugador, y “move 2 steps” camina hacia allá, muchas veces por segundo, así te sigue a donde vayas. Pasos más grandes lo hacen más rápido. “left-right” evita que el dibujo quede de cabeza.'],
    also:['lose', 'lives'] },

  { id:'bounce', group:'ball', tags:['bounce'], like:['pong', 'breakout'],
    title:['A ball that bounces off a paddle', 'Una pelota que rebota en la paleta'],
    ask:['How do I make {ball} bounce off {paddle}?', '¿Cómo hago que {ball} rebote en {paddle}?'],
    words:'bounce bounces bouncing ball balls paddle paddles hit pong breakout wall edge reflect rebota rebotar rebote pelota bola paleta paletas golpea pared borde',
    hint:['Keep the ball moving forward and bouncing off the edges. When it touches the paddle, flip its direction.',
          'Mantén la pelota avanzando y rebotando en los bordes. Cuando toque la paleta, cambia su dirección.'],
    steps:[{ in:'ball', script:() => [flag(), gotoXY(0, 0), point(45), forever(move(6), bounce(),
      IF(touching('{paddle}'), point(sub(180, dir())), move(6)))] }],
    why:['“if on edge, bounce” handles the walls. 180 − direction turns a ball going down into a ball going up, for a paddle at the bottom (Breakout). For paddles on the sides (Pong), use 0 − direction instead. The extra move 6 gets the ball off the paddle so it does not stick.',
         '“if on edge, bounce” se encarga de las paredes. 180 − direction convierte una pelota que baja en una que sube, para una paleta abajo (Breakout). Para paletas a los lados (Pong), usa 0 − direction. El move 6 extra separa la pelota de la paleta para que no se pegue.'],
    also:['paddle', 'lives'] },

  { id:'paddle', group:'ball', tags:['mouse', 'bounce'], like:['pong', 'breakout'],
    title:['A paddle that follows the mouse', 'Una paleta que sigue al ratón'],
    ask:['How do I make {paddle} follow the mouse?', '¿Cómo hago que {paddle} siga al ratón?'],
    words:'mouse follow follows following cursor pointer paddle drag raton sigue seguir cursor puntero paleta arrastrar',
    hint:['Over and over, set the paddle’s x to the mouse’s x. “mouse x” is in Sensing.',
          'Una y otra vez, pon la x de la paleta igual a la x del ratón. “mouse x” está en Sensores.'],
    steps:[{ in:'paddle', script:() => [flag(), gotoXY(0, -150), forever(setX(mouseX()))] }],
    why:['Only x changes, so the paddle slides left and right along the bottom. Want it to follow up and down too? Use “go to mouse-pointer” instead.',
         'Solo cambia x, así que la paleta se desliza a la izquierda y derecha por abajo. ¿Quieres que también suba y baje? Usa “go to mouse-pointer”.'],
    also:['bounce'] },

  { id:'walls', group:'move', tags:['walls'], like:['pacman'],
    title:['Walls you can’t walk through', 'Paredes que no puedes atravesar'],
    ask:['How do I stop {player} from going through walls?', '¿Cómo evito que {player} atraviese las paredes?'],
    words:'wall walls maze mazes through stop block blocked solid bump border labyrinth pared paredes laberinto atraviesa atravesar parar detener bloquear solido choca',
    hint:['Paint the walls in one colour. After each move, if the sprite is touching that colour, move it straight back.',
          'Pinta las paredes de un solo color. Después de cada movimiento, si el objeto toca ese color, regrésalo.'],
    steps:[{ in:'player', say:['Paint your walls blue (or pick your wall colour with the dropper in “touching color”).', 'Pinta tus paredes de azul (o elige el color de tu pared con el gotero en “touching color”).'],
      script:() => [flag(), forever(
        IF(keyDown('right arrow'), changeX(4), IF(touchColor(WALL), changeX(-4))),
        IF(keyDown('left arrow'), changeX(-4), IF(touchColor(WALL), changeX(4))),
        IF(keyDown('up arrow'), changeY(4), IF(touchColor(WALL), changeY(-4))),
        IF(keyDown('down arrow'), changeY(-4), IF(touchColor(WALL), changeY(4))))] }],
    why:['Each arrow moves 4, and if that put you inside a wall, the inner if moves you 4 back the other way, so you stop right at the wall. Use the same number in both places.',
         'Cada flecha mueve 4, y si eso te metió en una pared, el if de adentro te regresa 4, así te detienes justo en la pared. Usa el mismo número en los dos lugares.'],
    also:['arrows', 'collect'] },

  { id:'wrap', group:'move', tags:['arrows'], like:['asteroids', 'pacman', 'snake'],
    title:['Go off one side, come back on the other', 'Salir por un lado y volver por el otro'],
    ask:['How do I make {player} come back on the other side of the screen?', '¿Cómo hago que {player} vuelva por el otro lado de la pantalla?'],
    words:'wrap wraps wrapping around other side opposite edge teleport screen leave leaves comes back loop otro lado opuesto borde teletransporta pantalla sale vuelve',
    hint:['Check the x and y position. If the sprite has gone past one edge, put it at the opposite edge.',
          'Revisa la posición x y y. Si el objeto pasó un borde, ponlo en el borde contrario.'],
    steps:[{ in:'player', script:() => [flag(), forever(
      IF(gt(xpos(), 235), setX(-235)), IF(lt(xpos(), -235), setX(235)),
      IF(gt(ypos(), 175), setY(-175)), IF(lt(ypos(), -175), setY(175)))] }],
    why:['The stage goes from x -240 to 240 and y -180 to 180. Going past the right side puts you on the left, and so on, like in Asteroids and Pac-Man.',
         'El escenario va de x -240 a 240 y de y -180 a 180. Al pasar el lado derecho apareces en el izquierdo, y así, como en Asteroids y Pac-Man.'],
    also:['arrows'] },

  { id:'twoplayer', group:'move', tags:['twoplayer'], like:['pong'],
    title:['Two players on one keyboard', 'Dos jugadores en un teclado'],
    ask:['How do I control {player2} with W A S D?', '¿Cómo controlo a {player2} con W A S D?'],
    words:'two 2 players player2 second friend versus vs wasd w a s d keyboard share dos jugadores segundo amigo contra teclado compartir',
    hint:['Player 1 uses the arrow keys. Give player 2 its own keys: W (up), A (left), S (down), D (right).',
          'El jugador 1 usa las flechas. Dale al jugador 2 sus propias teclas: W (arriba), A (izquierda), S (abajo), D (derecha).'],
    steps:[{ in:'player2', script:() => [flag(), forever(
      IF(keyDown('d'), changeX(5)), IF(keyDown('a'), changeX(-5)),
      IF(keyDown('w'), changeY(5)), IF(keyDown('s'), changeY(-5)))] }],
    why:['It is the same as moving with the arrows, but with different keys, so both players can hold keys at the same time. For Pong paddles, keep only W and S.',
         'Es igual que moverse con las flechas pero con otras teclas, así los dos pueden presionar a la vez. Para las paletas de Pong, deja solo W y S.'],
    also:['arrows', 'bounce'] },

  { id:'timer', group:'score', tags:['timer'], like:[],
    title:['A countdown timer', 'Un temporizador'],
    ask:['How do I make a timer that counts down?', '¿Cómo hago un temporizador que cuente hacia atrás?'],
    words:'timer time countdown count down clock seconds limit hurry minute temporizador tiempo cuenta regresiva reloj segundos limite minuto',
    hint:['Make a variable for the time. Start it at 30, and take 1 away every second until it gets to 0.',
          'Crea una variable para el tiempo. Empieza en 30 y quítale 1 cada segundo hasta que llegue a 0.'],
    steps:[{ in:'stage', say:['Make a variable called time (Variables → Make a Variable).', 'Crea una variable llamada time (Variables → Crear una variable).'],
      script:() => [flag(), setVar('time', 30), until(eq(V('time'), 0), wait(1), changeVar('time', -1)), send('game over')] }],
    why:['“repeat until” keeps going until time is 0: wait 1 second, take 1 away. Then it broadcasts game over, so any sprite can react (see “Game over screen”). Change 30 for a longer or shorter game.',
         '“repeat until” sigue hasta que time es 0: espera 1 segundo y quita 1. Luego envía game over, para que cualquier objeto reaccione (mira “Pantalla de fin del juego”). Cambia 30 para un juego más largo o más corto.'],
    also:['gameover', 'score'] },

  { id:'gameover', group:'score', tags:['gameover'], like:[],
    title:['A Game Over screen', 'Una pantalla de fin del juego'],
    ask:['How do I show a big GAME OVER at the end?', '¿Cómo muestro un GAME OVER grande al final?'],
    words:'game over screen end ending sign message title win winner you win lose finish big text fin juego pantalla final letrero mensaje titulo ganar ganaste perdiste terminar texto',
    hint:['Make a sprite that says GAME OVER. It hides at the start, and shows when it gets a “game over” message.',
          'Haz un objeto que diga GAME OVER. Se esconde al empezar y aparece cuando recibe el mensaje “game over”.'],
    steps:[
      { in:'gameover', say:['Make a new sprite and paint or upload a big GAME OVER picture. Then give it these two scripts:', 'Haz un objeto nuevo y pinta o sube un dibujo grande de GAME OVER. Luego dale estos dos programas:'],
        script:() => [flag(), hide()] },
      { in:'gameover', script:() => [onMsg('game over'), show(), front(), stopAll()] },
      { in:'player', say:['Where your game ends (instead of “stop all”), send the message. Pick “New message” in the menu and call it game over:', 'Donde termina tu juego (en lugar de “stop all”), envía el mensaje. Elige “Nuevo mensaje” en el menú y llámalo game over:'],
        script:() => [send('game over')] }],
    why:['broadcast sends a message to every sprite. Only the Game Over sprite listens for it: it shows itself in front of everything, then stops the game. Make a “You win!” sprite the same way with a “you win” message.',
         'broadcast envía un mensaje a todos los objetos. Solo el objeto Game Over lo escucha: aparece delante de todo y luego detiene el juego. Haz un objeto “¡Ganaste!” igual, con un mensaje “you win”.'],
    also:['lives', 'timer'] },

  { id:'speedup', group:'score', tags:['levels'], like:['dino', 'invaders', 'snake'],
    title:['The game gets faster', 'El juego se hace más rápido'],
    ask:['How do I make my game get faster and harder?', '¿Cómo hago que mi juego sea más rápido y difícil?'],
    words:'faster speed speeds speed up harder hard difficult difficulty level levels increase over time quicker mas rapido rapida velocidad dificil dificultad nivel niveles aumentar',
    hint:['Make a variable called speed. Every few seconds add 1 to it, and make your obstacle move by speed instead of a fixed number.',
          'Crea una variable llamada speed. Cada pocos segundos súmale 1, y haz que tu obstáculo se mueva según speed en vez de un número fijo.'],
    steps:[
      { in:'stage', say:['Make a variable called speed (For all sprites), then:', 'Crea una variable llamada speed (Para todos los objetos), luego:'],
        script:() => [flag(), setVar('speed', 6), forever(wait(5), changeVar('speed', 1))] },
      { in:'obstacle', say:['In your obstacle, change “change x by -8” to this (0 − speed goes left):', 'En tu obstáculo, cambia “change x by -8” por esto (0 − speed va a la izquierda):'],
        script:() => [changeX(sub(0, V('speed')))] }],
    why:['Every 5 seconds speed goes up by 1, and the obstacle uses speed to move, so it gets faster the longer you play. Change 5 to make it speed up sooner or later.',
         'Cada 5 segundos speed sube 1, y el obstáculo usa speed para moverse, así va más rápido mientras más juegas. Cambia 5 para que acelere antes o después.'],
    also:['scroll', 'score'] },

  { id:'animate', group:'looks', tags:['animation'], like:[],
    title:['Walking animation', 'Animación al caminar'],
    ask:['How do I make {player} look like it is walking?', '¿Cómo hago que {player} parezca que camina?'],
    words:'animate animation animated walk walking run running legs move moving costume costumes switch flap flapping anima animacion animar camina caminar corre piernas disfraz disfraces cambiar aletea',
    hint:['Give the sprite two or more costumes (in the Costumes tab), then keep switching to the next costume with a short wait.',
          'Dale al objeto dos o más disfraces (en la pestaña Disfraces) y cambia al siguiente disfraz una y otra vez con una espera corta.'],
    steps:[{ in:'player', script:() => [flag(), forever(nextCostume(), wait(0.15))] }],
    why:['Flipping through the costumes quickly looks like movement, like a flip book. A smaller wait animates faster.',
         'Pasar los disfraces rápido parece movimiento, como un folioscopio. Una espera más corta anima más rápido.'],
    also:['arrows'] },

  { id:'sounds', group:'looks', tags:['sounds'], like:[],
    title:['Sounds and music', 'Sonidos y música'],
    ask:['How do I play a sound when something happens, and add music?', '¿Cómo pongo un sonido cuando pasa algo, y música?'],
    words:'sound sounds music song songs noise play audio background effect beep sonido sonidos musica cancion canciones ruido audio fondo efecto',
    hint:['Put a “start sound” block right next to the thing that happens (inside the same if, or under the same key). For music, play a sound over and over on the stage.',
          'Pon un bloque “start sound” justo junto a lo que pasa (dentro del mismo if, o bajo la misma tecla). Para música, toca un sonido una y otra vez en el escenario.'],
    steps:[
      { in:'player', say:['A sound when you jump (or put “start sound” inside any if):', 'Un sonido al saltar (o pon “start sound” dentro de cualquier if):'],
        script:() => [onKey('space'), sound()] },
      { in:'stage', say:['Background music on the stage (add a sound in the stage’s Sounds tab first):', 'Música de fondo en el escenario (primero agrega un sonido en la pestaña Sonidos del escenario):'],
        script:() => [flag(), forever(soundAll())] }],
    why:['“start sound” plays and carries on straight away, so the game does not pause. “play sound until done” waits for the end, which is what makes music loop without overlapping.',
         '“start sound” suena y sigue enseguida, así el juego no se detiene. “play sound until done” espera a que termine, por eso la música se repite sin encimarse.'],
    also:[] }
  ];

  const GROUPS = [
    ['move', '🏃', 'Moving', 'Moverse'], ['danger', '🌵', 'Obstacles & enemies', 'Obstáculos y enemigos'],
    ['shoot', '🔫', 'Shooting', 'Disparar'], ['ball', '🏓', 'Ball games', 'Juegos de pelota'],
    ['score', '💯', 'Score & game', 'Puntos y juego'], ['looks', '🎵', 'Looks & sound', 'Apariencia y sonido']
  ];

  const BY = Object.fromEntries(LIST.map(r => [r.id, r]));
  return { LIST, BY, GROUPS, FEATURES, GAMES, ROLES, of:id => BY[id] || null };
})();
