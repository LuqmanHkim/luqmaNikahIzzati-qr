'use strict';
/* Semua butiran majlis disunting di sini. Tiada kunci rahsia diperlukan.
   API_BASE_URL = URL Web App Google Apps Script (lihat SETUP.md).
   Kosong = mod demo; gambar dan ucapan disimpan dalam pelayar ini sahaja. */
const CONFIG = Object.freeze({
  groomShort: 'Luqman Hakim', brideShort: 'Nurul Izzati',
  eyebrow: 'MAJLIS WALIMATULURUS', dateShort: '14 NOVEMBER 2026',
  stamp: "14 11 '26",            // Cop tarikh oren pada gambar, gaya kamera filem
  frameNames: 'Luqman & Izzati', // Nama pada templat gambar
  frameLine: 'WALIMATULURUS · 14.11.2026',
  cover: 'cover.jpg',            // Gambar pengantin; jika tiada, monogram dipaparkan
  timezone: 'Asia/Kuala_Lumpur',
  shareUrl: 'https://luqmanhkim.github.io/luqmaNikahIzzati-qr/', // URL GitHub Pages untuk QR paparan slaid
  API_BASE_URL: 'https://script.google.com/macros/s/AKfycbyRWstRHt4o--uO1H6tA7lRVVGH88i16mluNb_BqkmzQ4NdRVSFMPqbnyxRhOKNcs0/exec',
  filmLimit: 10,                 // Mesti sama dengan FILM_LIMIT dalam apps-script/Code.gs
  uploadConcurrency: 2, pageSize: 40, pollMs: 20000,
  maxImageEdge: 2048, thumbnailEdge: 400, jpegQuality: 0.82
});

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Teruskan tanpa storan. */ } }
};
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const guestId = storage.get('walimah-device') || makeId(); storage.set('walimah-device', guestId);
let guestName = storage.get('walimah-name') || '';

let toastTimer;
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}
function celebrate(symbols = ['❤', '✦', '❤', '✧'], from = null) {
  if (reducedMotion) return;
  const origin = $('#petals'), box = from?.getBoundingClientRect();
  origin.style.left = box ? `${box.left + box.width / 2}px` : '';
  origin.style.top = box ? `${box.top + box.height / 2}px` : '';
  origin.style.bottom = box ? 'auto' : '';
  for (let n = 0; n < 16; n++) {
    const p = document.createElement('i'); p.className = 'petal'; p.textContent = symbols[n % symbols.length];
    p.style.setProperty('--x', `${(Math.random() - .5) * 340}px`);
    p.style.setProperty('--y', `${-120 - Math.random() * 220}px`);
    p.style.setProperty('--r', `${(Math.random() - .5) * 120}deg`);
    p.style.animationDelay = `${Math.random() * .25}s`;
    $('#petals').append(p); setTimeout(() => p.remove(), 2400);
  }
}
const buzz = ms => { try { navigator.vibrate?.(ms); } catch { /* Tidak disokong. */ } };

/* ---------- Kandungan & cover ---------- */
$$('[data-content]').forEach(el => { const value = CONFIG[el.dataset.content]; if (value !== undefined) el.textContent = value; });
document.title = `${CONFIG.groomShort} & ${CONFIG.brideShort} · Jadi photographer kami`;
$('#mock-note').hidden = !!CONFIG.API_BASE_URL;
const coverImg = $('#cover-img');
coverImg.onload = () => document.body.classList.add('has-cover');
coverImg.onerror = () => coverImg.remove();
coverImg.src = CONFIG.cover;
requestAnimationFrame(() => document.body.classList.add('is-ready'));

/* ---------- Animasi hiasan (dimatikan jika pengguna minta kurang gerakan) ---------- */
if (!reducedMotion) {
  // Bokeh: titik cahaya kabur yang naik perlahan di atas cover, macam lampu dewan.
  const cover = $('.cover');
  for (let n = 0; n < 12; n++) {
    const dot = document.createElement('i'); dot.className = 'bokeh';
    const size = 8 + Math.random() * 34;
    dot.style.cssText = `--s:${size}px;--x:${Math.random() * 100}%;--o:${.25 + Math.random() * .5};--t:${9 + Math.random() * 10}s;--delay:${-Math.random() * 18}s;--sway:${(Math.random() - .5) * 60}px`;
    cover.append(dot);
  }
  // Jubin senget 3D mengikut kursor (peranti bertetikus sahaja).
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.tile, .cta').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - .5) * -10}deg`); el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - .5) * 12}deg`); el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`); });
      el.addEventListener('pointerleave', () => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
    });
  }
  // Riak cahaya pada sentuhan.
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.tile, .cta, .ghost, .cam-round, .sheet-close'); if (!el) return;
    const r = el.getBoundingClientRect(), ripple = document.createElement('span'); ripple.className = 'ripple';
    ripple.style.left = `${e.clientX - r.left}px`; ripple.style.top = `${e.clientY - r.top}px`;
    el.append(ripple); setTimeout(() => ripple.remove(), 700);
  });
}

/* ---------- Storan setempat (giliran muat naik & mod demo) ----------
   IndexedDB menyimpan fail asal dalam giliran; muat naik yang terganggu disambung semula. */
const database = new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) return reject(new Error('Storan pelayar tidak tersedia.'));
  const request = indexedDB.open('walimah-album-v1', 1);
  request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('queue', { keyPath: 'id' }); db.createObjectStore('photos', { keyPath: 'id' }); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => toast('Tutup tab album lama dan cuba semula.');
});
database.catch(() => {});
async function dbCall(store, operation, value) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, operation === 'getAll' || operation === 'get' ? 'readonly' : 'readwrite');
    const req = tx.objectStore(store)[operation](value);
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || new Error('Storan tidak mencukupi.'));
  });
}

/* ---------- API ----------
   Google Apps Script: POST tanpa header tersuai (text/plain) supaya tiada preflight CORS.
   Ralat dipulangkan sebagai { error, message } kerana Apps Script tidak boleh menetapkan status HTTP.
   Gambar: { id, url, thumbnailUrl, downloadUrl, guestName, createdAt, width, height }. */
async function requestApi(params, body) {
  const url = new URL(CONFIG.API_BASE_URL);
  if (params) Object.entries(params).forEach(([key, value]) => { if (value !== null && value !== undefined) url.searchParams.set(key, String(value)); });
  const response = await fetch(url, body ? { method: 'POST', body: JSON.stringify(body) } : {});
  if (!response.ok) throw new Error(`Permintaan gagal (${response.status})`);
  const data = await response.json();
  if (data.error) throw Object.assign(new Error(data.message || 'Permintaan gagal.'), { code: data.error });
  return data;
}
const blobToBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
  reader.readAsDataURL(blob);
});
const localWishes = {
  get() { try { return JSON.parse(storage.get('walimah-wishes') || '[]'); } catch { return []; } },
  set(list) { storage.set('walimah-wishes', JSON.stringify(list)); }
};
const api = {
  async uploadPhoto(job, data) {
    const meta = { guestName: job.guestName || 'Tetamu', guestId, width: data.width, height: data.height };
    if (CONFIG.API_BASE_URL) return requestApi(null, { action: 'upload', id: job.id, data: await blobToBase64(data.blob), ...meta });
    await dbCall('photos', 'put', { id: job.id, blob: data.blob, thumbnail: data.thumbnail, createdAt: job.createdAt, confirmed: true, ...meta });
    return { ok: true };
  },
  async filmUsed() {
    if (CONFIG.API_BASE_URL) return (await requestApi({ action: 'film', guestId })).used;
    return (await dbCall('photos', 'getAll')).filter(p => p.confirmed && p.guestId === guestId).length;
  },
  async listPhotos({ cursor = null, limit = CONFIG.pageSize, mine = false } = {}) {
    if (CONFIG.API_BASE_URL) return requestApi({ action: 'photos', limit, mine, guestId, cursor });
    let photos = (await dbCall('photos', 'getAll')).filter(p => p.confirmed && (!mine || p.guestId === guestId));
    photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    if (cursor) { const [stamp, id] = JSON.parse(cursor); photos = photos.filter(p => p.createdAt < stamp || (p.createdAt === stamp && p.id < id)); }
    const items = photos.slice(0, limit), last = items.at(-1);
    return { items, nextCursor: photos.length > limit && last ? JSON.stringify([last.createdAt, last.id]) : null };
  },
  async listWishes() {
    if (CONFIG.API_BASE_URL) return (await requestApi({ action: 'wishes' })).items;
    return localWishes.get();
  },
  async addWish(wish) {
    if (CONFIG.API_BASE_URL) return (await requestApi(null, { action: 'wish', guestId, ...wish })).wish;
    const saved = { id: wish.id, name: wish.name, message: wish.message, createdAt: new Date().toISOString() };
    localWishes.set([saved, ...localWishes.get().filter(w => w.id !== wish.id)]);
    return saved;
  }
};

/* ---------- Mampatan gambar ----------
   createImageBitmap menggunakan orientasi EXIF. Worker digunakan jika tersedia. */
async function compressImage(file, maxEdge, thumbEdge, quality) {
  let source;
  if (typeof createImageBitmap === 'function') { try { source = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* Cuba penyahkod asli pelayar. */ } }
  if (!source) {
    if (typeof Image === 'undefined') throw new Error('Format gambar tidak disokong.');
    const url = URL.createObjectURL(file);
    try { source = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Format gambar tidak disokong. Cuba JPEG atau PNG.')); img.src = url; }); } finally { URL.revokeObjectURL(url); }
  }
  async function render(edge) {
    const ratio = Math.min(1, edge / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * ratio)), height = Math.max(1, Math.round(source.height * ratio));
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Gambar tidak dapat diproses.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.drawImage(source, 0, 0, width, height);
    const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type: 'image/jpeg', quality }) : await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Gambar tidak dapat diproses.')), 'image/jpeg', quality));
    return { blob, width, height };
  }
  try { const full = await render(maxEdge), thumbnail = await render(thumbEdge); return { ...full, thumbnail: thumbnail.blob }; } finally { source.close?.(); }
}
let compressionWorker, workerFailed = false, workId = 0; const workerTasks = new Map();
function compress(file) {
  const fallback = () => compressImage(file, CONFIG.maxImageEdge, CONFIG.thumbnailEdge, CONFIG.jpegQuality);
  if (workerFailed || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') return fallback();
  try {
    if (!compressionWorker) {
      const code = `${compressImage.toString()};self.onmessage=async({data})=>{try{const result=await compressImage(data.file,data.max,data.thumb,data.quality);self.postMessage({id:data.id,result});}catch(e){self.postMessage({id:data.id,error:e.message});}};`;
      const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      compressionWorker = new Worker(url); URL.revokeObjectURL(url);
      compressionWorker.onmessage = ({ data }) => { const task = workerTasks.get(data.id); if (!task) return; clearTimeout(task.timer); workerTasks.delete(data.id); data.error ? task.reject(new Error(data.error)) : task.resolve(data.result); };
      compressionWorker.onerror = () => { workerFailed = true; compressionWorker.terminate(); compressionWorker = null; workerTasks.forEach(t => { clearTimeout(t.timer); t.reject(new Error('Worker gagal.')); }); workerTasks.clear(); };
    }
    return new Promise((resolve, reject) => {
      const id = ++workId;
      const timer = setTimeout(() => { workerTasks.delete(id); reject(new Error('Pemprosesan terlalu lama.')); }, 90000);
      workerTasks.set(id, { resolve, reject, timer });
      compressionWorker.postMessage({ id, file, max: CONFIG.maxImageEdge, thumb: CONFIG.thumbnailEdge, quality: CONFIG.jpegQuality });
    }).catch(fallback);
  } catch { workerFailed = true; return fallback(); }
}

/* ---------- Giliran muat naik ---------- */
let jobs = [], activeUploads = 0, queueHadWork = false, queueTimer, ready = false, filmUsed = 0;
const trayNodes = new Map(), queuePreviewUrls = new Map();
function updateQueue() {
  const tray = $('#upload-tray'); tray.hidden = !jobs.some(j => j.status !== 'done');
  for (const job of jobs) {
    let node = trayNodes.get(job.id);
    if (!node) {
      node = document.createElement('div'); node.className = 'upload-item';
      const img = document.createElement('img'); img.alt = '';
      let url = queuePreviewUrls.get(job.id); if (!url && (job.thumbnail || job.file)) { url = URL.createObjectURL(job.thumbnail || job.file); queuePreviewUrls.set(job.id, url); }
      if (url) img.src = url;
      const label = document.createElement('span');
      const retry = document.createElement('button'); retry.textContent = 'Cuba semula'; retry.hidden = true;
      retry.addEventListener('click', async () => { job.status = 'waiting'; job.attempts = 0; job.nextRetry = 0; try { await dbCall('queue', 'put', job); pump(); } catch { toast('Storan tidak tersedia. Cuba buka semula album.'); } updateQueue(); });
      node.append(img, label, retry); tray.append(node); trayNodes.set(job.id, node);
    }
    node.hidden = job.status === 'done';
    node.style.setProperty('--p', `${job.progress || 0}%`);
    $('span', node).textContent = job.status === 'failed' ? (job.reason === 'film' ? 'Filem habis' : 'Gagal') : !navigator.onLine ? 'Menunggu talian' : job.status === 'uploading' ? 'Memuat naik…' : 'Menunggu';
    $('button', node).hidden = job.status !== 'failed' || job.reason === 'film';
  }
  renderFilm();
  const pending = jobs.filter(j => !['done', 'failed'].includes(j.status));
  const done = jobs.filter(j => j.status === 'done').length;
  $('#upload-pill').hidden = !pending.length;
  $('#upload-pill').textContent = navigator.onLine ? `Mencuci filem ${done}/${jobs.length}…` : 'Tiada talian · Gambar menunggu sambungan';
  if (!pending.length && !activeUploads && queueHadWork) {
    queueHadWork = false;
    const failed = jobs.filter(j => j.status === 'failed' && j.reason !== 'film').length;
    if (failed) toast(`${failed} gambar belum berjaya. Buka Album Saya untuk cuba semula.`);
    else toast('Gambar anda dah masuk album pengantin ❤️');
    void refreshCounts();
  }
}
async function runJob(job) {
  activeUploads++; job.status = 'uploading'; queueHadWork = true; updateQueue();
  try {
    await dbCall('queue', 'put', job);
    const data = job.compressed ? { blob: job.compressed, thumbnail: job.thumbnail, width: job.width, height: job.height } : await compress(job.file);
    Object.assign(job, { compressed: data.blob, thumbnail: data.thumbnail, width: data.width, height: data.height, progress: 40 });
    await dbCall('queue', 'put', job); updateQueue();
    await api.uploadPhoto(job, data);
    await dbCall('queue', 'delete', job.id);
    job.status = 'done'; job.progress = 100; filmUsed++;
    delete job.file; delete job.compressed; delete job.thumbnail;
    if (sheetView === 'mine' || sheetView === 'all') await checkNewPhotos(true);
  } catch (error) {
    if (error.code === 'film_habis') {
      job.status = 'failed'; job.reason = 'film'; filmUsed = CONFIG.filmLimit; delete job.file; delete job.compressed;
      try { await dbCall('queue', 'delete', job.id); } catch { /* Dibersihkan pada lawatan seterusnya. */ }
      toast(`Filem anda sudah habis. Terima kasih kerana berkongsi ${CONFIG.filmLimit} kenangan!`);
      return;
    }
    job.attempts = (job.attempts || 0) + (navigator.onLine ? 1 : 0);
    job.status = job.attempts >= 5 ? 'failed' : 'waiting';
    job.nextRetry = Date.now() + Math.min(30000, 1000 * 2 ** job.attempts);
    try { await dbCall('queue', 'put', job); } catch { job.status = 'failed'; toast('Storan pelayar penuh atau tidak tersedia. Sila cuba semula.'); }
  } finally { activeUploads--; updateQueue(); pump(); }
}
function pump() {
  clearTimeout(queueTimer);
  if (!ready || !navigator.onLine) { updateQueue(); return; }
  while (activeUploads < CONFIG.uploadConcurrency) {
    const job = jobs.find(j => j.status === 'waiting' && (!j.nextRetry || j.nextRetry <= Date.now()));
    if (!job) break; void runJob(job);
  }
  const retries = jobs.filter(j => j.status === 'waiting').map(j => j.nextRetry || Date.now());
  if (retries.length && activeUploads < CONFIG.uploadConcurrency) queueTimer = setTimeout(pump, Math.max(500, Math.min(...retries) - Date.now()));
  updateQueue();
}
window.addEventListener('online', () => { jobs.forEach(j => { if (j.status === 'waiting') j.nextRetry = 0; }); pump(); toast('Sambungan kembali. Muat naik disambung.'); });
window.addEventListener('offline', updateQueue);

/* ---------- Filem ----------
   Pelayan menguatkuasakan had sebenar; kiraan di sini termasuk gambar yang masih dalam giliran. */
const filmLeft = () => Math.max(0, CONFIG.filmLimit - filmUsed - jobs.filter(j => !['done', 'failed'].includes(j.status)).length);
let lastLeft = null;
function renderFilm() {
  const left = filmLeft();
  $$('[data-film-left]').forEach(el => { el.textContent = left; });
  const strip = $('#film-strip');
  if (strip.children.length !== CONFIG.filmLimit) strip.replaceChildren(...Array.from({ length: CONFIG.filmLimit }, (_, n) => { const frame = document.createElement('i'); frame.style.setProperty('--n', n); return frame; }));
  [...strip.children].forEach((frame, i) => {
    const used = i >= left;
    if (used && lastLeft !== null && !frame.classList.contains('used')) { frame.classList.add('burn'); setTimeout(() => frame.classList.remove('burn'), 900); }
    frame.classList.toggle('used', used);
  });
  $('#film-label-text').textContent = left === 0 ? 'FILEM HABIS · TERIMA KASIH!' : left === CONFIG.filmLimit ? 'KEPING FILEM UNTUK ANDA' : left === 1 ? 'KEPING TERAKHIR' : 'KEPING FILEM LAGI';
  $('#cam-left').textContent = left;
  document.body.classList.toggle('film-empty', left === 0);
  if (!cameraEl.hidden) layoutViewfinder();
  if (lastLeft !== null && left !== lastLeft) { const counter = $('.cam-counter'); counter.classList.remove('tick'); void counter.offsetWidth; counter.classList.add('tick'); }
  lastLeft = left;
}
async function syncFilm() { try { filmUsed = await api.filmUsed(); } catch { /* Kekalkan kiraan setempat. */ } renderFilm(); }

async function enqueue(files) {
  let accepted = files.filter(f => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|avif)$/i.test(f.name));
  if (accepted.length !== files.length) toast('Sila pilih fail gambar sahaja.');
  const left = filmLeft();
  if (!left) { toast(`Filem anda sudah habis. Terima kasih kerana berkongsi ${CONFIG.filmLimit} kenangan!`); return 0; }
  if (accepted.length > left) { toast(`Tinggal ${left} keping filem. ${left} gambar pertama sahaja dikongsi.`); accepted = accepted.slice(0, left); }
  let added = 0;
  for (const file of accepted) {
    const job = { id: makeId(), name: file.name, file, guestName, createdAt: new Date().toISOString(), status: 'waiting', attempts: 0, nextRetry: 0, progress: 0 };
    try { await dbCall('queue', 'put', job); jobs.push(job); added++; } catch { toast('Storan tidak mencukupi. Sebahagian gambar belum ditambah.'); break; }
  }
  if (added) { queueHadWork = true; pump(); }
  return added;
}
const picker = $('#photo-input'), nativeCamera = $('#camera-input');
picker.addEventListener('change', async () => { const files = [...picker.files]; picker.value = ''; if (files.length && await enqueue(files)) closeCamera(); });
nativeCamera.addEventListener('change', async () => { const files = [...nativeCamera.files]; nativeCamera.value = ''; if (files.length) await enqueue(files); });

/* ---------- Mula: nama dahulu, kemudian kamera ---------- */
const nameInput = $('#guest-name');
nameInput.value = guestName;
$('#start-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    $('#start-hint').hidden = false;
    nameInput.classList.remove('shake'); void nameInput.offsetWidth; nameInput.classList.add('shake');
    nameInput.focus(); buzz(30); return;
  }
  $('#start-hint').hidden = true;
  guestName = name; storage.set('walimah-name', name);
  if (!$('#wish-name').value) $('#wish-name').value = name;
  if (filmLeft() > 0) celebrate(['❤', '❤', '✦'], $('#cta'));
  setTimeout(() => void openCamera(), reducedMotion ? 0 : 280);
});
nameInput.addEventListener('input', () => { if (nameInput.value.trim()) $('#start-hint').hidden = true; });

/* ---------- Kamera pakai buang ----------
   getUserMedia untuk viewfinder dalam pelayar. Jika tidak disokong atau ditolak,
   tetamu boleh membuka kamera asli telefon melalui input capture. */
const cameraEl = $('#camera'), video = $('#viewfinder');
let stream = null, facing = 'environment', stampOn = storage.get('walimah-stamp') !== 'off', shooting = false;
function setStamp() { $('#cam-stamp').setAttribute('aria-pressed', String(stampOn)); cameraEl.classList.toggle('stamp-on', stampOn); }
setStamp();
$('#cam-stamp').addEventListener('click', () => { stampOn = !stampOn; storage.set('walimah-stamp', stampOn ? 'on' : 'off'); setStamp(); });

function showCameraMessage(text) { $('#cam-msg-text').textContent = text; $('#cam-msg').hidden = false; }
async function startStream() {
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  if (!navigator.mediaDevices?.getUserMedia) { showCameraMessage('Browser ini tidak menyokong kamera terus.'); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
    if (cameraEl.hidden) { stream.getTracks().forEach(t => t.stop()); stream = null; return; }
    video.srcObject = stream; cameraEl.classList.toggle('mirror', facing === 'user');
    await video.play().catch(() => {});
    $('#cam-msg').hidden = true;
  } catch (error) {
    showCameraMessage(error.name === 'NotAllowedError' ? 'Akses kamera ditolak. Benarkan kamera dalam tetapan browser, atau guna kamera telefon.' : 'Kamera tidak dapat dibuka dalam browser ini.');
  }
}
async function openCamera() {
  if (!ready) { toast('Album sedang disediakan. Sila cuba sebentar lagi.'); return; }
  if (filmLeft() === 0) { toast(`Filem anda sudah habis. Terima kasih kerana berkongsi ${CONFIG.filmLimit} kenangan!`); openSheet('mine'); return; }
  cameraEl.hidden = false; document.body.classList.add('camera-open');
  requestAnimationFrame(() => cameraEl.classList.add('open'));
  if (history.state?.camera !== true) history.pushState({ camera: true }, '');
  await startStream();
}
function closeCamera(fromHistory = false) {
  if (cameraEl.hidden) return;
  stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
  cameraEl.classList.remove('open'); document.body.classList.remove('camera-open');
  setTimeout(() => { if (!cameraEl.classList.contains('open')) cameraEl.hidden = true; }, reducedMotion ? 0 : 320);
  $('#cam-msg').hidden = true;
  if (!fromHistory && history.state?.camera) history.back();
}
window.addEventListener('popstate', () => closeCamera(true));
$('#cam-close').addEventListener('click', () => closeCamera());
$('#cam-flip').addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; void startStream(); });
$('#cam-library').addEventListener('click', () => picker.click());
$('#cam-native').addEventListener('click', () => nativeCamera.click());
$$('[data-action="camera"]').forEach(b => b.addEventListener('click', () => { closeSheet(); if (!guestName) { nameInput.focus(); $('#start-hint').hidden = false; return; } void openCamera(); }));

/* ---------- Templat gambar ----------
   Nama pengantin dicetak terus pada gambar. Pratonton CSS di atas viewfinder (#vf-template)
   meniru susun atur yang sama supaya tetamu nampak hasilnya sebelum menekan shutter. */
const TEMPLATES = ['klasik', 'polaroid', 'filem', 'tiada'];
let template = TEMPLATES.includes(storage.get('walimah-template')) ? storage.get('walimah-template') : 'klasik';
const SERIF = 'Fraunces, Georgia, serif', MONO = '"Space Mono", "Courier New", monospace';
function setTemplate(name, announce = false) {
  template = name; storage.set('walimah-template', name); cameraEl.dataset.template = name;
  $$('.tpl-switch button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.template === name)));
  layoutViewfinder();
  if (announce) { const box = $('#vf-box'); box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); buzz(8); }
}
/* Kotak pratonton mengikut nisbah gambar akhir (termasuk bingkai Polaroid/Filem),
   jadi apa yang tetamu nampak sama dengan hasil. Ukuran mengikut formula dalam draw*(). */
function layoutViewfinder() {
  const w = video.videoWidth || 1440, h = video.videoHeight || 1920, base = Math.min(w, h);
  let W = w, H = h, top = 0, side = 0, bottom = 0;
  if (template === 'polaroid') { side = top = base * .055; bottom = base * .26; W = w + side * 2; H = h + top + bottom; }
  else if (template === 'filem') { top = bottom = base * .13; H = h + top * 2; }
  const box = $('#vf-box');
  box.style.setProperty('--ar', `${W} / ${H}`); box.style.setProperty('--arn', String(W / H));
  box.style.setProperty('--pt', `${top / H * 100}%`); box.style.setProperty('--pb', `${bottom / H * 100}%`); box.style.setProperty('--px', `${side / W * 100}%`);
  box.style.setProperty('--u', String(base / W * 100)); // 1 unit asas gambar dalam cqw kotak
  $('#vf-frame-no').textContent = `▸ ${String(Math.min(CONFIG.filmLimit, CONFIG.filmLimit - filmLeft() + 1)).padStart(2, '0')}/${CONFIG.filmLimit}`;
  if (template === 'klasik' && !cameraEl.hidden) { renderKlasikPreview(); void fontsReady().then(renderKlasikPreview); }
}
video.addEventListener('loadedmetadata', layoutViewfinder);
$$('[data-frame-names]').forEach(el => { el.textContent = CONFIG.frameNames; });
$$('[data-frame-line]').forEach(el => { el.textContent = CONFIG.frameLine; });
$$('.tpl-switch button').forEach(b => b.addEventListener('click', () => setTemplate(b.dataset.template, true)));
setTemplate(template);
const fontsReady = () => Promise.race([Promise.all([`italic 400 64px Fraunces`, `600 24px Fraunces`, `400 64px "Pinyon Script"`, `400 24px "Space Mono"`, `700 24px "Space Mono"`].map(f => document.fonts?.load(f))), new Promise(r => setTimeout(r, 800))]).catch(() => {});

// Tulis teks di tengah, kecilkan saiz jika melebihi lebar maksimum.
function fitText(ctx, text, x, y, size, maxWidth, font) {
  let px = size; ctx.font = font(px);
  while (ctx.measureText(text).width > maxWidth && px > 8) { px *= .94; ctx.font = font(px); }
  ctx.fillText(text, x, y);
}
// Templat klasik meletakkan cop di dalam bingkai, jauh dari ukiran sudut.
function drawStamp(ctx, w, h, inFrame) {
  const base = Math.min(w, h), size = Math.round(base * .045);
  ctx.save(); ctx.font = `700 ${size}px ${MONO}`; ctx.textAlign = 'right';
  ctx.textBaseline = inFrame ? 'top' : 'bottom';
  ctx.shadowColor = 'rgba(255,90,20,.85)'; ctx.shadowBlur = size * .45; ctx.fillStyle = '#ff9a3c';
  if (inFrame) ctx.fillText(CONFIG.stamp, w - base * .22, base * .14);
  else ctx.fillText(CONFIG.stamp, w - size * 1.1, h - size * .9);
  ctx.restore();
}
const SCRIPT = '"Pinyon Script", "Snell Roundhand", cursive';
function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  [[0, '#f8e7b0'], [.3, '#c8963e'], [.5, '#fbe9b7'], [.72, '#b9842f'], [1, '#f3d58a']].forEach(([at, c]) => g.addColorStop(at, c));
  return g;
}
// Ukiran bunga berlingkar di satu sudut; (0,0) ialah sudut dalam bingkai, melebar ke arah +x/+y.
function drawFlourish(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(s * .2, s * .2); ctx.bezierCurveTo(s * .58, s * .1, s * .66, s * .44, s * .42, s * .5); ctx.bezierCurveTo(s * .25, s * .54, s * .22, s * .33, s * .35, s * .31);
  ctx.moveTo(s * .2, s * .2); ctx.bezierCurveTo(s * .1, s * .58, s * .44, s * .66, s * .5, s * .42); ctx.bezierCurveTo(s * .54, s * .25, s * .33, s * .22, s * .31, s * .35);
  ctx.moveTo(s * .42, s * .07); ctx.bezierCurveTo(s * .7, s * .02, s * .86, s * .1, s * 1.05, s * .05);
  ctx.moveTo(s * .07, s * .42); ctx.bezierCurveTo(s * .02, s * .7, s * .1, s * .86, s * .05, s * 1.05);
  ctx.moveTo(s * .62, s * .05); ctx.quadraticCurveTo(s * .7, s * .2, s * .82, s * .12);
  ctx.moveTo(s * .05, s * .62); ctx.quadraticCurveTo(s * .2, s * .7, s * .12, s * .82);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(s * .2, s * .2, s * .045, 0, Math.PI * 2); ctx.fill();
  [[s * .82, s * .12], [s * .12, s * .82]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, s * .025, 0, Math.PI * 2); ctx.fill(); });
}
// Plak berlekuk (bucu melengkung ke dalam), gaya kad kahwin lama.
function notchedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w, y, r, Math.PI, Math.PI / 2, true);
  ctx.lineTo(x + w, y + h - r); ctx.arc(x + w, y + h, r, -Math.PI / 2, Math.PI, true);
  ctx.lineTo(x + r, y + h); ctx.arc(x, y + h, r, 0, -Math.PI / 2, true);
  ctx.lineTo(x, y + r); ctx.arc(x, y, r, Math.PI / 2, 0, true);
  ctx.closePath();
}
function drawKlasik(ctx, w, h) {
  const base = Math.min(w, h), m = base * .03, gap = base * .016;
  ctx.save();
  const gold = goldGradient(ctx, 0, 0, w, h);
  ctx.shadowColor = 'rgba(30,15,5,.45)'; ctx.shadowBlur = base * .01;
  // Bingkai berganda
  ctx.strokeStyle = gold; ctx.lineWidth = base * .007; ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  ctx.lineWidth = base * .0028; ctx.strokeRect(m + gap, m + gap, w - (m + gap) * 2, h - (m + gap) * 2);
  // Ukiran empat sudut
  const s = base * .2, inset = m + gap * 1.6;
  ctx.lineWidth = base * .0042; ctx.lineCap = 'round'; ctx.fillStyle = gold;
  [[inset, inset, 1, 1], [w - inset, inset, -1, 1], [inset, h - inset, 1, -1], [w - inset, h - inset, -1, -1]].forEach(([x, y, sx, sy]) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy); drawFlourish(ctx, s); ctx.restore();
  });
  // Hiasan pembahagi di atas tengah
  const ty = m + gap + base * .045, half = base * .16, d = base * .016;
  ctx.lineWidth = base * .003;
  ctx.beginPath(); ctx.moveTo(w / 2 - half, ty); ctx.lineTo(w / 2 - d * 2.2, ty); ctx.moveTo(w / 2 + d * 2.2, ty); ctx.lineTo(w / 2 + half, ty); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2, ty - d); ctx.lineTo(w / 2 + d, ty); ctx.lineTo(w / 2, ty + d); ctx.lineTo(w / 2 - d, ty); ctx.closePath(); ctx.fill();
  [-1, 1].forEach(dir => { ctx.beginPath(); ctx.arc(w / 2 + dir * half, ty, base * .005, 0, Math.PI * 2); ctx.fill(); });
  // Plak nama
  const nameFont = px => `400 ${px}px ${SCRIPT}`, lineFont = px => `600 ${px}px ${SERIF}`;
  const line = `✦  ${CONFIG.frameLine}  ✦`;
  let nameSize = base * .095; ctx.font = nameFont(nameSize);
  // Plak tidak boleh menyentuh ukiran sudut bawah, terutamanya pada gambar potret.
  const pwMax = w - (inset + s * .8) * 2, maxInner = pwMax - base * .12;
  while (ctx.measureText(CONFIG.frameNames).width > maxInner && nameSize > 8) { nameSize *= .94; ctx.font = nameFont(nameSize); }
  const nameWidth = ctx.measureText(CONFIG.frameNames).width;
  ctx.font = lineFont(base * .022); const lineWidth = ctx.measureText(line).width;
  const pw = Math.min(pwMax, Math.max(nameWidth, lineWidth) + base * .16), ph = base * .2;
  const px = (w - pw) / 2, py = h - m - gap - base * .05 - ph, r = base * .028;
  ctx.shadowBlur = base * .025; ctx.shadowColor = 'rgba(20,10,4,.4)';
  notchedRect(ctx, px, py, pw, ph, r); ctx.fillStyle = 'rgba(253,248,238,.94)'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = gold; ctx.lineWidth = base * .004; ctx.stroke();
  const ins = base * .011; notchedRect(ctx, px + ins, py + ins, pw - ins * 2, ph - ins * 2, r * .75); ctx.lineWidth = base * .0018; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#3b2a1e'; ctx.font = nameFont(nameSize); ctx.fillText(CONFIG.frameNames, w / 2, py + ph * .58);
  ctx.fillStyle = '#9a6b2f'; ctx.font = lineFont(base * .022); ctx.fillText(line, w / 2, py + ph * .82);
  ctx.restore();
}
/* Pratonton klasik dilukis dengan fungsi yang sama di atas viewfinder (resolusi dikecilkan). */
function renderKlasikPreview() {
  const canvas = $('#tpl-canvas'); if (!canvas || template !== 'klasik') return;
  const w = video.videoWidth || 1440, h = video.videoHeight || 1920, scale = Math.min(1, 1080 / Math.max(w, h));
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawKlasik(ctx, canvas.width, canvas.height);
}
function drawPolaroid(photo, w, h) {
  const base = Math.min(w, h), m = base * .055, bottom = base * .26;
  const out = Object.assign(document.createElement('canvas'), { width: Math.round(w + m * 2), height: Math.round(h + m + bottom) });
  const ctx = out.getContext('2d');
  const paper = ctx.createLinearGradient(0, 0, out.width, out.height);
  paper.addColorStop(0, '#fdf9f1'); paper.addColorStop(1, '#f1e8d8');
  ctx.fillStyle = paper; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(photo, m, m);
  ctx.strokeStyle = 'rgba(42,29,23,.12)'; ctx.lineWidth = 2; ctx.strokeRect(m, m, w, h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#2a1d17';
  fitText(ctx, CONFIG.frameNames, out.width / 2, h + m + bottom * .52, base * .09, w * .86, px => `italic 400 ${px}px ${SERIF}`);
  ctx.fillStyle = '#c0703c';
  fitText(ctx, CONFIG.frameLine, out.width / 2, h + m + bottom * .78, base * .028, w * .86, px => `400 ${px}px ${MONO}`);
  return out;
}
function drawFilem(photo, w, h, frameNo) {
  const base = Math.min(w, h), band = base * .13;
  const out = Object.assign(document.createElement('canvas'), { width: w, height: Math.round(h + band * 2) });
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#0e0b09'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(photo, 0, band);
  // Lubang sprocket di tepi luar kedua-dua jalur.
  const holeW = base * .034, holeH = band * .3, gap = holeW * 1.25, radius = holeW * .22;
  ctx.fillStyle = 'rgba(243,230,208,.88)';
  for (let x = gap / 2; x < w; x += holeW + gap) {
    [band * .1, out.height - band * .1 - holeH].forEach(y => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, holeW, holeH, radius) : ctx.rect(x, y, holeW, holeH); ctx.fill(); });
  }
  ctx.fillStyle = '#ff9a3c'; ctx.textBaseline = 'middle';
  const size = band * .2, yTop = band * .7, yBottom = out.height - band * .7;
  ctx.font = `700 ${size}px ${MONO}`;
  ctx.textAlign = 'left'; ctx.fillText(CONFIG.frameNames.toUpperCase(), base * .04, yBottom);
  ctx.textAlign = 'right'; ctx.fillText(`▸ ${String(frameNo).padStart(2, '0')}/${CONFIG.filmLimit}`, w - base * .04, yBottom);
  ctx.font = `400 ${size * .85}px ${MONO}`; ctx.fillStyle = 'rgba(255,154,60,.75)';
  ctx.textAlign = 'left'; ctx.fillText(CONFIG.frameLine, base * .04, yTop);
  ctx.textAlign = 'right'; ctx.fillText('KENANGAN 400', w - base * .04, yTop);
  return out;
}

/* Gambar diambil terus dari viewfinder: warna hangat, vignette, cop tarikh, kemudian templat. */
async function developFrame() {
  const w = video.videoWidth, h = video.videoHeight, frameNo = CONFIG.filmLimit - filmLeft() + 1;
  const photo = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = photo.getContext('2d');
  if (facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  await fontsReady();
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,170,95,.22)'; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.hypot(w, h) / 2);
  vignette.addColorStop(0, 'rgba(255,255,255,0)'); vignette.addColorStop(1, 'rgba(40,20,10,.38)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  if (stampOn) drawStamp(ctx, w, h, template === 'klasik');
  let canvas = photo;
  if (template === 'klasik') drawKlasik(ctx, w, h);
  else if (template === 'polaroid') canvas = drawPolaroid(photo, w, h);
  else if (template === 'filem') canvas = drawFilem(photo, w, h, frameNo);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
}
$('#shutter').addEventListener('click', async () => {
  if (shooting) return;
  if (filmLeft() === 0) { toast(`Filem anda sudah habis. Terima kasih kerana berkongsi ${CONFIG.filmLimit} kenangan!`); return; }
  if (!video.videoWidth) { toast('Kamera belum sedia. Sebentar…'); return; }
  shooting = true; buzz(18);
  [$('#flash'), $('#iris')].forEach(el => { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); });
  cameraEl.classList.add('snap');
  try {
    const blob = await developFrame();
    if (!blob) throw new Error('Gambar gagal diambil.');
    const preview = document.createElement('img'); const url = URL.createObjectURL(blob); preview.src = url;
    preview.onload = () => setTimeout(() => URL.revokeObjectURL(url), 4000);
    $('#cam-last').replaceChildren(preview); $('#cam-last').classList.remove('drop'); void $('#cam-last').offsetWidth; $('#cam-last').classList.add('drop');
    await enqueue([new File([blob], `kenangan-${Date.now()}.jpg`, { type: 'image/jpeg' })]);
    if (filmLeft() === 0) setTimeout(() => { closeCamera(); celebrate(); toast('Filem terakhir! Terima kasih jadi photographer kami ❤️'); }, 900);
  } catch { toast('Gambar gagal diambil. Cuba lagi.'); }
  finally { setTimeout(() => { shooting = false; cameraEl.classList.remove('snap'); }, 650); }
});

/* ---------- Panel: album & ucapan ---------- */
const sheet = $('#sheet');
let sheetView = null;
const SHEETS = {
  mine: { eyebrow: 'GULUNG FILEM ANDA', title: 'Album saya', pane: 'album', empty: 'Anda belum mengambil gambar. Jom jadi photographer!' },
  all: { eyebrow: 'DARI LENSA TETAMU', title: 'Album tetamu', pane: 'album', empty: 'Belum ada gambar lagi. Jadilah yang pertama!' },
  wishes: { eyebrow: 'SEPATAH KATA, SEJUTA DOA', title: 'Ucapan', pane: 'wishes' }
};
function openSheet(view) {
  const info = SHEETS[view]; sheetView = view;
  $('#sheet-eyebrow').textContent = info.eyebrow; $('#sheet-title').textContent = info.title;
  $$('.pane', sheet).forEach(p => { p.hidden = p.dataset.pane !== info.pane; });
  if (info.pane === 'album') { $('#empty-text').textContent = info.empty; currentTab = view; galleryEpoch++; void loadGallery(true); }
  else void loadWishes();
  if (!sheet.open) { sheet.showModal(); document.body.style.overflow = 'hidden'; }
  sheet.scrollTop = 0;
}
function closeSheet() { if (sheet.open) sheet.close(); }
sheet.addEventListener('close', () => { document.body.style.overflow = ''; sheetView = null; });
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
$('#sheet-close').addEventListener('click', closeSheet);
$$('[data-open]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.open)));

/* ---------- Galeri ----------
   Thumbnail sahaja dimuatkan dalam grid; fail penuh dibaca apabila lightbox dibuka. */
let photos = [], nextCursor = null, currentTab = 'all', loadingGallery = false, galleryEpoch = 0, lightboxIndex = 0, fullImageUrl = null, lightboxToken = 0;
const thumbnailUrls = new Map();
function thumbnailUrl(photo) {
  if (photo.thumbnailUrl) return photo.thumbnailUrl;
  if (!thumbnailUrls.has(photo.id)) thumbnailUrls.set(photo.id, URL.createObjectURL(photo.thumbnail || photo.blob));
  return thumbnailUrls.get(photo.id);
}
const imageObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { const img = e.target; img.src = img.dataset.src; imageObserver.unobserve(img); } }); }, { root: sheet, rootMargin: '400px' }) : null;
function appendPhoto(photo, prepend = false) {
  const button = document.createElement('button'); button.className = 'gallery-item';
  button.style.setProperty('--i', photos.length % 12); button.style.setProperty('--tilt', `${((photo.id.charCodeAt(0) + photo.id.charCodeAt(1)) % 7) - 3}deg`);
  button.setAttribute('aria-label', `Lihat gambar daripada ${photo.guestName || 'Tetamu'}`);
  const frame = document.createElement('span'); frame.className = 'frame';
  const img = document.createElement('img'); img.width = photo.width || 4; img.height = photo.height || 3; img.decoding = 'async'; img.alt = '';
  img.dataset.src = thumbnailUrl(photo); img.onload = () => img.classList.add('loaded');
  frame.append(img);
  const name = document.createElement('span'); name.className = 'by'; name.textContent = photo.guestName || 'Tetamu';
  button.append(frame, name);
  button.addEventListener('click', () => openLightbox(photos.findIndex(p => p.id === photo.id)));
  prepend ? $('#gallery-grid').prepend(button) : $('#gallery-grid').append(button);
  if (imageObserver) imageObserver.observe(img); else img.src = img.dataset.src;
}
async function loadGallery(reset = false) {
  if (loadingGallery) return; if (!reset && !nextCursor) return;
  loadingGallery = true; const epoch = galleryEpoch, tab = currentTab;
  try {
    const result = await api.listPhotos({ cursor: reset ? null : nextCursor, limit: CONFIG.pageSize, mine: tab === 'mine' });
    if (epoch !== galleryEpoch) return;
    if (reset) { imageObserver?.disconnect(); $('#gallery-grid').replaceChildren(); photos = []; thumbnailUrls.forEach(url => URL.revokeObjectURL(url)); thumbnailUrls.clear(); $('#new-photos').hidden = true; }
    result.items.forEach(photo => { if (!photos.some(p => p.id === photo.id)) { appendPhoto(photo); photos.push(photo); } });
    nextCursor = result.nextCursor;
    $('#empty-state').hidden = photos.length > 0;
    $('#load-more').hidden = !nextCursor;
  } catch { toast('Album belum dapat dimuatkan. Semak sambungan dan cuba lagi.'); }
  finally { loadingGallery = false; if (epoch !== galleryEpoch && sheetView) void loadGallery(true); }
}
async function checkNewPhotos(insert = false) {
  if (document.hidden || loadingGallery || !sheetView || SHEETS[sheetView].pane !== 'album') return;
  try {
    const result = await api.listPhotos({ limit: CONFIG.pageSize, mine: currentTab === 'mine' });
    const fresh = result.items.filter(p => !photos.some(old => old.id === p.id));
    if (!fresh.length) return;
    if (insert || !photos.length) { fresh.reverse().forEach(p => { appendPhoto(p, true); photos.unshift(p); }); $('#empty-state').hidden = true; }
    else { $('#new-photos').textContent = `${fresh.length} gambar baru ↑`; $('#new-photos').hidden = false; }
  } catch { /* Tiada gangguan ketika polling luar talian. */ }
}
$('#new-photos').addEventListener('click', () => { void loadGallery(true); sheet.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }); });
$('#load-more').addEventListener('click', () => void loadGallery());
if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (entries[0].isIntersecting && nextCursor && !loadingGallery) void loadGallery(); }, { root: sheet, rootMargin: '300px' }).observe($('#gallery-sentinel'));

async function refreshCounts() {
  try {
    const all = await api.listPhotos({ limit: CONFIG.pageSize });
    $('#all-count').textContent = all.items.length ? `${all.items.length}${all.nextCursor ? '+' : ''} gambar` : '';
  } catch { /* Kiraan pilihan sahaja. */ }
  $('#mine-count').textContent = filmUsed ? `${filmUsed}/${CONFIG.filmLimit}` : '';
}

/* ---------- Lightbox ---------- */
const lightbox = $('#lightbox');
function releaseFullImage() { if (fullImageUrl) { URL.revokeObjectURL(fullImageUrl); fullImageUrl = null; } }
function openLightbox(index) {
  if (!photos.length) return;
  lightboxIndex = (index + photos.length) % photos.length; const photo = photos[lightboxIndex]; lightboxToken++; releaseFullImage();
  const url = photo.url || (fullImageUrl = URL.createObjectURL(photo.blob));
  const image = $('#lightbox-image'); image.classList.remove('in'); image.src = url; image.onload = () => image.classList.add('in');
  $('#lightbox-name').textContent = photo.guestName || 'Tetamu';
  $('#lightbox-time').textContent = new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: CONFIG.timezone }).format(new Date(photo.createdAt));
  $('#lightbox-counter').textContent = `${lightboxIndex + 1} / ${photos.length}`;
  const download = $('#download-photo'); download.href = photo.downloadUrl || url; download.download = `kenangan-${photo.id}.jpg`; download.target = photo.downloadUrl ? '_blank' : '';
  if (!lightbox.open) lightbox.showModal();
}
$('#close-lightbox').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('close', () => { lightboxToken++; $('#lightbox-image').removeAttribute('src'); releaseFullImage(); });
$('.lightbox-prev').addEventListener('click', () => openLightbox(lightboxIndex - 1));
$('.lightbox-next').addEventListener('click', () => openLightbox(lightboxIndex + 1));
lightbox.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') openLightbox(lightboxIndex - 1); if (e.key === 'ArrowRight') openLightbox(lightboxIndex + 1); });
let touchStart;
$('#lightbox-stage').addEventListener('touchstart', e => { touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
$('#lightbox-stage').addEventListener('touchmove', e => { if (e.touches.length > 1) touchStart = null; }, { passive: true });
$('#lightbox-stage').addEventListener('touchend', e => { if (!touchStart) return; const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y; touchStart = null; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5 && (window.visualViewport?.scale || 1) <= 1.01) openLightbox(lightboxIndex + (dx < 0 ? 1 : -1)); }, { passive: true });
function saveBlob(blob, filename) { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
async function copyText(value) { try { await navigator.clipboard.writeText(value); toast('Pautan disalin.'); } catch { toast('Pautan tidak dapat disalin.'); } }
$('#share-photo').addEventListener('click', async () => {
  const photo = photos[lightboxIndex], title = `${CONFIG.groomShort} & ${CONFIG.brideShort}`, token = lightboxToken;
  try {
    let blob = photo.blob;
    if (!blob) { try { blob = await (await fetch(photo.url)).blob(); } catch { blob = null; /* Gambar Drive mungkin tidak membenarkan fetch; kongsi pautan. */ } }
    if (token !== lightboxToken || !lightbox.open) return;
    const file = blob && new File([blob], 'kenangan.jpg', { type: blob.type || 'image/jpeg' });
    if (file && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
    if (photo.url && navigator.share) { await navigator.share({ title, url: photo.url }); return; }
    if (blob && !photo.url) { saveBlob(blob, 'kenangan.jpg'); toast('Gambar dimuat turun untuk dikongsi.'); } else await copyText(photo.url);
  } catch (error) { if (error.name !== 'AbortError') toast('Gambar belum dapat dikongsi. Cuba Muat turun.'); }
});

/* ---------- Ucapan ----------
   Disimpan dalam Sheet "Ucapan". Semua teks dimasukkan melalui textContent. */
let wishes = [];
const wishTime = iso => new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: CONFIG.timezone }).format(new Date(iso));
function renderWishes() {
  $('#wish-list').replaceChildren(...wishes.map((wish, i) => {
    const item = document.createElement('li'); item.className = 'wish-card'; item.style.setProperty('--i', Math.min(i, 10));
    const text = document.createElement('p'); text.textContent = wish.message;
    const meta = document.createElement('footer');
    const name = document.createElement('strong'); name.textContent = wish.name;
    const time = document.createElement('time'); time.dateTime = wish.createdAt; time.textContent = wishTime(wish.createdAt);
    meta.append(name, time); item.append(text, meta); return item;
  }));
  $('#wish-empty').hidden = wishes.length > 0;
  $('#wish-count-tile').textContent = wishes.length ? `${wishes.length}` : '';
}
async function loadWishes() { try { wishes = await api.listWishes(); renderWishes(); } catch { /* Kekalkan senarai sedia ada. */ } }
$('#wish-name').value = guestName;
$('#wish-message').addEventListener('input', e => { $('#wish-count').textContent = `${e.target.value.length}/500`; });
$('#wish-form').addEventListener('submit', async event => {
  event.preventDefault();
  const name = $('#wish-name').value.trim(), message = $('#wish-message').value.trim(), button = $('#wish-form button[type=submit]');
  if (!name || !message) { toast('Sila isi nama dan ucapan anda.'); return; }
  button.disabled = true; button.textContent = 'Menghantar…';
  try {
    const saved = await api.addWish({ id: makeId(), name, message });
    wishes = [saved, ...wishes.filter(w => w.id !== saved.id)]; renderWishes();
    $('#wish-message').value = ''; $('#wish-count').textContent = '0/500';
    if (!guestName) { guestName = name; storage.set('walimah-name', name); nameInput.value = name; }
    toast('Terima kasih atas ucapan dan doa anda ❤️'); celebrate();
  } catch (error) { toast(error.code ? error.message : 'Ucapan belum dapat dihantar. Semak sambungan dan cuba lagi.'); }
  finally { button.disabled = false; button.textContent = 'Hantar ucapan'; }
});

/* ---------- QR (Model 2, versi 5-L, 106 bait, Reed–Solomon) ----------
   Semua pengiraan setempat; tiada perkhidmatan QR atau penjejakan luar. */
function drawQR(text, canvas) { const bytes = new TextEncoder().encode(text); if (bytes.length > 106) return false; const bits = [], push = (n, count) => { for (let i = count - 1; i >= 0; i--) bits.push((n >> i) & 1); }; push(4,4); push(bytes.length,8); bytes.forEach(b => push(b,8)); push(0, Math.min(4,864 - bits.length)); while (bits.length % 8) bits.push(0); const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i+8).reduce((n,b) => (n << 1) | b,0)); for (let i = 0; data.length < 108; i++) data.push(i % 2 ? 0x11 : 0xec);
  const mul = (x,y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; }; let poly = [1]; let root = 1; for (let i = 0; i < 26; i++) { const next = Array(poly.length + 1).fill(0); poly.forEach((v,j) => { next[j] ^= v; next[j+1] ^= mul(v,root); }); poly = next; root = mul(root,2); } const ecc = Array(26).fill(0); data.forEach(byte => { const factor = byte ^ ecc.shift(); ecc.push(0); for (let i = 0; i < 26; i++) ecc[i] ^= mul(poly[i+1],factor); });
  const size = 37, matrix = Array.from({ length:size }, () => Array(size).fill(false)), reserved = Array.from({ length:size }, () => Array(size).fill(false)); const set = (x,y,dark) => { if (x >= 0 && y >= 0 && x < size && y < size) { matrix[y][x] = !!dark; reserved[y][x] = true; } }; const finder = (cx,cy) => { for (let dy=-4;dy<=4;dy++) for(let dx=-4;dx<=4;dx++){ const d=Math.max(Math.abs(dx),Math.abs(dy)); set(cx+dx,cy+dy,d!==2&&d!==4); } }; finder(3,3);finder(size-4,3);finder(3,size-4); for(let i=8;i<size-8;i++){set(i,6,i%2===0);set(6,i,i%2===0);} for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(30+dx,30+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  const format = (mask) => { const value=(1<<3)|mask; let rem=value; for(let i=0;i<10;i++)rem=(rem<<1)^((rem>>>9)*0x537); const f=((value<<10)|rem)^0x5412, bit=i=>(f>>>i)&1; for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));for(let i=0;i<8;i++)set(size-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,size-15+i,bit(i));set(8,size-8,true); };format(0);
  const all=[];[...data,...ecc].forEach(b=>{for(let i=7;i>=0;i--)all.push((b>>>i)&1);});let k=0,up=true;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let v=0;v<size;v++){const y=up?size-1-v:v;for(let j=0;j<2;j++){const x=right-j;if(!reserved[y][x])matrix[y][x]=!!((all[k++]||0)^((x+y)%2===0?1:0));}}up=!up;}
  const cell=5,pad=4;canvas.width=canvas.height=(size+pad*2)*cell;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#120f0d';matrix.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)ctx.fillRect((x+pad)*cell,(y+pad)*cell,cell,cell);}));return true;
}
function shareUrl() { const url = new URL(CONFIG.shareUrl || location.href); url.searchParams.delete('mod'); url.hash = ''; return url.href; }

/* ---------- Paparan slaid (?mod=slideshow) ---------- */
let slidePhotos = [], slideIndex = -1, slideLayer = 0, slideBusy = false; const slideUrls = new Map();
function fullSlideUrl(photo) { if (photo.url) return photo.url; if (!slideUrls.has(photo.id)) slideUrls.set(photo.id, URL.createObjectURL(photo.blob)); return slideUrls.get(photo.id); }
async function nextSlide() {
  if (!slidePhotos.length || slideBusy) return; slideBusy = true;
  try {
    const next = (slideIndex + 1) % slidePhotos.length, url = fullSlideUrl(slidePhotos[next]);
    await new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = url; });
    const layers = $$('.slide-layer'); slideLayer = 1 - slideLayer;
    layers[slideLayer].style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
    layers[slideLayer].dataset.by = slidePhotos[next].guestName || 'Tetamu';
    layers[slideLayer].classList.add('active'); layers[1 - slideLayer].classList.remove('active');
    $('.slide-empty').hidden = true; slideIndex = next;
    const preload = new Image(); preload.src = fullSlideUrl(slidePhotos[(next + 1) % slidePhotos.length]);
  } catch { slideIndex = (slideIndex + 1) % slidePhotos.length; } finally { slideBusy = false; }
}
async function pollSlides() { try { const result = await api.listPhotos({ limit: 160 }); const ids = new Set(slidePhotos.map(p => p.id)); const added = result.items.filter(p => !ids.has(p.id)); const wasEmpty = !slidePhotos.length; slidePhotos.push(...added); if (wasEmpty && slidePhotos.length) void nextSlide(); } catch { /* Kekalkan gambar terakhir ketika luar talian. */ } }
const slideshowMode = new URLSearchParams(location.search).get('mod') === 'slideshow';
if (slideshowMode) {
  document.body.classList.add('is-slideshow'); $('#slideshow').hidden = false;
  $('#slide-names').textContent = `${CONFIG.groomShort} & ${CONFIG.brideShort}`;
  const url = shareUrl(); $('#slide-url').textContent = url.replace(/^https?:\/\//, '');
  try { if (!drawQR(url, $('#qr-canvas'))) { $('#qr-canvas').hidden = true; $('#slide-url').textContent = 'Pautan terlalu panjang untuk QR. Tetapkan CONFIG.shareUrl yang lebih ringkas.'; } } catch { $('#qr-canvas').hidden = true; }
  $('#fullscreen-button').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('#slideshow').requestFullscreen(); } catch { toast('Gunakan pilihan skrin penuh dalam pelayar.'); } });
  setInterval(() => { if (!document.hidden) void nextSlide(); }, 7000);
  setInterval(() => { if (!document.hidden) void pollSlides(); }, CONFIG.pollMs);
}

/* ---------- Mula ---------- */
async function init() {
  renderFilm();
  try {
    await database;
    jobs = (await dbCall('queue', 'getAll')).map(job => ({ ...job, status: job.status === 'failed' ? 'failed' : 'waiting', progress: 0, nextRetry: 0 }));
    ready = true; updateQueue(); pump();
    if (slideshowMode) await pollSlides();
    else { await syncFilm(); void loadWishes(); void refreshCounts(); }
  } catch { toast('Storan pelayar tidak tersedia. Benarkan storan untuk menggunakan album.'); }
}
void init();
setInterval(() => { if (!slideshowMode) void checkNewPhotos(); }, CONFIG.pollMs);
setInterval(() => { if (!slideshowMode && !document.hidden && sheetView === 'wishes') void loadWishes(); }, CONFIG.pollMs);
