import { settings } from "./src/config.js";
import "./src/database.js";
import { createScheduler } from "./src/scheduler.js";
import { sendToSelf, startWhatsApp } from "./src/whatsapp.js";

const scheduler = createScheduler(sendToSelf);

console.log(`Bot WhatsApp dimulai, zona waktu ${settings.timezone}.`);
startWhatsApp(() => scheduler.tick());

process.on("SIGINT", () => {
  scheduler.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  scheduler.stop();
  process.exit(0);
});
