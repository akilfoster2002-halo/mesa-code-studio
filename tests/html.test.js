/* Intro to HTML: every activity has fair questions, and the server keeps
   the best score per activity. */
const test = require('node:test');
const assert = require('node:assert');
const H = require('../public/js/html-lessons.js');

test('seven activities, about 30 minutes', () => {
  assert.strictEqual(H.ACTS.length, 7);
  const min = H.ACTS.reduce((n, a) => n + a.min, 0);
  assert.ok(min >= 25 && min <= 35, min + ' minutes');
  for(const a of H.ACTS) assert.match(a.id, /^[a-z]{2,12}$/);
});

test('every flash card and fix round has English and Spanish', () => {
  for(const c of H.CARDS) assert.ok(c.code && c.en && c.es, c.code);
  for(const f of H.FIX){ assert.ok(f.why.en && f.why.es); assert.ok(!f.bad.includes(f.good)); assert.strictEqual(new Set(f.bad).size, 2); }
});

test('build rounds have no two lines alike, and open/close tags balance', () => {
  for(const page of H.BUILD){
    const lines = page.map(l => l[1]);
    assert.strictEqual(new Set(lines).size, lines.length);
    const html = lines.join('');
    for(const tag of html.match(/<(\w+)>/g).map(s => s.slice(1, -1)))
      assert.strictEqual(html.split('<' + tag + '>').length, html.split('</' + tag + '>').length, tag);
  }
});

test('typing lines can be typed on a keyboard and close their tags', () => {
  for(const s of H.TYPE){
    assert.match(s, /^[\x20-\x7e]+$/);
    for(const tag of (s.match(/<(\w+)[ >]/g) || []).map(x => x.slice(1, -1)).filter(t => t !== 'br'))
      assert.ok(s.includes('</' + tag + '>'), s);
  }
});

test('the first page starts with goals left to do, and a full page meets them all', () => {
  assert.ok(H.GOALS.some(g => !g.test(H.PAGE_START)));
  const full = '<h1>Me</h1><p>Hi</p><p>I am <b>Ana</b></p><ul><li>a</li><li>b</li><li>c</li></ul><img src="star.png">';
  for(const g of H.GOALS) assert.ok(g.test(full), g.id);
});
