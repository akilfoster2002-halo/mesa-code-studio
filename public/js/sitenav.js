/* SITENAV — the way back to the Classroom (/) and the four tools, as tabs
   in every tool's top bar: Blocks (the editor), Learn, Design and HTML.
   `on` is the part shown. */
window.SITENAV = (function(){
  const PARTS = [
    { id:'classroom', icon:'🏫', href:'/', en:'Classroom', es:'Clase' },
    { id:'blocks', icon:'◆', href:'/studio#/', en:'Blocks', es:'Bloques' },
    { id:'learn', icon:'🎮', href:'/learn', en:'Learn', es:'Aprende' },
    { id:'design', icon:'🎨', href:'/design', en:'Design', es:'Diseño' },
    { id:'html', icon:'</>', href:'/html', en:'HTML', es:'HTML' }
  ];
  function bar(on){
    const { h } = UI;
    return h('nav', { class:'sitenav', 'aria-label':'Code Studio' },
      ...PARTS.map(p => h('a', { class:'sitenav-a' + (p.id === on ? ' on' : ''), href:p.href, title:p.en, 'aria-current':p.id === on ? 'page' : null },
        h('span', { class:'sitenav-i' }, p.icon), h('span', { class:'sitenav-l' }, I18N.lang === 'es' ? p.es : p.en))));
  }
  return { PARTS, bar };
})();
