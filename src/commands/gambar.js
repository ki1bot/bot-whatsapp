import { statSync } from "node:fs";
import { join } from "node:path";
import { settings } from "../config.js";

const IMAGE_PATH = join(settings.root, "assets", "jadwal-semester-5.jpg");

const IMAGE_CAPTION = [
  "*JADWAL KULIAH SEMESTER 5*",
  "",
  "Berikut foto jadwal terbaru yang berisi mata kuliah, praktikum, dan kegiatan asisten laboratorium.",
  "",
  "Informasi pada gambar meliputi:",
  "Hari, nama kegiatan, jam, lokasi, ruang, dan jenis kegiatan.",
  "",
  "Gunakan /jadwal untuk melihat seluruh jadwal dalam bentuk teks.",
  "Gunakan /hariini untuk melihat jadwal hari ini.",
  "",
  "Semoga kegiatanmu berjalan lancar!",
].join("\n");

export function handleGambarCommand(input) {
  const command = input.trim().toLowerCase().replace(/\s+/g, " ");

  if (command === "/gambar jadwal") {
    try {
      const file = statSync(IMAGE_PATH);

      if (!file.isFile() || file.size === 0) {
        return [
          "Maaf, foto jadwal belum tersedia.",
          "",
          "Pastikan gambar sudah disimpan di folder assets dengan nama jadwal-semester-5.jpg.",
        ].join("\n");
      }
    } catch {
      return [
        "Maaf, foto jadwal belum ditemukan di penyimpanan bot.",
        "",
        "Pastikan file assets/jadwal-semester-5.jpg tersedia pada komputer atau server yang menjalankan bot.",
      ].join("\n");
    }

    return {
      type: "image",
      path: IMAGE_PATH,
      caption: IMAGE_CAPTION,
    };
  }

  if (command === "/gambar" || command.startsWith("/gambar ")) {
    return [
      "Untuk mendapatkan foto jadwal semester 5, ketik:",
      "",
      "/gambar jadwal",
    ].join("\n");
  }

  return null;
}
