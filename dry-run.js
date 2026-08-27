// Run with: npm run dry-run
// Feeds sample-messages.txt (one message per line, optionally
// "callerId|text" to test per-caller overrides) through the parser only —
// no Telegram or WhatsApp connections are made. Use this to check a
// patterns.json edit before it goes live.

const fs = require("fs");
const path = require("path");
const { parseMessage } = require("./parser");

const SAMPLE_PATH = path.join(__dirname, "sample-messages.txt");

if (!fs.existsSync(SAMPLE_PATH)) {
  fs.writeFileSync(
    SAMPLE_PATH,
    [
      "LONG $BTC entry: 45000 SL: 44000 TP1: 46000 TP2: 47000 20x",
      "SHORT ETH entry: 3200 SL 3300 TP 3000",
      "TP1 hit on BTC, moving SL to BE",
      "closed BTC in profit",
      "just chatting, nothing here",
    ].join("\n") + "\n"
  );
  console.log(`Created a starter ${SAMPLE_PATH} — edit it and re-run.`);
}

const lines = fs
  .readFileSync(SAMPLE_PATH, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

console.log(`Dry run: ${lines.length} sample message(s), no sends will happen.\n`);

for (const line of lines) {
  let callerId = null;
  let text = line;
  if (line.includes("|")) {
    [callerId, text] = line.split("|", 2);
  }
  const result = parseMessage(text, callerId);
  console.log(`> ${text}`);
  console.log(JSON.stringify(result, null, 2));
  console.log("");
}
