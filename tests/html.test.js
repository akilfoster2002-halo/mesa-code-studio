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

test('Classwork: Game Design (the block game) and Game Feedback are the built-in assignments', () => {
  const C = require('../public/js/classwork.js');
  assert.strictEqual(new Set(C.ITEMS.map(i => i.id)).size, C.ITEMS.length);
  for(const it of C.ITEMS){ assert.ok(it.href && it.title.en && it.title.es && it.line.en && it.line.es, it.id); assert.match(it.id, /^[a-z0-9-]{1,30}$/); }
  const empty = C.studentData(null, null, []);
  for(const a of C.ASSIGNMENTS) assert.strictEqual(C.status(a, empty).state, 'none', a.id);
  assert.deepStrictEqual(C.ASSIGNMENTS.map(a => a.id), ['game', 'feedback']);   // their block game, then feedback on classmates' games
  const fb = n => C.status(C.ITEMS.find(i => i.id === 'feedback'), C.studentData(null, null, [], {}, false, Array(n).fill({})));
  assert.deepStrictEqual([fb(0).state, fb(3).state, fb(4).state, fb(1).text], ['none', 'started', 'done', '1 / 4 💬']);
  const by = d => C.status(C.ITEMS.find(i => i.id === 'game'), d);
  assert.strictEqual(by(C.studentData(null, null, [])).state, 'none');
  const d = C.studentData(null, null, [{ stats:{ blocks:40 } }, { stats:{ blocks:12 } }]);
  assert.deepStrictEqual([by(d).state, by(d).text], ['started', '40 🧩']);
  const t = C.studentData(null, null, [{ stats:{ blocks:40 } }], {}, true);
  assert.deepStrictEqual([by(t).state, by(t).pct], ['done', 100]);     // turned in = locked
});

test('Classwork: a graded assignment shows the grade out of its points', () => {
  const C = require('../public/js/classwork.js');
  const it = C.custom({ id:'a-x', title:'Page', points:20 });
  const st = C.status(it, { subs:{ 'a-x':{ turnedIn:true, at:'2026-11-01T10:00:00Z', files:1, grade:15 } } });
  assert.deepStrictEqual([st.state, st.graded, st.text, st.pct], ['done', true, '15 / 20', 75]);
  assert.strictEqual(C.status(C.custom({ id:'a-y', title:'Old' }), { subs:{ 'a-y':{ grade:90 } } }).text, '90 / 100');
});
