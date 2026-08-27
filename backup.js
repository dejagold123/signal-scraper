// Backup channel: a Telegram bot that DMs you directly. Kept dead simple
// (raw fetch to the Bot API, no extra dependency) so it has nothing in
// common with the WhatsApp delivery path — if one breaks, the other
// shouldn't be affected.
//
// Setup:
//   1. Message @BotFather on Telegram, /newbot, get a bot token.
//   2. Start a chat with your new bot (send it anything, e.g. "hi").
//   3. Visit https://api.telegram.org/bot<TOKEN>/getUpdates and read your
//      chat id from the response.
//   4. Put both in .env as TG_BOT_TOKEN and TG_BOT_CHAT_ID.
//
// If either is unset, backup delivery is silently skipped (not required).

const { config } = require("./config");

function backupEnabled() {
  return Boolean(config.backup.botToken && config.backup.chatId);
}

async function sendBackup(message) {
  if (!backupEnabled()) return false;
  try {
    const url = `https://api.telegram.org/bot${config.backup.botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.backup.chatId, text: message }),
    });
    if (!res.ok) {
      console.error("Backup channel send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Backup channel error:", err.message);
    return false;
  }
}

module.exports = { sendBackup, backupEnabled };
