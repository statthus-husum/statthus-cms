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
# (DB läuft erst zur Runtime). Initiales Indexieren passiert per
# `docker compose exec tina npx tinacms build` nach dem ersten Start.
RUN npm run build

# ---- runner ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

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

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
