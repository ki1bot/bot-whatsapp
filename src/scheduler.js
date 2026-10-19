import cron from "node-cron";
import { settings } from "./config.js";
import { nowWib, nextOccurrence, dateLabel, days } from "./time.js";
import { schedules } from "./repositories/schedules.js";
import { tasks } from "./repositories/tasks.js";
import { delivery } from "./repositories/delivery.js";
import { summaryText } from "./commands/index.js";

function offsetName(hours) {
  return hours === 12 ? "H-12 jam" : `H-${hours / 24} hari`;
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
        for (const hours of settings.reminderOffsets) {
          const reminder = starts.minus({ hours }).toMillis();
          if (current < reminder || current >= reminder + grace) continue;
          const message = [
            `PENGINGAT JADWAL ${offsetName(hours)}`,
            "",
            `Kegiatan: ${schedule.title}`,
            `Jenis: ${schedule.kind}`,
            `Hari: ${days[schedule.weekday - 1]}`,
            `Waktu: ${schedule.start_time}–${schedule.end_time} WIB`,
            `Lokasi: ${schedule.location}`,
            `Mulai: ${dateLabel(starts.toMillis())}`,
            "",
            "Persiapkan keperluan kegiatanmu, ya.",
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
          const reminder = task.due_at - hours * 3600000;
          if (current < reminder || current >= reminder + grace) continue;
          const message = [
            `PENGINGAT DEADLINE ${offsetName(hours)}`,
            "",
            `Mata kuliah: ${task.course}`,
            `Tugas: ${task.title}`,
            `Deadline: ${dateLabel(task.due_at)}`,
            "",
            `Jika sudah dikumpulkan, kirim /tugas selesai ${task.id}.`,
          ].join("\n");
          await sendReminder(
            `task:${task.id}:${task.due_at}:${hours}`,
            message,
          );
        }
      }

      const [hour, minute] = settings.dailySummaryTime.split(":").map(Number);
      const summaryAt = now.startOf("day").set({ hour, minute }).toMillis();
      if (current >= summaryAt && current < summaryAt + grace) {
        await sendReminder(`summary:${now.toISODate()}`, summaryText());
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
  return { tick, stop: () => job.stop() };
}
