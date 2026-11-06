/* =====================================================================
   PAGE HISTORY — who typed what in a page (My Resume, Website Presentation).

   Every time a page changes, the server knows who sent the change. Here it
   works out what that person added and took away (line by line) and keeps:
     • html[key + 'Lines']: for each line of the page as it is now, who
       last wrote it ('' = from before this was kept, or the starter page);
     • html[key + 'By']: per person, letters added and taken away, saves,
       when they last typed;
   and the store keeps a VERSION (a copy of the page) at most every 2
   minutes per person, so a teacher can see the page at any time.
   ===================================================================== */

// which lines of b were already in a (the longest run they have in common): for each line of b,
// true if it was kept, false if it is new or changed
function kept(a, b){
  let s = 0;                                             // the same lines at the start and the end are kept as they are
  while(s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while(e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const A = a.slice(s, a.length - e), B = b.slice(s, b.length - e);
  const keepB = new Array(B.length).fill(false), keepA = new Array(A.length).fill(false);
  if(A.length && B.length && A.length * B.length <= 4e6){
    // longest common subsequence of the middle lines
    const n = A.length, m = B.length, L = Array.from({ length:n + 1 }, () => new Uint16Array(m + 1));
    for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    for(let i = 0, j = 0; i < n && j < m;){
      if(A[i] === B[j]){ keepA[i] = keepB[j] = true; i++; j++; }
      else if(L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
  }
  return { s, e, A, B, keepA, keepB };
}

const letters = s => s.replace(/\s+/g, '').length;      // what counts: letters typed, not spaces

/* before → after, changed by `by`: the new authors of each line, and what they added / took away */
function track(before, after, lines, by){
  const a = String(before || '').split('\n'), b = String(after || '').split('\n');
  const was = Array.isArray(lines) && lines.length === a.length ? lines : a.map(() => '');
  const { s, e, A, B, keepA, keepB } = kept(a, b);
  const mid = [];
  for(let i = 0, j = 0; j < B.length; j++){
    if(keepB[j]){ while(i < A.length && !keepA[i]) i++; mid.push(was[s + i]); i++; }
    else mid.push(by);
  }
  const out = [...was.slice(0, s), ...mid, ...was.slice(a.length - e)];
  return { lines:out,
    added:B.filter((x, j) => !keepB[j]).reduce((n, x) => n + letters(x), 0),
    removed:A.filter((x, i) => !keepA[i]).reduce((n, x) => n + letters(x), 0) };
}

/* a page record (html) with `key` changed from before to after by `by`: the record with Lines and By
   brought up to date, and what they did (for the version) */
function record(html, key, before, after, by){
  const t = track(before, after, html[key + 'Lines'], by);
  const all = { ...(html[key + 'By'] || {}) }, me = all[by] || { added:0, removed:0, saves:0 };
  all[by] = { added:me.added + t.added, removed:me.removed + t.removed, saves:me.saves + 1, last:new Date().toISOString() };
  return { html:{ ...html, [key + 'Lines']:t.lines, [key + 'By']:all }, added:t.added, removed:t.removed };
}

module.exports = { track, record, kept };
