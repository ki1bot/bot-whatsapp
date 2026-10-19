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
    "/jadwal tambah | kuliah | Basis Data | Senin | 07:30 | 09:30 | Kalimalang",
    "",
    "*Ubah jadwal:*",
    "/jadwal ubah 1 | asisten | Jaga Laboratorium | Senin | 09:30 | 11:30 | Tambun",
    "",
    "*Hapus jadwal:*",
    "/jadwal hapus 1",
    "",
    "Jenis yang tersedia: kuliah, asisten, praktikum, lainnya.",
    "Jadwal berulang setiap minggu. Angka 1 hanya contoh ID; periksa ID sebenarnya melalui /jadwal.",
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
    "Bot hanya menyimpan informasi teks, bukan dokumen tugas.",
    "Angka 1 hanya contoh ID; periksa ID sebenarnya melalui /tugas.",
  ].join("\n");
}

function addInfo() {
  return [
    "*CARA MENAMBAHKAN DATA*",
    "",
    "*Jadwal:*",
    "/jadwal tambah | praktikum | Praktikum Pemrograman Web | Kamis | 09:30 | 11:30 | Lab TI",
    "",
    "*Tugas:*",
    `/tugas tambah | Pemrograman Web | Membuat Website | ${exampleDeadline()}`,
    "",
    "Pisahkan setiap bagian menggunakan tanda |.",
    "Lihat /info jadwal atau /info tugas untuk panduan lainnya.",
  ].join("\n");
}

function editInfo() {
  return [
    "*CARA MENGUBAH DATA*",
    "",
    "1. Kirim /jadwal atau /tugas untuk melihat ID.",
    "2. Kirim perintah ubah dengan ID dan seluruh informasi terbaru.",
    "",
    "*Ubah jadwal:*",
    "/jadwal ubah 1 | kuliah | Basis Data | Selasa | 10:00 | 12:00 | Kalimalang",
    "",
    "*Ubah tugas:*",
    `/tugas ubah 1 | Basis Data | Revisi ERD | ${exampleDeadline()}`,
    "",
    "Ganti angka 1 dengan ID yang ingin diubah. Seluruh data lama pada entri tersebut akan diganti sesuai perintah.",
  ].join("\n");
}

function deleteInfo() {
  return [
    "*CARA MENGHAPUS DATA*",
    "",
    "1. Lihat ID menggunakan /jadwal atau /tugas.",
    "2. Kirim perintah penghapusan yang sesuai.",
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
    "Ganti angka 1 dengan ID yang benar. Menghapus berbeda dari menandai tugas selesai.",
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
      return "Pilihan info belum tersedia. Coba /info untuk melihat semua panduan.";
  }
}
