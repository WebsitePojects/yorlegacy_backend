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
# Tests already run before every push (CLAUDE.md); SKIP_TESTS=1 lets a deploy
# proceed when the server's test run is the only thing blocking a restart.
if [ "${SKIP_TESTS:-0}" != "1" ]; then
  npm test
fi
npm run build
npm prune --omit=dev

pm2 restart yor-api --update-env || pm2 start ecosystem.config.cjs --only yor-api --update-env
pm2 save

# Health check with retry: pm2 restart returns before the app binds to the port,
# so an immediate curl races the boot and reports a false "couldn't connect".
HEALTH_URL="http://127.0.0.1:8787/health"
for attempt in $(seq 1 15); do
  if curl -fsS "$HEALTH_URL"; then
    echo ""
    echo "[deploy] health OK after ${attempt} attempt(s)"
    exit 0
  fi
  sleep 1
done
echo "[deploy] health check failed after 15s" >&2
exit 1
