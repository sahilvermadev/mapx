# HTTPS Setup Guide

This guide will help you set up HTTPS/SSL for your production site using Let's Encrypt.

**Note:** Replace `YOUR_DOMAIN.com` with your actual domain name throughout this guide.

## Prerequisites

- Domain `YOUR_DOMAIN.com` is pointing to your Droplet's IP
- Docker containers are running (frontend on port 80, backend on port 5000)
- SSH access to your Droplet

## Step 1: Install Nginx and Certbot on the Host

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

## Step 2: Create Nginx Configuration

Create the nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/recommender
```

**Note:** Replace `YOUR_DOMAIN.com` with your actual domain name in the configuration below.

Add this configuration:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name YOUR_DOMAIN.com;
    
    # Allow Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name YOUR_DOMAIN.com;

    # SSL certificates (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/YOUR_DOMAIN.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOUR_DOMAIN.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend (proxies to Docker container on port 8080)
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
    }

    # Backend API (proxies to Docker container on port 5000)
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        # Preserve Origin header for CORS
        proxy_set_header Origin $http_origin;
        proxy_buffering off;
    }

    # OAuth endpoints (proxies to Docker container on port 5000)
    location /auth/ {
        proxy_pass http://localhost:5000/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_buffering off;
    }
}
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 3: Enable the Site

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/recommender /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t
```

If the test passes, start nginx:

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 4: Get SSL Certificate with Let's Encrypt

```bash
# Get SSL certificate (Certbot will automatically configure nginx)
sudo certbot --nginx -d YOUR_DOMAIN.com

# Follow the prompts:
# - Enter your email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

## Step 5: Test Auto-Renewal

```bash
# Test certificate renewal
sudo certbot renew --dry-run
```

## Step 6: Update Environment Variables

Update your `.env` file to use HTTPS:

```bash
cd /opt/recce
nano .env
```

Update these variables:

```bash
ALLOWED_ORIGINS=https://recommender.myftp.org
BACKEND_URL=https://recommender.myftp.org:5000
FRONTEND_URL=https://recommender.myftp.org
```

**Note:** For the backend URL, you might want to keep it as `http://localhost:5000` internally, but update `ALLOWED_ORIGINS` to include HTTPS.

Actually, since we're proxying through nginx, the backend should use HTTPS in the frontend. Let's update:

```bash
# In .env, update:
ALLOWED_ORIGINS=https://recommender.myftp.org
FRONTEND_URL=https://recommender.myftp.org
# Keep BACKEND_URL as http://localhost:5000 for internal Docker communication
```

## Step 7: Restart Services

```bash
cd /opt/recce
docker compose -f docker-compose.prod.yml restart backend
```

## Step 8: Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Update **Authorized redirect URIs**:
   - Add: `https://YOUR_DOMAIN.com/auth/google/callback`
   - Remove the old HTTP URL if it exists
5. Update **Authorized JavaScript origins**:
   - Add: `https://YOUR_DOMAIN.com`
   - Remove the old HTTP origin if it exists

## Step 8b: Update Backend Environment Variables

Update your `.env` file to use HTTPS URLs:

```bash
cd /opt/recce
nano .env
```

Update (replace `YOUR_DOMAIN.com` with your actual domain):
```bash
ALLOWED_ORIGINS=https://YOUR_DOMAIN.com
BACKEND_URL=https://YOUR_DOMAIN.com
FRONTEND_URL=https://YOUR_DOMAIN.com
```

**Note:** Even though the backend internally uses `http://localhost:5000`, the `BACKEND_URL` should be set to the public HTTPS URL for OAuth redirects.

## Step 9: Verify HTTPS is Working

1. Visit `https://YOUR_DOMAIN.com` in your browser
2. Check that the lock icon appears in the address bar
3. Test that the site loads correctly
4. Test that API calls work (check browser console for errors)

## Troubleshooting

### Nginx won't start
```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx configuration
sudo nginx -t
```

### Certificate not found
```bash
# Check if certificate exists
sudo ls -la /etc/letsencrypt/live/YOUR_DOMAIN.com/

# Check Certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

### 502 Bad Gateway
- Check if Docker containers are running: `docker compose -f docker-compose.prod.yml ps`
- Check if ports 80 and 5000 are accessible: `sudo netstat -tlnp | grep -E '80|5000'`

### CORS errors after HTTPS
- Update `ALLOWED_ORIGINS` in `.env` to include `https://YOUR_DOMAIN.com`
- Restart backend: `docker compose -f docker-compose.prod.yml restart backend`

## Maintenance

### Renew Certificates Manually
```bash
sudo certbot renew
sudo systemctl reload nginx
```

Certbot automatically renews certificates, but you can test renewal anytime.

### Check Certificate Expiry
```bash
sudo certbot certificates
```

