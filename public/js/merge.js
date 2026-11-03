/* =====================================================================
   MERGE — putting two people's changes to one page together, so a shared
   page can be typed in by classmates at the same time (as in Google Docs).

   hunks(a, b)         what changed from a to b: [{ at, del, ins }] on a
                       (by lines, then each change cut down to the letters)
   merge3(base, mine, theirs)
                       both sets of changes made to base: theirs first, then
                       mine moved to where it now belongs. Two people
                       changing the very same letters: mine wins.
   mapPoint(pos, hs)   where a place in a (a cursor) is after the changes
   hash(s)             a short fingerprint, to ask "has the page changed?"
   Runs in the page and in Node.
   ===================================================================== */
(function(root){
  const lines = s => s.match(/[^\n]*\n|[^\n]+$/g) || [];

  function hunks(a, b){
    if(a === b) return [];
    // the same start and end need no diff
    let p = 0;
    while(p < a.length && p < b.length && a[p] === b[p]) p++;
    let s = 0;
    while(s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
    const A = a.slice(p, a.length - s), B = b.slice(p, b.length - s);
    const la = lines(A), lb = lines(B), n = la.length, m = lb.length;
    if(n * m > 4e6) return [{ at:p, del:A.length, ins:B }];
    // the lines both keep (longest common run), from the end
    const L = Array.from({ length:n + 1 }, () => new Uint16Array(m + 1));
    for(let i = n - 1; i >= 0; i--) for(let j = m - 1; j >= 0; j--)
      L[i][j] = la[i] === lb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = [];
    let i = 0, j = 0, ai = p, cur = null;
    const flush = () => { if(cur){ out.push(trim(cur, a)); cur = null; } };
    while(i < n || j < m){
      if(i < n && j < m && la[i] === lb[j]){ flush(); ai += la[i].length; i++; j++; }
      else if(j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])){ cur = cur || { at:ai, del:0, ins:'' }; cur.ins += lb[j++]; }
      else { cur = cur || { at:ai, del:0, ins:'' }; cur.del += la[i].length; ai += la[i++].length; }
    }
    flush();
    return out.filter(h => h.del || h.ins);
  }
  // a changed run of lines, cut down to the letters that changed
  function trim(h, a){
    const old = a.slice(h.at, h.at + h.del);
    let p = 0;
    while(p < old.length && p < h.ins.length && old[p] === h.ins[p]) p++;
    let s = 0;
    while(s < old.length - p && s < h.ins.length - p && old[old.length - 1 - s] === h.ins[h.ins.length - 1 - s]) s++;
    return { at:h.at + p, del:old.length - p - s, ins:h.ins.slice(p, h.ins.length - s) };
  }

  // a place in the old text, in the new one (something typed right there goes before it)
  function mapPoint(pos, hs){
    let shift = 0;
    for(const h of hs){
      if(h.at > pos) break;
      if(h.at + h.del <= pos){ shift += h.ins.length - h.del; continue; }
      return h.at + shift + h.ins.length;                // inside a part that was replaced
    }
    return pos + shift;
  }
  function apply(text, hs){
    let out = '', i = 0;
    for(const h of hs){ out += text.slice(i, h.at) + h.ins; i = h.at + h.del; }
    return out + text.slice(i);
  }

  function merge3(base, mine, theirs){
    if(mine === base) return theirs;
    if(theirs === base || theirs === mine) return mine;
    const T = hunks(base, theirs), M = hunks(base, mine);
    let out = theirs;
    for(let k = M.length - 1; k >= 0; k--){               // the last first, so the places before it stay right
      const h = M[k], at = mapPoint(h.at, T), end = Math.max(at, h.del ? mapPoint(h.at + h.del, T) : at);
      out = out.slice(0, at) + h.ins + out.slice(end);
    }
    return out;
  }

  function hash(s){
    let x = 2166136261;
    for(let i = 0; i < s.length; i++){ x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0).toString(36) + '-' + s.length.toString(36);
  }

  const MERGE = { hunks, mapPoint, apply, merge3, hash };
  if(typeof module !== 'undefined' && module.exports) module.exports = MERGE; else root.MERGE = MERGE;
})(typeof window !== 'undefined' ? window : this);
