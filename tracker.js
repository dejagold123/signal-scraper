const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "active-calls.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

let store = load();

function key(callerId, symbol) {
  return `${callerId}:${symbol || "UNKNOWN"}`;
}

function addCall(callerId, callerName, parsed) {
  const k = key(callerId, parsed.symbol);
  store[k] = {
    callerId,
    callerName,
    symbol: parsed.symbol,
    direction: parsed.direction,
    entry: parsed.entry,
    sl: parsed.sl,
    tps: parsed.tps,
    leverage: parsed.leverage,
    openedAt: new Date().toISOString(),
    status: "open",
  };
  save(store);
  return store[k];
}

function getOpenCall(callerId, symbol) {
  const k = key(callerId, symbol);
  const call = store[k];
  return call && call.status === "open" ? call : null;
}

function applyUpdate(callerId, symbol, kind) {
  const k = key(callerId, symbol);
  const call = store[k];
  if (!call) return null;
  if (kind === "closed" || kind === "stopped_out") call.status = "closed";
  call.lastUpdate = { kind, at: new Date().toISOString() };
  save(store);
  return call;
}

function countOpenCalls() {
  return Object.values(store).filter((c) => c.status === "open").length;
}

module.exports = { addCall, getOpenCall, applyUpdate, countOpenCalls };
