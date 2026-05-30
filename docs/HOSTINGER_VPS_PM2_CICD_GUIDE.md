# Yor International Backend - Hostinger VPS PM2 and GitHub CI/CD Guide

This guide deploys the `yor_backend` Express API to a Hostinger Ubuntu VPS with PM2, Nginx, HTTPS, and GitHub-based deployment.

It is based on the local Nogatu and KOW VPS notes, but adjusted for Yor:

- Backend repo: `https://github.com/WebsitePojects/yorlegacy_backend.git`
- Suggested public API domain: `https://api.yorinternational.net`
- Backend default port: `8787`
- Frontend domain allowlist: `https://yorinternational.net,https://www.yorinternational.net`
- Health check endpoint: `/health`

Do not commit production `.env` files or secrets.

---

## 1. Server Assumptions

The existing Hostinger VPS notes mention a KVM-style Ubuntu VPS and existing apps on ports such as `5000`, `5001`, and KOW examples around `3001`.

Before choosing a port, SSH into the VPS and inspect active ports:

```bash
ssh root@YOUR_VPS_IP

sudo ss -tlnp
sudo grep -rh 'proxy_pass' /etc/nginx/sites-enabled/ | grep -oP 'localhost:\K[0-9]+' | sort -n | uniq
pm2 status
```

Use `8787` for Yor if it is free:

```bash
sudo ss -tlnp | grep ':8787'
```

Empty output means `8787` is available.

---

## 2. Point DNS in Hostinger

In Hostinger hPanel for `yorinternational.net`, add:

```text
Type: A
Name: api
Value: YOUR_VPS_IP
TTL: 3600
```

Verify after propagation:

```bash
dig +short api.yorinternational.net
```

It should return the VPS IP.

---

## 3. Install Server Packages

Run once on the VPS:

```bash
sudo apt update
sudo apt install -y git curl nginx

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g pm2

node -v
npm -v
pm2 -v
```

Enable Nginx:

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 4. Clone the Backend Repo

Use `/opt/yor-backend` for the production checkout:

```bash
sudo mkdir -p /opt/yor-backend
sudo chown -R $USER:$USER /opt/yor-backend

git clone https://github.com/WebsitePojects/yorlegacy_backend.git /opt/yor-backend
cd /opt/yor-backend
```

If the repo is private, create a GitHub deploy key or use a deploy token. Avoid storing your personal GitHub password on the VPS.

---

## 5. Create Production `.env`

Create the file directly on the VPS:

```bash
cd /opt/yor-backend
nano .env
```

Template:

```env
NODE_ENV=production
PORT=8787

# Keep sandbox until production money workflows are signed off.
YOR_RUNTIME_MODE=sandbox
YOR_SANDBOX_DATA_FILE=/opt/yor-backend/dev-data/yor-sandbox.json

# CORS allowlist. Keep both apex and www frontend domains.
FRONTEND_ORIGIN=https://yorinternational.net,https://www.yorinternational.net

# Generate with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
APP_SESSION_SECRET=REPLACE_WITH_64_BYTE_RANDOM_HEX
SESSION_TTL_HOURS=12

# Supabase. Use real production values before enabling production data paths.
SUPABASE_URL=https://hcrsrxdroldfvbplbuuz.supabase.co
SUPABASE_PUBLISHABLE_KEY=REPLACE_IF_USED
SUPABASE_SECRET_KEY=REPLACE_IF_USED
SUPABASE_SERVICE_ROLE_KEY=REPLACE_IF_LEGACY_USED

# Demo accounts. Replace/disable for real production.
DEMO_MEMBER_EMAIL=member@yor.local
DEMO_MEMBER_PASSWORD=REPLACE_IN_PRODUCTION
DEMO_MEMBER_NAME=Yor Member
DEMO_ADMIN_EMAIL=admin@yor.local
DEMO_ADMIN_PASSWORD=REPLACE_IN_PRODUCTION
DEMO_ADMIN_NAME=Yor Admin
DEMO_CASHIER_EMAIL=cashier@yor.local
DEMO_CASHIER_PASSWORD=REPLACE_IN_PRODUCTION
DEMO_CASHIER_NAME=Yor Cashier
DEMO_BOD_EMAIL=bod@yor.local
DEMO_BOD_PASSWORD=REPLACE_IN_PRODUCTION
DEMO_BOD_NAME=Yoren Abihay - BOD
DEMO_SUPERADMIN_EMAIL=yoradmin@gmail.com
DEMO_SUPERADMIN_PASSWORD=REPLACE_IN_PRODUCTION
DEMO_SUPERADMIN_NAME=Yor Super Admin
```

Generate the session secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Lock down the env file:

```bash
chmod 600 /opt/yor-backend/.env
```

---

## 6. Install, Build, and Smoke Test

```bash
cd /opt/yor-backend
npm ci
npm test
npm run build
npm prune --omit=dev
```

Start manually once to check:

```bash
PORT=8787 npm start
```

In another SSH tab:

```bash
curl -sS http://127.0.0.1:8787/health
```

Stop the manual process with `Ctrl+C`.

---

## 7. Start with PM2

Create an ecosystem file:

```bash
cd /opt/yor-backend
nano ecosystem.config.cjs
```

Paste:

```js
module.exports = {
  apps: [
    {
      name: 'yor-api',
      script: 'dist/server.js',
      cwd: '/opt/yor-backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '512M',
      autorestart: true,
      watch: false
    }
  ]
};
```

Start and save:

```bash
pm2 start ecosystem.config.cjs --only yor-api
pm2 save
pm2 startup
```

If `pm2 startup` prints a command, copy and run that command exactly.

Verify:

```bash
pm2 status
pm2 logs yor-api --lines 80
curl -sS http://127.0.0.1:8787/health
```

---

## 8. Configure Nginx

Create an Nginx site:

```bash
sudo nano /etc/nginx/sites-available/yor-api
```

Paste:

```nginx
server {
    listen 80;
    server_name api.yorinternational.net;

    client_max_body_size 10m;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "same-origin" always;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/yor-api /etc/nginx/sites-enabled/yor-api
sudo nginx -t
sudo systemctl reload nginx
```

Verify:

```bash
curl -sS http://api.yorinternational.net/health
```

---

## 9. Enable HTTPS

Install Certbot if needed:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificate:

```bash
sudo certbot --nginx -d api.yorinternational.net
```

Choose the redirect-to-HTTPS option.

Verify:

```bash
sudo certbot certificates
curl -sS https://api.yorinternational.net/health
sudo certbot renew --dry-run
```

---

## 10. Firewall

Only expose SSH, HTTP, and HTTPS:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8787/tcp
sudo ufw enable
sudo ufw status
```

Port `8787` should be internal only. Nginx is the public entrypoint.

---

## 11. Connect the Frontend

For Vercel frontend, set either:

```env
VITE_API_BASE_URL=https://api.yorinternational.net
```

Or keep the frontend on same-origin `/api` if Vercel rewrites are configured.

Backend CORS must include:

```env
FRONTEND_ORIGIN=https://yorinternational.net,https://www.yorinternational.net
```

If preview deployments should call the API, add their exact Vercel preview origins too.

Restart after env changes:

```bash
cd /opt/yor-backend
pm2 restart yor-api --update-env
```

---

## 12. GitHub CI/CD Deployment

Use GitHub Actions to test/build on every push to `main`, then SSH into the VPS and deploy.

### 12.1 Add GitHub Secrets

In GitHub repo `WebsitePojects/yorlegacy_backend`, go to:

`Settings > Secrets and variables > Actions > New repository secret`

Add:

```text
VPS_HOST=YOUR_VPS_IP
VPS_USER=root
VPS_PORT=22
VPS_SSH_KEY=private SSH key allowed to access the VPS
VPS_APP_DIR=/opt/yor-backend
```

Do not put `.env` values in the workflow. Keep `/opt/yor-backend/.env` on the server.

### 12.2 Create Workflow

Create `.github/workflows/deploy-backend.yml` in the backend repo:

```yaml
name: Deploy Yor Backend

on:
  push:
    branches: [main]

jobs:
  test-build-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          port: ${{ secrets.VPS_PORT }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -e
            cd "${{ secrets.VPS_APP_DIR }}"
            git fetch origin main
            git reset --hard origin/main
            npm ci
            npm test
            npm run build
            npm prune --omit=dev
            pm2 restart yor-api --update-env || pm2 start ecosystem.config.cjs --only yor-api
            pm2 save
            curl -fsS http://127.0.0.1:8787/health
```

### 12.3 First Run

Push a small backend change to `main`, then open:

`GitHub > yorlegacy_backend > Actions > Deploy Yor Backend`

Watch the deployment. If it fails, SSH into the VPS:

```bash
cd /opt/yor-backend
git status
pm2 logs yor-api --lines 120
curl -v http://127.0.0.1:8787/health
```

---

## 13. Manual Redeploy Fallback

If GitHub Actions is unavailable:

```bash
ssh root@YOUR_VPS_IP
cd /opt/yor-backend
git pull origin main
npm ci
npm test
npm run build
npm prune --omit=dev
pm2 restart yor-api --update-env
pm2 save
curl -sS http://127.0.0.1:8787/health
```

---

## 14. Operations Commands

```bash
pm2 status
pm2 logs yor-api
pm2 restart yor-api --update-env
pm2 stop yor-api
pm2 delete yor-api

sudo nginx -t
sudo systemctl reload nginx
sudo certbot certificates
curl -sS https://api.yorinternational.net/health
```

---

## 15. Production Checklist

```text
[ ] `api.yorinternational.net` A record points to VPS IP.
[ ] `/opt/yor-backend/.env` exists only on server and has chmod 600.
[ ] `APP_SESSION_SECRET` is a generated 64-byte random hex string.
[ ] Demo passwords are rotated or disabled before real users.
[ ] `FRONTEND_ORIGIN` contains the final frontend domains.
[ ] `npm test` and `npm run build` pass on VPS.
[ ] PM2 app `yor-api` is online and saved.
[ ] Nginx proxies `api.yorinternational.net` to `127.0.0.1:8787`.
[ ] HTTPS certificate is valid.
[ ] UFW does not expose port 8787 publicly.
[ ] GitHub Actions secrets are configured if CI/CD is enabled.
```

---

## 16. Rollback

If deployment breaks:

```bash
ssh root@YOUR_VPS_IP
cd /opt/yor-backend
git log --oneline -5
git reset --hard PREVIOUS_GOOD_COMMIT
npm ci
npm run build
npm prune --omit=dev
pm2 restart yor-api --update-env
curl -sS http://127.0.0.1:8787/health
```

Then revert or fix the bad commit locally and push again.
