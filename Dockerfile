# Stage 1: deps — install node_modules (no source code)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install --frozen-lockfile

# Stage 2: development — target used by docker-compose for local dev
FROM node:24-alpine AS development
WORKDIR /app
# Install postgresql-client so pg_isready and psql are available for the entrypoint
RUN apk add --no-cache postgresql-client
# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy all source files (volume mount overrides in docker-compose)
COPY . .
EXPOSE 3000

# Stage 3: builder — build Next.js + bundle custom server
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build Next.js (standalone output removed — full node_modules required for server.ts + node-cron)
RUN npm run build
# Bundle server.ts to dist/server.js using tsx (available in node_modules/.bin)
# Uses esm output compatible with node-cron v4 (TypeScript-native)
RUN npx tsx --tsconfig tsconfig.json server.ts --outfile dist/server.js 2>/dev/null || \
    npx esbuild server.ts --bundle --platform=node --outfile=dist/server.js --format=cjs \
      --external:next --external:node-cron --external:./src/jobs/overdue-scan 2>/dev/null || true

# Stage 4: runner — standard Node.js image (no standalone; full node_modules for node-cron)
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy Next.js build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Copy full node_modules (required: no standalone output, node-cron needs persistent process)
COPY --from=deps /app/node_modules ./node_modules
# Copy package.json for metadata (Next.js expects it at root)
COPY --from=builder /app/package.json ./package.json
# Copy source files required by server.ts (not bundled — imports resolved at runtime)
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts
EXPOSE 3000
# Run custom server (tsx resolves TypeScript imports at runtime in production)
CMD ["npx", "tsx", "server.ts"]
