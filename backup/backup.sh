#!/usr/bin/env bash
# Periodischer Backup-Job für den Tina-User-Store.
#
# WARUM: Editor-Accounts (inkl. Passwort-Hashes) liegen ausschließlich in
# MongoDB als Datalayer-App-Data (`_appDatauser~content/users/index.json`).
# Sie werden NIE nach Git committet. Ein Mongo-Wipe / `docker compose down -v`
# / VM-Neuaufbau löscht damit alle Accounts. Dieser Job sichert sie nach
# Hetzner Object Storage (Bucket kommt aus statthus-infra).
#
# Gesichert wird ein voller Dump der `tinacms`-DB: der Content-Index
# reindexiert beim tina-Start ohnehin aus Git, kritisch ist allein der
# User-Store, der nur hier existiert. Voll-Dump = robust und simpel.
#
# Env (aus /opt/cms/.env via docker-compose):
#   Pflicht : MONGO_USER MONGO_PASS S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY
#   Optional: MONGODB_DBNAME (tinacms) S3_REGION (fsn1)
#             BACKUP_INTERVAL  Sekunden zwischen Läufen (Default 21600 = 6h)
#             BACKUP_RETENTION Tage; ältere Dumps werden gelöscht (Default 30)
#             BACKUP_ENC_PASSPHRASE  gesetzt -> gpg AES256 symmetrisch
set -uo pipefail

DB="${MONGODB_DBNAME:-tinacms}"
INTERVAL="${BACKUP_INTERVAL:-21600}"
RETENTION="${BACKUP_RETENTION:-30}"
PREFIX="userstore"

config_ok() {
  for v in MONGO_USER MONGO_PASS S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY; do
    [ -n "${!v:-}" ] || { echo "[backup] FEHLT: \$$v — Job pausiert, /opt/cms/.env füllen und 'docker compose up -d backup'"; return 1; }
  done
}

run_backup() {
  mc alias set hetzner "https://${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" >/dev/null || return 1

  local ts work archive upload key
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  work="$(mktemp -d)"
  archive="${work}/tinacms-${ts}.archive.gz"

  if ! mongodump --uri="mongodb://${MONGO_USER}:${MONGO_PASS}@mongo:27017/${DB}?authSource=admin" \
                 --db="${DB}" --archive="${archive}" --gzip --quiet; then
    rm -rf "${work}"; return 1
  fi

  upload="${archive}"
  if [ -n "${BACKUP_ENC_PASSPHRASE:-}" ]; then
    if ! printf '%s' "${BACKUP_ENC_PASSPHRASE}" | gpg --batch --yes --passphrase-fd 0 \
           --symmetric --cipher-algo AES256 -o "${archive}.gpg" "${archive}"; then
      rm -rf "${work}"; return 1
    fi
    upload="${archive}.gpg"
  fi

  key="${PREFIX}/$(basename "${upload}")"
  if ! mc cp --quiet "${upload}" "hetzner/${S3_BUCKET}/${key}"; then
    rm -rf "${work}"; return 1
  fi
  echo "[backup] hochgeladen ${key} ($(du -h "${upload}" | cut -f1))"

  # Retention: alte Objekte im Prefix entfernen (best effort).
  mc rm --recursive --force --older-than "${RETENTION}d" \
     "hetzner/${S3_BUCKET}/${PREFIX}/" >/dev/null 2>&1 || true

  rm -rf "${work}"
}

echo "[backup] Start — interval=${INTERVAL}s retention=${RETENTION}d enc=$([ -n "${BACKUP_ENC_PASSPHRASE:-}" ] && echo on || echo off)"
while true; do
  if config_ok; then
    if run_backup; then :; else echo "[backup] WARN: Lauf fehlgeschlagen — nächster Versuch in ${INTERVAL}s"; fi
    sleep "${INTERVAL}"
  else
    sleep 60
  fi
done
