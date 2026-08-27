// Run with: npm run audit -- 2026-08-28
const { readEventsForDate } = require("./eventlog");

const dateArg = process.argv[2];
if (!dateArg || !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
  console.error("Usage: npm run audit -- YYYY-MM-DD");
  process.exit(1);
}

const events = readEventsForDate(dateArg);

if (events.length === 0) {
  console.log(`No events logged for ${dateArg}.`);
  process.exit(0);
}

console.log(`${events.length} event(s) on ${dateArg}:\n`);
for (const e of events) {
  const { ts, type, ...rest } = e;
  console.log(`[${ts}] ${type} ${JSON.stringify(rest)}`);
}
