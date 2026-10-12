/* MUSIC — the Music extension's sounds, made with WebAudio oscillators
   and noise (no sample files). Drums 1–18 and instruments 1–21 follow
   Scratch's menus; each is an approximation in the same spirit. */
window.MUSIC = (function(){
  const ac = () => MEDIA.audio();
  let noiseBuf = null;
  function noise(){
    if(noiseBuf) return noiseBuf;
    const c = ac(), b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf = b;
  }
  function env(g, t, a, peak, decay, end){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, end || decay));
  }
  function tone(type, f0, f1, dur, vol, start){
    const c = ac(), t = start || c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if(f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.003, vol, dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(filter, freq, dur, vol, q){
    const c = ac(), t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(); f.type = filter; f.frequency.value = freq; if(q) f.Q.value = q;
    env(g, t, 0.002, vol, dur); s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
  }
  const DRUMS = [
    v => { hiss('highpass', 1500, 0.18, v*0.7); tone('triangle', 220, 120, 0.1, v*0.5); },      // snare
    v => tone('sine', 150, 40, 0.35, v),                                                         // bass drum
    v => { tone('square', 800, 400, 0.03, v*0.3); hiss('bandpass', 3000, 0.04, v*0.4, 2); },     // side stick
    v => hiss('highpass', 5000, 1.2, v*0.5),                                                     // crash
    v => hiss('highpass', 7000, 0.4, v*0.4),                                                     // open hi-hat
    v => hiss('highpass', 8000, 0.06, v*0.4),                                                    // closed hi-hat
    v => { hiss('bandpass', 9000, 0.25, v*0.4, 3); hiss('highpass', 6000, 0.1, v*0.2); },        // tambourine
    v => { hiss('bandpass', 1200, 0.12, v*0.8, 1.5); },                                          // clap
    v => tone('sine', 2500, 0, 0.06, v*0.6),                                                     // claves
    v => tone('sine', 900, 700, 0.08, v*0.6),                                                    // wood block
    v => { tone('square', 560, 0, 0.2, v*0.25); tone('square', 845, 0, 0.2, v*0.2); },           // cowbell
    v => tone('sine', 4200, 0, 0.9, v*0.3),                                                      // triangle
    v => tone('sine', 420, 300, 0.15, v*0.7),                                                    // bongo
    v => tone('sine', 300, 210, 0.22, v*0.7),                                                    // conga
    v => hiss('highpass', 6000, 0.12, v*0.5),                                                    // cabasa
    v => { for(let i = 0; i < 6; i++) setTimeout(() => hiss('bandpass', 3500, 0.03, v*0.4, 4), i*25); }, // guiro
    v => { for(let i = 0; i < 10; i++) setTimeout(() => tone('square', 1800, 0, 0.03, v*0.15), i*45); }, // vibraslap
    v => tone('sine', 600, 900, 0.3, v*0.5)                                                      // cuica
  ];
  function drum(n, vol){ try { const k = ((n - 1) % 18 + 18) % 18; DRUMS[k](Math.max(0.0002, vol || 1)); } catch(e){} }

  /* [oscillator, attack, decay-or-sustain flag, filter cutoff] per instrument */
  const INST = [
    ['triangle',0.005,'d',4000],['sine',0.005,'d',3000],['square',0.02,'s',2000],['sawtooth',0.005,'d',2500],
    ['sawtooth',0.005,'s',1800],['triangle',0.01,'d',800],['triangle',0.002,'p',3000],['sawtooth',0.08,'s',1500],
    ['sawtooth',0.05,'s',1200],['square',0.04,'s',1800],['sawtooth',0.04,'s',2200],['sine',0.06,'s',5000],
    ['triangle',0.06,'s',2500],['sawtooth',0.06,'s',900],['sine',0.15,'s',2000],['sine',0.003,'d',6000],
    ['sine',0.003,'p',8000],['triangle',0.003,'d',4000],['sine',0.003,'p',2500],['sawtooth',0.01,'s',3500],
    ['sawtooth',0.3,'s',1200]
  ];
  function note(n, secs, inst, vol){
    try {
      const c = ac(), t = c.currentTime, [type, a, mode, cut] = INST[((inst - 1) % 21 + 21) % 21];
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = type; o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
      f.type = 'lowpass'; f.frequency.value = cut;
      const peak = 0.25 * (vol == null ? 1 : vol) + 0.0001;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      const len = mode === 'p' ? Math.min(secs, 0.4) : mode === 'd' ? Math.max(secs, 0.8) : secs;
      if(mode === 's') g.gain.setValueAtTime(peak, t + Math.max(a, len - 0.05));
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.1);
      o.connect(f); f.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + len + 0.15);
    } catch(e){}
  }
  return { drum, note };
})();
