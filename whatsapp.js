const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

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

// Tries WhatsApp first; on failure (or if the client isn't ready), falls
// back to the Telegram bot backup channel so a WhatsApp outage doesn't mean
// total silence. Prefixes the backup message so you know which path it came
// through.
async function sendWithFallback(client, target, message) {
  const { sendBackup, backupEnabled } = require("./backup");
  const ok = await sendWhatsApp(client, target, message);
  if (!ok && backupEnabled()) {
    console.log("Falling back to backup channel...");
    await sendBackup(`[WhatsApp delivery failed — backup channel]\n\n${message}`);
  } else if (!ok) {
    console.error("WhatsApp send failed and no backup channel configured — message lost.");
  }
  return ok;
}

module.exports = { createWhatsAppClient, sendWhatsApp, sendWithFallback };
