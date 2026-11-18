#!/bin/bash
# Einmalige, idempotente HumHub-Installation per CLI (Service `humhub-init`).
#
# Läuft als root VOR dem Web-Container: bereitet /data vor wie das
# Image-Entrypoint (docker-entrypoint.sh), dann installiert es HumHub über
# `yii installer/*` als www-data. Bei jedem weiteren `up` erkennt es die
# bestehende Installation und beendet sich sofort mit 0.
set -euo pipefail

log() { echo "[humhub-init] $*"; }

: "${HUMHUB_DOMAIN:?HUMHUB_DOMAIN fehlt}"
: "${HUMHUB_CONFIG__COMPONENTS__DB__PASSWORD:?HUMHUB_DB_PASS fehlt in /opt/cms/.env}"

marker=/data/config/.statthus-installed

# --- /data vorbereiten (gespiegelt aus dem Image-Entrypoint) ---
mkdir -p /data/{uploads,assets,logs,config,modules,modules-custom,themes,caddy}
touch /data/logs/app.log
cp -rn /opt/humhub/protected/config/ /data/
cp -rn /opt/humhub/uploads/ /data/
chown -R www-data:www-data /data
chmod o+x /data

yii() { /app/yii "$@"; }   # Wrapper wechselt als root automatisch zu www-data

if [ -f "$marker" ]; then
  log "bereits installiert ($(cat "$marker")) — nichts zu tun."
  exit 0
fi

# Installation, die nicht von diesem Skript stammt (z. B. Restore)? Dann nur markieren.
if yii settings/list-module admin 2>/dev/null | grep -q installationId; then
  log "bestehende Installation erkannt — setze Marker."
  date -u +%FT%TZ > "$marker"; chown www-data:www-data "$marker"
  exit 0
fi

: "${HUMHUB_ADMIN_EMAIL:?HUMHUB_ADMIN_EMAIL fehlt in /opt/cms/.env}"
: "${HUMHUB_ADMIN_PASS:?HUMHUB_ADMIN_PASS fehlt in /opt/cms/.env}"

log "installiere Datenbank-Schema …"
yii installer/install-db

log "Grundeinstellungen …"
yii installer/write-site-config "${HUMHUB_SITE_NAME:-staTThus Gemeinschaft}" "$HUMHUB_ADMIN_EMAIL"
yii installer/set-base-url "https://${HUMHUB_DOMAIN}"
yii settings/set base defaultLanguage de
yii settings/set base defaultTimeZone Europe/Berlin
yii settings/set base timeZone Europe/Berlin

log "Admin-Konto ${HUMHUB_ADMIN_USER:-admin} …"
yii installer/create-admin-account "${HUMHUB_ADMIN_USER:-admin}" "$HUMHUB_ADMIN_EMAIL" "$HUMHUB_ADMIN_PASS"

log "Zugang schließen: keine Selbstregistrierung, kein Gastzugang …"
yii settings/set user auth.anonymousRegistration 0
yii settings/set user auth.allowGuestAccess 0

date -u +%FT%TZ > "$marker"; chown www-data:www-data "$marker"
log "fertig: https://${HUMHUB_DOMAIN}"
