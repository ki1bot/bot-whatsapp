import { db } from "../database.js";

const getOne = db.prepare("SELECT * FROM schedules WHERE id = ?");

const listAll = db.prepare(
  "SELECT * FROM schedules ORDER BY weekday, start_time, id",
);

const listForDay = db.prepare(
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
  get: (id) => getOne.get(id),

  all: () => listAll.all(),

  forDay: (weekday) => listForDay.all(weekday),

  add({ kind, title, weekday, start, end, location }) {
    const now = Date.now();

    return Number(
      insert.run(kind, title, weekday, start, end, location, now, now)
        .lastInsertRowid,
    );
  },

  edit(id, { kind, title, weekday, start, end, location }) {
    return (
      update.run(kind, title, weekday, start, end, location, Date.now(), id)
        .changes > 0
    );
  },

  delete(id) {
    return remove.run(id).changes > 0;
  },
};
