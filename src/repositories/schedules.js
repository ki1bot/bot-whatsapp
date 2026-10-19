import { db } from "../database.js";

const one = db.prepare("SELECT * FROM schedules WHERE id = ?");
const all = db.prepare(
  "SELECT * FROM schedules ORDER BY weekday, start_time, id",
);
const forDay = db.prepare(
  "SELECT * FROM schedules WHERE weekday = ? ORDER BY start_time, id",
);
const insert = db.prepare(`
  INSERT INTO schedules (kind, title, weekday, start_time, end_time, location, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const update = db.prepare(`
  UPDATE schedules SET kind = ?, title = ?, weekday = ?, start_time = ?, end_time = ?, location = ?, updated_at = ?
  WHERE id = ?
`);
const remove = db.prepare("DELETE FROM schedules WHERE id = ?");

export const schedules = {
  get: (id) => one.get(id),
  all: () => all.all(),
  forDay: (weekday) => forDay.all(weekday),
  add(item) {
    const timestamp = Date.now();
    return Number(
      insert.run(
        item.kind,
        item.title,
        item.weekday,
        item.start,
        item.end,
        item.location,
        timestamp,
        timestamp,
      ).lastInsertRowid,
    );
  },
  edit(id, item) {
    return (
      update.run(
        item.kind,
        item.title,
        item.weekday,
        item.start,
        item.end,
        item.location,
        Date.now(),
        id,
      ).changes > 0
    );
  },
  delete: (id) => remove.run(id).changes > 0,
};
