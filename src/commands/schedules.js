import { schedules } from "../repositories/schedules.js";
import { nowWib, parseWeekday, validClock, weekdays } from "../time.js";

const kinds = ["kuliah", "asisten", "praktikum", "lainnya"];

function validId(raw) {
  const id = Number(raw);

  return /^\d+$/.test(String(raw)) && Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function parseScheduleFields(raw) {
  const fields = raw.split("|").map((value) => value.trim());

  if (fields.length !== 6 || fields.some((value) => !value)) {
    return {
      error:
        "Format: /jadwal tambah | kuliah | Nama Kegiatan | Senin | 08:00 | 10:00 | Ruang F4",
    };
  }

  const [kindRaw, title, dayRaw, start, end, location] = fields;
  const kind = kindRaw.toLowerCase();
  const weekday = parseWeekday(dayRaw);

  if (!kinds.includes(kind)) {
    return {
      error: "Jenis jadwal harus kuliah, asisten, praktikum, atau lainnya.",
    };
  }

  if (!weekday) {
    return {
      error: "Nama hari harus Senin sampai Minggu atau angka 1 sampai 7.",
    };
  }

  if (!validClock(start) || !validClock(end) || end <= start) {
    return {
      error:
        "Jam harus HH:mm, dan jam selesai harus setelah jam mulai pada hari yang sama.",
    };
  }

  if (title.length > 160 || location.length > 120) {
    return {
      error:
        "Nama kegiatan maksimal 160 karakter dan lokasi maksimal 120 karakter.",
    };
  }

  return {
    value: {
      kind,
      title,
      weekday,
      start,
      end,
      location,
    },
  };
}

function formatSchedule(item, index) {
  return `${index}. [${item.id}] ${item.title}\n${item.kind.toUpperCase()} • ${weekdays[item.weekday - 1]} ${item.start_time}–${item.end_time}\nLokasi: ${item.location}`;
}

export function listSchedules(day = null, label = "Jadwal mingguan") {
  const rows = day ? schedules.forDay(day) : schedules.all();

  if (!rows.length) {
    return `${label} belum ada. Tambahkan lewat /jadwal tambah.`;
  }

  return `${label}\n\n${rows.slice(0, 25).map(formatSchedule).join("\n\n")}${rows.length > 25 ? `\n\nMasih ada ${rows.length - 25} jadwal lainnya.` : ""}`;
}

export function schedulesToday() {
  return listSchedules(nowWib().weekday, "Jadwal hari ini");
}

export function schedulesTomorrow() {
  return listSchedules(nowWib().plus({ days: 1 }).weekday, "Jadwal besok");
}

export function handleScheduleCommand(input) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (["/jadwal", "/jadwal minggu", "jadwal"].includes(lower)) {
    return listSchedules();
  }

  if (
    ["/hariini", "hari ini", "jadwal hari ini", "/jadwal hari ini"].includes(
      lower,
    )
  ) {
    return schedulesToday();
  }

  if (["/besok", "jadwal besok", "/jadwal besok"].includes(lower)) {
    return schedulesTomorrow();
  }

  const add = trimmed.match(/^\/jadwal\s+tambah\s*\|/i);

  if (add) {
    const result = parseScheduleFields(trimmed.slice(add[0].length));

    if (result.error) {
      return result.error;
    }

    const id = schedules.add(result.value);

    return `Jadwal berhasil ditambahkan!\n\nID: ${id}\n${result.value.title}\nJenis: ${result.value.kind}\nHari: ${weekdays[result.value.weekday - 1]}\nWaktu: ${result.value.start}–${result.value.end}\nLokasi: ${result.value.location}\n\nAku akan mengingatkanmu sebelum kegiatan dimulai.`;
  }

  const edit = trimmed.match(/^\/jadwal\s+ubah\s+(\d+)\s*\|/i);

  if (edit) {
    const id = validId(edit[1]);
    const result = parseScheduleFields(trimmed.slice(edit[0].length));

    if (!id) {
      return "ID jadwal tidak valid.";
    }

    if (result.error) {
      return result.error;
    }

    if (!schedules.edit(id, result.value)) {
      return `Jadwal ID ${id} tidak ditemukan.`;
    }

    return `Siap, jadwal ${id} sudah diperbarui menjadi ${result.value.title}, ${weekdays[result.value.weekday - 1]} ${result.value.start}–${result.value.end} di ${result.value.location}.`;
  }

  const remove = trimmed.match(/^\/jadwal\s+hapus\s+(\d+)$/i);

  if (remove) {
    const id = validId(remove[1]);

    if (!id || !schedules.delete(id)) {
      return "Jadwal tidak ditemukan. Cek ID melalui /jadwal.";
    }

    return `Jadwal ${id} berhasil dihapus. Pengingat berikutnya tidak akan dikirim.`;
  }

  if (/^\/jadwal\b/i.test(trimmed)) {
    return "Perintah jadwal belum tepat. Coba:\n/jadwal\n/jadwal hari ini\n/jadwal tambah | kuliah | Basis Data | Senin | 08:00 | 10:00 | F4\n/jadwal ubah 1 | praktikum | Basis Data | Selasa | 09:00 | 11:00 | Lab 2\n/jadwal hapus 1";
  }

  return null;
}
