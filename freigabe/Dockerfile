FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi
COPY server.js ./

USER node
EXPOSE 3001
ENV NODE_ENV=production
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","server.js"]
