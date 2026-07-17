# Production image for the Nuxt app. Works in both monorepo and standalone mode.
#
# Monorepo (build context = monorepo root):
#   docker build -f projects/app/Dockerfile --build-arg API_DIR=projects/api \
#     --build-arg APP_DIR=projects/app --build-arg APP_VERSION_COMMIT=$CI_COMMIT_SHA .
# Standalone (build context = the app repo root, APP_DIR defaults to .):
#   docker build --build-arg APP_VERSION_COMMIT=$CI_COMMIT_SHA .

ARG APP_DIR=.

# Stage 1: Install dependencies
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS deps
WORKDIR /app

# Copy every package.json (+ the workspace files) so pnpm resolves deps in both
# monorepo (multiple project manifests) and standalone (a single root manifest)
# mode. Copying everything then installing is the simplest cross-mode approach —
# mirrors projects/api/Dockerfile.
COPY . /tmp/src
RUN find /tmp/src -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" \
      -exec sh -c 'dir=$(dirname "$1" | sed "s|^/tmp/src|.|"); mkdir -p "/app/$dir"; cp "$1" "/app/$dir/"' _ {} \; \
    && cp -f /tmp/src/pnpm-lock.yaml /app/ 2>/dev/null || true \
    && cp -f /tmp/src/pnpm-workspace.yaml /app/ 2>/dev/null || true \
    && cp -f /tmp/src/.npmrc /app/ 2>/dev/null || true \
    && rm -rf /tmp/src

# Provision the exact pnpm declared in package.json (single source of truth).
# No corepack: Node >= 25 no longer ships it. The +sha512 suffix is stripped;
# npm enforces registry integrity for the tarball itself.
RUN npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")"

# Install dependencies (--ignore-scripts prevents husky/simple-git-hooks errors in Docker)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Stage 2: Build
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS builder
ARG APP_DIR=.
WORKDIR /app

# Deployment environment, baked into the bundle. Docs layer + dev widgets are a
# BUILD choice (see nuxt.config.ts): unset stays production; a staging pipeline
# passes --build-arg NUXT_PUBLIC_APP_ENV=development to ship them. It must live in
# the builder (not the runner) because these options freeze at `nuxt build` time.
ARG NUXT_PUBLIC_APP_ENV
ENV NUXT_PUBLIC_APP_ENV=$NUXT_PUBLIC_APP_ENV

COPY --from=deps /app ./
COPY ${APP_DIR}/ ./${APP_DIR}/

# Provision the exact pnpm declared in package.json (single source of truth).
# No corepack: Node >= 25 no longer ships it. The +sha512 suffix is stripped;
# npm enforces registry integrity for the tarball itself.
RUN npm install -g "$(node -p "require('./package.json').packageManager.split('+')[0]")"

# Primary filter for the COPY above is the build CONTEXT ROOT `.dockerignore`
# (lt-monorepo ships one; it excludes `**/node_modules`, `**/.output`, `**/.env`,
# …) — Docker never reads `projects/app/.dockerignore` for a root-context build.
# The rm below is a cheap secondary guard for the three build-read artefacts that
# must never influence the bundle even if that root file is missing or edited: a
# stale `.output`/`.nuxt` and a developer's `.env` (which `nuxt build` reads).
# `node_modules` is deliberately NOT purged here — it comes from the deps stage
# and removing it would break the build; only `.dockerignore` can keep a host
# copy out, which is why the root file, not this rm, is the real safeguard.
#
# Build by workspace DIRECTORY, not by package name: the app package is named
# `nuxt-base-template` (`lt fullstack init` does not rename it), so
# `pnpm --filter app` matches nothing — and pnpm exits 0 on a no-match, silently
# skipping the build. `cd` is name-agnostic and fails loudly. This mirrors
# projects/api/Dockerfile, which uses `cd ${API_DIR} && pnpm run build`.
RUN rm -rf ${APP_DIR}/.output ${APP_DIR}/.nuxt ${APP_DIR}/.env \
    && cd ${APP_DIR} \
    && pnpm run build

# Stage 3: Production runner
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runner
ARG APP_DIR=.
WORKDIR /app
# Pin the listen address instead of relying on Nitro's implicit defaults — the
# same "don't trust the implicit port" reasoning the smoke test applies with
# NITRO_PORT. Self-documents the EXPOSE below and survives a future Nitro default
# change. HOST=0.0.0.0 is required so the server is reachable from outside the
# container; compose maps host 3001 -> container 3000.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Nuxt output is self-contained (Nitro bundles all dependencies)
COPY --from=builder --chown=nodejs:nodejs /app/${APP_DIR}/.output ./.output

# Build identity for /app/admin/system, which compares it against the API's
# GET /meta to spot a stale container after a partial rollout. Injected at
# RUNTIME: on boot Nitro applies every NUXT_PUBLIC_* env var over
# runtimeConfig.public, so the commit needs no rebuild. Keeping it out of the
# builder stage also keeps the expensive `nuxt build` layer cacheable — an ARG
# in scope is added to every following RUN's environment and would invalidate
# that layer on every commit. APP_VERSION_COMMIT is the arg name that
# docker-compose.yml already passes.
ARG APP_VERSION_COMMIT=unknown
ENV NUXT_PUBLIC_APP_COMMIT=$APP_VERSION_COMMIT

USER nodejs
EXPOSE 3000

# Container-level liveness probe so an orchestrator (compose `depends_on:
# condition: service_healthy`, swarm, k8s) can gate on a real render, not just a
# running PID. Alpine has no curl; busybox `wget` is built in. Hits `/` (the
# public landing page, renders 200 even with the API down). start-period covers
# the Nitro boot before failures count.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", ".output/server/index.mjs"]
