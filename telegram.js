const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { EditedMessage } = require("telegram/events");
const { config, isWatchedSender } = require("./config");
const { logEvent } = require("./eventlog");

let onDisconnectAlert = null;

// index.js registers this so a dropped connection can trigger a backup-
// channel alert, not just a console log nobody's watching.
function setDisconnectAlertHandler(fn) {
  onDisconnectAlert = fn;
}

async function createTelegramClient() {
  if (!config.tg.session) {
    throw new Error(
      "No TG_SESSION set in .env. Run `npm run login` first and paste the printed session string into .env."
    );
  }

  const client = new TelegramClient(
    new StringSession(config.tg.session),
    config.tg.apiId,
    config.tg.apiHash,
    { connectionRetries: 10, retryDelay: 2000, autoReconnect: true }
  );

  await client.connect();
  console.log("Telegram client connected.");
  return client;
}

// GramJS's own autoReconnect handles most transient drops, but this adds a
// visible health check on top: if the client reports disconnected for more
// than one check interval, log it loudly and fire the alert handler so you
// actually find out, instead of the bot quietly missing messages.
function startConnectionMonitor(client, intervalMs = 60 * 1000) {
  let wasConnected = true;
  setInterval(async () => {
    const connected = client.connected;
    if (!connected && wasConnected) {
      console.error("Telegram client appears disconnected — attempting reconnect...");
      logEvent("telegram_disconnected", {});
      if (onDisconnectAlert) await onDisconnectAlert();
      try {
        await client.connect();
      } catch (err) {
        console.error("Reconnect attempt failed:", err.message);
      }
    }
    if (connected && !wasConnected) {
      console.log("Telegram client reconnected.");
      logEvent("telegram_reconnected", {});
    }
    wasConnected = connected;
  }, intervalMs);
}

async function resolveSender(client, message) {
  try {
    const sender = await message.getSender();
    if (!sender) {
      // Anonymous channel admin posts have no resolvable sender via
      // getSender(), but message.senderId / message.postAuthor are often
      // still present — fall back to those instead of just "Unknown".
      const anonId = message.senderId ? message.senderId.toString() : null;
      const anonName = message.postAuthor || "Anonymous admin";
      console.warn(
        `Sender resolution returned no user for message ${message.id} — treating as anonymous admin (senderId=${anonId})`
      );
      return { id: anonId, username: null, name: anonName, anonymous: true };
    }
    const id = sender.id ? sender.id.toString() : null;
    const name =
      sender.username ||
      [sender.firstName, sender.lastName].filter(Boolean).join(" ") ||
      "Unknown";
    return { id, username: sender.username || null, name, anonymous: false };
  } catch (err) {
    console.warn(`Sender resolution failed for message ${message.id}: ${err.message}`);
    return { id: null, username: null, name: "Unknown", anonymous: false };
  }
}

// onCallerMessage(text, senderId, senderName, isEdit)
function attachListeners(client, onCallerMessage) {
  const handler = (isEdit) => async (event) => {
    const message = event.message;
    if (!message || !message.text) return;

    const sender = await resolveSender(client, message);
    if (!isWatchedSender(sender.id, sender.username)) return;

    onCallerMessage(message.text, sender.id, sender.name, isEdit);
  };

  client.addEventHandler(handler(false), new NewMessage({ chats: [config.tg.channel] }));
  client.addEventHandler(handler(true), new EditedMessage({ chats: [config.tg.channel] }));

  console.log(`Listening on ${config.tg.channel} for new + edited messages...`);
}

module.exports = {
  createTelegramClient,
  attachListeners,
  startConnectionMonitor,
  setDisconnectAlertHandler,
};
