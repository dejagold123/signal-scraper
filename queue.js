// Durable outgoing message queue. Every send attempt is appended here first;
// on success it's marked delivered, on failure it stays pending so a
// flushQueue() call (on startup, and periodically) can retry it. This
// covers the gap where the process crashes between parsing a message and
// successfully delivering it — without this, that message is just gone.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const QUEUE_PATH = path.join(__dirname, "send-queue.json");

function load() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function save(q) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(q, null, 2));
}

let queue = load();

function enqueue(target, message) {
  const id = crypto.randomUUID();
  queue[id] = { target, message, attempts: 0, createdAt: new Date().toISOString() };
  save(queue);
  return id;
}

function markDelivered(id) {
  delete queue[id];
  save(queue);
}

function markFailed(id) {
  if (queue[id]) {
    queue[id].attempts += 1;
    queue[id].lastAttemptAt = new Date().toISOString();
    save(queue);
  }
}

function pending() {
  return Object.entries(queue).map(([id, entry]) => ({ id, ...entry }));
}

// Attempts to (re)send everything still pending. sendFn(target, message)
// should return true/false. Caps retries so a permanently-broken message
// (e.g. malformed target) doesn't retry forever and spam logs.
async function flushQueue(sendFn, maxAttempts = 10) {
  const items = pending();
  if (items.length === 0) return;
  console.log(`Flushing send queue: ${items.length} pending message(s)...`);
  for (const item of items) {
    if (item.attempts >= maxAttempts) continue;
    const ok = await sendFn(item.target, item.message);
    if (ok) {
      markDelivered(item.id);
    } else {
      markFailed(item.id);
    }
  }
}

module.exports = { enqueue, markDelivered, markFailed, pending, flushQueue };
