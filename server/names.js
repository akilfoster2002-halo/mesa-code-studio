/* Usernames and starter passwords, the same rules as tools/make-logins.js:
   first name + first letter(s) of the last name ("emilyc"), and an easy
   word + two digits ("tiger47") for students. */
const crypto = require('crypto');
const WORDS = ['apple','bear','bird','boat','cake','cat','cloud','corn','crab','dog','duck','fish','frog',
  'goat','grape','horse','kite','lemon','lion','mango','moon','mouse','owl','panda','pizza','plant','rain',
  'robot','rocket','shark','sun','star','taco','tiger','train','tree','turtle','whale','zebra','comet','koala',
  'lime','melon','pearl','river','snow','storm','wolf','sky'];
const pick = () => WORDS[crypto.randomInt(WORDS.length)];
const studentPassword = () => pick() + String(10 + crypto.randomInt(90));
const teacherPassword = () => [pick(), pick(), pick()].join('-') + crypto.randomInt(10, 100);
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/* "Emily Campos" -> "emilyc"; `taken(u)` says whether a username is in use */
async function username(fullName, period, taken){
  const parts = String(fullName).trim().split(/\s+/);
  const f = fold(parts[0]) || 'student', l = fold(parts.slice(1).join(''));
  if(!l){ const u = f + (period || ''); if(!(await taken(u))) return u; }
  for(let n = 1; n <= l.length; n++){ const u = f + l.slice(0, n); if(!(await taken(u))) return u; }
  for(let n = 2; ; n++){ const u = f + l + n; if(!(await taken(u))) return u; }
}
module.exports = { username, studentPassword, teacherPassword };
