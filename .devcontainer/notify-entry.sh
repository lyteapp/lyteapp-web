#!/usr/bin/env bash
# Security alert: emails whenever this Codespace starts (fresh create or
# resumed from stopped). Resend's sandbox mode (no verified domain) only
# allows delivery to the account's own email — lyteapp@proton.me — so that's
# the actual recipient; ADMIN_EMAILS is still listed in the body for
# reference and forwarding from that inbox to the rest of the team.
# Prints each step — this only ever runs in a private Codespace terminal.
NOTIFY_TO="lyteapp@proton.me"

echo "[notify] RESEND_API_KEY set: $([ -n "$RESEND_API_KEY" ] && echo yes || echo no)"
echo "[notify] Enviando a: $NOTIFY_TO"

if [ -z "$RESEND_API_KEY" ]; then
  echo "[notify] Falta RESEND_API_KEY, no se envia nada."
  exit 0
fi

WHO="${GITHUB_USER:-desconocido}"
WHEN="$(date -u '+%Y-%m-%d %H:%M UTC')"
CODESPACE="${CODESPACE_NAME:-desconocido}"
TEAM="${ADMIN_EMAILS:-<no configurado>}"

RESPONSE="$(curl -s -w '\nHTTP_STATUS:%{http_code}' -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"from\": \"LyteApp Security <onboarding@resend.dev>\",
    \"to\": [\"$NOTIFY_TO\"],
    \"subject\": \"Codespace abierto: lyteapp-web\",
    \"text\": \"Se abrio (o reanudo) el Codespace del repositorio lyteapp-web.\n\nUsuario de GitHub: $WHO\nCodespace: $CODESPACE\nFecha (UTC): $WHEN\n\nEquipo a reenviar (ADMIN_EMAILS): $TEAM\n\nSi no reconoces esta actividad, revisa quien tiene acceso de colaborador al repositorio.\"
  }")"
echo "[notify] Respuesta de Resend: $RESPONSE"

exit 0
