const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { EditedMessage } = require("telegram/events");
const { config, isWatchedSender } = require("./config");

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
    { connectionRetries: 5 }
  );

  await client.connect();
  console.log("Telegram client connected.");
  return client;
}

async function resolveSender(client, message) {
  try {
    const sender = await message.getSender();
    if (!sender) return { id: null, name: "Unknown" };
    const id = sender.id ? sender.id.toString() : null;
    const name =
      sender.username ||
      [sender.firstName, sender.lastName].filter(Boolean).join(" ") ||
      "Unknown";
    return { id, username: sender.username || null, name };
  } catch {
    return { id: null, name: "Unknown" };
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

module.exports = { createTelegramClient, attachListeners };
