const CONFIDENCE_BADGE = {
  high: "🟢",
  medium: "🟡",
  low: "🟠",
};

function formatNewCall(callerName, parsed) {
  const badge = CONFIDENCE_BADGE[parsed.confidence] || "🟢";
  const lines = [`${badge} New call from ${callerName}`];
  if (parsed.confidence && parsed.confidence !== "high") {
    lines.push(`(${parsed.confidence} confidence parse — check original)`);
  }
  if (parsed.symbol) lines.push(`Symbol: ${parsed.symbol}`);
  if (parsed.direction) lines.push(`Direction: ${parsed.direction}`);
  if (parsed.entry) lines.push(`Entry: ${parsed.entry}`);
  if (parsed.sl) lines.push(`SL: ${parsed.sl}`);
  if (parsed.tps && parsed.tps.length) lines.push(`TPs: ${parsed.tps.join(", ")}`);
  if (parsed.leverage) lines.push(`Leverage: ${parsed.leverage}x`);
  lines.push("");
  lines.push(`"${parsed.raw}"`);
  return lines.join("\n");
}

function formatUnclassified(callerName, raw) {
  return [
    `⚠️ Unrecognized format from ${callerName} — forwarding raw, couldn't parse it:`,
    "",
    `"${raw}"`,
  ].join("\n");
}

function formatHeartbeat(channel, openCallCount) {
  const time = new Date().toLocaleString();
  return [
    `✅ Signal bot heartbeat — ${time}`,
    `Watching: ${channel}`,
    `Open calls tracked: ${openCallCount}`,
  ].join("\n");
}

const UPDATE_LABELS = {
  closed: "🔴 Trade closed",
  stopped_out: "🛑 Stopped out",
  partial: "🟡 Partial taken",
  tp_hit: "🎯 TP hit",
  sl_to_be: "🔧 SL moved to breakeven",
};

function formatUpdate(callerName, symbol, kind, raw) {
  const label = UPDATE_LABELS[kind] || "Update";
  const lines = [`${label} — ${symbol || "unknown symbol"} (${callerName})`, "", `"${raw}"`];
  return lines.join("\n");
}

function formatUnmatchedUpdate(callerName, raw) {
  return [
    `ℹ️ Possible update from ${callerName} — couldn't match it to a tracked call:`,
    "",
    `"${raw}"`,
  ].join("\n");
}

module.exports = {
  formatNewCall,
  formatUpdate,
  formatUnmatchedUpdate,
  formatUnclassified,
  formatHeartbeat,
};
