const fs = require("fs");
const path = require("path");

const LOG_PATH = path.join(__dirname, "events.jsonl");

function logEvent(type, data) {
  const entry = { ts: new Date().toISOString(), type, ...data };
  try {
    fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error("Failed to write event log:", err.message);
  }
}

// Returns all events whose timestamp falls on the given YYYY-MM-DD date
// (local calendar day). Used by audit.js.
function readEventsForDate(dateStr) {
  if (!fs.existsSync(LOG_PATH)) return [];
  const lines = fs.readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
  return lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((e) => e && e.ts.startsWith(dateStr));
}

module.exports = { logEvent, readEventsForDate };
