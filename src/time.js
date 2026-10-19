import { DateTime } from "luxon";
import { settings } from "./config.js";

export const weekdays = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export function nowWib() {
  return DateTime.now().setZone(settings.timezone);
}

export function fromMillis(milliseconds) {
  return DateTime.fromMillis(milliseconds, { zone: settings.timezone });
}

export function dateLabel(milliseconds) {
  return `${fromMillis(milliseconds).setLocale("id").toFormat("dd LLLL yyyy, HH:mm")} WIB`;
}

export function parseDeadline(input) {
  if (!/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(input)) return null;

  const value = DateTime.fromFormat(input, "dd-MM-yyyy HH:mm", {
    zone: settings.timezone,
  });

  return value.isValid && value.toFormat("dd-MM-yyyy HH:mm") === input
    ? value.toMillis()
    : null;
}

export function parseWeekday(input) {
  const cleaned = input.trim().toLowerCase();
  const index = weekdays.findIndex((day) => day.toLowerCase() === cleaned);

  if (index !== -1) return index + 1;
  if (/^[1-7]$/.test(cleaned)) return Number(cleaned);

  return null;
}

export function validClock(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function calendarDaysUntil(milliseconds, now = nowWib()) {
  return Math.round(
    fromMillis(milliseconds).startOf("day").diff(now.startOf("day"), "days")
      .days,
  );
}

export function nextScheduleStart(schedule, now = nowWib()) {
  const [hour, minute] = schedule.start_time.split(":").map(Number);
  const difference = (schedule.weekday - now.weekday + 7) % 7;

  let occurrence = now
    .startOf("day")
    .plus({ days: difference })
    .set({ hour, minute });

  if (occurrence.toMillis() <= now.toMillis()) {
    occurrence = occurrence.plus({ days: 7 });
  }

  return occurrence;
}
