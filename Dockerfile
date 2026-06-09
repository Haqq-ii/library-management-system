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

# Stage 3: builder — build the Next.js production output
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: runner — minimal production image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy standalone output for minimal image size
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
