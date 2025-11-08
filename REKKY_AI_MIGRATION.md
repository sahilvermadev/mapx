# Migration to rekky.ai

This document provides step-by-step instructions for migrating the production domain from `recommender.myftp.org` to `rekky.ai`.

## Prerequisites

- DNS access to configure rekky.ai
- SSH access to production server
- Google Cloud Console access (for OAuth)
- Current domain is working and accessible

## Migration Steps

### Step 1: Update DNS Records

1. **Point rekky.ai to your server:**
   - Add A record: `@` → `YOUR_SERVER_IP`
   - Add A record: `www` → `YOUR_SERVER_IP` (optional, for www.rekky.ai)
   - Wait for DNS propagation (can take 5 minutes to 48 hours)

2. **Verify DNS is working:**
   ```bash
   dig rekky.ai
   nslookup rekky.ai
   ```

### Step 2: Update Environment Variables on Production Server

SSH into your production server and update the `.env` file:

```bash
cd /opt/recce
nano .env
```

Update these three variables:

```bash
ALLOWED_ORIGINS=https://rekky.ai
BACKEND_URL=https://rekky.ai
FRONTEND_URL=https://rekky.ai
```

**Important Notes:**
- Use `https://` (not `http://`) since we're using SSL
- Don't include port numbers (nginx handles routing)
- Save and exit (Ctrl+X, then Y, then Enter)

### Step 3: Update Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/recommender
```

Find and replace `recommender.myftp.org` with `rekky.ai` in:
- `server_name` directives (should appear twice - once for HTTP, once for HTTPS)

The configuration should look like:

```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name rekky.ai www.rekky.ai;
    # ... rest of config
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name rekky.ai www.rekky.ai;
    # ... rest of config
}
```

Save and exit, then test:

```bash
sudo nginx -t
```

If the test passes, reload nginx:

```bash
sudo systemctl reload nginx
```

### Step 4: Get New SSL Certificate

```bash
# Get new certificate for rekky.ai
sudo certbot --nginx -d rekky.ai

# If you want www.rekky.ai too
sudo certbot --nginx -d rekky.ai -d www.rekky.ai
```

Certbot will automatically:
- Update the nginx config with new certificate paths
- Configure SSL settings
- Set up auto-renewal

### Step 5: Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Edit your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**:
   - Remove: `https://recommender.myftp.org/auth/google/callback`
   - Add: `https://rekky.ai/auth/google/callback`
5. Under **Authorized JavaScript origins**:
   - Remove: `https://recommender.myftp.org`
   - Add: `https://rekky.ai`
6. Click **Save**

**Important:** The redirect URI must match exactly, including the protocol (https) and path.

### Step 6: Rebuild and Restart Services

```bash
cd /opt/recce

# Pull latest code (if needed)
git pull

# Restart backend to pick up new environment variables
docker compose -f docker-compose.prod.yml restart backend

# Rebuild frontend (required - VITE_BACKEND_URL is baked into the build)
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

Or use the deployment script:

```bash
./deploy-prod.sh update
```

### Step 7: Verify Everything Works

1. **Test HTTPS:**
   - Visit `https://rekky.ai` - should load correctly
   - Visit `http://rekky.ai` - should redirect to HTTPS
   - Check for SSL lock icon in browser

2. **Test OAuth Login:**
   - Try signing in with Google
   - Should redirect correctly without errors

3. **Test API Calls:**
   - Open browser console (F12)
   - Check for any CORS errors
   - Verify API requests are working

4. **Test Profile Pictures:**
   - Check if profile pictures load correctly
   - Verify no CORS errors in console

### Step 8: Update Old Domain (Optional)

If you want to keep the old domain working temporarily (for redirects or transition period):

1. Add both domains to nginx config:
   ```nginx
   server_name rekky.ai www.rekky.ai recommender.myftp.org;
   ```

2. Get certificate for both:
   ```bash
   sudo certbot --nginx -d rekky.ai -d www.rekky.ai -d recommender.myftp.org
   ```

3. Or set up a redirect from old to new domain in nginx.

## Rollback Plan

If something goes wrong, you can rollback:

1. **Revert .env file:**
   ```bash
   cd /opt/recce
   # Edit .env and change back to recommender.myftp.org
   ```

2. **Revert nginx config:**
   ```bash
   sudo nano /etc/nginx/sites-available/recommender
   # Change server_name back to recommender.myftp.org
   sudo nginx -t
   sudo systemctl reload nginx
   ```

3. **Revert Google OAuth:**
   - Update redirect URIs back to old domain in Google Cloud Console

4. **Restart services:**
   ```bash
   cd /opt/recce
   docker compose -f docker-compose.prod.yml restart backend
   docker compose -f docker-compose.prod.yml up -d --build frontend
   ```

## Troubleshooting

### DNS not resolving
- Check DNS records: `dig rekky.ai` or `nslookup rekky.ai`
- Wait for DNS propagation (can take up to 48 hours)
- Clear DNS cache: `sudo systemd-resolve --flush-caches` (on server)

### SSL certificate errors
- Make sure DNS is pointing to your server before running certbot
- Check certificate: `sudo certbot certificates`
- Verify certificate paths in nginx config

### OAuth redirect errors
- Verify redirect URI in Google Cloud Console matches exactly: `https://rekky.ai/auth/google/callback`
- Check backend logs: `docker logs recce_backend_prod | grep callback`
- Make sure `BACKEND_URL` in `.env` is `https://rekky.ai`

### CORS errors
- Verify `ALLOWED_ORIGINS` in `.env` includes `https://rekky.ai`
- Restart backend: `docker compose -f docker-compose.prod.yml restart backend`
- Check browser console for specific CORS error messages

### 502 Bad Gateway
- Check if Docker containers are running: `docker compose -f docker-compose.prod.yml ps`
- Check container logs: `docker compose -f docker-compose.prod.yml logs`
- Verify nginx can reach containers: `curl http://localhost:8080` and `curl http://localhost:5000/api/health`

## Post-Migration Checklist

- [ ] DNS records updated and propagated
- [ ] `.env` file updated with new domain
- [ ] Nginx configuration updated
- [ ] SSL certificate obtained and working
- [ ] Google OAuth redirect URIs updated
- [ ] Frontend rebuilt with new BACKEND_URL
- [ ] Backend restarted
- [ ] HTTPS working (https://rekky.ai loads)
- [ ] HTTP redirects to HTTPS
- [ ] OAuth login works
- [ ] API calls work (no CORS errors)
- [ ] Profile pictures load correctly
- [ ] All features tested and working

## Notes

- The frontend must be rebuilt after changing `BACKEND_URL` because Vite environment variables are baked into the JavaScript bundle at build time.
- SSL certificates are tied to specific domains. You'll need a new certificate for rekky.ai.
- Google OAuth redirect URIs must match exactly - make sure to update both the redirect URI and JavaScript origin.
- Keep the old domain's SSL certificate until you're sure everything is working, then you can remove it.

