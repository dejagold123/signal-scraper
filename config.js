require("dotenv").config();

function csv(str) {
  return (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  tg: {
    apiId: parseInt(process.env.TG_API_ID, 10),
    apiHash: process.env.TG_API_HASH,
    phone: process.env.TG_PHONE,
    session: process.env.TG_SESSION || "",
    channel: process.env.TG_CHANNEL,
    watchedUserIds: csv(process.env.TG_WATCHED_USER_IDS).map(Number),
    watchedUsernames: csv(process.env.TG_WATCHED_USERNAMES).map((u) =>
      u.replace(/^@/, "").toLowerCase()
    ),
  },
  wa: {
    target: process.env.WA_TARGET || "",
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  },
  backup: {
    botToken: process.env.TG_BOT_TOKEN || "",
    chatId: process.env.TG_BOT_CHAT_ID || "",
  },
  heartbeatHours: parseInt(process.env.HEARTBEAT_HOURS || "24", 10),
  webhook: {
    port: process.env.WEBHOOK_PORT ? parseInt(process.env.WEBHOOK_PORT, 10) : null,
    secret: process.env.WEBHOOK_SECRET || "",
  },
};

function isWatchedSender(senderId, senderUsername) {
  const { watchedUserIds, watchedUsernames } = config.tg;
  if (watchedUserIds.length === 0 && watchedUsernames.length === 0) return true; // no filter set = watch everyone
  if (senderId && watchedUserIds.includes(Number(senderId))) return true;
  if (senderUsername && watchedUsernames.includes(senderUsername.toLowerCase())) return true;
  return false;
}

module.exports = { config, isWatchedSender };
