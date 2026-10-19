import { tasks } from "../repositories/tasks.js";
import { calendarDaysUntil, dateLabel, parseDeadline } from "../time.js";

function validId(raw) {
  const id = Number(raw);

  return /^\d+$/.test(String(raw)) && Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function parseFields(raw, count) {
  const parts = raw.split("|").map((value) => value.trim());

  return parts.length === count && parts.every(Boolean) ? parts : null;
}

function describeTask(task, index) {
  const days = calendarDaysUntil(task.due_at);
  const overdue = task.due_at < Date.now();

  const status = overdue
    ? "Terlambat"
    : days === 0
      ? "Hari ini"
      : days === 1
        ? "Besok"
        : `H-${days}`;

  return `${index}. [${task.id}] ${task.course}\n${task.title}\n${dateLabel(task.due_at)} (${status})`;
}

export function listTasks(heading = "Tugas yang belum selesai") {
  const active = tasks.active();

  if (!active.length) {
    return `Baik, ${heading.toLowerCase()} belum ada. Kamu bisa menambahkannya dengan /tugas tambah.`;
  }

  return `${heading}\n\n${active.slice(0, 15).map(describeTask).join("\n\n")}\n\nTotal: ${active.length} tugas${active.length > 15 ? "\nTampilkan daftar yang lebih singkat atau selesaikan sebagian tugas." : ""}`;
}

export function handleTaskCommand(input) {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (["/tugas", "tugas", "lihat tugas"].includes(lower)) {
    return listTasks();
  }

  if (["/deadline", "deadline", "/prioritas", "prioritas"].includes(lower)) {
    return listTasks("Deadline terdekat");
  }

  const add = trimmed.match(/^\/(?:tugas\s+tambah|tambah)\s*\|/i);

  if (add) {
    const fields = parseFields(trimmed.slice(add[0].length), 3);

    if (!fields) {
      return "Formatnya: /tugas tambah | Mata Kuliah | Nama Tugas | 25-10-2026 23:59";
    }

    const [course, title, date] = fields;

    if (course.length > 80 || title.length > 160) {
      return "Nama mata kuliah maksimal 80 karakter dan judul tugas maksimal 160 karakter.";
    }

    const dueAt = parseDeadline(date);

    if (!dueAt || dueAt <= Date.now()) {
      return "Tanggal deadline belum valid atau sudah lewat. Gunakan DD-MM-YYYY HH:mm di masa depan.";
    }

    const id = tasks.add(course, title, dueAt);

    return `Siap, tugas berhasil dicatat!\n\nID: ${id}\nMata kuliah: ${course}\nTugas: ${title}\nDeadline: ${dateLabel(dueAt)}\n\nAku akan mengingatkanmu pada H-3, H-1, dan hari deadline.`;
  }

  const edit = trimmed.match(/^\/tugas\s+ubah\s+(\d+)\s*\|/i);

  if (edit) {
    const id = validId(edit[1]);
    const fields = parseFields(trimmed.slice(edit[0].length), 3);

    if (!id || !fields) {
      return "Formatnya: /tugas ubah 1 | Mata Kuliah | Nama Tugas | 25-10-2026 23:59";
    }

    const [course, title, date] = fields;

    if (course.length > 80 || title.length > 160) {
      return "Mata kuliah maksimal 80 karakter dan judul tugas maksimal 160 karakter.";
    }

    const dueAt = parseDeadline(date);

    if (!dueAt || dueAt <= Date.now()) {
      return "Deadline harus valid dan berada di masa depan.";
    }

    const found = tasks.get(id);

    if (!found) {
      return `Tugas dengan ID ${id} tidak ditemukan.`;
    }

    if (found.completed_at !== null) {
      return `Tugas ${id} sudah selesai. Tidak dapat diubah.`;
    }

    tasks.edit(id, course, title, dueAt);

    return `Berhasil! Tugas ${id} sudah diperbarui.\n\n${course} — ${title}\nDeadline baru: ${dateLabel(dueAt)}`;
  }

  const finish = trimmed.match(/^\/(?:tugas\s+selesai|selesai)\s+(\d+)$/i);

  if (finish) {
    const id = validId(finish[1]);
    const found = id && tasks.get(id);

    if (!found) {
      return "ID tugas tidak ditemukan. Cek lagi melalui /tugas.";
    }

    if (found.completed_at !== null) {
      return `Tugas ${id} sudah selesai sebelumnya.`;
    }

    tasks.finish(id);

    return `Bagus, tugas "${found.title}" sudah ditandai selesai. Pengingat selanjutnya dinonaktifkan.`;
  }

  const remove = trimmed.match(/^\/tugas\s+hapus\s+(\d+)$/i);

  if (remove) {
    const id = validId(remove[1]);

    if (!id || !tasks.delete(id)) {
      return "Tugas tidak ditemukan. Periksa ID melalui /tugas.";
    }

    return `Tugas ${id} berhasil dihapus. Pengingat tugas tersebut tidak akan dikirim lagi.`;
  }

  if (/^\/(?:tugas|tambah|selesai)\b/i.test(trimmed)) {
    return "Aku belum memahami formatnya. Contoh:\n/tugas tambah | Basis Data | Membuat ERD | 25-10-2026 23:59\n/tugas ubah 1 | Basis Data | Revisi ERD | 26-10-2026 20:00\n/tugas selesai 1\n/tugas hapus 1";
  }

  return null;
}
