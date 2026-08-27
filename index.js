const { config } = require("./config");
const { createTelegramClient, attachListeners } = require("./telegram");
const { createWhatsAppClient, sendWhatsApp } = require("./whatsapp");
const { parseMessage } = require("./parser");
const { addCall, getOpenCall, applyUpdate } = require("./tracker");
const { formatNewCall, formatUpdate, formatUnmatchedUpdate } = require("./format");

(async () => {
  if (!config.wa.target) {
    console.error("WA_TARGET is not set in .env — nowhere to send messages.");
    process.exit(1);
  }

  const wa = createWhatsAppClient();
  await wa.initialize();

  const tg = await createTelegramClient();

  attachListeners(tg, async (text, senderId, senderName, isEdit) => {
    const parsed = parseMessage(text);

    if (parsed.type === "call") {
      addCall(senderId, senderName, parsed);
      console.log(`New call: ${senderName} -> ${parsed.symbol}`);
      await sendWhatsApp(wa, config.wa.target, formatNewCall(senderName, parsed));
      return;
    }

    if (parsed.type === "update") {
      const existing = parsed.symbol ? getOpenCall(senderId, parsed.symbol) : null;
      if (existing) {
        applyUpdate(senderId, parsed.symbol, parsed.kind);
        console.log(`Update: ${senderName} -> ${parsed.symbol} (${parsed.kind})`);
        await sendWhatsApp(
          wa,
          config.wa.target,
          formatUpdate(senderName, parsed.symbol, parsed.kind, parsed.raw)
        );
      } else {
        // Still forward it — better a false positive than a missed close/TP
        console.log(`Unmatched update from ${senderName}: ${text.slice(0, 60)}`);
        await sendWhatsApp(wa, config.wa.target, formatUnmatchedUpdate(senderName, text));
      }
      return;
    }

    // Unclassified message from a watched profile — log only, don't spam WhatsApp
    console.log(`Unclassified message from ${senderName}: ${text.slice(0, 60)}`);
  });

  console.log("Bot is running. Press Ctrl+C to stop.");
})();
