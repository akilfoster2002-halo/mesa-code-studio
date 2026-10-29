/* =====================================================================
   CODE STUDIO — the server.

   Serves public/ and a small JSON API:
     POST /api/login  /api/logout   GET /api/me
     GET/POST /api/projects         GET/PUT/DELETE /api/projects/:id
     GET /api/projects/:id/versions[/:vid]   POST /api/projects/:id/restore/:vid
     POST /api/assets (raw bytes)   GET /api/assets/:id
     POST /api/helper/ask           a Block Helper question, answered by the AI (server/ai.js)
     teacher only: GET /api/admin/overview, /api/admin/students/:u/projects,
                   POST /api/admin/users (add a student or teacher),
                   POST /api/admin/students/:u/password, /api/admin/students/:u/disable,
                   POST /api/admin/students/:u/tip (a note shown first in their Block Helper; empty clears it)
     A teacher may also open, change and restore any student's project; the
     student's work from before the change is kept in its history.
     Learn games (/learn) and Intro to HTML (/html): GET/PUT /api/learn (stars per level, best word-match time,
       html activity scores and the student's page;
       a save only ever adds: each level keeps its most stars); teacher: GET /api/admin/learn
     Game Design Studio (/design): GET/PUT /api/design (the student's own packet);
       teacher: GET /api/admin/designs, GET /api/admin/designs/:u,
                POST /api/admin/designs/:u/approve (the "my idea is small enough" check)

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
const FEEDBACK = require('../public/js/feedback-def.js');

const PORT = Number(process.env.PORT) || 8790;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_PROJECT = 3 * 1024 * 1024;        // project JSON (assets live elsewhere)
const MAX_ASSET = 12 * 1024 * 1024;         // one picture or sound
const MAX_DESIGN = 2 * 1024 * 1024;         // a design packet, sketches included

const ASSET_TYPES = /^(image\/(png|jpeg|gif|webp|svg\+xml|bmp|avif)|audio\/[\w.+-]+|video\/(mp4|webm|ogg))$/;

const store = open();

/* ------------------------------------------------------------- helpers */
/* two students in the same period (a teacher is in every class) */
async function sameClass(user, username){
  if(user.role === 'teacher') return true;
  const o = await store.getUser(username);
  return !!o && o.role === 'student' && !o.disabled && !!user.period && o.period === user.period;
}
/* feedback slips with the names of who wrote them, who made the game, and the game */
async function withNames(list){
  const users = Object.fromEntries((await store.listUsers()).map(u => [u.username, u]));
  const names = {};
  for(const f of list) if(!(f.project in names)){ const pr = await store.getProject(f.project); names[f.project] = pr ? pr.name : ''; }
  return list.map(f => ({ project:f.project, game:names[f.project], owner:f.owner, ownerName:(users[f.owner] || {}).name || f.owner,
    reviewer:f.reviewer, reviewerName:(users[f.reviewer] || {}).name || f.reviewer, period:(users[f.owner] || {}).period || '',
    data:f.data, updated:f.updated, complete:FEEDBACK.complete(f.data) }));
}

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

/* AI answers are free but limited (see server/ai.js), so one student gets
   20 an hour and the whole class 300 a day (AI_DAILY_LIMIT) */
const aiHits = new Map();
let aiDay = { day:'', n:0 };
function aiBusy(username){
  const day = new Date().toISOString().slice(0, 10);
  if(aiDay.day !== day) aiDay = { day, n:0 };
  if(aiDay.n >= (Number(process.env.AI_DAILY_LIMIT) || 300)) return 'day';
  const t = aiHits.get(username);
  if(t && Date.now() - t.start < 60*60*1000 && t.n >= 20) return 'hour';
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
  if(pathname === '/design' || pathname === '/design/') pathname = '/design.html';
  if(pathname === '/learn' || pathname === '/learn/') pathname = '/learn.html';
  if(pathname === '/html' || pathname === '/html/') pathname = '/html.html';
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
    return send(res, 200, { username:u.username, name:u.name, role:u.role, period:u.period, tutorial:u.tutorial || null, tip:u.helper_tip || null });
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
  // the teacher can lock a period: its students can open and play their games, not change them
  const locked = !teacher && !!user.locked;

  if(p[0] === 'me' && p[1] === 'tutorial' && m === 'POST'){
    const b = await readJSON(req, 2000);
    const v = String(b.state || '').slice(0, 20);
    if(!/^(done|skipped|\d{1,3})$/.test(v)) return send(res, 400, { error:'state' });
    await store.setTutorial(user.username, v);
    return send(res, 200, { ok:true });
  }
  if(p[0] === 'me') return send(res, 200, { username:user.username, name:user.name, role:user.role, period:user.period, tutorial:user.tutorial || null, tip:user.helper_tip || null, locked });

  /* the Block Helper: the browser sends the question with the project as
     it is on screen (names and scripts only) and the chat so far */
  if(p[0] === 'helper' && p[1] === 'ask' && m === 'POST'){
    if(!ai.enabled()) return send(res, 503, { error:'off' });
    const b = await readJSON(req, 400000);
    const q = String(b.q == null ? '' : b.q).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 300);
    if(!q) return send(res, 400, { error:'empty' });
    const busy = aiBusy(user.username);
    if(busy) return send(res, 429, { error:busy });
    try {
      const answer = await ai.ask({ q, game:b.game, current:cleanName(b.sprite), history:b.history, lang: b.lang === 'es' ? 'es' : 'en' });
      return send(res, 200, answer);
    } catch(e){
      console.error('helper ai:', e.message);
      return send(res, 502, { error:'ai' });
    }
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
        if(locked) return send(res, 403, { error:'locked' });
        const b = await readJSON(req);
        const pr = await store.createProject(user.username, cleanName(b.name) || 'Untitled', b.data || {}, b.thumb);
        return send(res, 200, { id:pr.id, name:pr.name, updated:pr.updated });
      }
    }
    if(p[1] === 'trash' && m === 'GET') return send(res, 200, await store.listDeleted(user.username));
    const pr = await store.getProject(p[1]);
    // a classmate (same period) may open a game to play it and give feedback — look only, never change
    const classmate = !!pr && !teacher && pr.owner !== user.username && !p[2] && m === 'GET' && !pr.deleted &&
      await sameClass(user, pr.owner);
    if(!pr || (pr.owner !== user.username && !teacher && !classmate)) return send(res, 404, { error:'none' });
    const mine = pr.owner === user.username;
    const canEdit = (mine && !locked) || teacher;

    if(!p[2]){
      if(m === 'GET'){
        const owner = mine ? user : await store.getUser(pr.owner);
        return send(res, 200, { ...pr, readOnly: !mine || locked, canEdit, locked: mine && locked, ownerName: owner ? owner.name : pr.owner });
      }
      if(!canEdit || (m === 'DELETE' && !mine)) return send(res, 403, { error: locked ? 'locked' : 'not yours' });
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
    if(p[2] === 'undelete' && m === 'POST' && mine && !locked){ await store.restoreDeleted(pr.id); return send(res, 200, { ok:true }); }
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

  /* Class Games: everyone's games in my period, and feedback slips */
  if(p[0] === 'class' && p[1] === 'games' && !p[2] && m === 'GET'){
    const period = teacher ? String(url.searchParams.get('period') || '') : user.period;
    const people = await store.classGames(period);
    const mineDone = new Set((await store.listFeedback({ reviewer:user.username })).map(f => f.project));
    const counts = {};
    for(const f of await store.listFeedback()) counts[f.project] = (counts[f.project] || 0) + 1;
    return send(res, 200, { period, me:user.username, people:people.map(u => ({ ...u,
      projects:u.projects.filter(pr => (pr.stats && pr.stats.blocks) > 0 || u.username === user.username)
        .map(pr => ({ id:pr.id, name:pr.name, thumb:pr.thumb, updated:pr.updated, blocks:(pr.stats && pr.stats.blocks) || 0,
          reviewed:mineDone.has(pr.id), slips:counts[pr.id] || 0 })) })) });
  }
  if(p[0] === 'feedback' && p[1] === 'received' && !p[2] && m === 'GET'){
    const list = await store.listFeedback({ owner:user.username });
    return send(res, 200, await withNames(list));
  }
  if(p[0] === 'feedback' && p[1] && p[1] !== 'received' && !p[2]){
    const pr = await store.getProject(p[1]);
    if(!pr || pr.deleted) return send(res, 404, { error:'none' });
    if(m === 'GET'){ const f = await store.getFeedback(pr.id, user.username); return send(res, 200, { data:f ? f.data : null, updated:f ? f.updated : null }); }
    if(m === 'PUT'){
      if(pr.owner === user.username) return send(res, 400, { error:'yours' });
      if(!teacher && !(await sameClass(user, pr.owner))) return send(res, 403, { error:'class' });
      const b = await readJSON(req, 20000);
      const f = await store.saveFeedback(pr.id, user.username, pr.owner, FEEDBACK.clean(b.data));
      return send(res, 200, { updated:f.updated });
    }
  }

  if(p[0] === 'learn' && !p[1]){
    if(m === 'GET'){ const d = await store.getLearn(user.username); return send(res, 200, { data:d ? d.data : null }); }
    if(m === 'PUT'){
      const b = await readJSON(req, 100000);
      const old = (await store.getLearn(user.username) || {}).data || {};
      const merged = mergeLearn(old, b.data || {});
      await store.saveLearn(user.username, merged);
      return send(res, 200, { data:merged });
    }
  }

  if(p[0] === 'design' && !p[1]){
    if(m === 'GET'){ const d = await store.getDesign(user.username); return send(res, 200, d ? { data:d.data, updated:d.updated } : { data:null }); }
    if(m === 'PUT'){
      const b = await readJSON(req, MAX_DESIGN);
      if(!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return send(res, 400, { error:'data' });
      const old = await store.getDesign(user.username);
      const was = (old && old.data) || {};
      // written from a copy that is out of date (the plan is open on another computer): send back the newer one
      if(b.base !== undefined && old && (was.savedAt || 0) !== (b.base || 0)) return send(res, 409, { error:'newer', data:was, updated:old.updated });
      const data = { ...b.data, approved: !!was.approved, approvedBy: was.approvedBy || null };    // only a teacher sets these
      const d = await store.saveDesign(user.username, data);
      return send(res, 200, { updated:d.updated });
    }
  }

  if(p[0] === 'admin'){
    if(!teacher) return send(res, 403, { error:'teacher' });
    if(p[1] === 'feedback' && !p[2] && m === 'GET'){
      const period = String(url.searchParams.get('period') || ''), project = String(url.searchParams.get('project') || '');
      if(project) return send(res, 200, await withNames(await store.listFeedback({ project })));
      const owners = period ? new Set((await store.listUsers()).filter(u => u.period === period).map(u => u.username)) : null;
      const list = (await store.listFeedback()).filter(f => !owners || owners.has(f.owner));
      return send(res, 200, await withNames(list));
    }
    if(p[1] === 'learn' && !p[2] && m === 'GET'){
      const users = (await store.listUsers()).filter(u => u.role === 'student');
      const ls = Object.fromEntries((await store.listLearn()).map(d => [d.owner, d]));
      return send(res, 200, users.map(u => {
        const d = ls[u.username], lv = (d && d.data && d.data.levels) || {};
        const byChapter = {};
        for(const [id, v] of Object.entries(lv)){ const c = id.split('-')[0]; byChapter[c] = (byChapter[c] || 0) + 1; }
        return { username:u.username, name:u.name, period:u.period, disabled:!!u.disabled, updated:d ? d.updated : null,
          levels:Object.keys(lv).length, stars:Object.values(lv).reduce((n, v) => n + (v.stars || 0), 0), byChapter,
          words: d && d.data && d.data.words ? d.data.words : null,
          html: d && d.data && d.data.html && d.data.html.acts ? d.data.html.acts : {} };
      }));
    }
    if(p[1] === 'designs' && !p[2] && m === 'GET'){
      const users = (await store.listUsers()).filter(u => u.role === 'student');
      const ds = Object.fromEntries((await store.listDesigns()).map(d => [d.owner, d]));
      return send(res, 200, users.map(u => ({ username:u.username, name:u.name, period:u.period, disabled:!!u.disabled,
        updated: ds[u.username] ? ds[u.username].updated : null, ...(ds[u.username] ? ds[u.username].summary : { done:0, step:0, title:'', approved:false }) })));
    }
    if(p[1] === 'designs' && p[2] && !p[3] && m === 'GET'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      const d = await store.getDesign(u.username);
      return send(res, 200, { username:u.username, name:u.name, period:u.period, data:d ? d.data : null, updated:d ? d.updated : null });
    }
    if(p[1] === 'designs' && p[3] === 'approve' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      const b = await readJSON(req, 2000);
      const d = await store.getDesign(u.username);
      await store.saveDesign(u.username, { ...(d ? d.data : {}), approved: !!b.approved, approvedBy: b.approved ? user.username : null });
      return send(res, 200, { ok:true });
    }
    if((p[1] === 'overview' || p[1] === 'students') && !p[2]) return send(res, 200, await store.overview());
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
    if(p[1] === 'students' && p[3] === 'tip' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      const b = await readJSON(req, 8000);
      await store.setTip(u.username, String(b.tip || '').replace(/\r/g, '').trim().slice(0, 2000));
      return send(res, 200, { ok:true });
    }
    if(p[1] === 'lock'){
      if(m === 'GET'){ const us = await store.listUsers(); return send(res, 200, [...new Set(us.filter(u => u.role === 'student' && u.locked).map(u => u.period))]); }
      if(m === 'POST'){
        const b = await readJSON(req, 2000), period = String(b.period || '');
        if(!period) return send(res, 400, { error:'period' });
        await store.setLocked(period, !!b.locked);
        return send(res, 200, { ok:true });
      }
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

/* Learn progress only grows: a level keeps its most stars, the word game its
   fastest time, so two computers (or an old tab) can never take stars away. */
function mergeLearn(old, add){
  const out = { levels:{ ...(old.levels || {}) }, words:old.words || null };
  for(const [id, v] of Object.entries(add.levels || {})){
    if(!/^[a-z]+-\d{1,2}$/.test(id)) continue;
    const stars = Math.max(0, Math.min(3, Number(v && v.stars) || 0));
    if(!out.levels[id] || out.levels[id].stars < stars) out.levels[id] = { stars };
  }
  const w = add.words;
  if(w && Number.isFinite(w.secs) && w.secs > 0 && (!out.words || w.secs < out.words.secs))
    out.words = { secs:Math.round(w.secs), mistakes:Math.max(0, Math.round(Number(w.mistakes) || 0)) };
  // Intro to HTML (/html): best score 0-100 per activity, times played, and the student's own page
  out.html = { ...(old.html || {}) };
  for(const [id, v] of Object.entries((add.html && add.html.acts) || {})){
    if(!/^[a-z]{2,12}$/.test(id)) continue;
    const was = (out.html.acts || {})[id] || { best:0, n:0 };
    const best = Math.max(was.best, Math.max(0, Math.min(100, Math.round(Number(v && v.best) || 0))));
    out.html.acts = { ...(out.html.acts || {}), [id]:{ best, n:was.n + 1 } };
  }
  if(add.html && typeof add.html.page === 'string') out.html.page = add.html.page.slice(0, 20000);
  return out;
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
