const { config } = require("./config");
const {
  createTelegramClient,
  attachListeners,
  startConnectionMonitor,
  setDisconnectAlertHandler,
} = require("./telegram");
const { createWhatsAppClient, sendWithFallback, sendWhatsApp } = require("./whatsapp");
const { backupEnabled, sendBackup } = require("./backup");
const { parseMessage } = require("./parser");
const { addCall, getOpenCall, applyUpdate, countOpenCalls } = require("./tracker");
const {
  formatNewCall,
  formatUpdate,
  formatUnmatchedUpdate,
  formatUnclassified,
} = require("./format");
const { startHeartbeat } = require("./heartbeat");
const { startWebhook } = require("./webhook");
const { flushQueue } = require("./queue");
const { logEvent } = require("./eventlog");

(async () => {
  if (!config.wa.target) {
    console.error("WA_TARGET is not set in .env — nowhere to send messages.");
    process.exit(1);
  }

  const wa = createWhatsAppClient();
  await wa.initialize();

  if (!backupEnabled()) {
    console.log(
      "Note: no backup channel configured (TG_BOT_TOKEN/TG_BOT_CHAT_ID unset). " +
        "If WhatsApp delivery fails, messages are queued for retry but not delivered elsewhere in the meantime."
    );
  }

  const tg = await createTelegramClient();

  // If the Telegram connection drops, say so on the backup channel — silence
  // from the whole system is the one failure mode you'd never notice.
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
      await sendWithFallback(wa, config.wa.target, formatNewCall(senderName, parsed));
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
        await sendWithFallback(wa, config.wa.target, message);
      } else {
        console.log(`Unmatched update from ${senderName}: ${text.slice(0, 60)}`);
        await sendWithFallback(wa, config.wa.target, formatUnmatchedUpdate(senderName, text));
      }
      return;
    }

    // Unclassified message from a watched profile — forward it flagged rather
    // than dropping it silently.
    console.log(`Unclassified message from ${senderName}: ${text.slice(0, 60)}`);
    await sendWithFallback(wa, config.wa.target, formatUnclassified(senderName, text));
  });

  startHeartbeat(wa);
  startWebhook();

  // Retry anything left in the durable send queue from a previous crash,
  // then keep retrying periodically.
  const flush = () => flushQueue((target, message) => sendWhatsApp(wa, target, message));
  setTimeout(flush, 15 * 1000);
  setInterval(flush, 10 * 60 * 1000);

  logEvent("bot_started", {});
  console.log("Bot is running. Press Ctrl+C to stop.");
})();
