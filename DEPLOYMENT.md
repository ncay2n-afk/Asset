# Panduan Lengkap Deploy ke GitHub Pages (Hosting GitHub)

Aplikasi **AsetKantor Enterprise** kini telah dikonfigurasi untuk hosting otomatis menggunakan **GitHub Pages** dan beroperasi **100% tanpa login akun Google** melalui **Google Apps Script Cloud Bridge**.

Workflow GitHub Actions resmi telah disiapkan di `.github/workflows/deploy.yml` dan `vite.config.ts` telah diatur dengan `base: './'` agar semua file CSS, JS, dan gambar otomatis terbaca di domain GitHub Anda.

---

## Langkah 1: Push Kode ke Repository GitHub

1. Buka terminal proyek Anda dan lakukan inisialisasi / commit:
   ```bash
   git add .
   git commit -m "feat: spreadsheet cloud bridge without google login"
   ```

2. Hubungkan ke repository GitHub Anda (jika belum):
   ```bash
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git branch -M main
   git push -u origin main
   ```

---

## Langkah 2: Aktifkan GitHub Pages di Repository

1. Buka repository Anda di browser: `https://github.com/USERNAME/NAMA-REPO`.
2. Klik tab **Settings** (Pengaturan repo).
3. Di menu sebelah kiri, pilih **Pages** (di bawah bagian *Code and automation*).
4. Pada bagian **Build and deployment** > **Source**:
   * Ubah dari *"Deploy from a branch"* menjadi **"GitHub Actions"**.
5. Selesai! Workflow akan otomatis berjalan dan mendeploy aplikasi Anda setiap kali Anda melakukan `git push` ke branch `main`.

Setelah 1-2 menit, URL website Anda akan aktif di:
👉 **`https://USERNAME.github.io/NAMA-REPO/`**

---

## Langkah 3: Hubungkan Google Spreadsheet Aktif Online ke Semua Device (Tanpa Login Google)

Agar seluruh HP, tablet, dan laptop dapat login memakai akun di tab **`Master_Pengguna`** Google Spreadsheet, membaca/mengupdate 11 tab database, serta menyimpan semua gambar ke **Google Drive** tanpa login Google:

1. Buka file **Google Spreadsheet** yang ingin dijadikan database utama.
2. Klik menu **Ekstensi (Extensions) &rarr; Apps Script**.
3. Di dalam aplikasi AsetKantor, klik tombol **Panduan & Code.gs** pada halaman Login atau tab **Database**, lalu klik **Salin Kode `Code.gs`**.
4. Tempel seluruh kode tersebut ke `Code.gs` di Apps Script Editor (hapus kode bawaan) dan klik **Simpan**.
5. Klik **Terapkan (Deploy) &rarr; Deployment baru &rarr; Jenis: Aplikasi web**:
   * **Jalankan sebagai**: **Saya** (Pemilik Google Spreadsheet)
   * **Yang memiliki akses**: **Siapa saja (Anyone)**
   * Klik **Terapkan** lalu berikan izin akses Google Sheets, Drive, dan Email saat diminta.
6. Salin URL Web App yang berakhiran `/exec`, tempel ke kolom **URL Web App Cloud Bridge** di aplikasi, lalu klik **Hubungkan & Muat User** (atau **Tes & Hubungkan Bridge**).
7. Klik **Salin Link Device** (atau **Share Device**) untuk membagikan tautan siap pakai ke seluruh HP & laptop kantor agar otomatis terhubung ke Spreadsheet yang sama!
8. _(Opsional untuk deploy build permanen)_ Anda juga dapat mengatur `VITE_CLOUD_BRIDGE_URL` (dan `VITE_CLOUD_BRIDGE_KEY` jika memakai kunci akses) di GitHub Repository Variables/Secrets sebelum build agar URL Bridge tertanam permanen di website GitHub Pages Anda.
