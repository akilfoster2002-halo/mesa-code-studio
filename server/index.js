/* =====================================================================
   CODE STUDIO — the server.

   Serves public/ and a small JSON API:
     POST /api/login  /api/logout   GET /api/me
     GET/POST /api/projects         GET/PUT/DELETE /api/projects/:id
     GET /api/projects/:id/versions[/:vid]   POST /api/projects/:id/restore/:vid
     POST /api/assets (raw bytes)   GET /api/assets/:id
     teacher only: GET /api/admin/students, /api/admin/students/:u/projects,
                   POST /api/admin/students/:u/password

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
const { open } = require('./store');

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
    if(!u || !auth.verify(String(b.password || '').trim().toLowerCase(), u.salt, u.hash)){
      fail('u:'+username); fail('ip:'+ip);
      return send(res, 401, { error:'wrong' });
    }
    tries.delete('u:'+username);
    auth.setCookie(res, { u:u.username, role:u.role });
    return send(res, 200, { username:u.username, name:u.name, role:u.role, period:u.period });
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
  if(!user) return send(res, 401, { error:'login' });
  const teacher = user.role === 'teacher';

  if(p[0] === 'me') return send(res, 200, { username:user.username, name:user.name, role:user.role, period:user.period });

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

    if(!p[2]){
      if(m === 'GET') return send(res, 200, { ...pr, readOnly: !mine });
      if(!mine) return send(res, 403, { error:'not yours' });
      if(m === 'PUT'){
        const b = await readJSON(req);
        const fields = {};
        if(b.name != null) fields.name = cleanName(b.name) || 'Untitled';
        if(b.data != null){
          if(typeof b.data !== 'object') return send(res, 400, { error:'data' });
          fields.data = b.data;
        }
        if(b.thumb !== undefined) fields.thumb = typeof b.thumb === 'string' && b.thumb.length < 200000 ? b.thumb : null;
        if(pr.deleted) await store.restoreDeleted(pr.id);
        const saved = await store.saveProject(pr.id, fields, { force: !!b.checkpoint, label: b.checkpoint ? 'saved' : undefined });
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
    if(p[2] === 'restore' && m === 'POST' && mine){
      const v = await store.getVersion(pr.id, p[3]);
      if(!v) return send(res, 404, { error:'none' });
      await store.addVersion(pr.id, 'before restore');          // the work being replaced is kept too
      await store.saveProject(pr.id, { data:v.data }, { force:true, label:'restored' });
      return send(res, 200, { ok:true });
    }
  }

  if(p[0] === 'admin'){
    if(!teacher) return send(res, 403, { error:'teacher' });
    if(p[1] === 'students' && !p[2]){
      const users = await store.listUsers();
      const out = [];
      for(const u of users){
        const ps = await store.listProjects(u.username);
        out.push({ username:u.username, name:u.name, period:u.period, role:u.role,
          projects:ps.length, updated: ps[0] ? ps[0].updated : null });
      }
      return send(res, 200, out);
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
