# TricityMatch Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Production Deployment](#production-deployment)
4. [Hostinger VPS](#hostinger-vps)
5. [Cloud Deployment](#cloud-deployment)
6. [Monitoring Setup](#monitoring-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Node.js** >= 20.x (for local development)
- **PostgreSQL** >= 15 (or use Docker)
- **Redis** >= 7 (optional, for caching)

### Required Accounts (Production)
- **Razorpay** - Payment processing
- **Cloudinary** - Image storage
- **SMTP Provider** - Email sending (Gmail, SendGrid, etc.)

---

## Quick Start (Development)

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/tricitymatch.git
cd tricitymatch

# Copy environment template
cp .env.example .env.development

# Edit with your local settings
# Minimum required: DB_PASSWORD, JWT_SECRET
```

### 2. Start with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check status
docker-compose ps
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **API Docs**: http://localhost:5000/api/docs
- **Health Check**: http://localhost:5000/health

### 4. Development without Docker

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Production Deployment

### 1. Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB | 50+ GB SSD |
| OS | Ubuntu 22.04 | Ubuntu 22.04 LTS |

### 2. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install Certbot for SSL
sudo apt install certbot
```

### 3. Configure Environment

```bash
# Copy production template
cp .env.production.example .env

# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Edit .env with production values
nano .env
```

**Critical Settings:**
- `JWT_SECRET` - Minimum 64 characters, random
- `DB_PASSWORD` - Strong, unique password
- `COOKIE_SECRET` - Different from JWT_SECRET
- `FRONTEND_URL` - Your actual domain
- `CORS_ORIGIN` - Your actual domain
- **Cloudinary:** `CLOUDINARY_CLOUD_NAME` must be the **exact cloud name** from your [Cloudinary Dashboard](https://console.cloudinary.com/) (the subdomain, e.g. `duywipohs`). Do not use a placeholder like `tricitymatch-prod` unless that is the actual cloud name in your account. Use the same values as in the Dashboard → API Keys section (`cloud_name`, `api_key`, `api_secret`). If you see "Invalid cloud_name" in logs, the cloud name is wrong.

### 4. SSL Certificate Setup

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Get Let's Encrypt certificate
sudo certbot certonly --standalone -d tricitymatch.com -d www.tricitymatch.com

# Copy certificates
sudo cp /etc/letsencrypt/live/tricitymatch.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/tricitymatch.com/privkey.pem nginx/ssl/
```

### 5. Deploy

```bash
# Build and start with full profile (includes Redis and Nginx)
docker-compose --profile full up -d --build

# Verify deployment
docker-compose ps
curl -s http://localhost:5000/health | jq

# Check logs
docker-compose logs -f backend
```

### 6. Database Migrations

```bash
# Run migrations (first deployment)
docker-compose exec backend npm run migrate

# Seed initial data (if needed)
docker-compose exec backend npm run seed
```

---

## Hostinger VPS

For step-by-step deployment on a **Hostinger VPS** (Ubuntu, Docker, optional domain + SSL), see:

**[Deploy TricityMatch on Hostinger VPS](HOSTINGER-VPS.md)**

That guide covers: SSH access, installing Docker, configuring `.env`, running with or without a domain, and setting up Let's Encrypt SSL.

---

## Cloud Deployment

### AWS Deployment

#### Using ECS/Fargate

1. **Create ECR repositories:**
```bash
aws ecr create-repository --repository-name tricitymatch-backend
aws ecr create-repository --repository-name tricitymatch-frontend
```

2. **Push images:**
```bash
# Login to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URL

# Build and push
docker build -t $ECR_URL/tricitymatch-backend:latest ./backend
docker push $ECR_URL/tricitymatch-backend:latest
```

3. **Create ECS Task Definition** (see `deploy/aws/task-definition.json`)

4. **Use RDS for PostgreSQL** and **ElastiCache for Redis**

### DigitalOcean Deployment

1. **Create Droplet** (4GB RAM, 2 vCPU minimum)
2. **Create Managed PostgreSQL** database
3. **Create Redis** cluster (optional)
4. Follow standard production deployment steps

### Kubernetes Deployment

See `deploy/kubernetes/` directory for:
- `deployment.yaml` - Application deployments
- `service.yaml` - Service definitions
- `ingress.yaml` - Ingress configuration
- `configmap.yaml` - Configuration
- `secrets.yaml` - Secrets (use sealed-secrets in production)

```bash
# Apply all manifests
kubectl apply -f deploy/kubernetes/

# Check status
kubectl get pods -l app=tricitymatch
```

---

## Monitoring Setup

### Enable Monitoring Stack

```bash
# Start with monitoring profile
docker-compose --profile full --profile monitoring up -d
```

### Access Dashboards

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Grafana | http://localhost:3001 | admin / (from .env) |
| Prometheus | http://localhost:9090 | - |
| Alertmanager | http://localhost:9093 | - |

### Configure Alerts

1. Edit `monitoring/alertmanager.yml`
2. Uncomment and configure notification channels
3. Restart Alertmanager

```yaml
# Example Slack configuration
slack_configs:
  - channel: '#alerts'
    api_url: 'https://hooks.slack.com/services/xxx'
```

### Application Metrics

- **Prometheus metrics**: `/monitoring/metrics`
- **Health checks**: `/monitoring/health/full`
- **JSON metrics**: `/monitoring/metrics/json`

---

## Maintenance

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres tricitymatch > backup_$(date +%Y%m%d).sql

# Restore backup
cat backup_20240101.sql | docker-compose exec -T postgres psql -U postgres tricitymatch
```

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and deploy
docker-compose --profile full up -d --build

# Check for issues
docker-compose logs -f backend
```

### Scale Horizontally

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3
```

### SSL Certificate Renewal

```bash
# Auto-renew with cron
echo "0 0 1 * * certbot renew --quiet && docker-compose restart nginx" | sudo crontab -
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Test connection
docker-compose exec backend node -e "require('./config/database').authenticate().then(()=>console.log('OK'))"
```

#### "Invalid cloud_name" or profile photo upload fails (500)
- **Cause:** `CLOUDINARY_CLOUD_NAME` is wrong (e.g. a placeholder like `tricitymatch-prod`).
- **Fix:** In [Cloudinary Console](https://console.cloudinary.com/) go to Dashboard. Your **cloud name** is shown there (and in API Keys). Set in production `.env`:
  - `CLOUDINARY_CLOUD_NAME=<your actual cloud name>`
  - `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` from the same Dashboard → API Keys section.
- **Important:** `docker compose restart backend` does **not** reload `.env`. Recreate the container so it picks up new values:
  ```bash
  docker compose up -d --force-recreate backend
  ```

#### "File too large" / "size is too big" when uploading a photo under 5MB
- **Cause:** `MAX_FILE_SIZE` in `.env` may be set too low (value is in **bytes**). Default is 5MB (5242880).
- **Fix:** In production `.env` set `MAX_FILE_SIZE=5242880` (or remove the line to use the default). Then recreate the backend container: `docker compose up -d --force-recreate backend`.

#### Redis Connection Issues
```bash
# Check Redis
docker-compose exec redis redis-cli ping

# Application falls back to in-memory cache if Redis unavailable
```

#### Container Out of Memory
```bash
# Check memory usage
docker stats

# Increase limits in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 2G
```

#### High CPU Usage
```bash
# Check which container
docker stats

# Common causes:
# - Database queries without indexes
# - Memory leaks requiring garbage collection
# - Too many connections
```

### Health Checks

```bash
# Quick health check
curl http://localhost:5000/health

# Detailed health check
curl http://localhost:5000/monitoring/health/full | jq

# Check metrics
curl http://localhost:5000/monitoring/metrics
```

### Log Analysis

```bash
# View recent errors
docker-compose logs backend 2>&1 | grep -i error | tail -50

# Follow logs in real-time
docker-compose logs -f --tail=100 backend

# Export logs
docker-compose logs backend > backend_logs_$(date +%Y%m%d).txt
```

---

## Security Checklist

- [ ] Strong, unique JWT_SECRET (64+ chars)
- [ ] Strong database password
- [ ] HTTPS enabled with valid SSL certificate
- [ ] CORS restricted to production domain
- [ ] Rate limiting configured
- [ ] Swagger disabled in production (`ENABLE_SWAGGER=false`)
- [ ] Database not exposed to internet (internal network only)
- [ ] Redis password set
- [ ] Regular security updates applied
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured

---

## Support

For issues:
1. Check application logs
2. Review this guide
3. Check GitHub Issues
4. Contact: support@tricitymatch.com
