#!/bin/sh
set -e

# Check if node_modules exists and if package.json has changed
PACKAGE_HASH_FILE="/app/.package-hash"
CURRENT_HASH=$(md5sum /app/package.json /app/pnpm-lock.yaml 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -d "/app/node_modules" ] || [ ! -f "$PACKAGE_HASH_FILE" ] || [ "$(cat $PACKAGE_HASH_FILE 2>/dev/null)" != "$CURRENT_HASH" ]; then
    echo "Installing dependencies..."
    pnpm install --frozen-lockfile
    echo "$CURRENT_HASH" > "$PACKAGE_HASH_FILE"
    echo "Dependencies installed successfully."
else
    echo "Dependencies are up to date."
fi

# Prepare Nuxt (generate types, etc.)
echo "Preparing Nuxt..."
npx nuxt prepare

exec "$@"
