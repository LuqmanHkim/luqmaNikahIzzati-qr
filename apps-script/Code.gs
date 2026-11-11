/* Backend album Luqman & Izzati — Google Apps Script + Google Drive + Google Sheet.
   Jalankan setup dari editor sebelum deploy. Jika skrip dicipta dari Sheet,
   SPREADSHEET_ID boleh dikosongkan. Lihat SETUP.md untuk langkah penuh.
   Deploy: Web app · Execute as: Me · Who has access: Anyone. */

const FOLDER_ID = '1xlx5zbmss0FW0NwjgNUNhn56qGuO5sWX'; // ID folder Drive untuk simpan gambar
const SPREADSHEET_ID = '1O7HkQHy12tRORQx75ISPcZppknaJDqQqCwCPopBpzOw'; // ID Sheet album
const FILM_LIMIT = 10;                 // Had gambar bagi setiap tetamu
const WISH_LIMIT = 5;                  // Had ucapan bagi setiap tetamu
const MAX_BYTES = 8 * 1024 * 1024;     // Saiz maksimum satu gambar selepas mampatan
const CACHE_SECONDS = 15;              // Cache senarai supaya polling tetamu ringan

const PHOTO_HEADER = ['id', 'fileId', 'nama', 'guestId', 'masa', 'lebar', 'tinggi', 'sorok'];
const WISH_HEADER = ['id', 'nama', 'ucapan', 'guestId', 'masa', 'sorok'];

function doGet(e) {
  const p = e.parameter || {};
  try {
    if (p.action === 'photos') return json_(listPhotos_(p));
    if (p.action === 'film') return json_({ used: countFor_(sheet_('Gambar', PHOTO_HEADER), p.guestId) });
    if (p.action === 'wishes') return json_(listWishes_());
    return json_({ ok: true, name: 'album-walimah' });
  } catch (err) {
    return fail_('server', 'Ralat pelayan. Cuba lagi sebentar.', err);
  }
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return fail_('invalid', 'Permintaan tidak sah.'); }
  try {
    if (body.action === 'upload') return json_(upload_(body));
    if (body.action === 'wish') return json_(addWish_(body));
    return fail_('invalid', 'Tindakan tidak dikenali.');
  } catch (err) {
    if (err && err.code) return fail_(err.code, err.message);
    return fail_('server', 'Ralat pelayan. Cuba lagi sebentar.', err);
  }
}

/* ---------- Gambar ---------- */

function upload_(b) {
  const id = cleanId_(b.id), guestId = cleanId_(b.guestId);
  if (!id || !guestId || !b.data) throw error_('invalid', 'Data gambar tidak lengkap.');
  const sheet = sheet_('Gambar', PHOTO_HEADER);

  const existing = findRow_(sheet, id);
  if (existing) return { ok: true, photo: toPhoto_(existing) }; // Cubaan semula selepas berjaya
  if (countFor_(sheet, guestId) >= FILM_LIMIT) throw error_('film_habis', 'Filem anda sudah habis.');

  const bytes = Utilities.base64Decode(String(b.data));
  if (bytes.length > MAX_BYTES) throw error_('too_large', 'Gambar terlalu besar.');
  const name = cleanText_(b.guestName, 60) || 'Tetamu';
  const now = new Date().toISOString();
  const file = DriveApp.getFolderById(FOLDER_ID)
    .createFile(Utilities.newBlob(bytes, 'image/jpeg', `${now.replace(/[:.]/g, '-')} ${name}.jpg`));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Kunci hanya semasa semak semula + tulis baris, supaya muat naik serentak tidak tersekat lama.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const again = findRow_(sheet, id);
    if (again) { file.setTrashed(true); return { ok: true, photo: toPhoto_(again) }; }
    if (countFor_(sheet, guestId) >= FILM_LIMIT) { file.setTrashed(true); throw error_('film_habis', 'Filem anda sudah habis.'); }
    const row = [id, file.getId(), safeCell_(name), guestId, now, Number(b.width) || 0, Number(b.height) || 0, ''];
    sheet.appendRow(row);
    CacheService.getScriptCache().remove('photos');
    return { ok: true, photo: toPhoto_(row) };
  } finally {
    lock.releaseLock();
  }
}

function listPhotos_(p) {
  const limit = Math.min(Math.max(Number(p.limit) || 40, 1), 200);
  const mine = p.mine === 'true', guestId = cleanId_(p.guestId), cursor = p.cursor || '';
  const cache = CacheService.getScriptCache();
  const cacheable = !mine && !cursor && limit <= 160;
  if (cacheable) {
    const hit = cache.get('photos');
    if (hit) { const all = JSON.parse(hit); return page_(all, limit, ''); }
  }
  const rows = sheet_('Gambar', PHOTO_HEADER).getDataRange().getValues().slice(1)
    .filter(r => r[0] && !isHidden_(r[7]) && (!mine || r[3] === guestId))
    .map(toPhoto_)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  if (cacheable) {
    const top = rows.slice(0, 160), text = JSON.stringify(top);
    if (text.length < 95000) cache.put('photos', text, CACHE_SECONDS);
  }
  return page_(rows, limit, cursor);
}

function page_(rows, limit, cursor) {
  let list = rows;
  if (cursor) { const [stamp, id] = JSON.parse(cursor); list = rows.filter(r => r.createdAt < stamp || (r.createdAt === stamp && r.id < id)); }
  const items = list.slice(0, limit), last = items[items.length - 1];
  return { items, nextCursor: list.length > limit && last ? JSON.stringify([last.createdAt, last.id]) : null };
}

function toPhoto_(r) {
  const fileId = String(r[1]);
  return {
    id: String(r[0]),
    url: `https://lh3.googleusercontent.com/d/${fileId}=w2048`,
    thumbnailUrl: `https://lh3.googleusercontent.com/d/${fileId}=w640`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    guestName: String(r[2]).replace(/^'/, '') || 'Tetamu',
    createdAt: r[4] instanceof Date ? r[4].toISOString() : String(r[4]),
    width: Number(r[5]) || 0,
    height: Number(r[6]) || 0
  };
}

/* ---------- Ucapan ---------- */

function addWish_(b) {
  const id = cleanId_(b.id), guestId = cleanId_(b.guestId);
  const name = cleanText_(b.name, 60), message = cleanText_(b.message, 500);
  if (!id || !guestId || !name || !message) throw error_('invalid', 'Sila isi nama dan ucapan.');
  const sheet = sheet_('Ucapan', WISH_HEADER);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const existing = findRow_(sheet, id);
    if (existing) return { ok: true, wish: toWish_(existing) };
    if (countFor_(sheet, guestId) >= WISH_LIMIT) throw error_('wish_limit', 'Terima kasih! Anda telah menghantar beberapa ucapan.');
    const row = [id, safeCell_(name), safeCell_(message), guestId, new Date().toISOString(), ''];
    sheet.appendRow(row);
    CacheService.getScriptCache().remove('wishes');
    return { ok: true, wish: toWish_(row) };
  } finally {
    lock.releaseLock();
  }
}

function listWishes_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('wishes');
  if (hit) return JSON.parse(hit);
  const items = sheet_('Ucapan', WISH_HEADER).getDataRange().getValues().slice(1)
    .filter(r => r[0] && !isHidden_(r[5]))
    .map(toWish_)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 300);
  const result = { items }, text = JSON.stringify(result);
  if (text.length < 95000) cache.put('wishes', text, CACHE_SECONDS);
  return result;
}

function toWish_(r) {
  return {
    id: String(r[0]),
    name: String(r[1]).replace(/^'/, ''),
    message: String(r[2]).replace(/^'/, ''),
    createdAt: r[4] instanceof Date ? r[4].toISOString() : String(r[4])
  };
}

/* ---------- Bantuan ---------- */

function sheet_(name, header, ss) {
  if (!ss) {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || SPREADSHEET_ID;
    if (!id) throw new Error('Jalankan setup dari editor Apps Script dahulu.');
    ss = SpreadsheetApp.openById(id);
  }
  let sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(header); sheet.setFrozenRows(1); }
  return sheet;
}

function findRow_(sheet, id) {
  const cell = sheet.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  return cell ? sheet.getRange(cell.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0] : null;
}

function countFor_(sheet, guestId) {
  const id = cleanId_(guestId);
  if (!id) return 0;
  return sheet.getRange('D:D').createTextFinder(id).matchEntireCell(true).findAll().length;
}

// Taip apa-apa (cth. "ya") dalam lajur "sorok" untuk sembunyikan gambar/ucapan.
const isHidden_ = value => String(value).trim() !== '';
const cleanId_ = value => (/^[\w-]{8,64}$/.test(String(value || '')) ? String(value) : '');
const cleanText_ = (value, max) => String(value || '').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, max);
const safeCell_ = text => (/^[=+\-@]/.test(text) ? `'${text}` : text); // Elak formula dalam Sheet

function error_(code, message) { const err = new Error(message); err.code = code; return err; }

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code, message, err) {
  if (err) console.error(err);
  return json_({ error: code, message });
}

/* Jalankan sekali dari editor untuk beri kebenaran Drive & Sheet sebelum deploy. */
function setup() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Isi SPREADSHEET_ID atau buka Extensions → Apps Script dari Google Sheet album.');
  const folderName = DriveApp.getFolderById(FOLDER_ID).getName();
  sheet_('Gambar', PHOTO_HEADER, ss);
  sheet_('Ucapan', WISH_HEADER, ss);
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  console.log('Sheet: ' + ss.getName());
  console.log('Folder: ' + folderName);
}
