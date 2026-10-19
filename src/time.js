import { DateTime } from "luxon";
import { settings } from "./config.js";

export const days = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];
export const nowWib = () => DateTime.now().setZone(settings.timezone);
export const atWib = (ms) =>
  DateTime.fromMillis(ms, { zone: settings.timezone });
export const dateLabel = (ms) =>
  `${atWib(ms).setLocale("id").toFormat("dd LLLL yyyy, HH:mm")} WIB`;

export function parseDeadline(value) {
  const dt = DateTime.fromFormat(value, "dd-MM-yyyy HH:mm", {
    zone: settings.timezone,
  });
  return dt.isValid && dt.toFormat("dd-MM-yyyy HH:mm") === value
    ? dt.toMillis()
    : null;
}

export function parseDay(value) {
  const index = days.findIndex(
    (item) => item.toLowerCase() === value.toLowerCase(),
  );
  return index < 0 ? null : index + 1;
}

export function isClock(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function nextOccurrence(schedule, now = nowWib()) {
  const [hour, minute] = schedule.start_time.split(":").map(Number);
  const delta = (schedule.weekday - now.weekday + 7) % 7;
  let next = now.startOf("day").plus({ days: delta }).set({ hour, minute });
  if (next.toMillis() <= now.toMillis()) next = next.plus({ weeks: 1 });
  return next;
}
