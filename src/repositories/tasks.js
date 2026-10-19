import { db } from "../database.js";

const one = db.prepare("SELECT * FROM tasks WHERE id = ?");
const active = db.prepare(
  "SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY due_at, id",
);
const insert = db.prepare(
  "INSERT INTO tasks (course, title, due_at, created_at) VALUES (?, ?, ?, ?)",
);
const update = db.prepare(
  "UPDATE tasks SET course = ?, title = ?, due_at = ? WHERE id = ? AND completed_at IS NULL",
);
const done = db.prepare(
  "UPDATE tasks SET completed_at = ? WHERE id = ? AND completed_at IS NULL",
);
const remove = db.prepare("DELETE FROM tasks WHERE id = ?");

export const tasks = {
  get: (id) => one.get(id),
  active: () => active.all(),
  add: (course, title, dueAt) =>
    Number(insert.run(course, title, dueAt, Date.now()).lastInsertRowid),
  edit: (id, course, title, dueAt) =>
    update.run(course, title, dueAt, id).changes > 0,
  finish: (id) => done.run(Date.now(), id).changes > 0,
  delete: (id) => remove.run(id).changes > 0,
};
