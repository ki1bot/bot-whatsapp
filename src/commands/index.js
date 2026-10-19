import { handleTaskCommand, listTasks } from "./tasks.js";
import { handleScheduleCommand, schedulesToday } from "./schedules.js";
import { nowWib } from "../time.js";
import { tasks } from "../repositories/tasks.js";

export function summaryText() {
  const now = nowWib();
  const active = tasks.active();

  const overdue = active.filter((item) => item.due_at < now.toMillis()).length;

  const today = active.filter(
    (item) =>
      item.due_at >= now.toMillis() &&
      item.due_at < now.endOf("day").toMillis(),
  ).length;

  return `Selamat pagi! Berikut ringkasanmu untuk ${now.setLocale("id").toFormat("dd LLLL yyyy")}.\n\nTugas aktif: ${active.length}\nTugas terlambat: ${overdue}\nDeadline hari ini: ${today}\n\n${schedulesToday()}\n\n${listTasks("Prioritas tugas")}`;
}

export function helpText() {
  return [
    "Halo! Aku siap membantu mengatur jadwal dan tugas kuliahmu.",
    "",
    "JADWAL",
    "/jadwal",
    "/hariini",
    "/besok",
    "/jadwal tambah | kuliah | Basis Data | Senin | 08:00 | 10:00 | F4",
    "/jadwal ubah 1 | asisten | Asisten Lab | Selasa | 13:00 | 15:00 | Lab 2",
    "/jadwal hapus 1",
    "",
    "TUGAS",
    "/tugas",
    "/deadline",
    "/tugas tambah | Basis Data | Membuat ERD | 25-10-2026 23:59",
    "/tugas ubah 1 | Basis Data | Revisi ERD | 26-10-2026 20:00",
    "/tugas selesai 1",
    "/tugas hapus 1",
    "",
    "LAINNYA",
    "/ringkasan",
    "/ping",
    "/bantuan",
    "",
    "Jenis jadwal: kuliah, asisten, praktikum, lainnya.",
    "Pesan hanya dibaca dari chat Pesan ke diri sendiri.",
  ].join("\n");
}

export function routeCommand(input) {
  const text = input.trim();
  const lower = text.toLowerCase().replace(/\s+/g, " ");

  if (
    [
      "halo",
      "hai",
      "hi",
      "menu",
      "/menu",
      "/start",
      "/help",
      "/bantuan",
      "bantuan",
    ].includes(lower)
  ) {
    return helpText();
  }

  if (lower === "/ping" || lower === "ping") {
    return `Aku aktif dan siap membantu. Waktu sekarang ${nowWib().toFormat("dd-MM-yyyy HH:mm")} WIB.`;
  }

  if (lower === "/ringkasan" || lower === "ringkasan") {
    return summaryText();
  }

  return (
    handleScheduleCommand(text) ??
    handleTaskCommand(text) ??
    "Maaf, aku belum memahami perintah itu. Kirim /bantuan untuk melihat contoh yang bisa digunakan, ya."
  );
}

export function isCommandCandidate(input) {
  return (
    input.trim().startsWith("/") ||
    /^(halo|hai|hi|menu|bantuan|ping|ringkasan|tugas|lihat tugas|deadline|prioritas|jadwal|jadwal hari ini|jadwal besok|hari ini)$/i.test(
      input.trim(),
    )
  );
}
