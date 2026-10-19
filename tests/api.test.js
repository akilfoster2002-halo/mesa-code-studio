/* The server, end to end, on a throwaway data folder: sign-in, projects,
   auto-save versions, restore, assets, and who may see what. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));
process.env.DATA_DIR = dir;
delete process.env.DATABASE_URL;
const { server, store, ready } = require('../server/index.js');
const auth = require('../server/auth');

let base;
test.before(async () => {
  await ready;
  await store.upsertUser({ username:'ana', name:'Ana', period:'2', role:'student', ...auth.makeHash('tiger42') });
  await store.upsertUser({ username:'ben', name:'Ben', period:'2', role:'student', ...auth.makeHash('owl11') });
  await store.upsertUser({ username:'teach', name:'T', period:'', role:'teacher', ...auth.makeHash('apple-pear') });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => { server.close(); store.flush(); fs.rmSync(dir, { recursive:true, force:true }); });

async function login(u, p){
  const r = await fetch(base + '/api/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ username:u, password:p }) });
  return { status:r.status, cookie:(r.headers.get('set-cookie') || '').split(';')[0] };
}
const call = (cookie, p, opts={}) => fetch(base + '/api' + p, { ...opts, headers:{ cookie, 'Content-Type':'application/json', ...(opts.headers || {}) } });

test('wrong password is refused, right one signs in (case-insensitive)', async () => {
  assert.strictEqual((await login('ana', 'nope')).status, 401);
  const ok = await login('ANA', 'TIGER42');
  assert.strictEqual(ok.status, 200);
  const me = await (await call(ok.cookie, '/me')).json();
  assert.strictEqual(me.username, 'ana');
});

test('signed out, the API says so', async () => {
  assert.strictEqual((await fetch(base + '/api/projects')).status, 401);
});

test('create, save, version, restore', async () => {
  const { cookie } = await login('ana', 'tiger42');
  const p = await (await call(cookie, '/projects', { method:'POST', body:JSON.stringify({ name:'Pong', data:{ v:1, n:1 } }) })).json();
  assert.ok(p.id);
  await call(cookie, '/projects/' + p.id, { method:'PUT', body:JSON.stringify({ data:{ v:1, n:2 } }) });
  await call(cookie, '/projects/' + p.id, { method:'PUT', body:JSON.stringify({ data:{ v:1, n:3 }, checkpoint:true, name:'Pong 2' }) });
  const got = await (await call(cookie, '/projects/' + p.id)).json();
  assert.deepStrictEqual(got.data, { v:1, n:3 });
  assert.strictEqual(got.name, 'Pong 2');
  const vs = await (await call(cookie, '/projects/' + p.id + '/versions')).json();
  assert.ok(vs.length >= 2, 'a checkpoint adds a version');
  const first = vs[vs.length - 1];
  await call(cookie, '/projects/' + p.id + '/restore/' + first.id, { method:'POST' });
  const back = await (await call(cookie, '/projects/' + p.id)).json();
  assert.deepStrictEqual(back.data, (await (await call(cookie, '/projects/' + p.id + '/versions/' + first.id)).json()).data);
  const after = await (await call(cookie, '/projects/' + p.id + '/versions')).json();
  assert.ok(after.some(v => v.label === 'before restore'), 'the replaced work is kept');
});

test('another student cannot see or change your project; a teacher can open and fix it', async () => {
  const a = await login('ana', 'tiger42'), b = await login('ben', 'owl11'), t = await login('teach', 'apple-pear');
  const p = await (await call(a.cookie, '/projects', { method:'POST', body:JSON.stringify({ name:'Secret', data:{ s:1 } }) })).json();
  assert.strictEqual((await call(b.cookie, '/projects/' + p.id)).status, 404);
  assert.strictEqual((await call(b.cookie, '/projects/' + p.id, { method:'PUT', body:'{"data":{}}' })).status, 404);
  const seen = await (await call(t.cookie, '/projects/' + p.id)).json();
  assert.strictEqual(seen.readOnly, true);
  assert.strictEqual(seen.canEdit, true);
  assert.strictEqual(seen.ownerName, 'Ana');
  // the teacher's change saves, and the student's own work is kept in history first
  assert.strictEqual((await call(t.cookie, '/projects/' + p.id, { method:'PUT', body:JSON.stringify({ data:{ s:2 } }) })).status, 200);
  await call(t.cookie, '/projects/' + p.id, { method:'PUT', body:JSON.stringify({ data:{ s:3 } }) });
  const vs = await (await call(a.cookie, '/projects/' + p.id + '/versions')).json();
  assert.deepStrictEqual(vs.map(v => v.label).slice(0, 3), ['teacher edit', 'before teacher edit', 'created']);
  assert.deepStrictEqual((await (await call(a.cookie, '/projects/' + p.id)).json()).data, { s:3 });
  assert.strictEqual((await call(t.cookie, '/projects/' + p.id, { method:'DELETE' })).status, 403, 'only the owner deletes');
  assert.strictEqual((await call(a.cookie, '/admin/overview')).status, 403);
});

test('dashboard: progress per student, add accounts, turn one off', async () => {
  const t = await login('teach', 'apple-pear');
  const a = await login('ana', 'tiger42');
  await call(a.cookie, '/projects', { method:'POST', body:JSON.stringify({ name:'Big', data:{ targets:[{ isStage:true, scripts:[] },
    { scripts:[{ blocks:[{ op:'event_whenflagclicked' }, { op:'control_forever', body:[{ op:'motion_movesteps', inputs:{ STEPS:{ op:'operator_random' } } }] }] }] }] } }) });
  const rows = await (await call(t.cookie, '/admin/overview')).json();
  const ana = rows.find(r => r.username === 'ana');
  assert.strictEqual(ana.blocks, 4, 'blocks of the biggest project, reporters included');
  assert.ok(ana.last_login && ana.projects >= 1 && ana.recent >= 1);
  const made = await (await call(t.cookie, '/admin/users', { method:'POST', body:JSON.stringify({ name:'Ana Lopez', period:'2' }) })).json();
  assert.strictEqual(made.username, 'anal', 'ana is taken, so more of the last name');
  assert.match(made.password, /^[a-z]+\d\d$/);
  assert.strictEqual((await login('anal', made.password)).status, 200);
  const tt = await (await call(t.cookie, '/admin/users', { method:'POST', body:JSON.stringify({ name:'Emily Teach', role:'teacher' }) })).json();
  assert.strictEqual(tt.role, 'teacher');
  assert.strictEqual((await call((await login(tt.username, tt.password)).cookie, '/admin/overview')).status, 200);
  await call(t.cookie, '/admin/students/anal/disable', { method:'POST', body:'{"disabled":true}' });
  assert.strictEqual((await login('anal', made.password)).status, 403);
  await call(t.cookie, '/admin/students/anal/disable', { method:'POST', body:'{"disabled":false}' });
  assert.strictEqual((await login('anal', made.password)).status, 200);
  assert.strictEqual((await call(t.cookie, '/admin/students/teach/disable', { method:'POST', body:'{"disabled":true}' })).status, 400);
});

test('deleted projects can be brought back', async () => {
  const { cookie } = await login('ben', 'owl11');
  const p = await (await call(cookie, '/projects', { method:'POST', body:JSON.stringify({ name:'Oops', data:{} }) })).json();
  await call(cookie, '/projects/' + p.id, { method:'DELETE' });
  assert.ok(!(await (await call(cookie, '/projects')).json()).some(x => x.id === p.id));
  assert.ok((await (await call(cookie, '/projects/trash')).json()).some(x => x.id === p.id));
  await call(cookie, '/projects/' + p.id + '/undelete', { method:'POST' });
  assert.ok((await (await call(cookie, '/projects')).json()).some(x => x.id === p.id));
});

test('assets: pictures and sounds go in, by content hash; other types do not', async () => {
  const { cookie } = await login('ana', 'tiger42');
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const r = await call(cookie, '/assets', { method:'POST', headers:{ 'Content-Type':'image/png' }, body:png });
  const { id } = await r.json();
  assert.match(id, /^[a-f0-9]{64}$/);
  const again = await (await call(cookie, '/assets', { method:'POST', headers:{ 'Content-Type':'image/png' }, body:png })).json();
  assert.strictEqual(again.id, id);
  const got = await fetch(base + '/api/assets/' + id);
  assert.strictEqual(got.headers.get('content-type'), 'image/png');
  assert.strictEqual((await call(cookie, '/assets', { method:'POST', headers:{ 'Content-Type':'audio/mpeg' }, body:Buffer.from('ID3') })).status, 200);
  assert.strictEqual((await call(cookie, '/assets', { method:'POST', headers:{ 'Content-Type':'text/html' }, body:'<script>' })).status, 415);
  assert.strictEqual((await fetch(base + '/api/assets', { method:'POST', headers:{ 'Content-Type':'image/png' }, body:png })).status, 401);
});

test('the tour: a step number while it runs, then done or skipped', async () => {
  const { cookie } = await login('ana', 'tiger42');
  assert.strictEqual((await (await call(cookie, '/me')).json()).tutorial, null);
  await call(cookie, '/me/tutorial', { method:'POST', body:'{"state":"7"}' });
  assert.strictEqual((await (await call(cookie, '/me')).json()).tutorial, '7');
  await call(cookie, '/me/tutorial', { method:'POST', body:'{"state":"done"}' });
  assert.strictEqual((await login('ana', 'tiger42')).status, 200);
  assert.strictEqual((await (await call(cookie, '/me')).json()).tutorial, 'done');
  assert.strictEqual((await call(cookie, '/me/tutorial', { method:'POST', body:'{"state":"<x>"}' })).status, 400);
});

test('too many wrong passwords locks that username for a while', async () => {
  for(let i = 0; i < 8; i++) await login('ben', 'wrong' + i);
  assert.strictEqual((await login('ben', 'owl11')).status, 429);
});

test('version history is thinned, never unbounded', () => {
  const { thin, MAX_VERSIONS } = require('../server/store');
  const vs = Array.from({ length:200 }, (_, i) => ({ id:String(i), created:new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }));
  thin(vs);
  assert.strictEqual(vs.length, MAX_VERSIONS);
  assert.strictEqual(vs[0].id, '0', 'the first version stays');
  assert.strictEqual(vs[vs.length - 1].id, '199', 'the newest stays');
});

test('block helper: questions are kept for the teacher, with the game summaries', async () => {
  const ana = await login('ana', 'tiger42');
  const about = { story:'A dino that jumps over cactuses', has:['jump', 'obstacles', 'BAD ID', 7], like:['dino'], next:'make it duck', player:'x1' };
  const p = await (await call(ana.cookie, '/projects', { method:'POST', body:JSON.stringify({ name:'Dino', data:{ v:1, targets:[], about } }) })).json();
  assert.strictEqual((await call(ana.cookie, '/helper/log', { method:'POST', body:JSON.stringify({ q:'how do i make him duck', project:p.id }) })).status, 200);
  await call(ana.cookie, '/helper/log', { method:'POST', body:JSON.stringify({ q:'jump', recipe:'jump', kind:'pick', project:p.id }) });
  await call(ana.cookie, '/helper/log', { method:'POST', body:JSON.stringify({ recipe:'jump', kind:'<script>' }) });
  assert.strictEqual((await call(ana.cookie, '/helper/log', { method:'POST', body:'{}' })).status, 400);
  assert.strictEqual((await call(ana.cookie, '/admin/helper')).status, 403);
  assert.strictEqual((await fetch(base + '/api/helper/log', { method:'POST', body:'{"q":"hi"}' })).status, 401);

  const t = await login('teach', 'apple-pear');
  const got = await (await call(t.cookie, '/admin/helper')).json();
  const mine = got.log.filter(e => e.username === 'ana');
  assert.strictEqual(mine.length, 3);
  assert.strictEqual(mine[0].kind, 'ask', 'an unknown kind is kept as a question');
  const duck = mine.find(e => e.question === 'how do i make him duck');
  assert.strictEqual(duck.recipe, null);
  assert.strictEqual(duck.name, 'Ana');
  assert.strictEqual(duck.period, '2');
  const g = got.games.find(x => x.id === p.id);
  assert.deepStrictEqual(g.about, { story:'A dino that jumps over cactuses', has:['jump', 'obstacles'], like:['dino'], next:'make it duck' });
  assert.strictEqual(g.name, 'Ana');
  assert.strictEqual(g.projectName, 'Dino');
});
