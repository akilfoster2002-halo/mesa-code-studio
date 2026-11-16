/* Review: the My Resume rubric level the teacher's Review page suggests */
const test = require('node:test');
const assert = require('node:assert');
const H = require('../public/js/html-lessons.js');

// the model page, all five Parts, with a real school email (the rubric asks for it)
const model = '<!DOCTYPE html>\n<html>\n<head>\n<title>Ana Ruiz - Resume</title>\n<style>\n'
  + ' body { background-color: lavender; color: black; font-family: Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }\n'
  + ' h1 { color: purple; font-size: 44px; text-align: center; }\n h2 { color: teal; }\n li { font-size: 18px; }\n img { width: 150px; border: 5px solid purple; border-radius: 50%; }\n'
  + ' section { background-color: white; padding: 20px; margin: 20px 0; border-radius: 12px; }\n header, footer { text-align: center; }\n</style>\n</head>\n<body>\n'
  + '<header>\n<h1>Ana Ruiz</h1>\n<img src="avatar.png" alt="Pixel art avatar of me">\n<p><em>Future game designer</em></p>\n</header>\n'
  + '<section>\n<h2>About Me</h2>\n<p>I like to draw and code.</p>\n</section>\n<section>\n<h2>Contact</h2>\n<p>Email: ana.ruiz2027@mesacharter.org<br>\nSchool: MESA Charter High School</p>\n</section>\n'
  + '<section>\n<h2>Education</h2>\n<ul>\n<li>MESA – 11th grade</li>\n</ul>\n</section>\n<section>\n<h2>Skills</h2>\n<ul>\n<li>HTML</li>\n<li>Teamwork</li>\n<li>Problem solving</li>\n</ul>\n</section>\n'
  + '<section>\n<h2>Activities and Experience</h2>\n<ul>\n<li>Robotics club</li>\n</ul>\n</section>\n<section>\n<h2>Projects</h2>\n<ol>\n<li>A dino game</li>\n</ol>\n</section>\n'
  + '<section>\n<h2>Languages</h2>\n<ul>\n<li>English</li>\n</ul>\n</section>\n<footer>\n<p>Ana Ruiz · 2026</p>\n</footer>\n</body>\n</html>\n';
const L = s => H.resumeLevel(s);

test('the model page: Parts 1–5, clean, nothing beyond the model → 3; something of their own → 4', () => {
  const r = L(model);
  assert.deepStrictEqual(r.groups.map(g => g.missing), [[], [], [], [], []]);
  assert.deepStrictEqual([r.level, r.flags, r.extras, r.close], [3, [], [], true]);
  assert.ok(!H.RUBRIC_PARTS.some(p => p.id === 'brackets'));                     // the placeholders box is left out
  const own = L(model.replace('<h2>Projects</h2>', '<h2>Projects</h2>\n<h3>My favorite</h3>').replace(' h2 { color: teal; }', ' h2 { color: teal; }\n img:hover { width: 200px; }'));
  assert.deepStrictEqual([own.level, own.extras], [4, ['<h3>', 'img:hover { }']]);
});

test('not clean: code after </html>, pasted twice, starter code, an open list keep it from a 4', () => {
  const own = model.replace('<h2>Projects</h2>', '<h2>Projects</h2>\n<h3>My favorite</h3>');
  assert.strictEqual(L(own + '<p>more</p>').level, 3);
  assert.deepStrictEqual(L(own + '<p>more</p>').flags, ['Code after </html>']);
  assert.strictEqual(L(own + own).flags[0], 'The page is pasted in twice (two <html> or <body> tags)');
  assert.ok(L(own.replace('</ol>', '')).flags.some(f => /not closed/.test(f)));
  assert.ok(L(own.replace('<p>I like', '<h2>My first heading</h2><p>I like')).flags.some(f => /Starter/.test(f)));
});

test('each level: what is complete, and one box from the next is "close"', () => {
  const noCss = model.replace(/<style>[\s\S]*<\/style>/, '<style>\n</style>');
  assert.deepStrictEqual([L(noCss).level, L(noCss).close], [2, false]);           // Parts 1–3 done, no CSS: Part 4 is still to do
  const noFooter = model.replace(/<footer>[\s\S]*<\/footer>\n/, '');
  assert.deepStrictEqual([L(noFooter).level, L(noFooter).next, L(noFooter).close], [2, ['footer'], true]);
  const noBody = model.replace('<body>\n', '').replace('</body>\n', '');
  assert.deepStrictEqual([L(noBody).level, L(noBody).why], [1, 'Part 1 not complete']);
  const noDoctype = model.replace('<!DOCTYPE html>\n', '');
  assert.deepStrictEqual([L(noDoctype).level, L(noDoctype).next, L(noDoctype).close], [1, ['doctype'], true]);
  assert.deepStrictEqual([L('').level, L('  ').why], [0, 'Nothing typed yet']);
});

test('Contact: a real school email and the school, however it is laid out', () => {
  const two = model.replace('Email: ana.ruiz2027@mesacharter.org<br>\nSchool: MESA Charter High School</p>', 'Email: ana.ruiz2027@mesacharter.org</p>\n<p>School: MESA Charter High School</p>');
  assert.strictEqual(L(two).groups[1].missing.length, 0);
  const noSchool = model.replace('<br>\nSchool: MESA Charter High School', '');      // the email's domain is not the school's name
  assert.deepStrictEqual(L(noSchool).groups[1].missing, ['br']);
  assert.deepStrictEqual(L(model.replace('<h2>Contact</h2>', '<h2>Contacts</h2>')).groups[1].missing, []);
  assert.deepStrictEqual(L(model.replace('<h2>About Me</h2>', '<h2>About me:</h2>')).groups[1].missing, []);
});
