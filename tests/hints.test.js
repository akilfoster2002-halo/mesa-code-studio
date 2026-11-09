/* My Resume hints: a "✏️ To do" comment for every box not ticked yet, in the right place */
const test = require('node:test');
const assert = require('node:assert');
const H = require('../public/js/html-lessons.js');
const { hint, strip } = require('../server/hints.js');

const start = '<!DOCTYPE html>\n<html>\n<head>\n<title>Ana - Resume</title>\n<style>\n</style>\n</head>\n<body>\n<h1>Ana</h1>\n<p><em>Future coder</em></p>\n'
  + '<h2>About Me</h2>\n<p>I like art.</p>\n<h2>Skills</h2>\n<ul>\n<li>HTML</li>\n</ul>\n</body>\n</html>\n';
const todos = s => (s.match(/<!-- ✏️ To do: [^<>]*? -->/g) || []).map(x => x.slice(15, -4));

test('a hint for each box not ticked, at the line where that code goes', () => {
  const { text, hints } = hint(start);
  const lines = text.split('\n'), at = re => lines.findIndex(l => re.test(l));
  assert.strictEqual(hints, todos(text).length);
  assert.strictEqual(at(/Wrap your name, avatar and headline/) + 1, at(/<h1>Ana/));            // just above the name
  assert.strictEqual(at(/List at least 3 skills/) - 1, at(/<h2>Skills/));                       // under its own heading
  const end = at(/<\/body>/);
  assert.deepStrictEqual(lines.slice(end - 6, end).map(l => l.replace(/^.*To do: (\w+).*$/, '$1')),   // the missing sections, in order, above </body>
    ['Add', 'Add', 'Add', 'Add', 'Add', 'Add']);
  assert.ok(/Add Contact/.test(lines[end - 6]) && /Add a footer/.test(lines[end - 1]));
  assert.ok(todos(text).every(t => !/[<>]/.test(t) && t.split(' ').length <= 12), 'plain words, short, no tags');
});

test('the page looks the same, and the checklist does not change because of a hint', () => {
  const { text } = hint(start);
  assert.strictEqual(text.replace(/[ \t]*<!--[\s\S]*?-->\n/g, ''), start);
  assert.deepStrictEqual(H.siteInfo(text).has, H.siteInfo(start).has);
});

test('again: the old hints go, new ones come, never twice; a finished page gets none', () => {
  const once = hint(start).text;
  assert.strictEqual(hint(once).text, once);
  assert.strictEqual(strip(once), start);
  const done = start.replace('<li>HTML</li>', '<li>HTML</li>\n<li>Art</li>\n<li>Teamwork</li>');
  assert.ok(!todos(hint(done).text).some(t => /skills/.test(t)));
});

test('the real mistakes: a broken head, code after </html>, the starter page left in', () => {
  const broken = start.replace('</head>', '<head/>').replace('</body>\n</html>\n', '');
  const t1 = todos(hint(broken).text);
  assert.ok(t1.includes('Close the head here (check for a typo)') && t1.includes('End the page: close the body, then the html'));
  assert.ok(!t1.some(t => /style|main heading/.test(t)), 'not the boxes the broken tag hides');
  const after = start.replace('<h2>Skills</h2>\n<ul>\n<li>HTML</li>\n</ul>\n</body>\n</html>\n', '<h1>My first heading</h1>\n<p>My first paragraph.</p>\n</body>\n</html>\n<h2>Skills</h2>\n');
  const t2 = hint(after).text.split('\n');
  assert.ok(/Leftover starter code/.test(t2[t2.findIndex(l => /My first heading/.test(l)) - 1]));
  assert.ok(/Code below the end of the page/.test(t2.join('\n')));
});

test('a page too long for hints is left as it is', () => {
  const big = start.replace('<p>I like art.</p>', '<p>' + 'x'.repeat(H.SITE_MAX - start.length - 20) + '</p>');
  assert.deepStrictEqual(hint(big), { text:big, hints:0 });
});
