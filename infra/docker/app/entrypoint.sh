#!/bin/sh
set -e

# --- Production env fail-fast -------------------------------------------
# When NODE_ENV=production, reject missing or placeholder secrets.
# Logs the variable name only -- never prints the secret value.
check_production_env() {
  if [ "$NODE_ENV" != "production" ]; then
    return 0
  fi

  echo "[entrypoint] Production env check..."

  check_required_var() {
    _var_name="$1"
    _val="$(eval echo \"\$$1\")"
    if [ -z "$_val" ]; then
      echo "ERROR: ${_var_name} is required in production but is empty."
      exit 1
    fi
    # Reject obvious placeholders
    case "$_val" in
      change-me*|changeme*|your-*|placeholder*|example*|secret*|password*)
        echo "ERROR: ${_var_name} still has a placeholder value. Set a real secret."
        exit 1
        ;;
    esac
  }

  check_required_var "JWT_SECRET"
  check_required_var "MYSQL_PASSWORD"
  check_required_var "PASSKEY_RP_ID"
  check_required_var "PASSKEY_ORIGIN"
  check_required_var "ADMIN_PASSWORD"

  # Meili key: either MEILI_API_KEY or MEILI_MASTER_KEY must be real
  if [ -z "$MEILI_API_KEY" ] && [ -z "$MEILI_MASTER_KEY" ]; then
    echo "ERROR: MEILI_API_KEY or MEILI_MASTER_KEY is required in production."
    exit 1
  fi
  if [ -n "$MEILI_API_KEY" ]; then
    check_required_var "MEILI_API_KEY"
  fi
  if [ -n "$MEILI_MASTER_KEY" ]; then
    check_required_var "MEILI_MASTER_KEY"
  fi

  echo "[entrypoint] Production env check passed."
}

# --- Wait for database to be TCP-reachable ------------------------------
# Parses host:port from DATABASE_URL via Node.js URL, retries until the
# port accepts a connection or the timeout expires.  Uses Node.js
# (already in the image) so no extra packages are needed.
wait_for_tcp() {
  _label="$1"
  _host="$2"
  _port="$3"
  _timeout_var="$4"
  _interval_var="$5"

  TIMEOUT=${_timeout_var:-120}
  INTERVAL=${_interval_var:-2}
  ELAPSED=0

  echo "[entrypoint] Waiting for ${_label} at ${_host}:${_port} (timeout ${TIMEOUT}s)..."
  while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    if node -e "
      const net = require('net');
      const s = net.createConnection(${_port}, '${_host}', () => { s.end(); process.exit(0); });
      s.on('error', () => process.exit(1));
      setTimeout(() => { s.destroy(); process.exit(1); }, 2000);
    " >/dev/null 2>&1; then
      echo "[entrypoint] ${_label} is reachable."
      return 0
    fi
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  echo "ERROR: ${_label} at ${_host}:${_port} not reachable after ${TIMEOUT}s."
  exit 1
}

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

  wait_for_tcp "database" "$DB_HOST" "$DB_PORT" "${DB_WAIT_TIMEOUT_SECONDS:-120}" "${DB_WAIT_INTERVAL_SECONDS:-2}"
}

wait_for_redis() {
  if [ -z "$REDIS_URL" ]; then
    echo "[entrypoint] REDIS_URL not set, skipping Redis check."
    return 0
  fi

  REDIS_ENV="$(node -e "
    try {
      const u = new URL(process.env.REDIS_URL);
      console.log('REDIS_HOST=' + u.hostname);
      console.log('REDIS_PORT=' + (u.port || '6379'));
    } catch (e) {
      console.error('ERROR: Failed to parse REDIS_URL:', e.message);
      process.exit(1);
    }
  ")" || { echo "ERROR: node URL parse failed for REDIS_URL"; exit 1; }

  eval "$REDIS_ENV"
  export REDIS_HOST REDIS_PORT

  wait_for_tcp "redis" "$REDIS_HOST" "$REDIS_PORT" "${SERVICE_WAIT_TIMEOUT_SECONDS:-120}" "${SERVICE_WAIT_INTERVAL_SECONDS:-2}"
}

wait_for_meili() {
  if [ -z "$MEILI_HOST" ]; then
    echo "[entrypoint] MEILI_HOST not set, skipping Meilisearch check."
    return 0
  fi

  MEILI_ENV="$(node -e "
    try {
      const u = new URL(process.env.MEILI_HOST);
      console.log('MEILI_HOSTNAME=' + u.hostname);
      console.log('MEILI_PORT=' + (u.port || (u.protocol === 'https:' ? '443' : '80')));
    } catch (e) {
      console.error('ERROR: Failed to parse MEILI_HOST:', e.message);
      process.exit(1);
    }
  ")" || { echo "ERROR: node URL parse failed for MEILI_HOST"; exit 1; }

  eval "$MEILI_ENV"
  export MEILI_HOSTNAME MEILI_PORT

  wait_for_tcp "meilisearch" "$MEILI_HOSTNAME" "$MEILI_PORT" "${SERVICE_WAIT_TIMEOUT_SECONDS:-120}" "${SERVICE_WAIT_INTERVAL_SECONDS:-2}"
}

# --- Boot ---------------------------------------------------------------
echo "========================================"
echo " Cards hub production boot"
echo "========================================"
echo "[entrypoint] NODE_ENV=${NODE_ENV:-<not set>}"
echo "[entrypoint] PORT=${PORT:-3000}"
echo "[entrypoint] STORAGE_DIR=${STORAGE_DIR:-<not set>}"

# Extract and display host:port for DB/Redis/Meili (no secrets)
node -e "
  try {
    const db = new URL(process.env.DATABASE_URL || '');
    console.log('[entrypoint] DB=' + db.hostname + ':' + (db.port || '3306'));
  } catch {}
  try {
    const r = new URL(process.env.REDIS_URL || '');
    console.log('[entrypoint] Redis=' + r.hostname + ':' + (r.port || '6379'));
  } catch {}
  try {
    const m = new URL(process.env.MEILI_HOST || '');
    console.log('[entrypoint] Meili=' + m.hostname + ':' + (m.port || (m.protocol === 'https:' ? '443' : '80')));
  } catch {}
"

# Step 1: validate production env
check_production_env

# Step 2: wait for all dependencies
wait_for_db
wait_for_redis
wait_for_meili

# Step 3: run Prisma migrations if requested
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Running Prisma migrations..."
  cd /app/apps/api && pnpm exec prisma migrate deploy
  echo "[entrypoint] Migrations complete."
fi

echo "[entrypoint] Starting supervisord..."
# Start all services via supervisord
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
