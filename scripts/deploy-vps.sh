#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/yor-backend}"
BRANCH="${BRANCH:-main}"
REMOTE_NAME="${REMOTE_NAME:-origin}"

cd "$APP_DIR"

git fetch "$REMOTE_NAME" "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only "$REMOTE_NAME" "$BRANCH"

npm ci
npm test
npm run build
npm prune --omit=dev

pm2 restart yor-api --update-env || pm2 start ecosystem.config.cjs --only yor-api --update-env
pm2 save

curl -fsS http://127.0.0.1:8787/health
