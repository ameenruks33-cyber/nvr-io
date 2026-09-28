---
title: CrickHerose WAHA
emoji: 💬
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 3000
pinned: false
---

# CrickHerose — free WhatsApp receipts (WAHA)

Sends collection receipts automatically from your own WhatsApp number. Free.

## 1. Create the Space (Hugging Face, free)

1. Sign up at https://huggingface.co (free, no card).
2. **New Space** → name `crickherose-waha` → SDK **Docker** → **Blank** → hardware **CPU basic (free)** → visibility **Public** (the API key and dashboard password protect it).
3. Upload `Dockerfile` and this `README.md` from `infrastructure/waha/`.

## 2. Add Space secrets (Settings → Variables and secrets → New secret)

| Secret | Value |
|--------|-------|
| `WAHA_API_KEY` | a long random string (you will paste it into CrickHerose Settings) |
| `WAHA_DASHBOARD_USERNAME` | `admin` |
| `WAHA_DASHBOARD_PASSWORD` | a strong password |
| `WHATSAPP_SWAGGER_USERNAME` | `admin` |
| `WHATSAPP_SWAGGER_PASSWORD` | same strong password |
| `WHATSAPP_SESSIONS_POSTGRESQL_URL` | a Neon Postgres connection string (**direct**, not `-pooler`), so you only scan the QR once |

Free Postgres: https://neon.tech → new project → copy the connection string.

## 3. Link your WhatsApp number (the only step that needs your phone)

1. Open `https://<your-hf-username>-crickherose-waha.hf.space/dashboard` and log in.
2. Open session **default** → **Scan QR** with WhatsApp on your phone (**Linked devices → Link a device**).
3. Status turns **WORKING**.

## 4. Connect CrickHerose

Settings → **WhatsApp receipts**:

- Provider: **WAHA (free, self-hosted)**
- WAHA server URL: `https://<your-hf-username>-crickherose-waha.hf.space`
- Session name: `default`
- WAHA API key: the `WAHA_API_KEY` value
- Tick **Enable automatic WhatsApp receipts** → **Save** → **Send test receipt**.

## Notes

- WAHA is unofficial WhatsApp Web automation. Send receipts only to your own customers; bulk or spam sending can get a number banned.
- Free Spaces sleep after 48 h without traffic; the CrickHerose API pings WAHA daily to keep it awake. If a send fails while it wakes up, the collector still gets the one-tap WhatsApp button.
