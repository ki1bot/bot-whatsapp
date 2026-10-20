import cron from "node-cron";
import { settings } from "./config.js";
import { nowWib, nextOccurrence, dateLabel, days } from "./time.js";
import { schedules } from "./repositories/schedules.js";
import { tasks } from "./repositories/tasks.js";
import { delivery } from "./repositories/delivery.js";
import { summaryText } from "./commands/index.js";

function offsetName(hours) {
  if (hours === 0.5) return "H-30 menit";
  if (hours === 12) return "H-12 jam";
  return `H-${hours / 24} hari`;
}

function timeOnDay(now, clock) {
  const [hour, minute] = clock.split(":").map(Number);
  return now.startOf("day").set({ hour, minute }).toMillis();
}

export function createScheduler(sendToNumber) {
  let busy = false;

  async function sendReminder(baseKey, text) {
    for (const number of settings.allowed) {
      const key = `v3:${baseKey}:${number}`;

      if (delivery.sent(key)) continue;

      try {
        await sendToNumber(number, text);
        delivery.mark(key);

        console.log(`[NOTIFIKASI] ${baseKey} -> ${number.slice(0, 4)}****`);
      } catch (error) {
        console.error(
          `[NOTIFIKASI] Gagal ke ${number.slice(0, 4)}****: ${error.message}`,
        );
      }
    }
  }

  async function tick() {
    if (busy) return;

    busy = true;

    try {
      const now = nowWib();
      const current = now.toMillis();
      const grace = 60 * 60 * 1000;

      for (const schedule of schedules.all()) {
        const starts = nextOccurrence(schedule, now);
        const startMs = starts.toMillis();

        for (const hours of settings.reminderOffsets) {
          const reminderAt = startMs - hours * 3600000;

          if (
            current < reminderAt ||
            current >= reminderAt + grace ||
            current >= startMs
          ) {
            continue;
          }

          const message = [
            `PENGINGAT JADWAL ${offsetName(hours)}`,
            "",
            `Kegiatan: ${schedule.title}`,
            `Hari: ${days[schedule.weekday - 1]}`,
            `Jam: ${schedule.start_time}–${schedule.end_time} WIB`,
            `Lokasi: ${schedule.location}`,
            `Ruang: ${schedule.room}`,
            `Jenis: ${schedule.activity_type}`,
            `Mulai: ${dateLabel(startMs)}`,
            "",
            "Jangan lupa persiapkan kegiatanmu, ya.",
          ].join("\n");

          await sendReminder(
            `schedule:${schedule.id}:${schedule.updated_at}:${starts.toISODate()}:${hours}`,
            message,
          );
        }
      }

      for (const task of tasks.active()) {
        if (task.due_at <= current) continue;

        for (const hours of settings.reminderOffsets) {
          const reminderAt = task.due_at - hours * 3600000;

          if (current < reminderAt || current >= reminderAt + grace) {
            continue;
          }

          const message = [
            `PENGINGAT DEADLINE ${offsetName(hours)}`,
            "",
            `Mata kuliah: ${task.course}`,
            `Tugas: ${task.title}`,
            `Deadline: ${dateLabel(task.due_at)}`,
            "",
            `Kalau sudah dikumpulkan, kirim /tugas selesai ${task.id}.`,
          ].join("\n");

          await sendReminder(
            `task:${task.id}:${task.due_at}:${hours}`,
            message,
          );
        }
      }

      const summaryAt = timeOnDay(now, settings.dailySummaryTime);

      if (current >= summaryAt && current < summaryAt + grace) {
        await sendReminder(`summary:${now.toISODate()}`, summaryText());
      }

      const streakAt = timeOnDay(now, settings.tiktokStreakTime);

      if (current >= streakAt && current < streakAt + grace) {
        await sendReminder(
          `tiktok-streak:${now.toISODate()}`,
          [
            "PENGINGAT STREAK TIKTOK",
            "",
            `Halo! Sudah pukul ${settings.tiktokStreakTime} WIB.`,
            "Jangan lupa cek streak api TikTok dan lakukan interaksi yang diperlukan supaya tetap menyala.",
            "",
            "Kalau sudah, aman! Sampai jumpa besok.",
          ].join("\n"),
        );
      }

      delivery.cleanup();
    } catch (error) {
      console.error("[SCHEDULER]", error.message);
    } finally {
      busy = false;
    }
  }

  const job = cron.schedule("* * * * *", () => void tick(), {
    timezone: settings.timezone,
  });

  return {
    tick,
    stop: () => job.stop(),
  };
}
