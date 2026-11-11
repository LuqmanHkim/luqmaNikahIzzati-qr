# Setup album: GitHub Pages + Google Drive

Laman (`index.html`, `app.js`, `styles.css`) di-host di **GitHub Pages**.
Gambar disimpan dalam **Google Drive**. Senarai gambar dan ucapan disimpan dalam **Google Sheet**.
Penghubungnya ialah **Google Apps Script** (`apps-script/Code.gs`), yang percuma dan tidak memerlukan server.

> Gunakan akaun Gmail peribadi. Akaun Google Workspace syarikat biasanya menyekat perkongsian "Anyone with the link", jadi gambar tidak akan dapat dipaparkan.

## 1. Sediakan Google Drive dan Sheet

1. Di Google Drive, cipta folder baharu, contohnya **Album Luqman & Izzati**.
2. Buka folder itu. Salin ID folder daripada URL: `https://drive.google.com/drive/folders/`**`INI_ID_FOLDER`**
3. Cipta Google Sheet baharu, contohnya **Album Walimah**. Tab tidak perlu dibuat sendiri, kerana skrip akan mencipta tab `Gambar` dan `Ucapan`.

## 2. Pasang Apps Script

1. Dalam Sheet tadi, buka **Extensions → Apps Script**.
2. Padam kod contoh, kemudian tampal keseluruhan isi `apps-script/Code.gs`.
3. Tukar baris ini kepada ID folder dari langkah 1:
   ```js
   const FOLDER_ID = 'GANTI_DENGAN_ID_FOLDER_DRIVE';
   ```
4. Simpan (ikon disket).
5. Pilih fungsi **`setup`** di bar atas, kemudian tekan **Run**. Benarkan akses apabila diminta (Review permissions → pilih akaun → Advanced → Go to … → Allow).
   Selepas itu, tab `Gambar` dan `Ucapan` akan muncul dalam Sheet.

## 3. Deploy sebagai Web App

1. Tekan **Deploy → New deployment**.
2. Pada ikon gear, pilih **Web app**.
3. Tetapkan:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Tekan **Deploy**, kemudian salin **Web app URL**. URL itu berbentuk `https://script.google.com/macros/s/…/exec`.

> Jika `Code.gs` diubah kemudian, buka **Deploy → Manage deployments → Edit (pensel) → Version: New version → Deploy**. Dengan cara ini, URL kekal sama.

## 4. Sambungkan laman

Dalam `app.js`, isi `API_BASE_URL` dengan URL tadi:

```js
API_BASE_URL: 'https://script.google.com/macros/s/XXXX/exec',
```

`filmLimit` dalam `app.js` mesti sama dengan `FILM_LIMIT` dalam `Code.gs`. Nilai lalai untuk kedua-duanya ialah 10.

**Gambar cover:** letak gambar pengantin dengan nama `cover.jpg` dalam folder yang sama dengan `index.html`. Gambar potret sesuai, dan saiz di bawah 500 KB lebih baik. Jika fail ini tiada, monogram **L & I** akan dipaparkan.

**Templat gambar:** nama pada templat (Klasik / Polaroid / Filem) diambil daripada `frameNames: 'Luqman & Izzati'`, dan baris kecilnya daripada `frameLine`. Tetamu memilih templat dalam kamera.

**Cop tarikh:** teks oren pada gambar (gaya kamera filem) ditetapkan melalui `stamp: "14 11 '26"`. Tetamu boleh mematikannya dengan butang "Cop tarikh" dalam kamera.

## 5. Host di GitHub Pages

1. Cipta repo baharu di GitHub, contohnya `qr-luqman`.
2. Push fail-fail dalam folder ini ke repo tersebut. Folder `apps-script/` dan fail `SETUP.md` tidak memudaratkan jika ikut sekali.
3. Di repo, buka **Settings → Pages → Source: Deploy from a branch → `main` / root**, kemudian tekan **Save**.
4. Dalam 1–2 minit, laman akan tersedia di `https://NAMA-ANDA.github.io/qr-luqman/`.
5. Isi `shareUrl` dalam `app.js` dengan URL tersebut, supaya QR pada paparan slaid merujuk pautan yang betul.

## 6. Uji sebelum hari majlis

- [ ] Buka laman di telefon, tekan **Ambil Gambar**, dan pastikan kamera terbuka.
- [ ] Ambil satu gambar. Pastikan fail muncul dalam folder Drive, satu baris baharu muncul dalam tab `Gambar`, dan gambar kelihatan dalam galeri.
- [ ] Buka laman di telefon lain. Gambar tadi patut kelihatan di sana juga.
- [ ] Hantar satu ucapan, kemudian semak tab `Ucapan`.
- [ ] Buka `URL?mod=slideshow` di laptop atau projektor untuk paparan slaid.

## Mengurus semasa majlis

- **Sorok gambar atau ucapan:** taip apa-apa (contohnya `ya`) dalam lajur **sorok** pada baris berkenaan. Ia akan hilang dari laman dalam kira-kira 15 saat.
- **Muat turun semua gambar:** klik kanan pada folder Drive, kemudian pilih **Download**.
- **Had filem** dikuatkuasakan di server mengikut peranti tetamu. Tetamu yang membersihkan data pelayar akan mendapat filem baharu. Ini memang dibiarkan, kerana tujuannya untuk keseronokan, bukan kawalan ketat.
- Apps Script mempunyai kuota harian untuk akaun percuma, tetapi kuota itu cukup untuk satu majlis (ratusan tetamu, beberapa ribu gambar). Muat naik yang gagal akan dicuba semula secara automatik.
