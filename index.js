import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import cron from "node-cron";
import { DateTime } from "luxon";
import { config as loadEnv } from "dotenv";
import pino from "pino";
import qrcode from "qrcode-terminal";
import makeWASocket, {
  DisconnectReason,
  areJidsSameUser,
  jidNormalizedUser,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ZONE = "Asia/Jakarta";
const AUTH_DIRECTORY = join(ROOT, "auth");
const DATA_DIRECTORY = join(ROOT, "data");

loadEnv({ path: join(ROOT, ".env") });

const phoneNumber = (process.env.WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

if (!/^[1-9]\d{7,14}$/.test(phoneNumber)) {
  console.error(
    "Isi WHATSAPP_NUMBER di .env dengan kode negara, misalnya 6281234567890.",
  );
  process.exit(1);
}

mkdirSync(AUTH_DIRECTORY, { recursive: true, mode: 0o700 });
mkdirSync(DATA_DIRECTORY, { recursive: true, mode: 0o700 });

const database = new Database(join(DATA_DIRECTORY, "tasks.db"));
database.pragma("journal_mode = WAL");
database.pragma("busy_timeout = 5000");
database.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course TEXT NOT NULL,
    title TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_pending
  ON tasks (completed_at, due_at);

  CREATE TABLE IF NOT EXISTS sent_notifications (
    notification_key TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_messages (
    message_id TEXT PRIMARY KEY,
    processed_at INTEGER NOT NULL
  );
`);

const addTaskStatement = database.prepare(`
  INSERT INTO tasks (course, title, due_at, created_at)
  VALUES (?, ?, ?, ?)
`);

const pendingTasksStatement = database.prepare(`
  SELECT id, course, title, due_at, created_at
  FROM tasks
  WHERE completed_at IS NULL
  ORDER BY due_at ASC, id ASC
`);

const findTaskStatement = database.prepare("SELECT * FROM tasks WHERE id = ?");

const finishTaskStatement = database.prepare(`
  UPDATE tasks SET completed_at = ?
  WHERE id = ? AND completed_at IS NULL
`);

const hasNotificationStatement = database.prepare(`
  SELECT 1 FROM sent_notifications
  WHERE notification_key = ?
`);

const saveNotificationStatement = database.prepare(`
  INSERT OR IGNORE INTO sent_notifications
  (notification_key, sent_at)
  VALUES (?, ?)
`);

const saveProcessedMessageStatement = database.prepare(`
  INSERT OR IGNORE INTO processed_messages
  (message_id, processed_at)
  VALUES (?, ?)
`);

const cleanProcessedMessagesStatement = database.prepare(`
  DELETE FROM processed_messages
  WHERE processed_at < ?
`);

let activeSocket = null;
let reconnectTimer = null;
let schedulerRunning = false;
let stopped = false;

function nowJakarta() {
  return DateTime.now().setZone(ZONE);
}

function dateOf(timestamp) {
  return DateTime.fromMillis(timestamp, { zone: ZONE });
}

function displayDeadline(timestamp) {
  return (
    dateOf(timestamp).setLocale("id").toFormat("dd LLLL yyyy, HH:mm") + " WIB"
  );
}

function dayDistance(timestamp, now = nowJakarta()) {
  return Math.round(
    dateOf(timestamp).startOf("day").diff(now.startOf("day"), "days").days,
  );
}

function taskStatus(task, now = nowJakarta()) {
  if (task.due_at < now.toMillis()) {
    return "TERLAMBAT";
  }

  const days = dayDistance(task.due_at, now);

  if (days === 0) return "Deadline hari ini";
  if (days === 1) return "Deadline besok";

  return `H-${days}`;
}

function formatTask(task, number, now = nowJakarta()) {
  return [
    `${number}. ${task.course} (#${task.id})`,
    `   Tugas: ${task.title}`,
    `   Deadline: ${displayDeadline(task.due_at)}`,
    `   Status: ${taskStatus(task, now)}`,
  ].join("\n");
}

function listTasks() {
  return pendingTasksStatement.all();
}

function taskListText(title, tasks, limit = 12) {
  if (tasks.length === 0) {
    return `${title}\n\nTidak ada tugas yang belum selesai.`;
  }

  const shown = tasks.slice(0, limit);

  const text = shown
    .map((task, index) => formatTask(task, index + 1))
    .join("\n\n");

  const remaining = tasks.length - shown.length;

  return (
    `${title}\n\n${text}\n\nTotal tugas aktif: ${tasks.length}` +
    (remaining > 0 ? `\n${remaining} tugas lainnya belum ditampilkan.` : "")
  );
}

function dailySummary(now = nowJakarta()) {
  const tasks = listTasks();

  const overdue = tasks.filter((task) => task.due_at < now.toMillis()).length;

  const today = tasks.filter(
    (task) =>
      dayDistance(task.due_at, now) === 0 && task.due_at >= now.toMillis(),
  ).length;

  const nextThreeDays = tasks.filter((task) => {
    const distance = dayDistance(task.due_at, now);

    return distance >= 0 && distance <= 3 && task.due_at >= now.toMillis();
  }).length;

  return [
    "RINGKASAN TUGAS HARIAN",
    now.setLocale("id").toFormat("dd LLLL yyyy"),
    "",
    `Belum selesai: ${tasks.length}`,
    `Terlambat: ${overdue}`,
    `Deadline hari ini: ${today}`,
    `Deadline dalam 3 hari: ${nextThreeDays}`,
    "",
    tasks.length
      ? tasks
          .slice(0, 8)
          .map((task, index) => formatTask(task, index + 1, now))
          .join("\n\n")
      : "Tidak ada tugas aktif.",
    tasks.length > 8
      ? `\n${tasks.length - 8} tugas lainnya dapat dilihat melalui /tugas.`
      : "",
  ].join("\n");
}

function helpText() {
  return [
    "KAMPUSTASK BOT",
    "",
    "Perintah yang tersedia:",
    "/tambah | Mata Kuliah | Nama Tugas | DD-MM-YYYY HH:mm",
    "/tugas",
    "/prioritas",
    "/selesai ID",
    "/ringkasan",
    "/bantuan",
    "/ping",
    "",
    "Contoh:",
    "/tambah | Basis Data | Membuat ERD | 25-10-2026 23:59",
    "",
    "Pengingat otomatis: H-3, H-1, dan hari deadline.",
    "Ringkasan harian: 07.00 WIB.",
    "Gunakan chat Pesan ke diri sendiri.",
  ].join("\n");
}

function handleCommand(input) {
  const normalized = input.trim();

  const keyword = normalized.split(/[\s|]/, 1)[0].toLowerCase();

  if (keyword === "/bantuan" || keyword === "/help" || keyword === "/start") {
    return helpText();
  }

  if (keyword === "/ping") {
    return `Bot aktif. Waktu server: ${nowJakarta().toFormat("dd-MM-yyyy HH:mm")} WIB.`;
  }

  if (keyword === "/tambah") {
    const parts = normalized.split("|").map((part) => part.trim());

    if (parts.length !== 4 || parts[0].toLowerCase() !== "/tambah") {
      return "Format tidak sesuai.\n\n/tambah | Mata Kuliah | Nama Tugas | DD-MM-YYYY HH:mm";
    }

    const [, course, title, rawDeadline] = parts;

    if (!course || !title || course.length > 80 || title.length > 160) {
      return "Nama mata kuliah harus 1–80 karakter dan nama tugas 1–160 karakter.";
    }

    if (!/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(rawDeadline)) {
      return "Format deadline harus DD-MM-YYYY HH:mm.\nContoh: 25-10-2026 23:59";
    }

    const deadline = DateTime.fromFormat(rawDeadline, "dd-MM-yyyy HH:mm", {
      zone: ZONE,
    });

    if (
      !deadline.isValid ||
      deadline.toFormat("dd-MM-yyyy HH:mm") !== rawDeadline
    ) {
      return "Tanggal atau waktu deadline tidak valid.";
    }

    if (deadline.toMillis() <= Date.now()) {
      return "Deadline harus berada di masa depan.";
    }

    const result = addTaskStatement.run(
      course,
      title,
      deadline.toMillis(),
      Date.now(),
    );

    return [
      "TUGAS BERHASIL DITAMBAHKAN",
      "",
      `ID: ${result.lastInsertRowid}`,
      `Mata kuliah: ${course}`,
      `Tugas: ${title}`,
      `Deadline: ${displayDeadline(deadline.toMillis())}`,
      "Status: Belum selesai",
      "",
      "Pengingat H-3, H-1, dan H-0 diaktifkan.",
    ].join("\n");
  }

  if (keyword === "/tugas") {
    return taskListText("DAFTAR TUGAS BELUM SELESAI", listTasks());
  }

  if (keyword === "/prioritas") {
    return taskListText("PRIORITAS BERDASARKAN DEADLINE", listTasks());
  }

  if (keyword === "/ringkasan") {
    return dailySummary();
  }

  if (keyword === "/selesai") {
    const match = normalized.match(/^\/selesai\s+(\d+)$/i);

    if (!match) {
      return "Format tidak sesuai. Contoh: /selesai 1";
    }

    const id = Number(match[1]);

    if (!Number.isSafeInteger(id) || id < 1) {
      return "ID tugas tidak valid.";
    }

    const task = findTaskStatement.get(id);

    if (!task) {
      return `Tugas dengan ID ${id} tidak ditemukan.`;
    }

    if (task.completed_at !== null) {
      return `Tugas #${id} sudah selesai sebelumnya.`;
    }

    const result = finishTaskStatement.run(Date.now(), id);

    if (result.changes === 0) {
      return "Status tugas tidak berubah. Silakan coba lagi.";
    }

    return [
      "TUGAS SELESAI",
      "",
      `ID: ${id}`,
      `Mata kuliah: ${task.course}`,
      `Tugas: ${task.title}`,
      "Status: Selesai",
      "",
      "Pengingat berikutnya tidak akan dikirim.",
    ].join("\n");
  }

  return "Perintah tidak dikenal. Ketik /bantuan untuk melihat daftar perintah.";
}

function messageText(message) {
  let content = message;

  for (let i = 0; i < 3; i += 1) {
    const nested =
      content?.ephemeralMessage?.message ??
      content?.viewOnceMessage?.message ??
      content?.viewOnceMessageV2?.message ??
      content?.deviceSentMessage?.message;

    if (!nested) break;

    content = nested;
  }

  return content?.conversation ?? content?.extendedTextMessage?.text ?? "";
}

function isOwnChat(sock, remoteJid, remoteJidAlt) {
  if (!sock.user?.id) return false;

  const identities = [
    sock.user.id,
    sock.user.lid,
    `${phoneNumber}@s.whatsapp.net`,
  ].filter(Boolean);

  const candidates = [remoteJid, remoteJidAlt].filter(Boolean);

  return candidates.some((candidate) =>
    identities.some((identity) => areJidsSameUser(candidate, identity)),
  );
}

async function sendToSelf(sock, text) {
  if (activeSocket !== sock || !sock.user?.id) {
    throw new Error("Sesi WhatsApp belum terhubung.");
  }

  const sent = await sock.sendMessage(jidNormalizedUser(sock.user.id), {
    text,
  });

  if (!sent?.key?.id) {
    throw new Error("WhatsApp belum mengonfirmasi pengiriman pesan.");
  }
}

async function processIncomingMessage(sock, message) {
  if (activeSocket !== sock || message.key?.fromMe !== true) {
    return;
  }

  if (!isOwnChat(sock, message.key.remoteJid, message.key.remoteJidAlt)) {
    return;
  }

  const input = messageText(message.message)?.trim();

  if (!input?.startsWith("/")) return;

  const messageId = message.key.id;

  if (!messageId) return;

  const seconds = Number(message.messageTimestamp?.toString() ?? 0);

  if (seconds > 0 && Math.abs(Date.now() - seconds * 1000) > 10 * 60 * 1000) {
    return;
  }

  const inserted = saveProcessedMessageStatement.run(messageId, Date.now());

  if (inserted.changes === 0) return;

  const response = handleCommand(input);

  console.log(`[PERINTAH] ${input.split(/[\s|]/, 1)[0]} diterima.`);

  await sendToSelf(sock, response);
}

async function runScheduledJobs() {
  if (schedulerRunning || !activeSocket) return;

  schedulerRunning = true;

  try {
    const sock = activeSocket;
    const now = nowJakarta();
    const today = now.startOf("day");

    for (const task of listTasks()) {
      const days = dayDistance(task.due_at, now);

      if (![3, 1, 0].includes(days)) continue;

      if (days === 0 && task.due_at <= now.toMillis()) {
        continue;
      }

      const deadline = dateOf(task.due_at);

      const scheduled =
        days === 0 && deadline.hour < 7
          ? today
          : today.set({ hour: 7, minute: 0 });

      if (now.toMillis() < scheduled.toMillis()) {
        continue;
      }

      const key = `reminder:${task.id}:${task.due_at}:H-${days}`;

      if (hasNotificationStatement.get(key)) continue;

      if (findTaskStatement.get(task.id)?.completed_at !== null) {
        continue;
      }

      const headline =
        days === 0 ? "DEADLINE HARI INI" : `PENGINGAT DEADLINE H-${days}`;

      const text = [
        headline,
        "",
        `Mata kuliah: ${task.course}`,
        `Tugas: ${task.title}`,
        `Deadline: ${displayDeadline(task.due_at)}`,
        "",
        "Gunakan /tugas untuk melihat semua tugas atau /selesai ID jika sudah dikerjakan.",
      ].join("\n");

      await sendToSelf(sock, text);

      saveNotificationStatement.run(key, Date.now());

      console.log(`[PENGINGAT] Tugas #${task.id}, H-${days} terkirim.`);
    }

    if (now.hour >= 7) {
      const key = `summary:${now.toFormat("yyyy-MM-dd")}`;

      if (!hasNotificationStatement.get(key)) {
        await sendToSelf(sock, dailySummary(now));

        saveNotificationStatement.run(key, Date.now());

        console.log("[RINGKASAN] Ringkasan harian terkirim.");
      }
    }

    cleanProcessedMessagesStatement.run(Date.now() - 30 * 24 * 60 * 60 * 1000);
  } catch (error) {
    console.error("[SCHEDULER]", error);
  } finally {
    schedulerRunning = false;
  }
}

function scheduleReconnect() {
  if (reconnectTimer || stopped) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectToWhatsApp();
  }, 5000);
}

async function connectToWhatsApp() {
  if (stopped) return;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIRECTORY);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        console.log(
          "Scan QR melalui WhatsApp > Perangkat tertaut > Tautkan perangkat.",
        );

        qrcode.generate(qr, {
          small: true,
        });
      }

      if (connection === "open") {
        const actualJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : "";

        const expectedJid = `${phoneNumber}@s.whatsapp.net`;

        if (!areJidsSameUser(actualJid, expectedJid)) {
          stopped = true;

          console.error(
            "Nomor WhatsApp yang ditautkan berbeda dari WHATSAPP_NUMBER.",
          );

          sock.end(new Error("Nomor yang terhubung tidak sesuai."));

          process.exit(1);
        }

        activeSocket = sock;

        console.log("WhatsApp terhubung. Bot pribadi siap digunakan.");

        void runScheduledJobs();
      }

      if (connection === "close") {
        if (activeSocket === sock) {
          activeSocket = null;
        }

        const code = lastDisconnect?.error?.output?.statusCode;

        if (code === DisconnectReason.loggedOut) {
          stopped = true;

          console.error(
            "Sesi WhatsApp logout. Tautkan ulang setelah memindahkan folder auth lama.",
          );

          process.exit(1);
        }

        console.warn(
          `Koneksi terputus (kode ${code ?? "tidak diketahui"}). Mencoba kembali.`,
        );

        scheduleReconnect();
      }
    });

    sock.ev.on("messages.upsert", (event) => {
      if (event.type !== "notify") return;

      for (const message of event.messages) {
        void processIncomingMessage(sock, message).catch((error) => {
          console.error("[PESAN]", error);
        });
      }
    });
  } catch (error) {
    console.error("[KONEKSI]", error);
    scheduleReconnect();
  }
}

cron.schedule(
  "* * * * *",
  () => {
    void runScheduledJobs();
  },
  {
    timezone: ZONE,
  },
);

console.log("KampusTask Bot dimulai. Zona waktu:", ZONE);

void connectToWhatsApp();
