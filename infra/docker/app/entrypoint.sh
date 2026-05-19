#!/bin/sh
set -e

# Run Prisma migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running Prisma migrations..."
  cd /app/apps/api && pnpm exec prisma migrate deploy
  echo "Migrations complete."
fi

# Start all services via supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
