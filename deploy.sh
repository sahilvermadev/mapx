#!/bin/bash

# Deployment script for RECCE application
# This script helps deploy the application using Docker Compose

set -e  # Exit on error

echo "🚀 RECCE Deployment Script"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file. Please update it with your configuration.${NC}"
    else
        echo -e "${RED}❌ .env.example not found. Please create .env manually.${NC}"
        exit 1
    fi
    exit 0
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Function to check if services are running
check_services() {
    echo "📊 Checking service status..."
    docker compose -f docker-compose.prod.yml ps
}

# Function to view logs
view_logs() {
    echo "📋 Showing logs (Press Ctrl+C to exit)..."
    docker compose -f docker-compose.prod.yml logs -f
}

# Function to stop services
stop_services() {
    echo "🛑 Stopping services..."
    docker compose -f docker-compose.prod.yml down
    echo -e "${GREEN}✅ Services stopped.${NC}"
}

# Function to deploy
deploy() {
    echo "🏗️  Building and starting services..."
    echo ""
    
    # Pull latest images
    echo "📥 Pulling latest images..."
    docker compose -f docker-compose.prod.yml pull
    
    # Build and start services
    echo "🔨 Building services..."
    docker compose -f docker-compose.prod.yml up -d --build
    
    echo ""
    echo -e "${GREEN}✅ Services started successfully!${NC}"
    echo ""
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check health
    echo "🏥 Checking service health..."
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend health check failed (may need more time)${NC}"
    fi
    
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend health check failed (may need more time)${NC}"
    fi
    
    echo ""
    echo "📝 Next steps:"
    echo "1. Run database migrations: docker exec -it recce_backend_prod npm run migrate"
    echo "2. Check logs: docker compose -f docker-compose.prod.yml logs -f"
    echo "3. View status: docker compose -f docker-compose.prod.yml ps"
}

# Function to run migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    docker exec -it recce_backend_prod npm run migrate
    echo -e "${GREEN}✅ Migrations completed!${NC}"

    # Sync service categories after migrations
    echo ""
    echo "🔄 Syncing service categories..."
    # sync-service-categories.js is copied from backend/sync-categories.js during Docker build
    docker exec recce_backend_prod node -r dotenv/config scripts/sync-service-categories.js
    echo -e "${GREEN}✅ Category sync completed!${NC}"
}

# Main menu
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        deploy
        ;;
    logs)
        view_logs
        ;;
    status)
        check_services
        ;;
    migrate)
        run_migrations
        ;;
    *)
        echo "Usage: $0 {deploy|stop|restart|logs|status|migrate}"
        echo ""
        echo "Commands:"
        echo "  deploy    - Build and start all services (default)"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  logs      - View logs from all services"
        echo "  status    - Check status of all services"
        echo "  migrate   - Run database migrations"
        exit 1
        ;;
esac


