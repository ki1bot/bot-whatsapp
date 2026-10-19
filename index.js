import { settings } from "./src/config.js";
import { seedSchedules } from "./src/seed.js";
import { createScheduler } from "./src/scheduler.js";
import { startWhatsApp, sendToNumber } from "./src/whatsapp.js";

seedSchedules();
const scheduler = createScheduler(sendToNumber);
console.log(`Bot pengingat aktif. Zona waktu: ${settings.timezone}.`);
startWhatsApp(() => scheduler.tick());

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    scheduler.stop();
    process.exit(0);
  });
}
