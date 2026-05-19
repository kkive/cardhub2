#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running Prisma migrations..."
  pnpm exec prisma migrate deploy
fi

echo "Starting application..."
exec "$@"
