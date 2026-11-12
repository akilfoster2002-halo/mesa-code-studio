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
       Turning the packet in locks it: POST /api/design/turnin (the student; only
       a teacher can give it back), teacher: POST /api/admin/designs/:u/turnin { on },
       POST /api/admin/designs/turnin { on, period } (every student in a period)
     The Game Design assignment in the Classroom is the student's block game. Turning it
     in is the editor lock (they can still open and play it): POST /api/game/turnin (the
     student); teacher: POST /api/admin/students/:u/lock { locked }, POST /api/admin/lock (a period)

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
const HTMLLESSONS = require('../public/js/html-lessons.js');
const MERGE = require('../public/js/merge.js');
const HIST = require('./pagehist.js');
const HINTS = require('./hints.js');

const PORT = Number(process.env.PORT) || 8790;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_PROJECT = 3 * 1024 * 1024;        // project JSON (assets live elsewhere)
const MAX_ASSET = 12 * 1024 * 1024;         // one picture or sound
const MAX_DESIGN = 2 * 1024 * 1024;         // a design packet, sketches included
// a packet turned in (locked: the student cannot change it) or given back
const turnIn = (data, on) => ({ ...(data || {}), turnedIn:on, turnedInAt:on ? new Date().toISOString() : null });
const MAX_FILE = 400 * 1024;                 // one HTML file a student attaches to an assignment

const ASSET_TYPES = /^(image\/(png|jpeg|gif|webp|svg\+xml|bmp|avif)|audio\/[\w.+-]+|video\/(mp4|webm|ogg))$/;

const store = open();

/* ------------------------------------------------------------- helpers */
/* two students in the same period (a teacher is in every class) */
/* one save at a time to a student's Learn record (their pages live in it, and
   classmates sharing a page save to it at the same time) */
const learnLocks = new Map();
function withLearn(owner, fn){
  const run = (learnLocks.get(owner) || Promise.resolve()).then(fn, fn);
  const done = run.catch(() => {});
  learnLocks.set(owner, done);
  done.then(() => { if(learnLocks.get(owner) === done) learnLocks.delete(owner); });
  return run;
}
/* who has a shared page open right now, and where their cursor is in the page
   as the server has it: 'owner/key' → { username:{ name, at, sel:[from, to] } }
   (sel undefined = keep where it was; a page that changes moves every cursor with it) */
const pageHere = new Map();
function here(doc, user, sel){
  const now = Date.now(), m = pageHere.get(doc) || {};
  if(user) m[user.username] = { name:user.name, at:now, sel:sel === undefined ? (m[user.username] || {}).sel || null : sel };
  for(const [u, x] of Object.entries(m)) if(now - x.at > 8000) delete m[u];
  pageHere.set(doc, m);
  return Object.entries(m).map(([username, x]) => ({ username, name:x.name, sel:x.sel }));
}
function moveCursors(doc, from, to){
  const m = pageHere.get(doc);
  if(!m || from === to) return;
  const hs = MERGE.hunks(from, to);
  for(const x of Object.values(m)) if(x.sel) x.sel = x.sel.map(i => MERGE.mapPoint(i, hs));
}
// a cursor sent by an editor: [where the selection started, where the cursor is] inside a page this long
const selOf = (v, len) => { const a = Array.isArray(v) ? v : String(v || '').split(','); const n = a.slice(0, 2).map(Number);
  return n.length === 2 && n.every(i => Number.isInteger(i) && i >= 0 && i <= len) ? n : undefined; };

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
  // the Classroom is the front page; the block editor (and its #/p/<id> links) is /studio
  if(pathname === '/' || pathname === '/classroom') pathname = '/classroom.html';
  if(pathname === '/studio' || pathname === '/studio/') pathname = '/index.html';
  if(pathname === '/design' || pathname === '/design/') pathname = '/design.html';
  if(pathname === '/learn' || pathname === '/learn/') pathname = '/learn.html';
  if(pathname === '/html' || pathname === '/html/') pathname = '/html.html';
  if(/^\/(resume|wiki|game)\/?$/.test(pathname)) pathname = '/resume.html';   // one editor for both pages
  if(pathname === '/drive' || pathname === '/drive/') pathname = '/drive.html';
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

  /* the Classroom (/): one class per period, like Google Classroom.
     GET  /api/room            the periods (teacher: every period; student: theirs)
     GET  /api/room/:p         posts on the Stream + Classwork settings (hidden, due)
     POST /api/room/:p/posts   teacher: { text } a new post; DELETE /api/room/:p/posts/:id
     PUT  /api/room/:p/work/:item  teacher: { hidden, due }
     GET  /api/room/:p/grades  teacher: every student's work in that period
     POST /api/room/:p/assignments  teacher: { title, text, topic, due, to } a new assignment (PUT/DELETE …/:a); to = usernames, [] = everyone
     GET  /api/room/:p/assignments/:a/work   student: their files and turned-in state; teacher: every student's
     GET  …/work/:student/files/:f   one attached file, as { name, html } (shown in a sandboxed frame)
     POST …/files { name, html } · DELETE …/files/:f · POST …/turnin { on }   (the student)
     PUT  …/work/:student/grade { grade }   teacher: out of the assignment's points (null clears it)
     POST …/work/:student/comments { text } private comments, the teacher or that student */
  if(p[0] === 'room'){
    const users = await store.listUsers();
    const periods = [...new Set(users.filter(u => u.role === 'student' && !u.disabled && u.period).map(u => String(u.period)))].sort();
    if(!p[1] && m === 'GET') return send(res, 200, teacher ? periods : [String(user.period || '')]);
    const period = String(p[1] || '');
    if(!teacher && period !== String(user.period)) return send(res, 403, { error:'class' });
    if(!/^[\w-]{1,20}$/.test(period)) return send(res, 400, { error:'period' });
    const cls = (await store.getClass(period) || {}).data || {};
    const room = { posts:Array.isArray(cls.posts) ? cls.posts : [], work:cls.work && typeof cls.work === 'object' ? cls.work : {},
      assignments:Array.isArray(cls.assignments) ? cls.assignments : [] };
    // an assignment with `to` (usernames) is only for those students; without it, the whole class
    const isFor = (a, username) => !Array.isArray(a.to) || !a.to.length || a.to.includes(username);
    const kidsOf = () => users.filter(u => u.role === 'student' && !u.disabled && String(u.period) === period);
    if(!p[2] && m === 'GET') return send(res, 200, teacher
      ? { ...room, students:kidsOf().map(u => ({ username:u.username, name:u.name })).sort((x, y) => x.name.localeCompare(y.name)) }
      : { ...room, assignments:room.assignments.filter(a => isFor(a, user.username)) });

    /* My Resume hints: POST /api/room/:p/hints { only? }   teacher → a "✏️ To do" comment for every checklist box
       (Parts 1–3) not ticked yet, in each student's resume.html that is typed and not turned in.
       Saved like typing: the History shows the teacher added those lines. */
    if(p[2] === 'hints' && !p[3] && m === 'POST'){
      if(!teacher) return send(res, 403, { error:'teacher' });
      const S = HTMLLESSONS.SITES.site, out = { added:[], done:0, empty:0, turnedIn:0 };
      if((room.work[S.item] || {}).locked) return send(res, 423, { error:'locked' });     // locked: the pages stay as they are
      // { only:[usernames] }: just those students (the ones behind, or one student); none = the whole class
      const b = await readJSON(req, 20000), only = Array.isArray(b.only) ? new Set(b.only.map(String)) : null;
      for(const u of kidsOf().filter(u => !only || only.has(u.username)).sort((x, y) => x.name.localeCompare(y.name))){
        const r = await withLearn(u.username, async () => {
          const d = (await store.getLearn(u.username) || {}).data || {}, h = d.html || {};
          if(h[S.key + 'In']) return 'turnedIn';
          const now = h[S.key] || '';
          if(!now.trim()) return 'empty';
          const x = HINTS.hint(now);
          if(x.text === now) return 'done';
          const t = HIST.record(h, S.key, now, x.text, user.username);
          await store.saveLearn(u.username, { ...d, html:{ ...t.html, [S.key]:x.text } });
          moveCursors(u.username + '/' + S.key, now, x.text);
          await keepVersion(u.username, S, x.text, t, user.username);
          return x.hints;
        });
        if(typeof r === 'number') out.added.push({ username:u.username, name:u.name, hints:r }); else out[r]++;
      }
      return send(res, 200, out);
    }

    /* a teacher's assignment: students attach HTML files and turn them in */
    if(p[2] === 'assignments' && p[3] && p[4]){
      const a = room.assignments.find(x => x.id === p[3]);
      if(!a || (!teacher && !isFor(a, user.username))) return send(res, 404, { error:'none' });
      const summary = sub => { const d = (sub && sub.data) || {};
        return { turnedIn:!!d.turnedIn, at:d.at || null, files:(d.files || []).map(f => ({ id:f.id, name:f.name, size:f.html.length })),
          grade:d.grade == null ? null : d.grade, gradedAt:d.gradedAt || null, comments:d.comments || [] }; };
      const blank = { files:[], turnedIn:false, at:null, grade:null, comments:[] };
      if(p[4] === 'work' && !p[5] && m === 'GET'){
        if(!teacher) return send(res, 200, summary(await store.getSubmission(a.id, user.username)));
        const subs = Object.fromEntries((await store.listSubmissions([a.id])).map(x => [x.owner, x]));
        const kids = kidsOf().filter(u => isFor(a, u.username)).sort((x, y) => x.name.localeCompare(y.name));
        return send(res, 200, kids.map(u => ({ username:u.username, name:u.name, ...summary(subs[u.username]) })));
      }
      if(p[4] === 'work' && p[5] && p[6] === 'files' && p[7] && !p[8] && m === 'GET'){
        if(!teacher && p[5] !== user.username) return send(res, 403, { error:'yours' });
        const f = (((await store.getSubmission(a.id, p[5])) || {}).data || {}).files || [];
        const file = f.find(x => x.id === p[7]);
        // sent as data, never as a page from this site: it is shown in a sandboxed frame
        return file ? send(res, 200, { name:file.name, html:file.html }) : send(res, 404, { error:'none' });
      }
      // private comments: between the teacher and one student, on that student's work
      if(p[4] === 'work' && p[5] && p[6] === 'comments' && !p[7] && m === 'POST'){
        if(!teacher && p[5] !== user.username) return send(res, 403, { error:'yours' });
        const kid = users.find(u => u.username === p[5] && u.role === 'student' && String(u.period) === period);
        if(!kid) return send(res, 404, { error:'none' });
        const b = await readJSON(req, 6000);
        const text = String(b.text || '').trim().slice(0, 2000);
        if(!text) return send(res, 400, { error:'text' });
        const sub = await store.getSubmission(a.id, kid.username);
        const d = { ...blank, ...((sub && sub.data) || {}) };
        d.comments = [...(d.comments || []), { by:user.username, name:user.name, teacher, text, at:new Date().toISOString() }].slice(-100);
        await store.saveSubmission(a.id, kid.username, d);
        return send(res, 200, summary({ data:d }));
      }
      // the teacher's grade (out of the assignment's points; null takes it away)
      if(p[4] === 'work' && p[5] && p[6] === 'grade' && !p[7] && m === 'PUT'){
        if(!teacher) return send(res, 403, { error:'teacher' });
        const kid = users.find(u => u.username === p[5] && u.role === 'student' && String(u.period) === period);
        if(!kid) return send(res, 404, { error:'none' });
        const b = await readJSON(req, 1000);
        const g = b.grade === null || b.grade === '' ? null : Number(b.grade);
        if(g !== null && !(Number.isFinite(g) && g >= 0 && g <= 1000)) return send(res, 400, { error:'grade' });
        const sub = await store.getSubmission(a.id, kid.username);
        const d = { ...blank, ...((sub && sub.data) || {}) };
        d.grade = g === null ? null : Math.round(g * 10) / 10; d.gradedAt = g === null ? null : new Date().toISOString();
        await store.saveSubmission(a.id, kid.username, d);
        return send(res, 200, summary({ data:d }));
      }
      if(teacher) return send(res, 400, { error:'student' });
      const sub = await store.getSubmission(a.id, user.username);
      const d = { ...blank, ...((sub && sub.data) || {}) };
      if(p[4] === 'files' && !p[5] && m === 'POST'){
        if(d.turnedIn) return send(res, 409, { error:'turnedIn' });
        const b = await readJSON(req, MAX_FILE + 2000);
        const html = String(b.html || ''), name = String(b.name || '').replace(/[^\w .()-]/g, '').slice(0, 80) || 'page.html';
        if(!html.trim() || html.length > MAX_FILE) return send(res, 400, { error:'size' });
        if(d.files.length >= 5) return send(res, 400, { error:'count' });
        d.files.push({ id:crypto.randomBytes(6).toString('base64url'), name, html });
      } else if(p[4] === 'files' && p[5] && !p[6] && m === 'DELETE'){
        if(d.turnedIn) return send(res, 409, { error:'turnedIn' });
        d.files = d.files.filter(f => f.id !== p[5]);
      } else if(p[4] === 'turnin' && !p[5] && m === 'POST'){
        const b = await readJSON(req, 1000);
        d.turnedIn = !!b.on; d.at = d.turnedIn ? new Date().toISOString() : null;
      } else return send(res, 404, { error:'none' });
      await store.saveSubmission(a.id, user.username, d);
      return send(res, 200, summary({ data:d }));
    }

    if(!teacher) return send(res, 403, { error:'teacher' });
    // make, change or delete an assignment
    if(p[2] === 'assignments' && (!p[3] ? m === 'POST' : !p[4] && m === 'PUT')){
      const b = await readJSON(req, 20000);
      const title = String(b.title || '').trim().slice(0, 120);
      if(!title) return send(res, 400, { error:'title' });
      const fields = { title, text:String(b.text || '').trim().slice(0, 4000), topic:/^[a-z0-9-]{1,30}$/.test(b.topic || '') ? b.topic : 'assignments',
        due:/^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : null, files:b.files !== false,
        to:Array.isArray(b.to) ? b.to.filter(u => kidsOf().some(k => k.username === u)).slice(0, 200) : [],
        points:Number.isFinite(Number(b.points)) && b.points !== '' && b.points != null ? Math.max(0, Math.min(1000, Math.round(Number(b.points)))) : 100 };
      if(!p[3]) room.assignments.push({ id:'a-' + crypto.randomBytes(6).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, 'x'), ...fields, by:user.name, at:new Date().toISOString() });
      else { const a = room.assignments.find(x => x.id === p[3]); if(!a) return send(res, 404, { error:'none' }); Object.assign(a, fields); }
      await store.saveClass(period, room);
      return send(res, 200, { ...room, students:kidsOf().map(u => ({ username:u.username, name:u.name })).sort((x, y) => x.name.localeCompare(y.name)) });
    }
    if(p[2] === 'assignments' && p[3] && !p[4] && m === 'DELETE'){
      room.assignments = room.assignments.filter(x => x.id !== p[3]);
      await store.saveClass(period, room);
      return send(res, 200, room);
    }
    if(p[2] === 'posts' && !p[3] && m === 'POST'){
      const b = await readJSON(req, 20000);
      const text = String(b.text || '').trim().slice(0, 4000);
      if(!text) return send(res, 400, { error:'text' });
      room.posts.unshift({ id:crypto.randomBytes(6).toString('base64url'), text, by:user.name, at:new Date().toISOString() });
      room.posts = room.posts.slice(0, 200);
      await store.saveClass(period, room);
      return send(res, 200, room);
    }
    if(p[2] === 'posts' && p[3] && m === 'DELETE'){
      room.posts = room.posts.filter(x => x.id !== p[3]);
      await store.saveClass(period, room);
      return send(res, 200, room);
    }
    if(p[2] === 'work' && /^[a-z0-9-]{1,30}$/.test(p[3] || '') && !p[4] && m === 'PUT'){
      const b = await readJSON(req, 2000), was = room.work[p[3]] || {};
      const due = 'due' in b ? (/^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : null) : was.due || null;
      // locked: the students' typed page for this item can no longer change (only the teacher unlocks it)
      const w = { hidden:'hidden' in b ? !!b.hidden : !!was.hidden, due, ...(('locked' in b ? !!b.locked : !!was.locked) ? { locked:true } : {}) };
      if(!w.hidden && !w.due && !w.locked) delete room.work[p[3]]; else room.work[p[3]] = w;
      await store.saveClass(period, room);
      return send(res, 200, room);
    }
    if(p[2] === 'grades' && !p[3] && m === 'GET'){
      const kids = users.filter(u => u.role === 'student' && !u.disabled && String(u.period) === period);
      const learn = Object.fromEntries((await store.listLearn()).map(d => [d.owner, d.data || {}]));
      const designs = Object.fromEntries((await store.listDesigns()).map(d => [d.owner, d.summary]));
      const over = Object.fromEntries((await store.overview()).map(r => [r.username, r]));
      // each student's games (with blocks in them), the biggest first
      const games = Object.fromEntries((await store.classGames(period)).map(u => [u.username, u.projects
        .filter(pr => (pr.stats && pr.stats.blocks) > 0).sort((a, b) => b.stats.blocks - a.stats.blocks)
        .map(pr => ({ id:pr.id, name:pr.name, thumb:pr.thumb || null, blocks:pr.stats.blocks, updated:pr.updated }))]));
      // Game Feedback: the slips each student filled out all the way, and on whose games
      const fbNames = Object.fromEntries((await store.classGames(period)).flatMap(u => u.projects.map(pr => [pr.id, { game:pr.name, owner:u.name }])));
      const slips = {};
      for(const f of await store.listFeedback()) if(FEEDBACK.complete(f.data || {}))
        (slips[f.reviewer] || (slips[f.reviewer] = [])).push({ project:f.project, ...(fbNames[f.project] || { game:'', owner:'' }) });
      const subs = {};
      for(const x of await store.listSubmissions(room.assignments.map(a => a.id)))
        (subs[x.owner] || (subs[x.owner] = {}))[x.assignment] = { turnedIn:!!x.data.turnedIn, at:x.data.at || null, files:(x.data.files || []).length,
          grade:x.data.grade == null ? null : x.data.grade };
      return send(res, 200, kids.sort((a, b) => a.name.localeCompare(b.name)).map(u => ({ username:u.username, name:u.name,
        learn:{ levels:(learn[u.username] || {}).levels || {}, words:(learn[u.username] || {}).words || null, html:((learn[u.username] || {}).html || {}).acts || {},
          ...HTMLLESSONS.sitesOf((learn[u.username] || {}).html) },
        design:designs[u.username] || null, projects:(over[u.username] || {}).projects || 0, blocks:(over[u.username] || {}).blocks || 0,
        last_login:(over[u.username] || {}).last_login || null, subs:subs[u.username] || {},
        locked:!!u.locked, games:games[u.username] || [], slips:slips[u.username] || [] })));
    }
  }

  /* Class Games: everyone's games in my period, and feedback slips */
  if(p[0] === 'class' && p[1] === 'games' && !p[2] && m === 'GET'){
    const period = teacher ? String(url.searchParams.get('period') || '') : user.period;
    const people = await store.classGames(period);
    const mineDone = new Set((await store.listFeedback({ reviewer:user.username })).map(f => f.project));
    const counts = {};
    for(const f of await store.listFeedback()) counts[f.project] = (counts[f.project] || 0) + 1;
    const given = (await store.listFeedback({ reviewer:user.username })).filter(f => FEEDBACK.complete(f.data || {})).map(f => f.project);
    return send(res, 200, { period, me:user.username, given, people:people.map(u => ({ ...u,
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
    // take a game off my Game Feedback list (my own slip on it goes too)
    if(m === 'DELETE'){ await store.deleteFeedback(pr.id, user.username); return send(res, 200, { ok:true }); }
  }

  if(p[0] === 'learn' && !p[1]){
    if(m === 'GET'){ const d = await store.getLearn(user.username); return send(res, 200, { data:d ? d.data : null }); }
    if(m === 'PUT'){
      const b = await readJSON(req, 200000);
      for(const k of await lockedSites(user)) if(b.data && b.data.html){ delete b.data.html[k]; delete b.data.html[k + 'In']; }
      const merged = await withLearn(user.username, async () => {
        const old = (await store.getLearn(user.username) || {}).data || {};
        const out = mergeLearn(old, b.data || {}), changed = [];
        // a typed page that changed: who typed what (see pagehist.js)
        for(const S of Object.values(HTMLLESSONS.SITES)){
          const was = (old.html || {})[S.key] || '', is = out.html[S.key] || '';
          if(was !== is){ const t = HIST.record(out.html, S.key, was, is, user.username); out.html = t.html; changed.push([S, is, t]); }
        }
        await store.saveLearn(user.username, out);
        for(const [S, text, t] of changed) await keepVersion(user.username, S, text, t, user.username);
        return out;
      });
      return send(res, 200, { data:merged });
    }
  }

  /* A page typed in the editor (My Resume, Website Presentation), by its owner and
     the classmates they share it with, at the same time (as in Google Docs):
       GET  /api/page/:owner/:key?h=<fingerprint>   the page ({ same:true } if it has not changed),
                                                    and who has it open
       PUT  /api/page/:owner/:key { base, text }    my changes since base, put together with
                                                    everyone else's (MERGE.merge3); the page back
       POST /api/page/:key/share { with:[usernames] }  the owner shares it (classmates only)
       GET  /api/page/:key/shared                   who I share mine with; pages shared with me
       POST /api/page/:owner/:key/files { name, id }   a picture (already in /api/assets) put in the
                                                    page's files folder, used in the code by its name
       DELETE /api/page/:owner/:key/files/:name     taken out of the folder
     A teacher reads any page. Turned in, it does not change. */
  /* My Drive: each student's own pictures, kept to use in any page (html.drive = { name:assetId }),
     with their pages and the pages shared with them
       GET /api/drive          { files, pages:[{ key, file, path, len, in }], shared:[{ owner, name, key, title, path }] }
       POST /api/drive { name, id }   a picture (already in /api/assets) put in the Drive
       DELETE /api/drive/:name        taken out */
  if(p[0] === 'drive' && !teacher){
    const H = HTMLLESSONS;
    if(m === 'GET' && !p[1]){
      const ls = Object.fromEntries((await store.listLearn()).map(d => [d.owner, (d.data || {}).html || {}]));
      const x = ls[user.username] || {};
      const kids = (await store.listUsers()).filter(u => u.role === 'student' && !u.disabled && u.username !== user.username && !!user.period && u.period === user.period);
      const shared = [];
      for(const site of Object.values(H.SITES).filter(s => s.share)) for(const u of kids) if(((ls[u.username] || {})[site.key + 'Share'] || []).includes(user.username))
        shared.push({ owner:u.username, name:u.name, key:site.key, file:site.file, path:site.path + '?o=' + encodeURIComponent(u.username),
          title:((ls[u.username] || {})[site.key] || '').match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() || '' });
      return send(res, 200, { files:x.drive || {}, shared,
        pages:Object.values(H.SITES).map(site => ({ key:site.key, file:site.file, path:site.path, item:site.item, len:(x[site.key] || '').length, in:x[site.key + 'In'] || null,
          with:x[site.key + 'Share'] || [] })) });
    }
    const b = m === 'POST' && !p[1] ? await readJSON(req, 2000) : null;
    const name = b ? String(b.name || '').toLowerCase() : decodeURIComponent(p[1] || '').toLowerCase();
    if(b && (!H.FILE_NAME.test(name) || !/^[a-f0-9]{64}$/.test(String(b.id || '')) || !(await store.hasAsset(b.id)))) return send(res, 400, { error:'file' });
    if(!b && !(m === 'DELETE' && name && !p[2])) return send(res, 405, { error:'method' });
    const r = await withLearn(user.username, async () => {
      const d = (await store.getLearn(user.username) || {}).data || {}, h = d.html || {}, files = { ...(h.drive || {}) };
      if(b){ if(!files[name] && Object.keys(files).length >= 200) return { full:true }; files[name] = b.id; }
      else delete files[name];
      await store.saveLearn(user.username, { ...d, html:{ ...h, drive:files } });
      return { files };
    });
    if(r.full) return send(res, 413, { error:'full' });
    return send(res, 200, { files:r.files });
  }

  if(p[0] === 'page'){
    const H = HTMLLESSONS, S = H.SITES[p[1] && p[2] ? p[2] : p[1]];
    if(p[2] === 'shared' || p[2] === 'share'){
      const site = H.SITES[p[1]];
      if(!site || !site.share || teacher) return send(res, 404, { error:'none' });
      const kids = (await store.listUsers()).filter(u => u.role === 'student' && !u.disabled && u.username !== user.username && !!user.period && u.period === user.period);
      if(p[2] === 'share' && !p[3] && m === 'POST'){
        const b = await readJSON(req, 8000), ok = new Set(kids.map(u => u.username));
        const to = [...new Set((Array.isArray(b.with) ? b.with : []).map(String))].filter(u => ok.has(u)).slice(0, 10);
        await withLearn(user.username, async () => {
          const d = (await store.getLearn(user.username) || {}).data || {};
          await store.saveLearn(user.username, { ...d, html:{ ...(d.html || {}), [site.key + 'Share']:to } });
        });
        return send(res, 200, { with:to });
      }
      if(p[2] === 'shared' && !p[3] && m === 'GET'){
        const ls = Object.fromEntries((await store.listLearn()).map(d => [d.owner, (d.data || {}).html || {}]));
        const mine = (ls[user.username] || {})[site.key + 'Share'] || [];
        return send(res, 200, { classmates:kids.map(u => ({ username:u.username, name:u.name })).sort((a, b) => a.name.localeCompare(b.name)), with:mine,
          withMe:kids.filter(u => ((ls[u.username] || {})[site.key + 'Share'] || []).includes(user.username))
            .map(u => ({ owner:u.username, name:u.name, title:((ls[u.username] || {})[site.key] || '').match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1]?.trim() || '' })) });
      }
      return send(res, 404, { error:'none' });
    }
    if(!S || !p[1] || (p[3] && p[3] !== 'files' && p[3] !== 'history')) return send(res, 404, { error:'none' });
    const owner = await store.getUser(p[1]);
    if(!owner || owner.role !== 'student') return send(res, 404, { error:'none' });
    const htmlOf = async () => ((await store.getLearn(owner.username) || {}).data || {}).html || {};
    /* the page's history, for a teacher:
         GET /api/page/:owner/:key/history       the page now, who wrote each line, each person's
                                                  totals, and the copies (newest first)
         GET /api/page/:owner/:key/history/:id    one copy's text */
    if(p[3] === 'history'){
      if(!teacher) return send(res, 403, { error:'teacher' });
      if(m !== 'GET' || p[5]) return send(res, 405, { error:'method' });
      if(p[4]){
        const v = await store.getPageVersion(owner.username, S.key, p[4]);
        return v ? send(res, 200, { id:v.id, created:v.created, updated:v.updated, by:v.by, text:v.text }) : send(res, 404, { error:'none' });
      }
      const x = await htmlOf(), text = x[S.key] || '';
      const names = Object.fromEntries((await store.listUsers()).map(u => [u.username, u.name]));
      const ls = x[S.key + 'Lines'], lines = Array.isArray(ls) && ls.length === text.split('\n').length ? ls : text.split('\n').map(() => '');
      const count = {}; for(const u of lines) count[u] = (count[u] || 0) + 1;
      const people = Object.entries(x[S.key + 'By'] || {}).map(([u, v]) => ({ username:u, name:names[u] || u, ...v, lines:count[u] || 0 }))
        .sort((a, b) => b.lines - a.lines || b.added - a.added);
      const versions = (await store.listPageVersions(owner.username, S.key)).map(v => ({ ...v, name:names[v.by] || v.by }));
      return send(res, 200, { owner:{ username:owner.username, name:owner.name }, text, lines, people, versions, total:S.parts.length,
        done:S.info(text, S.who ? x[S.who] : '').has.length, older:count[''] || 0 });
    }
    const x = await htmlOf(), mine = owner.username === user.username;
    const shared = !mine && !teacher && S.share && ((x[S.key + 'Share'] || []).includes(user.username)) && await sameClass(user, owner.username);
    if(!mine && !teacher && !shared) return send(res, 404, { error:'none' });
    const doc = owner.username + '/' + S.key;
    const locked = (await lockedSites(owner)).includes(S.key);
    const out = (h, text, sel) => ({ text, h:MERGE.hash(text), in:h[S.key + 'In'] || null, locked, who:S.who ? h[S.who] || '' : undefined,
      owner:{ username:owner.username, name:owner.name }, with:h[S.key + 'Share'] || [], files:h[S.key + 'Files'] || {}, here:here(doc, teacher ? null : user, sel), canEdit:!teacher });
    if(p[3] === 'files'){
      if(teacher) return send(res, 403, { error:'teacher' });
      if(locked) return send(res, 423, { error:'locked' });
      const name = String(m === 'DELETE' ? decodeURIComponent(p[4] || '') : '').toLowerCase();
      const b = m === 'POST' && !p[4] ? await readJSON(req, 2000) : null;
      if(b && (!H.FILE_NAME.test(String(b.name || '')) || !/^[a-f0-9]{64}$/.test(String(b.id || '')) || !(await store.hasAsset(b.id)))) return send(res, 400, { error:'file' });
      if(!b && !(m === 'DELETE' && name)) return send(res, 405, { error:'method' });
      const r = await withLearn(owner.username, async () => {
        const d = (await store.getLearn(owner.username) || {}).data || {}, h = d.html || {};
        if(h[S.key + 'In']) return { locked:true };
        const files = { ...(h[S.key + 'Files'] || {}) };
        if(b){ if(!files[b.name.toLowerCase()] && Object.keys(files).length >= 40) return { full:true }; files[b.name.toLowerCase()] = b.id; }
        else delete files[name];
        await store.saveLearn(owner.username, { ...d, html:{ ...h, [S.key + 'Files']:files } });
        return { files };
      });
      if(r.locked) return send(res, 423, { error:'turnedIn' });
      if(r.full) return send(res, 413, { error:'full' });
      return send(res, 200, { files:r.files });
    }
    if(m === 'GET'){
      const text = x[S.key] || '';
      // ?c=from,to: my cursor, in my copy (only kept when my copy is the page as it is now)
      const same = !!url.searchParams.get('h') && url.searchParams.get('h') === MERGE.hash(text);
      const sel = same ? selOf(url.searchParams.get('c'), text.length) : undefined;
      if(same) return send(res, 200, { same:true, in:x[S.key + 'In'] || null, locked, with:x[S.key + 'Share'] || [], files:x[S.key + 'Files'] || {}, here:here(doc, teacher ? null : user, sel) });
      return send(res, 200, out(x, text));
    }
    if(m === 'PUT' && !teacher){
      const b = await readJSON(req, 3 * H.SITE_MAX);
      if(locked) return send(res, 423, { error:'locked', ...out(x, x[S.key] || '') });
      if(typeof b.base !== 'string' || typeof b.text !== 'string') return send(res, 400, { error:'text' });
      const r = await withLearn(owner.username, async () => {
        const d = (await store.getLearn(owner.username) || {}).data || {}, h = d.html || {};
        if(h[S.key + 'In']) return { locked:true, h };                    // turned in
        const now = h[S.key] || '';
        const text = MERGE.merge3(b.base, b.text, now).slice(0, H.SITE_MAX);
        if(text !== now){
          const t = HIST.record(h, S.key, now, text, user.username);          // who typed what
          await store.saveLearn(owner.username, { ...d, html:{ ...t.html, [S.key]:text } }); moveCursors(doc, now, text);
          await keepVersion(owner.username, S, text, t, user.username);
        }
        // my cursor (in what I sent), moved to where it is in the page now
        const mySel = selOf(b.sel, b.text.length), hs = mySel ? MERGE.hunks(b.text, text) : null;
        return { h:{ ...h, [S.key]:text }, sel:mySel ? mySel.map(i => Math.min(text.length, MERGE.mapPoint(i, hs))) : undefined };
      });
      if(r.locked) return send(res, 423, { error:'turnedIn', ...out(r.h, r.h[S.key] || '') });
      return send(res, 200, out(r.h, r.h[S.key], r.sel));
    }
    return send(res, 405, { error:'method' });
  }

  if(p[0] === 'game' && p[1] === 'turnin' && !p[2] && m === 'POST' && !teacher){
    await store.setUserLocked(user.username, true);
    return send(res, 200, { ok:true });
  }
  if(p[0] === 'design' && p[1] === 'turnin' && !p[2] && m === 'POST'){
    const d = await store.getDesign(user.username);
    await store.saveDesign(user.username, turnIn(d && d.data, true));
    return send(res, 200, { ok:true });
  }
  if(p[0] === 'design' && !p[1]){
    if(m === 'GET'){ const d = await store.getDesign(user.username); return send(res, 200, d ? { data:d.data, updated:d.updated } : { data:null }); }
    if(m === 'PUT'){
      const b = await readJSON(req, MAX_DESIGN);
      if(!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) return send(res, 400, { error:'data' });
      const old = await store.getDesign(user.username);
      const was = (old && old.data) || {};
      if(was.turnedIn) return send(res, 423, { error:'turnedIn', data:was, updated:old.updated });      // turned in: locked
      // written from a copy that is out of date (the plan is open on another computer): send back the newer one
      if(b.base !== undefined && old && (was.savedAt || 0) !== (b.base || 0)) return send(res, 409, { error:'newer', data:was, updated:old.updated });
      const data = { ...b.data, approved: !!was.approved, approvedBy: was.approvedBy || null, turnedIn:false, turnedInAt:null };    // only a teacher sets these
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
    // one student's My Resume (or ?f=wiki, their Website Presentation page), to read and see
    if(p[1] === 'site' && p[2] && !p[3] && m === 'GET'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      const d = await store.getLearn(u.username), x = (d && d.data && d.data.html) || {};
      const site = HTMLLESSONS.SITES[url.searchParams.get('f')] || HTMLLESSONS.SITES.site;
      return send(res, 200, { name:u.name, html:x[site.key] || '', ...(site.who ? { who:x[site.who] || '' } : {}) });
    }
    // the character a student's Website Presentation is about
    if(p[1] === 'students' && p[2] && p[3] === 'character' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u || u.role !== 'student') return send(res, 404, { error:'none' });
      const b = await readJSON(req, 2000);
      const who = cleanName(b.character).slice(0, 60);
      await withLearn(u.username, async () => {
        const d = (await store.getLearn(u.username) || {}).data || {};
        await store.saveLearn(u.username, { ...d, html:{ ...(d.html || {}), wikiChar:who } });
      });
      return send(res, 200, { ok:true, who });
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
    if(p[1] === 'designs' && p[2] === 'turnin' && !p[3] && m === 'POST'){
      const b = await readJSON(req, 2000);
      const period = String(b.period || '');
      const kids = (await store.listUsers()).filter(u => u.role === 'student' && !u.disabled && (!period || String(u.period) === period));
      for(const u of kids){ const d = await store.getDesign(u.username); if(!!(d && d.data && d.data.turnedIn) !== !!b.on) await store.saveDesign(u.username, turnIn(d && d.data, !!b.on)); }
      return send(res, 200, { ok:true, n:kids.length });
    }
    if(p[1] === 'designs' && p[2] && p[3] === 'turnin' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u) return send(res, 404, { error:'none' });
      const b = await readJSON(req, 2000);
      const d = await store.getDesign(u.username);
      await store.saveDesign(u.username, turnIn(d && d.data, !!b.on));
      return send(res, 200, { ok:true });
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
    if(p[1] === 'students' && p[3] === 'lock' && m === 'POST'){
      const u = await store.getUser(p[2]);
      if(!u || u.role !== 'student') return send(res, 404, { error:'none' });
      const b = await readJSON(req, 2000);
      await store.setUserLocked(u.username, !!b.locked);
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
/* a copy of a typed page in its history (at most one every 2 minutes per person; see store.js) */
async function keepVersion(owner, S, text, t, by){
  try {
    const h = (((await store.getLearn(owner)) || {}).data || {}).html || {};
    await store.savePageVersion(owner, S.key, { by, text, done:S.info(text, S.who ? h[S.who] : '').has.length, added:t.added, removed:t.removed });
  } catch(e){ console.error('page history', e.message); }        // the page itself is saved either way
}

/* a typed page (My Resume, Website Presentation, Game Website) the teacher has locked for a class:
   its students can open and read it, not change it, turn it in or unsubmit it (Classwork setting `locked`) */
async function lockedSites(u){
  if(!u || u.role !== 'student' || !u.period) return [];
  const work = (((await store.getClass(String(u.period))) || {}).data || {}).work || {};
  return Object.values(HTMLLESSONS.SITES).filter(S => (work[S.item] || {}).locked).map(S => S.key);
}

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
  // My Resume: the page the student types (it replaces the old copy), and when it was
  // turned in. Turned in, it cannot change until it is unsubmitted (as in Google Classroom).
  // The same for the Website Presentation's character.html (html.wiki, html.wikiIn); only a teacher sets html.wikiChar.
  for(const k of Object.keys(HTMLLESSONS.SITES)){
    if(add.html && typeof add.html[k + 'In'] === 'boolean') out.html[k + 'In'] = add.html[k + 'In'] ? new Date().toISOString() : null;
    if(add.html && typeof add.html[k] === 'string' && !out.html[k + 'In']) out.html[k] = add.html[k].slice(0, HTMLLESSONS.SITE_MAX);
  }
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
