const { config } = require("./config");
const {
  createTelegramClient,
  attachListeners,
  startConnectionMonitor,
  setDisconnectAlertHandler,
} = require("./telegram");
const { createWhatsAppClient } = require("./whatsapp");
const { discordEnabled } = require("./discord");
const { backupEnabled, sendBackup } = require("./backup");
const { parseMessage } = require("./parser");
const { addCall, getOpenCall, applyUpdate } = require("./tracker");
const {
  formatNewCall,
  formatUpdate,
  formatUnmatchedUpdate,
  formatUnclassified,
} = require("./format");
const { startHeartbeat } = require("./heartbeat");
const { startWebhook } = require("./webhook");
const { deliver, deliverWithQueue } = require("./dispatch");
const { flushQueue } = require("./queue");
const { logEvent } = require("./eventlog");

(async () => {
  if (!discordEnabled() && !config.wa.target) {
    console.error(
      "Neither DISCORD_WEBHOOK_URL nor WA_TARGET is set in .env — nowhere to send messages."
    );
    process.exit(1);
  }

  if (!discordEnabled()) {
    console.log("Note: DISCORD_WEBHOOK_URL not set — WhatsApp will be used as the only channel.");
  }

  // WhatsApp is now the backup channel — only spin up the client (and its
  // QR/session overhead) if it's actually configured.
  let wa = null;
  if (config.wa.target) {
    wa = createWhatsAppClient();
    await wa.initialize();
  } else {
    console.log("WA_TARGET not set — no WhatsApp backup configured (Discord only).");
  }

  if (!backupEnabled()) {
    console.log(
      "Note: no Telegram-bot backup configured (TG_BOT_TOKEN/TG_BOT_CHAT_ID unset). " +
        "If both Discord and WhatsApp fail, messages are queued for retry but not delivered elsewhere in the meantime."
    );
  }

  const tg = await createTelegramClient();

  setDisconnectAlertHandler(async () => {
    if (backupEnabled()) {
      await sendBackup("⚠️ Telegram connection dropped — attempting to reconnect.");
    }
  });
  startConnectionMonitor(tg);

  attachListeners(tg, async (text, senderId, senderName, isEdit) => {
    const parsed = parseMessage(text, senderId);

    if (parsed.type === "call") {
      const call = addCall(senderId, senderName, parsed);
      console.log(`New call (${parsed.confidence} confidence): ${senderName} -> ${parsed.symbol} [${call.id}]`);
      await deliverWithQueue(wa, formatNewCall(senderName, parsed));
      return;
    }

    if (parsed.type === "update") {
      const existing = parsed.symbol ? getOpenCall(senderId, parsed.symbol) : null;
      if (existing) {
        const { conflict } = applyUpdate(senderId, parsed.symbol, parsed.kind, isEdit);
        console.log(`Update: ${senderName} -> ${parsed.symbol} (${parsed.kind})${isEdit ? " [edit]" : ""}`);
        const message = conflict
          ? `⚠️ Conflicting edited update for ${parsed.symbol} (${senderName}) — verify manually:\n\n"${parsed.raw}"`
          : formatUpdate(senderName, parsed.symbol, parsed.kind, parsed.raw);
        await deliverWithQueue(wa, message);
      } else {
        console.log(`Unmatched update from ${senderName}: ${text.slice(0, 60)}`);
        await deliverWithQueue(wa, formatUnmatchedUpdate(senderName, text));
      }
      return;
    }

    console.log(`Unclassified message from ${senderName}: ${text.slice(0, 60)}`);
    await deliverWithQueue(wa, formatUnclassified(senderName, text));
  });

  startHeartbeat(wa);
  startWebhook();

  // Retry the durable queue through the same Discord -> WhatsApp chain, so
  // if Discord was down and recovers, retries go back through it instead of
  // being stuck on WhatsApp forever.
  const flush = () => flushQueue((_target, message) => deliver(wa, message));
  setTimeout(flush, 15 * 1000);
  setInterval(flush, 10 * 60 * 1000);

  logEvent("bot_started", {});
  console.log("Bot is running. Press Ctrl+C to stop.");
})();
