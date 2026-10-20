import { nowWib } from "../time.js";

function exampleDeadline() {
  return `${nowWib().plus({ days: 14 }).toFormat("dd-MM-yyyy")} 23:59`;
}

export function infoMenu() {
  return [
    "*PUSAT INFORMASI BOT*",
    "",
    "Halo! Mau mengelola jadwal atau deadline tugas?",
    "",
    "/info jadwal — Panduan jadwal kuliah, asisten, praktikum, dan kegiatan lain.",
    "/info tugas — Panduan tugas dan deadline.",
    "/info tambah — Cara menambahkan data.",
    "/info ubah — Cara mengubah data.",
    "/info hapus — Cara menghapus data.",
    "",
    "Gunakan /jadwal atau /tugas untuk melihat ID sebelum mengubah atau menghapus data.",
  ].join("\n");
}

function scheduleInfo() {
  return [
    "*PANDUAN MENGELOLA JADWAL*",
    "",
    "*Lihat jadwal:*",
    "/jadwal",
    "/hariini",
    "/besok",
    "/jadwal senin",
    "",
    "*Tambah jadwal:*",
    "/jadwal tambah | asisten | Asisten Laboratorium Informatika | Senin | 07:30 | 09:30 | Kalimalang | Online | Asisten Ngajar Online/Daring",
    "",
    "*Ubah jadwal:*",
    "/jadwal ubah 1 | asisten | Asisten Jaga Laboratorium Informatika | Senin | 09:30 | 11:30 | Tambun | J322 | Asisten Jaga/Penilaian",
    "",
    "*Hapus jadwal:*",
    "/jadwal hapus 1",
    "",
    "Urutan input: kategori | kegiatan | hari | jam mulai | jam selesai | lokasi | ruang | jenis.",
    "Kategori: kuliah, asisten, praktikum, lainnya.",
    "Jenis dapat diisi sesuai kegiatan, misalnya Mata Kuliah atau Praktikum Offline/Luring.",
    "Format lama tanpa jenis tetap diterima; bot akan mempertahankan atau menentukan jenis otomatis.",
    "Jadwal akan berulang setiap minggu. Angka 1 hanya contoh ID.",
  ].join("\n");
}

function taskInfo() {
  const deadline = exampleDeadline();

  return [
    "*PANDUAN MENGELOLA TUGAS*",
    "",
    "*Lihat tugas dan deadline:*",
    "/tugas",
    "/deadline",
    "",
    "*Tambah tugas:*",
    `/tugas tambah | Metode Penelitian | Membuat Proposal | ${deadline}`,
    "",
    "*Ubah tugas:*",
    `/tugas ubah 1 | Metode Penelitian | Revisi Proposal | ${deadline}`,
    "",
    "*Tandai selesai:*",
    "/tugas selesai 1",
    "",
    "*Hapus tugas:*",
    "/tugas hapus 1",
    "",
    "Deadline menggunakan format DD-MM-YYYY HH:mm (WIB).",
    "Angka 1 hanya contoh ID; periksa ID sebenarnya melalui /tugas.",
  ].join("\n");
}

function addInfo() {
  return [
    "*CARA MENAMBAHKAN DATA*",
    "",
    "*Jadwal:*",
    "/jadwal tambah | praktikum | Praktikum Sistem Informasi (PHP) | Kamis | 09:30 | 11:30 | Tambun | J321 | Praktikum Offline/Luring",
    "",
    "*Tugas:*",
    `/tugas tambah | Pemrograman Web | Membuat Website | ${exampleDeadline()}`,
    "",
    "Pisahkan informasi menggunakan tanda |.",
    "Lihat /info jadwal atau /info tugas untuk contoh lainnya.",
  ].join("\n");
}

function editInfo() {
  return [
    "*CARA MENGUBAH DATA*",
    "",
    "1. Kirim /jadwal atau /tugas untuk melihat ID.",
    "2. Kirim perintah ubah beserta seluruh informasi terbaru.",
    "",
    "*Ubah jadwal:*",
    "/jadwal ubah 1 | kuliah | Konsep Data Mining | Selasa | 09:30 | 11:30 | Kalimalang | J1416B | Mata Kuliah",
    "",
    "*Ubah tugas:*",
    `/tugas ubah 1 | Basis Data | Revisi ERD | ${exampleDeadline()}`,
    "",
    "Ganti angka 1 dengan ID yang ingin diubah.",
  ].join("\n");
}

function deleteInfo() {
  return [
    "*CARA MENGHAPUS DATA*",
    "",
    "1. Periksa ID melalui /jadwal atau /tugas.",
    "2. Kirim perintah hapus yang sesuai.",
    "",
    "*Hapus jadwal:*",
    "/jadwal hapus 1",
    "",
    "*Hapus tugas:*",
    "/tugas hapus 1",
    "",
    "*Tugas sudah dikumpulkan?*",
    "/tugas selesai 1",
    "",
    "Menghapus tugas berbeda dari menandai tugas selesai.",
  ].join("\n");
}

export function handleInfoCommand(input) {
  const command = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (!/^\/info(?:\s|$)/.test(command)) {
    return null;
  }

  switch (command) {
    case "/info":
      return infoMenu();
    case "/info jadwal":
      return scheduleInfo();
    case "/info tugas":
      return taskInfo();
    case "/info tambah":
      return addInfo();
    case "/info ubah":
      return editInfo();
    case "/info hapus":
      return deleteInfo();
    default:
      return "Pilihan info belum tersedia. Kirim /info untuk melihat panduan.";
  }
}
