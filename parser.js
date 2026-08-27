// Regex-based parser. Patterns live in patterns.json (loaded via
// patterns-loader.js) so they can be tuned per-caller without a code change
// or restart — see patterns.json for the override format.

const { getPatternsFor } = require("./patterns-loader");

function extractSymbol(text, p) {
  const dollarRe = new RegExp(p.symbolDollar);
  const dollarMatch = text.match(dollarRe);
  if (dollarMatch) return dollarMatch[1].toUpperCase();

  const stopwords = new Set(p.symbolStopwords.map((w) => w.toUpperCase()));
  const bareRe = new RegExp(p.symbolBare, "g");
  const bareMatches = text.match(bareRe) || [];
  for (const raw of bareMatches) {
    const word = raw.split("/")[0].trim().toUpperCase();
    if (!stopwords.has(word)) return word;
  }
  return null;
}

function detectUpdate(text, p) {
  for (const { pattern, kind } of p.updateKeywords) {
    if (new RegExp(pattern, "i").test(text)) return kind;
  }
  return null;
}

function looksLikeNewCall(text, p) {
  const directionRe = new RegExp(p.direction, "i");
  const entryRe = new RegExp(p.entry, "i");
  return directionRe.test(text) && (entryRe.test(text) || /\$[A-Z]{2,10}/.test(text));
}

/**
 * @param {string} text - the raw message text
 * @param {string|number|null} callerId - used to look up per-caller pattern overrides
 */
function parseMessage(text, callerId = null) {
  if (!text) return { type: "unknown", raw: text };

  const p = getPatternsFor(callerId);
  const symbol = extractSymbol(text, p);
  const updateKind = detectUpdate(text, p);

  if (updateKind) {
    return { type: "update", kind: updateKind, symbol, raw: text };
  }

  if (looksLikeNewCall(text, p)) {
    const direction = (text.match(new RegExp(p.direction, "i")) || [])[1] || null;
    const entry = (text.match(new RegExp(p.entry, "i")) || [])[1] || null;
    const sl = (text.match(new RegExp(p.stopLoss, "i")) || [])[1] || null;

    const tps = [];
    const tpRe = new RegExp(p.takeProfit, "gi");
    let tpMatch;
    while ((tpMatch = tpRe.exec(text)) !== null) {
      tps.push(tpMatch[2]);
    }

    const leverage = (text.match(new RegExp(p.leverage, "i")) || [])[1] || null;

    const fieldsFound = [symbol, direction, entry, sl, tps.length > 0].filter(Boolean).length;
    let confidence = "low";
    if (fieldsFound >= 4) confidence = "high";
    else if (fieldsFound >= 2) confidence = "medium";

    return {
      type: "call",
      symbol,
      direction: direction ? direction.toUpperCase() : null,
      entry,
      sl,
      tps,
      leverage,
      confidence,
      raw: text,
    };
  }

  return { type: "unknown", symbol, raw: text };
}

module.exports = { parseMessage };
