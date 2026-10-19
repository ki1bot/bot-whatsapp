import { db } from "../database.js";

const seen = db.prepare(
  "SELECT 1 FROM sent_notifications WHERE notification_key = ?",
);
const sent = db.prepare(
  "INSERT OR IGNORE INTO sent_notifications (notification_key, sent_at) VALUES (?, ?)",
);
const accepted = db.prepare(
  "INSERT OR IGNORE INTO processed_messages (message_id, processed_at) VALUES (?, ?)",
);
const cleanup = db.prepare(
  "DELETE FROM processed_messages WHERE processed_at < ?",
);

export const delivery = {
  sent: (key) => Boolean(seen.get(key)),
  mark: (key) => sent.run(key, Date.now()),
  accept: (id) => accepted.run(id, Date.now()).changes > 0,
  cleanup: () => cleanup.run(Date.now() - 30 * 86400000),
};
