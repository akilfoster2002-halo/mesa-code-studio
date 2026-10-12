/* =====================================================================
   BLOCKS — every block in the language, as data.

   The same blocks Scratch 3 has, in the same categories and order, with
   the same words, plus the Pen, Music and Text to Speech extensions.
   The editor draws from this table and the VM runs from it, so a block
   cannot exist in one and be missing from the other.

   SHAPES
     hat    starts a script            when ⚑ clicked
     stack  does something             move (10) steps
     c      wraps blocks               repeat (10)
     c2     wraps two lists            if <> then … else …
     cap    ends a script              stop [all]
     capc   a C that ends a script     forever
     report gives a number or text     x position
     bool   gives true or false        touching (edge)?

   ARGS, written [NAME] in the text
     num / str   a round box to type in, or drop any reporter on
     bool        a hexagonal hole for a true/false block
     color       a colour swatch (click to pick, or drop a reporter on)
     menu        a dropdown that is part of the block (cannot hold a block)
     rmenu       a dropdown that a reporter may be dropped over
     var / list  a dropdown over the project's variables or lists
   ===================================================================== */
window.BLOCKS = (function(){
  const CATS = [
    { id:'motion', pastel:'#8fd3ff',   name:'Motion',    color:'#4C97FF', dark:'#3373CC' },
    { id:'looks', pastel:'#cdb4f6',    name:'Looks',     color:'#9966FF', dark:'#774DCB' },
    { id:'sound', pastel:'#f2b8ee',    name:'Sound',     color:'#CF63CF', dark:'#BD42BD' },
    { id:'events', pastel:'#ffd8a8',   name:'Events',    color:'#FFBF00', dark:'#CC9900' },
    { id:'control', pastel:'#ffb4a2',  name:'Control',   color:'#FFAB19', dark:'#CF8B17' },
    { id:'sensing', pastel:'#a8e6cf',  name:'Sensing',   color:'#5CB1D6', dark:'#2E8EB8' },
    { id:'operators', pastel:'#9fe6b4',name:'Operators', color:'#59C059', dark:'#389438' },
    { id:'variables', pastel:'#ffc48f',name:'Variables', color:'#FF8C1A', dark:'#DB6E00' },
    { id:'lists', pastel:'#ffb38a',    name:'Lists',     color:'#FF661A', dark:'#E64D00', hidden:true },
    { id:'myblocks', pastel:'#ff9aa2', name:'My Blocks', color:'#FF6680', dark:'#FF4D6A' },
    { id:'pen', pastel:'#9fe8d2',      name:'Pen',       color:'#0FBD8C', dark:'#0B8E69', ext:true },
    { id:'music', pastel:'#9fe8d2',    name:'Music',     color:'#0FBD8C', dark:'#0B8E69', ext:true },
    { id:'tts', pastel:'#9fe8d2',      name:'Text to Speech', color:'#0FBD8C', dark:'#0B8E69', ext:true }
  ];

  const num = d => ({ t:'num', d });
  const str = d => ({ t:'str', d });
  const bool = () => ({ t:'bool' });
  const menu = (m, d) => ({ t:'menu', menu:m, d });
  const rmenu = (m, d) => ({ t:'rmenu', menu:m, d });
  const color = d => ({ t:'color', d });

  const L = [];
  /* B(op, cat, shape, text, args, extra) */
  const B = (op, cat, shape, text, args, extra) => L.push({ op, cat, shape, text, args: args || {}, ...(extra || {}) });
  const SP = { sprite:true };     // only on sprites
  const ST = { stage:true };      // only on the stage
  const MON = { monitor:true };   // has a checkbox to show it on the stage
  const gap = cat => L.push({ gap:true, cat });

  /* ------------------------------------------------------------ MOTION */
  B('motion_movesteps','motion','stack','move [STEPS] steps',{ STEPS:num(10) },SP);
  B('motion_turnright','motion','stack','turn ↻ [DEGREES] degrees',{ DEGREES:num(15) },SP);
  B('motion_turnleft','motion','stack','turn ↺ [DEGREES] degrees',{ DEGREES:num(15) },SP);
  gap('motion');
  B('motion_goto','motion','stack','go to [TO]',{ TO:rmenu('goto','_random_') },SP);
  B('motion_gotoxy','motion','stack','go to x: [X] y: [Y]',{ X:num(0), Y:num(0) },SP);
  B('motion_glideto','motion','stack','glide [SECS] secs to [TO]',{ SECS:num(1), TO:rmenu('goto','_random_') },SP);
  B('motion_glidesecstoxy','motion','stack','glide [SECS] secs to x: [X] y: [Y]',{ SECS:num(1), X:num(0), Y:num(0) },SP);
  gap('motion');
  B('motion_pointindirection','motion','stack','point in direction [DIRECTION]',{ DIRECTION:num(90) },SP);
  B('motion_pointtowards','motion','stack','point towards [TOWARDS]',{ TOWARDS:rmenu('pointto','_mouse_') },SP);
  gap('motion');
  B('motion_changexby','motion','stack','change x by [DX]',{ DX:num(10) },SP);
  B('motion_setx','motion','stack','set x to [X]',{ X:num(0) },SP);
  B('motion_changeyby','motion','stack','change y by [DY]',{ DY:num(10) },SP);
  B('motion_sety','motion','stack','set y to [Y]',{ Y:num(0) },SP);
  gap('motion');
  B('motion_ifonedgebounce','motion','stack','if on edge, bounce',{},SP);
  gap('motion');
  B('motion_setrotationstyle','motion','stack','set rotation style [STYLE]',{ STYLE:menu('rotstyle','left-right') },SP);
  gap('motion');
  B('motion_xposition','motion','report','x position',{},{ ...SP, ...MON });
  B('motion_yposition','motion','report','y position',{},{ ...SP, ...MON });
  B('motion_direction','motion','report','direction',{},{ ...SP, ...MON });

  /* ------------------------------------------------------------- LOOKS */
  B('looks_sayforsecs','looks','stack','say [MESSAGE] for [SECS] seconds',{ MESSAGE:str('Hello!'), SECS:num(2) },SP);
  B('looks_say','looks','stack','say [MESSAGE]',{ MESSAGE:str('Hello!') },SP);
  B('looks_thinkforsecs','looks','stack','think [MESSAGE] for [SECS] seconds',{ MESSAGE:str('Hmm...'), SECS:num(2) },SP);
  B('looks_think','looks','stack','think [MESSAGE]',{ MESSAGE:str('Hmm...') },SP);
  gap('looks');
  B('looks_switchcostumeto','looks','stack','switch costume to [COSTUME]',{ COSTUME:rmenu('costume') },SP);
  B('looks_nextcostume','looks','stack','next costume',{},SP);
  B('looks_switchbackdropto','looks','stack','switch backdrop to [BACKDROP]',{ BACKDROP:rmenu('backdrop') });
  B('looks_switchbackdroptoandwait','looks','stack','switch backdrop to [BACKDROP] and wait',{ BACKDROP:rmenu('backdrop') },ST);
  B('looks_nextbackdrop','looks','stack','next backdrop',{});
  gap('looks');
  B('looks_changesizeby','looks','stack','change size by [CHANGE]',{ CHANGE:num(10) },SP);
  B('looks_setsizeto','looks','stack','set size to [SIZE] %',{ SIZE:num(100) },SP);
  gap('looks');
  B('looks_changeeffectby','looks','stack','change [EFFECT] effect by [CHANGE]',{ EFFECT:menu('effect','color'), CHANGE:num(25) });
  B('looks_seteffectto','looks','stack','set [EFFECT] effect to [VALUE]',{ EFFECT:menu('effect','color'), VALUE:num(0) });
  B('looks_cleargraphiceffects','looks','stack','clear graphic effects',{});
  gap('looks');
  B('looks_show','looks','stack','show',{},SP);
  B('looks_hide','looks','stack','hide',{},SP);
  gap('looks');
  B('looks_gotofrontback','looks','stack','go to [FRONT_BACK] layer',{ FRONT_BACK:menu('frontback','front') },SP);
  B('looks_goforwardbackwardlayers','looks','stack','go [FORWARD_BACKWARD] [NUM] layers',{ FORWARD_BACKWARD:menu('fwdback','forward'), NUM:num(1) },SP);
  gap('looks');
  B('looks_costumenumbername','looks','report','costume [NUMBER_NAME]',{ NUMBER_NAME:menu('numname','number') },{ ...SP, ...MON });
  B('looks_backdropnumbername','looks','report','backdrop [NUMBER_NAME]',{ NUMBER_NAME:menu('numname','number') },MON);
  B('looks_size','looks','report','size',{},{ ...SP, ...MON });

  /* ------------------------------------------------------------- SOUND */
  B('sound_playuntildone','sound','stack','play sound [SOUND_MENU] until done',{ SOUND_MENU:rmenu('sound') });
  B('sound_play','sound','stack','start sound [SOUND_MENU]',{ SOUND_MENU:rmenu('sound') });
  B('sound_stopallsounds','sound','stack','stop all sounds',{});
  gap('sound');
  B('sound_changeeffectby','sound','stack','change [EFFECT] effect by [VALUE]',{ EFFECT:menu('soundeffect','pitch'), VALUE:num(10) });
  B('sound_seteffectto','sound','stack','set [EFFECT] effect to [VALUE]',{ EFFECT:menu('soundeffect','pitch'), VALUE:num(100) });
  B('sound_cleareffects','sound','stack','clear sound effects',{});
  gap('sound');
  B('sound_changevolumeby','sound','stack','change volume by [VOLUME]',{ VOLUME:num(-10) });
  B('sound_setvolumeto','sound','stack','set volume to [VOLUME] %',{ VOLUME:num(100) });
  B('sound_volume','sound','report','volume',{},MON);

  /* ------------------------------------------------------------ EVENTS */
  B('event_whenflagclicked','events','hat','when ⚑ clicked',{});
  B('event_whenkeypressed','events','hat','when [KEY_OPTION] key pressed',{ KEY_OPTION:menu('key','space') });
  B('event_whenthisspriteclicked','events','hat','when this sprite clicked',{},SP);
  B('event_whenstageclicked','events','hat','when stage clicked',{},ST);
  B('event_whenbackdropswitchesto','events','hat','when backdrop switches to [BACKDROP]',{ BACKDROP:menu('backdropname') });
  gap('events');
  B('event_whengreaterthan','events','hat','when [WHENGREATERTHANMENU] > [VALUE]',{ WHENGREATERTHANMENU:menu('hatsensor','timer'), VALUE:num(10) });
  gap('events');
  B('event_whenbroadcastreceived','events','hat','when I receive [BROADCAST_OPTION]',{ BROADCAST_OPTION:menu('message') });
  B('event_broadcast','events','stack','broadcast [BROADCAST_INPUT]',{ BROADCAST_INPUT:rmenu('message') });
  B('event_broadcastandwait','events','stack','broadcast [BROADCAST_INPUT] and wait',{ BROADCAST_INPUT:rmenu('message') });

  /* ----------------------------------------------------------- CONTROL */
  B('control_wait','control','stack','wait [DURATION] seconds',{ DURATION:num(1) });
  gap('control');
  B('control_repeat','control','c','repeat [TIMES]',{ TIMES:num(10) });
  B('control_forever','control','capc','forever',{});
  gap('control');
  B('control_if','control','c','if [CONDITION] then',{ CONDITION:bool() });
  B('control_if_else','control','c2','if [CONDITION] then',{ CONDITION:bool() });
  B('control_wait_until','control','stack','wait until [CONDITION]',{ CONDITION:bool() });
  B('control_repeat_until','control','c','repeat until [CONDITION]',{ CONDITION:bool() });
  gap('control');
  B('control_stop','control','cap','stop [STOP_OPTION]',{ STOP_OPTION:menu('stop','all') });
  gap('control');
  B('control_start_as_clone','control','hat','when I start as a clone',{},SP);
  B('control_create_clone_of','control','stack','create clone of [CLONE_OPTION]',{ CLONE_OPTION:rmenu('clone','_myself_') });
  B('control_delete_this_clone','control','cap','delete this clone',{},SP);

  /* ----------------------------------------------------------- SENSING */
  B('sensing_touchingobject','sensing','bool','touching [TOUCHINGOBJECTMENU] ?',{ TOUCHINGOBJECTMENU:rmenu('touching','_mouse_') },SP);
  B('sensing_touchingcolor','sensing','bool','touching color [COLOR] ?',{ COLOR:color('#3b82f6') },SP);
  B('sensing_coloristouchingcolor','sensing','bool','color [COLOR] is touching [COLOR2] ?',{ COLOR:color('#22c55e'), COLOR2:color('#ef4444') },SP);
  B('sensing_distanceto','sensing','report','distance to [DISTANCETOMENU]',{ DISTANCETOMENU:rmenu('distance','_mouse_') },SP);
  gap('sensing');
  B('sensing_askandwait','sensing','stack','ask [QUESTION] and wait',{ QUESTION:str("What's your name?") });
  B('sensing_answer','sensing','report','answer',{},MON);
  gap('sensing');
  B('sensing_keypressed','sensing','bool','key [KEY_OPTION] pressed?',{ KEY_OPTION:rmenu('key','space') });
  B('sensing_mousedown','sensing','bool','mouse down?',{});
  B('sensing_mousex','sensing','report','mouse x',{});
  B('sensing_mousey','sensing','report','mouse y',{});
  gap('sensing');
  B('sensing_setdragmode','sensing','stack','set drag mode [DRAG_MODE]',{ DRAG_MODE:menu('dragmode','draggable') },SP);
  gap('sensing');
  B('sensing_loudness','sensing','report','loudness',{},MON);
  gap('sensing');
  B('sensing_timer','sensing','report','timer',{},MON);
  B('sensing_resettimer','sensing','stack','reset timer',{});
  gap('sensing');
  B('sensing_of','sensing','report','[PROPERTY] of [OBJECT]',{ PROPERTY:menu('ofprop','x position'), OBJECT:rmenu('oftarget','_stage_') });
  gap('sensing');
  B('sensing_current','sensing','report','current [CURRENTMENU]',{ CURRENTMENU:menu('current','year') },MON);
  B('sensing_dayssince2000','sensing','report','days since 2000',{});
  gap('sensing');
  B('sensing_username','sensing','report','username',{},MON);

  /* --------------------------------------------------------- OPERATORS */
  B('operator_add','operators','report','[NUM1] + [NUM2]',{ NUM1:num(''), NUM2:num('') });
  B('operator_subtract','operators','report','[NUM1] - [NUM2]',{ NUM1:num(''), NUM2:num('') });
  B('operator_multiply','operators','report','[NUM1] * [NUM2]',{ NUM1:num(''), NUM2:num('') });
  B('operator_divide','operators','report','[NUM1] / [NUM2]',{ NUM1:num(''), NUM2:num('') });
  gap('operators');
  B('operator_random','operators','report','pick random [FROM] to [TO]',{ FROM:num(1), TO:num(10) });
  gap('operators');
  B('operator_gt','operators','bool','[OPERAND1] > [OPERAND2]',{ OPERAND1:str(''), OPERAND2:str('50') });
  B('operator_lt','operators','bool','[OPERAND1] < [OPERAND2]',{ OPERAND1:str(''), OPERAND2:str('50') });
  B('operator_equals','operators','bool','[OPERAND1] = [OPERAND2]',{ OPERAND1:str(''), OPERAND2:str('50') });
  gap('operators');
  B('operator_and','operators','bool','[OPERAND1] and [OPERAND2]',{ OPERAND1:bool(), OPERAND2:bool() });
  B('operator_or','operators','bool','[OPERAND1] or [OPERAND2]',{ OPERAND1:bool(), OPERAND2:bool() });
  B('operator_not','operators','bool','not [OPERAND]',{ OPERAND:bool() });
  gap('operators');
  B('operator_join','operators','report','join [STRING1] [STRING2]',{ STRING1:str('apple '), STRING2:str('banana') });
  B('operator_letter_of','operators','report','letter [LETTER] of [STRING]',{ LETTER:num(1), STRING:str('apple') });
  B('operator_length','operators','report','length of [STRING]',{ STRING:str('apple') });
  B('operator_contains','operators','bool','[STRING1] contains [STRING2] ?',{ STRING1:str('apple'), STRING2:str('a') });
  gap('operators');
  B('operator_mod','operators','report','[NUM1] mod [NUM2]',{ NUM1:num(''), NUM2:num('') });
  B('operator_round','operators','report','round [NUM]',{ NUM:num('') });
  gap('operators');
  B('operator_mathop','operators','report','[OPERATOR] of [NUM]',{ OPERATOR:menu('mathop','abs'), NUM:num('') });

  /* --------------------------------------------------------- VARIABLES
     data_variable and data_listcontents are drawn once per variable/list
     by the palette; the rest are shown when at least one exists. */
  B('data_variable','variables','report','[VARIABLE]',{ VARIABLE:{ t:'var' } },{ palette:false, ...MON });
  B('data_setvariableto','variables','stack','set [VARIABLE] to [VALUE]',{ VARIABLE:{ t:'var' }, VALUE:str('0') });
  B('data_changevariableby','variables','stack','change [VARIABLE] by [VALUE]',{ VARIABLE:{ t:'var' }, VALUE:num(1) });
  B('data_showvariable','variables','stack','show variable [VARIABLE]',{ VARIABLE:{ t:'var' } });
  B('data_hidevariable','variables','stack','hide variable [VARIABLE]',{ VARIABLE:{ t:'var' } });

  B('data_listcontents','lists','report','[LIST]',{ LIST:{ t:'list' } },{ palette:false, ...MON });
  B('data_addtolist','lists','stack','add [ITEM] to [LIST]',{ ITEM:str('thing'), LIST:{ t:'list' } });
  gap('lists');
  B('data_deleteoflist','lists','stack','delete [INDEX] of [LIST]',{ INDEX:num(1), LIST:{ t:'list' } });
  B('data_deletealloflist','lists','stack','delete all of [LIST]',{ LIST:{ t:'list' } });
  B('data_insertatlist','lists','stack','insert [ITEM] at [INDEX] of [LIST]',{ ITEM:str('thing'), INDEX:num(1), LIST:{ t:'list' } });
  B('data_replaceitemoflist','lists','stack','replace item [INDEX] of [LIST] with [ITEM]',{ INDEX:num(1), LIST:{ t:'list' }, ITEM:str('thing') });
  gap('lists');
  B('data_itemoflist','lists','report','item [INDEX] of [LIST]',{ INDEX:num(1), LIST:{ t:'list' } });
  B('data_itemnumoflist','lists','report','item # of [ITEM] in [LIST]',{ ITEM:str('thing'), LIST:{ t:'list' } });
  B('data_lengthoflist','lists','report','length of [LIST]',{ LIST:{ t:'list' } });
  B('data_listcontainsitem','lists','bool','[LIST] contains [ITEM] ?',{ LIST:{ t:'list' }, ITEM:str('thing') });
  gap('lists');
  B('data_showlist','lists','stack','show list [LIST]',{ LIST:{ t:'list' } });
  B('data_hidelist','lists','stack','hide list [LIST]',{ LIST:{ t:'list' } });

  /* --------------------------------------------------------- MY BLOCKS
     A definition is a hat whose words come from the block it defines;
     a call is a stack block whose words do too. The palette makes both
     from the project's procedure list. */
  B('procedures_definition','myblocks','hat','define',{},{ palette:false });
  B('procedures_call','myblocks','stack','',{},{ palette:false });
  B('argument_reporter','myblocks','report','',{},{ palette:false });
  B('argument_boolean','myblocks','bool','',{},{ palette:false });

  /* --------------------------------------------------------------- PEN */
  B('pen_clear','pen','stack','erase all',{});
  B('pen_stamp','pen','stack','stamp',{},SP);
  B('pen_penDown','pen','stack','pen down',{},SP);
  B('pen_penUp','pen','stack','pen up',{},SP);
  B('pen_setPenColorToColor','pen','stack','set pen color to [COLOR]',{ COLOR:color('#4C97FF') },SP);
  B('pen_changePenColorParamBy','pen','stack','change pen [COLOR_PARAM] by [VALUE]',{ COLOR_PARAM:menu('penparam','color'), VALUE:num(10) },SP);
  B('pen_setPenColorParamTo','pen','stack','set pen [COLOR_PARAM] to [VALUE]',{ COLOR_PARAM:menu('penparam','color'), VALUE:num(50) },SP);
  B('pen_changePenSizeBy','pen','stack','change pen size by [SIZE]',{ SIZE:num(1) },SP);
  B('pen_setPenSizeTo','pen','stack','set pen size to [SIZE]',{ SIZE:num(1) },SP);

  /* ------------------------------------------------------------- MUSIC */
  B('music_playDrumForBeats','music','stack','play drum [DRUM] for [BEATS] beats',{ DRUM:rmenu('drum','1'), BEATS:num(0.25) });
  B('music_restForBeats','music','stack','rest for [BEATS] beats',{ BEATS:num(0.25) });
  B('music_playNoteForBeats','music','stack','play note [NOTE] for [BEATS] beats',{ NOTE:num(60), BEATS:num(0.25) });
  B('music_setInstrument','music','stack','set instrument to [INSTRUMENT]',{ INSTRUMENT:rmenu('instrument','1') });
  B('music_setTempo','music','stack','set tempo to [TEMPO]',{ TEMPO:num(60) });
  B('music_changeTempo','music','stack','change tempo by [TEMPO]',{ TEMPO:num(20) });
  B('music_getTempo','music','report','tempo',{},MON);

  /* ---------------------------------------------------- TEXT TO SPEECH */
  B('text2speech_speakAndWait','tts','stack','speak [WORDS]',{ WORDS:str('hello') });
  B('text2speech_setVoice','tts','stack','set voice to [VOICE]',{ VOICE:menu('voice','ALTO') });
  B('text2speech_setLanguage','tts','stack','set language to [LANGUAGE]',{ LANGUAGE:menu('language','en') });

  /* -------------------------------------------------------------- menus
     Static menus are [label, value] pairs. Dynamic ones are filled in by
     the editor from the project (see EDITOR.menuOptions). */
  const KEYS = [['space','space'],['up arrow','up arrow'],['down arrow','down arrow'],['right arrow','right arrow'],
    ['left arrow','left arrow'],['any','any'],
    ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('').map(k => [k, k])];
  const DRUMS = ['Snare Drum','Bass Drum','Side Stick','Crash Cymbal','Open Hi-Hat','Closed Hi-Hat','Tambourine',
    'Hand Clap','Claves','Wood Block','Cowbell','Triangle','Bongo','Conga','Cabasa','Guiro','Vibraslap','Cuica'];
  const INSTRUMENTS = ['Piano','Electric Piano','Organ','Guitar','Electric Guitar','Bass','Pizzicato','Cello',
    'Trombone','Clarinet','Saxophone','Flute','Wooden Flute','Bassoon','Choir','Vibraphone','Music Box',
    'Steel Drum','Marimba','Synth Lead','Synth Pad'];
  const MENUS = {
    rotstyle: [['left-right','left-right'],["don't rotate","don't rotate"],['all around','all around']],
    effect: [['color','color'],['fisheye','fisheye'],['whirl','whirl'],['pixelate','pixelate'],
             ['mosaic','mosaic'],['brightness','brightness'],['ghost','ghost']],
    soundeffect: [['pitch','pitch'],['pan left/right','pan']],
    frontback: [['front','front'],['back','back']],
    fwdback: [['forward','forward'],['backward','backward']],
    numname: [['number','number'],['name','name']],
    hatsensor: [['timer','timer'],['loudness','loudness']],
    stop: [['all','all'],['this script','this script'],['other scripts in sprite','other scripts in sprite']],
    dragmode: [['draggable','draggable'],['not draggable','not draggable']],
    current: [['year','year'],['month','month'],['date','date'],['day of week','dayofweek'],
              ['hour','hour'],['minute','minute'],['second','second']],
    mathop: ['abs','floor','ceiling','sqrt','sin','cos','tan','asin','acos','atan','ln','log','e ^','10 ^'].map(x => [x, x]),
    key: KEYS,
    penparam: [['color','color'],['saturation','saturation'],['brightness','brightness'],['transparency','transparency']],
    drum: DRUMS.map((d, i) => ['(' + (i+1) + ') ' + d, String(i+1)]),
    instrument: INSTRUMENTS.map((d, i) => ['(' + (i+1) + ') ' + d, String(i+1)]),
    voice: [['alto','ALTO'],['tenor','TENOR'],['squeak','SQUEAK'],['giant','GIANT'],['kitten','KITTEN']],
    language: [['English','en'],['Spanish (Español)','es'],['French','fr'],['Portuguese','pt'],['Arabic','ar'],
               ['Chinese','zh'],['Haitian Creole','ht'],['Italian','it'],['German','de'],['Japanese','ja'],['Korean','ko'],['Hindi','hi']]
  };

  /* --------------------------------------------------------------- help
     One plain sentence per block for the ? in the right-click menu. */
  const HELP = {
    motion_movesteps:'Moves forward the way the sprite is pointing.',
    motion_turnright:'Turns clockwise.', motion_turnleft:'Turns anticlockwise.',
    motion_goto:'Jumps to a random spot, the mouse, or another sprite.',
    motion_gotoxy:'Jumps to an exact spot. x is left/right (-240 to 240), y is down/up (-180 to 180).',
    motion_glideto:'Slides smoothly to a spot over some seconds.',
    motion_glidesecstoxy:'Slides smoothly to x and y over some seconds.',
    motion_pointindirection:'90 is right, -90 is left, 0 is up, 180 is down.',
    motion_pointtowards:'Turns to face the mouse or another sprite.',
    motion_changexby:'Moves left or right. Negative numbers go left.',
    motion_setx:'Puts the sprite at an exact x, left to right.',
    motion_changeyby:'Moves up or down. Negative numbers go down.',
    motion_sety:'Puts the sprite at an exact y, bottom to top.',
    motion_ifonedgebounce:'Turns the sprite around when it hits the edge of the stage.',
    motion_setrotationstyle:'left-right only flips; don\'t rotate never turns the picture.',
    looks_sayforsecs:'Shows a speech bubble, then hides it.',
    looks_switchcostumeto:'Changes the picture. Costumes are in the Costumes tab.',
    looks_nextcostume:'Goes to the next picture. Do it in a loop to animate.',
    looks_seteffectto:'ghost 100 is invisible; color shifts the colours.',
    control_forever:'Runs the blocks inside again and again, forever.',
    control_repeat:'Runs the blocks inside a number of times.',
    control_if:'Runs the blocks inside only when the condition is true.',
    control_if_else:'Runs the top blocks when true, the bottom blocks when false.',
    control_create_clone_of:'Makes a copy. The copy runs "when I start as a clone".',
    sensing_touchingobject:'True when touching the edge, the mouse, or another sprite.',
    sensing_touchingcolor:'True when touching that colour. Click the swatch, then the dropper to pick from the stage.',
    sensing_askandwait:'Asks a question; the reply goes in "answer".',
    sensing_keypressed:'True while that key is held down.',
    sensing_of:'Reads something about another sprite or the stage.',
    operator_random:'Picks a new number each time.',
    operator_mod:'The remainder after dividing.',
    data_setvariableto:'Puts a value in a variable.',
    data_changevariableby:'Adds to a variable. Use -1 to count down.',
    event_broadcast:'Sends a message to every sprite.',
    pen_stamp:'Prints a copy of the sprite onto the stage.'
  };

  const BY = {};
  L.forEach(b => { if(!b.gap) BY[b.op] = b; });
  const of = op => BY[op] || null;
  const cat = id => CATS.find(c => c.id === id);
  const isReporter = s => s === 'report' || s === 'bool';
  const isC = s => s === 'c' || s === 'c2' || s === 'capc';
  const isCap = s => s === 'cap' || s === 'capc';
  /* split "move [STEPS] steps" into ['move ', {arg:'STEPS'}, ' steps'] */
  const parts = text => String(text).split(/(\[[A-Z0-9_]+\])/).filter(Boolean)
    .map(p => /^\[[A-Z0-9_]+\]$/.test(p) ? { arg:p.slice(1, -1) } : p);

  return { CATS, LIST:L, MENUS, HELP, of, cat, isReporter, isC, isCap, parts };
})();
