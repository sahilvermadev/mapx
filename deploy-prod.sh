#!/bin/bash

# Production deployment script for RECCE application
# This script provides safe, automated deployment to production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🚀 RECCE Production Deployment Script"
echo "===================================="
echo ""

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
LOG_FILE="./deployments.log"

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

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create .env file with production configuration."
    exit 1
fi

# Log deployment
log_deployment() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Pre-deployment checks
pre_deployment_checks() {
    echo "🔍 Running pre-deployment checks..."
    echo ""
    
    # Check for uncommitted changes
    if [ -d .git ]; then
        if ! git diff-index --quiet HEAD --; then
            echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes.${NC}"
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Deployment cancelled."
                exit 1
            fi
        fi
    fi
    
    # Check if services are already running
    if docker compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        echo -e "${GREEN}✅ Services are currently running${NC}"
    else
        echo -e "${YELLOW}⚠️  Services are not currently running${NC}"
    fi
    
    # Check disk space (at least 1GB free)
    AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 1 ]; then
        echo -e "${RED}❌ Insufficient disk space (less than 1GB available)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"
    echo ""
}

# Backup database
backup_database() {
    echo "💾 Creating database backup..."
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if docker compose -f "$COMPOSE_FILE" ps db | grep -q "Up"; then
        # Load DB_USER and DB_NAME from .env if not set
        if [ -f .env ]; then
            source .env 2>/dev/null || true
        fi
        docker exec recce_db_prod pg_dump -U "${DB_USER:-appuser}" "${DB_NAME:-recce_db}" > "$BACKUP_FILE" 2>/dev/null || {
            echo -e "${YELLOW}⚠️  Database backup failed (may not be critical)${NC}"
        }
        if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
            echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
            log_deployment "Backup created: $BACKUP_FILE"
        fi
    else
        echo -e "${YELLOW}⚠️  Database not running, skipping backup${NC}"
    fi
    echo ""
}

# Deploy services
deploy_services() {
    local services="$1"
    
    echo "🏗️  Building and deploying services..."
    echo ""
    
    if [ -z "$services" ]; then
        # Full deployment
        echo "📥 Pulling latest images..."
        docker compose -f "$COMPOSE_FILE" pull || true
        
        echo "🔨 Building all services..."
        docker compose -f "$COMPOSE_FILE" up -d --build
    else
        # Selective deployment
        echo "🔨 Building and updating: $services"
        docker compose -f "$COMPOSE_FILE" up -d --build $services
    fi
    
    echo ""
    echo -e "${GREEN}✅ Services deployed!${NC}"
    echo ""
}

# Health checks
health_checks() {
    echo "🏥 Running health checks..."
    echo ""
    
    local all_healthy=true
    
    # Backend health check
    echo -n "Checking backend... "
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        all_healthy=false
    fi
    
    # Frontend health check
    echo -n "Checking frontend... "
    if curl -f http://localhost:8080/health > /dev/null 2>&1 || curl -f http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check failed (may need more time)${NC}"
    fi
    
    # Database health check
    echo -n "Checking database... "
    if docker exec recce_db_prod pg_isready -U "${DB_USER:-appuser}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        all_healthy=false
    fi
    
    echo ""
    
    if [ "$all_healthy" = false ]; then
        echo -e "${YELLOW}⚠️  Some services failed health checks. Please review logs.${NC}"
        echo "View logs with: docker compose -f $COMPOSE_FILE logs"
    else
        echo -e "${GREEN}✅ All health checks passed!${NC}"
    fi
}

# Update deployment (git pull + rebuild)
update_deployment() {
    local services="$1"
    
    echo "🔄 Updating deployment..."
    echo ""
    
    # Check if we're in a git repository
    if [ -d .git ]; then
        echo "📥 Pulling latest changes from git..."
        git pull
        echo ""
    else
        echo -e "${YELLOW}⚠️  Not a git repository, skipping git pull${NC}"
        echo ""
    fi
    
    pre_deployment_checks
    backup_database
    
    deploy_services "$services"
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    health_checks
    
    log_deployment "Deployment updated successfully"
    
    echo ""
    echo "📝 Next steps:"
    echo "  - Check logs: docker compose -f $COMPOSE_FILE logs -f"
    echo "  - View status: docker compose -f $COMPOSE_FILE ps"
    echo "  - Run migrations if needed: docker exec -it recce_backend_prod npm run migrate"
}

# Full deployment (matches original deploy.sh behavior)
full_deployment() {
    echo "🏗️  Building and starting services..."
    echo ""
    
    # Optional: Run pre-deployment checks (can be skipped with SKIP_CHECKS=1)
    if [ "${SKIP_CHECKS:-0}" != "1" ]; then
        pre_deployment_checks
        backup_database
    fi
    
    # Pull latest images
    echo "📥 Pulling latest images..."
    docker compose -f "$COMPOSE_FILE" pull || true
    
    # Build and start services
    echo "🔨 Building services..."
    docker compose -f "$COMPOSE_FILE" up -d --build
    
    echo ""
    echo -e "${GREEN}✅ Services started successfully!${NC}"
    echo ""
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 10
    
    # Check health (matches original deploy.sh)
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
    
    log_deployment "Full deployment completed"
    
    echo ""
    echo "📝 Next steps:"
    echo "1. Run database migrations: docker exec -it recce_backend_prod npm run migrate"
    echo "2. Check logs: docker compose -f $COMPOSE_FILE logs -f"
    echo "3. View status: docker compose -f $COMPOSE_FILE ps"
}

# Stop services
stop_services() {
    echo "🛑 Stopping services..."
    docker compose -f "$COMPOSE_FILE" down
    echo -e "${GREEN}✅ Services stopped.${NC}"
    log_deployment "Services stopped"
}

# View logs
view_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        echo "📋 Showing logs from all services (Press Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" logs -f
    else
        echo "📋 Showing logs from $service (Press Ctrl+C to exit)..."
        docker compose -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

# Check status
check_status() {
    echo "📊 Service status:"
    docker compose -f "$COMPOSE_FILE" ps
}

# Run migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    docker exec -it recce_backend_prod npm run migrate
    echo -e "${GREEN}✅ Migrations completed!${NC}"
    log_deployment "Migrations run"
}

# Show deployment history
show_history() {
    if [ -f "$LOG_FILE" ]; then
        echo "📜 Deployment history:"
        echo ""
        tail -20 "$LOG_FILE"
    else
        echo "No deployment history found."
    fi
}

# Main command handler
case "${1:-deploy}" in
    deploy|full)
        full_deployment
        ;;
    update)
        update_deployment "$2"
        ;;
    update-frontend)
        update_deployment "frontend"
        ;;
    update-backend)
        update_deployment "backend"
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        full_deployment
        ;;
    logs)
        view_logs "$2"
        ;;
    status)
        check_status
        ;;
    migrate)
        run_migrations
        ;;
    history)
        show_history
        ;;
    help|--help|-h)
        echo "Usage: $0 {command} [options]"
        echo ""
        echo "Commands:"
        echo "  deploy              - Full deployment (build and start all services)"
        echo "  update [services]   - Update deployment (git pull + rebuild)"
        echo "  update-frontend    - Update only frontend service"
        echo "  update-backend     - Update only backend service"
        echo "  stop               - Stop all services"
        echo "  restart            - Restart all services"
        echo "  logs [service]     - View logs (optionally for specific service)"
        echo "  status             - Check service status"
        echo "  migrate            - Run database migrations"
        echo "  history            - Show deployment history"
        echo ""
        echo "Examples:"
        echo "  ./deploy-prod.sh deploy          # Full deployment"
        echo "  ./deploy-prod.sh update          # Update all services"
        echo "  ./deploy-prod.sh update-frontend # Update only frontend"
        echo "  ./deploy-prod.sh logs backend    # View backend logs"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo "Run '$0 help' for usage information."
        exit 1
        ;;
esac

