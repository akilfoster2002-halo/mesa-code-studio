/* =====================================================================
   CLASSWORK — what is in the Classroom, by topic, and how far a student
   has got with each piece (worked out from what the tools already save).

   An item is an assignment (it has progress and shows in Grades) or a
   material (a place to go: My Projects, a free coding site…). The
   teacher can hide an item or give it a due date, per period.

   status(item, d) → { state:'none'|'started'|'done', pct, text } where d is
   one student's { learn:{ levels, words, html }, design:{ done, approved, turnedIn },
   projects, blocks, subs }. Runs in the page and in Node.
   ===================================================================== */
(function(root){
  const DESIGN_STEPS = 15;            // the steps in design-steps.js

  /* the one built-in assignment: the Game Design Packet. It is done when the
     student turns it in (that also locks it, until the teacher gives it back).
     The tools (Blocks, Learn, HTML) stay in the top bar; the teacher's own
     assignments are added beside it. */
  const TOPICS = [
    { id:'design', icon:'🎨', title:{ en:'Game design', es:'Diseño de juegos' }, items:[
      { id:'packet', kind:'assignment', turnin:true, icon:'📝', title:{ en:'Game Design Packet', es:'Paquete de diseño de juego' }, href:'/design', teacher:'/design#/teacher',
        student:u => '/design#/teacher/' + encodeURIComponent(u),
        line:{ en:'Plan your game in ' + DESIGN_STEPS + ' steps, then turn it in', es:'Planea tu juego en ' + DESIGN_STEPS + ' pasos y entrégalo' },
        status:d => {
          const n = (d.design && d.design.done) || 0;
          const s = d.design && d.design.turnedIn ? { state:'done', pct:100, text:n + ' / ' + DESIGN_STEPS + ' · 🔒' }
            : { state:n > 0 ? 'started' : 'none', pct:Math.round(100 * Math.min(n, DESIGN_STEPS) / DESIGN_STEPS), text:n + ' / ' + DESIGN_STEPS };
          if(d.design && d.design.approved) s.text += ' · ✓ OK';
          return s;
        } }
    ] }
  ];
  const ITEMS = TOPICS.flatMap(t => t.items.map(it => ({ ...it, topic:t })));

  /* a teacher's own assignment (from /api/room): students attach HTML files
     and turn them in; d.subs[id] = { turnedIn, at, files } */
  const ASSIGNMENTS_TOPIC = { id:'assignments', icon:'📋', title:{ en:'Assignments', es:'Tareas' } };
  const pointsOf = a => a.points == null ? 100 : a.points;
  function custom(a){
    return { id:a.id, kind:'assignment', custom:a, icon:'📄', title:a.title, line:a.text || '', topicId:a.topic || 'assignments',
      status:d => {
        const s = (d.subs || {})[a.id];
        const late = !!(s && a.due && s.at && s.at.slice(0, 10) > a.due), points = pointsOf(a);
        // graded: the grade out of the points (an ungraded assignment, 0 points, just shows ✓)
        if(s && s.grade != null) return { state:'done', graded:true, grade:s.grade, points, late,
          pct:points ? Math.min(100, Math.round(100 * s.grade / points)) : 100, text:points ? s.grade + ' / ' + points : '✓' };
        if(s && s.turnedIn) return { state:'done', pct:100, text:'✓', late };
        return s && s.files ? { state:'started', pct:50, text:s.files + ' 📄' } : { state:'none', pct:0, text:'' };
      } };
  }
  // every topic with its items, the teacher's assignments put in the topic they chose
  function topicsWith(assignments){
    const cs = (assignments || []).map(custom);
    const known = new Set(TOPICS.map(t => t.id));
    const mine = cs.filter(c => !known.has(c.topicId));
    return [...(mine.length ? [{ ...ASSIGNMENTS_TOPIC, items:mine }] : []),
      ...TOPICS.map(t => ({ ...t, items:[...cs.filter(c => c.topicId === t.id), ...t.items] }))];
  }
  const ASSIGNMENTS = ITEMS.filter(it => it.kind === 'assignment');

  /* one student's data, from what the tools save (the same shape the
     teacher's /api/room/:p/grades gives for every student) */
  function studentData(learn, design, projects, subs){
    const ps = Array.isArray(projects) ? projects : [];
    return { subs:subs || {},
      learn:{ levels:(learn && learn.levels) || {}, words:(learn && learn.words) || null, html:(learn && learn.html && learn.html.acts) || {} },
      design:design ? { done:Array.isArray(design.done) ? design.done.length : 0, approved:!!design.approved, turnedIn:!!design.turnedIn } : null,
      projects:ps.length, blocks:ps.reduce((a, p) => Math.max(a, (p.stats && p.stats.blocks) || 0), 0)
    };
  }
  function status(item, d){
    if(!item.status) return null;
    return item.status({ ...d, learn:(d && d.learn) || {} });
  }

  const CLASSWORK = { pointsOf, TOPICS, ITEMS, ASSIGNMENTS, ASSIGNMENTS_TOPIC, custom, topicsWith, studentData, status };
  if(typeof module !== 'undefined' && module.exports) module.exports = CLASSWORK; else root.CLASSWORK = CLASSWORK;
})(typeof window !== 'undefined' ? window : this);
