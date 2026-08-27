const fs = require("fs");
const path = require("path");

const PATTERNS_PATH = path.join(__dirname, "patterns.json");

let cache = null;

function load() {
  try {
    const raw = fs.readFileSync(PATTERNS_PATH, "utf8");
    cache = JSON.parse(raw);
    console.log("Patterns reloaded from patterns.json");
  } catch (err) {
    console.error("Failed to load patterns.json, keeping previous patterns:", err.message);
    if (!cache) throw err; // no fallback available on first load
  }
  return cache;
}

load();

// Hot reload: edit patterns.json and it takes effect on the next message,
// no restart needed. fs.watch can double-fire on some platforms so this is
// harmless to call twice.
try {
  fs.watch(PATTERNS_PATH, { persistent: false }, () => load());
} catch (err) {
  console.error("Could not watch patterns.json for changes:", err.message);
}

function getPatternsFor(callerId) {
  const base = cache.default;
  const override = callerId ? cache.overrides[String(callerId)] : null;
  if (!override) return base;
  return { ...base, ...override };
}

module.exports = { getPatternsFor };
