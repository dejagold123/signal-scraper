const { config } = require("./config");
const { createTelegramClient, attachListeners } = require("./telegram");
const { createWhatsAppClient, sendWithFallback } = require("./whatsapp");
const { backupEnabled } = require("./backup");
const { parseMessage } = require("./parser");
const { addCall, getOpenCall, applyUpdate } = require("./tracker");
const {
  formatNewCall,
  formatUpdate,
  formatUnmatchedUpdate,
  formatUnclassified,
} = require("./format");
const { startHeartbeat } = require("./heartbeat");

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
        "If WhatsApp delivery fails, messages will be logged only, not delivered anywhere."
    );
  }

  const tg = await createTelegramClient();

  attachListeners(tg, async (text, senderId, senderName, isEdit) => {
    const parsed = parseMessage(text);

    if (parsed.type === "call") {
      addCall(senderId, senderName, parsed);
      console.log(`New call (${parsed.confidence} confidence): ${senderName} -> ${parsed.symbol}`);
      await sendWithFallback(wa, config.wa.target, formatNewCall(senderName, parsed));
      return;
    }

    if (parsed.type === "update") {
      const existing = parsed.symbol ? getOpenCall(senderId, parsed.symbol) : null;
      if (existing) {
        applyUpdate(senderId, parsed.symbol, parsed.kind);
        console.log(`Update: ${senderName} -> ${parsed.symbol} (${parsed.kind})`);
        await sendWithFallback(
          wa,
          config.wa.target,
          formatUpdate(senderName, parsed.symbol, parsed.kind, parsed.raw)
        );
      } else {
        // Still forward it — better a false positive than a missed close/TP
        console.log(`Unmatched update from ${senderName}: ${text.slice(0, 60)}`);
        await sendWithFallback(wa, config.wa.target, formatUnmatchedUpdate(senderName, text));
      }
      return;
    }

    // Unclassified message from a watched profile — forward it flagged rather
    // than dropping it silently. A missed real update is worse than one extra
    // WhatsApp message you can ignore.
    console.log(`Unclassified message from ${senderName}: ${text.slice(0, 60)}`);
    await sendWithFallback(wa, config.wa.target, formatUnclassified(senderName, text));
  });

  startHeartbeat(wa);

  console.log("Bot is running. Press Ctrl+C to stop.");
})();
