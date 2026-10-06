FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates git curl poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
ENV NODE_ENV=CI
RUN npm ci --no-audit --no-fund && npm ci --prefix api/server/services/MarketAnalysis --no-audit --no-fund && npm ci --prefix api/server/services/SupplierTools --no-audit --no-fund
RUN NODE_OPTIONS="--max-old-space-size=6144" npm run build && npm prune --omit=dev
RUN mkdir -p /app/uploads /app/logs /app/secrets && chown -R node:node /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3080
EXPOSE 3080
CMD ["sh", "-c", "node scripts/bootstrap.cjs && npm start"]
