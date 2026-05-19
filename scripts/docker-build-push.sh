#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <namespace> [tag] [platform]"
  echo "  namespace  Docker Hub namespace (e.g. myuser)"
  echo "  tag        Image tag (default: latest)"
  echo "  platform   Target platform (default: linux/amd64)"
  exit 1
fi

NAMESPACE="$1"
TAG="${2:-latest}"
PLATFORM="${3:-linux/amd64}"

full_tag="$NAMESPACE/cards-hub:$TAG"

echo "Building & pushing $full_tag (platform=$PLATFORM) ..."
docker buildx build --platform "$PLATFORM" --push -t "$full_tag" -f infra/docker/app/Dockerfile .

echo "Done: $full_tag pushed to Docker Hub."
