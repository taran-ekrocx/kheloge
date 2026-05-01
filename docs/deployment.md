# Kheloge — Deployment Guide

## Overview

Kheloge uses a fully automated CI/CD pipeline built on **GitHub Actions** and **Docker**.  
Code flows from commit to production through the stages described below.

```
git push                 git tag v1.2.3
    │                         │
    ▼                         ▼
CI (lint + test + build)    CI (lint + test + build)
    │                         │
    ▼                         ▼
Deploy → Staging          Deploy → Production
```

---

## Infrastructure

| Component | Technology | Notes |
|-----------|-----------|-------|
| Container registry | GitHub Container Registry (GHCR) | Images tagged by SHA (staging) or semver (prod) |
| App servers | Any Linux VPS (Ubuntu 22.04 recommended) | Single server per environment, Docker Compose |
| Database | PostgreSQL 15 | Managed or self-hosted inside Docker |
| Cache / Queues | Redis 7 | Self-hosted inside Docker |
| File storage | Cloudflare R2 | S3-compatible; credentials via env vars |
| Reverse proxy | Nginx + Let's Encrypt | SSL termination, routes `/api/*` and `/socket.io/*` to NestJS |
| Payments | Razorpay | Webhook endpoint at `/api/payments/webhook` |

### Recommended cloud providers

- **DigitalOcean** Droplet (4 GB RAM / 2 vCPU) — staging  
- **DigitalOcean** Droplet (8 GB RAM / 4 vCPU) — production  
- Or equivalent from Hetzner, AWS EC2 (t3.medium/t3.large), etc.

---

## Environment Variables

All secrets are stored as **GitHub Actions Secrets** and written to `/opt/kheloge/.env.production`
on the server during deployment.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Full PostgreSQL connection string |
| `REDIS_HOST` | Yes | Redis hostname |
| `REDIS_PORT` | Yes | Redis port (default `6379`) |
| `REDIS_PASSWORD` | Yes | Redis auth password |
| `JWT_SECRET` | Yes | Long random string for access tokens |
| `JWT_REFRESH_SECRET` | Yes | Long random string for refresh tokens |
| `FRONTEND_URL` | Yes | Public URL of the web app (e.g. `https://app.kheloge.com`) |
| `NEXT_PUBLIC_API_URL` | Yes | Public URL of the API (baked into the JS bundle at build time) |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key ID |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay webhook signing secret |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret key |
| `R2_BUCKET` | Yes | R2 bucket name |
| `R2_PUBLIC_URL` | Yes | Public CDN URL for the R2 bucket |

### GitHub Actions Secrets (per environment)

In addition to the above, configure these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `STAGING_HOST` | IP or hostname of the staging server |
| `STAGING_SSH_USER` | SSH username (e.g. `ubuntu` or `deploy`) |
| `STAGING_SSH_KEY` | Private SSH key (PEM) for staging server |
| `PROD_HOST` | IP or hostname of the production server |
| `PROD_SSH_USER` | SSH username for production server |
| `PROD_SSH_KEY` | Private SSH key (PEM) for production server |

GitHub Actions Variables (not secrets — visible in logs):

| Variable | Description |
|----------|-------------|
| `STAGING_URL` | e.g. `https://staging.kheloge.com` |
| `PRODUCTION_URL` | e.g. `https://app.kheloge.com` |

---

## First-Time Server Setup

Run this once on each new server (staging or production):

```bash
# 1. Install Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Create deploy directory
sudo mkdir -p /opt/kheloge
sudo chown $USER:$USER /opt/kheloge

# 3. Copy production compose file and nginx config
scp docker-compose.prod.yml user@server:/opt/kheloge/
scp -r infra/ user@server:/opt/kheloge/

# 4. Create .env.production (values filled in by CI on each deploy)
touch /opt/kheloge/.env.production

# 5. Obtain SSL certificate (replace YOUR_DOMAIN)
sudo apt install -y certbot
sudo certbot certonly --standalone -d YOUR_DOMAIN

# 6. Update nginx config with your domain
sed -i 's/YOUR_DOMAIN/app.kheloge.com/g' /opt/kheloge/infra/nginx/conf.d/kheloge.conf

# 7. Authenticate with GHCR (use a Personal Access Token with read:packages scope)
echo $GHCR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 8. Pull and start for the first time
cd /opt/kheloge
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

---

## CI/CD Pipeline

### Workflow files

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | Every push / PR | Lint, type-check, test, build |
| `.github/workflows/deploy.yml` | Push to `main` / push tag `v*.*.*` | Build Docker images, deploy |

### How deployments are triggered

| Action | Environment |
|--------|-------------|
| `git push origin main` | Staging |
| `git tag v1.2.3 && git push origin v1.2.3` | Production |

### Deployment steps (automated)

1. CI passes (lint + type-check + test + build)
2. Docker images built for `api` and `web`, pushed to GHCR
3. SSH into target server
4. `docker compose pull` — pull new images
5. `prisma migrate deploy` — run any pending DB migrations (inside a temporary container, before swapping live containers)
6. `docker compose up -d --remove-orphans` — rolling restart

---

## Local Development

Start PostgreSQL and Redis via Docker, then run the app with hot-reload:

```bash
# Start backing services
docker compose up -d

# Install deps
npm install

# Generate Prisma client
npm run db:generate

# Run migrations (first time only, or after schema changes)
npm run db:migrate

# Seed database (optional)
npm run db:seed

# Start all apps in watch mode
npm run dev
```

Apps will be available at:
- **API**: http://localhost:4000
- **Web**: http://localhost:3035
- **Swagger docs**: http://localhost:4000/api

---

## Database Migrations

Migrations are run automatically on each deployment before containers restart.

For manual runs:

```bash
# Development (creates migration file from schema diff)
npm run db:migrate

# Production-safe (apply existing migration files only)
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

---

## Rollback

To roll back to a previous version:

```bash
# On the server
cd /opt/kheloge
IMAGE_TAG=v1.2.2 docker compose -f docker-compose.prod.yml up -d
```

Or re-push a previous tag from Git to trigger the pipeline again.

---

## Health Checks

- **API health**: `GET /health` → `{ "status": "ok" }`
- **Nginx**: configured with `location /health` proxied to the API
- Docker Compose healthchecks are configured for `api`, `postgres`, and `redis`
