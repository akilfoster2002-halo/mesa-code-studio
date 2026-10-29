/* =====================================================================
   STORE — where accounts, projects, their history and uploaded files live.

   Two back ends behind one interface:
     • Postgres, when DATABASE_URL is set (the hosted site).
     • Plain JSON files in DATA_DIR (a laptop, and the tests).

   A project is one row holding its current JSON. Every save also may add
   a VERSION (a full copy) so a student can go back; versions are thinned
   so a project never holds more than MAX_VERSIONS of them.

   Uploaded costumes and sounds are ASSETS, stored once by the SHA-256 of
   their bytes and referenced from the project JSON by that id. A project
   saved fifty times shares one copy of its pictures.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_VERSIONS = 60;
const VERSION_GAP_MS = 2 * 60 * 1000;      // at most one automatic version every 2 minutes

const now = () => new Date().toISOString();
const newId = () => crypto.randomBytes(9).toString('base64url');

/* ------------------------------------------------------------ JSON files */
class FileStore {
  constructor(dir){
    this.dir = dir;
    fs.mkdirSync(path.join(dir, 'assets'), { recursive:true });
    this.file = path.join(dir, 'db.json');
    this.db = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8'))
                                       : { users:{}, projects:{}, versions:{} };
    this._t = null;
  }
  async init(){
    for(const p of Object.values(this.db.projects)) if(!p.stats) p.stats = projectStats(p.data);
  }
  _save(){
    clearTimeout(this._t);
    this._t = setTimeout(()=>this.flush(), 50);
  }
  flush(){
    clearTimeout(this._t);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
  }

  async getUser(username){ return this.db.users[username] || null; }
  async listUsers(){ return Object.values(this.db.users); }
  async upsertUser(u){
    const old = this.db.users[u.username] || {};
    this.db.users[u.username] = { created: now(), ...old, ...u };
    this._save();
  }

  async setLogin(username){ const u = this.db.users[username]; if(u){ u.last_login = now(); this._save(); } }
  async setTutorial(username, v){ const u = this.db.users[username]; if(u){ u.tutorial = v; this._save(); } }
  async setTip(username, v){ const u = this.db.users[username]; if(u){ u.helper_tip = v || null; this._save(); } }
  async setDisabled(username, v){ const u = this.db.users[username]; if(u){ u.disabled = !!v; this._save(); } }
  async setLocked(period, v){ for(const u of Object.values(this.db.users)) if(u.role === 'student' && u.period === period) u.locked = !!v; this._save(); }
  async setUserLocked(username, v){ const u = this.db.users[username]; if(u){ u.locked = !!v; this._save(); } }
  async lastVersionLabel(id){ const vs = this.db.versions[id] || []; return vs.length ? vs[vs.length-1].label : null; }
  /* one row per account: how far each student has got */
  async overview(){
    const week = Date.now() - 7*86400000;
    return Object.values(this.db.users).map(u => {
      const ps = Object.values(this.db.projects).filter(p => p.owner === u.username && !p.deleted);
      const vs = ps.flatMap(p => this.db.versions[p.id] || []);
      return row(u, ps, vs.filter(v => Date.parse(v.updated || v.created) > week).length);
    });
  }

  async listProjects(owner){
    return Object.values(this.db.projects)
      .filter(p => p.owner === owner && !p.deleted)
      .map(({ data, ...meta }) => meta)
      .sort((a, b) => b.updated.localeCompare(a.updated));
  }
  async getProject(id){ return this.db.projects[id] || null; }
  async createProject(owner, name, data, thumb){
    const p = { id:newId(), owner, name, data, thumb:thumb||null, stats:projectStats(data), created:now(), updated:now(), deleted:null };
    this.db.projects[p.id] = p;
    this.db.versions[p.id] = [];
    await this._version(p, 'created');
    this._save();
    return p;
  }
  async saveProject(id, fields, opts={}){
    const p = this.db.projects[id]; if(!p) return null;
    if(fields.name != null) p.name = fields.name;
    if(fields.data != null) p.data = fields.data;
    if(fields.thumb !== undefined) p.thumb = fields.thumb;
    if(fields.stats !== undefined) p.stats = fields.stats;
    if(fields.editedBy !== undefined) p.edited_by = fields.editedBy;
    p.updated = now();
    if(fields.data != null) await this._maybeVersion(p, opts);
    this._save();
    return p;
  }
  async deleteProject(id){
    const p = this.db.projects[id]; if(!p) return;
    p.deleted = now(); this._save();
  }
  async restoreDeleted(id){
    const p = this.db.projects[id]; if(!p) return;
    p.deleted = null; this._save();
  }
  async listDeleted(owner){
    return Object.values(this.db.projects).filter(p=>p.owner===owner && p.deleted)
      .map(({ data, ...meta }) => meta);
  }

  async _maybeVersion(p, opts){
    const vs = this.db.versions[p.id] || (this.db.versions[p.id] = []);
    const last = vs[vs.length-1];
    const due = !last || opts.force || (Date.now() - Date.parse(last.created)) >= VERSION_GAP_MS;
    if(due) await this._version(p, opts.label || 'auto');
    else { last.data = p.data; last.name = p.name; last.updated = now(); }   // keep the newest copy in the open slot
  }
  async _version(p, label){
    const vs = this.db.versions[p.id] || (this.db.versions[p.id] = []);
    vs.push({ id:newId(), created:now(), updated:now(), label, name:p.name, data:p.data });
    thin(vs);
  }
  async listVersions(id){
    return (this.db.versions[id] || []).map(({ data, ...v }) => ({ ...v, size: JSON.stringify(data).length }))
      .reverse();
  }
  async getVersion(id, vid){ return (this.db.versions[id] || []).find(v => v.id === vid) || null; }
  async addVersion(id, label){
    const p = this.db.projects[id]; if(!p) return;
    await this._version(p, label); this._save();
  }

  async putAsset(id, type, buf){
    const f = path.join(this.dir, 'assets', id);
    if(!fs.existsSync(f)){
      fs.writeFileSync(f, buf);
      fs.writeFileSync(f + '.type', type);
    }
  }
  async getAsset(id){
    const f = path.join(this.dir, 'assets', id);
    if(!fs.existsSync(f)) return null;
    return { type: fs.readFileSync(f + '.type', 'utf8'), data: fs.readFileSync(f) };
  }
  async hasAsset(id){ return fs.existsSync(path.join(this.dir, 'assets', id)); }

  /* game design packets: one per student */
  async getDesign(owner){ return (this.db.designs || {})[owner] || null; }
  async saveDesign(owner, data){
    const ds = this.db.designs || (this.db.designs = {});
    ds[owner] = { owner, data, updated:now() };
    this._save();
    return ds[owner];
  }
  async listDesigns(){ return Object.values(this.db.designs || {}).map(d => ({ owner:d.owner, updated:d.updated, summary:designSummary(d.data) })); }

  /* the Learn games: one progress record per student */
  async getLearn(owner){ return (this.db.learn || {})[owner] || null; }
  async saveLearn(owner, data){
    const ls = this.db.learn || (this.db.learn = {});
    ls[owner] = { owner, data, updated:now() }; this._save(); return ls[owner];
  }
  async listLearn(){ return Object.values(this.db.learn || {}); }

  /* a class (one per period): the teacher's posts on the Stream and the Classwork settings */
  async getClass(period){ return (this.db.classes || {})[period] || null; }
  async saveClass(period, data){
    const cs = this.db.classes || (this.db.classes = {});
    cs[period] = { period, data, updated:now() }; this._save(); return cs[period];
  }

  /* a student's work on a teacher's assignment (files they attached, turned in or not) */
  async getSubmission(assignment, owner){ return (this.db.subs || {})[assignment + '|' + owner] || null; }
  async saveSubmission(assignment, owner, data){
    const ss = this.db.subs || (this.db.subs = {});
    ss[assignment + '|' + owner] = { assignment, owner, data, updated:now() }; this._save(); return ss[assignment + '|' + owner];
  }
  async listSubmissions(assignments){
    const want = new Set(assignments);
    return Object.values(this.db.subs || {}).filter(x => want.has(x.assignment));
  }

  /* Class Games feedback: one slip per reviewer per game */
  async getFeedback(project, reviewer){ return (this.db.feedback || {})[project + '|' + reviewer] || null; }
  async saveFeedback(project, reviewer, owner, data){
    const fb = this.db.feedback || (this.db.feedback = {});
    fb[project + '|' + reviewer] = { project, reviewer, owner, data, updated:now() }; this._save();
    return fb[project + '|' + reviewer];
  }
  async listFeedback(filter={}){
    return Object.values(this.db.feedback || {}).filter(f => (!filter.owner || f.owner === filter.owner) &&
      (!filter.reviewer || f.reviewer === filter.reviewer) && (!filter.project || f.project === filter.project))
      .sort((a, b) => b.updated.localeCompare(a.updated));
  }
  async classGames(period){
    const users = Object.values(this.db.users).filter(u => u.role === 'student' && u.period === period && !u.disabled);
    return users.map(u => ({ username:u.username, name:u.name, projects:Object.values(this.db.projects)
      .filter(p => p.owner === u.username && !p.deleted).map(({ data, ...meta }) => meta) }));
  }
}

/* what a project has in it, for the teacher's dashboard */
function projectStats(data){
  const out = { blocks:0, scripts:0, sprites:0, costumes:0, sounds:0 };
  const ts = data && Array.isArray(data.targets) ? data.targets : [];
  const walk = b => {
    if(!b || typeof b !== 'object') return;
    out.blocks++;
    for(const k in b.inputs || {}) walk(b.inputs[k]);
    (b.body || []).forEach(walk); (b.body2 || []).forEach(walk);
  };
  for(const t of ts){
    if(!t.isStage) out.sprites++;
    out.costumes += (t.costumes || []).length; out.sounds += (t.sounds || []).length;
    for(const sc of t.scripts || []){ out.scripts++; (sc.blocks || []).forEach(walk); }
  }
  return out;
}
/* how far a design packet has got, for the teacher's list */
function designSummary(d){
  d = d || {};
  return { done: Array.isArray(d.done) ? d.done.length : 0, step: d.step || 0, title: String(d.answers && d.answers.title || '').slice(0, 60),
    approved: !!d.approved, turnedIn: !!d.turnedIn, turnedInAt: d.turnedInAt || null };
}
function row(u, ps, recent){
  const best = ps.reduce((a, p) => Math.max(a, (p.stats && p.stats.blocks) || 0), 0);
  const last = ps.reduce((a, p) => !a || p.updated > a ? p.updated : a, null);
  return { username:u.username, name:u.name, period:u.period, role:u.role, disabled:!!u.disabled, tutorial:u.tutorial || null, tip:u.helper_tip || null,
    last_login: u.last_login ? iso(u.last_login) : null, projects:ps.length, updated: last ? iso(last) : null,
    blocks:best, recent };
}

/* Keep the newest 20 as they are, then thin the older ones so the history
   still reaches back to the first day without growing forever. */
function thin(vs){
  while(vs.length > MAX_VERSIONS){
    // drop the version (outside the newest 20, never the first) closest in time to its neighbour
    let best = -1, gap = Infinity;
    for(let i = 1; i < vs.length - 20; i++){
      const g = Date.parse(vs[i+1].created) - Date.parse(vs[i-1].created);
      if(g < gap){ gap = g; best = i; }
    }
    if(best < 0) best = 1;
    vs.splice(best, 1);
  }
}

/* -------------------------------------------------------------- Postgres */
class PgStore {
  constructor(url){
    const { Pool } = require('pg');
    this.pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized:false },
      max: 5
    });
  }
  q(sql, args){ return this.pool.query(sql, args); }
  async init(){
    await this.q(`
      CREATE TABLE IF NOT EXISTS cs_users (
        username TEXT PRIMARY KEY,
        name     TEXT NOT NULL,
        period   TEXT,
        role     TEXT NOT NULL DEFAULT 'student',
        salt     TEXT NOT NULL,
        hash     TEXT NOT NULL,
        created  TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS cs_projects (
        id      TEXT PRIMARY KEY,
        owner   TEXT NOT NULL REFERENCES cs_users(username),
        name    TEXT NOT NULL,
        data    JSONB NOT NULL,
        thumb   TEXT,
        created TIMESTAMPTZ DEFAULT now(),
        updated TIMESTAMPTZ DEFAULT now(),
        deleted TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS cs_projects_owner ON cs_projects(owner);
      CREATE TABLE IF NOT EXISTS cs_versions (
        id       TEXT PRIMARY KEY,
        project  TEXT NOT NULL REFERENCES cs_projects(id) ON DELETE CASCADE,
        created  TIMESTAMPTZ DEFAULT now(),
        updated  TIMESTAMPTZ DEFAULT now(),
        label    TEXT,
        name     TEXT,
        data     JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS cs_versions_project ON cs_versions(project, created);
      CREATE TABLE IF NOT EXISTS cs_assets (
        id   TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data BYTEA NOT NULL
      );
      ALTER TABLE cs_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
      ALTER TABLE cs_users ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE cs_users ADD COLUMN IF NOT EXISTS tutorial TEXT;
      ALTER TABLE cs_users ADD COLUMN IF NOT EXISTS helper_tip TEXT;
      ALTER TABLE cs_users ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;   -- the teacher stopped edits (a period at a time)   -- a teacher's note, first in the student's Block Helper
      ALTER TABLE cs_projects ADD COLUMN IF NOT EXISTS stats JSONB;
      ALTER TABLE cs_projects ADD COLUMN IF NOT EXISTS edited_by TEXT;
      CREATE TABLE IF NOT EXISTS cs_learn (
        owner   TEXT PRIMARY KEY REFERENCES cs_users(username),
        data    JSONB NOT NULL,
        updated TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS cs_designs (
        owner   TEXT PRIMARY KEY REFERENCES cs_users(username),
        data    JSONB NOT NULL,
        updated TIMESTAMPTZ DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS cs_feedback (
        project  TEXT NOT NULL REFERENCES cs_projects(id),
        reviewer TEXT NOT NULL REFERENCES cs_users(username),
        owner    TEXT NOT NULL REFERENCES cs_users(username),
        data     JSONB NOT NULL,
        updated  TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (project, reviewer)
      );
      CREATE INDEX IF NOT EXISTS cs_feedback_owner ON cs_feedback(owner);
      CREATE TABLE IF NOT EXISTS cs_submissions (
        assignment TEXT NOT NULL,
        owner      TEXT NOT NULL REFERENCES cs_users(username),
        data       JSONB NOT NULL,
        updated    TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (assignment, owner)
      );
      CREATE TABLE IF NOT EXISTS cs_classes (
        period  TEXT PRIMARY KEY,
        data    JSONB NOT NULL,
        updated TIMESTAMPTZ DEFAULT now()
      );`);
    // projects saved before the dashboard counted blocks
    for(const r of (await this.q('SELECT id, data FROM cs_projects WHERE stats IS NULL')).rows)
      await this.q('UPDATE cs_projects SET stats=$2 WHERE id=$1', [r.id, projectStats(r.data)]);
  }
  async getUser(username){
    const r = await this.q('SELECT * FROM cs_users WHERE username=$1', [username]);
    return r.rows[0] || null;
  }
  async listUsers(){ return (await this.q('SELECT * FROM cs_users ORDER BY period, name')).rows; }
  async upsertUser(u){
    await this.q(`INSERT INTO cs_users (username,name,period,role,salt,hash) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (username) DO UPDATE SET name=$2, period=$3, role=$4, salt=$5, hash=$6`,
      [u.username, u.name, u.period||null, u.role||'student', u.salt, u.hash]);
  }
  async setLogin(username){ await this.q('UPDATE cs_users SET last_login=now() WHERE username=$1', [username]); }
  async setTutorial(username, v){ await this.q('UPDATE cs_users SET tutorial=$2 WHERE username=$1', [username, v]); }
  async setTip(username, v){ await this.q('UPDATE cs_users SET helper_tip=$2 WHERE username=$1', [username, v || null]); }
  async setDisabled(username, v){ await this.q('UPDATE cs_users SET disabled=$2 WHERE username=$1', [username, !!v]); }
  async setLocked(period, v){ await this.q(`UPDATE cs_users SET locked=$2 WHERE role='student' AND period=$1`, [period, !!v]); }
  async setUserLocked(username, v){ await this.q('UPDATE cs_users SET locked=$2 WHERE username=$1', [username, !!v]); }
  async lastVersionLabel(id){
    const r = await this.q('SELECT label FROM cs_versions WHERE project=$1 ORDER BY created DESC LIMIT 1', [id]);
    return r.rows[0] ? r.rows[0].label : null;
  }
  async overview(){
    const users = (await this.q('SELECT * FROM cs_users')).rows;
    const ps = (await this.q('SELECT id,owner,updated,stats FROM cs_projects WHERE deleted IS NULL')).rows;
    const rec = (await this.q(`SELECT p.owner, count(*)::int n FROM cs_versions v JOIN cs_projects p ON p.id=v.project
      WHERE v.updated > now() - interval '7 days' AND p.deleted IS NULL GROUP BY p.owner`)).rows;
    const recent = Object.fromEntries(rec.map(r => [r.owner, r.n]));
    return users.map(u => row(u, ps.filter(p => p.owner === u.username).map(p => ({ ...p, updated:iso(p.updated) })), recent[u.username] || 0));
  }
  meta(r){ return r && { id:r.id, owner:r.owner, name:r.name, thumb:r.thumb, stats:r.stats || null, edited_by:r.edited_by || null,
    created:iso(r.created), updated:iso(r.updated), deleted:r.deleted && iso(r.deleted) }; }
  async listProjects(owner){
    const r = await this.q(`SELECT id,owner,name,thumb,stats,edited_by,created,updated,deleted FROM cs_projects
      WHERE owner=$1 AND deleted IS NULL ORDER BY updated DESC`, [owner]);
    return r.rows.map(x => this.meta(x));
  }
  async listDeleted(owner){
    const r = await this.q(`SELECT id,owner,name,thumb,created,updated,deleted FROM cs_projects
      WHERE owner=$1 AND deleted IS NOT NULL ORDER BY deleted DESC`, [owner]);
    return r.rows.map(x => this.meta(x));
  }
  async getProject(id){
    const r = await this.q('SELECT * FROM cs_projects WHERE id=$1', [id]);
    const x = r.rows[0]; if(!x) return null;
    return { ...this.meta(x), data:x.data };
  }
  async createProject(owner, name, data, thumb){
    const id = newId();
    await this.q('INSERT INTO cs_projects (id,owner,name,data,thumb,stats) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, owner, name, data, thumb||null, projectStats(data)]);
    await this.addVersion(id, 'created');
    return this.getProject(id);
  }
  async saveProject(id, fields, opts={}){
    const sets = ['updated=now()'], args = [id];
    if(fields.name != null){ args.push(fields.name); sets.push('name=$'+args.length); }
    if(fields.data != null){ args.push(fields.data); sets.push('data=$'+args.length); }
    if(fields.thumb !== undefined){ args.push(fields.thumb); sets.push('thumb=$'+args.length); }
    if(fields.stats !== undefined){ args.push(fields.stats); sets.push('stats=$'+args.length); }
    if(fields.editedBy !== undefined){ args.push(fields.editedBy); sets.push('edited_by=$'+args.length); }
    await this.q(`UPDATE cs_projects SET ${sets.join(',')} WHERE id=$1`, args);
    if(fields.data != null){
      const last = (await this.q('SELECT id,created FROM cs_versions WHERE project=$1 ORDER BY created DESC LIMIT 1', [id])).rows[0];
      const due = !last || opts.force || (Date.now() - new Date(last.created).getTime()) >= VERSION_GAP_MS;
      if(due) await this.addVersion(id, opts.label || 'auto');
      else await this.q(`UPDATE cs_versions v SET data=p.data, name=p.name, updated=now()
        FROM cs_projects p WHERE v.id=$1 AND p.id=$2`, [last.id, id]);
    }
    return this.getProject(id);
  }
  async addVersion(id, label){
    await this.q(`INSERT INTO cs_versions (id,project,label,name,data)
      SELECT $1, id, $2, name, data FROM cs_projects WHERE id=$3`, [newId(), label, id]);
    const vs = (await this.q('SELECT id,created FROM cs_versions WHERE project=$1 ORDER BY created', [id])).rows
      .map(v => ({ id:v.id, created:iso(v.created) }));
    if(vs.length > MAX_VERSIONS){
      const keep = vs.slice(); thin(keep);
      const keepIds = new Set(keep.map(v => v.id));
      const drop = vs.filter(v => !keepIds.has(v.id)).map(v => v.id);
      if(drop.length) await this.q('DELETE FROM cs_versions WHERE id = ANY($1)', [drop]);
    }
  }
  async deleteProject(id){ await this.q('UPDATE cs_projects SET deleted=now() WHERE id=$1', [id]); }
  async restoreDeleted(id){ await this.q('UPDATE cs_projects SET deleted=NULL WHERE id=$1', [id]); }
  async listVersions(id){
    const r = await this.q(`SELECT id,created,updated,label,name,length(data::text) AS size
      FROM cs_versions WHERE project=$1 ORDER BY created DESC`, [id]);
    return r.rows.map(v => ({ id:v.id, created:iso(v.created), updated:iso(v.updated), label:v.label,
      name:v.name, size:Number(v.size) }));
  }
  async getVersion(id, vid){
    const r = await this.q('SELECT * FROM cs_versions WHERE project=$1 AND id=$2', [id, vid]);
    const v = r.rows[0]; return v ? { ...v, created:iso(v.created) } : null;
  }
  async putAsset(id, type, buf){
    await this.q('INSERT INTO cs_assets (id,type,data) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [id, type, buf]);
  }
  async getAsset(id){
    const r = await this.q('SELECT type,data FROM cs_assets WHERE id=$1', [id]);
    return r.rows[0] || null;
  }
  async hasAsset(id){
    return (await this.q('SELECT 1 FROM cs_assets WHERE id=$1', [id])).rowCount > 0;
  }

  async getDesign(owner){
    const r = await this.q('SELECT owner,data,updated FROM cs_designs WHERE owner=$1', [owner]);
    const d = r.rows[0]; return d ? { ...d, updated:iso(d.updated) } : null;
  }
  async saveDesign(owner, data){
    const r = await this.q(`INSERT INTO cs_designs (owner,data,updated) VALUES ($1,$2,now())
      ON CONFLICT (owner) DO UPDATE SET data=$2, updated=now() RETURNING owner,data,updated`, [owner, data]);
    const d = r.rows[0]; return { ...d, updated:iso(d.updated) };
  }
  async listDesigns(){
    const r = await this.q('SELECT owner,data,updated FROM cs_designs');
    return r.rows.map(d => ({ owner:d.owner, updated:iso(d.updated), summary:designSummary(d.data) }));
  }
  async getLearn(owner){
    const r = await this.q('SELECT owner,data,updated FROM cs_learn WHERE owner=$1', [owner]);
    const d = r.rows[0]; return d ? { ...d, updated:iso(d.updated) } : null;
  }
  async saveLearn(owner, data){
    const r = await this.q(`INSERT INTO cs_learn (owner,data,updated) VALUES ($1,$2,now())
      ON CONFLICT (owner) DO UPDATE SET data=$2, updated=now() RETURNING owner,data,updated`, [owner, data]);
    const d = r.rows[0]; return { ...d, updated:iso(d.updated) };
  }
  async listLearn(){
    const r = await this.q('SELECT owner,data,updated FROM cs_learn');
    return r.rows.map(d => ({ ...d, updated:iso(d.updated) }));
  }
  async getSubmission(assignment, owner){
    const r = await this.q('SELECT * FROM cs_submissions WHERE assignment=$1 AND owner=$2', [assignment, owner]);
    const d = r.rows[0]; return d ? { ...d, updated:iso(d.updated) } : null;
  }
  async saveSubmission(assignment, owner, data){
    const r = await this.q(`INSERT INTO cs_submissions (assignment,owner,data,updated) VALUES ($1,$2,$3,now())
      ON CONFLICT (assignment,owner) DO UPDATE SET data=$3, updated=now() RETURNING *`, [assignment, owner, data]);
    const d = r.rows[0]; return { ...d, updated:iso(d.updated) };
  }
  async listSubmissions(assignments){
    if(!assignments.length) return [];
    const r = await this.q('SELECT * FROM cs_submissions WHERE assignment = ANY($1)', [assignments]);
    return r.rows.map(d => ({ ...d, updated:iso(d.updated) }));
  }
  async getClass(period){
    const r = await this.q('SELECT period,data,updated FROM cs_classes WHERE period=$1', [period]);
    const d = r.rows[0]; return d ? { ...d, updated:iso(d.updated) } : null;
  }
  async saveClass(period, data){
    const r = await this.q(`INSERT INTO cs_classes (period,data,updated) VALUES ($1,$2,now())
      ON CONFLICT (period) DO UPDATE SET data=$2, updated=now() RETURNING period,data,updated`, [period, data]);
    const d = r.rows[0]; return { ...d, updated:iso(d.updated) };
  }
  async getFeedback(project, reviewer){
    const r = await this.q('SELECT * FROM cs_feedback WHERE project=$1 AND reviewer=$2', [project, reviewer]);
    const d = r.rows[0]; return d ? { ...d, updated:iso(d.updated) } : null;
  }
  async saveFeedback(project, reviewer, owner, data){
    const r = await this.q(`INSERT INTO cs_feedback (project,reviewer,owner,data,updated) VALUES ($1,$2,$3,$4,now())
      ON CONFLICT (project,reviewer) DO UPDATE SET data=$4, updated=now() RETURNING *`, [project, reviewer, owner, data]);
    const d = r.rows[0]; return { ...d, updated:iso(d.updated) };
  }
  async listFeedback(filter={}){
    const where = [], args = [];
    for(const k of ['owner', 'reviewer', 'project']) if(filter[k]){ args.push(filter[k]); where.push(k + '=$' + args.length); }
    const r = await this.q('SELECT * FROM cs_feedback' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY updated DESC', args);
    return r.rows.map(d => ({ ...d, updated:iso(d.updated) }));
  }
  async classGames(period){
    const us = (await this.q(`SELECT username,name FROM cs_users WHERE role='student' AND period=$1 AND NOT disabled ORDER BY name`, [period])).rows;
    if(!us.length) return [];
    const ps = (await this.q(`SELECT id,owner,name,thumb,stats,edited_by,created,updated,deleted FROM cs_projects
      WHERE owner = ANY($1) AND deleted IS NULL ORDER BY updated DESC`, [us.map(u => u.username)])).rows.map(x => this.meta(x));
    return us.map(u => ({ username:u.username, name:u.name, projects:ps.filter(p => p.owner === u.username) }));
  }
}
const iso = d => d instanceof Date ? d.toISOString() : d;

function open(){
  if(process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  return new FileStore(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
}

module.exports = { open, FileStore, PgStore, thin, projectStats, designSummary, MAX_VERSIONS, VERSION_GAP_MS };
