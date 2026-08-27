// Run with: npm test
// Plain node + assert — no jest/mocha dependency needed for a parser this size.
const assert = require("assert");
const path = require("path");
const { parseMessage } = require("../parser");

const cases = require("./test-cases.json");

let passed = 0;
let failed = 0;

for (const { text, expect } of cases) {
  const result = parseMessage(text);
  try {
    for (const [key, value] of Object.entries(expect)) {
      assert.strictEqual(
        result[key],
        value,
        `field "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify(result[key])}`
      );
    }
    passed++;
    console.log(`PASS: "${text.slice(0, 50)}..."`);
  } catch (err) {
    failed++;
    console.error(`FAIL: "${text.slice(0, 50)}..."\n  ${err.message}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
