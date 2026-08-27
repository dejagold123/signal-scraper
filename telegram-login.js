// Run this once: npm run login
// Logs you into your Telegram account (as a user, not a bot) so the listener
// can read channel messages. Prints a session string at the end — paste it
// into .env as TG_SESSION so you never have to do this again.
require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = parseInt(process.env.TG_API_ID, 10);
const apiHash = process.env.TG_API_HASH;

(async () => {
  console.log("Logging in to Telegram...");
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => process.env.TG_PHONE || (await input.text("Phone number: ")),
    password: async () => await input.text("2FA password (if enabled, else leave blank): "),
    phoneCode: async () => await input.text("Code sent to your Telegram app: "),
    onError: (err) => console.log(err),
  });

  console.log("\nLogged in successfully.\n");
  console.log("Paste this into your .env as TG_SESSION:\n");
  console.log(client.session.save());
  console.log("\nDone. You can Ctrl+C now.");
  process.exit(0);
})();
