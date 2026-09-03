#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/share/pnpm:$PATH"
LOG="/home/remote/monitor.log"
# Prefer local health (avoid TLS/DNS); fall back to public URL
URL_LOCAL="http://127.0.0.1:3001/api/trpc/system.health"
URL_PUBLIC="https://lucepress.213.156.135.139.sslip.io/api/trpc/system.health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL_LOCAL" || echo "000")
if [ "$STATUS" != "200" ]; then
  STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 15 "$URL_PUBLIC" || echo "000")
fi
if [ "$STATUS" != "200" ]; then
  echo "$(date) Lucepress health $STATUS -> restart" >> "$LOG"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart lucepress 2>&1 | head -20 >> "$LOG"
  else
    echo "$(date) ERROR: pm2 not found in PATH=$PATH" >> "$LOG"
  fi
else
  echo "$(date) OK $STATUS" >> "$LOG"
fi
