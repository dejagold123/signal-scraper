# Telegram → Discord/WhatsApp Trade Signal Bot

Watches a Telegram channel for calls from specific profiles, forwards them to
Discord (primary) with WhatsApp as an automatic backup, and keeps tracking
each call so partials/TP hits/closes get sent as follow-ups on the same
trade.

## 1. Install

```bash
npm install
```

Node 18+ recommended. Chromium deps for whatsapp-web.js's Puppeteer are only
needed if you set up the WhatsApp backup channel (step 6) — skip this if
you're running Discord-only:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libx11-xcb1 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libasound2
```

## 2. Get Telegram API credentials

Go to https://my.telegram.org → API Development Tools → create an app.
You'll get an `api_id` and `api_hash`.

Copy `.env.example` to `.env` and fill in `TG_API_ID`, `TG_API_HASH`, `TG_PHONE`.

## 3. Log in to Telegram (one-time)

```bash
npm run login
```

Enter the code Telegram sends you (and your 2FA password if you have one).
It prints a session string at the end — paste it into `.env` as `TG_SESSION`.
You won't need to repeat this unless the session is revoked.

## 4. Find the profiles to watch

Set `TG_CHANNEL` in `.env` to the channel (e.g. `@channelname`).

Run the bot once with `TG_WATCHED_USER_IDS` and `TG_WATCHED_USERNAMES` left
empty — it'll forward everyone and log each sender's id/username to the
console. Copy the IDs of the traders you actually want, put them in
`TG_WATCHED_USER_IDS`, then restart. IDs are preferred over usernames since
usernames can change.

## 5. Discord (primary channel)

In your Discord server: pick a channel → Edit Channel → Integrations →
Webhooks → New Webhook → Copy Webhook URL. Paste it into `.env` as
`DISCORD_WEBHOOK_URL`. That's the entire setup — no bot, no login, nothing
to keep alive.

## 6. WhatsApp (optional backup) + Telegram-bot backup + heartbeat

- **WhatsApp** is now the backup channel, used automatically if a Discord
  send fails. Set `WA_TARGET` in `.env` (your number as
  `2348012345678@c.us`, or a group ending in `@g.us`) if you want it.
  Leave it blank to run Discord-only — no QR scan, no Puppeteer needed.

- **Telegram-bot backup** (last resort): a separate Telegram bot that DMs
  you directly, used only if *both* Discord and WhatsApp fail, and for
  critical alerts like a dropped Telegram connection. Setup:
  1. Message `@BotFather` on Telegram → `/newbot` → get a token.
  2. Send your new bot any message (e.g. "hi") to open a chat with it.
  3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` and read your
     numeric chat id from the JSON response.
  4. Set `TG_BOT_TOKEN` and `TG_BOT_CHAT_ID` in `.env`.
  Optional — if left blank, a total delivery failure is just logged and
  queued for retry.

- **Heartbeat**: every `HEARTBEAT_HOURS` (default 24), the bot sends itself
  a "still alive, watching X, N open calls" ping through the same
  Discord → WhatsApp chain. If a day goes by with no heartbeat, that's your
  signal something crashed or got disconnected — worth pointing an uptime
  check (e.g. a simple cron job or `pm2` restart policy) at this instead of
  assuming silence means "no calls."

## 7. Run it

```bash
npm start
```

First run shows a QR code in the terminal — scan it with WhatsApp
(Linked Devices → Link a Device). After that the session is cached in
`./wa-session` so you won't need to scan again unless you unlink it.

Keep the process alive with `pm2` or a systemd service so it survives
reboots/crashes, e.g.:

```bash
npm install -g pm2
pm2 start index.js --name signal-bot
pm2 save
pm2 startup
```

## 8. Testing and tuning without touching production

- **`npm test`** — runs `test/parser.test.js` against `test/test-cases.json`.
  Add a case there any time you tune a pattern, so a future edit can't
  silently break something that used to work.
- **`npm run dry-run`** — creates `sample-messages.txt` on first run, then
  feeds each line through the parser only (no Telegram/WhatsApp connections,
  no sends). Prefix a line with `callerId|` to test a per-caller override,
  e.g. `111111111|entry @ 45000 long BTC`. Edit `patterns.json`, re-run, see
  the effect immediately.
- **`npm run audit -- YYYY-MM-DD`** — replays every logged event (calls
  opened, updates applied, conflicts, disconnects, manual corrections) for
  a given day from `events.jsonl`, for after-the-fact debugging.

## 9. Tuning parser patterns without a restart

`patterns.json` holds every regex the parser uses. Edit it while the bot is
running — it's hot-reloaded via `fs.watch`, no restart needed. To handle a
trader with a non-standard format, add an entry under `overrides` keyed by
their numeric Telegram user ID:

```json
"overrides": {
  "111111111": { "entry": "entry\\s*@\\s*([\\d,.]+)" }
}
```

Any field you don't override falls back to `default`. Test changes with
`npm run dry-run` before trusting them live.

## 10. Manual corrections / injection (optional)

Set `WEBHOOK_PORT` and `WEBHOOK_SECRET` in `.env` to expose two endpoints,
both requiring an `X-Webhook-Secret` header matching your secret:

```bash
# Manually inject a call the bot didn't catch
curl -X POST http://localhost:PORT/inject \
  -H "X-Webhook-Secret: yoursecret" -H "Content-Type: application/json" \
  -d '{"callerId":"manual","callerName":"me","symbol":"BTC","direction":"LONG","entry":"45000"}'

# Manually correct a call's status
curl -X POST http://localhost:PORT/correct \
  -H "X-Webhook-Secret: yoursecret" -H "Content-Type: application/json" \
  -d '{"callerId":"111111111","symbol":"BTC","status":"closed"}'
```

Leave `WEBHOOK_PORT` blank to disable this entirely — it's an open port on
your VPS otherwise, so only turn it on if you'll actually use it, and put it
behind a firewall rule limiting which IPs can reach it if possible.

## Notes / limitations

- **Discord is the primary channel** — a stateless webhook POST, no bot
  login, no session, no ban risk. **WhatsApp is now backup-only**: it still
  uses the unofficial whatsapp-web.js under the hood, but since it's no
  longer the primary channel, message volume through it is much lower,
  reducing (not eliminating) flag/ban risk further. It's entirely optional
  — leave `WA_TARGET` blank to run Discord-only.
- **Call/update parsing is regex-based** (see `parser.js` + `patterns.json`).
  Every trader phrases calls differently — expect to tune patterns after
  watching real messages for a day or two (see section 9). Every parsed
  call carries a `confidence` (high/medium/low) based on how many fields
  were found — low/medium confidence calls still get forwarded, but
  flagged, so you know to double check the original message.
- **Unrecognized messages from watched senders are forwarded, not
  dropped** — flagged as "unrecognized format" so you see the raw text.
- **Multiple simultaneous calls on the same symbol from the same caller are
  now tracked separately** (unique call IDs, see `tracker.js`), instead of
  the second overwriting the first.
- **Edited updates that conflict with a call's already-recorded status**
  (e.g. an edit changes "closed" back to "still open") are flagged as a
  conflict and sent as a warning rather than silently overwritten.
- **Anonymous channel admin posts** are now handled explicitly — logged
  with a warning and labeled "Anonymous admin" rather than silently
  becoming "Unknown". If your watched profiles ever post anonymously in
  the channel (common for admin-run channels), you'll need to watch for
  this in the logs since anonymous posts can't be matched against
  `TG_WATCHED_USER_IDS` by user ID.
- **Reconnect handling**: GramJS auto-reconnects on transient drops; a
  60-second health check on top of that detects a stuck disconnect, tries
  to reconnect, and fires an alert via the Telegram-bot backup so you're not
  just hoping it recovers unattended.
- **Durable send queue**: any message that fails both Discord and WhatsApp
  is queued to `send-queue.json` and retried every 10 minutes (and once at
  startup) through the same Discord → WhatsApp chain — survives a crash
  between parsing and delivering a message.
- **Event log** (`events.jsonl`) records every call open/update/conflict/
  reconnect/manual correction with a timestamp — use `npm run audit` to
  inspect it.
