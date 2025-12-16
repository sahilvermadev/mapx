#!/bin/bash

# Development workflow script for RECCE application
# This script helps manage local development environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 RECCE Development Script"
echo "=========================="
echo ""

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
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file. Please update it with your configuration.${NC}"
        echo -e "${YELLOW}⚠️  Remember to update .env with your actual values before starting services.${NC}"
    else
        echo -e "${RED}❌ .env.example not found. Please create .env manually.${NC}"
        exit 1
    fi
fi

# Function to start development services
start_dev() {
    echo "🚀 Starting development services..."
    echo ""
    
    # Check if we should start all services or just infrastructure
    if [ "$1" == "infra" ] || [ "$1" == "db" ]; then
        # Start only database and redis
        echo "📦 Starting database and Redis..."
        docker compose up -d db redis
        
        echo ""
        echo -e "${GREEN}✅ Database and Redis started!${NC}"
        echo ""
        echo "📝 Services running:"
        echo "  - Database: localhost:5432"
        echo "  - Redis: localhost:6379"
        echo ""
        echo "💡 Next steps:"
        echo "   1. Start backend: cd backend && npm run dev"
        echo "   2. Start frontend: cd frontend/mapx-frontend && npm run dev"
        echo "   Or run: ./dev.sh start (to start all services in Docker)"
    else
        # Start all services in Docker (matches production setup)
        echo "📦 Starting all services in Docker..."
        echo ""
        echo "This will start:"
        echo "  - Database (PostgreSQL)"
        echo "  - Redis"
        echo "  - Backend (with hot-reload)"
        echo "  - Frontend (with hot-reload)"
        echo ""
        
        docker compose up -d
        
        # Wait for services to be ready
        echo ""
        echo "⏳ Waiting for services to be ready..."
        sleep 5
        
        echo ""
        echo -e "${GREEN}✅ All services started in Docker!${NC}"
        echo ""
        echo "📝 Services running:"
        echo "  - Database: localhost:5432"
        echo "  - Redis: localhost:6379"
        echo "  - Backend: http://localhost:5000 (with hot-reload)"
        echo "  - Frontend: http://localhost:5173 (with hot-reload)"
        echo "  - pgAdmin: http://localhost:8080 (optional)"
        echo ""
        echo "🌐 Access your application:"
        echo "  Frontend: http://localhost:5173"
        echo "  Backend API: http://localhost:5000"
        echo ""
        echo "💡 View logs: ./dev.sh logs"
        echo "💡 Stop services: ./dev.sh stop"
    fi
}

# Function to stop all services
stop_dev() {
    echo "🛑 Stopping development services..."
    docker compose down
    echo -e "${GREEN}✅ Services stopped.${NC}"
}

# Function to view logs
view_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        echo "📋 Showing logs from all services (Press Ctrl+C to exit)..."
        docker compose logs -f
    else
        echo "📋 Showing logs from $service (Press Ctrl+C to exit)..."
        docker compose logs -f "$service"
    fi
}

# Function to check service status
check_status() {
    echo "📊 Checking service status..."
    docker compose ps
}

# Function to clean up (remove containers and volumes)
clean_dev() {
    echo -e "${YELLOW}⚠️  This will remove all containers and volumes!${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🧹 Cleaning up..."
        docker compose down -v
        echo -e "${GREEN}✅ Cleanup complete.${NC}"
    else
        echo "Cancelled."
    fi
}

# Function to reset database
reset_db() {
    echo -e "${YELLOW}⚠️  This will remove the database volume and all data!${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗄️  Resetting database..."
        docker compose down db
        docker volume rm recce_db_data 2>/dev/null || true
        docker compose up -d db
        echo -e "${GREEN}✅ Database reset. Waiting for database to be ready...${NC}"
        sleep 5
        echo "💡 Don't forget to run migrations: cd backend && npm run migrate"
    else
        echo "Cancelled."
    fi
}

# Function to run migrations
run_migrations() {
    echo "🗄️  Running database migrations..."
    if docker compose ps backend | grep -q "Up"; then
        docker exec -it recce_backend_container npm run migrate
    else
        echo -e "${YELLOW}⚠️  Backend container is not running.${NC}"
        echo "Starting backend container..."
        docker compose up -d backend
        sleep 5
        docker exec -it recce_backend_container npm run migrate
    fi
    echo -e "${GREEN}✅ Migrations completed!${NC}"
}

# Function to install dependencies
install_deps() {
    echo "📦 Installing dependencies..."
    echo ""
    echo "Installing backend dependencies..."
    cd backend && npm install && cd ..
    echo ""
    echo "Installing frontend dependencies..."
    cd frontend/mapx-frontend && npm install && cd ../..
    echo -e "${GREEN}✅ All dependencies installed!${NC}"
}

# Function to show help
show_help() {
    echo "Usage: $0 {command} [options]"
    echo ""
    echo "Commands:"
    echo "  start [infra]    - Start all services in Docker (default)"
    echo "                     'infra' starts only database and Redis"
    echo "  stop             - Stop all services"
    echo "  restart          - Restart all services"
    echo "  logs [service]   - View logs (optionally for specific service)"
    echo "  status           - Check service status"
    echo "  migrate          - Run database migrations"
    echo "  reset-db         - Reset database (removes all data)"
    echo "  clean            - Remove all containers and volumes"
    echo "  install          - Install all dependencies"
    echo "  help             - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh start          # Start all services in Docker (recommended)"
    echo "  ./dev.sh start infra    # Start only database and Redis"
    echo "  ./dev.sh logs backend   # View backend logs"
    echo "  ./dev.sh migrate        # Run migrations"
    echo ""
    echo "💡 All services run in Docker to match production environment!"
}

# Main command handler
case "${1:-help}" in
    start)
        start_dev "$2"
        ;;
    stop)
        stop_dev
        ;;
    restart)
        stop_dev
        start_dev "$2"
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
    reset-db)
        reset_db
        ;;
    clean)
        clean_dev
        ;;
    install)
        install_deps
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

