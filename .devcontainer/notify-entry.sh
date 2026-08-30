#!/usr/bin/env bash
# Security alert: emails everyone in ADMIN_EMAILS whenever this Codespace
# starts (fresh create or resumed from stopped). Both RESEND_API_KEY and
# ADMIN_EMAILS must be set as Codespaces secrets for this repo — if either
# is missing (e.g. a collaborator without them configured yet), this exits
# quietly instead of failing the container start.
set -e

if [ -z "$RESEND_API_KEY" ] || [ -z "$ADMIN_EMAILS" ]; then
  exit 0
fi

WHO="${GITHUB_USER:-desconocido}"
WHEN="$(date -u '+%Y-%m-%d %H:%M UTC')"
CODESPACE="${CODESPACE_NAME:-desconocido}"

TO_JSON="$(node -e "console.log(JSON.stringify(process.env.ADMIN_EMAILS.split(',').map(e => e.trim()).filter(Boolean)))" 2>/dev/null)"

if [ -z "$TO_JSON" ] || [ "$TO_JSON" = "[]" ]; then
  exit 0
fi

curl -s -X POST 'https://api.resend.com/emails' \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "{
    \"from\": \"LyteApp Security <onboarding@resend.dev>\",
    \"to\": $TO_JSON,
    \"subject\": \"Codespace abierto: lyteapp-web\",
    \"text\": \"Se abrio (o reanudo) el Codespace del repositorio lyteapp-web.\n\nUsuario de GitHub: $WHO\nCodespace: $CODESPACE\nFecha (UTC): $WHEN\n\nSi no reconoces esta actividad, revisa quien tiene acceso de colaborador al repositorio.\"
  }" > /dev/null 2>&1 || true

exit 0
