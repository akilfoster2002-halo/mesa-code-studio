/* =====================================================================
   PICTURES — a picture from the student's computer, for a page's files
   folder (the editor) or their Drive (/drive): made at most 800 px wide or
   tall (a phone photo is megabytes), then kept in the asset store
   (POST /api/assets). A moving GIF or an SVG stays as it is.

   upload(file) → the picture's asset id
   ===================================================================== */
(function(root){
  async function shrink(file){
    if(!/^image\/(png|jpeg|webp|bmp|avif)$/.test(file.type)) return file;
    const img = await createImageBitmap(file).catch(() => null);
    if(!img) return file;
    const k = Math.min(1, 800 / Math.max(img.width, img.height));
    if(k === 1 && file.size < 400000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(b => r(b || file), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
  }
  async function upload(file){
    const blob = await shrink(file);
    const r = await fetch('/api/assets', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':blob.type }, body:blob });
    if(!r.ok) throw new Error('upload');
    return (await r.json()).id;
  }
  root.PICTURES = { shrink, upload };
})(window);
