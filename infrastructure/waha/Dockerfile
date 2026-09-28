# Free WhatsApp sender for CrickHerose receipts (WAHA, https://waha.devlike.pro).
# Deploy as a Hugging Face Docker Space; set the secrets listed in README.md.
FROM devlikeapro/waha:latest

USER root
# Hugging Face runs containers as uid 1000; make WAHA's local folders writable.
RUN mkdir -p /app/.media /app/.sessions && chmod -R 777 /app/.media /app/.sessions

ENV WHATSAPP_API_PORT=3000 \
    WHATSAPP_DEFAULT_ENGINE=GOWS \
    WHATSAPP_START_SESSION=default \
    WHATSAPP_RESTART_ALL_SESSIONS=True \
    WAHA_PRINT_QR=False

EXPOSE 3000
