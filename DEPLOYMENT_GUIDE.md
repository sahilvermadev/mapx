# 🚀 Deployment Guide

This guide covers multiple options for deploying and hosting your RECCE application.

## Table of Contents

1. [Quick Start - Docker Deployment](#quick-start---docker-deployment)
2. [Option 1: VPS/Cloud Server (Recommended)](#option-1-vpscloud-server-recommended)
3. [Option 2: Platform-as-a-Service (PaaS)](#option-2-platform-as-a-service-paas)
4. [Option 3: Cloud Container Services](#option-3-cloud-container-services)
5. [Domain & SSL Setup](#domain--ssl-setup)
6. [Environment Variables](#environment-variables)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start - Docker Deployment

The fastest way to deploy is using Docker Compose. This requires a server with Docker installed.

### Prerequisites

- Docker and Docker Compose installed
- Domain name (optional, but recommended)
- Server with at least 2GB RAM and 2 CPU cores

### Automated Deployment (Recommended)

We provide a deployment script that automates the process:

```bash
# Make script executable (if not already)
chmod +x deploy.sh

# Deploy the application
./deploy.sh deploy

# Or run specific commands
./deploy.sh status    # Check service status
./deploy.sh logs      # View logs
./deploy.sh migrate   # Run database migrations
./deploy.sh stop      # Stop services
```

### Manual Deployment

### Step 1: Prepare Environment Variables

Create a `.env` file in the project root:

```bash
# Database Configuration
DB_NAME=recce_db
DB_USER=recce_user
DB_PASSWORD=your_secure_password_here

# Backend Environment Variables
JWT_SECRET=your_jwt_secret_at_least_32_characters_long
SESSION_SECRET=your_session_secret_at_least_32_characters_long
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OPENAI_API_KEY=sk-your_openai_key
GROQ_API_KEY=your_groq_key
GOOGLE_MAPS_API_KEY=your_google_maps_key

# CORS Configuration (update with your domain)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**⚠️ Important Security Notes:**
- Use strong, random passwords (at least 32 characters for secrets)
- Never commit `.env` file to git
- Use different credentials for production than development

### Step 2: Deploy with Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 3: Run Database Migrations

```bash
# Connect to backend container
docker exec -it recce_backend_prod sh

# Run migrations
npm run migrate

# Exit container
exit
```

### Step 4: Verify Deployment

```bash
# Check backend health
curl http://localhost:5000/health

# Check frontend
curl http://localhost/
```

Your application should now be running!

---

## Option 1: VPS/Cloud Server (Recommended)

This option gives you full control and is cost-effective. Popular providers:
- **DigitalOcean** ($6-12/month)
- **Linode** ($5-12/month)
- **Vultr** ($6-12/month)
- **AWS EC2** (Pay as you go)
- **Google Cloud Compute Engine**
- **Azure Virtual Machines**

### Step 1: Set Up Server

1. **Choose a server:**
   - Minimum: 2GB RAM, 2 vCPU, 40GB SSD
   - Recommended: 4GB RAM, 2-4 vCPU, 80GB SSD

2. **Initial Server Setup:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone <your-repo-url> /opt/recce
cd /opt/recce

# Create .env file (see Environment Variables section)
nano .env
```

### Step 3: Deploy

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker exec -it recce_backend_prod npm run migrate

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Step 4: Set Up Reverse Proxy (Nginx)

For production, use Nginx as a reverse proxy to handle SSL and route traffic:

```bash
# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/recce
```

Add this configuration:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support (if needed)
    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/recce /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 5: Set Up SSL with Let's Encrypt

```bash
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal
sudo certbot renew --dry-run
```

### Step 6: Configure Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 7: Update Environment Variables

Update your `.env` file with production domain:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Restart backend:

```bash
docker-compose -f docker-compose.prod.yml restart backend
```

---

## Option 2: Platform-as-a-Service (PaaS)

PaaS options are simpler but usually more expensive. They handle infrastructure management for you.

### Railway

1. **Sign up at [railway.app](https://railway.app)**

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"

3. **Add Services:**
   - **PostgreSQL:** Add PostgreSQL service
   - **Redis:** Add Redis service
   - **Backend:** Deploy `backend/` folder
   - **Frontend:** Deploy `frontend/mapx-frontend/` folder

4. **Configure Environment Variables:**
   - Go to each service → Variables
   - Add all required environment variables
   - For backend, set:
     ```
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     REDIS_URL=${{Redis.REDIS_URL}}
     ```

5. **Deploy:**
   - Railway auto-deploys on git push
   - Check logs in dashboard

**Estimated Cost:** $5-20/month

### Render

1. **Sign up at [render.com](https://render.com)**

2. **Create Blueprint:**
   Create `render.yaml` in project root:

```yaml
services:
  - type: web
    name: recce-backend
    env: node
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: recce-db
          property: connectionString
      # Add other env vars...
  
  - type: web
    name: recce-frontend
    env: static
    buildCommand: cd frontend/mapx-frontend && npm install && npm run build
    staticPublishPath: ./dist
    envVars:
      - key: VITE_API_URL
        value: https://recce-backend.onrender.com

databases:
  - name: recce-db
    databaseName: recce_db
    user: recce_user
    plan: starter
```

3. **Deploy:**
   - Connect GitHub repo
   - Render will detect `render.yaml` and deploy services

**Estimated Cost:** $7-25/month (free tier available for limited use)

### Fly.io

1. **Install Fly CLI:**

```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login:**

```bash
fly auth login
```

3. **Initialize:**

```bash
# For backend
cd backend
fly launch

# For frontend  
cd frontend/mapx-frontend
fly launch
```

4. **Create Postgres Database:**

```bash
fly postgres create --name recce-db
fly postgres attach recce-db -a recce-backend
```

5. **Set Environment Variables:**

```bash
fly secrets set JWT_SECRET=your_secret -a recce-backend
fly secrets set GOOGLE_CLIENT_ID=your_id -a recce-backend
# ... add other secrets
```

**Estimated Cost:** Pay as you go (free tier available)

### Heroku

1. **Install Heroku CLI:**

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

2. **Login:**

```bash
heroku login
```

3. **Create Apps:**

```bash
# Backend
cd backend
heroku create recce-backend
heroku addons:create heroku-postgresql:mini
heroku addons:create heroku-redis:mini

# Frontend
cd ../frontend/mapx-frontend
heroku create recce-frontend --buildpack heroku/nodejs
```

4. **Configure Buildpacks:**

```bash
# Backend
cd backend
heroku buildpacks:set heroku/nodejs

# Frontend
cd ../frontend/mapx-frontend
heroku buildpacks:set https://github.com/heroku/heroku-buildpack-static
```

5. **Set Environment Variables:**

```bash
heroku config:set JWT_SECRET=your_secret -a recce-backend
heroku config:set DATABASE_URL=$(heroku config:get DATABASE_URL -a recce-backend) -a recce-backend
# ... add other vars
```

6. **Deploy:**

```bash
git push heroku main
```

**Estimated Cost:** $7-25/month

---

## Option 3: Cloud Container Services

For more advanced deployments with auto-scaling and managed services.

### AWS ECS/Fargate

1. **Install AWS CLI:**

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

2. **Configure:**

```bash
aws configure
```

3. **Create ECR Repository:**

```bash
aws ecr create-repository --repository-name recce-backend
aws ecr create-repository --repository-name recce-frontend
```

4. **Build and Push Images:**

```bash
# Build
docker build -t recce-backend ./backend -f ./backend/Dockerfile.prod
docker build -t recce-frontend ./frontend

# Tag
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag recce-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/recce-backend:latest
docker tag recce-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/recce-frontend:latest

# Push
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/recce-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/recce-frontend:latest
```

5. **Create Task Definitions and Deploy:**
   - Use AWS Console or Terraform for ECS setup
   - Set up RDS for PostgreSQL
   - Set up ElastiCache for Redis

**Estimated Cost:** $30-100+/month (pay as you go)

### Google Cloud Run

1. **Install gcloud CLI:**

```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

2. **Enable APIs:**

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

3. **Build and Deploy:**

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Build backend
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/recce-backend
gcloud run deploy recce-backend --image gcr.io/YOUR_PROJECT_ID/recce-backend

# Build frontend
cd ../frontend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/recce-frontend
gcloud run deploy recce-frontend --image gcr.io/YOUR_PROJECT_ID/recce-frontend
```

4. **Set up Cloud SQL (PostgreSQL):**

```bash
gcloud sql instances create recce-db --database-version=POSTGRES_14 --tier=db-f1-micro
```

**Estimated Cost:** $20-80/month (pay as you go, free tier available)

### DigitalOcean App Platform

1. **Sign up at [digitalocean.com](https://digitalocean.com)**

2. **Create App:**
   - Go to Apps → Create App
   - Connect GitHub repository

3. **Configure Services:**
   - **PostgreSQL:** Add managed database
   - **Redis:** Add managed database
   - **Backend:** Add service from `backend/` folder
   - **Frontend:** Add static site from `frontend/mapx-frontend/dist`

4. **Set Environment Variables:**
   - Configure in App Platform dashboard

**Estimated Cost:** $12-50/month

---

## Domain & SSL Setup

### Step 1: Purchase Domain

Popular providers:
- **Namecheap** ($8-15/year)
- **Google Domains** ($12/year)
- **Cloudflare** ($8-15/year)
- **GoDaddy** ($10-20/year)

### Step 2: Configure DNS

1. **Get your server IP:**
```bash
curl ifconfig.me
```

2. **Update DNS Records:**
   - Add A record: `@` → `YOUR_SERVER_IP`
   - Add A record: `www` → `YOUR_SERVER_IP`
   - (For PaaS, use CNAME records pointing to their provided domains)

### Step 3: SSL Certificate

**If using VPS with Nginx:**
- Certbot is already configured (see VPS setup section)
- Certificates auto-renew

**If using PaaS:**
- Most platforms handle SSL automatically
- Some require you to add domain in dashboard

**If using Cloud providers:**
- AWS: Use ACM (AWS Certificate Manager)
- Google Cloud: Use Cloud Load Balancer
- Azure: Use App Service certificates

---

## Environment Variables

### Required Variables

Create a `.env` file in project root with these variables:

```bash
# Database Configuration
DB_NAME=recce_db
DB_USER=recce_user
DB_PASSWORD=your_secure_password_here

# Backend Secrets
JWT_SECRET=your_jwt_secret_at_least_32_characters_long
SESSION_SECRET=your_session_secret_at_least_32_characters_long

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Services (Optional but recommended)
OPENAI_API_KEY=sk-your_openai_key
GROQ_API_KEY=your_groq_key

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_key

# CORS - Update with your production domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Frontend Environment Variable:**

For the frontend, you may need to set `VITE_API_BASE_URL` if your backend API is at a different URL than the default (`http://localhost:5000/api`).

- **Docker Compose:** By default, the frontend uses `http://localhost:5000/api`. With Docker networking, you can access the backend via service name `http://backend:5000/api` but for browser requests, use relative URLs or your domain.
- **Production with reverse proxy:** Set `VITE_API_BASE_URL=/api` to use relative URLs
- **Standalone deployment:** Set `VITE_API_BASE_URL=https://api.yourdomain.com/api`

**Setting VITE_API_BASE_URL:**
```bash
# Option 1: Create .env.production in frontend/mapx-frontend/
echo "VITE_API_BASE_URL=/api" > frontend/mapx-frontend/.env.production

# Option 2: Use environment variable during build
export VITE_API_BASE_URL=/api
npm run build

# Option 3: Modify Dockerfile to accept build arg (advanced)
```

### For PaaS Platforms

Set these in the platform's environment variable section:
- Railway: Variables tab in each service
- Render: Environment section in dashboard
- Fly.io: `fly secrets set KEY=value`
- Heroku: `heroku config:set KEY=value`

### Security Best Practices

1. **Use strong secrets:**
```bash
# Generate random secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For SESSION_SECRET
```

2. **Never commit `.env` files:**
```bash
# Ensure .env is in .gitignore
echo ".env" >> .gitignore
echo ".env.production" >> .gitignore
```

3. **Use secrets management:**
   - AWS: AWS Secrets Manager
   - Google Cloud: Secret Manager
   - For PaaS: Use platform's secrets management

---

## Troubleshooting

### Common Issues

#### 1. **Backend won't start**

**Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs backend
```

**Verify environment variables:**
```bash
docker exec -it recce_backend_prod env | grep -E "DATABASE_URL|JWT_SECRET|NODE_ENV"
```

**Common fixes:**
- Missing required environment variables
- Database not accessible
- Wrong DATABASE_URL format

#### 2. **Database connection errors**

**Check database status:**
```bash
docker-compose -f docker-compose.prod.yml ps db
docker-compose -f docker-compose.prod.yml logs db
```

**Verify DATABASE_URL:**
```bash
# Should be in format: postgres://user:password@host:5432/dbname
echo $DATABASE_URL
```

**Test connection:**
```bash
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "SELECT 1;"
```

#### 3. **Frontend can't connect to backend**

**Check CORS configuration:**
- Ensure `ALLOWED_ORIGINS` includes your frontend domain
- Format: `https://yourdomain.com,https://www.yourdomain.com`

**Check backend API URL:**
- Frontend uses `VITE_API_BASE_URL` environment variable (defaults to `http://localhost:5000/api`)
- For Docker Compose: The frontend connects to backend via Docker network, so ensure backend service name is correct
- For production with reverse proxy: Set `VITE_API_BASE_URL` to `/api` so it uses relative URLs
- For standalone deployment: Set `VITE_API_BASE_URL` to your backend URL (e.g., `https://api.yourdomain.com/api`)

**Set frontend API URL during build:**
```bash
# Option 1: Environment variable (before build)
export VITE_API_BASE_URL=https://api.yourdomain.com/api

# Option 2: Create .env file in frontend/mapx-frontend/
echo "VITE_API_BASE_URL=https://api.yourdomain.com/api" > frontend/mapx-frontend/.env.production

# Option 3: Use Docker build arg (modify Dockerfile if needed)
```

**Verify network connectivity:**
```bash
# From frontend container
docker exec -it recce_frontend_prod wget -O- http://backend:5000/health
```

#### 4. **SSL certificate issues**

**Let's Encrypt renewal:**
```bash
sudo certbot renew --dry-run
sudo systemctl restart nginx
```

**Certificate not found:**
- Ensure domain DNS is pointing to server
- Wait for DNS propagation (can take up to 48 hours)
- Check Certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

#### 5. **High memory usage**

**Monitor resources:**
```bash
docker stats
```

**Check for memory leaks:**
```bash
docker-compose -f docker-compose.prod.yml logs backend | grep -i "memory\|error"
```

**Solutions:**
- Increase server resources
- Optimize database queries
- Add caching layer
- Scale horizontally (multiple backend instances)

#### 6. **Database migration errors**

**Check migration status:**
```bash
docker exec -it recce_backend_prod npm run migrate
```

**Manual migration:**
```bash
docker exec -it recce_backend_prod sh
cd /app
npm run migrate
exit
```

#### 7. **Port already in use**

**Check what's using the port:**
```bash
sudo lsof -i :5000  # Backend
sudo lsof -i :80    # Frontend
sudo lsof -i :5432  # Database
```

**Kill process or change port:**
- Update `docker-compose.prod.yml` port mappings
- Restart services: `docker-compose -f docker-compose.prod.yml restart`

---

## Monitoring & Maintenance

### Health Checks

**Check all services:**
```bash
# Backend
curl http://localhost:5000/health

# Frontend
curl http://localhost/health

# Database (from container)
docker exec -it recce_db_prod pg_isready -U recce_user
```

### Logs

**View all logs:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

**View specific service:**
```bash
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
```

### Backups

**Database backup:**
```bash
# Manual backup
docker exec -it recce_db_prod pg_dump -U recce_user recce_db > backup_$(date +%Y%m%d).sql

# Automated backup (add to crontab)
# 0 2 * * * docker exec recce_db_prod pg_dump -U recce_user recce_db > /backups/backup_$(date +\%Y\%m\%d).sql
```

**Restore database:**
```bash
cat backup_20250101.sql | docker exec -i recce_db_prod psql -U recce_user recce_db
```

### Updates

**Update application:**
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations if needed
docker exec -it recce_backend_prod npm run migrate
```

---

## Cost Estimates

### VPS (DigitalOcean/Linode/Vultr)
- **Basic:** $6-12/month (2GB RAM, 1 vCPU)
- **Recommended:** $12-24/month (4GB RAM, 2 vCPU)
- **Domain:** $8-15/year
- **Total:** ~$12-25/month

### PaaS
- **Railway:** $5-20/month
- **Render:** $7-25/month (free tier available)
- **Fly.io:** Pay as you go (free tier available)
- **Heroku:** $7-25/month (free tier deprecated)
- **Total:** ~$7-30/month

### Cloud (AWS/GCP/Azure)
- **Compute:** $20-50/month
- **Database:** $15-40/month
- **Storage/CDN:** $5-15/month
- **Total:** ~$40-100+/month

---

## Next Steps

1. ✅ Deploy your application using one of the methods above
2. ✅ Set up domain and SSL
3. ✅ Configure monitoring and alerts
4. ✅ Set up automated backups
5. ✅ Document your deployment process
6. ✅ Set up CI/CD pipeline for automated deployments

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Production Readiness Guide](./PRODUCTION_READINESS.md)

---

**Need Help?** Check the troubleshooting section or review the logs for specific error messages.

