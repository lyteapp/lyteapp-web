#!/usr/bin/env bash
# Security alert: emails everyone in ADMIN_EMAILS whenever this Codespace
# starts (fresh create or resumed from stopped). Both RESEND_API_KEY and
# ADMIN_EMAILS must be set as Codespaces secrets for this repo. Prints
# what it's doing at every step — this only ever runs in a private
# Codespace terminal, never in a build log others can see.
echo "[notify] RESEND_API_KEY set: $([ -n "$RESEND_API_KEY" ] && echo yes || echo no)"
echo "[notify] ADMIN_EMAILS: ${ADMIN_EMAILS:-<vacio>}"

if [ -z "$RESEND_API_KEY" ] || [ -z "$ADMIN_EMAILS" ]; then
  echo "[notify] Falta una de las dos variables, no se envia nada."
  exit 0
fi

WHO="${GITHUB_USER:-desconocido}"
WHEN="$(date -u '+%Y-%m-%d %H:%M UTC')"
CODESPACE="${CODESPACE_NAME:-desconocido}"

TO_JSON="$(node -e "console.log(JSON.stringify(process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)))" 2>/dev/null)"
echo "[notify] Enviando a: $TO_JSON"

if [ -z "$TO_JSON" ] || [ "$TO_JSON" = "[]" ]; then
  echo "[notify] Lista de correos vacia, no se envia nada."
  exit 0
fi

RESPONSE="$(curl -s -w '\nHTTP_STATUS:%{http_code}' -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"from\": \"LyteApp Security <onboarding@resend.dev>\",
    \"to\": $TO_JSON,
    \"subject\": \"Codespace abierto: lyteapp-web\",
    \"text\": \"Se abrio (o reanudo) el Codespace del repositorio lyteapp-web.\n\nUsuario de GitHub: $WHO\nCodespace: $CODESPACE\nFecha (UTC): $WHEN\n\nSi no reconoces esta actividad, revisa quien tiene acceso de colaborador al repositorio.\"
  }")"
echo "[notify] Respuesta de Resend: $RESPONSE"

exit 0
