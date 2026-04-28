#!/bin/sh
# Tina-Container-Entrypoint:
# 1. Klont das Hugo-Content-Repo (nur die für Tina relevanten Pfade)
# 2. Sichert public/admin/ als Backup für OOM-Recovery
# 3. Baut den Tina-Index (gegen MongoDB)
# 4. Stellt admin/ aus Backup wieder her, falls Build mid-flight gekillt wurde
# 5. Re-injectet admin-tweaks.js (wird durch tinacms build überschrieben)
# 6. Startet npm start
set -e

CONTENT_DIR=/app/content
TEMP_DIR=/tmp/statthus-content-clone
ADMIN_BACKUP=/tmp/admin-backup

# ---- 1. Content selektiv vom Website-Repo klonen ----
# WICHTIG: Wir kopieren NUR die für Tina-Collections relevanten Pfade. Sonst
# zieht Tina das ganze Hugo-Theme-Demo-Content-Verzeichnis ein und der Build
# OOM-killed bei kleineren VMs.
TINA_PATHS="content/users content/german/event content/german/news content/german/people content/german/themen"

if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ] && [ -n "$GITHUB_OWNER" ] && [ -n "$GITHUB_REPO" ]; then
  echo "[entrypoint] Refreshing content from $GITHUB_OWNER/$GITHUB_REPO@${GITHUB_BRANCH:-main}"
  rm -rf "$TEMP_DIR"
  if git clone --quiet --depth=1 -b "${GITHUB_BRANCH:-main}" \
       "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git" \
       "$TEMP_DIR"; then

    # Ziel-Verzeichnisse leeren, dann die fünf Tina-Collections selektiv kopieren
    rm -rf "$CONTENT_DIR"
    mkdir -p "$CONTENT_DIR/german" "$CONTENT_DIR/users"
    for p in $TINA_PATHS; do
      if [ -d "$TEMP_DIR/$p" ]; then
        # Zielpfad ohne führendes "content/"
        target="$CONTENT_DIR/${p#content/}"
        mkdir -p "$(dirname "$target")"
        cp -r "$TEMP_DIR/$p" "$target"
      fi
    done

    MD_COUNT=$(find "$CONTENT_DIR" -name '*.md' 2>/dev/null | wc -l)
    JSON_COUNT=$(find "$CONTENT_DIR" -name '*.json' 2>/dev/null | wc -l)
    echo "[entrypoint] Content synced: $MD_COUNT markdown, $JSON_COUNT json (selektiv aus 5 Tina-Pfaden)"
  else
    echo "[entrypoint] WARN: git clone fehlgeschlagen — nutze existierenden lokalen Content"
  fi
  rm -rf "$TEMP_DIR"
else
  echo "[entrypoint] GITHUB_* Env-Vars fehlen — überspringe Content-Klon"
fi

# ---- 2. admin/ sichern (OOM-Recovery) ----
if [ -d /app/public/admin ] && [ -f /app/public/admin/index.html ]; then
  echo "[entrypoint] Backup admin/ -> $ADMIN_BACKUP"
  rm -rf "$ADMIN_BACKUP"
  cp -r /app/public/admin "$ADMIN_BACKUP"
fi

# ---- 3. Tina-Index neu aufbauen ----
echo "[entrypoint] Tina-Index wird gebaut..."
if npx tinacms build 2>&1 | tail -3; then
  echo "[entrypoint] Index-Build OK"
else
  echo "[entrypoint] WARN: tinacms build hat Probleme — versuche admin/-Recovery"
fi

# ---- 4. admin/ aus Backup wiederherstellen, falls Build kaputt ist ----
if [ ! -f /app/public/admin/index.html ] && [ -f "$ADMIN_BACKUP/index.html" ]; then
  echo "[entrypoint] WARN: admin/index.html fehlt nach Build (vermutlich OOM) — restore aus Backup"
  rm -rf /app/public/admin
  cp -r "$ADMIN_BACKUP" /app/public/admin
fi

# ---- 5. admin-tweaks.js wieder einsetzen ----
if [ -f /app/public/admin/index.html ] && ! grep -q admin-tweaks /app/public/admin/index.html; then
  sed -i 's|</head>|<script src="/admin-tweaks.js"></script></head>|' /app/public/admin/index.html
  echo "[entrypoint] admin-tweaks.js wieder injiziert"
fi

echo "[entrypoint] Starte: $*"
exec "$@"
