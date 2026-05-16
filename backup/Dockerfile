# Backup-Sidecar: mongodump des Tina-User-Stores -> (optional gpg) -> S3.
# Basiert auf mongo:7, damit mongodump/mongorestore exakt zur DB-Version
# passen. mc = MinIO-Client (Hetzners dokumentiertes S3-Tool), gnupg für
# optionale symmetrische Verschlüsselung.
FROM mongo:7

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg tzdata \
 && curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
 && chmod +x /usr/local/bin/mc \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY backup.sh restore.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh

# CMD (kein ENTRYPOINT): Service-Default ist der Backup-Loop; ein
# `docker compose run --rm backup restore.sh [obj]` überschreibt das CMD
# sauber und startet stattdessen den Restore.
CMD ["/usr/local/bin/backup.sh"]
