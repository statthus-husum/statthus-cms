#!/bin/sh
# Tina-Container-Entrypoint:
# 1. Klont das Hugo-Content-Repo, damit Tina lokal indexieren kann
# 2. Baut den Tina-Index (gegen MongoDB)
# 3. Re-injectet admin-tweaks.js (wird durch `tinacms build` aus dem
#    Dockerfile-Builder überschrieben)
# 4. Startet npm start (oder was auch immer als CMD übergeben wurde)
set -e

CONTENT_DIR=/app/content
TEMP_DIR=/tmp/statthus-content-clone

# ---- Content vom Website-Repo klonen ----
if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ] && [ -n "$GITHUB_OWNER" ] && [ -n "$GITHUB_REPO" ]; then
  echo "[entrypoint] Refreshing content from $GITHUB_OWNER/$GITHUB_REPO@${GITHUB_BRANCH:-main}"
  rm -rf "$TEMP_DIR"
  if git clone --quiet --depth=1 -b "${GITHUB_BRANCH:-main}" \
       "https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git" \
       "$TEMP_DIR"; then
    if [ -d "$TEMP_DIR/content" ]; then
      rm -rf "$CONTENT_DIR"
      mv "$TEMP_DIR/content" "$CONTENT_DIR"
      MD_COUNT=$(find "$CONTENT_DIR" -name '*.md' 2>/dev/null | wc -l)
      JSON_COUNT=$(find "$CONTENT_DIR" -name '*.json' 2>/dev/null | wc -l)
      echo "[entrypoint] Content synced: $MD_COUNT markdown files, $JSON_COUNT json files"
    else
      echo "[entrypoint] WARN: kein content/ im geklonten Repo gefunden"
    fi
  else
    echo "[entrypoint] WARN: git clone fehlgeschlagen — nutze existierenden lokalen Content"
  fi
  rm -rf "$TEMP_DIR"
else
  echo "[entrypoint] GITHUB_* Env-Vars fehlen — überspringe Content-Klon"
fi

# ---- Tina-Index neu aufbauen ----
echo "[entrypoint] Tina-Index wird gebaut..."
if npx tinacms build 2>&1 | tail -3; then
  echo "[entrypoint] Index-Build OK"
else
  echo "[entrypoint] WARN: tinacms build hat Probleme — Container startet trotzdem"
fi

# ---- admin-tweaks.js wieder einsetzen ----
# `tinacms build` regeneriert /app/public/admin/index.html und entfernt dabei
# unsere sed-Injektion aus dem Dockerfile-Builder.
if [ -f /app/public/admin/index.html ] && ! grep -q admin-tweaks /app/public/admin/index.html; then
  sed -i 's|</head>|<script src="/admin-tweaks.js"></script></head>|' /app/public/admin/index.html
  echo "[entrypoint] admin-tweaks.js wieder injiziert"
fi

echo "[entrypoint] Starte: $*"
exec "$@"
