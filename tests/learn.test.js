/* Every maze level can be solved with its answer in its best number of
   blocks, and a Bug Hunt program really has a bug. */
const test = require('node:test');
const assert = require('node:assert');
const { CHAPTERS, run, count } = require('../public/js/learn-levels.js');

for(const ch of CHAPTERS) for(const lv of ch.levels){
  test(`${lv.id} is solvable in ${lv.best} blocks`, () => {
    const r = run(lv, lv.answer);
    assert.strictEqual(r.result, 'win', lv.id + ' answer gives ' + r.result);
    assert.strictEqual(count(lv.answer), lv.best);
    if(lv.max) assert.ok(lv.best <= lv.max);
    for(const b of JSON.stringify(lv.answer).match(/"op":"(\w+)"/g).map(s => s.slice(6, -1)))
      assert.ok(lv.blocks.includes(b), `${lv.id} answer uses ${b}, which is not in its palette`);
    if(lv.start) assert.notStrictEqual(run(lv, lv.start).result, 'win', lv.id + ' bug program already wins');
  });
}

test('a wall stops Bit, and a loop that never moves ends', () => {
  const lv = CHAPTERS[0].levels[2];
  assert.strictEqual(run(lv, [{ op:'move' }, { op:'move' }]).result, 'crash');
  assert.strictEqual(run(lv, [{ op:'until', body:[{ op:'left' }] }]).result, 'loop');
  assert.strictEqual(run(lv, [{ op:'move' }]).result, 'short');
});

test('the star does not count until every gem is picked up', () => {
  const lv = CHAPTERS[3].levels[2];
  assert.strictEqual(run(lv, [{ op:'until', body:[{ op:'move' }] }]).result, 'gems');
});
