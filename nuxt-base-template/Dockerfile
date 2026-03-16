# Stage 1: Install dependencies
FROM node:22-alpine@sha256:8094c002d08262dba12645a3b4a15cd6cd627d30bc782f53229a2ec13ee22a00 AS deps
WORKDIR /app
RUN corepack enable

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all project manifests (required for pnpm workspace resolution)
COPY projects/api/package.json ./projects/api/
COPY projects/app/package.json ./projects/app/

# Install dependencies (--ignore-scripts prevents husky/simple-git-hooks errors in Docker)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Build
FROM node:22-alpine@sha256:8094c002d08262dba12645a3b4a15cd6cd627d30bc782f53229a2ec13ee22a00 AS builder
WORKDIR /app
RUN corepack enable

COPY --from=deps /app ./
COPY projects/app/ ./projects/app/

RUN pnpm --filter app run build

# Stage 3: Production runner
FROM node:22-alpine@sha256:8094c002d08262dba12645a3b4a15cd6cd627d30bc782f53229a2ec13ee22a00 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Nuxt output is self-contained (Nitro bundles all dependencies)
COPY --from=builder --chown=nodejs:nodejs /app/projects/app/.output ./.output

USER nodejs
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
