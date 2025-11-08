# Domain Migration Guide

This guide makes it easy to change your domain name. All domain references are centralized in a few places.

## Quick Migration Checklist

When changing from `old-domain.com` to `new-domain.com`, follow these steps:

### 1. Update DNS Records
- Point your new domain's A record to your server IP
- Wait for DNS propagation (can take up to 48 hours)

### 2. Update Environment Variables (.env)

On your Droplet, edit the `.env` file:

```bash
cd /opt/recce
nano .env
```

Update these three variables (replace `old-domain.com` with `new-domain.com`):

```bash
ALLOWED_ORIGINS=https://new-domain.com
BACKEND_URL=https://new-domain.com
FRONTEND_URL=https://new-domain.com
```

Save and exit.

### 3. Update Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/recommender
```

Find and replace `old-domain.com` with `new-domain.com` in:
- `server_name` directives (should appear twice - once for HTTP, once for HTTPS)

Save and exit, then test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Get New SSL Certificate

```bash
# Get new certificate for the new domain
sudo certbot --nginx -d new-domain.com

# If you want to keep the old domain too (www subdomain, etc.)
sudo certbot --nginx -d new-domain.com -d www.new-domain.com
```

Certbot will automatically update the nginx config with the new certificate paths.

### 5. Restart Docker Services

```bash
cd /opt/recce
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml up -d --build frontend
```

The frontend needs to be rebuilt to pick up the new `VITE_BACKEND_URL` from the `.env` file.

### 6. Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**:
   - Remove: `https://old-domain.com/auth/google/callback`
   - Add: `https://new-domain.com/auth/google/callback`
5. Under **Authorized JavaScript origins**:
   - Remove: `https://old-domain.com`
   - Add: `https://new-domain.com`
6. Click **Save**

### 7. Verify Everything Works

1. Visit `https://new-domain.com` - should load correctly
2. Visit `http://new-domain.com` - should redirect to HTTPS
3. Test OAuth login - should work without errors
4. Test API calls - check browser console for errors

## Current Domain Configuration

**Current Domain:** `rekky.ai`

**Files that reference the domain:**
- `.env` file (on Droplet): `ALLOWED_ORIGINS`, `BACKEND_URL`, `FRONTEND_URL`
- Nginx config: `/etc/nginx/sites-available/recommender` (server_name)
- SSL certificates: `/etc/letsencrypt/live/rekky.ai/`
- Google OAuth: Google Cloud Console → Credentials

**Files that DON'T need changes:**
- Frontend code (uses environment variables)
- Backend code (uses environment variables)
- Docker compose files (uses environment variables)

## Migration Script

For convenience, you can use this script to update the domain:

```bash
#!/bin/bash
# Usage: ./change-domain.sh old-domain.com new-domain.com

OLD_DOMAIN=$1
NEW_DOMAIN=$2

if [ -z "$OLD_DOMAIN" ] || [ -z "$NEW_DOMAIN" ]; then
    echo "Usage: ./change-domain.sh old-domain.com new-domain.com"
    exit 1
fi

echo "Changing domain from $OLD_DOMAIN to $NEW_DOMAIN..."

# Update .env file
cd /opt/recce
sed -i "s|$OLD_DOMAIN|$NEW_DOMAIN|g" .env

# Update nginx config
sudo sed -i "s|$OLD_DOMAIN|$NEW_DOMAIN|g" /etc/nginx/sites-available/recommender

# Test nginx config
sudo nginx -t

echo "Domain updated in .env and nginx config."
echo "Next steps:"
echo "1. Get new SSL certificate: sudo certbot --nginx -d $NEW_DOMAIN"
echo "2. Update Google OAuth redirect URIs in Google Cloud Console"
echo "3. Restart services: cd /opt/recce && docker compose -f docker-compose.prod.yml restart backend && docker compose -f docker-compose.prod.yml up -d --build frontend"
```

## Important Notes

1. **DNS Propagation**: After updating DNS, wait for propagation (usually 5 minutes to 48 hours)

2. **SSL Certificates**: Let's Encrypt certificates are tied to specific domains. You'll need a new certificate for the new domain.

3. **Google OAuth**: The redirect URIs must match exactly. Make sure to update both the redirect URI and JavaScript origin.

4. **Frontend Rebuild**: The frontend must be rebuilt after changing `BACKEND_URL` in `.env` because Vite environment variables are baked into the build.

5. **Old Domain**: If you want to keep the old domain working temporarily, you can add it to the nginx config and get certificates for both domains.

## Troubleshooting

### Domain not resolving
- Check DNS records: `dig new-domain.com` or `nslookup new-domain.com`
- Wait for DNS propagation
- Clear DNS cache: `sudo systemd-resolve --flush-caches` (on the server)

### SSL certificate errors
- Make sure DNS is pointing to your server before running certbot
- Check certificate: `sudo certbot certificates`
- Renew certificate: `sudo certbot renew`

### OAuth redirect errors
- Verify redirect URI in Google Cloud Console matches exactly
- Check backend logs: `docker logs recce_backend_prod | grep callback`
- Make sure `BACKEND_URL` in `.env` matches the domain

### CORS errors
- Verify `ALLOWED_ORIGINS` in `.env` includes the new domain
- Restart backend: `docker compose -f docker-compose.prod.yml restart backend`

