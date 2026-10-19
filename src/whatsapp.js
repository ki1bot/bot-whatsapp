import pino from "pino";
import qrcode from "qrcode-terminal";
import makeWASocket, {
  DisconnectReason,
  jidNormalizedUser,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { settings } from "./config.js";
import { delivery } from "./repositories/delivery.js";
import { routeCommand } from "./commands/index.js";

let currentSocket = null;
let activeSocket = null;
let reconnectTimer = null;
let connecting = false;
let stopped = false;
let readyCallback = () => {};
const knownChats = new Map();

function normalizeJid(value) {
  return value ? jidNormalizedUser(value) : null;
}

function phoneFromJid(value) {
  const jid = normalizeJid(value);
  if (!jid?.endsWith("@s.whatsapp.net")) return null;
  const number = jid.split("@")[0];
  return /^\d+$/.test(number) ? number : null;
}

function extractText(message) {
  let body = message;
  for (let i = 0; i < 4; i++) {
    const nested =
      body?.ephemeralMessage?.message ??
      body?.viewOnceMessage?.message ??
      body?.viewOnceMessageV2?.message ??
      body?.deviceSentMessage?.message;
    if (!nested) break;
    body = nested;
  }
  return (body?.conversation ?? body?.extendedTextMessage?.text ?? "").trim();
}

async function resolveSender(sock, key) {
  if (key.fromMe !== false) return null;
  const direct = normalizeJid(key.remoteJid);
  if (
    !direct ||
    (!direct.endsWith("@lid") && !direct.endsWith("@s.whatsapp.net"))
  )
    return null;

  const candidates = [key.remoteJid, key.remoteJidAlt]
    .filter(Boolean)
    .map(normalizeJid);
  const numbers = new Set(candidates.map(phoneFromJid).filter(Boolean));
  const map = sock.signalRepository?.lidMapping;

  for (const jid of candidates.filter((candidate) =>
    candidate?.endsWith("@lid"),
  )) {
    try {
      const resolved = await map?.getPNForLID?.(jid);
      const pn = phoneFromJid(resolved);
      if (pn) numbers.add(pn);
    } catch (error) {
      console.warn("[AKSES] Pemetaan LID belum tersedia:", error.message);
    }
  }

  if (numbers.size === 0 && direct.endsWith("@lid")) {
    for (const allowedPhone of settings.allowed) {
      try {
        const lid = await map?.getLIDForPN?.(`${allowedPhone}@s.whatsapp.net`);
        if (normalizeJid(lid) === direct) numbers.add(allowedPhone);
      } catch (error) {
        console.warn("[AKSES] Reverse mapping LID gagal:", error.message);
      }
    }
  }

  if (numbers.size !== 1) return null;
  const [phone] = numbers;
  if (!settings.allowed.includes(phone)) return null;
  return { phone, chat: direct };
}

async function validateBotNumber(sock) {
  const identities = [sock.user?.id, sock.authState?.creds?.me?.id]
    .map(phoneFromJid)
    .filter(Boolean);

  if (
    identities.length &&
    identities.some((number) => number !== settings.phone)
  ) {
    throw new Error("Nomor akun tertaut tidak cocok dengan WHATSAPP_NUMBER.");
  }
  if (!identities.length) {
    console.warn(
      "[AKUN] Nomor bot belum dapat divalidasi dari JID PN. Periksa akun WhatsApp yang ditautkan.",
    );
  }
}

export async function sendToNumber(phone, text) {
  if (!settings.allowed.includes(phone))
    throw new Error("Nomor tujuan tidak diizinkan.");
  const sock = activeSocket;
  if (!sock?.user || currentSocket !== sock)
    throw new Error("Koneksi WhatsApp belum siap.");

  let target = knownChats.get(phone);
  if (!target) {
    const pn = `${phone}@s.whatsapp.net`;
    try {
      target =
        normalizeJid(
          await sock.signalRepository?.lidMapping?.getLIDForPN?.(pn),
        ) ?? pn;
    } catch {
      target = pn;
    }
  }

  const result = await sock.sendMessage(target, { text });
  if (!result?.key?.id)
    throw new Error("WhatsApp belum mengonfirmasi ID pesan.");
  return result.key.id;
}

async function processMessage(sock, message) {
  if (
    sock !== activeSocket ||
    !message.message ||
    message.key?.fromMe !== false
  )
    return;
  const text = extractText(message.message);
  if (!text) return;

  const sender = await resolveSender(sock, message.key);
  if (!sender) {
    if (text.startsWith("/"))
      console.log(
        "[AKSES] Pesan ditolak: nomor tidak terverifikasi atau tidak diizinkan.",
      );
    return;
  }

  const answer = routeCommand(text);
  if (!answer) return;
  const id = message.key.id;
  if (!id) return;
  const timestamp = Number(message.messageTimestamp?.toString() ?? 0) * 1000;
  if (timestamp && Math.abs(Date.now() - timestamp) > 10 * 60 * 1000) return;
  if (!delivery.accept(`${sender.phone}:${id}`)) return;

  knownChats.set(sender.phone, sender.chat);
  console.log(`[PERINTAH] ${text.split(/[\s|]/)[0]} dari nomor terdaftar.`);
  await sendToNumber(sender.phone, answer);
}

function scheduleReconnect() {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, 3000);
}

async function connect() {
  if (connecting || stopped || currentSocket) return;
  connecting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(
      settings.authDirectory,
    );
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      markOnlineOnConnect: false,
    });
    currentSocket = sock;
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      if (currentSocket !== sock) return;
      if (update.qr) {
        console.log(
          "Scan QR di WhatsApp > Perangkat tertaut > Tautkan perangkat.",
        );
        qrcode.generate(update.qr, { small: true });
      }
      if (update.connection === "open") {
        void validateBotNumber(sock)
          .then(() => {
            if (currentSocket !== sock || stopped) return;
            activeSocket = sock;
            console.log(
              "WhatsApp terhubung. Perintah hanya diterima dari dua nomor ALLOWED_NUMBERS.",
            );
            void readyCallback();
          })
          .catch((error) => {
            console.error("[AKUN]", error.message);
            stopped = true;
            sock.end(error);
            process.exit(1);
          });
      }
      if (update.connection === "close") {
        activeSocket = null;
        currentSocket = null;
        knownChats.clear();
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === DisconnectReason.loggedOut) {
          stopped = true;
          console.error(
            "[KONEKSI] Sesi logout. Perlu tautkan kembali perangkat.",
          );
          process.exit(1);
        } else if (!stopped) {
          console.warn(
            `[KONEKSI] Terputus (${code ?? "tanpa kode"}), menghubungkan ulang...`,
          );
          scheduleReconnect();
        }
      }
    });

    sock.ev.on("messages.upsert", (event) => {
      if (event.type !== "notify") return;
      for (const message of event.messages) {
        void processMessage(sock, message).catch((error) =>
          console.error("[PESAN]", error.message),
        );
      }
    });

    sock.ev.on("call", (calls) => {
      for (const call of calls) {
        if (call.status !== "offer") continue;
        void sock
          .rejectCall(call.id, call.from)
          .then(() =>
            console.log("[PANGGILAN] Panggilan masuk otomatis ditolak."),
          )
          .catch((error) => console.error("[PANGGILAN]", error.message));
      }
    });
  } catch (error) {
    console.error("[KONEKSI]", error.message);
    currentSocket = null;
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

export function startWhatsApp(callback) {
  readyCallback = callback;
  void connect();
}
