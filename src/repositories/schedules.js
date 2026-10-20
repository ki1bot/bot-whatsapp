import { db } from "../database.js";

const getOne = db.prepare("SELECT * FROM schedules WHERE id = ?");
const getAll = db.prepare(
  "SELECT * FROM schedules ORDER BY weekday, start_time, id",
);
const getByDay = db.prepare(
  "SELECT * FROM schedules WHERE weekday = ? ORDER BY start_time, id",
);

const insert = db.prepare(`
  INSERT INTO schedules
    (kind, title, weekday, start_time, end_time, location, room,
     activity_type, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const update = db.prepare(`
  UPDATE schedules
  SET kind = ?, title = ?, weekday = ?, start_time = ?, end_time = ?,
      location = ?, room = ?, activity_type = ?, updated_at = ?
  WHERE id = ?
`);

const remove = db.prepare("DELETE FROM schedules WHERE id = ?");

export const schedules = {
  get: (id) => getOne.get(id),
  all: () => getAll.all(),
  forDay: (weekday) => getByDay.all(weekday),

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
        item.room,
        item.activity_type,
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
        item.room,
        item.activity_type,
        Date.now(),
        id,
      ).changes > 0
    );
  },

  delete: (id) => remove.run(id).changes > 0,
};
