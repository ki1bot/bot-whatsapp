import { db } from "../database.js";

const getOne = db.prepare("SELECT * FROM tasks WHERE id = ?");

const listActive = db.prepare(
  "SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY due_at, id",
);

const insert = db.prepare(
  "INSERT INTO tasks (course, title, due_at, created_at) VALUES (?, ?, ?, ?)",
);

const update = db.prepare(
  "UPDATE tasks SET course = ?, title = ?, due_at = ? WHERE id = ? AND completed_at IS NULL",
);

const complete = db.prepare(
  "UPDATE tasks SET completed_at = ? WHERE id = ? AND completed_at IS NULL",
);

const remove = db.prepare("DELETE FROM tasks WHERE id = ?");

export const tasks = {
  get: (id) => getOne.get(id),

  active: () => listActive.all(),

  add(course, title, dueAt) {
    return Number(insert.run(course, title, dueAt, Date.now()).lastInsertRowid);
  },

  edit(id, course, title, dueAt) {
    return update.run(course, title, dueAt, id).changes > 0;
  },

  finish(id) {
    return complete.run(Date.now(), id).changes > 0;
  },

  delete(id) {
    return remove.run(id).changes > 0;
  },
};
