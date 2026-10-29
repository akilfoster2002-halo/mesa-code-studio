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

  /* =================================================================
     HTML CLASS 1 — the lesson in the slides (Intro to HTML & CSS, class 1),
     as one 15-minute assignment. Every question that is missed comes
     back at the end of its round, so each idea is answered right at least
     once. Ids are letters only (the server keeps scores by id).
     ================================================================= */
  const C1_ACTS = [
    { id:'cwords', icon:'📖', min:2, title:{ en:'Words for Today', es:'Palabras de hoy' }, line:{ en:'website, browser, HTML, CSS, tag, element…', es:'sitio web, navegador, HTML, CSS, etiqueta, elemento…' } },
    { id:'csort',  icon:'🎨', min:1, title:{ en:'HTML or CSS?', es:'¿HTML o CSS?' }, line:{ en:'HTML builds the page. CSS styles it.', es:'HTML construye la página. CSS le da estilo.' } },
    { id:'cparts', icon:'🔍', min:2, title:{ en:'Anatomy of a Tag', es:'Partes de una etiqueta' }, line:{ en:'Opening tag + content + closing tag = element', es:'Etiqueta de apertura + contenido + etiqueta de cierre = elemento' } },
    { id:'cjobs',  icon:'🏷', min:2, title:{ en:'Every Tag Has a Job', es:'Cada etiqueta tiene un trabajo' }, line:{ en:'DOCTYPE, html, head, title, style, body, h1, p', es:'DOCTYPE, html, head, title, style, body, h1, p' } },
    { id:'cplace', icon:'🗂', min:1, title:{ en:'Head or Body?', es:'¿Head o body?' }, line:{ en:'What goes where on the page', es:'Qué va en cada parte de la página' } },
    { id:'corder', icon:'🧱', min:2, title:{ en:'Put It in Order', es:'Ponlo en orden' }, line:{ en:'Build the Captain Byte page, line by line', es:'Arma la página de Captain Byte, línea por línea' } },
    { id:'ctype',  icon:'⌨️', min:4, title:{ en:'Type It With Me', es:'Escríbelo conmigo' }, line:{ en:'Type captain-byte.html, every line', es:'Escribe captain-byte.html, cada línea' } },
    { id:'cexit',  icon:'🎟', min:1, title:{ en:'Exit Ticket', es:'Boleto de salida' }, line:{ en:'3 questions before you go', es:'3 preguntas antes de irte' } }
  ];

  // a question: the prompt (code or words), the answer, and the wrong choices
  const C1_WORDS = [
    { q:'website', a:{ en:'Pages on the internet you can visit', es:'Páginas en internet que puedes visitar' } },
    { q:'browser', a:{ en:'The app that reads code and shows the page', es:'La app que lee el código y muestra la página' } },
    { q:'HTML', a:{ en:'HyperText Markup Language: what is on a page', es:'HyperText Markup Language: lo que hay en la página' } },
    { q:'CSS', a:{ en:'Cascading Style Sheets: how a page looks', es:'Cascading Style Sheets: cómo se ve la página' } },
    { q:'tag', a:{ en:'A keyword in < > that tells the browser what to show', es:'Una palabra en < > que le dice al navegador qué mostrar' } },
    { q:'opening tag', a:{ en:'Starts an element, like <h1>', es:'Empieza un elemento, como <h1>' } },
    { q:'closing tag', a:{ en:'Ends an element and has a /, like </h1>', es:'Termina un elemento y tiene /, como </h1>' } },
    { q:'element', a:{ en:'Everything from the start tag to the end tag', es:'Todo desde la etiqueta de inicio hasta la de cierre' } },
    { q:'head', a:{ en:'Information about the page (not shown on it)', es:'Información sobre la página (no se ve en ella)' } },
    { q:'body', a:{ en:'Everything you see on the page', es:'Todo lo que ves en la página' } }
  ];
  const C1_SORT = [
    { q:{ en:'Headings', es:'Títulos' }, a:'HTML' }, { q:{ en:'Text', es:'Texto' }, a:'HTML' },
    { q:{ en:'Pictures', es:'Imágenes' }, a:'HTML' }, { q:{ en:'Links', es:'Enlaces' }, a:'HTML' },
    { q:{ en:'What is on a page', es:'Lo que hay en una página' }, a:'HTML' }, { q:{ en:'The skeleton of a page', es:'El esqueleto de una página' }, a:'HTML' },
    { q:{ en:'Colors', es:'Colores' }, a:'CSS' }, { q:{ en:'Fonts', es:'Fuentes' }, a:'CSS' },
    { q:{ en:'Sizes', es:'Tamaños' }, a:'CSS' }, { q:{ en:'Spacing', es:'Espacio' }, a:'CSS' },
    { q:{ en:'How a page looks', es:'Cómo se ve una página' }, a:'CSS' }, { q:{ en:'The paint', es:'La pintura' }, a:'CSS' }
  ];
  // anatomy: an element, split into its three parts
  const C1_ELEMENTS = [
    ['<h1>', 'Computer Science Class', '</h1>'], ['<p>', 'My first paragraph.', '</p>'],
    ['<title>', 'My first Title', '</title>'], ['<h1>', 'Captain Byte', '</h1>']
  ];
  const C1_TAGS = ['<p>', '</body>', '<title>', '</h1>', '<head>', '</html>', '<body>', '</title>', '<h1>', '</p>'];
  // every tag has a job (the slide "Example explained"); asked both ways round
  const C1_JOBS = [
    { tag:'<!DOCTYPE html>', job:{ en:'Says this is an HTML5 page', es:'Dice que es una página HTML5' } },
    { tag:'<html>', job:{ en:'The root (main) element of the page', es:'El elemento raíz (principal) de la página' } },
    { tag:'<head>', job:{ en:'Information about the page', es:'Información sobre la página' } },
    { tag:'<title>', job:{ en:'The name in the browser tab', es:'El nombre en la pestaña del navegador' } },
    { tag:'<style>', job:{ en:'Where the CSS goes (inside the head)', es:'Donde va el CSS (dentro del head)' } },
    { tag:'<body>', job:{ en:'Everything you see on the page', es:'Todo lo que ves en la página' } },
    { tag:'<h1>', job:{ en:'A large heading', es:'Un título grande' } },
    { tag:'<p>', job:{ en:'A paragraph', es:'Un párrafo' } }
  ];
  const C1_PLACE = [
    { q:'<title>Captain Byte</title>', a:'head' }, { q:'<style> … </style>', a:'head' },
    { q:{ en:'The name in the browser tab', es:'El nombre en la pestaña' }, a:'head' }, { q:{ en:'All the CSS', es:'Todo el CSS' }, a:'head' },
    { q:'<h1>Captain Byte</h1>', a:'body' }, { q:'<p>My first paragraph.</p>', a:'body' },
    { q:{ en:'Everything you see on the page', es:'Todo lo que ves en la página' }, a:'body' }, { q:{ en:'Headings and paragraphs', es:'Títulos y párrafos' }, a:'body' }
  ];
  // the Captain Byte page (the code-along), then the same page with a style rule
  const C1_PAGE = [
    [0, '<!DOCTYPE html>'], [0, '<html>'], [0, '<head>'], [1, '<title>Captain Byte</title>'], [1, '<style>'],
    [2, '/* All my CSS will go here */'], [1, '</style>'], [0, '</head>'], [0, '<body>'], [1, '<h1>Captain Byte</h1>'], [0, '</body>'], [0, '</html>']
  ];
  const C1_ORDER = [
    [[0, '<html>'], [0, '<head>'], [1, '<title>Captain Byte</title>'], [0, '</head>'], [0, '<body>'], [1, '<h1>Captain Byte</h1>'], [0, '</body>'], [0, '</html>']],
    [[0, '<!DOCTYPE html>'], [0, '<html>'], [0, '<head>'], [1, '<title>Page Title</title>'], [1, '<style>'], [2, 'h1 { color: orange; }'], [1, '</style>'], [0, '</head>'],
      [0, '<body>'], [1, '<h1>My First Heading</h1>'], [1, '<p>My first paragraph.</p>'], [0, '</body>'], [0, '</html>']]
  ];
  // exit ticket: two to pick, then write an h1 (any food)
  const C1_EXIT = [
    { q:{ en:'What is the difference between HTML and CSS?', es:'¿Cuál es la diferencia entre HTML y CSS?' },
      a:{ en:'HTML builds what is on the page. CSS styles how it looks.', es:'HTML construye lo que hay en la página. CSS le da estilo.' },
      no:[{ en:'HTML styles the page. CSS builds it.', es:'HTML le da estilo. CSS la construye.' }, { en:'They are the same thing.', es:'Son lo mismo.' }] },
    { q:{ en:'What goes in the <head>, and what goes in the <body>?', es:'¿Qué va en el <head> y qué va en el <body>?' },
      a:{ en:'Head: the title and the CSS. Body: everything you see.', es:'Head: el título y el CSS. Body: todo lo que ves.' },
      no:[{ en:'Head: the heading. Body: the title.', es:'Head: el título grande. Body: el nombre de la pestaña.' }, { en:'Everything goes in the head.', es:'Todo va en el head.' }] },
    { q:{ en:'What is the #1 bug?', es:'¿Cuál es el error #1?' },
      a:{ en:'A missing closing tag, like </h1>', es:'Falta una etiqueta de cierre, como </h1>' },
      no:[{ en:'Too many paragraphs', es:'Demasiados párrafos' }, { en:'A title that is too long', es:'Un título muy largo' }] }
  ];
  // the last question: an h1 with something inside
  const C1_H1 = s => /^\s*<h1>\s*[^<\s][^<]*<\/h1>\s*$/i.test(s);

  /* MY HTML WEBSITE — the page each student types in the Classroom's editor
     (it becomes their resume website). What it has so far: */
  const SITE_MAX = 60000;
  const SITE_PARTS = [
    { id:'doctype', en:'<!DOCTYPE html>', test:s => /<!doctype\s+html>/i.test(s) },
    { id:'html', en:'<html> … </html>', test:s => /<html[^>]*>[\s\S]*<\/html>/i.test(s) },
    { id:'head', en:'<head> … </head>', test:s => /<head>[\s\S]*<\/head>/i.test(s) },
    { id:'title', en:'<title> … </title>', test:s => /<title>[^<]*\S[^<]*<\/title>/i.test(s) },
    { id:'style', en:'<style> … </style>', test:s => /<head>[\s\S]*<style>[\s\S]*<\/style>[\s\S]*<\/head>/i.test(s) },
    { id:'body', en:'<body> … </body>', test:s => /<body>[\s\S]*<\/body>/i.test(s) },
    { id:'h1', en:'<h1> … </h1>', test:s => /<body>[\s\S]*<h1>[^<]*\S[^<]*<\/h1>[\s\S]*<\/body>/i.test(s) }
  ];
  const siteInfo = s => { s = typeof s === 'string' ? s : ''; const has = SITE_PARTS.filter(p => p.test(s)).map(p => p.id);
    return { len:s.length, has, ok:has.length === SITE_PARTS.length }; };

  /* how a score is made out of 100 */
  const score = (right, total) => total ? Math.min(100, Math.round(100 * right / total)) : 0;

  const HTMLLESSONS = { ACTS, CARDS, TYPE, CLOSE, MATCH_WORDS, MATCH_TAGS, wrap, BUILD, FIX, PAGE_START, GOALS, score,
    C1_ACTS, C1_WORDS, C1_SORT, C1_ELEMENTS, C1_TAGS, C1_JOBS, C1_PLACE, C1_PAGE, C1_ORDER, C1_EXIT, C1_H1, SITE_MAX, SITE_PARTS, siteInfo };
  if(typeof module !== 'undefined') module.exports = HTMLLESSONS; else root.HTMLLESSONS = HTMLLESSONS;
})(this);
