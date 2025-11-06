# 🚀 Quick Start Deployment Guide

This is a condensed guide for deploying RECCE quickly. For detailed instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Prerequisites

- Docker and Docker Compose installed
- A server (VPS, cloud instance, etc.)
- Domain name (optional but recommended)

## Quick Deployment Steps

### 1. Clone and Configure

```bash
# Clone repository
git clone <your-repo-url>
cd mapx

# Copy environment template
cp .env.example .env  # If .env.example exists
# Or create .env manually
```

### 2. Set Up Environment Variables

Edit `.env` file in project root:

```bash
# Required variables
DB_NAME=recce_db
DB_USER=recce_user
DB_PASSWORD=<strong_password>
JWT_SECRET=<generate_with_openssl_rand_base64_32>
SESSION_SECRET=<generate_with_openssl_rand_base64_32>
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>

# Optional but recommended
OPENAI_API_KEY=sk-<your_key>
GROQ_API_KEY=<your_key>
GOOGLE_MAPS_API_KEY=<your_key>

# Update with your domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Generate secrets:
```bash
openssl rand -base64 32  # Run twice for JWT_SECRET and SESSION_SECRET
```

### 3. Deploy

```bash
# Use deployment script (recommended)
./deploy.sh deploy

# Or manually
docker-compose -f docker-compose.prod.yml up -d --build
```

### 4. Run Migrations

```bash
# Using script
./deploy.sh migrate

# Or manually
docker exec -it recce_backend_prod npm run migrate
```

### 5. Verify

```bash
# Check services
docker-compose -f docker-compose.prod.yml ps

# Check health
curl http://localhost:5000/health  # Backend
curl http://localhost/health        # Frontend

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 6. Set Up Domain & SSL (Optional)

If you have a domain:

1. **Point DNS to your server:**
   - Add A record: `@` → `YOUR_SERVER_IP`
   - Add A record: `www` → `YOUR_SERVER_IP`

2. **Install Nginx and Certbot:**
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

3. **Create Nginx config:**
```bash
sudo nano /etc/nginx/sites-available/recce
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

4. **Enable site and get SSL:**
```bash
sudo ln -s /etc/nginx/sites-available/recce /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

5. **Update ALLOWED_ORIGINS in .env and restart:**
```bash
# Edit .env
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

## Common Commands

```bash
# Start services
./deploy.sh deploy

# Stop services
./deploy.sh stop

# View logs
./deploy.sh logs

# Check status
./deploy.sh status

# Run migrations
./deploy.sh migrate

# Restart services
./deploy.sh restart
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Verify environment variables
docker exec -it recce_backend_prod env | grep -E "DATABASE_URL|JWT_SECRET"
```

### Database connection issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml ps db

# Test connection
docker exec -it recce_db_prod psql -U recce_user -d recce_db -c "SELECT 1;"
```

### Frontend can't connect to backend
- Check `ALLOWED_ORIGINS` includes your domain
- Verify backend is accessible
- Check frontend logs: `docker-compose -f docker-compose.prod.yml logs frontend`

## Next Steps

1. ✅ Set up automated backups
2. ✅ Configure monitoring
3. ✅ Set up CI/CD for automated deployments
4. ✅ Review [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)

## Need More Help?

- See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions
- Check [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) for production best practices


