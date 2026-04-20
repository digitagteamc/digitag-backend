# Deploying DigiTag Backend on Hostinger VPS

This guide covers two deployment paths on a fresh Hostinger VPS (Ubuntu 22.04 / 24.04). Pick one:

- **Path A — Docker Compose** (simplest, one command, Postgres included)
- **Path B — Native Node.js + PM2 + Nginx** (lowest overhead, more classic)

Both end with a reverse-proxied HTTPS API at `https://api.yourdomain.com`.

---

## 0. Prep (both paths)

### Buy + point domain

In your DNS provider, add an **A record**:

```
api.yourdomain.com  →  <your Hostinger VPS IP>
```

### SSH in

```bash
ssh root@<vps-ip>
```

### Create a non-root user (recommended)

```bash
adduser digitag
usermod -aG sudo digitag
rsync --archive --chown=digitag:digitag ~/.ssh /home/digitag
su - digitag
```

### Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

> Do **not** expose port 5000 publicly. Nginx will proxy it.

### Clone the repo

```bash
cd ~
git clone <your-repo-url> digitag-backend
cd digitag-backend
cp .env.example .env
nano .env   # fill DATABASE_URL, JWT secrets, AWS, OTP_PROVIDER
```

---

## Path A — Docker Compose

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Configure `.env`

For Docker, keep `DATABASE_URL` pointing at the service name `postgres`:

```env
DATABASE_URL="postgresql://postgres:STRONG_PASSWORD@postgres:5432/digitag?schema=public"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=STRONG_PASSWORD
POSTGRES_DB=digitag
```

### 3. Boot the stack

```bash
docker compose up -d --build
docker compose logs -f api
```

The `api` container auto-runs `prisma migrate deploy` and seeds categories on first boot (see the `command:` in `docker-compose.yml`).

### 4. Reverse proxy with Nginx (host-level)

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/digitag-api
# edit the file and replace api.yourdomain.com
sudo nano /etc/nginx/sites-available/digitag-api

sudo ln -s /etc/nginx/sites-available/digitag-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d api.yourdomain.com
```

### 5. Updates

```bash
git pull
docker compose up -d --build
```

---

## Path B — Native Node.js + PM2 + Nginx

### 1. Install system packages

```bash
sudo apt update
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx

# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2
```

### 2. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

sudo -u postgres psql <<'SQL'
CREATE USER digitag WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE digitag OWNER digitag;
GRANT ALL PRIVILEGES ON DATABASE digitag TO digitag;
SQL
```

In `.env`:

```env
DATABASE_URL="postgresql://digitag:STRONG_PASSWORD@localhost:5432/digitag?schema=public"
```

### 3. Install app

```bash
cd ~/digitag-backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

### 4. Start under PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER
# PM2 prints a command — copy/paste/run it with sudo to enable boot startup
```

Useful:

```bash
pm2 status
pm2 logs digitag-api
pm2 restart digitag-api
pm2 reload digitag-api      # zero-downtime
```

### 5. Nginx reverse proxy + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/digitag-api
sudo nano /etc/nginx/sites-available/digitag-api    # replace domain
sudo ln -s /etc/nginx/sites-available/digitag-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.yourdomain.com
```

Certbot auto-renews via a systemd timer (no cron needed).

### 6. Deploy updates

```bash
cd ~/digitag-backend
git pull
npm ci
npx prisma migrate deploy
pm2 reload digitag-api
```

Create a one-liner if you want:

```bash
# deploy.sh
#!/usr/bin/env bash
set -euo pipefail
cd ~/digitag-backend
git pull
npm ci
npx prisma migrate deploy
pm2 reload digitag-api
```

---

## Production checklist

- [ ] `NODE_ENV=production` in `.env`
- [ ] Strong `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (32+ random chars)
- [ ] `DATABASE_URL` uses a strong password
- [ ] `CORS_ORIGIN` set to your actual frontend domain(s), not `*`
- [ ] `OTP_PROVIDER` switched away from `mock` (Twilio/MSG91) with credentials set
- [ ] AWS S3 bucket exists, IAM user has `s3:PutObject`/`GetObject`/`DeleteObject` on it only
- [ ] S3 bucket public-read policy or CloudFront in front (or use presigned GET)
- [ ] DNS A record → VPS IP
- [ ] HTTPS cert issued via certbot
- [ ] UFW enabled, only 22/80/443 open
- [ ] Postgres backups scheduled (`pg_dump` cron or Hostinger snapshots)
- [ ] PM2 `startup` registered so app survives reboot (Path B)
- [ ] Log rotation — `pm2 install pm2-logrotate` (Path B)

### Enable PM2 log rotation (Path B)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

### Postgres backup example (Path B)

```bash
# /etc/cron.daily/digitag-db-backup
#!/usr/bin/env bash
ts=$(date +%Y%m%d-%H%M%S)
mkdir -p /var/backups/digitag
sudo -u postgres pg_dump digitag | gzip > /var/backups/digitag/digitag-$ts.sql.gz
find /var/backups/digitag -type f -mtime +14 -delete
```

```bash
sudo chmod +x /etc/cron.daily/digitag-db-backup
```

---

## Sanity checks after deploy

```bash
curl -i https://api.yourdomain.com/
curl -i https://api.yourdomain.com/api/v1/health
curl -i https://api.yourdomain.com/api/v1/categories
```

If `/health` returns 200 and `/categories` returns seeded data, you're live.
