#!/bin/sh
# Pre-release quality gate for Cards hub.
# Usage: ./scripts/release-check.sh [--push] [namespace] [tag] [platform]
set -e

PUSH=false
NAMESPACE="kanggejie"
TAG="v1"
PLATFORM="linux/amd64"

while [ $# -gt 0 ]; do
  case "$1" in
    --push) PUSH=true; shift ;;
    *) NAMESPACE="$1"; shift; TAG="${1:-v1}"; shift; PLATFORM="${1:-linux/amd64}"; shift ;;
  esac
done

step() {
  name="$1"
  shift
  echo ""
  echo "=== $name ==="
  "$@"
  echo "PASS: $name"
}

step "Build all packages"           pnpm build
step "Typecheck"                    pnpm typecheck
step "Tests"                        pnpm test
step "Lint (typecheck + encoding)"  pnpm lint
# Inject temporary defaults for required env vars so config validation
# works without a real .env file. Existing values are preserved.
_CONFIG_VARS="MYSQL_ROOT_PASSWORD MYSQL_PASSWORD MEILI_MASTER_KEY DOCKERHUB_NAMESPACE PASSKEY_RP_ID PASSKEY_ORIGIN JWT_SECRET"
for _v in $_CONFIG_VARS; do
  eval "_saved_${_v}=\"\${${_v}-}\""
  eval "[ -z \"\${${_v}}\" ] && export ${_v}=config-check-placeholder"
done
step "Prod compose config"          docker compose -f docker-compose.prod.yml config --quiet
for _v in $_CONFIG_VARS; do
  eval "_val=\"\${_saved_${_v}}\""
  if [ -z "$_val" ]; then eval "unset ${_v}"; else eval "export ${_v}=\"\${_val}\""; fi
done

if [ "$PUSH" = "true" ]; then
  step "Docker buildx push" ./scripts/docker-build-push.sh "$NAMESPACE" "$TAG" "$PLATFORM"
  echo ""
  echo "Image pushed: ${NAMESPACE}/cards-hub:${TAG}"
fi

echo ""
echo "All release checks passed."
