import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnv({ path: join(root, ".env"), quiet: true });

const phone = (process.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
const reminderMinutes = Number(process.env.SCHEDULE_REMINDER_MINUTES ?? 30);
const dailySummaryTime = process.env.DAILY_SUMMARY_TIME ?? "07:00";

if (!/^\d{10,15}$/.test(phone)) {
  throw new Error(
    "WHATSAPP_NUMBER harus berupa nomor internasional, misalnya 6281234567890.",
  );
}

if (
  !Number.isInteger(reminderMinutes) ||
  reminderMinutes < 1 ||
  reminderMinutes > 1440
) {
  throw new Error(
    "SCHEDULE_REMINDER_MINUTES harus bilangan bulat antara 1 dan 1440.",
  );
}

if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dailySummaryTime)) {
  throw new Error("DAILY_SUMMARY_TIME harus dalam format HH:mm.");
}

const authDirectory = join(root, "auth", phone);
const dataDirectory = join(root, "data");

mkdirSync(authDirectory, { recursive: true, mode: 0o700 });
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });

export const settings = {
  root,
  phone,
  authDirectory,
  dataDirectory,
  timezone: "Asia/Jakarta",
  reminderMinutes,
  dailySummaryTime,
};
