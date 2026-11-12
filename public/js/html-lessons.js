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
     (it becomes their resume website). What it has so far, part by part
     (part 1 = the skeleton, part 2 = the About Me and Contact sections): */
  const SITE_MAX = 60000;
  const SITE_GROUPS = [
    { n:1, en:'Part 1 · The skeleton', es:'Parte 1 · El esqueleto' },
    { n:2, en:'Part 2 · About Me & Contact', es:'Parte 2 · Sobre mí y Contacto' },
    { n:3, en:'Part 3 · All the sections', es:'Parte 3 · Todas las secciones' },
    { n:4, en:'Part 4 · CSS: the page & the words', es:'Parte 4 · CSS: la página y las letras' },
    { n:5, en:'Part 5 · CSS: the avatar & the boxes', es:'Parte 5 · CSS: el avatar y las cajas' }
  ];
  // a section's list: the <h2> (any of the words in `head`), then its <ul> or <ol> before the next <h2>, with at least n <li>
  const LIST = (s, head, tag, n) => { const m = s.match(new RegExp('<h2[^>]*>[^<]*(?:' + head + ')[^<]*<\\/h2>(?:(?!<h2)[\\s\\S])*?<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
    return !!m && (m[1].match(/<li[\s>]/gi) || []).length >= n; };
  // CSS in the page's <style>: the declarations of every rule for one selector ("body", "h1"…),
  // so  css(s, 'h1', 'font-size')  is true when some h1 rule sets a font-size (comments don't count)
  const STYLE = s => ((s.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const RULES = (s, sel) => { let out = '';
    STYLE(s).replace(/([^{}]+)\{([^{}]*)\}/g, (m, sels, decl) => { if(sels.split(',').some(x => x.trim().toLowerCase() === sel)) out += ';' + decl; return m; });
    return out; };
  const css = (s, sel, prop, val) => new RegExp('[;\\s]' + prop + '\\s*:\\s*' + (val || '[^;]*[^;\\s]'), 'i').test(RULES(s, sel));
  const ABOUT = '<h2>\\s*(?:about me|sobre m[ií])\\s*<\\/h2>', CONTACT = '<h2>\\s*(?:contact|contacto)\\s*<\\/h2>';
  const SITE_PARTS = [
    { id:'doctype', group:1, en:'<!DOCTYPE html>', test:s => /<!doctype\s+html>/i.test(s) },
    { id:'html', group:1, en:'<html> … </html>', test:s => /<html[^>]*>[\s\S]*<\/html>/i.test(s) },
    { id:'head', group:1, en:'<head> … </head>', test:s => /<head>[\s\S]*<\/head>/i.test(s) },
    { id:'title', group:1, en:'<title> … </title>', test:s => /<title>[^<]*\S[^<]*<\/title>/i.test(s) },
    { id:'style', group:1, en:'<style> … </style>', test:s => /<head>[\s\S]*<style>[\s\S]*<\/style>[\s\S]*<\/head>/i.test(s) },
    { id:'body', group:1, en:'<body> … </body>', test:s => /<body>[\s\S]*<\/body>/i.test(s) },
    { id:'h1', group:1, en:'<h1> … </h1>', test:s => /<body>[\s\S]*<h1>[^<]*\S[^<]*<\/h1>[\s\S]*<\/body>/i.test(s) },
    { id:'headline', group:2, en:'<p><em>[headline]</em></p>', say:{ en:'A one-line headline under your name', es:'Un titular de una línea bajo tu nombre' },
      test:s => /<body>[\s\S]*<p>\s*<em>[^<]*\S[^<]*<\/em>\s*<\/p>/i.test(s) },
    { id:'about', group:2, en:'<h2>About Me</h2>', say:{ en:'An About Me heading', es:'Un subtítulo About Me' }, test:s => new RegExp(ABOUT, 'i').test(s) },
    { id:'aboutp', group:2, en:'<p>[About Me]</p>', say:{ en:'A paragraph under About Me', es:'Un párrafo bajo About Me' },
      test:s => new RegExp(ABOUT + '\\s*<p>[\\s\\S]*?\\S[\\s\\S]*?<\\/p>', 'i').test(s) },
    { id:'contact', group:2, en:'<h2>Contact</h2>', say:{ en:'A Contact heading', es:'Un subtítulo Contact' }, test:s => new RegExp(CONTACT, 'i').test(s) },
    { id:'br', group:2, en:'Email … <br> School …', say:{ en:'Email and School on two lines with <br>', es:'Email y School en dos líneas con <br>' },
      test:s => new RegExp(CONTACT + '\\s*<p>[^]*?email[^]*?<br\\s*\\/?>[^]*?school[^]*?<\\/p>', 'i').test(s) },
    { id:'oneh1', group:2, en:'Only one <h1>', say:{ en:'One <h1>, an <h2> for each section', es:'Un <h1>, un <h2> para cada sección' },
      test:s => (s.match(/<h1[\s>]/gi) || []).length === 1 && (s.match(/<h2[\s>]/gi) || []).length >= 2 },
    { id:'brackets', group:2, en:'[placeholders]', say:{ en:'Placeholders stay in [brackets]: no real information yet', es:'Los espacios quedan entre [corchetes]: nada de información real todavía' },
      test:s => (s.match(/\[[^\]<\n]+\]/g) || []).length >= 3 && !/@/.test(s.replace(/<head>[\s\S]*<\/head>/i, '')) },
    // Part 3 · every section of the resume, in HTML (as in the example page)
    { id:'header', group:3, en:'<header> h1 + img + headline </header>', say:{ en:'Your name, avatar and headline together in a <header>', es:'Tu nombre, avatar y titular juntos en un <header>' },
      test:s => /<header[\s>](?:(?!<\/header>)[\s\S])*<h1[\s>](?:(?!<\/header>)[\s\S])*<img[\s>](?:(?!<\/header>)[\s\S])*<em>[\s\S]*?<\/header>/i.test(s) },
    { id:'avatar', group:3, en:'<img src="…" alt="…">', say:{ en:'Your avatar, with alt words that describe it', es:'Tu avatar, con palabras alt que lo describen' },
      test:s => /<img\s[^>]*src\s*=\s*["'][^"']+["'][^>]*>/i.test(s) && /<img\s[^>]*alt\s*=\s*["'][^"']*\w[^"']*\w[^"']*["'][^>]*>/i.test(s) },
    { id:'education', group:3, en:'<h2>Education</h2> + <ul>', say:{ en:'Education: your school, grade and year in a list', es:'Educación: tu escuela, grado y año en una lista' },
      test:s => LIST(s, 'education|educaci', 'ul', 1) },
    { id:'skills', group:3, en:'<h2>Skills</h2> + <ul> (3 <li>)', say:{ en:'Skills: at least 3 things you are good at', es:'Habilidades: por lo menos 3 cosas que haces bien' },
      test:s => LIST(s, 'skill|habilidad', 'ul', 3) },
    { id:'activities', group:3, en:'<h2>Activities and Experience</h2> + <ul>', say:{ en:'Clubs, sports, jobs or helping out, in a list', es:'Clubes, deportes, trabajos o ayudar, en una lista' },
      test:s => LIST(s, 'activit|experien|actividad', 'ul', 1) },
    { id:'projects', group:3, en:'<h2>Projects</h2> + <ol>', say:{ en:'Projects in a numbered list (<ol>)', es:'Proyectos en una lista numerada (<ol>)' },
      test:s => LIST(s, 'project|proyecto', 'ol', 1) },
    { id:'languages', group:3, en:'<h2>Languages</h2> + <ul>', say:{ en:'The languages you speak, in a list', es:'Los idiomas que hablas, en una lista' },
      test:s => LIST(s, 'language|idioma', 'ul', 1) },
    { id:'sections', group:3, en:'<section> … </section> × 7', say:{ en:'Each section (About Me to Languages) inside its own <section>', es:'Cada sección (About Me hasta Languages) dentro de su propio <section>' },
      test:s => (s.match(/<section[\s>][\s\S]*?<\/section>/gi) || []).length >= 7 },
    { id:'footer', group:3, en:'<footer> … </footer>', say:{ en:'A footer at the bottom with your name and the year', es:'Un pie de página al final con tu nombre y el año' },
      test:s => /<footer[\s>][\s\S]*?<p[\s>][\s\S]*?<\/footer>/i.test(s) },
    // Part 4 · CSS for the whole page, the name, the section titles and the lists
    { id:'cssbg', group:4, en:'body { background-color }', say:{ en:'A background color for the whole page', es:'Un color de fondo para toda la página' },
      test:s => css(s, 'body', 'background-color') },
    { id:'csscolor', group:4, en:'body { color }', say:{ en:'A color for the words', es:'Un color para las letras' }, test:s => css(s, 'body', 'color') },
    { id:'cssfont', group:4, en:'body { font-family }', say:{ en:'A font for the page, like Verdana, sans-serif', es:'Una letra (fuente) para la página, como Verdana, sans-serif' },
      test:s => css(s, 'body', 'font-family') },
    { id:'csscenter', group:4, en:'body { max-width; margin: 0 auto }', say:{ en:'The page is not too wide, and it sits in the middle', es:'La página no es muy ancha y queda en el centro' },
      test:s => css(s, 'body', 'max-width') && css(s, 'body', 'margin', '0(px)?\\s+auto') },
    { id:'csspad', group:4, en:'body { padding }', say:{ en:'Space between the edge and your words', es:'Espacio entre el borde y tus palabras' }, test:s => css(s, 'body', 'padding') },
    { id:'cssh1', group:4, en:'h1 { color; font-size }', say:{ en:'Your name has its own color and a big size', es:'Tu nombre tiene su propio color y un tamaño grande' },
      test:s => css(s, 'h1', 'color') && css(s, 'h1', 'font-size') },
    { id:'cssh1c', group:4, en:'h1 { text-align: center }', say:{ en:'Your name is in the center', es:'Tu nombre está en el centro' }, test:s => css(s, 'h1', 'text-align', 'center') },
    { id:'cssh2', group:4, en:'h2 { color }', say:{ en:'Every section title has a color', es:'Cada título de sección tiene un color' }, test:s => css(s, 'h2', 'color') },
    { id:'cssli', group:4, en:'li { font-size }', say:{ en:'A size for the words in your lists', es:'Un tamaño para las palabras de tus listas' }, test:s => css(s, 'li', 'font-size') },
    // Part 5 · CSS for the avatar, the white boxes (<section>) and the top and bottom (<header>, <footer>)
    { id:'cssimg', group:5, en:'img { width }', say:{ en:'The avatar has a size (like 150px)', es:'El avatar tiene un tamaño (como 150px)' }, test:s => css(s, 'img', 'width') },
    { id:'cssborder', group:5, en:'img { border }', say:{ en:'A border around the avatar, like 5px solid purple', es:'Un borde alrededor del avatar, como 5px solid purple' },
      test:s => css(s, 'img', 'border') },
    { id:'cssround', group:5, en:'img { border-radius: 50% }', say:{ en:'The avatar is a circle', es:'El avatar es un círculo' }, test:s => css(s, 'img', 'border-radius', '50%') },
    { id:'csssection', group:5, en:'section { background-color; padding }', say:{ en:'Each section is a box with a color and space inside', es:'Cada sección es una caja con color y espacio adentro' },
      test:s => css(s, 'section', 'background-color') && css(s, 'section', 'padding') },
    { id:'csssround', group:5, en:'section { margin; border-radius }', say:{ en:'Space between the boxes, and round corners', es:'Espacio entre las cajas y esquinas redondas' },
      test:s => css(s, 'section', 'margin') && css(s, 'section', 'border-radius') },
    { id:'csshf', group:5, en:'header, footer { text-align: center }', say:{ en:'The top and the bottom are in the center', es:'Lo de arriba y lo de abajo están en el centro' },
      test:s => css(s, 'header', 'text-align', 'center') && css(s, 'footer', 'text-align', 'center') }
  ];
  const siteInfo = s => { s = typeof s === 'string' ? s : ''; const has = SITE_PARTS.filter(p => p.test(s)).map(p => p.id);
    return { len:s.length, has, ok:has.length === SITE_PARTS.length }; };

  /* WEBSITE PRESENTATION — a short, simple encyclopedia page about Mario
     (set out like a Wikipedia article: an infobox of facts, sections, fun
     facts, references). Each student turns it into a page about the
     character their teacher gives them (html.wikiChar), then presents it. */
  // the Mario page's own pictures, in its files folder from the start (as if they sat beside it on a desktop)
  const WIKI_PIC = '/img/wiki/';
  const WIKI_FILES = { 'mario.svg':WIKI_PIC + 'mario.svg', 'mushroom.svg':WIKI_PIC + 'mushroom.svg' };
  const WIKI_START = `<!DOCTYPE html>
<!-- A comment like this is a note for people. The browser does not show it. -->
<!-- Un comentario como este es una nota para personas. El navegador no lo muestra. -->
<html>
<head>
  <!-- The words on the browser tab / Las palabras en la pestaña -->
  <title>Mario - Classpedia</title>
  <!-- CSS: how the page looks (fonts, colors, boxes) / CSS: cómo se ve la página -->
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 20px auto; padding: 0 16px; color: #202122; line-height: 1.6; }
    h1 { font-family: Georgia, serif; font-weight: normal; border-bottom: 1px solid #a2a9b1; margin-bottom: 0; }
    h2 { font-family: Georgia, serif; font-weight: normal; border-bottom: 1px solid #a2a9b1; }
    a { color: #3366cc; }
    .from { color: #54595d; font-size: 14px; margin-top: 4px; }
    .infobox { float: right; width: 260px; margin: 0 0 16px 16px; border: 1px solid #a2a9b1; background: #f8f9fa; font-size: 14px; border-collapse: collapse; }
    .infobox th, .infobox td { padding: 4px 8px; text-align: left; vertical-align: top; }
    .infobox .top { text-align: center; font-size: 18px; background: #ccccff; }
    .infobox img { width: 100%; }
    .pic { float: right; width: 200px; margin: 0 0 12px 16px; border: 1px solid #c8ccd1; background: #f8f9fa; padding: 4px; font-size: 13px; }
    .pic img { width: 100%; }
    blockquote { margin: 12px 0; padding: 8px 16px; border-left: 4px solid #a2a9b1; background: #f8f9fa; font-style: italic; }
  </style>
</head>
<body>
  <!-- <h1>: the big title. Only one on the page. / El título grande. Solo uno. -->
  <h1>Mario</h1>
  <p class="from">From Classpedia, the free class encyclopedia</p>

  <!-- <table>: the box of facts on the right. <tr> is a row, <th> a label, <td> a fact. -->
  <!-- El cuadro de datos. <tr> es una fila, <th> una etiqueta, <td> un dato. -->
  <table class="infobox">
    <tr><th colspan="2" class="top">Mario</th></tr>
    <!-- <img>: a picture from your 📁 Files, by its name / una imagen de tus archivos -->
    <tr><td colspan="2"><img src="mario.svg" alt="A drawing of Mario"></td></tr>
    <tr><th>First seen</th><td>Donkey Kong (1981)</td></tr>
    <tr><th>Made by</th><td>Shigeru Miyamoto</td></tr>
    <tr><th>Species</th><td>Human</td></tr>
    <tr><th>Home</th><td>Mushroom Kingdom</td></tr>
    <tr><th>Family</th><td>Luigi (brother)</td></tr>
  </table>

  <!-- <p>: a paragraph. <b> makes words bold, <i> makes them slanted (italic). -->
  <!-- Un párrafo. <b> pone las palabras en negrita, <i> en cursiva. -->
  <p><b>Mario</b> is a video game character made by Nintendo. He is a plumber who wears a red hat and blue overalls. He is the star of the <i>Super Mario</i> games.</p>

  <!-- <h2>: a section title. Each section has an <h2> and a <p>. -->
  <!-- El título de una sección. Cada sección tiene un <h2> y un <p>. -->
  <h2>Looks</h2>
  <p>Mario is short and has a big mustache. His red hat has a letter M on it.</p>

  <h2>Personality</h2>
  <p>Mario is brave and kind. He always helps his friends.</p>

  <!-- <blockquote>: words someone said / palabras que alguien dijo -->
  <blockquote>"It's-a me, Mario!"</blockquote>

  <h2>Powers</h2>
  <!-- <figure>: a picture in the article, with a <figcaption> under it -->
  <!-- Una imagen en el artículo, con un pie de foto <figcaption> -->
  <figure class="pic">
    <img src="mushroom.svg" alt="A Super Mushroom">
    <figcaption>A Super Mushroom makes Mario big.</figcaption>
  </figure>
  <p>Mario can jump very high. When he eats a <b>Super Mushroom</b>, he grows big. A <b>Fire Flower</b> lets him throw fireballs.</p>

  <h2>Story</h2>
  <p>Mario lives in the Mushroom Kingdom. Again and again, he saves Princess Peach from Bowser.</p>

  <!-- <ol>: an ordered list, with numbers (1, 2, 3…). Each thing in it is an <li>. -->
  <!-- Una lista ordenada, con números. Cada cosa en ella es un <li>. -->
  <h2>Games, in order</h2>
  <ol>
    <li><i>Donkey Kong</i> (1981)</li>
    <li><i>Mario Bros.</i> (1983)</li>
    <li><i>Super Mario Bros.</i> (1985)</li>
    <li><i>Super Mario 64</i> (1996)</li>
    <li><i>Super Mario Odyssey</i> (2017)</li>
  </ol>

  <!-- <ul>: an unordered list, with dots (•). Each thing in it is an <li> too. -->
  <!-- Una lista sin orden, con puntos. Cada cosa en ella también es un <li>. -->
  <h2>Fun facts</h2>
  <ul>
    <li>Mario was first called Jumpman.</li>
    <li>His brother Luigi is taller than he is.</li>
    <li>Mario has been in more than 200 games.</li>
  </ul>

  <!-- <a href="…">: a link. Put where you found your facts here. -->
  <!-- Un enlace. Pon aquí dónde encontraste tus datos. -->
  <h2>References</h2>
  <ol>
    <li><a href="https://en.wikipedia.org/wiki/Mario">Mario - Wikipedia</a></li>
  </ol>
</body>
</html>
`;
  const WIKI_GROUPS = [
    { n:1, en:'Part 1 · Make it your character', es:'Parte 1 · Hazla de tu personaje' },
    { n:2, en:'Part 2 · Keep the encyclopedia parts', es:'Parte 2 · Deja las partes de la enciclopedia' }
  ];
  // the words of the Mario page: none may be left (unless they are in the student's own character's name)
  const MARIO_WORDS = ['mario', 'luigi', 'mushroom kingdom', 'nintendo', 'miyamoto', 'bowser', 'peach', 'jumpman', 'donkey kong'];
  const textOf = s => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const same = (a, b) => textOf(a).toLowerCase() === textOf(b).toLowerCase();
  // the name in the big title (still Mario = not changed yet)
  const h1Of = s => { const m = s.match(/<body[^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i), n = m ? textOf(m[1]) : ''; return /mario/i.test(n) ? '' : n; };
  const WIKI_PARTS = [
    { id:'name', group:1, en:'<h1>[your character]</h1>', say:{ en:'The big title is your character’s name', es:'El título grande es el nombre de tu personaje' },
      test:(s, who) => { const n = h1Of(s); return !!n && (!who || n.toLowerCase().includes(who.toLowerCase())); } },
    { id:'title', group:1, en:'<title>', say:{ en:'The tab says the name too', es:'La pestaña también dice el nombre' },
      test:s => { const n = h1Of(s), t = (s.match(/<title>([^<]*)<\/title>/i) || [])[1]; return !!n && !!t && textOf(t).toLowerCase().includes(n.toLowerCase()); } },
    { id:'bold', group:1, en:'<p><b>[name]</b> is…', say:{ en:'The first paragraph starts with the name in bold', es:'El primer párrafo empieza con el nombre en negrita' },
      test:s => { const m = s.match(/<p>\s*<b>([^<]+)<\/b>/i); return !!m && !!h1Of(s) && same(m[1], h1Of(s)); } },
    { id:'img', group:1, en:'<img src="…"> × 2', say:{ en:'Your own pictures: one in the box, one in the article (🖼 Add picture)', es:'Tus propias imágenes: una en el cuadro y una en el artículo (🖼 Añadir imagen)' },
      test:s => { const srcs = [...s.matchAll(/<img[^>]*\ssrc\s*=\s*["']?([^"'\s>]+)/gi)].map(m => m[1]);
        return srcs.length >= 2 && srcs.every(x => !WIKI_FILES[x] && !x.includes(WIKI_PIC) && (/^(https?:\/\/|data:image\/|\/api\/assets\/)/i.test(x) || FILE_NAME.test(x))); } },
    { id:'nomario', group:1, en:'No Mario', say:{ en:'Nothing about Mario is left', es:'No queda nada de Mario' },
      test:(s, who) => { const t = s.toLowerCase(), me = (who || '').toLowerCase(); return MARIO_WORDS.every(x => me.includes(x) || !t.includes(x)); } },
    { id:'infobox', group:2, en:'<table class="infobox">', say:{ en:'The box of facts, with at least 5 rows', es:'El cuadro de datos, con 5 filas o más' },
      test:s => { const m = s.match(/<table[^>]*class\s*=\s*["']?infobox[\s\S]*?<\/table>/i); return !!m && (m[0].match(/<tr[\s>]/gi) || []).length >= 5; } },
    { id:'sections', group:2, en:'<h2> + <p> × 4', say:{ en:'At least 4 sections, each a heading and a paragraph', es:'4 secciones o más, cada una con subtítulo y párrafo' },
      test:s => (s.match(/<h2[^>]*>[^<]*\S[^<]*<\/h2>\s*(<!--[\s\S]*?-->\s*)?(<figure[\s\S]*?<\/figure>\s*)?<p>[\s\S]*?\S[\s\S]*?<\/p>/gi) || []).length >= 4 },   // a picture may come first
    { id:'figure', group:2, en:'<figure> + <figcaption>', say:{ en:'A picture in the article with a caption under it', es:'Una imagen en el artículo con un pie de foto' },
      test:s => /<figure[^>]*>[\s\S]*?<img[^>]*>[\s\S]*?<figcaption>[^<]*\S[^<]*<\/figcaption>[\s\S]*?<\/figure>/i.test(s) },
    { id:'ol', group:2, en:'<ol> + <li> × 3', say:{ en:'A numbered list (like the games, in order)', es:'Una lista con números (como los juegos, en orden)' },
      test:s => /<ol[^>]*>(\s*<li>[\s\S]*?\S[\s\S]*?<\/li>){3,}/i.test(s) },
    { id:'facts', group:2, en:'<ul> + <li> × 3', say:{ en:'3 fun facts in a list with dots', es:'3 datos curiosos en una lista con puntos' },
      test:s => /<ul>(\s*<li>[\s\S]*?\S[\s\S]*?<\/li>){3,}/i.test(s) },
    { id:'refs', group:2, en:'<a href="…">', say:{ en:'A link to where you found your facts', es:'Un enlace a donde encontraste tus datos' },
      test:s => /<a[^>]*\shref\s*=\s*["']?https?:\/\/[^"'\s>]+/i.test(s) }
  ];
  const noComments = s => s.replace(/<!--[\s\S]*?(-->|$)/g, '');        // a tag named in a <!-- note --> is not on the page
  const wikiInfo = (s, who) => { s = typeof s === 'string' ? s : ''; who = typeof who === 'string' ? who.trim() : '';
    const code = noComments(s), has = s ? WIKI_PARTS.filter(p => p.test(code, who)).map(p => p.id) : [];
    return { len:s.length, has, ok:has.length === WIKI_PARTS.length }; };

  /* the pages a student types in the editor: My Resume (resume.html) and the
     Website Presentation (character.html). Each is kept in the Learn record as
     html[key], turned in at html[key + 'In']; a page that can be shared lists the
     classmates who can type in it too in html[key + 'Share']. */
  /* A page's files folder: pictures saved beside it, used in the code by their
     name (<img src="elsa.png">) as on a desktop. html[key + 'Files'] = { name:assetId };
     a page that starts with pictures (the Mario page) has those too. */
  const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,40}\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
  // a picture's file name from what the student's computer called it: "My Elsa (1).PNG" → my-elsa-1.png
  const fileName = (s, taken) => {
    const m = String(s || '').toLowerCase().match(/^(.*?)(?:\.([a-z0-9]+))?$/), ext = /^(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(m[2] || '') ? m[2] : 'png';
    const stem = (m[1] || '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'picture';
    let name = stem + '.' + ext;
    for(let n = 2; taken && taken[name]; n++) name = stem + '-' + n + '.' + ext;
    return name;
  };
  const filesOf = (site, html) => ({ ...(site.files || {}), ...Object.fromEntries(Object.entries((html || {})[site.key + 'Files'] || {}).map(([n, id]) => [n, '/api/assets/' + id])) });
  // the page as a browser shows it: a file's name in src="…" or href="…" becomes where the file is kept
  const withFiles = (text, files, origin) => String(text || '').replace(/(\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/gi,
    (all, at, q, v) => files[v.trim()] ? at + q + (origin || '') + files[v.trim()] + q : all);

  /* ---------------------------------------------------------------- GAME WEBSITE
     The culminating task: index.html, a landing page for the game the student
     made in Code Studio (at /game). It starts from a small skeleton: the head,
     empty CSS rules and a comment for each of the 7 sections; the student writes
     the rest. The checklist follows the 7 sections of the student guide, plus
     the self-check (style, no resume left, privacy, pictures). Comments never
     count: the starting code's comments tick nothing. */
  const GAME_START = `<!DOCTYPE html>
<html>
<head>
  <!-- The name on the browser tab: your game's title -->
  <title>Your Game Title</title>
  <style>
    /* The whole page: background color, text color and font */
    body {

    }
    /* Your game title */
    h1 {

    }
    /* Each section title */
    h2 {

    }
    /* Your pictures: their size and border */
    img {

    }
    /* The box around each section */
    section {

    }
  </style>
</head>
<body>
  <!-- 1. Top of the page: game title, a one-sentence tagline, a cover picture, a "How to play" button -->

  <!-- 2. How to play: the goal, every key and what it does, how you win, how you lose -->

  <!-- 3. Screenshots: 2 or 3 pictures of your game, each with alt text and a caption -->

  <!-- 4. Features: 3 short cards that explain why your game is fun -->

  <!-- 5. What players say: 1 or 2 kind quotes from classmates (first names only) -->

  <!-- 6. How I made it: a loop, an if/then, a bug you fixed, and what you learned -->

  <!-- 7. Footer: your first name and class period -->

</body>
</html>
`;
  const GAME_GROUPS = [
    { n:1, en:'1 · Top of the page', es:'1 · Parte de arriba' },
    { n:2, en:'2 · How to play', es:'2 · Cómo jugar' },
    { n:3, en:'3 · Screenshots', es:'3 · Capturas de pantalla' },
    { n:4, en:'4 · Features', es:'4 · Características' },
    { n:5, en:'5 · What players say', es:'5 · Lo que dicen los jugadores' },
    { n:6, en:'6 · How I made it', es:'6 · Cómo lo hice' },
    { n:7, en:'7 · Footer', es:'7 · Pie de página' },
    { n:8, en:'Style & self-check', es:'Estilo y autoevaluación' }
  ];
  const noNotes = s => String(s || '').replace(/<!--[\s\S]*?-->/g, '');
  const words = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  // one section of the game page: from its <h2> to the next <h2>, the footer or the end of the body
  const GSEC = (s, re) => (s.match(new RegExp('<h2[^>]*>[^<]*(?:' + re + ')[\\s\\S]*?(?=<h2[\\s>]|<footer[\\s>]|<\\/body>|$)', 'i')) || [''])[0];
  const imgs = s => s.match(/<img\b[^>]*>/gi) || [];
  const hasAlt = tag => /\balt\s*=\s*["'][^"']*\w[^"']*\w[^"']*["']/i.test(tag);
  const hasSrc = tag => /\bsrc\s*=\s*["'][^"']+["']/i.test(tag);
  const HOW = 'how to play|c[oó]mo jugar', SHOTS = 'screenshot|captura', FEAT = 'feature|fun|why|caracter[ií]stic|divertid',
    SAY = 'say|player|review|opin|dicen', MADE = 'made|make|built|hice|hecho';
  const RESUME_H2 = /<h2[^>]*>[^<]*(about me|education|skills|contact|languages|activities|sobre m[ií]|educaci[oó]n|habilidades|contacto|idiomas)[^<]*<\/h2>/i;
  const GAME_PARTS = [
    { id:'gtitle', group:1, en:'<title> = <h1>', say:{ en:'Your game title, in the browser tab and in the big heading', es:'El título de tu juego, en la pestaña y en el título grande' },
      test:s => { const t = words((s.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]).toLowerCase(), h = words((noNotes(s).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]).toLowerCase();
        return !!t && t !== 'your game title' && t === h; } },
    { id:'gtagline', group:1, en:'<p> tagline', say:{ en:'One sentence under the title that makes people want to play', es:'Una oración bajo el título que dé ganas de jugar' },
      test:s => /<\/h1>\s*<p[^>]*>(?:(?!<\/p>)[\s\S])*?\w/i.test(noNotes(s)) },
    { id:'gcover', group:1, en:'<img> cover picture', say:{ en:'A cover picture at the top, with alt text', es:'Una imagen de portada arriba, con texto alternativo' },
      test:s => { const top = noNotes(s).split(/<h2[\s>]/i)[0]; return imgs(top).some(t => hasSrc(t) && hasAlt(t)); } },
    { id:'gbutton', group:1, en:'<a href="#…"> How to play', say:{ en:'A "How to play" button that jumps to that section', es:'Un botón "How to play" que lleva a esa sección' },
      test:s => { s = noNotes(s); return [...s.matchAll(/<a\b[^>]*href\s*=\s*["']#([\w-]+)["']/gi)].some(m => new RegExp('\\bid\\s*=\\s*["\']' + m[1] + '["\']', 'i').test(s)); } },
    { id:'ghow', group:2, en:'<h2>How to play</h2>', say:{ en:'A How to play heading', es:'Un título How to play' }, test:s => !!GSEC(noNotes(s), HOW) },
    { id:'gkeys', group:2, en:'<ul> + <li> keys', say:{ en:'Every key and what it does, in a list', es:'Cada tecla y lo que hace, en una lista' },
      test:s => /<ul[\s>][\s\S]*?<li[\s>][\s\S]*?\w[\s\S]*?<\/ul>/i.test(GSEC(noNotes(s), HOW)) },
    { id:'gwinlose', group:2, en:'You win… You lose…', say:{ en:'The goal, how you win and how you lose', es:'La meta, cómo ganas y cómo pierdes' },
      test:s => { const t = words(GSEC(noNotes(s), HOW)); return /\bwin|\bgan[ao]s?\b|ganar/i.test(t) && /\blos[es]|\blost\b|\bpierd|perder/i.test(t); } },
    { id:'gshots', group:3, en:'<img> × 2 or more', say:{ en:'At least 2 pictures of your game being played', es:'Por lo menos 2 imágenes de tu juego' },
      test:s => imgs(GSEC(noNotes(s), SHOTS)).filter(hasSrc).length >= 2 },
    { id:'galt', group:3, en:'alt="…" on each', say:{ en:'Every screenshot has alt text that describes it', es:'Cada captura tiene texto alternativo que la describe' },
      test:s => { const i = imgs(GSEC(noNotes(s), SHOTS)); return i.length >= 2 && i.every(hasAlt); } },
    { id:'gcaps', group:3, en:'a caption for each', say:{ en:'A caption (a short sentence) under every screenshot', es:'Un pie de foto (una oración corta) bajo cada captura' },
      test:s => { const x = GSEC(noNotes(s), SHOTS), n = imgs(x).length;
        return n >= 2 && (x.match(/<(?:p|figcaption)\b[^>]*>(?:(?!<\/(?:p|figcaption)>)[\s\S])*?\w/gi) || []).length >= n; } },
    { id:'gfeat', group:4, en:'<h2> + 3 × <h3> + <p>', say:{ en:'3 cards: a short title and a sentence about why your game is fun', es:'3 tarjetas: un título corto y una oración de por qué tu juego es divertido' },
      test:s => { const x = GSEC(noNotes(s), FEAT); return (x.match(/<h3[\s>]/gi) || []).length >= 3 && (x.match(/<p[\s>]/gi) || []).length >= 3; } },
    { id:'gquotes', group:5, en:'"quote" – first name', say:{ en:'1 or 2 kind quotes from classmates, each with a first name', es:'1 o 2 citas amables de compañeros, cada una con un nombre' },
      test:s => /["“][^"”<]{3,}["”]\s*[–—-]\s*[A-ZÁÉÍÓÚÑ]/.test(words(GSEC(noNotes(s), SAY))) },
    { id:'gmade', group:6, en:'<h2>How I made it</h2>', say:{ en:'A How I made it heading (or How I will make it)', es:'Un título How I made it (o How I will make it)' },
      test:s => !!GSEC(noNotes(s), MADE) },
    { id:'gloop', group:6, en:'a loop', say:{ en:'Explain a loop in your game (forever, repeat…)', es:'Explica un bucle de tu juego (forever, repeat…)' },
      test:s => /\bloops?\b|forever|repeat|bucle|repetir/i.test(words(GSEC(noNotes(s), MADE))) },
    { id:'gif', group:6, en:'an if/then', say:{ en:'Explain an if/then in your game', es:'Explica un if/then (si/entonces) de tu juego' },
      test:s => /\bif\b|\bsi\b[\s\S]*entonces/i.test(words(GSEC(noNotes(s), MADE))) },
    { id:'gbug', group:6, en:'a bug I fixed', say:{ en:'A bug you fixed, and what you learned', es:'Un error que arreglaste, y lo que aprendiste' },
      test:s => /\bbugs?\b|\bfix|arregl|\berror/i.test(words(GSEC(noNotes(s), MADE))) },
    { id:'gfooter', group:7, en:'<footer> name · period', say:{ en:'Your first name and class period in a footer', es:'Tu nombre y tu período en un pie de página' },
      test:s => /<footer[\s>][\s\S]*?\b(period|per[ií]odo|per\.?\s*\d|p\s?\d)[\s\S]*?<\/footer>/i.test(noNotes(s)) },
    { id:'gcssbody', group:8, en:'body { background-color; color; font-family }', say:{ en:'Colors and a font for the whole page', es:'Colores y una letra para toda la página' },
      test:s => css(s, 'body', 'background-color') && css(s, 'body', 'color') && css(s, 'body', 'font-family') },
    { id:'gcssh', group:8, en:'h1 / h2 { color }', say:{ en:'Your headings have colors that match your game', es:'Tus títulos tienen colores que combinan con tu juego' },
      test:s => css(s, 'h1', 'color') || css(s, 'h2', 'color') },
    { id:'gcssimg', group:8, en:'img { width }', say:{ en:'Your pictures have a size', es:'Tus imágenes tienen un tamaño' }, test:s => css(s, 'img', 'width') },
    { id:'gpics', group:8, en:'every <img> has src + alt', say:{ en:'Every picture has a file name and alt text (no broken pictures)', es:'Cada imagen tiene nombre de archivo y texto alternativo' },
      test:s => { const i = imgs(noNotes(s)); return i.length >= 3 && i.every(t => hasSrc(t) && hasAlt(t)); } },
    { id:'gnoresume', group:8, en:'no resume left', say:{ en:'No About Me, Education, Skills or Contact sections from your resume', es:'Nada de tu currículum (About Me, Education, Skills, Contact)' },
      test:s => { s = noNotes(s); return (s.match(/<h2[\s>]/gi) || []).length >= 3 && !RESUME_H2.test(s); } },
    { id:'gprivacy', group:8, en:'privacy', say:{ en:'No last name, email or phone number: first name and period only', es:'Sin apellido, correo ni teléfono: solo tu nombre y período' },
      test:s => { const t = words(noNotes(s).replace(/<head[\s>][\s\S]*?<\/head>/i, '')); return t.length > 200 && !/@/.test(t) && !/\d{3}[\s.-]?\d{3}[\s.-]\d{4}/.test(t); } }
  ];
  const gameInfo = s => { s = typeof s === 'string' ? s : ''; const has = GAME_PARTS.filter(p => p.test(s)).map(p => p.id);
    return { len:s.length, has, ok:has.length === GAME_PARTS.length }; };

  const SITES = {
    site:{ key:'site', item:'site', file:'resume.html', path:'/resume', start:'', groups:SITE_GROUPS, parts:SITE_PARTS, info:s => siteInfo(s) },
    wiki:{ key:'wiki', item:'wiki', file:'character.html', path:'/wiki', start:WIKI_START, groups:WIKI_GROUPS, parts:WIKI_PARTS, info:wikiInfo, who:'wikiChar', share:true, files:WIKI_FILES },
    game:{ key:'game', item:'gameweb', file:'index.html', path:'/game', start:GAME_START, groups:GAME_GROUPS, parts:GAME_PARTS, info:gameInfo }
  };
  // every page's progress from a Learn record's html: { site:{ len, has, ok, in }, wiki:{ …, who } }
  const sitesOf = html => { html = html || {};
    return Object.fromEntries(Object.values(SITES).map(x => [x.key, { ...x.info(html[x.key], x.who ? html[x.who] : ''), in:html[x.key + 'In'] || null,
      ...(x.who ? { who:html[x.who] || '' } : {}), ...(x.share ? { with:html[x.key + 'Share'] || [] } : {}) }])); };

  /* how a score is made out of 100 */
  const score = (right, total) => total ? Math.min(100, Math.round(100 * right / total)) : 0;

  const HTMLLESSONS = { ACTS, CARDS, TYPE, CLOSE, MATCH_WORDS, MATCH_TAGS, wrap, BUILD, FIX, PAGE_START, GOALS, score,
    C1_ACTS, C1_WORDS, C1_SORT, C1_ELEMENTS, C1_TAGS, C1_JOBS, C1_PLACE, C1_PAGE, C1_ORDER, C1_EXIT, C1_H1, SITE_MAX, SITE_GROUPS, SITE_PARTS, siteInfo,
    WIKI_PIC, WIKI_FILES, FILE_NAME, fileName, filesOf, withFiles, WIKI_START, WIKI_GROUPS, WIKI_PARTS, wikiInfo, GAME_START, GAME_GROUPS, GAME_PARTS, gameInfo, SITES, sitesOf };
  if(typeof module !== 'undefined') module.exports = HTMLLESSONS; else root.HTMLLESSONS = HTMLLESSONS;
})(this);
