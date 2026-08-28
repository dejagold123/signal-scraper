const { config } = require("./config");
const { sendDiscord, discordEnabled } = require("./discord");
const { sendWhatsApp } = require("./whatsapp");
const { sendBackup, backupEnabled } = require("./backup");
const { enqueue } = require("./queue");

// Tries Discord first (primary), falls back to WhatsApp (backup) if Discord
// fails or isn't configured. Returns true if either succeeded.
async function deliver(waClient, message) {
  if (discordEnabled()) {
    const ok = await sendDiscord(message);
    if (ok) return true;
    console.warn("Discord delivery failed — falling back to WhatsApp.");
  } else {
    console.warn("Discord not configured (DISCORD_WEBHOOK_URL unset) — sending via WhatsApp only.");
  }

  if (waClient && config.wa.target) {
    const waOk = await sendWhatsApp(waClient, config.wa.target, message);
    if (waOk) return true;
  }

  return false;
}

// Same as deliver(), but if BOTH channels fail, queues the message for retry
// (survives a crash/restart) and pings the Telegram-bot backup as a last
// resort so total silence never happens quietly.
async function deliverWithQueue(waClient, message) {
  const ok = await deliver(waClient, message);
  if (!ok) {
    const id = enqueue(config.wa.target || "discord", message);
    console.log(`Queued message ${id} for retry.`);
    if (backupEnabled()) {
      await sendBackup(`[Discord + WhatsApp both failed — backup channel]\n\n${message}`);
    } else {
      console.error("Discord and WhatsApp both failed, and no Telegram-bot backup configured — message queued only.");
    }
  }
  return ok;
}

module.exports = { deliver, deliverWithQueue };
