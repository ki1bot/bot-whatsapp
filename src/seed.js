import { db } from "./database.js";

const semesterFiveSchedules = [
  [
    "asisten",
    "Asisten Laboratorium Informatika",
    1,
    "07:30",
    "09:30",
    "Kalimalang",
    "Online",
    "Asisten Ngajar Online/Daring",
  ],
  [
    "asisten",
    "Asisten Jaga Laboratorium Informatika",
    1,
    "09:30",
    "11:30",
    "Tambun",
    "J322",
    "Asisten Jaga/Penilaian",
  ],
  [
    "asisten",
    "Asisten Jaga Laboratorium Informatika",
    1,
    "11:30",
    "13:30",
    "Tambun",
    "J322",
    "Asisten Jaga/Penilaian",
  ],
  [
    "asisten",
    "Asisten Jaga Laboratorium Informatika",
    1,
    "13:30",
    "15:30",
    "Tambun",
    "J322",
    "Asisten Jaga/Penilaian",
  ],
  [
    "kuliah",
    "Jejaring Sosial&Konten Kreatif",
    2,
    "07:30",
    "09:30",
    "Kalimalang",
    "J1416B",
    "Mata Kuliah",
  ],
  [
    "kuliah",
    "Konsep Data Mining",
    2,
    "09:30",
    "11:30",
    "Kalimalang",
    "J1416B",
    "Mata Kuliah",
  ],
  [
    "kuliah",
    "Pemrograman Berbasis Web",
    2,
    "11:30",
    "13:30",
    "Kalimalang",
    "J1416B",
    "Mata Kuliah",
  ],
  [
    "kuliah",
    "Interaksi Manusia dan Komputer",
    3,
    "07:30",
    "10:30",
    "Kalimalang",
    "J137",
    "Mata Kuliah",
  ],
  [
    "kuliah",
    "Pengantar Sain Data",
    3,
    "10:30",
    "12:30",
    "Kalimalang",
    "J137",
    "Mata Kuliah",
  ],
  [
    "kuliah",
    "Metode Penelitian",
    3,
    "13:30",
    "15:30",
    "Kalimalang",
    "J1319",
    "Mata Kuliah",
  ],
  [
    "asisten",
    "Asisten Laboratorium Informatika",
    4,
    "07:30",
    "09:30",
    "Tambun",
    "J322",
    "Asisten Ngajar Offline/Luring",
  ],
  [
    "praktikum",
    "Praktikum Sistem Informasi (PHP)",
    4,
    "09:30",
    "11:30",
    "Tambun",
    "J321",
    "Praktikum Offline/Luring",
  ],
  [
    "praktikum",
    "Praktikum Sistem Informasi (Figma)",
    4,
    "11:30",
    "13:30",
    "Tambun",
    "J321",
    "Praktikum Offline/Luring",
  ],
  [
    "praktikum",
    "Praktikum Sistem Informasi (Python)",
    4,
    "13:30",
    "15:30",
    "Tambun",
    "J321",
    "Praktikum Offline/Luring",
  ],
  [
    "kuliah",
    "Digital Citizeship",
    5,
    "07:30",
    "09:30",
    "Kalimalang",
    "J1419",
    "Mata Kuliah",
  ],
  [
    "praktikum",
    "Praktikum Lepkom",
    5,
    "09:30",
    "11:30",
    "Cakung",
    "J6122",
    "Praktikum Offline/Luring",
  ],
  [
    "kuliah",
    "Sistem Keamanan Teknologi Informasi",
    6,
    "07:30",
    "10:30",
    "Kalimalang",
    "J1515A",
    "Mata Kuliah",
  ],
  [
    "kuliah",
    "Graf dan Analisis Algoritma",
    6,
    "10:30",
    "13:30",
    "Kalimalang",
    "J1319",
    "Mata Kuliah",
  ],
];

export function seedSchedules() {
  const marker = "semester5_activity_type_from_excel_20261020_v1";
  const hasMarker = db.prepare("SELECT 1 FROM app_meta WHERE key = ?");

  if (hasMarker.get(marker)) {
    return;
  }

  const apply = db.transaction(() => {
    const existing = db
      .prepare(
        `
      SELECT * FROM schedules
      ORDER BY weekday, start_time, id
    `,
      )
      .all();

    const used = new Set();

    const update = db.prepare(`
      UPDATE schedules
      SET kind = ?, title = ?, weekday = ?, start_time = ?, end_time = ?,
          location = ?, room = ?, activity_type = ?, updated_at = ?
      WHERE id = ?
    `);

    const insert = db.prepare(`
      INSERT INTO schedules
        (kind, title, weekday, start_time, end_time, location, room,
         activity_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let updated = 0;
    let added = 0;
    const timestamp = Date.now();

    for (const values of semesterFiveSchedules) {
      const [kind, title, weekday, start, end] = values;

      const available = existing.filter((row) => !used.has(row.id));

      const slotMatches = available.filter(
        (row) => row.weekday === weekday && row.start_time === start,
      );

      const exactMatch = slotMatches.find(
        (row) => row.title === title && row.end_time === end,
      );

      const matched =
        exactMatch ?? (slotMatches.length === 1 ? slotMatches[0] : null);

      if (matched) {
        used.add(matched.id);

        const fields = [
          "kind",
          "title",
          "weekday",
          "start_time",
          "end_time",
          "location",
          "room",
          "activity_type",
        ];

        const changed = fields.some(
          (field, index) => matched[field] !== values[index],
        );

        if (changed) {
          update.run(...values, timestamp, matched.id);
          updated += 1;
        }
      } else {
        insert.run(...values, timestamp, timestamp);
        added += 1;
      }
    }

    db.prepare("INSERT INTO app_meta (key, value) VALUES (?, ?)").run(
      marker,
      new Date().toISOString(),
    );

    return {
      updated,
      added,
      remaining: existing.length - used.size,
    };
  });

  const result = apply();

  const count = db
    .prepare("SELECT COUNT(*) AS total FROM schedules")
    .get().total;

  if (result.remaining > 0) {
    console.warn(
      `[JADWAL] ${result.remaining} jadwal lain dipertahankan. ` +
        "Periksa /jadwal jika ada kegiatan lama atau tambahan.",
    );
  }
}
