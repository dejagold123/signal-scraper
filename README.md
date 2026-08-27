# Telegram → WhatsApp Trade Signal Bot

Watches a Telegram channel for calls from specific profiles, forwards them to
WhatsApp, and keeps tracking each call so partials/TP hits/closes get sent as
follow-ups on the same trade.

## 1. Install

```bash
npm install
```

Node 18+ recommended. On a fresh Ubuntu VPS you'll also need Chromium deps for
whatsapp-web.js's Puppeteer:

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

## 5. WhatsApp

Set `WA_TARGET` in `.env` — your own number as `2348012345678@c.us`, or a
group id ending in `@g.us`.

## 6. Run it

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

## Notes / limitations

- **whatsapp-web.js is unofficial** — it drives a real WhatsApp Web session.
  Keep volume low (this is a personal alert feed, not bulk messaging) to
  avoid the linked device getting flagged.
- **Call/update parsing is regex-based** (see `parser.js`). Every trader
  phrases calls differently — you'll likely need to tune the patterns after
  watching real messages for a day or two. That's the one file worth
  iterating on.
- **Matching updates to calls** is done by (caller, symbol) pair, stored in
  `active-calls.json`. If a caller posts two open calls on the same symbol
  at once, the second overwrites the first's tracking — fine for most
  channels, but flag it if that's a real scenario for yours.
