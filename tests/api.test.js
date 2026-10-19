/* The server, end to end, on a throwaway data folder: sign-in, projects,
   auto-save versions, restore, assets, and who may see what. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));
process.env.DATA_DIR = dir;
process.env.AI_KEY_DIR = dir;              // never the real keys in private/
delete process.env.OPENROUTER_API_KEY; delete process.env.GROQ_API_KEY;
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

/* the Block Helper's AI, with a pretend Groq/OpenRouter in place of fetch */
const GAME = { targets:[
  { name:'Stage', isStage:true, costumes:['sky'], sounds:['pop'], vars:['score'], lists:[], messages:['message1'], scripts:[] },
  { name:'Kitty', costumes:['cat-a', 'cat-b'], sounds:['meow'], vars:[], lists:[],
    scripts:[[{ op:'event_whenflagclicked', args:{}, inputs:{} }, { op:'motion_gotoxy', args:{ X:0, Y:-100 }, inputs:{} }]] },
  { name:'Dog', costumes:['dog'], sounds:[], vars:[], lists:[], scripts:[] }] };
function fakeAI(handler){
  const real = global.fetch, sent = [];
  global.fetch = async (url, opts) => {
    const host = String(url).startsWith('https://api.groq.com/') ? 'groq' : String(url).startsWith('https://openrouter.ai/') ? 'openrouter' : null;
    if(!host) return real(url, opts);
    const body = JSON.parse(opts.body);
    sent.push({ host, ...body });
    const r = handler(host, body, sent.length);
    if(typeof r === 'number') return new Response(r === 429 && host === 'openrouter' ? '{"error":{"message":"free-models-per-day"}}' : '{}', { status:r });
    return new Response(JSON.stringify({ choices:[{ message:{ content: typeof r === 'string' ? r : JSON.stringify(r) } }] }), { status:200 });
  };
  return { sent, restore(){ global.fetch = real; } };
}
const askAI = (cookie, q, extra={}) => call(cookie, '/helper/ask', { method:'POST', body:JSON.stringify({ q, game:GAME, sprite:'Kitty', lang:'en', ...extra }) });

test('block helper AI: off without a key; the model sees the blocks and the project, never who asked', async () => {
  const ana = await login('ana', 'tiger42');
  assert.strictEqual((await askAI(ana.cookie, 'how do i jump')).status, 503);
  assert.strictEqual((await fetch(base + '/api/helper/ask', { method:'POST', body:'{"q":"hi"}' })).status, 401);

  process.env.GROQ_API_KEY = 'g';
  const ai = fakeAI(() => ({ text:'Jump with the space key.', tip:'Change 80 to jump higher.', steps:[{ sprite:'Kitty', say:'Jump up and come back down.', script:[
    { op:'event_whenkeypressed', KEY_OPTION:'space' },
    { op:'motion_changeyby', DY:80 }, { op:'control_wait', DURATION:0.3 }, { op:'motion_changeyby', DY:-80 }] }] }));
  try {
    const r = await askAI(ana.cookie, 'how do i make kitty jump', { history:[{ q:'hello', a:'Hi!' }] });
    assert.strictEqual(r.status, 200);
    const a = await r.json();
    assert.strictEqual(a.text, 'Jump with the space key.');
    assert.strictEqual(a.steps[0].sprite, 'Kitty');
    assert.deepStrictEqual(a.steps[0].blocks.map(b => b.op), ['event_whenkeypressed', 'motion_changeyby', 'control_wait', 'motion_changeyby']);
    assert.strictEqual(a.steps[0].blocks[1].args.DY, '80');
    const prompt = JSON.stringify(ai.sent[0].messages);
    assert.match(prompt, /motion_movesteps \(stack\): move \[STEPS:num\] steps/, 'every block, with its slots');
    assert.match(prompt, /Sprite \\"Kitty\\" \(open in the editor now\)/);
    assert.match(prompt, /cat-a, cat-b/);
    assert.match(prompt, /when ⚑ clicked \/ go to x: \(0\) y: \(-100\)/, 'the scripts already there');
    assert.match(prompt, /variables for all sprites: score/);
    assert.strictEqual(ai.sent[0].messages[1].content, 'hello', 'the chat so far');
    assert.doesNotMatch(prompt, /\bAna\b|"ana"/, 'no name or username leaves the server');
  } finally { ai.restore(); delete process.env.GROQ_API_KEY; }
});

test('block helper AI: made-up blocks are sent back once to fix, and what is still wrong is left out', async () => {
  const ana = await login('ana', 'tiger42');
  process.env.GROQ_API_KEY = 'g';
  const bad = { text:'x', steps:[{ sprite:'Kitty', script:[
    { op:'event_whenflagclicked' },
    { op:'motion_jump', HEIGHT:10 },                                      // no such block
    { op:'control_if', CONDITION:'yes', do:[{ op:'motion_xposition' }] },  // text in a true/false hole; a reporter on its own
    { op:'event_whenkeypressed', KEY_OPTION:'space' },                    // a hat in the middle
    { op:'control_forever', do:[{ op:'motion_movesteps', STEPS:{ op:'sensing_mousex' }, SPEED:2 },  // no SPEED slot
      { op:'control_stop', STOP_OPTION:'everything' }] },                 // not a menu choice
    { op:'looks_show' }] }] };                                            // nothing goes under forever
  const ai = fakeAI((host, body, n) => n === 1 ? bad : 'Sure! ' + JSON.stringify(bad));
  try {
    const a = await (await askAI(ana.cookie, 'jump')).json();
    assert.strictEqual(ai.sent.length, 2, 'asked once to fix it');
    assert.match(ai.sent[1].messages.at(-1).content, /there is no block "motion_jump"/);
    const ops = []; (function walk(l){ for(const b of l){ ops.push(b.op); Object.values(b.inputs).forEach(x => walk([x])); walk(b.body || []); } })(a.steps[0].blocks);
    assert.deepStrictEqual(ops, ['event_whenflagclicked', 'control_if', 'control_forever', 'motion_movesteps', 'sensing_mousex', 'control_stop']);
    const forever = a.steps[0].blocks[2];
    assert.ok(!('SPEED' in forever.body[0].args));
    assert.ok(!('STOP_OPTION' in forever.body[1].args), 'a bad menu choice is dropped (the editor puts the default)');
    assert.strictEqual(a.steps[0].blocks.length, 3);
  } finally { ai.restore(); delete process.env.GROQ_API_KEY; }
});

test('block helper AI: Groq first, OpenRouter when Groq is out, and OpenRouter stops once its day is used up', async () => {
  const ana = await login('ana', 'tiger42');
  const ok = host => ({ text:'from ' + host, steps:[] });
  let groq = 200, router = 200;
  const ai = fakeAI(host => (host === 'groq' ? groq : router) === 200 ? ok(host) : (host === 'groq' ? groq : router));
  process.env.GROQ_API_KEY = 'g'; process.env.OPENROUTER_API_KEY = 'o';
  try {
    assert.strictEqual((await (await askAI(ana.cookie, 'q1')).json()).text, 'from groq');
    assert.deepStrictEqual(ai.sent.map(s => s.model), ['openai/gpt-oss-120b']);

    ai.sent.length = 0; groq = 429;
    assert.strictEqual((await (await askAI(ana.cookie, 'q2')).json()).text, 'from openrouter');
    assert.strictEqual(ai.sent.filter(s => s.host === 'groq').length, 3, 'every Groq model is tried first');

    ai.sent.length = 0; router = 429;
    assert.strictEqual((await askAI(ana.cookie, 'q3')).status, 502);
    assert.strictEqual(ai.sent.filter(s => s.host === 'openrouter').length, 1, 'no point asking other OpenRouter models');
  } finally { ai.restore(); delete process.env.GROQ_API_KEY; delete process.env.OPENROUTER_API_KEY; }
});
