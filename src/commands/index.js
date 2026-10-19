import { nowWib, dateLabel } from "../time.js";
import { settings } from "../config.js";
import { tasks } from "../repositories/tasks.js";
import { listTasks, handleTasks } from "./tasks.js";
import { listSchedules, handleSchedules } from "./schedules.js";
import { handleInfoCommand } from "./info.js";

export function helpText() {
  const exampleDate = nowWib().plus({ days: 14 }).toFormat("dd-MM-yyyy");

  return [
    "Halo! Aku bot pengingat jadwal dan deadline kamu.",
    "",
    "INFORMASI DAN PANDUAN",
    "/info",
    "/info jadwal",
    "/info tugas",
    "/info tambah",
    "/info ubah",
    "/info hapus",
    "",
    "JADWAL",
    "/jadwal",
    "/hariini",
    "/besok",
    "/jadwal senin",
    "/jadwal tambah | asisten | Jaga Lab | Senin | 07:30 | 09:30 | Tambun",
    "/jadwal ubah 1 | kuliah | Basis Data | Selasa | 10:00 | 12:00 | F4",
    "/jadwal hapus 1",
    "",
    "DEADLINE",
    "/tugas",
    "/deadline",
    `/tugas tambah | Basis Data | Membuat ERD | ${exampleDate} 23:59`,
    `/tugas ubah 1 | Basis Data | Revisi ERD | ${exampleDate} 23:59`,
    "/tugas selesai 1",
    "/tugas hapus 1",
    "",
    "LAINNYA",
    "/ringkasan",
    "/ping",
    "/bantuan",
    "",
    "PENGINGAT OTOMATIS",
    "Jadwal dan tugas: H-3, H-2, H-1, H-12 jam, dan H-30 menit.",
    `Ringkasan harian: ${settings.dailySummaryTime} WIB.`,
    `Streak api TikTok: setiap hari pukul ${settings.tiktokStreakTime} WIB.`,
    "",
  ].join("\n");
}

export function summaryText() {
  const now = nowWib();
  const active = tasks.active();

  const overdue = active.filter((item) => item.due_at < now.toMillis()).length;

  const deadlinesToday = active.filter(
    (item) =>
      item.due_at >= now.toMillis() &&
      item.due_at <= now.endOf("day").toMillis(),
  ).length;

  const nearest = active[0];

  return [
    `RINGKASAN ${now.setLocale("id").toFormat("dd LLLL yyyy")}`,
    `Tugas belum selesai: ${active.length}`,
    `Tugas terlambat: ${overdue}`,
    `Deadline hari ini: ${deadlinesToday}`,
    nearest
      ? `Deadline terdekat: ${nearest.title} (${dateLabel(nearest.due_at)})`
      : "Tidak ada deadline aktif.",
    "",
    listSchedules(now.weekday),
    "",
    listTasks(),
  ].join("\n");
}

export function routeCommand(text) {
  const input = text.trim();
  const lower = input.toLowerCase().replace(/\s+/g, " ");

  if (
    [
      "halo",
      "hai",
      "hi",
      "menu",
      "/menu",
      "/start",
      "/help",
      "bantuan",
      "/bantuan",
    ].includes(lower)
  ) {
    return helpText();
  }

  if (lower === "/ping") {
    return `Halo! Aku aktif dan siap membantu. Sekarang ${nowWib().toFormat("dd-MM-yyyy HH:mm")} WIB.`;
  }

  if (lower === "/ringkasan") {
    return summaryText();
  }

  const infoAnswer = handleInfoCommand(input);

  if (infoAnswer !== null) {
    return infoAnswer;
  }

  const scheduleAnswer = handleSchedules(input);

  if (scheduleAnswer !== null) {
    return scheduleAnswer;
  }

  const taskAnswer = handleTasks(input);

  if (taskAnswer !== null) {
    return taskAnswer;
  }

  if (input.startsWith("/")) {
    return "Maaf, perintah itu belum aku kenal. Ketik /bantuan untuk melihat perintah yang tersedia atau /info untuk panduan pengelolaan data.";
  }

  return null;
}
