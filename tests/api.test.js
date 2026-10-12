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
test.after(() => { server.close(); fs.rmSync(dir, { recursive:true, force:true }); });

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

test('another student cannot see or change your project; the teacher can see it read-only', async () => {
  const a = await login('ana', 'tiger42'), b = await login('ben', 'owl11'), t = await login('teach', 'apple-pear');
  const p = await (await call(a.cookie, '/projects', { method:'POST', body:JSON.stringify({ name:'Secret', data:{ s:1 } }) })).json();
  assert.strictEqual((await call(b.cookie, '/projects/' + p.id)).status, 404);
  assert.strictEqual((await call(b.cookie, '/projects/' + p.id, { method:'PUT', body:'{"data":{}}' })).status, 404);
  const seen = await (await call(t.cookie, '/projects/' + p.id)).json();
  assert.strictEqual(seen.readOnly, true);
  assert.strictEqual((await call(t.cookie, '/projects/' + p.id, { method:'PUT', body:'{"data":{}}' })).status, 403);
  assert.strictEqual((await call(a.cookie, '/admin/students')).status, 403);
  const list = await (await call(t.cookie, '/admin/students')).json();
  assert.ok(list.find(s => s.username === 'ana').projects >= 1);
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
