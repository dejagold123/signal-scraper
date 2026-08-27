// Lightweight regex-based parser. Trade call formats vary a lot between callers,
// so this aims to catch the common patterns and degrade gracefully — if it can't
// find a symbol, it still forwards the raw text as an "unclassified" message
// rather than silently dropping it.

const SYMBOL_RE = /\$?\b([A-Z]{2,10})(?:\s?\/\s?(?:USDT|USD|PERP))?\b/;
const DIRECTION_RE = /\b(long|short|buy|sell)\b/i;
const ENTRY_RE = /entry[:\s]*([\d,.]+(?:\s*-\s*[\d,.]+)?)/i;
const SL_RE = /(?:stop\s?loss|sl)[:\s]*([\d,.]+)/i;
const TP_RE = /tp\s?(\d)?[:\s]*([\d,.]+)/gi;
const LEVERAGE_RE = /(\d{1,3})x/i;

const UPDATE_KEYWORDS = [
  { re: /\b(closed?|close[sd]? in profit|position closed)\b/i, kind: "closed" },
  { re: /\b(stopped out|sl hit|stop hit|stop loss hit)\b/i, kind: "stopped_out" },
  { re: /\bpartial(s)?\s?(taken|closed|booked)?\b/i, kind: "partial" },
  { re: /\btp\s?\d?\s?(hit|reached|done)\b/i, kind: "tp_hit" },
  { re: /\bmoved?\s?sl\s?to\s?(be|breakeven|entry)\b/i, kind: "sl_to_be" },
  { re: /\bfull(y)?\s?closed\b/i, kind: "closed" },
];

function extractSymbol(text) {
  const m = text.match(SYMBOL_RE);
  return m ? m[1].toUpperCase() : null;
}

function detectUpdate(text) {
  for (const { re, kind } of UPDATE_KEYWORDS) {
    if (re.test(text)) return kind;
  }
  return null;
}

function looksLikeNewCall(text) {
  // Needs a direction word and either an entry or a symbol with $ to count as a fresh call
  return DIRECTION_RE.test(text) && (ENTRY_RE.test(text) || /\$[A-Z]{2,10}/.test(text));
}

function parseMessage(text) {
  if (!text) return { type: "unknown", raw: text };

  const symbol = extractSymbol(text);
  const updateKind = detectUpdate(text);

  if (updateKind) {
    return { type: "update", kind: updateKind, symbol, raw: text };
  }

  if (looksLikeNewCall(text)) {
    const direction = (text.match(DIRECTION_RE) || [])[1] || null;
    const entry = (text.match(ENTRY_RE) || [])[1] || null;
    const sl = (text.match(SL_RE) || [])[1] || null;

    const tps = [];
    let tpMatch;
    TP_RE.lastIndex = 0;
    while ((tpMatch = TP_RE.exec(text)) !== null) {
      tps.push(tpMatch[2]);
    }

    const leverage = (text.match(LEVERAGE_RE) || [])[1] || null;

    return {
      type: "call",
      symbol,
      direction: direction ? direction.toUpperCase() : null,
      entry,
      sl,
      tps,
      leverage,
      raw: text,
    };
  }

  return { type: "unknown", symbol, raw: text };
}

module.exports = { parseMessage };
