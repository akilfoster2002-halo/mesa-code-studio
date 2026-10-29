/* =====================================================================
   INTRO TO HTML — what the seven activities practice. About 30 minutes
   in all; every activity can be played again to beat its score.

   Code stays English (it is the code); everything else is EN/ES.
   Loaded by html.js in the page, and by tests/html.test.js in Node.
   ===================================================================== */
(function(root){
  const ACTS = [
    { id:'cards', icon:'🃏', min:5, title:{ en:'Flash Cards', es:'Tarjetas' }, line:{ en:'Learn what each tag means', es:'Aprende qué significa cada etiqueta' } },
    { id:'type',  icon:'⌨️', min:8, title:{ en:'Type It', es:'Escríbelo' }, line:{ en:'Type real HTML, see what it makes', es:'Escribe HTML real y mira qué hace' } },
    { id:'close', icon:'🔒', min:3, title:{ en:'Close the Tag', es:'Cierra la etiqueta' }, line:{ en:'Pick the tag that closes it', es:'Elige la etiqueta que la cierra' } },
    { id:'match', icon:'🎯', min:4, title:{ en:'What Did It Make?', es:'¿Qué hizo?' }, line:{ en:'Match the page to its code', es:'Une la página con su código' } },
    { id:'build', icon:'🧱', min:4, title:{ en:'Build a Page', es:'Arma una página' }, line:{ en:'Put the lines in order', es:'Pon las líneas en orden' } },
    { id:'fix',   icon:'🐞', min:3, title:{ en:'Fix the Tag', es:'Arregla la etiqueta' }, line:{ en:'Find the code with no bug', es:'Encuentra el código sin error' } },
    { id:'page',  icon:'✏️', min:6, title:{ en:'My First Page', es:'Mi primera página' }, line:{ en:'Write your own web page', es:'Escribe tu propia página web' } }
  ];

  /* flash cards: the code on the front, what it means on the back */
  const CARDS = [
    { code:'<html>', en:'The whole web page goes inside', es:'Toda la página va adentro', ex:'' },
    { code:'<body>', en:'What you see on the page', es:'Lo que ves en la página', ex:'' },
    { code:'<title>', en:'The name on the browser tab', es:'El nombre en la pestaña', ex:'' },
    { code:'<h1>', en:'The biggest heading', es:'El título más grande', ex:'<h1>Hi!</h1>' },
    { code:'<h2>', en:'A smaller heading', es:'Un título más pequeño', ex:'<h2>Hi!</h2>' },
    { code:'<p>', en:'A paragraph of words', es:'Un párrafo de palabras', ex:'<p>I like pizza.</p>' },
    { code:'<b>', en:'Bold text', es:'Texto en negrita', ex:'<b>Wow</b>' },
    { code:'<i>', en:'Slanted (italic) text', es:'Texto inclinado (cursiva)', ex:'<i>Wow</i>' },
    { code:'<br>', en:'Start a new line', es:'Empieza una línea nueva', ex:'one<br>two' },
    { code:'<ul>', en:'A list with dots', es:'Una lista con puntos', ex:'<ul><li>red</li><li>blue</li></ul>' },
    { code:'<li>', en:'One thing in a list', es:'Una cosa en una lista', ex:'<ul><li>red</li></ul>' },
    { code:'<img>', en:'A picture', es:'Una imagen', ex:'' },
    { code:'<a>', en:'A link to another page', es:'Un enlace a otra página', ex:'<a href="#">Click me</a>' },
    { code:'</p>', en:'A closing tag: the paragraph ends here', es:'Etiqueta de cierre: el párrafo termina aquí', ex:'' }
  ];

  /* typing: short lines first, the same shapes again and again */
  const TYPE = [
    '<h1>Hello</h1>',
    '<h1>I love games</h1>',
    '<h2>My pets</h2>',
    '<p>This is my page.</p>',
    '<p>I am in class.</p>',
    '<b>Bold</b>',
    '<p>I am <b>strong</b>.</p>',
    '<i>Italic</i>',
    '<p>So <i>cool</i>!</p>',
    '<li>Pizza</li>',
    '<li>Tacos</li>',
    '<ul><li>Red</li><li>Blue</li></ul>',
    'Line one<br>Line two',
    '<a href="#">Click me</a>'
  ];

  /* close the tag: open tags that need a closing tag */
  const CLOSE = [
    ['p', 'Hello'], ['h1', 'My Page'], ['b', 'Bold'], ['i', 'Italic'], ['h2', 'Pets'],
    ['li', 'Pizza'], ['title', 'My Site'], ['body', '…'], ['a', 'Click me'], ['ul', '…'], ['html', '…'], ['h1', 'Games']
  ];

  /* what did it make: the same words inside different tags */
  const MATCH_WORDS = ['Dogs', 'Pizza', 'Soccer', 'Music', 'Space', 'Tacos', 'Robots', 'Rain'];
  const MATCH_TAGS = ['h1', 'h2', 'p', 'b', 'i', 'li'];
  const wrap = (tag, word) => tag === 'li' ? '<ul><li>' + word + '</li></ul>' : '<' + tag + '>' + word + '</' + tag + '>';

  /* build a page: the lines in order (indent = how far in it goes) */
  const BUILD = [
    [[0, '<html>'], [1, '<body>'], [2, '<h1>Hi!</h1>'], [1, '</body>'], [0, '</html>']],
    [[0, '<html>'], [1, '<body>'], [2, '<h1>Cats</h1>'], [2, '<p>Cats are fun.</p>'], [1, '</body>'], [0, '</html>']],
    [[0, '<html>'], [1, '<head>'], [2, '<title>My Page</title>'], [1, '</head>'], [1, '<body>'], [2, '<p>Welcome!</p>'], [1, '</body>'], [0, '</html>']],
    [[0, '<html>'], [1, '<body>'], [2, '<h1>Food</h1>'], [2, '<ul>'], [3, '<li>Pizza</li>'], [3, '<li>Tacos</li>'], [2, '</ul>'], [1, '</body>'], [0, '</html>']]
  ];

  /* fix the tag: the good line, then two lines with a bug, and what the bug is */
  const FIX = [
    { good:'<h1>Hello</h1>', bad:['<h1>Hello<h1>', '<h1>Hello</h2>'], why:{ en:'A closing tag needs a /', es:'Una etiqueta de cierre necesita /' } },
    { good:'<p>I like dogs.</p>', bad:['<p>I like dogs.</p', 'p>I like dogs.</p>'], why:{ en:'Every tag has < and >', es:'Cada etiqueta tiene < y >' } },
    { good:'<b>Wow</b>', bad:['<b>Wow</i>', '</b>Wow<b>'], why:{ en:'Close the same tag you opened', es:'Cierra la misma etiqueta que abriste' } },
    { good:'<li>Tacos</li>', bad:['<li>Tacos<li>', '<li>Tacos</l>'], why:{ en:'The closing tag has the same name', es:'La etiqueta de cierre tiene el mismo nombre' } },
    { good:'<h2>Pets</h2>', bad:['<h2>Pets</h2', '<h2 Pets</h2>'], why:{ en:'Every tag has < and >', es:'Cada etiqueta tiene < y >' } },
    { good:'<p>So <b>cool</b>!</p>', bad:['<p>So <b>cool</p>!</b>', '<p>So <b>cool!</p>'], why:{ en:'Close the inside tag first', es:'Cierra primero la etiqueta de adentro' } },
    { good:'<i>Fast</i>', bad:['<i>Fast<i/>', '<I>Fast</b>'], why:{ en:'The / goes right after <', es:'La / va justo después de <' } },
    { good:'<a href="#">Go</a>', bad:['<a href="#">Go<a>', '<a href="#">Go</href>'], why:{ en:'Close a link with </a>', es:'Cierra un enlace con </a>' } }
  ];

  /* my first page: where it starts, and what to try */
  const PAGE_START = '<h1>All about me</h1>\n<p>My name is ...</p>\n';
  const GOALS = [
    { id:'h1', en:'A big heading <h1>', es:'Un título grande <h1>', test:s => /<h1>[^<]*\S[^<]*<\/h1>/i.test(s) },
    { id:'p2', en:'Two paragraphs <p>', es:'Dos párrafos <p>', test:s => (s.match(/<p>(?!\s*<\/p>)[\s\S]*?<\/p>/gi) || []).length >= 2 },
    { id:'bi', en:'Bold <b> or italic <i> words', es:'Palabras en negrita <b> o cursiva <i>', test:s => /<(b|i)>[\s\S]*?\S[\s\S]*?<\/\1>/i.test(s) },
    { id:'list', en:'A list with 3 things <li>', es:'Una lista con 3 cosas <li>', test:s => /<ul>/i.test(s) && (s.match(/<li>(?!\s*<\/li>)[\s\S]*?<\/li>/gi) || []).length >= 3 },
    { id:'img', en:'A picture <img>', es:'Una imagen <img>', test:s => /<img\s[^>]*src=/i.test(s) }
  ];

  /* how a score is made out of 100 */
  const score = (right, total) => total ? Math.min(100, Math.round(100 * right / total)) : 0;

  const HTMLLESSONS = { ACTS, CARDS, TYPE, CLOSE, MATCH_WORDS, MATCH_TAGS, wrap, BUILD, FIX, PAGE_START, GOALS, score };
  if(typeof module !== 'undefined') module.exports = HTMLLESSONS; else root.HTMLLESSONS = HTMLLESSONS;
})(this);
