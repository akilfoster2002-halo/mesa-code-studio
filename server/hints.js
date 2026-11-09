/* =====================================================================
   MY RESUME HINTS — a teacher puts short "✏️ To do" comments into each
   student's resume.html, one for every checklist box (Parts 1–3) that is
   not ticked yet, on the line where that code belongs, so the student can
   type right underneath it.

   • Plain words, no tags: the hint says what to do, the student remembers
     the tag (and a hint can never tick a box by itself).
   • Comments only: the page in the browser looks exactly the same.
   • Running it again first takes out its own old hints, so they never pile
     up; a box that is done gets no hint.
   ===================================================================== */
const H = require('../public/js/html-lessons.js');

const MARK = '✏️ To do';
// this file's own comments (and the first test version's "✏️ TODO"), each on its own line
const OWN = /[ \t]*<!-- ✏️ (?:To do|TODO)[\s\S]*?-->[ \t]*\n?/g;
const strip = s => String(s || '').replace(OWN, '');
const has = s => new Set(H.siteInfo(s.replace(/<!--[\s\S]*?-->/g, '')).has);   // the checklist, not counting comments

// each missing section of Part 3: [checklist id, heading words, name, its list, what goes in it]
const SECTIONS = [
  ['education', 'education|educaci', 'Education', 'bulleted', 'school, grade and year'],
  ['skills', 'skill|habilidad', 'Skills', 'bulleted', 'at least 3 skills'],
  ['activities', 'activit|experien|actividad', 'Activities and Experience', 'bulleted', 'clubs, sports, jobs'],
  ['projects', 'project|proyecto', 'Projects', 'numbered', 'your projects'],
  ['languages', 'language|idioma', 'Languages', 'bulleted', 'languages you speak'],
];

/* page → { text (with hints), hints (how many) } */
function hint(page){
  const s = strip(page), got = has(s), ins = [];         // ins: [where, text, order]
  const find = (re, from = 0, end = false) => { const m = new RegExp(re.source, re.flags.replace('g', '')).exec(s.slice(from)); return m ? from + m.index + (end ? m[0].length : 0) : -1; };
  const at = (re, from) => find(re, from), after = (re, from) => find(re, from, true);
  const lineStart = i => s.lastIndexOf('\n', i - 1) + 1;
  const lineEnd = i => { const j = s.indexOf('\n', i); return j < 0 ? s.length : j + 1; };
  const indent = i => (s.slice(lineStart(i)).match(/^[ \t]*/) || [''])[0];
  let nl = s.endsWith('\n') ? '' : '\n';                  // the last line is ended once, before the first hint at the very end
  const put = (where, text, order) => { if(where === s.length){ text = nl + text; nl = ''; } ins.push([where, text, order]); };
  // a hint on its own line, above the line at i (or below it)
  const add = (i, words, below) => { if(i < 0) return;
    const p = below ? lineEnd(i) : lineStart(i);
    put(p, indent(below ? lineStart(i) : i) + `<!-- ${MARK}: ${words} -->\n`, ins.length); };
  const miss = id => !got.has(id);

  const bodyOpen = after(/<body[^>]*>/i), bodyClose = at(/<\/body>/i);
  const h1 = at(/<h1[\s>]/i), h1End = after(/<\/h1>/i), em = after(/<p[^>]*>\s*<em>[\s\S]*?<\/p>/i);
  const h2 = (re, end) => find(new RegExp('<h2[^>]*>[^<]*(?:' + re + ')[^<]*<\\/h2>', 'i'), 0, end);
  // new sections go just above </body>, or at the very end when there is no </body> yet
  const addEnd = words => bodyClose >= 0 ? add(bodyClose, words) : put(s.length, `<!-- ${MARK}: ${words} -->\n`, ins.length);

  // Part 1 · the skeleton (a broken tag first: it is why other boxes stay empty)
  if(miss('doctype')) put(0, `<!-- ${MARK}: First line: the DOCTYPE, so the browser knows it is HTML -->\n`, -1);
  if(miss('title')) add(at(/<head[^>]*>/i), 'Add a title with your name, for the browser tab', true);
  if(miss('style') && !/<style[\s>]/i.test(s)) add(Math.max(after(/<\/title>/i), after(/<head[^>]*>/i)), 'Add an empty style section here, inside the head', true);
  if(miss('head') && /<head[^>]*>/i.test(s) && !/<\/head>/i.test(s)) add(Math.max(after(/<\/style>/i), after(/<\/title>/i)), 'Close the head here (check for a typo)', true);
  if(miss('h1') && h1 < 0) add(bodyOpen, 'Put your name here as the main heading', true);
  // code typed after </html> is not part of the page
  const htmlEnd = after(/<\/html>/i);
  if(htmlEnd >= 0 && /\S/.test(s.slice(htmlEnd).replace(/<!--[\s\S]*?-->/g, ''))) add(bodyClose, 'Code below the end of the page does not show. Move it here');
  // the starter page's "My first heading / paragraph"
  const starter = at(/<h1[^>]*>\s*my first (?:resume|heading)/i);
  if(starter >= 0) add(starter, 'Leftover starter code: delete this heading and its paragraph');
  else if(miss('oneh1')){ const second = at(/<h1[\s>]/i, h1End); if(second >= 0) add(second, 'Only your name is the main heading. Make this a section heading'); }

  // Part 2 · About Me & Contact
  if(miss('headline')) add(h1End, 'Add a one-line headline in italics under your name', true);
  if(miss('header') && h1 >= 0) add(h1, 'Wrap your name, avatar and headline in a header tag');
  if(miss('avatar')) add(em >= 0 ? em : h1End, 'Add your avatar picture, with alt words describing it', true);
  if(miss('about')) add(em >= 0 ? em : h1End, 'Add About Me: a heading and 2–3 sentences', true);
  else if(miss('aboutp')) add(h2('about|sobre m', true), 'Write 2–3 sentences about you here', true);
  if(miss('sections') && h2('about|sobre m') >= 0) add(h2('about|sobre m'), 'Wrap each part, About Me to Languages, in a section tag');
  if(miss('contact')) addEnd('Add Contact: your school email, then your school below it');
  else if(miss('br')) add(h2('contact', true), 'School email on one line, your school on the next', true);

  // Part 3 · every section: fixed under its own heading, or added just above </body>
  for(const [id, re, name, list, what] of SECTIONS) if(miss(id)){
    if(h2(re) >= 0) add(h2(re, true), `List ${what} here as a ${list} list`, true);
    else addEnd(`Add ${name}: heading + ${list} list of ${what}`);
  }
  if(miss('footer')) addEnd('Add a footer tag at the bottom: your name and the year');
  if((miss('body') || miss('html')) && bodyClose < 0) put(s.length, `<!-- ${MARK}: End the page: close the body, then the html -->\n`, 999);

  // in from the end, so earlier places don't move; at the same place, in the order they were made
  let text = s;
  for(const [i, t] of ins.sort((a, b) => b[0] - a[0] || b[2] - a[2])) text = text.slice(0, i) + t + text.slice(i);
  if(text.length > H.SITE_MAX) return { text:page, hints:0 };     // never cut a student's page short to make room
  return { text, hints:ins.length };
}

module.exports = { MARK, hint, strip };
