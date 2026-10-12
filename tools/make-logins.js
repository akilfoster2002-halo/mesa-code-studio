#!/usr/bin/env node
/* =====================================================================
   MAKE LOGINS — the class list in, accounts out.

   reads   private/students.txt          "period | Last, First" per line
   keeps   private/logins.json           every password ever handed out
   writes  private/roster.json           username, name, period, salted hash
           private/logins.csv            for the teacher's spreadsheet
           private/login-cards.html      one card per student, print and cut

   Run it again after adding a student: everybody who already has a
   username and password keeps them. private/ is never committed — the
   only passwords on the server are hashes. `npm run seed` puts new
   students into the database.

   Usernames are first name + first letter of the last name ("emilyc");
   when two students would get the same one, more of the last name is
   used. Passwords are an easy word and two digits ("tiger47").
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const P = f => path.join(ROOT, f);

const WORDS = ['apple','bear','bird','boat','cake','cat','cloud','corn','crab','dog','duck','fish','frog',
  'goat','grape','horse','kite','lemon','lion','mango','moon','mouse','owl','panda','pizza','plant','rain',
  'robot','rocket','shark','sun','star','taco','tiger','train','tree','turtle','whale','zebra','comet','koala',
  'lime','melon','panda','pearl','river','snow','storm','wolf','sky'];
const rnd = n => crypto.randomInt(n);
const easyPassword = () => WORDS[rnd(WORDS.length)] + String(10 + rnd(90));
const teacherPassword = () => [0,1,2].map(() => WORDS[rnd(WORDS.length)]).join('-') + rnd(100);

const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

function parse(){
  const out = [];
  for(const raw of fs.readFileSync(P('private/students.txt'), 'utf8').split('\n')){
    const line = raw.replace(/#.*/, '').trim();
    if(!line) continue;
    const [period, who] = line.split('|').map(s => s.trim());
    let first, last;
    if(who.includes(',')){ [last, first] = who.split(',').map(s => s.trim()); }
    else { first = who; last = ''; }
    out.push({ period, first, last, name: (first + ' ' + last).trim() });
  }
  return out;
}

function main(){
  const kept = fs.existsSync(P('private/logins.json')) ? JSON.parse(fs.readFileSync(P('private/logins.json'), 'utf8')) : [];
  const byKey = new Map(kept.map(k => [k.period + '|' + k.name, k]));
  const taken = new Set(kept.map(k => k.username));
  const people = parse();
  const out = [];

  for(const s of people){
    const key = s.period + '|' + s.name;
    let k = byKey.get(key);
    if(!k){
      const f = fold(s.first.split(/\s+/)[0]), l = fold(s.last);
      let username = null;
      if(!l){ username = f + s.period; }
      for(let n = 1; !username && n <= l.length; n++){
        const u = f + l.slice(0, n);
        if(!taken.has(u)) username = u;
      }
      for(let n = 2; !username || taken.has(username); n++) username = f + l + n;
      k = { period:s.period, name:s.name, username, password:easyPassword(), role:'student' };
      taken.add(username);
    }
    out.push(k);
  }
  // the teacher, kept from the first run
  let teacher = kept.find(k => k.role === 'teacher');
  if(!teacher) teacher = { period:'', name:'Teacher', username:'teacher', password:teacherPassword(), role:'teacher' };
  out.push(teacher);

  fs.writeFileSync(P('private/logins.json'), JSON.stringify(out, null, 1));

  const roster = out.map(k => {
    const salt = crypto.randomBytes(12).toString('hex');
    return { username:k.username, name:k.name, period:k.period, role:k.role, salt,
      hash: crypto.scryptSync(k.password, salt, 32).toString('hex') };
  });
  fs.writeFileSync(P('private/roster.json'), JSON.stringify(roster, null, 1) + '\n');

  const csv = ['Period,Name,Username,Password', ...out.map(k =>
    [k.period, '"' + k.name + '"', k.username, k.password].join(','))].join('\n') + '\n';
  fs.writeFileSync(P('private/logins.csv'), csv);

  fs.writeFileSync(P('private/login-cards.html'), cards(out, process.env.SITE_URL || 'the Code Studio website'));
  const students = out.filter(k => k.role === 'student');
  console.log(`${students.length} students, ${new Set(students.map(k=>k.period)).size} periods, + teacher`);
  console.log('wrote private/roster.json, private/logins.csv, private/login-cards.html');
}

function cards(list, site){
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const periods = [...new Set(list.filter(k=>k.role==='student').map(k => k.period))];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Code Studio logins</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#222}
h1{font-size:20px;margin:0 0 4px} h2{font-size:16px;margin:24px 0 8px;break-before:page}
h2:first-of-type{break-before:auto}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.card{border:2px dashed #999;border-radius:10px;padding:10px 12px;break-inside:avoid}
.card b{display:block;font-size:15px;margin-bottom:6px}
.card div{font-family:ui-monospace,Menlo,monospace;font-size:16px;margin:2px 0}
.card small{color:#666;font-family:system-ui;font-size:11px;display:inline-block;width:86px}
.site{font-size:11px;color:#666;margin-top:6px}
.teacher{border-color:#c80}
@media print{body{margin:10mm}}
</style></head><body>
<h1>Code Studio — student logins</h1>
<div>Keep this page private. Passwords are not case-sensitive.</div>
${periods.map(p => `<h2>Period ${esc(p)}</h2><div class="grid">${list.filter(k => k.period === p && k.role==='student').map(k => `
<div class="card"><b>${esc(k.name)}</b>
<div><small>Username / Usuario</small>${esc(k.username)}</div>
<div><small>Password / Contraseña</small>${esc(k.password)}</div>
<div class="site">${esc(site)}</div></div>`).join('')}</div>`).join('')}
<h2>Teacher</h2><div class="grid">${list.filter(k=>k.role==='teacher').map(k => `
<div class="card teacher"><b>${esc(k.name)}</b><div><small>Username</small>${esc(k.username)}</div>
<div><small>Password</small>${esc(k.password)}</div></div>`).join('')}</div>
</body></html>`;
}

main();
