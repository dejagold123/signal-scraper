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
    target: process.env.WA_TARGET,
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
