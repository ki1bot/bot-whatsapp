import { schedules } from "../repositories/schedules.js";
import { days, isClock, nowWib, parseDay } from "../time.js";

const kinds = ["kuliah", "asisten", "praktikum", "lainnya"];

const usage =
  "/jadwal tambah | kuliah | Nama Kegiatan | Senin | 07:30 | 09:30 | Lokasi";

const validId = (raw) =>
  /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0;

function parseDetails(raw) {
  const parts = raw.split("|").map((value) => value.trim());

  if (parts.length !== 6 || parts.some((value) => !value)) {
    return null;
  }

  const [kindRaw, title, day, start, end, location] = parts;
  const kind = kindRaw.toLowerCase();
  const weekday = parseDay(day);

  if (
    !kinds.includes(kind) ||
    !weekday ||
    !isClock(start) ||
    !isClock(end) ||
    start >= end
  ) {
    return null;
  }

  if (title.length > 160 || location.length > 120) {
    return null;
  }

  return {
    kind,
    title,
    weekday,
    start,
    end,
    location,
  };
}

export function listSchedules(weekday = null) {
  const rows = weekday ? schedules.forDay(weekday) : schedules.all();

  const label = weekday ? days[weekday - 1] : "Mingguan";

  if (!rows.length) {
    return `Belum ada jadwal untuk ${label}.`;
  }

  return `JADWAL ${label.toUpperCase()} (${rows.length})\n\n${rows
    .map(
      (item) =>
        `[${item.id}] ${days[item.weekday - 1]} ${item.start_time}–${item.end_time}\n${item.title}\nJenis: ${item.kind} | Lokasi: ${item.location}`,
    )
    .join("\n\n")}`;
}

export function handleSchedules(input) {
  const lower = input.toLowerCase().replace(/\s+/g, " ");

  if (["/jadwal", "/jadwal minggu"].includes(lower)) {
    return listSchedules();
  }

  if (["/hariini", "/jadwal hariini", "/jadwal hari ini"].includes(lower)) {
    return listSchedules(nowWib().weekday);
  }

  if (["/besok", "/jadwal besok"].includes(lower)) {
    return listSchedules(nowWib().plus({ days: 1 }).weekday);
  }

  const byDay = lower.match(
    /^\/jadwal\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu)$/,
  );

  if (byDay) {
    return listSchedules(parseDay(byDay[1]));
  }

  const add = input.match(/^\/jadwal\s+tambah\s*\|\s*(.*)$/i);

  if (add) {
    const detail = parseDetails(add[1]);

    if (!detail) {
      return `Format jadwal belum sesuai. Contoh:\n${usage}`;
    }

    const id = schedules.add(detail);

    return [
      "Jadwal berhasil ditambahkan!",
      "",
      `ID: ${id}`,
      detail.title,
      `${days[detail.weekday - 1]} ${detail.start}–${detail.end}`,
      `Lokasi: ${detail.location}`,
      "",
      "Aku akan mengingatkan pada H-3, H-2, H-1, H-12 jam, dan H-30 menit sebelum jadwal.",
    ].join("\n");
  }

  const edit = input.match(/^\/jadwal\s+ubah\s+(\d+)\s*\|\s*(.*)$/i);

  if (edit) {
    const detail = parseDetails(edit[2]);

    if (!validId(edit[1]) || !detail) {
      return "Format perubahan belum sesuai.\n/jadwal ubah 1 | kuliah | Nama Kegiatan | Senin | 07:30 | 09:30 | Lokasi";
    }

    const updated = schedules.edit(Number(edit[1]), detail);

    return updated
      ? `Jadwal #${edit[1]} berhasil diubah menjadi ${detail.title}, ${days[detail.weekday - 1]} pukul ${detail.start}.`
      : "Jadwal tidak ditemukan.";
  }

  const remove = input.match(/^\/jadwal\s+hapus\s+(\d+)$/i);

  if (remove) {
    if (!validId(remove[1])) {
      return "ID jadwal tidak valid.";
    }

    return schedules.delete(Number(remove[1]))
      ? `Jadwal #${remove[1]} berhasil dihapus.`
      : "ID jadwal tidak ditemukan.";
  }

  if (/^\/jadwal\b/i.test(input)) {
    return `Perintah jadwal belum sesuai. Contoh:\n${usage}\n/jadwal ubah 1 | kuliah | Nama Kegiatan | Senin | 07:30 | 09:30 | Lokasi\n/jadwal hapus 1`;
  }

  return null;
}
