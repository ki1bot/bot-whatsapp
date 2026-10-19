import cron from "node-cron";
import { settings } from "./config.js";
import {
  nowWib,
  fromMillis,
  calendarDaysUntil,
  dateLabel,
  nextScheduleStart,
} from "./time.js";
import { tasks } from "./repositories/tasks.js";
import { schedules } from "./repositories/schedules.js";
import { delivery } from "./repositories/delivery.js";
import { summaryText } from "./commands/index.js";

export function createScheduler(sendText) {
  let running = false;

  async function sendOnce(key, message) {
    if (delivery.wasSent(key)) return;

    await sendText(message);
    delivery.markSent(key);
  }

  async function tick() {
    if (running) return;

    running = true;

    try {
      const now = nowWib();
      const today = now.startOf("day");

      const [summaryHour, summaryMinute] = settings.dailySummaryTime
        .split(":")
        .map(Number);

      const summaryAt = today.set({
        hour: summaryHour,
        minute: summaryMinute,
      });

      for (const item of schedules.all()) {
        const start = nextScheduleStart(item, now);
        const reminder = start.minus({
          minutes: settings.reminderMinutes,
        });

        if (
          now.toMillis() < reminder.toMillis() ||
          now.toMillis() >= start.toMillis()
        ) {
          continue;
        }

        const key = `schedule:${item.id}:${item.updated_at}:${start.toISODate()}`;

        const message = `Pengingat jadwal!\n\n${item.title}\nJenis: ${item.kind}\nMulai: ${start.setLocale("id").toFormat("cccc, dd LLLL yyyy HH:mm")} WIB\nSelesai: ${item.end_time} WIB\nTempat: ${item.location}\n\nKegiatan dimulai dalam waktu kurang dari ${settings.reminderMinutes} menit. Semangat!`;

        await sendOnce(key, message);
      }

      for (const item of tasks.active()) {
        const day = calendarDaysUntil(item.due_at, now);

        if (![3, 1, 0].includes(day) || item.due_at <= now.toMillis()) {
          continue;
        }

        const due = fromMillis(item.due_at);

        const eligibleAt =
          day === 0 && due.hour < 7 ? today : today.set({ hour: 7 });

        if (now.toMillis() < eligibleAt.toMillis()) {
          continue;
        }

        const key = `task:${item.id}:${item.due_at}:H${day}`;

        const message = `Pengingat deadline ${day === 0 ? "hari ini" : `H-${day}`}!\n\nMata kuliah: ${item.course}\nTugas: ${item.title}\nBatas pengumpulan: ${dateLabel(item.due_at)}\n\nCek /tugas, lalu tandai /tugas selesai ${item.id} jika sudah dikumpulkan.`;

        await sendOnce(key, message);
      }

      if (now.toMillis() >= summaryAt.toMillis()) {
        await sendOnce(`summary:${now.toISODate()}`, summaryText());
      }

      delivery.cleanup();
    } catch (error) {
      console.error("[PENGINGAT]", error.message);
    } finally {
      running = false;
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
