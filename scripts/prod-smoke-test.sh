#!/bin/sh
# Smoke test for production deployment.
# Run on the server after docker compose up -d.
set -e

COMPOSE_FILE="docker-compose.prod.yml"
LIVE_URL="http://127.0.0.1:3000/api/live"
HEALTH_URL="http://127.0.0.1:3000/api/health"
WEB_URL="http://127.0.0.1:8000"

echo "=== Cards hub production smoke test ==="
echo ""

# 1. Check .env exists
if [ ! -f .env ]; then
  echo "FAIL: .env file not found. Copy .env.production.example to .env and fill in secrets."
  exit 1
fi
echo "PASS: .env file exists."

# 2. Validate compose config
if ! docker compose -f "$COMPOSE_FILE" config --quiet 2>/dev/null; then
  echo "FAIL: docker compose config validation failed."
  exit 1
fi
echo "PASS: docker compose config is valid."

# 3. Show app image name
APP_IMAGE=$(docker compose -f "$COMPOSE_FILE" config --format json 2>/dev/null | grep -o '"image":"[^"]*cards-hub[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$APP_IMAGE" ]; then
  echo "INFO: App image = $APP_IMAGE"
else
  echo "WARN: Could not determine app image name."
fi

# 4. Check container status
echo ""
echo "--- Container status ---"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

# 5. Wait for API to be ready (up to 90s)
echo ""
echo "Waiting for API at $LIVE_URL ..."
ATTEMPTS=0
MAX_ATTEMPTS=45
while [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
  if curl -sf "$LIVE_URL" >/dev/null 2>&1; then
    echo "PASS: /api/live responded 200."
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 2
done
if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
  echo "FAIL: /api/live did not respond after $((MAX_ATTEMPTS * 2))s."
  exit 1
fi

# 6. Check /api/health
echo ""
echo "--- Health check ---"
HEALTH_RESP=$(curl -sf "$HEALTH_URL" 2>/dev/null) || true
if [ -n "$HEALTH_RESP" ]; then
  echo "$HEALTH_RESP" | head -c 500
  echo ""
  if echo "$HEALTH_RESP" | grep -q '"status":"ok"'; then
    echo "PASS: /api/health status=ok"
  else
    echo "WARN: /api/health returned non-ok status."
  fi
else
  echo "FAIL: /api/health did not respond."
  exit 1
fi

# 7. Check web frontend
echo ""
echo "--- Web frontend ---"
WEB_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null) || true
if [ "$WEB_CODE" = "200" ]; then
  echo "PASS: Web frontend at $WEB_URL returned HTTP 200."
else
  echo "WARN: Web frontend returned HTTP $WEB_CODE (expected 200)."
fi

echo ""
echo "=== Smoke test complete ==="
