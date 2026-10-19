import { tasks } from "../repositories/tasks.js";
import { dateLabel, parseDeadline } from "../time.js";

const usage = "/tugas tambah | Mata Kuliah | Nama Tugas | DD-MM-YYYY HH:mm";

const validId = (raw) =>
  /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && Number(raw) > 0;

function parseDetails(text) {
  const values = text.split("|").map((value) => value.trim());

  if (values.length !== 3 || values.some((value) => !value)) {
    return null;
  }

  const [course, title, date] = values;
  const dueAt = parseDeadline(date);

  if (
    course.length > 80 ||
    title.length > 160 ||
    !dueAt ||
    dueAt <= Date.now()
  ) {
    return null;
  }

  return { course, title, dueAt };
}

export function listTasks() {
  const rows = tasks.active();

  if (!rows.length) {
    return "Belum ada deadline tugas yang aktif. Kamu bisa menambahkannya dengan /tugas tambah.";
  }

  const detail = rows.slice(0, 20).map((task) => {
    const status = task.due_at < Date.now() ? "TERLAMBAT" : "Belum selesai";

    return `[${task.id}] ${task.course} — ${task.title}\nDeadline: ${dateLabel(task.due_at)}\nStatus: ${status}`;
  });

  return `DAFTAR DEADLINE (${rows.length})\n\n${detail.join("\n\n")}${rows.length > 20 ? "\n\nMasih ada tugas lainnya." : ""}`;
}

export function handleTasks(input) {
  if (/^\/(tugas|deadline|prioritas)$/.test(input)) {
    return listTasks();
  }

  const add = input.match(/^\/(?:tugas\s+tambah|tambah)\s*\|\s*(.*)$/i);

  if (add) {
    const detail = parseDetails(add[1]);

    if (!detail) {
      return `Format tugas belum sesuai. Coba:\n${usage}`;
    }

    const id = tasks.add(detail.course, detail.title, detail.dueAt);

    return [
      "Siap, tugas berhasil dicatat.",
      "",
      `ID: ${id}`,
      `Mata kuliah: ${detail.course}`,
      `Tugas: ${detail.title}`,
      `Deadline: ${dateLabel(detail.dueAt)}`,
      "",
      "Pengingat H-3, H-2, H-1, H-12 jam, dan H-30 menit sudah disiapkan.",
    ].join("\n");
  }

  const edit = input.match(/^\/tugas\s+ubah\s+(\d+)\s*\|\s*(.*)$/i);

  if (edit) {
    const detail = parseDetails(edit[2]);

    if (!validId(edit[1]) || !detail) {
      return "Format: /tugas ubah 1 | Basis Data | Revisi ERD | 28-10-2026 23:59";
    }

    const item = tasks.get(Number(edit[1]));

    if (!item || item.completed_at !== null) {
      return "Tugas tidak ditemukan atau sudah selesai.";
    }

    tasks.edit(item.id, detail.course, detail.title, detail.dueAt);

    return `Tugas #${item.id} berhasil diperbarui. Deadline terbaru: ${dateLabel(detail.dueAt)}.`;
  }

  const finish = input.match(/^\/(?:tugas\s+selesai|selesai)\s+(\d+)$/i);

  if (finish) {
    if (!validId(finish[1])) {
      return "ID tugas tidak valid.";
    }

    return tasks.finish(Number(finish[1]))
      ? `Oke, tugas #${finish[1]} sudah selesai. Pengingatnya dihentikan.`
      : "Tugas tersebut tidak ditemukan atau sudah selesai.";
  }

  const remove = input.match(/^\/tugas\s+hapus\s+(\d+)$/i);

  if (remove) {
    if (!validId(remove[1])) {
      return "ID tugas tidak valid.";
    }

    return tasks.delete(Number(remove[1]))
      ? `Tugas #${remove[1]} telah dihapus dari daftar.`
      : "ID tugas tidak ditemukan.";
  }

  if (/^\/(tugas|tambah|selesai)\b/i.test(input)) {
    return `Perintah tugas belum sesuai.\n${usage}\n/tugas ubah 1 | Mata Kuliah | Nama Tugas | DD-MM-YYYY HH:mm\n/tugas selesai 1\n/tugas hapus 1`;
  }

  return null;
}
