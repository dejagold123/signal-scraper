// Primary delivery channel. A Discord webhook is a single POST request —
// no bot login, no session, no ban risk, nothing to babysit. Create one via
// a channel's Settings -> Integrations -> Webhooks -> New Webhook, copy the
// URL into .env as DISCORD_WEBHOOK_URL.

const { config } = require("./config");

function discordEnabled() {
  return Boolean(config.discord.webhookUrl);
}

async function sendDiscord(message) {
  if (!discordEnabled()) return false;
  try {
    const res = await fetch(config.discord.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord caps message content at 2000 chars — truncate defensively
      // rather than have the webhook reject an oversized message.
      body: JSON.stringify({ content: message.slice(0, 2000) }),
    });
    if (!res.ok) {
      console.error("Discord webhook send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Discord webhook error:", err.message);
    return false;
  }
}

module.exports = { sendDiscord, discordEnabled };
