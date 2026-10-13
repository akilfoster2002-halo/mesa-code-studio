#!/usr/bin/env node
/* =====================================================================
   LOGIN PAGES — one printable file per class, three big login cards to a
   letter-size page, cut along the dashed lines.

   reads   private/logins.json
   writes  private/login-pages/period-<n>.html   (and .pdf, if Chrome is
           installed: tools/login-pages.js --pdf)
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'private', 'login-pages');
const SITE = process.env.SITE_URL || 'mesa-code-studio.onrender.com';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const logins = JSON.parse(fs.readFileSync(path.join(ROOT, 'private', 'logins.json'), 'utf8'));
const students = logins.filter(k => k.role === 'student');
const periods = [...new Set(students.map(k => k.period))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric:true }));

function card(k){
  return `<div class="card">
  <div class="top"><span class="logo">◆ Code Studio</span><span class="per">Period ${esc(k.period)}</span></div>
  <div class="name">${esc(k.name)}</div>
  <div class="grid">
    <div class="lab">1. Go to · Ve a</div><div class="val site">${esc(SITE)}</div>
    <div class="lab">2. Username · Usuario</div><div class="val">${esc(k.username)}</div>
    <div class="lab">3. Password · Contraseña</div><div class="val">${esc(k.password)}</div>
  </div>
  <div class="foot">Keep this card secret. · Guarda esta tarjeta en secreto. &nbsp;—&nbsp; Log out when you finish. · Cierra sesión al terminar.</div>
</div>`;
}
function page(p){
  const list = students.filter(k => k.period === p).sort((a, b) => a.name.localeCompare(b.name));
  const pages = [];
  for(let i = 0; i < list.length; i += 3) pages.push(list.slice(i, i + 3));
  return `<!doctype html><html><head><meta charset="utf-8"><title>Code Studio logins — Period ${esc(p)}</title>
<style>
@page{size:letter;margin:0.4in}
*{box-sizing:border-box}
body{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1d1b3d}
.sheet{height:10.1in;display:flex;flex-direction:column;break-after:page}
.sheet:last-child{break-after:auto}
.card{flex:1 1 0;min-height:0;border:2px dashed #9a97c4;border-radius:18px;padding:0.28in 0.38in;margin-bottom:0.08in;display:flex;flex-direction:column;justify-content:space-between}
.card:last-child{margin-bottom:0}
.top{display:flex;justify-content:space-between;align-items:center;font-size:13pt;color:#5b5bd6;font-weight:700}
.per{background:#eef0ff;border-radius:10px;padding:3px 12px}
.name{font-size:26pt;font-weight:800;margin:4px 0 6px}
.grid{display:grid;grid-template-columns:2.4in 1fr;row-gap:6px;align-items:baseline}
.lab{font-size:12pt;color:#55537a}
.val{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:24pt;font-weight:700;letter-spacing:.5px}
.val.site{font-size:15pt}
.foot{font-size:9pt;color:#77759a;border-top:1px solid #e1e0f0;padding-top:6px}
</style></head><body>
${pages.map(pg => `<div class="sheet">${pg.map(card).join('')}</div>`).join('\n')}
</body></html>`;
}

fs.mkdirSync(OUT, { recursive:true });
for(const p of periods){
  const html = path.join(OUT, `period-${p}.html`);
  fs.writeFileSync(html, page(p));
  if(process.argv.includes('--pdf') && fs.existsSync(CHROME)){
    execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + path.join(OUT, `period-${p}.pdf`), 'file://' + html], { stdio:'ignore' });
  }
  console.log(`period ${p}: ${students.filter(k => k.period === p).length} students`);
}
