import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
config({ path: join(root, ".env"), quiet: true });

export function normalizePhone(value) {
  let phone = String(value ?? "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
  return phone;
}

const phone = normalizePhone(process.env.WHATSAPP_NUMBER);
const allowed = [
  ...new Set(
    (process.env.ALLOWED_NUMBERS ?? "")
      .split(",")
      .map(normalizePhone)
      .filter(Boolean),
  ),
];

const dailySummaryTime = process.env.DAILY_SUMMARY_TIME ?? "07:00";
const tiktokStreakTime = process.env.TIKTOK_STREAK_TIME ?? "22:00";
const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

if (!/^62[1-9]\d{7,11}$/.test(phone)) {
  throw new Error("WHATSAPP_NUMBER tidak valid. Gunakan format 628xxxxxxxxxx.");
}

if (
  allowed.length !== 2 ||
  allowed.some((number) => !/^62[1-9]\d{7,11}$/.test(number))
) {
  throw new Error(
    "ALLOWED_NUMBERS harus berisi tepat dua nomor WhatsApp yang valid.",
  );
}

if (allowed.includes(phone)) {
  throw new Error("Nomor bot harus berbeda dari kedua nomor yang diizinkan.");
}

if (!clockPattern.test(dailySummaryTime)) {
  throw new Error("DAILY_SUMMARY_TIME harus dalam format HH:mm.");
}

if (!clockPattern.test(tiktokStreakTime)) {
  throw new Error("TIKTOK_STREAK_TIME harus dalam format HH:mm.");
}

const authDirectory = join(root, "auth", phone);
const dataDirectory = join(root, "data");

mkdirSync(authDirectory, { recursive: true, mode: 0o700 });
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });

export const settings = {
  root,
  phone,
  allowed,
  authDirectory,
  dataDirectory,
  timezone: "Asia/Jakarta",
  dailySummaryTime,
  tiktokStreakTime,
  reminderOffsets: [72, 48, 24, 12, 0.5],
};
