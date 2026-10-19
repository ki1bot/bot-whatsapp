import pino from "pino";
import qrcode from "qrcode-terminal";
import makeWASocket, {
  areJidsSameUser,
  DisconnectReason,
  jidNormalizedUser,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { settings } from "./config.js";
import { delivery } from "./repositories/delivery.js";
import { routeCommand, isCommandCandidate } from "./commands/index.js";

let socket = null;
let selfChatJid = null;
let reconnectTimer = null;
let closed = false;
let connecting = false;
let onReady = () => {};

const sentMessageIds = new Set();

function unwrapMessage(message) {
  let value = message;

  for (let i = 0; i < 4; i++) {
    const nested =
      value?.ephemeralMessage?.message ??
      value?.viewOnceMessage?.message ??
      value?.viewOnceMessageV2?.message ??
      value?.deviceSentMessage?.message;

    if (!nested) break;

    value = nested;
  }

  return (value?.conversation ?? value?.extendedTextMessage?.text ?? "").trim();
}

function actualOwnJids(sock) {
  return [
    sock.user?.id,
    sock.user?.lid,
    sock.authState?.creds?.me?.id,
    sock.authState?.creds?.me?.lid,
  ]
    .filter(Boolean)
    .map(jidNormalizedUser);
}

function ownJids(sock) {
  return [...actualOwnJids(sock), `${settings.phone}@s.whatsapp.net`];
}

function matchesAny(jid, identities) {
  return Boolean(jid) && identities.some((own) => areJidsSameUser(jid, own));
}

async function ownChat(sock, key) {
  const identities = ownJids(sock);

  const candidates = [key.remoteJid, key.remoteJidAlt].filter(Boolean);

  if (candidates.some((jid) => matchesAny(jid, identities))) {
    return true;
  }

  const mapping = sock.signalRepository?.lidMapping;

  for (const jid of candidates) {
    if (!jid.endsWith("@lid") || !mapping?.getPNForLID) {
      continue;
    }

    try {
      const pn = await mapping.getPNForLID(jidNormalizedUser(jid));

      if (matchesAny(pn, identities)) {
        return true;
      }
    } catch {}
  }

  return false;
}

async function validateOwnNumber(sock) {
  const pn = `${settings.phone}@s.whatsapp.net`;

  const candidates = actualOwnJids(sock).filter((jid) =>
    jid.endsWith("@s.whatsapp.net"),
  );

  const mapping = sock.signalRepository?.lidMapping;

  for (const lid of actualOwnJids(sock).filter((jid) => jid.endsWith("@lid"))) {
    try {
      const result = await mapping?.getPNForLID?.(lid);

      if (result) {
        candidates.push(jidNormalizedUser(result));
      }
    } catch {}
  }

  if (candidates.some((candidate) => !areJidsSameUser(candidate, pn))) {
    throw new Error(
      "Akun WhatsApp yang ditautkan tidak sesuai dengan WHATSAPP_NUMBER. Periksa sesi auth untuk nomor ini.",
    );
  }

  if (candidates.length === 0) {
    console.warn(
      "[AKUN] Nomor belum dapat diverifikasi melalui PN; menggunakan identitas LID untuk chat diri sendiri.",
    );
  }
}

export async function sendToSelf(text) {
  const sock = socket;

  if (!sock?.user) {
    throw new Error("Koneksi WhatsApp belum siap.");
  }

  const target = selfChatJid ?? sock.user.lid ?? sock.user.id;

  if (!target) {
    throw new Error("Identitas chat pribadi belum tersedia.");
  }

  const sent = await sock.sendMessage(jidNormalizedUser(target), { text });

  if (!sent?.key?.id) {
    throw new Error("WhatsApp belum mengembalikan ID pesan.");
  }

  sentMessageIds.add(sent.key.id);

  if (sentMessageIds.size > 500) {
    sentMessageIds.clear();
  }
}

async function handleMessage(sock, message) {
  if (socket !== sock || message.key?.fromMe !== true || !message.message) {
    return;
  }

  const input = unwrapMessage(message.message);

  if (!input || !isCommandCandidate(input)) {
    return;
  }

  if (!(await ownChat(sock, message.key))) {
    console.warn(
      "[PESAN] Perintah bukan dari chat Pesan ke diri sendiri, diabaikan.",
    );

    return;
  }

  const messageId = message.key.id;

  if (!messageId || sentMessageIds.has(messageId)) {
    return;
  }

  const timestamp = Number(message.messageTimestamp?.toString() ?? 0) * 1000;

  if (!timestamp || Math.abs(Date.now() - timestamp) > 10 * 60 * 1000) {
    return;
  }

  if (!delivery.acceptMessage(messageId)) {
    return;
  }

  selfChatJid = jidNormalizedUser(message.key.remoteJid);

  const result = routeCommand(input);

  console.log(`[PERINTAH] ${input.split(/[\s|]/, 1)[0]}`);

  await sendToSelf(result);
}

function reconnect() {
  if (closed || reconnectTimer || socket) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, 5000);
}

async function connect() {
  if (closed || connecting) {
    return;
  }

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

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      if (update.qr) {
        console.log(
          "Scan QR melalui WhatsApp > Perangkat tertaut > Tautkan perangkat.",
        );

        qrcode.generate(update.qr, {
          small: true,
        });
      }

      if (update.connection === "open") {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        void validateOwnNumber(sock)
          .then(() => {
            if (closed) return;

            socket = sock;
            selfChatJid = null;

            console.log(
              "WhatsApp terhubung. Coba ketik /ping di Pesan ke diri sendiri.",
            );

            void onReady();
          })
          .catch((error) => {
            closed = true;

            console.error("[VALIDASI]", error.message);

            sock.end(error);
            process.exit(1);
          });
      }

      if (update.connection === "close") {
        if (socket && socket !== sock) {
          return;
        }

        if (socket === sock) {
          socket = null;
        }

        const code = update.lastDisconnect?.error?.output?.statusCode;

        if (code === DisconnectReason.loggedOut) {
          closed = true;

          console.error(
            "Sesi WhatsApp keluar. Periksa folder auth dan tautkan kembali.",
          );

          process.exit(1);
          return;
        }

        console.warn(`[KONEKSI] Terputus: ${code ?? "tidak diketahui"}`);

        reconnect();
      }
    });

    sock.ev.on("messages.upsert", (event) => {
      if (!["notify", "append"].includes(event.type)) {
        return;
      }

      for (const message of event.messages) {
        void handleMessage(sock, message).catch((error) => {
          console.error("[PERINTAH]", error.message);
        });
      }
    });
  } catch (error) {
    console.error("[KONEKSI]", error.message);

    reconnect();
  } finally {
    connecting = false;
  }
}

export function startWhatsApp(callback) {
  onReady = callback;
  void connect();
}
