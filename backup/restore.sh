#!/usr/bin/env bash
# Restore des Tina-User-Stores aus einem S3-Dump.
#
# ABLAUF (auf der VM, im /opt/cms-Verzeichnis):
#   docker compose stop tina freigabe          # Schreiber von Mongo abklemmen
#   docker compose run --rm backup restore.sh  # neuester Dump
#   #  oder gezielt:  ... restore.sh tinacms-20260516T101500Z.archive.gz[.gpg]
#   docker compose up -d tina freigabe
#   # dann Login testen (Inkognito)
#
# Spielt einen vollen `tinacms`-DB-Dump zurück (--drop). Der Content-Index
# wird beim tina-Start ohnehin aus Git neu gebaut; entscheidend ist der
# wiederhergestellte User-Store (`_appDatauser~`).
set -uo pipefail

DB="${MONGODB_DBNAME:-tinacms}"
PREFIX="userstore"

for v in MONGO_USER MONGO_PASS S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY; do
  [ -n "${!v:-}" ] || { echo "[restore] FEHLT: \$$v — /opt/cms/.env prüfen"; exit 1; }
done

mc alias set hetzner "https://${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" >/dev/null \
  || { echo "[restore] mc-Alias/S3-Verbindung fehlgeschlagen"; exit 1; }

obj="${1:-}"
if [ -z "${obj}" ]; then
  obj="$(mc ls "hetzner/${S3_BUCKET}/${PREFIX}/" 2>/dev/null | awk '{print $NF}' | sort | tail -1)"
  [ -n "${obj}" ] || { echo "[restore] kein Dump unter ${PREFIX}/ gefunden"; exit 1; }
fi
echo "[restore] verwende ${PREFIX}/${obj}"

work="$(mktemp -d)"; cd "${work}" || exit 1
mc cp --quiet "hetzner/${S3_BUCKET}/${PREFIX}/${obj}" "./${obj}" \
  || { echo "[restore] Download fehlgeschlagen"; cd /; rm -rf "${work}"; exit 1; }

src="./${obj}"
case "${obj}" in
  *.gpg)
    [ -n "${BACKUP_ENC_PASSPHRASE:-}" ] || { echo "[restore] Dump verschlüsselt, BACKUP_ENC_PASSPHRASE fehlt"; cd /; rm -rf "${work}"; exit 1; }
    printf '%s' "${BACKUP_ENC_PASSPHRASE}" | gpg --batch --yes --passphrase-fd 0 \
      -o "decrypted.archive.gz" -d "${obj}" \
      || { echo "[restore] Entschlüsselung fehlgeschlagen"; cd /; rm -rf "${work}"; exit 1; }
    src="decrypted.archive.gz" ;;
esac

echo "[restore] mongorestore --drop nach ${DB} …"
mongorestore --uri="mongodb://${MONGO_USER}:${MONGO_PASS}@mongo:27017/${DB}?authSource=admin" \
             --archive="${src}" --gzip --drop --quiet \
  || { echo "[restore] mongorestore fehlgeschlagen"; cd /; rm -rf "${work}"; exit 1; }

cd /; rm -rf "${work}"
echo "[restore] fertig. Jetzt: 'docker compose up -d tina freigabe' und Login in Inkognito testen."
