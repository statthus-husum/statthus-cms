# Multi-Stage Next.js Production Build (NICHT standalone — wir brauchen
# node_modules zur Laufzeit für initiale MongoDB-Indexierung via tinacms-CLI)
ARG NODE_VERSION=20

# ---- deps ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
# npm ci wenn Lockfile vorhanden (deterministisch + schneller),
# sonst npm install (erster Run, generiert das Lockfile im Container).
RUN if [ -f package-lock.json ]; then \
      npm ci --legacy-peer-deps; \
    else \
      npm install --legacy-peer-deps; \
    fi

# ---- builder ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# tinacms build --skip-indexing: generiert Schema + admin-UI ohne MongoDB-Zugriff
# (DB läuft erst zur Runtime). Initiales Indexieren passiert per Entrypoint
# beim Container-Start.
RUN npm run build

# Custom UI-Tweaks ins Admin-HTML injecten (Search-Banner verstecken etc.).
# Wird vom docker-entrypoint.sh nach jedem npx tinacms build wieder
# eingesetzt, falls dieser die Datei überschreibt.
RUN sed -i 's|</head>|<script src="/admin-tweaks.js"></script></head>|' /app/public/admin/index.html

# ---- runner ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# git: für entrypoint-clone des Content-Repos
# libc6-compat: für Next.js-binaries
RUN apk add --no-cache libc6-compat git

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Volle App + node_modules übernehmen — kein standalone-Trim
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json* ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/tina ./tina
COPY --from=builder --chown=nextjs:nodejs /app/content ./content
COPY --from=builder --chown=nextjs:nodejs /app/pages ./pages
COPY --from=builder --chown=nextjs:nodejs /app/app ./app
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# /app komplett dem nextjs-User übergeben, damit der Entrypoint
# /app/content austauschen darf
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
