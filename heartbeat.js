const { config } = require("./config");
const { formatHeartbeat } = require("./format");
const { countOpenCalls } = require("./tracker");
const { sendWithFallback } = require("./whatsapp");

function startHeartbeat(waClient) {
  const intervalMs = config.heartbeatHours * 60 * 60 * 1000;

  const beat = async () => {
    const msg = formatHeartbeat(config.tg.channel, countOpenCalls());
    console.log("Sending heartbeat...");
    await sendWithFallback(waClient, config.wa.target, msg);
  };

  // Send one shortly after startup so you get immediate confirmation it's alive,
  // then repeat on the configured interval.
  setTimeout(beat, 30 * 1000);
  setInterval(beat, intervalMs);
}

module.exports = { startHeartbeat };
