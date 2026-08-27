const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const { enqueue, markDelivered } = require("./queue");

function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./wa-session" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("\nScan this QR code with WhatsApp (Linked Devices):\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    console.log("WhatsApp client ready.");
  });

  client.on("auth_failure", (msg) => {
    console.error("WhatsApp auth failure:", msg);
  });

  client.on("disconnected", (reason) => {
    console.error("WhatsApp disconnected:", reason, "— restart the process to reconnect.");
  });

  return client;
}

async function sendWhatsApp(client, target, message) {
  try {
    await client.sendMessage(target, message);
    return true;
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err.message);
    return false;
  }
}

// Tries WhatsApp first; on failure, queues the message durably (survives a
// crash/restart) AND falls back to the Telegram bot backup channel
// immediately so a WhatsApp outage doesn't mean total silence right now.
// The durable queue is retried on startup and periodically via
// queue.flushQueue(), separate from the one-shot backup send.
async function sendWithFallback(client, target, message) {
  const { sendBackup, backupEnabled } = require("./backup");
  const ok = await sendWhatsApp(client, target, message);
  if (!ok) {
    const queueId = enqueue(target, message);
    console.log(`Queued message ${queueId} for retry.`);
    if (backupEnabled()) {
      console.log("Falling back to backup channel...");
      await sendBackup(`[WhatsApp delivery failed — backup channel]\n\n${message}`);
    } else {
      console.error("WhatsApp send failed and no backup channel configured — message queued only.");
    }
  }
  return ok;
}

module.exports = { createWhatsAppClient, sendWhatsApp, sendWithFallback };
