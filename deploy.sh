#!/usr/bin/env bash
# Run on the VPS from the repo root (/root/apps/consultation): ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

BRANCH="${BRANCH:-master}"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# Frontend: config.js from .env, then compile JSX
[ -f .env ] || { echo "Missing .env (copy .env.example)"; exit 1; }
npm ci
npm run build

# Backend (own PM2 process: hm-consultation-api on port 5200)
[ -f backend/.env ] || { echo "Missing backend/.env (copy backend/.env.example)"; exit 1; }
mkdir -p logs
(cd backend && npm ci --omit=dev)
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
echo "Deployed."
