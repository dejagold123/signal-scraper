// Minimal REST endpoint for manual corrections and external call injection.
// Deliberately dependency-free (built-in http module) and off by default —
// only starts if WEBHOOK_PORT is set in .env, and requires a shared secret
// header on every request since this would otherwise be an open door on a
// public VPS.
//
// POST /correct   { "callId": "...", "status": "closed" }
// POST /inject     { "callerId": "manual", "callerName": "me", "symbol": "BTC",
//                     "direction": "LONG", "entry": "45000", "sl": "44000",
//                     "tps": ["46000"], "leverage": "10" }
//
// Both require header: X-Webhook-Secret: <WEBHOOK_SECRET>

const http = require("http");
const { config } = require("./config");
const { addCall, correctCall } = require("./tracker");
const { logEvent } = require("./eventlog");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function startWebhook() {
  if (!config.webhook.port) {
    console.log("Webhook disabled (WEBHOOK_PORT not set).");
    return null;
  }
  if (!config.webhook.secret) {
    console.error("WEBHOOK_PORT is set but WEBHOOK_SECRET is not — refusing to start an unauthenticated webhook.");
    return null;
  }

  const server = http.createServer(async (req, res) => {
    if (req.headers["x-webhook-secret"] !== config.webhook.secret) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }

    try {
      if (req.method === "POST" && req.url === "/inject") {
        const body = await readBody(req);
        if (!body.symbol) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "symbol is required" }));
          return;
        }
        const call = addCall(body.callerId || "manual", body.callerName || "manual", {
          symbol: body.symbol,
          direction: body.direction || null,
          entry: body.entry || null,
          sl: body.sl || null,
          tps: body.tps || [],
          leverage: body.leverage || null,
          confidence: "manual",
        });
        logEvent("manual_inject", { id: call.id });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(call));
        return;
      }

      if (req.method === "POST" && req.url === "/correct") {
        const body = await readBody(req);
        if (!body.callerId || !body.symbol || !body.status) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "callerId, symbol, and status are required" }));
          return;
        }
        const call = correctCall(body.callerId, body.symbol, body.status);
        if (!call) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: "no open call found for that caller+symbol" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(call));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(config.webhook.port, () => {
    console.log(`Webhook listening on port ${config.webhook.port} (routes: POST /inject, POST /correct)`);
  });

  return server;
}

module.exports = { startWebhook };
