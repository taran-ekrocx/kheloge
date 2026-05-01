# ─────────────────────────────────────────
# Stage 1: deps — install all dependencies
# ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install only what's needed to install deps
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

# ─────────────────────────────────────────
# Stage 2: builder — compile TypeScript
# ─────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma

# Build shared packages first, then API
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/database || true
RUN npm run build --workspace=apps/api

# ─────────────────────────────────────────
# Stage 3: runner — production image
# ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat openssl dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy built output
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/database ./packages/database

# Copy Prisma schema for migrations
COPY packages/database/prisma ./packages/database/prisma

# Copy nest-cli.json (needed by the runner)
COPY apps/api/nest-cli.json ./apps/api/nest-cli.json

USER nestjs

EXPOSE 4000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/main"]
