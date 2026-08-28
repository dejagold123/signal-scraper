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
    console.log("WhatsApp client ready (backup channel).");
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

module.exports = { createWhatsAppClient, sendWhatsApp };
