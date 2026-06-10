# Deployment Guide — consultation.herbsmagic.in

## Architecture

Static HTML/JSX site served by Nginx. No build step. API calls proxied to the existing Herbs Magic backend on port 5000.

```
Local machine  →  GitHub (main)  →  VPS (pull & regenerate config)
```

---

## Step 1 — Push changes from local machine

```bash
git add .
git commit -m "your message"
git push origin master
```

---

## Step 2 — SSH into VPS and deploy

```bash
ssh root@62.72.12.185
cd /root/apps/consultation
git pull origin master
node generate-config.js
```

> `generate-config.js` reads `.env` and regenerates `config.js`. Nginx picks up changes immediately — no restart needed.

---

## If you change environment variables

Edit `.env` on the VPS, then regenerate:

```bash
nano /root/apps/consultation/.env
node /root/apps/consultation/generate-config.js
```

---

## Useful VPS Commands

```bash
# Check Nginx status
systemctl status nginx

# Reload Nginx (after config changes)
systemctl reload nginx

# View Nginx error logs
tail -f /var/log/nginx/error.log

# View Nginx access logs
tail -f /var/log/nginx/access.log

# Check current config.js values
cat /root/apps/consultation/config.js

# Check backend (API) is running
pm2 status
curl http://127.0.0.1:5000/api/payments/config
```

---

## VPS Quick Reference

| Item | Value |
|------|-------|
| IP | `62.72.12.185` |
| Domain | `consultation.herbsmagic.in` |
| Code path | `/root/apps/consultation` |
| Nginx config | `/etc/nginx/sites-available/consultation.herbsmagic.in` |
| Env file | `/root/apps/consultation/.env` |
| SSL cert | `/etc/letsencrypt/live/consultation.herbsmagic.in/` (expires 2026-09-08) |
| Backend API | `localhost:5000` (PM2 process: `server`, id 0) |

---

## Renew SSL (if needed)

Certbot auto-renews, but to force renew manually:

```bash
certbot renew --nginx
```
