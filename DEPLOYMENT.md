# Deployment — consultation.herbsmagic.in

## Architecture

```
Browser ──HTTPS──> Nginx (consultation.herbsmagic.in)
                     ├─ /        static files from /root/apps/consultation-new (dist/app.js, config.js, public/)
                     └─ /api     proxy -> 127.0.0.1:5200  (PM2: hm-consultation-api, backend/server.js, SQLite)
```

- Frontend: JSX precompiled by esbuild (`npm run build` -> `dist/app.js`); `config.js` is generated from `.env`.
- Backend: its own Express + SQLite app, separate from the main Herbs Magic backend (port 5000).
- Node on the VPS is v18 and glibc is 2.31, so `better-sqlite3` is pinned to 11.10.0 and `nodemailer` to 6.x. Don't bump them without testing on the VPS.

## Ports used on this VPS

3000, 3001, 3100, 3200, 4000, 4300, 4400, 5000, 5100, 8000, 8001, 9100, 27017, 6379 are taken. This project uses **5200** (loopback only).

## Env files (never committed)

| File | Purpose |
|------|---------|
| `/root/apps/consultation-new/.env` | `CONSULTATION_API_BASE`, `RAZORPAY_KEY_ID` (public; written into `config.js`). The backend also reads `RAZORPAY_KEY_ID` from here. |
| `/root/apps/consultation-new/backend/.env` | `NODE_ENV=production`, `PORT=5200`, `HOST=127.0.0.1`, `CORS_ORIGIN`, `RAZORPAY_KEY_SECRET`, `CONSULTATION_FEE`, `SMTP_*`, `DOCTOR_EMAIL`, `ADMIN_TOKEN`. See `backend/.env.example`. |

The Razorpay key ID and secret must be from the same key pair (live with live).

## Deploy

Automatic: push to `master`; GitHub Actions SSHes in and runs `deploy.sh`.
Secrets required: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_PATH` (=`/root/apps/consultation-new`), optional `VPS_PORT`.

Manual:

```bash
cd /root/apps/consultation-new
./deploy.sh
```

`deploy.sh` resets to `origin/master`, rebuilds the frontend, installs backend deps, and runs `pm2 startOrReload ecosystem.config.js` + `pm2 save`.

## Nginx

Live vhost: `/etc/nginx/sites-available/consultation.herbsmagic.in` (SSL by certbot). Key parts:
- `root /root/apps/consultation-new;`
- `include /etc/nginx/snippets/hm-consultation-deny.conf;` — returns 404 for `backend/`, `.git`, dotfiles, `deploy.sh`, `package.json`, `*.jsx`, etc. **Keep this**: the web root is the repo, which contains `backend/.env`.
- `location /api { proxy_pass http://127.0.0.1:5200; ... }`

Reference copy of the rules: `deploy/nginx.conf`. After any change: `nginx -t && systemctl reload nginx`.

## Operations

```bash
pm2 status | grep consultation
pm2 logs hm-consultation-api --lines 50 --nostream
pm2 restart hm-consultation-api --update-env     # after editing backend/.env
curl -s http://127.0.0.1:5200/api/payments/config
curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://consultation.herbsmagic.in/api/b2b-appointments
```

Database: `backend/database.db` (SQLite, gitignored). Back it up, e.g. `cp backend/database.db /root/backups/consultation-$(date +%F).db`.

## Local development

`backend/`: `cp .env.example .env && npm i && npm start` (mock payments if no Razorpay secret and `NODE_ENV` is not production).
Frontend: set `CONSULTATION_API_BASE=http://localhost:5200` in `.env`, then `npm run dev`.

## Rollback

```bash
cp /root/consultation.nginx.bak /etc/nginx/sites-available/consultation.herbsmagic.in && systemctl reload nginx
```
(Points back at the old static folder and the port-5000 API, if the old folder still exists.)
