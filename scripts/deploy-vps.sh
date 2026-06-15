#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/yor-backend}"
BRANCH="${BRANCH:-main}"
REMOTE_NAME="${REMOTE_NAME:-origin}"

cd "$APP_DIR"

# Discard any locally-modified tracked files that are gitignored on origin
# (dev-data sandbox JSON diverges on the server — production uses Supabase, not this file)
git checkout -- dev-data/ 2>/dev/null || true

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
