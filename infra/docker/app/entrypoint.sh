#!/bin/sh
set -e

# --- Wait for database to be TCP-reachable -----------------------------
# Parses host:port from DATABASE_URL via Node.js URL, retries until the
# port accepts a connection or the timeout expires.  Uses Node.js
# (already in the image) so no extra packages are needed.
wait_for_db() {
  if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set."
    exit 1
  fi

  DB_ENV="$(node -e "
    try {
      const u = new URL(process.env.DATABASE_URL);
      console.log('DB_HOST=' + u.hostname);
      console.log('DB_PORT=' + (u.port || '3306'));
    } catch (e) {
      console.error('ERROR: Failed to parse DATABASE_URL:', e.message);
      process.exit(1);
    }
  ")" || { echo "ERROR: node URL parse failed"; exit 1; }

  if [ -z "$DB_ENV" ]; then
    echo "ERROR: node produced empty output parsing DATABASE_URL."
    exit 1
  fi

  eval "$DB_ENV"
  export DB_HOST DB_PORT

  if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
    echo "ERROR: DB_HOST or DB_PORT is empty after parsing DATABASE_URL."
    exit 1
  fi

  TIMEOUT=${DB_WAIT_TIMEOUT_SECONDS:-120}
  INTERVAL=${DB_WAIT_INTERVAL_SECONDS:-2}
  ELAPSED=0

  echo "Waiting for database ${DB_HOST}:${DB_PORT} (timeout ${TIMEOUT}s)..."
  while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    if node -e "
      const net = require('net');
      const host = process.env.DB_HOST;
      const port = Number(process.env.DB_PORT);
      const s = net.createConnection(port, host, () => { s.end(); process.exit(0); });
      s.on('error', () => process.exit(1));
      setTimeout(() => { s.destroy(); process.exit(1); }, 2000);
    " >/dev/null 2>&1; then
      echo "Database is reachable."
      return 0
    fi
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  echo "ERROR: Database ${DB_HOST}:${DB_PORT} not reachable after ${TIMEOUT}s."
  exit 1
}

# Run Prisma migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
  wait_for_db
  echo "Running Prisma migrations..."
  cd /app/apps/api && pnpm exec prisma migrate deploy
  echo "Migrations complete."
fi

# Start all services via supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
