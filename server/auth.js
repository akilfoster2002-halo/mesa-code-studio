/* Passwords and sessions with nothing but node's own crypto: scrypt for the
   hash, an HMAC-signed cookie for the session (no session table). */
const crypto = require('crypto');

if(!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production')
  console.warn('SESSION_SECRET is not set: everyone is signed out on every restart');
const SECRET = process.env.SESSION_SECRET || localSecret();
/* on a laptop, keep one secret in the data folder so a restart keeps you signed in */
function localSecret(){
  const fs = require('fs'), path = require('path');
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data'), f = path.join(dir, '.session-secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch(e){}
  const s = crypto.randomBytes(32).toString('hex');
  try { fs.mkdirSync(dir, { recursive:true }); fs.writeFileSync(f, s); } catch(e){}
  return s;
}
const HOURS = 12;                                   // a school day; lab computers are shared

const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
function makeHash(pw){
  const salt = crypto.randomBytes(12).toString('hex');
  return { salt, hash: hash(pw, salt) };
}
function verify(pw, salt, expected){
  const got = Buffer.from(hash(pw, salt), 'hex');
  const want = Buffer.from(String(expected), 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function sign(payload){
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function read(token){
  if(!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const want = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if(mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp && Date.now() > p.exp ? null : p;
  } catch(e){ return null; }
}
const secure = () => process.env.NODE_ENV === 'production' ? '; Secure' : '';
function setCookie(res, payload){
  const token = sign({ ...payload, exp: Date.now() + HOURS*3600*1000 });
  res.setHeader('Set-Cookie', `cs=${token}; HttpOnly; Path=/; Max-Age=${HOURS*3600}; SameSite=Lax` + secure());
}
function clearCookie(res){ res.setHeader('Set-Cookie', 'cs=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax' + secure()); }
function fromReq(req){
  const m = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('cs='));
  return m ? read(m.slice(3)) : null;
}
module.exports = { makeHash, verify, setCookie, clearCookie, fromReq };
