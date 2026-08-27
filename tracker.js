const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { logEvent } = require("./eventlog");

const STORE_PATH = path.join(__dirname, "active-calls.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch {
    return { calls: {}, index: {} }; // calls: id -> call object; index: "callerId:symbol" -> [ids]
  }
}

function save(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

let store = load();
// Migrate an old-format store (flat callerId:symbol -> call) if present.
if (!store.calls) {
  const migrated = { calls: {}, index: {} };
  for (const [k, call] of Object.entries(store)) {
    if (k === "calls" || k === "index") continue;
    const id = crypto.randomUUID();
    migrated.calls[id] = call;
    migrated.index[k] = [id];
  }
  store = migrated;
  save(store);
}

function indexKey(callerId, symbol) {
  return `${callerId}:${symbol || "UNKNOWN"}`;
}

// Creates a new call with its own unique ID — multiple simultaneous open
// calls on the same symbol from the same caller are now separate entries
// instead of overwriting each other.
function addCall(callerId, callerName, parsed) {
  const id = crypto.randomUUID();
  const call = {
    id,
    callerId,
    callerName,
    symbol: parsed.symbol,
    direction: parsed.direction,
    entry: parsed.entry,
    sl: parsed.sl,
    tps: parsed.tps,
    leverage: parsed.leverage,
    confidence: parsed.confidence,
    openedAt: new Date().toISOString(),
    status: "open",
    history: [],
  };
  store.calls[id] = call;
  const k = indexKey(callerId, parsed.symbol);
  store.index[k] = store.index[k] || [];
  store.index[k].push(id);
  save(store);
  logEvent("call_opened", { id, callerId, callerName, symbol: parsed.symbol });
  return call;
}

// Returns the most recently opened OPEN call for this caller+symbol.
// (Multiple open legs can exist now — this picks the latest one, which is
// the common case; use getOpenCallsFor for the full list.)
function getOpenCall(callerId, symbol) {
  const k = indexKey(callerId, symbol);
  const ids = store.index[k] || [];
  for (let i = ids.length - 1; i >= 0; i--) {
    const call = store.calls[ids[i]];
    if (call && call.status === "open") return call;
  }
  return null;
}

function getOpenCallsFor(callerId, symbol) {
  const k = indexKey(callerId, symbol);
  const ids = store.index[k] || [];
  return ids.map((id) => store.calls[id]).filter((c) => c && c.status === "open");
}

const TERMINAL_STATUSES = new Set(["closed", "stopped_out"]);

// Applies an update to the most recent open call for this caller+symbol.
// If the update is an edit to a message that already produced an update
// (rather than a brand new update), and it conflicts with the call's
// current status (e.g. call is already "closed" but the edited message now
// says "still open"), this flags a conflict rather than silently
// overwriting — that's the situation a trader correcting themselves
// ("false alarm, still open") would otherwise hide.
function applyUpdate(callerId, symbol, kind, isEdit = false) {
  const call = getOpenCall(callerId, symbol) || (() => {
    // fall back to most recent call regardless of status, so a correction
    // to an already-closed call can still be recorded
    const k = indexKey(callerId, symbol);
    const ids = store.index[k] || [];
    return ids.length ? store.calls[ids[ids.length - 1]] : null;
  })();

  if (!call) return { call: null, conflict: false };

  const priorStatus = call.status;
  const newStatus = TERMINAL_STATUSES.has(kind) ? kind : call.status;
  const conflict = isEdit && priorStatus !== "open" && newStatus !== priorStatus;

  call.status = newStatus;
  call.history.push({
    kind,
    isEdit,
    priorStatus,
    at: new Date().toISOString(),
  });
  call.lastUpdate = { kind, at: new Date().toISOString() };
  save(store);

  logEvent("call_update", { id: call.id, callerId, symbol, kind, isEdit, conflict, priorStatus });
  if (conflict) {
    console.warn(
      `Conflicting edited update for ${call.id} (${symbol}): was "${priorStatus}", edit now says "${kind}"`
    );
  }

  return { call, conflict };
}

function countOpenCalls() {
  return Object.values(store.calls).filter((c) => c.status === "open").length;
}

// Manual correction path (used by the webhook) — same persistence and
// logging as applyUpdate, but doesn't run edit-conflict detection since a
// human is explicitly overriding the state on purpose.
function correctCall(callerId, symbol, status) {
  const call = getOpenCall(callerId, symbol);
  if (!call) return null;
  const priorStatus = call.status;
  call.status = status;
  call.history.push({ kind: "manual_correction", isEdit: false, priorStatus, at: new Date().toISOString() });
  save(store);
  logEvent("manual_correction", { id: call.id, callerId, symbol, status, priorStatus });
  return call;
}

module.exports = { addCall, getOpenCall, getOpenCallsFor, applyUpdate, countOpenCalls, correctCall };
