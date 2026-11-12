/* Game Website (index.html at /game): the starting code and the checklist */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const H = require('../public/js/html-lessons.js');
const example = fs.readFileSync(path.join(__dirname, 'fixtures', 'game-example.html'), 'utf8');   // Dino Dash, the class example
const has = s => H.gameInfo(s).has;
const lacks = (s, id) => !has(s).includes(id);

test('the starting code: a skeleton, empty CSS rules and a comment for each section; no box is ticked', () => {
  assert.ok(H.SITES.game && H.SITES.game.start === H.GAME_START && H.SITES.game.file === 'index.html' && H.SITES.game.path === '/game');
  for(let n = 1; n <= 7; n++) assert.ok(H.GAME_START.includes('<!-- ' + n + '. '), 'section ' + n);
  assert.deepStrictEqual(has(H.GAME_START), []);
  assert.deepStrictEqual(H.GAME_GROUPS.map(g => g.n), [...new Set(H.GAME_PARTS.map(p => p.group))].sort((a, b) => a - b));
});

test('the example page ticks every box', () => {
  assert.deepStrictEqual(H.gameInfo(example), { len:example.length, has:H.GAME_PARTS.map(p => p.id), ok:true });
});

test('each box needs the real thing', () => {
  assert.ok(lacks(example.replace('<title>Dino Dash</title>', '<title>My Game</title>'), 'gtitle'));                  // the tab and the h1 agree
  assert.ok(lacks(example.replace('href="#how-to-play"', 'href="#nowhere"'), 'gbutton'));                              // the button goes somewhere real
  assert.ok(lacks(example.replace(/<li><b>Space bar[^\n]*\n/, '').replace(/<li><b>Green flag[^\n]*\n/, ''), 'gkeys'));
  assert.ok(lacks(example.replace('alt="The dino jumping high over a cactus with a score of 17"', 'alt=""'), 'galt'));
  assert.ok(lacks(example.replace('<p class="caption">So close! Game over at 23 points.</p>', '').replace('<p class="caption">Ready to run: click the green flag.</p>', ''), 'gcaps'));
  assert.ok(lacks(example.replace('<h3>Beat your best score</h3>', ''), 'gfeat'));
  assert.ok(lacks(example.replace('– Maria', '').replace('– Leo', ''), 'gquotes'));
  assert.ok(lacks(example.replace('a forever loop moves', 'a block moves').replace('<b>A loop:</b>', '<b>Moving:</b>'), 'gloop'));
  assert.ok(lacks(example.replace('Alex · Period 2', 'Alex'), 'gfooter'));
  assert.ok(lacks(example.replace('</section>\n\n  <!-- 7. Footer -->', '<h2>Education</h2>\n  </section>\n\n  <!-- 7. Footer -->'), 'gnoresume'));
  assert.ok(lacks(example.replace('Alex · Period 2', 'alex@school.org · Period 2'), 'gprivacy'));
  assert.ok(lacks(example.replace('<!-- 5. What players say -->', '<!-- 5. What players say -->\n  <img src="me.png">'), 'gpics'));
  // a box ticked only by a comment does not count
  assert.ok(lacks(example.replace('<h3>Beat your best score</h3>', '<!-- <h3>Beat your best score</h3> -->'), 'gfeat'));
});
