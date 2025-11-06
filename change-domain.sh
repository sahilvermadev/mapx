#!/bin/bash
# Domain Migration Script
# Usage: ./change-domain.sh old-domain.com new-domain.com

set -e

OLD_DOMAIN=$1
NEW_DOMAIN=$2

if [ -z "$OLD_DOMAIN" ] || [ -z "$NEW_DOMAIN" ]; then
    echo "Usage: ./change-domain.sh old-domain.com new-domain.com"
    echo ""
    echo "Example: ./change-domain.sh recommender.myftp.org mynewdomain.com"
    exit 1
fi

if [ "$OLD_DOMAIN" == "$NEW_DOMAIN" ]; then
    echo "Error: Old and new domains are the same!"
    exit 1
fi

echo "=========================================="
echo "Domain Migration Script"
echo "=========================================="
echo "Changing domain from: $OLD_DOMAIN"
echo "                    to: $NEW_DOMAIN"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Note: Some operations require sudo. You may be prompted for your password."
    SUDO="sudo"
else
    SUDO=""
fi

# Check if .env file exists
if [ ! -f "/opt/recce/.env" ]; then
    echo "Error: .env file not found at /opt/recce/.env"
    echo "Please run this script from the correct location or update the path."
    exit 1
fi

# Check if nginx config exists
if [ ! -f "/etc/nginx/sites-available/recommender" ]; then
    echo "Warning: Nginx config not found at /etc/nginx/sites-available/recommender"
    echo "You may need to update the nginx config manually."
    NGINX_CONFIG_EXISTS=false
else
    NGINX_CONFIG_EXISTS=true
fi

echo "Step 1: Updating .env file..."
cd /opt/recce
sed -i.bak "s|https://$OLD_DOMAIN|https://$NEW_DOMAIN|g" .env
sed -i.bak "s|http://$OLD_DOMAIN|https://$NEW_DOMAIN|g" .env
echo "✓ .env file updated (backup saved as .env.bak)"

if [ "$NGINX_CONFIG_EXISTS" = true ]; then
    echo ""
    echo "Step 2: Updating nginx configuration..."
    $SUDO sed -i.bak "s|$OLD_DOMAIN|$NEW_DOMAIN|g" /etc/nginx/sites-available/recommender
    echo "✓ Nginx config updated (backup saved as /etc/nginx/sites-available/recommender.bak)"
    
    echo ""
    echo "Step 3: Testing nginx configuration..."
    if $SUDO nginx -t; then
        echo "✓ Nginx configuration is valid"
    else
        echo "✗ Nginx configuration test failed!"
        echo "Please check the nginx config manually."
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "Domain updated successfully!"
echo "=========================================="
echo ""
echo "Next steps (MUST be done manually):"
echo ""
echo "1. Update DNS Records:"
echo "   - Point $NEW_DOMAIN A record to your server IP"
echo "   - Wait for DNS propagation (5 min - 48 hours)"
echo ""
echo "2. Get SSL Certificate:"
echo "   sudo certbot --nginx -d $NEW_DOMAIN"
echo ""
echo "3. Update Google OAuth:"
echo "   - Go to Google Cloud Console → APIs & Services → Credentials"
echo "   - Update Authorized redirect URIs:"
echo "     Remove: https://$OLD_DOMAIN/auth/google/callback"
echo "     Add:    https://$NEW_DOMAIN/auth/google/callback"
echo "   - Update Authorized JavaScript origins:"
echo "     Remove: https://$OLD_DOMAIN"
echo "     Add:    https://$NEW_DOMAIN"
echo ""
echo "4. Restart Services:"
echo "   cd /opt/recce"
echo "   docker compose -f docker-compose.prod.yml restart backend"
echo "   docker compose -f docker-compose.prod.yml up -d --build frontend"
echo ""
echo "5. Verify:"
echo "   - Visit https://$NEW_DOMAIN"
echo "   - Test OAuth login"
echo "   - Check browser console for errors"
echo ""

