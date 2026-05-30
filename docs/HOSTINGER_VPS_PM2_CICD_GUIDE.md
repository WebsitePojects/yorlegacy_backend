# Yor Backend Hostinger VPS Runbook

This runbook is for the current Yor setup:

- frontend domain: `https://yorinternational.net`
- frontend `www`: `https://www.yorinternational.net`
- backend API domain: `https://api.yorinternational.net`
- backend repo: `https://github.com/WebsitePojects/yorlegacy_backend.git`
- backend app dir: `/opt/yor-backend`
- backend port: `8787`
- VPS IP from local server notes: `72.62.25.21`

## 1. Hostinger DNS

Before the server commands, add this DNS record in Hostinger for `yorinternational.net`:

```text
Type: A
Name: api
Value: 72.62.25.21
TTL: 3600
```

Your Vercel frontend DNS should stay:

```text
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 2. Server Bootstrap

SSH into the VPS:

```bash
ssh root@72.62.25.21
```

Then paste this whole block into the Linux terminal:

```bash
set -e

apt update
apt install -y git curl nginx ufw certbot python3-certbot-nginx ca-certificates openssl

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

mkdir -p /opt
cd /opt

if [ ! -d /opt/yor-backend/.git ]; then
  git clone https://github.com/WebsitePojects/yorlegacy_backend.git /opt/yor-backend
else
  git -C /opt/yor-backend fetch origin main
  git -C /opt/yor-backend checkout main
  git -C /opt/yor-backend pull origin main
fi

cd /opt/yor-backend

cat > /opt/yor-backend/.env <<EOF
NODE_ENV=production
PORT=8787
YOR_RUNTIME_MODE=sandbox
YOR_SANDBOX_DATA_FILE=/opt/yor-backend/dev-data/yor-sandbox.json
FRONTEND_ORIGIN=https://yorinternational.net,https://www.yorinternational.net
APP_SESSION_SECRET=$(openssl rand -hex 64)
SESSION_TTL_HOURS=12
DEMO_MEMBER_EMAIL=member@yor.local
DEMO_MEMBER_PASSWORD=YorMember123!
DEMO_MEMBER_NAME=Yor Member
DEMO_ADMIN_EMAIL=admin@yor.local
DEMO_ADMIN_PASSWORD=YorAdmin123!
DEMO_ADMIN_NAME=Yor Admin
DEMO_CASHIER_EMAIL=cashier@yor.local
DEMO_CASHIER_PASSWORD=joyjoy05
DEMO_CASHIER_NAME=Yor Cashier
DEMO_BOD_EMAIL=bod@yor.local
DEMO_BOD_PASSWORD=yoralliance321654
DEMO_BOD_NAME=Yoren Abihay - BOD
DEMO_SUPERADMIN_EMAIL=yoradmin@gmail.com
DEMO_SUPERADMIN_PASSWORD=1
DEMO_SUPERADMIN_NAME=Yor Super Admin
EOF

chmod 600 /opt/yor-backend/.env

npm ci
npm test
npm run build
npm prune --omit=dev

cat > /opt/yor-backend/ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [
    {
      name: 'yor-api',
      script: 'dist/server.js',
      cwd: '/opt/yor-backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

pm2 start /opt/yor-backend/ecosystem.config.cjs --only yor-api --update-env
pm2 save
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

curl -fsS http://127.0.0.1:8787/health
pm2 status
```

## 3. Nginx and HTTPS

Paste this whole block into the same VPS terminal:

```bash
set -e

cat > /etc/nginx/sites-available/yor-api <<'EOF'
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
EOF

ln -sfn /etc/nginx/sites-available/yor-api /etc/nginx/sites-enabled/yor-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 8787/tcp
ufw --force enable
ufw status

certbot --nginx --non-interactive --agree-tos --redirect -m admin@yorinternational.net -d api.yorinternational.net

curl -fsS http://api.yorinternational.net/health
curl -fsS https://api.yorinternational.net/health
certbot renew --dry-run
```

## 4. Frontend Wiring

The frontend should not call the dev tunnel directly in production.

The production-safe setup is:

- browser requests: `https://yorinternational.net/api/...`
- Vercel rewrite target: `https://api.yorinternational.net/api/...`
- `VITE_API_BASE_URL`: unset in Vercel production

Update [vercel.json](C:\Users\Win10\Desktop\YorLegacyMLM\yor_frontend\vercel.json) to this once the VPS API is live:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://api.yorinternational.net/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Do not set `VITE_API_BASE_URL` in Vercel production after that change.

## 5. GitHub Actions CI/CD

Create these GitHub Actions secrets in `WebsitePojects/yorlegacy_backend`:

```text
VPS_HOST = 72.62.25.21
VPS_USER = root
VPS_PORT = 22
VPS_APP_DIR = /opt/yor-backend
VPS_SSH_KEY = the private key content that GitHub Actions should use for SSH
```

Use this workflow file in `.github/workflows/deploy-backend.yml`:

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
            git checkout main
            git pull origin main
            npm ci
            npm test
            npm run build
            npm prune --omit=dev
            pm2 restart yor-api --update-env || pm2 start ecosystem.config.cjs --only yor-api
            pm2 save
            curl -fsS http://127.0.0.1:8787/health
```

## 6. Manual Update

If you need to redeploy manually, SSH into the server and paste:

```bash
set -e
cd /opt/yor-backend
git fetch origin main
git checkout main
git pull origin main
npm ci
npm test
npm run build
npm prune --omit=dev
pm2 restart yor-api --update-env
pm2 save
curl -fsS http://127.0.0.1:8787/health
pm2 status
```

## 7. Verify

From the VPS:

```bash
pm2 logs yor-api --lines 80
curl -i http://127.0.0.1:8787/health
curl -i https://api.yorinternational.net/health
nginx -t
systemctl status nginx --no-pager
```

From the browser after frontend redeploy:

```text
https://yorinternational.net
https://www.yorinternational.net
https://yorinternational.net/login
https://yorinternational.net/register
```

Expected result:

- the browser hits `/api/...` on the frontend domain
- Vercel rewrites proxy those requests to `https://api.yorinternational.net`
- no direct browser request should point to `https://cz9c2qnq-8787.asse.devtunnels.ms`
- if requests redirect to `global.rel.tunnels.api.visualstudio.com`, the dev tunnel is still private and must be made public or replaced with `https://api.yorinternational.net`
