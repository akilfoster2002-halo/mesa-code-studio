/* =====================================================================
   CODE STUDIO — the server.

   Serves public/ and a small JSON API:
     POST /api/login  /api/logout   GET /api/me
     GET/POST /api/projects         GET/PUT/DELETE /api/projects/:id
     GET /api/projects/:id/versions[/:vid]   POST /api/projects/:id/restore/:vid
     POST /api/assets (raw bytes)   GET /api/assets/:id
     POST /api/helper/log           a Block Helper question (or which recipe helped)
     POST /api/helper/ask           a question no recipe answered, for the AI (server/ai.js)
     teacher only: GET /api/admin/overview, /api/admin/students/:u/projects,
                   GET /api/admin/helper (questions asked, game summaries),
                   POST /api/admin/users (add a student or teacher),
                   POST /api/admin/students/:u/password, /api/admin/students/:u/disable
     A teacher may also open, change and restore any student's project; the
     student's work from before the change is kept in its history.

   Accounts live in the database. The class list (private/roster.json, made
   by tools/make-logins.js) is never in the repo: `npm run seed` adds any new
   students from it to the database, and a server started on a computer that
   has the file does the same on boot. Existing accounts are never touched,
   so a reset password is never overwritten.
   ===================================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const auth = require('./auth');
const { open, projectStats } = require('./store');
const names = require('./names');
const ai = require('./ai');

const PORT = Number(process.env.PORT) || 8790;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_PROJECT = 3 * 1024 * 1024;        // project JSON (assets live elsewhere)
const MAX_ASSET = 12 * 1024 * 1024;         // one picture or sound

const ASSET_TYPES = /^(image\/(png|jpeg|gif|webp|svg\+xml|bmp|avif)|audio\/[\w.+-]+|video\/(mp4|webm|ogg))$/;

const store = open();

/* ------------------------------------------------------------- helpers */
function send(res, code, body, headers={}){
  const json = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': json ? 'application/json' : 'text/plain', 'Cache-Control':'no-store', ...headers });
  res.end(json ? JSON.stringify(body) : body);
}
function readBody(req, limit){
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if(n > limit){ reject(Object.assign(new Error('too big'), { code:413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJSON(req, limit=MAX_PROJECT + 200000){
  const b = await readBody(req, limit);
  try { return JSON.parse(b.toString('utf8') || '{}'); }
  catch(e){ throw Object.assign(new Error('bad json'), { code:400 }); }
}
const cleanName = s => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60);

/* --------------------------------------------- login attempt limiting
   Eight wrong passwords for one username (or 40 from one address) in ten
   minutes and that door closes for the rest of the ten minutes. Enough
   for a child mistyping, not enough to guess a password. */
const tries = new Map();
function limited(key, max){
  const t = tries.get(key);
  if(!t || Date.now() - t.start > 10*60*1000) return false;
  return t.n >= max;
}
function fail(key){
  const t = tries.get(key);
  if(!t || Date.now() - t.start > 10*60*1000) tries.set(key, { start:Date.now(), n:1 });
  else t.n++;
}

/* a student clicking very fast can log only so many helper questions */
const helperHits = new Map();
function helperBusy(username){
  const t = helperHits.get(username);
  if(!t || Date.now() - t.start > 60*60*1000){ helperHits.set(username, { start:Date.now(), n:1 }); return false; }
  return ++t.n > 200;
}
const HELPER_KINDS = ['ask', 'pick', 'stuck', 'worked'];

/* AI answers are free but limited (see server/ai.js), so one student gets
   10 an hour and the whole class 300 a day (AI_DAILY_LIMIT) */
const aiHits = new Map();
let aiDay = { day:'', n:0 };
function aiBusy(username){
  const day = new Date().toISOString().slice(0, 10);
  if(aiDay.day !== day) aiDay = { day, n:0 };
  if(aiDay.n >= (Number(process.env.AI_DAILY_LIMIT) || 300)) return 'day';
  const t = aiHits.get(username);
  if(t && Date.now() - t.start < 60*60*1000 && t.n >= 10) return 'hour';
  if(!t || Date.now() - t.start >= 60*60*1000) aiHits.set(username, { start:Date.now(), n:1 }); else t.n++;
  aiDay.n++;
  return null;
}

/* --------------------------------------------------------------- static */
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.json':'application/json',
  '.ico':'image/x-icon', '.webmanifest':'application/manifest+json' };
function serveStatic(req, res, pathname){
  if(pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname)));
  if(!file.startsWith(PUBLIC)) return send(res, 403, 'forbidden');
  fs.stat(file, (err, st) => {
    if(err || !st.isFile()){
      // the app is one page: anything unknown that is not a file gets it
      if(!path.extname(pathname)) return serveStatic(req, res, '/index.html');
      return send(res, 404, 'not found');
    }
    const ext = path.extname(file);
    const lm = st.mtime.toUTCString();
    if(req.headers['if-modified-since'] === lm){ res.writeHead(304); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Last-Modified': lm,
      'Cache-Control': /\.(html|js|css)$/.test(ext) ? 'no-cache' : 'public, max-age=3600' });
    fs.createReadStream(file).pipe(res);
  });
}

/* ------------------------------------------------------------------ api */
async function api(req, res, url){
  const p = url.pathname.split('/').filter(Boolean).slice(1);   // after 'api'
  const m = req.method;
  const me = auth.fromReq(req);

  if(p[0] === 'login' && m === 'POST'){
    const b = await readJSON(req, 10000);
    const username = String(b.username || '').trim().toLowerCase();
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if(limited('u:'+username, 8) || limited('ip:'+ip, 40))
      return send(res, 429, { error:'wait' });
    const u = username && await store.getUser(username);
    if(u && u.disabled) return send(res, 403, { error:'off' });
    if(!u || !auth.verify(String(b.password || '').trim().toLowerCase(), u.salt, u.hash)){
      fail('u:'+username); fail('ip:'+ip);
      return send(res, 401, { error:'wrong' });
    }
    tries.delete('u:'+username);
    await store.setLogin(u.username);
    auth.setCookie(res, { u:u.username, role:u.role });
    return send(res, 200, { username:u.username, name:u.name, role:u.role, period:u.period, tutorial:u.tutorial || null });
  }
  if(p[0] === 'logout' && m === 'POST'){ auth.clearCookie(res); return send(res, 200, { ok:true }); }

  if(p[0] === 'assets' && m === 'GET' && p[1]){
    if(!/^[a-f0-9]{64}$/.test(p[1])) return send(res, 404, 'not found');
    const a = await store.getAsset(p[1]);
    if(!a) return send(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type':a.type, 'Cache-Control':'public, max-age=31536000, immutable',
      'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'" });
    return res.end(a.data);
  }

  if(!me) return send(res, 401, { error:'login' });
  const user = await store.getUser(me.u);
  if(!user || user.disabled) return send(res, 401, { error:'login' });
  const teacher = user.role === 'teacher';

  if(p[0] === 'me' && p[1] === 'tutorial' && m === 'POST'){
    const b = await readJSON(req, 2000);
    const v = String(b.state || '').slice(0, 20);
    if(!/^(done|skipped|\d{1,3})$/.test(v)) return send(res, 400, { error:'state' });
    await store.setTutorial(user.username, v);
    return send(res, 200, { ok:true });
  }
  if(p[0] === 'me') return send(res, 200, { username:user.username, name:user.name, role:user.role, period:user.period, tutorial:user.tutorial || null });

  /* the Block Helper answers in the browser; the server only keeps what was
     asked (so the teacher can see what has no answer yet) */
  if(p[0] === 'helper' && p[1] === 'log' && m === 'POST'){
    const b = await readJSON(req, 4000);
    const question = String(b.q == null ? '' : b.q).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    const recipe = /^[a-z0-9-]{1,40}$/.test(b.recipe || '') ? b.recipe : null;
    const project = /^[\w-]{1,40}$/.test(b.project || '') ? b.project : null;
    if(!question && !recipe) return send(res, 400, { error:'empty' });
    if(helperBusy(user.username)) return send(res, 429, { error:'wait' });
    await store.logHelper({ username:user.username, project, question, recipe, kind: HELPER_KINDS.includes(b.kind) ? b.kind : 'ask' });
    return send(res, 200, { ok:true });
  }
  /* no recipe matched: ask the AI. The question is logged here (with the
     answer) instead of through /helper/log, so the teacher sees both. */
  if(p[0] === 'helper' && p[1] === 'ask' && m === 'POST'){
    if(!ai.enabled()) return send(res, 503, { error:'off' });
    const b = await readJSON(req, 4000);
    const question = String(b.q == null ? '' : b.q).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    if(!question) return send(res, 400, { error:'empty' });
    const pr = /^[\w-]{1,40}$/.test(b.project || '') ? await store.getProject(b.project) : null;
    if(!pr || (pr.owner !== user.username && !teacher)) return send(res, 404, { error:'none' });
    const busy = aiBusy(user.username);
    if(busy) return send(res, 429, { error:busy });
    const data = pr.data || {};
    const sprites = (data.targets || []).filter(t => !t.isStage).map(t => cleanName(t.name)).slice(0, 30);
    const a = data.about && typeof data.about === 'object' ? data.about : {};
    const player = (data.targets || []).find(t => t.id === a.player);
    const text = v => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
    const about = { story:text(a.story), next:text(a.next), has:Array.isArray(a.has) ? a.has.filter(x => typeof x === 'string').slice(0, 20) : [],
      playerName: player ? cleanName(player.name) : '' };
    let answer;
    try { answer = (await ai.ask(question, { about, sprites }, b.lang === 'es' ? 'es' : 'en')).slice(0, 2000); }
    catch(e){
      console.error('helper ai:', e.message);
      return send(res, 502, { error:'ai' });
    }
    await store.logHelper({ username:user.username, project:pr.id, question, recipe:null, kind:'ask', answer });
    return send(res, 200, { answer });
  }

  if(p[0] === 'assets' && m === 'POST'){
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if(!ASSET_TYPES.test(type)) return send(res, 415, { error:'type' });
    const buf = await readBody(req, MAX_ASSET);
    if(!buf.length) return send(res, 400, { error:'empty' });
    const id = crypto.createHash('sha256').update(buf).digest('hex');
    await store.putAsset(id, type, buf);
    return send(res, 200, { id });
  }

  if(p[0] === 'projects'){
    if(!p[1]){
      if(m === 'GET') return send(res, 200, await store.listProjects(user.username));
      if(m === 'POST'){
        const b = await readJSON(req);
        const pr = await store.createProject(user.username, cleanName(b.name) || 'Untitled', b.data || {}, b.thumb);
        return send(res, 200, { id:pr.id, name:pr.name, updated:pr.updated });
      }
    }
    if(p[1] === 'trash' && m === 'GET') return send(res, 200, await store.listDeleted(user.username));
    const pr = await store.getProject(p[1]);
    if(!pr || (pr.owner !== user.username && !teacher)) return send(res, 404, { error:'none' });
    const mine = pr.owner === user.username;
    const canEdit = mine || teacher;

    if(!p[2]){
      if(m === 'GET'){
        const owner = mine ? user : await store.getUser(pr.owner);
        return send(res, 200, { ...pr, readOnly: !mine, canEdit, ownerName: owner ? owner.name : pr.owner });
      }
      if(!canEdit || (m === 'DELETE' && !mine)) return send(res, 403, { error:'not yours' });
      if(m === 'PUT'){
        const b = await readJSON(req);
        const fields = {};
        if(b.name != null) fields.name = cleanName(b.name) || 'Untitled';
        if(b.data != null){
          if(typeof b.data !== 'object') return send(res, 400, { error:'data' });
          fields.data = b.data;
          fields.stats = projectStats(b.data);
        }
        if(b.thumb !== undefined) fields.thumb = typeof b.thumb === 'string' && b.thumb.length < 200000 ? b.thumb : null;
        if(pr.deleted && mine) await store.restoreDeleted(pr.id);
        let opts = { force: !!b.checkpoint, label: b.checkpoint ? 'saved' : undefined };
        if(!mine){
          // a teacher's change: keep the student's own work first, and mark the change
          fields.editedBy = user.username;
          if(await store.lastVersionLabel(pr.id) !== 'teacher edit'){
            await store.addVersion(pr.id, 'before teacher edit');
            opts = { force:true, label:'teacher edit' };
          }
        } else if(fields.data) fields.editedBy = null;
        const saved = await store.saveProject(pr.id, fields, opts);
        return send(res, 200, { id:saved.id, name:saved.name, updated:saved.updated });
      }
      if(m === 'DELETE'){ await store.deleteProject(pr.id); return send(res, 200, { ok:true }); }
    }
    if(p[2] === 'undelete' && m === 'POST' && mine){ await store.restoreDeleted(pr.id); return send(res, 200, { ok:true }); }
    if(p[2] === 'versions'){
      if(!p[3]) return send(res, 200, await store.listVersions(pr.id));
      const v = await store.getVersion(pr.id, p[3]);
      return v ? send(res, 200, v) : send(res, 404, { error:'none' });
    }
    if(p[2] === 'restore' && m === 'POST' && canEdit){
      const v = await store.getVersion(pr.id, p[3]);
      if(!v) return send(res, 404, { error:'none' });
      await store.addVersion(pr.id, 'before restore');          // the work being replaced is kept too
      await store.saveProject(pr.id, { data:v.data }, { force:true, label:'restored' });
      return send(res, 200, { ok:true });
    }
  }

  if(p[0] === 'admin'){
    if(!teacher) return send(res, 403, { error:'teacher' });
    if((p[1] === 'overview' || p[1] === 'students') && !p[2]) return send(res, 200, await store.overview());
    if(p[1] === 'helper' && m === 'GET'){
      const users = Object.fromEntries((await store.listUsers()).map(u => [u.username, u]));
      const who = o => { const u = users[o.owner || o.username]; return { name: u ? u.name : (o.owner || o.username), period: u ? u.period : '', role: u ? u.role : '' }; };
      const log = (await store.helperLog(3000)).map(e => ({ ...e, ...who(e) })).filter(e => e.role !== 'teacher');
      const games = (await store.gameSummaries()).map(g => ({ ...g, projectName:g.name, ...who(g) })).filter(g => g.role !== 'teacher');
      return send(res, 200, { log, games });
    }
    if(p[1] === 'users' && m === 'POST'){
      const b = await readJSON(req, 4000);
      const name = cleanName(b.name), role = b.role === 'teacher' ? 'teacher' : 'student';
      const period = role === 'teacher' ? '' : cleanName(b.period).slice(0, 10);
      if(!name) return send(res, 400, { error:'name' });
      if(role === 'student' && !period) return send(res, 400, { error:'period' });
      const username = await names.username(name, period, async u => !!(await store.getUser(u)));
      const password = role === 'teacher' ? names.teacherPassword() : names.studentPassword();
      await store.upsertUser({ username, name, period, role, ...auth.makeHash(password) });
      return send(res, 200, { username, password, name, period, role });
    }
    if(p[1] === 'students' && p[3] === 'projects'){
      return send(res, 200, await store.listProjects(p[2]));
    }
    if(p[1] === 'students' && p[3] === 'password' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      const b = await readJSON(req, 2000);
      const pw = String(b.password || '').trim().toLowerCase();
      if(pw.length < 4) return send(res, 400, { error:'short' });
      await store.upsertUser({ ...u, ...auth.makeHash(pw) });
      return send(res, 200, { ok:true });
    }
    if(p[1] === 'students' && p[3] === 'disable' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      if(u.username === user.username) return send(res, 400, { error:'self' });
      const b = await readJSON(req, 2000);
      await store.setDisabled(u.username, !!b.disabled);
      return send(res, 200, { ok:true });
    }
  }
  return send(res, 404, { error:'none' });
}

/* ---------------------------------------------------------------- boot */
async function seed(){
  const file = process.env.ROSTER_FILE || path.join(__dirname, '..', 'private', 'roster.json');
  if(!fs.existsSync(file)) return;
  const roster = JSON.parse(fs.readFileSync(file, 'utf8'));
  let made = 0;
  for(const u of roster){
    if(!(await store.getUser(u.username))){ await store.upsertUser(u); made++; }
  }
  if(made) console.log(`created ${made} accounts from the roster`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  try {
    if(url.pathname.startsWith('/api/')) return await api(req, res, url);
    if(req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method');
    serveStatic(req, res, url.pathname);
  } catch(e){
    if(!res.headersSent) send(res, e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.code ? e.message : 'server' });
    if(!e.code) console.error(e);
  }
});

const ready = (async () => {
  await store.init();
  await seed();
})();

if(require.main === module){
  ready.then(() => server.listen(PORT, () => console.log('Code Studio on http://localhost:' + PORT)))
       .catch(e => { console.error(e); process.exit(1); });
}
module.exports = { server, store, ready, seed };
