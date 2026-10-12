/* =====================================================================
   LIBRARY — the pictures and sounds that come with Code Studio.

   Pictures are SVG written out here; sounds are made by the browser
   (WebAudio) the first time they are needed, so the whole library costs
   nothing to download. Their asset ids start with "lib:".
   ===================================================================== */
window.LIBRARY = (function(){
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

  const BIT = (arm) => svg(96, 112, `
    <rect x="44" y="2" width="8" height="14" rx="3" fill="#5b6b8c"/><circle cx="48" cy="6" r="6" fill="#ff5d73"/>
    <rect x="14" y="14" width="68" height="52" rx="16" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3"/>
    <rect x="24" y="24" width="48" height="30" rx="10" fill="#eaf3ff"/>
    <circle cx="38" cy="39" r="6" fill="#1d2b4f"/><circle cx="58" cy="39" r="6" fill="#1d2b4f"/>
    <circle cx="40" cy="37" r="2" fill="#fff"/><circle cx="60" cy="37" r="2" fill="#fff"/>
    <path d="M40 50 q8 6 16 0" stroke="#1d2b4f" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="24" y="66" width="48" height="30" rx="10" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3"/>
    <circle cx="48" cy="81" r="7" fill="#ffd166" stroke="#c99a25" stroke-width="2"/>
    ${arm ? '<rect x="72" y="50" width="10" height="26" rx="5" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3" transform="rotate(-140 77 66)"/>'
          : '<rect x="76" y="68" width="10" height="24" rx="5" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3"/>'}
    <rect x="10" y="68" width="10" height="24" rx="5" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3"/>
    <rect x="30" y="94" width="12" height="16" rx="4" fill="#5b6b8c"/><rect x="54" y="94" width="12" height="16" rx="4" fill="#5b6b8c"/>`);

  const DINO = (step) => svg(100, 92, `
    <path d="M52 8 h34 a8 8 0 0 1 8 8 v16 a6 6 0 0 1 -6 6 h-14 v8 h10 v6 h-16 v12 l-10 10 h-30 l-16 -18 v-12 l8 6 l8 -6 h16 v-20 a16 16 0 0 1 16 -16z" fill="#3fae5a" stroke="#22713a" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="66" cy="18" r="4" fill="#fff"/><circle cx="67" cy="18" r="2" fill="#1d2b4f"/>
    ${step ? '<rect x="28" y="70" width="10" height="20" rx="3" fill="#22713a"/><rect x="48" y="70" width="10" height="12" rx="3" fill="#22713a"/>'
           : '<rect x="28" y="70" width="10" height="12" rx="3" fill="#22713a"/><rect x="48" y="70" width="10" height="20" rx="3" fill="#22713a"/>'}`);

  const star5 = (cx, cy, r, ri) => {
    let d = '';
    for(let i = 0; i < 10; i++){
      const a = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? ri : r;
      d += (i ? 'L' : 'M') + (cx + rr*Math.cos(a)).toFixed(1) + ' ' + (cy + rr*Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  };

  const PICS = {
    'bit-a':   { name:'Bit-a', svg:BIT(false) },
    'bit-b':   { name:'Bit-b', svg:BIT(true) },
    'ball':    { name:'Ball', svg:svg(60,60,`<circle cx="30" cy="30" r="27" fill="#ffab19" stroke="#c77c00" stroke-width="3"/><path d="M8 22 q22 14 44 0 M8 38 q22 -14 44 0" stroke="#c77c00" stroke-width="3" fill="none"/>`) },
    'star':    { name:'Star', svg:svg(80,78,`<path d="${star5(40,42,37,16)}" fill="#ffd60a" stroke="#c9a400" stroke-width="3" stroke-linejoin="round"/>`) },
    'rocket':  { name:'Rocket', svg:svg(64,110,`<path d="M32 4 C50 20 52 50 48 78 H16 C12 50 14 20 32 4Z" fill="#e9eef7" stroke="#5b6b8c" stroke-width="3"/><circle cx="32" cy="40" r="9" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3"/><path d="M16 60 L4 84 L16 80Z M48 60 L60 84 L48 80Z" fill="#ff5d73" stroke="#b33a4b" stroke-width="3" stroke-linejoin="round"/><path d="M22 80 Q32 108 42 80Z" fill="#ffab19"/>`) },
    'heart':   { name:'Heart', svg:svg(70,62,`<path d="M35 58 C-8 30 6 -4 35 14 C64 -4 78 30 35 58Z" fill="#ff5d73" stroke="#b33a4b" stroke-width="3"/>`) },
    'apple':   { name:'Apple', svg:svg(64,70,`<path d="M32 20 C10 6 0 30 8 48 C14 64 26 68 32 62 C38 68 50 64 56 48 C64 30 54 6 32 20Z" fill="#e63946" stroke="#9d1c27" stroke-width="3"/><path d="M32 20 Q32 10 38 4" stroke="#6b4423" stroke-width="4" fill="none"/><path d="M36 12 Q48 2 54 10 Q44 18 36 12Z" fill="#3fae5a"/>`) },
    'dino-a':  { name:'Dino-a', svg:DINO(false) },
    'dino-b':  { name:'Dino-b', svg:DINO(true) },
    'cactus':  { name:'Cactus', svg:svg(50,84,`<path d="M20 82 V12 a5 5 0 0 1 10 0 V82Z M20 46 H10 a4 4 0 0 1 -4 -4 V28 a4 4 0 0 1 8 0 V38 H20 M30 54 H40 a4 4 0 0 0 4 -4 V36 a4 4 0 0 0 -8 0 V46 H30" fill="#3fae5a" stroke="#22713a" stroke-width="3" stroke-linejoin="round"/>`) },
    'rock':    { name:'Asteroid', svg:svg(70,64,`<path d="M14 10 L40 4 L62 16 L66 40 L50 60 L22 58 L4 40Z" fill="#8a8f9c" stroke="#555a66" stroke-width="3" stroke-linejoin="round"/><circle cx="26" cy="24" r="6" fill="#6f7482"/><circle cx="46" cy="40" r="8" fill="#6f7482"/><circle cx="24" cy="44" r="4" fill="#6f7482"/>`) },
    'paddle':  { name:'Paddle', svg:svg(20,100,`<rect x="2" y="2" width="16" height="96" rx="6" fill="#f2f2ff" stroke="#8d8bb8" stroke-width="3"/>`) },
    'fish':    { name:'Fish', svg:svg(96,60,`<path d="M10 30 C30 2 66 2 80 30 C66 58 30 58 10 30Z" fill="#ff9f1c" stroke="#c46f00" stroke-width="3"/><path d="M80 30 L95 14 V46Z" fill="#ff9f1c" stroke="#c46f00" stroke-width="3" stroke-linejoin="round"/><circle cx="28" cy="26" r="4" fill="#1d2b4f"/>`) },
    'ghost':   { name:'Ghost', svg:svg(70,80,`<path d="M6 76 V34 a29 29 0 0 1 58 0 V76 l-10 -8 l-9 8 l-10 -8 l-10 8 l-9 -8Z" fill="#f4f1ff" stroke="#8d8bb8" stroke-width="3" stroke-linejoin="round"/><circle cx="25" cy="34" r="5" fill="#1d2b4f"/><circle cx="45" cy="34" r="5" fill="#1d2b4f"/>`) },
    'coin':    { name:'Coin', svg:svg(56,56,`<circle cx="28" cy="28" r="25" fill="#ffd60a" stroke="#c9a400" stroke-width="3"/><circle cx="28" cy="28" r="16" fill="none" stroke="#c9a400" stroke-width="3"/><text x="28" y="35" font-size="20" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#c9a400">$</text>`) },
    'arrow':   { name:'Arrow', svg:svg(90,50,`<path d="M4 18 H54 V4 L86 25 L54 46 V32 H4Z" fill="#4C97FF" stroke="#2b5fb3" stroke-width="3" stroke-linejoin="round"/>`) },
    'button':  { name:'Button', svg:svg(140,56,`<rect x="3" y="3" width="134" height="50" rx="25" fill="#59C059" stroke="#389438" stroke-width="3"/><text x="70" y="36" font-size="22" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#fff">PLAY</text>`) },
    'cloud':   { name:'Cloud', svg:svg(120,64,`<path d="M24 58 a20 20 0 0 1 0 -40 a26 26 0 0 1 48 -6 a22 22 0 0 1 28 18 a14 14 0 0 1 -2 28Z" fill="#fff" stroke="#b9c7dd" stroke-width="3"/>`) },
    'cat-blob':{ name:'Kitty', svg:svg(90,84,`<path d="M14 30 L10 4 L32 18 Q45 14 58 18 L80 4 L76 30 Q86 50 72 70 Q45 90 18 70 Q4 50 14 30Z" fill="#ffab19" stroke="#c77c00" stroke-width="3" stroke-linejoin="round"/><circle cx="32" cy="42" r="5" fill="#1d2b4f"/><circle cx="58" cy="42" r="5" fill="#1d2b4f"/><path d="M40 54 h10 l-5 6z" fill="#ff5d73"/><path d="M45 60 q-6 6 -12 2 M45 60 q6 6 12 2" stroke="#1d2b4f" stroke-width="2" fill="none"/>`) },

    /* backdrops are 480 × 360, the size of the stage */
    'bd-white':{ name:'White', backdrop:true, svg:svg(480,360,`<rect width="480" height="360" fill="#fff"/>`) },
    'bd-sky':  { name:'Blue Sky', backdrop:true, svg:svg(480,360,`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa9ff"/><stop offset="1" stop-color="#cfe8ff"/></linearGradient></defs><rect width="480" height="360" fill="url(#g)"/><g fill="#fff" opacity=".9"><ellipse cx="90" cy="80" rx="50" ry="18"/><ellipse cx="120" cy="70" rx="30" ry="20"/><ellipse cx="350" cy="120" rx="60" ry="20"/><ellipse cx="380" cy="108" rx="34" ry="22"/></g><rect y="310" width="480" height="50" fill="#5cbf60"/>`) },
    'bd-space':{ name:'Space', backdrop:true, svg:svg(480,360,`<rect width="480" height="360" fill="#0b0a1c"/>` +
       Array.from({ length:70 }, (_, i) => `<circle cx="${(i*137)%480}" cy="${(i*89+i*i*7)%360}" r="${(i%3)*0.6+0.6}" fill="#fff" opacity="${0.4+(i%5)/8}"/>`).join('') +
       `<circle cx="390" cy="80" r="34" fill="#cdb4f6"/><ellipse cx="390" cy="80" rx="54" ry="10" fill="none" stroke="#9966FF" stroke-width="4"/>`) },
    'bd-grass':{ name:'Park', backdrop:true, svg:svg(480,360,`<rect width="480" height="360" fill="#bfe6ff"/><circle cx="410" cy="60" r="30" fill="#ffd60a"/><path d="M0 250 Q120 200 240 240 T480 230 V360 H0Z" fill="#5cbf60"/><path d="M0 290 Q160 260 300 290 T480 280 V360 H0Z" fill="#3fae5a"/>`) },
    'bd-sea':  { name:'Underwater', backdrop:true, svg:svg(480,360,`<defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0c4a6e"/></linearGradient></defs><rect width="480" height="360" fill="url(#w)"/><path d="M0 330 Q120 300 240 330 T480 320 V360 H0Z" fill="#e9d5a1"/><path d="M60 330 q-10 -40 6 -80 M70 330 q14 -30 0 -70 M400 325 q-12 -50 8 -90" stroke="#22c55e" stroke-width="6" fill="none"/>`) },
    'bd-desert':{ name:'Desert', backdrop:true, svg:svg(480,360,`<rect width="480" height="360" fill="#fde2b8"/><circle cx="80" cy="70" r="28" fill="#ffab19"/><rect y="270" width="480" height="90" fill="#e8c27a"/><path d="M0 270 H480" stroke="#b8904a" stroke-width="3"/>`) },
    'bd-grid': { name:'XY Grid', backdrop:true, svg:svg(480,360,`<rect width="480" height="360" fill="#fff"/>` +
       Array.from({ length:23 }, (_, i) => `<path d="M${i*20+20} 0 V360" stroke="#e2e8f0"/>`).join('') +
       Array.from({ length:17 }, (_, i) => `<path d="M0 ${i*20+20} H480" stroke="#e2e8f0"/>`).join('') +
       `<path d="M0 180 H480 M240 0 V360" stroke="#64748b" stroke-width="2"/>` +
       [-200,-100,100,200].map(x => `<text x="${240+x}" y="194" font-size="11" font-family="Arial" text-anchor="middle" fill="#475569">${x}</text>`).join('') +
       [-100,100].map(y => `<text x="246" y="${184-y}" font-size="11" font-family="Arial" fill="#475569">${y}</text>`).join('') +
       `<text x="470" y="172" font-size="13" font-family="Arial" font-weight="bold" fill="#334155" text-anchor="end">x</text><text x="248" y="14" font-size="13" font-family="Arial" font-weight="bold" fill="#334155">y</text>`) },
    'bd-night':{ name:'Night City', backdrop:true, svg:svg(480,360,`<rect width="480" height="360" fill="#1e1b4b"/><circle cx="400" cy="60" r="24" fill="#fef3c7"/>` +
       [[0,200,60],[60,150,50],[110,220,70],[180,120,60],[240,180,50],[290,140,70],[360,210,50],[410,170,70]].map(([x,y,w]) =>
         `<rect x="${x}" y="${y}" width="${w}" height="${360-y}" fill="#312e81"/>` +
         Array.from({ length:Math.floor((360-y)/30) }, (_, r) => `<rect x="${x+10}" y="${y+12+r*30}" width="10" height="12" fill="#fde68a" opacity="${(r*x)%3?0.9:0.2}"/><rect x="${x+w-20}" y="${y+12+r*30}" width="10" height="12" fill="#fde68a" opacity="${(r+x)%2?0.9:0.2}"/>`).join('')).join('')) }
  };

  /* sounds, made from oscillators and noise. Each returns {rate, data:Float32Array} */
  const SR = 22050;
  function synth(seconds, fn){
    const n = Math.floor(seconds * SR), d = new Float32Array(n);
    for(let i = 0; i < n; i++) d[i] = fn(i / SR, i / n);
    return { rate:SR, data:d };
  }
  const sq = x => Math.sign(Math.sin(x));
  let seed = 1; const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const SOUNDS = {
    'pop':   { name:'Pop',    make:() => synth(0.12, (t, p) => Math.sin(2*Math.PI*(600 - 3000*t)*t) * (1-p) * 0.8) },
    'beep':  { name:'Beep',   make:() => synth(0.2, (t, p) => sq(2*Math.PI*880*t) * 0.25 * (p < 0.9 ? 1 : (1-p)*10)) },
    'laser': { name:'Laser',  make:() => synth(0.3, (t, p) => sq(2*Math.PI*(1400 - 3600*t)*t) * 0.3 * (1-p)) },
    'jump':  { name:'Jump',   make:() => synth(0.25, (t, p) => sq(2*Math.PI*(220 + 900*t)*t) * 0.25 * (1-p)) },
    'coin':  { name:'Coin',   make:() => synth(0.35, (t, p) => sq(2*Math.PI*(t < 0.08 ? 988 : 1319)*t) * 0.22 * (1-p)) },
    'boom':  { name:'Boom',   make:() => synth(0.8, (t, p) => (noise()*0.7 + Math.sin(2*Math.PI*60*t)*0.5) * Math.pow(1-p, 2.5)) },
    'win':   { name:'Win',    make:() => synth(0.7, (t, p) => Math.sin(2*Math.PI*[523,659,784,1047][Math.min(3, Math.floor(t/0.15))]*t) * 0.4 * (1 - p*0.6)) },
    'lose':  { name:'Lose',   make:() => synth(0.8, (t, p) => sq(2*Math.PI*[392,370,349,330][Math.min(3, Math.floor(t/0.2))]*t) * 0.2 * (1 - p*0.7)) },
    'click': { name:'Click',  make:() => synth(0.04, (t, p) => noise() * (1-p)) },
    'whoosh':{ name:'Whoosh', make:() => { let lp = 0; return synth(0.5, (t, p) => { lp += (noise() - lp) * (0.05 + 0.3*Math.sin(Math.PI*p)); return lp * Math.sin(Math.PI*p) * 1.4; }); } },
    'drum':  { name:'Drum',   make:() => synth(0.35, (t, p) => Math.sin(2*Math.PI*(120 - 160*t)*t) * Math.pow(1-p, 3)) },
    'meow':  { name:'Meow',   make:() => synth(0.6, (t, p) => { const f = 500 + 300*Math.sin(Math.PI*p); return (Math.sin(2*Math.PI*f*t) + 0.4*Math.sin(4*Math.PI*f*t)) * 0.3 * Math.sin(Math.PI*p); }) }
  };

  const svgURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

  return {
    pics: PICS, sounds: SOUNDS,
    sprites: () => Object.entries(PICS).filter(([, v]) => !v.backdrop),
    backdrops: () => Object.entries(PICS).filter(([, v]) => v.backdrop),
    picURL: id => PICS[id] ? svgURL(PICS[id].svg) : null,
    picSize: id => { const m = PICS[id] && PICS[id].svg.match(/width="(\d+)" height="(\d+)"/); return m ? [+m[1], +m[2]] : [100, 100]; },
    makeSound: id => SOUNDS[id] ? SOUNDS[id].make() : null
  };
})();
