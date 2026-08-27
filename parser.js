// Lightweight regex-based parser. Trade call formats vary a lot between callers,
// so this aims to catch the common patterns and degrade gracefully — if it can't
// find a symbol, it still forwards the raw text as an "unclassified" message
// rather than silently dropping it.

// Prefer a $-prefixed symbol (unambiguous). Fall back to a bare all-caps
// word, but exclude common trade-vocabulary words that would otherwise get
// mistaken for the symbol itself (e.g. "LONG $BTC" matching "LONG").
const SYMBOL_DOLLAR_RE = /\$([A-Z]{2,10})\b/;
const SYMBOL_BARE_RE = /\b([A-Z]{2,10})(?:\s?\/\s?(?:USDT|USD|PERP))?\b/;
const SYMBOL_STOPWORDS = new Set([
  "LONG", "SHORT", "BUY", "SELL", "SL", "TP", "ENTRY", "USDT", "USD",
  "PERP", "BE", "OK",
]);
const DIRECTION_RE = /\b(long|short|buy|sell)\b/i;
const ENTRY_RE = /entry[:\s]*([\d,.]+(?:\s*-\s*[\d,.]+)?)/i;
const SL_RE = /(?:stop\s?loss|sl)[:\s]*([\d,.]+)/i;
// Index digit (TP1, TP2) must immediately follow "tp" with no space —
// otherwise "TP 3000" (no index) would greedily eat the "3" as the index
// and leave "000" as the price.
const TP_RE = /tp(\d+)?\s*[:=]?\s*([\d,.]+)/gi;
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
  const dollarMatch = text.match(SYMBOL_DOLLAR_RE);
  if (dollarMatch) return dollarMatch[1].toUpperCase();

  // Fall back to scanning all-caps words for the first one that isn't a
  // known stopword, rather than blindly taking the first match.
  const bareMatches = text.match(new RegExp(SYMBOL_BARE_RE, "g")) || [];
  for (const raw of bareMatches) {
    const word = raw.split("/")[0].trim().toUpperCase();
    if (!SYMBOL_STOPWORDS.has(word)) return word;
  }
  return null;
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

    // Confidence reflects how many expected fields were actually found —
    // low-confidence calls still get forwarded, but flagged so you know to
    // go check the original message before acting on it.
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
