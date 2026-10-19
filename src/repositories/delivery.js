import { db } from "../database.js";

const hasNotification = db.prepare(
  "SELECT 1 FROM sent_notifications WHERE notification_key = ?",
);

const markNotification = db.prepare(
  "INSERT OR IGNORE INTO sent_notifications (notification_key, sent_at) VALUES (?, ?)",
);

const insertMessage = db.prepare(
  "INSERT OR IGNORE INTO processed_messages (message_id, processed_at) VALUES (?, ?)",
);

const cleanMessages = db.prepare(
  "DELETE FROM processed_messages WHERE processed_at < ?",
);

export const delivery = {
  wasSent: (key) => Boolean(hasNotification.get(key)),

  markSent(key) {
    markNotification.run(key, Date.now());
  },

  acceptMessage(id) {
    return insertMessage.run(id, Date.now()).changes > 0;
  },

  cleanup() {
    cleanMessages.run(Date.now() - 30 * 86400000);
  },
};
