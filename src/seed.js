import { db } from "./database.js";

const initialSchedules = [
  [
    "asisten",
    "Asisten Laboratorium Informatika",
    1,
    "07:30",
    "09:30",
    "Online",
  ],
  [
    "asisten",
    "Asisten Jaga Laboratorium Informatika",
    1,
    "09:30",
    "11:30",
    "Tambun",
  ],
  ["praktikum", "Praktikum Lepkom", 1, "13:00", "15:30", "Cakung"],
  [
    "kuliah",
    "Jejaring Sosial&Konten Kreatif",
    2,
    "07:30",
    "09:30",
    "KaliMalang",
  ],
  ["kuliah", "Konsep Data Mining", 2, "09:30", "11:30", "KaliMalang"],
  ["kuliah", "Pemrograman Berbasis Web", 2, "11:30", "13:30", "KaliMalang"],
  [
    "kuliah",
    "Interaksi Manusia dan Komputer",
    3,
    "07:30",
    "10:30",
    "KaliMalang",
  ],
  ["kuliah", "Pengantar Sain Data", 3, "10:30", "12:30", "KaliMalang"],
  ["kuliah", "Metode Penelitian", 3, "13:30", "15:30", "KaliMalang"],
  [
    "asisten",
    "Asisten Laboratorium Informatika",
    4,
    "07:30",
    "09:30",
    "Tambun",
  ],
  [
    "praktikum",
    "Praktikum Sistem Informasi (PHP)",
    4,
    "09:30",
    "11:30",
    "Tambun",
  ],
  [
    "praktikum",
    "Praktikum Sistem Informasi (Figma)",
    4,
    "11:30",
    "13:30",
    "Tambun",
  ],
  [
    "praktikum",
    "Praktikum Sistem Informasi (Python)",
    4,
    "13:30",
    "15:30",
    "Tambun",
  ],
  ["kuliah", "Digital Citizenship", 5, "07:30", "09:30", "KaliMalang"],
  [
    "asisten",
    "Asisten Jaga Laboratorium Informatika",
    5,
    "09:30",
    "11:30",
    "Cakung",
  ],
  [
    "asisten",
    "Asisten Jaga Laboratorium Informatika",
    5,
    "13:30",
    "15:30",
    "Cakung",
  ],
  [
    "kuliah",
    "Sistem Keamanan Teknologi Informasi",
    6,
    "07:30",
    "10:30",
    "KaliMalang",
  ],
  ["kuliah", "Graf dan Analisis Algoritma", 6, "10:30", "13:30", "KaliMalang"],
];

export function seedSchedules() {
  const key = "schedule_image_import_v1";
  if (db.prepare("SELECT 1 FROM app_meta WHERE key = ?").get(key)) return;

  const lookup = db.prepare(`
    SELECT 1 FROM schedules WHERE kind = ? AND title = ? AND weekday = ?
      AND start_time = ? AND end_time = ? AND location = ? LIMIT 1
  `);
  const insert = db.prepare(`
    INSERT INTO schedules
      (kind, title, weekday, start_time, end_time, location, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const added = db.transaction(() => {
    let count = 0;
    for (const values of initialSchedules) {
      if (lookup.get(...values)) continue;
      const timestamp = Date.now();
      insert.run(...values, timestamp, timestamp);
      count += 1;
    }
    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run(
      key,
      "done",
    );
    return count;
  })();

  console.log(`[JADWAL] ${added} jadwal awal ditambahkan dari tabel.`);
}
