#!/usr/bin/env bash
# Build teamorbit and start or reload it under PM2.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is required. Install with: npm install -g pm2" >&2
  exit 1
fi

if [[ ! -f api/.env ]]; then
  echo "Missing api/.env. Copy api/.env.example and set production values." >&2
  exit 1
fi

mkdir -p logs

echo "==> Building client"
npm --prefix packages/client ci
npm --prefix packages/client run build

echo "==> Building API"
npm --prefix api ci
npm --prefix api run prisma:generate
npm --prefix api run build
(
  cd api
  npx prisma migrate deploy
)

echo "==> Building web"
npm --prefix web ci
npm --prefix web run build

echo "==> Starting PM2"
if pm2 describe teamorbit-api >/dev/null 2>&1; then
  pm2 reload "$root/ecosystem.config.cjs" --update-env
else
  pm2 start "$root/ecosystem.config.cjs"
fi

pm2 save
pm2 status

echo
echo "API health: http://127.0.0.1:3000/api/health (or api/.env PORT)"
echo "Web UI:     http://127.0.0.1:4173"
echo "Set PUBLIC_BASE_URL in api/.env to the public browser origin."
