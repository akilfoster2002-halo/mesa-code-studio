/* =====================================================================
   GAME FEEDBACK — the questions, in one place.

   The paper slip (feedback-form.html) and the form in Code Studio
   (Class Games → a game → 💬 Give feedback) are both drawn from this
   list, so a student copies the paper slip onto the computer box for box.
   The checks follow the Game Project Rubric (levels 1–4).
   ===================================================================== */
(function(root){
  const FEEDBACK = {
    // play it, then write what you saw (the rubric, level by level)
    checks: [
      { id:'moves',   icon:'🕹', level:1, en:'How does the player move? Which keys or mouse?',         es:'¿Cómo se mueve el jugador? ¿Con qué teclas o ratón?' },
      { id:'enemy',   icon:'👾', level:2, en:'What does the enemy or obstacle do?',                    es:'¿Qué hace el enemigo u obstáculo?' },
      { id:'lose',    icon:'💀', level:3, en:'How do you lose? What happens then?',                    es:'¿Cómo pierdes? ¿Qué pasa entonces?' },
      { id:'win',     icon:'🏆', level:3, en:'How do you win?',                                        es:'¿Cómo ganas?' },
      { id:'score',   icon:'🔢', level:4, en:'What does the score, lives or timer count?',             es:'¿Qué cuentan los puntos, vidas o tiempo?' },
      { id:'more',    icon:'📈', level:4, en:'What makes it harder, or what start screen or next level does it have?', es:'¿Qué lo hace más difícil, o qué pantalla de inicio u otro nivel tiene?' }
    ],
    CHECK_TEXT: 160,
    ratings: [],   // no stars on the slip
    // the rubric level the reviewer thinks the game is at
    levels: [
      { n:0, en:'Not yet',          es:'Todavía no' },
      { n:1, en:'Player moves',     es:'El jugador se mueve' },
      { n:2, en:'Opponents',        es:'Oponentes' },
      { n:3, en:'Win & lose',       es:'Ganar y perder' },
      { n:4, en:'Level one done',   es:'Nivel uno terminado' }
    ],
    // written comments
    texts: [
      { id:'liked', icon:'⭐', en:'I liked',             es:'Me gustó',             required:true },
      { id:'next',  icon:'🌱', en:'Next you could',      es:'Después podrías',      required:true },
      { id:'bug',   icon:'🐞', en:'A bug I found (if any)', es:'Un error que encontré (si hay)', required:false }
    ],
    MAX_TEXT: 300,

    /* the level the checks add up to: each level needs all of the ones below */
    suggestLevel(checks){
      const ok = id => checks && typeof checks[id] === 'string' && checks[id].trim().length > 0;
      if(!ok('moves')) return 0;
      if(!ok('enemy')) return 1;
      if(!(ok('lose') && ok('win'))) return 2;
      if(!(ok('score') && ok('more'))) return 3;
      return 4;
    },

    /* keep only what the form can hold (the server runs this too) */
    clean(d){
      d = d && typeof d === 'object' ? d : {};
      const out = { checks:{}, ratings:{}, texts:{} };
      for(const c of FEEDBACK.checks){ const v = d.checks && d.checks[c.id]; if(typeof v === 'string' && v.trim()) out.checks[c.id] = v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, FEEDBACK.CHECK_TEXT); }
      for(const r of FEEDBACK.ratings){ const v = Number(d.ratings && d.ratings[r.id]); if(v >= 1 && v <= 4 && Math.round(v) === v) out.ratings[r.id] = v; }
      const lv = Number(d.level);
      if(d.level !== undefined && d.level !== null && d.level !== '' && lv >= 0 && lv <= 4 && Math.round(lv) === lv) out.level = lv;
      for(const x of FEEDBACK.texts){ const v = d.texts && d.texts[x.id]; if(typeof v === 'string' && v.trim()) out.texts[x.id] = v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, FEEDBACK.MAX_TEXT); }
      return out;
    },
    /* everything a finished slip has: every check, both stars, a level, and the two required comments */
    complete(d){
      return FEEDBACK.checks.every(c => d.checks && d.checks[c.id]) &&
        FEEDBACK.ratings.every(r => d.ratings && d.ratings[r.id]) && d.level !== undefined &&
        FEEDBACK.texts.filter(x => x.required).every(x => d.texts && d.texts[x.id]);
    }
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = FEEDBACK;
  else root.FEEDBACK = FEEDBACK;
})(typeof window !== 'undefined' ? window : this);
