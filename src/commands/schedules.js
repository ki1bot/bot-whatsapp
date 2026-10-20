import { schedules } from "../repositories/schedules.js";
import { days, isClock, nowWib, parseDay } from "../time.js";

const kinds = ["kuliah", "asisten", "praktikum", "lainnya"];
const usage =
  "/jadwal tambah | asisten | Asisten Laboratorium Informatika | Senin | 07:30 | 09:30 | Kalimalang | Online | Asisten Ngajar Online/Daring";
const validId = (raw) =>
  /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0;

function defaultActivityType(kind, title, room) {
  if (kind === "kuliah") return "Mata Kuliah";
  if (kind === "praktikum") return "Praktikum Offline/Luring";

  if (kind === "asisten") {
    if (/jaga/i.test(title)) return "Asisten Jaga/Penilaian";
    if (/online/i.test(room)) return "Asisten Ngajar Online/Daring";
    return "Asisten Ngajar Offline/Luring";
  }

  return "Kegiatan Lainnya";
}

function parseDetails(raw, previous = null) {
  const parts = raw.split("|").map((value) => value.trim());

  if (![6, 7, 8].includes(parts.length) || parts.some((value) => !value)) {
    return null;
  }

  const [kindRaw, title, day, start, end, location, givenRoom, givenType] =
    parts;
  const kind = kindRaw.toLowerCase();
  const weekday = parseDay(day);
  const room = givenRoom ?? previous?.room ?? "-";

  const activity_type =
    givenType ??
    (previous?.kind === kind && previous?.activity_type !== "-"
      ? previous.activity_type
      : defaultActivityType(kind, title, room));

  if (
    !kinds.includes(kind) ||
    !weekday ||
    !isClock(start) ||
    !isClock(end) ||
    start >= end
  ) {
    return null;
  }

  if (
    title.length > 160 ||
    location.length > 120 ||
    room.length > 80 ||
    activity_type.length > 120
  ) {
    return null;
  }

  return {
    kind,
    title,
    weekday,
    start,
    end,
    location,
    room,
    activity_type,
  };
}

export function listSchedules(weekday = null) {
  const rows = weekday ? schedules.forDay(weekday) : schedules.all();

  const label = weekday ? days[weekday - 1] : "Mingguan";

  if (!rows.length) {
    return `Belum ada jadwal untuk ${label}.`;
  }

  const details = rows.map((item) =>
    [
      `[${item.id}] ${days[item.weekday - 1]} ${item.start_time}–${item.end_time} WIB`,
      `Kegiatan: ${item.title}`,
      `Lokasi: ${item.location}`,
      `Ruang: ${item.room}`,
      `Jenis: ${item.activity_type}`,
    ].join("\n"),
  );

  return `JADWAL ${label.toUpperCase()} (${rows.length})\n\n${details.join("\n\n")}`;
}

export function handleSchedules(input) {
  const lower = input.trim().toLowerCase().replace(/\s+/g, " ");

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
      `Kegiatan: ${detail.title}`,
      `Hari: ${days[detail.weekday - 1]}`,
      `Jam: ${detail.start}–${detail.end} WIB`,
      `Lokasi: ${detail.location}`,
      `Ruang: ${detail.room}`,
      `Jenis: ${detail.activity_type}`,
      "",
      "Pengingat H-3, H-2, H-1, H-12 jam, dan H-30 menit aktif.",
    ].join("\n");
  }

  const edit = input.match(/^\/jadwal\s+ubah\s+(\d+)\s*\|\s*(.*)$/i);

  if (edit) {
    if (!validId(edit[1])) {
      return "ID jadwal tidak valid.";
    }

    const id = Number(edit[1]);
    const previous = schedules.get(id);

    if (!previous) {
      return `Jadwal #${id} tidak ditemukan. Periksa ID melalui /jadwal.`;
    }

    const detail = parseDetails(edit[2], previous);

    if (!detail) {
      return `Format perubahan belum sesuai. Contoh:\n/jadwal ubah ${id} | asisten | Asisten Laboratorium Informatika | Senin | 07:30 | 09:30 | Kalimalang | Online | Asisten Ngajar Online/Daring`;
    }

    return schedules.edit(id, detail)
      ? `Jadwal #${id} berhasil diubah.\n\n${detail.title}\n${days[detail.weekday - 1]} ${detail.start}–${detail.end} WIB\nLokasi: ${detail.location}\nRuang: ${detail.room}\nJenis: ${detail.activity_type}`
      : "Jadwal tidak berhasil diubah.";
  }

  const remove = input.match(/^\/jadwal\s+hapus\s+(\d+)$/i);

  if (remove) {
    if (!validId(remove[1])) {
      return "ID jadwal tidak valid.";
    }

    return schedules.delete(Number(remove[1]))
      ? `Jadwal #${remove[1]} berhasil dihapus.`
      : "Jadwal tidak ditemukan.";
  }

  if (/^\/jadwal\b/i.test(input)) {
    return `Perintah jadwal belum sesuai. Contoh:\n${usage}\n/jadwal ubah 1 | asisten | Asisten Laboratorium Informatika | Senin | 07:30 | 09:30 | Kalimalang | Online | Asisten Ngajar Online/Daring\n/jadwal hapus 1`;
  }

  return null;
}
